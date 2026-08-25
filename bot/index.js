// 非兌換碼功能已暫時停用，完整版本見 index.full.js

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();
require('./polyfill-websocket');

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { findCode, findExistingCodes, insertCodes, deleteCode, listAllCodes } = require('./codes');
const { syncMembers } = require('./members');
const { syncStickers } = require('./stickers');
const { syncChannels } = require('./channels');
const { syncRoles } = require('./roles');
const {
    setupEventHandlers,
    handleCreateEventSlash,
    // setupEventReminders,
    isCreatingEvent
} = require('./event');
const { setupBirthdayReminders } = require('./birthday');
const { setupAnnouncementReminders } = require('./announcement');
const { setupCodeAutoSchedule } = require('./code-auto');
const { askDeepSeek } = require('./deepseek');
const { summarizeChannel } = require('./summary');
const { getConversationConfig } = require('./conversations');
const { getConversationHistory, saveConversationTurn } = require('./messages');
const { handleKeywordTrigger } = require('./keyword-triggers');

const CODE_CHANNEL_ID = '1505091070734630912';
const GUILD_ID = '1483850659240480848';
const CODE_REPLY_EMOJI = '<:00011:1520793326075515050>';
const BOT_CHANNEL_ID = '1521745408794165278';
const CREATE_EVENT_CHANNEL_ID = '1489088135659913326';
const EVENT_CHANNEL_ID = '1514618700320211025';//1514618700320211025
const MEMBER_ROLE_ID = '1483850659240480857';
const TIMEZONE = 'Asia/Kuala_Lumpur';
const SUMMARY_COOLDOWN_MS = 5 * 60 * 1000;
const summaryCooldowns = new Map();

const HELP_TEXT = `📖 **白雲機器人指令說明**

**/ping**
測試機器人是否在線。

**/code_info** \`code:兌換碼\`
查詢單個兌換碼的記錄時間與狀態。

**/show-code-list**
顯示最近 3 天內的兌換碼及建立日期（最多 30 筆，由新到舊）。

**/del** \`code:兌換碼\`
從資料庫刪除指定兌換碼。（需「管理伺服器」權限）

**/code-help**
顯示本說明列表。

📌 **自動功能**
在兌換碼頻道直接發送兌換碼，機器人會自動檢查是否重複：
- 新碼 → 寫入資料庫並標記 ✅
- 舊碼 → 提示已發過並標記 ❌

⚠️ **/code_info、/show-code-list、/del、/code-help** 僅能在兌換碼頻道使用。`;

const CODE_CHANNEL_COMMANDS = new Set([
    'code_info',
    'code-help',
    'show-code-list',
    'del'
]);

const BOT_CHANNEL_COMMANDS = new Set([
    'sync-members',
    'sync_pic',
    'sync_channels',
    'sync-roles'
]);

const ASK_CHANNEL_IDS = new Set([
    BOT_CHANNEL_ID,
    '1483850660284731648',
    '1533830230156775434',
    '1483850660284731644',
    '1483850659882209393',
    '1483850660284731647'
]);

function formatMalaysiaTime(isoString) {
    return new Date(isoString).toLocaleString('zh-MY', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function isExpiredInteraction(error) {
    return error?.code === 10062 || error?.code === 40060;
}

async function safeReply(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        }

        return await interaction.reply(options);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ /${interaction.commandName} reply skipped (${error.code})`);
            return null;
        }

        throw error;
    }
}

async function safeDefer(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return true;
        }

        await interaction.deferReply(options);
        return true;
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ /${interaction.commandName} defer skipped (${error.code})`);
            return false;
        }

        throw error;
    }
}

async function safeEdit(interaction, options) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            return null;
        }

        return await interaction.editReply(options);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ /${interaction.commandName} edit skipped (${error.code})`);
            return null;
        }

        throw error;
    }
}

async function safeFollowUp(interaction, options) {
    try {
        return await interaction.followUp(options);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ /${interaction.commandName} followUp skipped (${error.code})`);
            return null;
        }

        throw error;
    }
}

async function replyLong(interaction, text, ephemeral = true) {
    const chunks = [];
    let current = '';

    for (const line of text.split('\n')) {
        if ((current + line + '\n').length > 1900) {
            chunks.push(current);
            current = '';
        }

        current += line + '\n';
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    const replyOptions = { content: chunks[0] || '沒有內容。' };

    if (ephemeral) {
        replyOptions.flags = MessageFlags.Ephemeral;
    }

    if (interaction.deferred || interaction.replied) {
        await safeEdit(interaction, replyOptions);
    } else {
        await safeReply(interaction, replyOptions);
    }

    for (let i = 1; i < chunks.length; i++) {
        const followUpOptions = { content: chunks[i] };

        if (ephemeral) {
            followUpOptions.flags = MessageFlags.Ephemeral;
        }

        await safeFollowUp(interaction, followUpOptions);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 啟用活動相關指令與按鈕
setupEventHandlers(client);

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Check whether the bot is online'),

        new SlashCommandBuilder()
            .setName('code_info')
            .setDescription('Check when a redeem code was first recorded')
            .addStringOption(option =>
                option
                    .setName('code')
                    .setDescription('Redeem code')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('del')
            .setDescription('Delete a redeem code from the database')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .addStringOption(option =>
                option
                    .setName('code')
                    .setDescription('Redeem code to delete')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('show-code-list')
            .setDescription('Show all redeem codes with creation date'),

        new SlashCommandBuilder()
            .setName('code-help')
            .setDescription('Show all commands and what they do'),

        new SlashCommandBuilder()
            .setName('create-event')
            .setDescription('Create a new event announcement step by step'),

        new SlashCommandBuilder()
            .setName('sync-members')
            .setDescription('Sync all guild members to the database'),

        new SlashCommandBuilder()
            .setName('sync_pic')
            .setDescription('Sync all server emojis to the sticker table'),

        new SlashCommandBuilder()
            .setName('sync_channels')
            .setDescription('Sync all server channels to the channel table'),

        new SlashCommandBuilder()
            .setName('sync-roles')
            .setDescription('Sync all server roles to the roles table'),

        new SlashCommandBuilder()
            .setName('ask')
            .setDescription('Ask the Discord AI assistant')
            .addStringOption(option =>
                option
                    .setName('question')
                    .setDescription('Your question')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('summary')
            .setDescription('Summarize the latest 200 messages in this channel')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' })
        .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            GUILD_ID
        ),
        { body: commands }
    );

    console.log('✅ Slash Commands registered!');
}

let botReady = false;

async function onClientReady() {
    if (botReady) return;
    botReady = true;

    console.log(`✅ ${client.user.tag} 已上線！`);

    try {
        // 活動開始提醒已停用（不再發到 EVENT_CHANNEL_ID）
        // setupEventReminders(client, EVENT_CHANNEL_ID);
        setupBirthdayReminders(client);
        setupAnnouncementReminders(client, MEMBER_ROLE_ID);
        setupCodeAutoSchedule(client);
    } catch (error) {
        console.error('❌ Failed to start scheduled bot jobs:', error);
    }

    if (process.env.REGISTER_SLASH_COMMANDS === '1') {
        try {
            await registerCommands();
        } catch (error) {
            console.error('❌ Slash Command registration failed:', error);
        }
    }
}

client.once('clientReady', onClientReady);
client.once('ready', onClientReady);

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await handleSlashCommand(interaction);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ /${interaction.commandName} interaction expired (${error.code})`);
            return;
        }

        console.error(`/${interaction.commandName} failed:`, error?.message || error, error);
        await safeReply(interaction, {
            content: '❌ 指令執行失敗，請稍後再試。',
            flags: MessageFlags.Ephemeral
        });
    }
});

async function handleSlashCommand(interaction) {
    if (
        CODE_CHANNEL_COMMANDS.has(interaction.commandName) &&
        interaction.channelId !== CODE_CHANNEL_ID
    ) {
        await safeReply(interaction, {
            content: `❌ 此指令只能在 <#${CODE_CHANNEL_ID}> 使用。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (
        BOT_CHANNEL_COMMANDS.has(interaction.commandName) &&
        interaction.channelId !== BOT_CHANNEL_ID
    ) {
        await safeReply(interaction, {
            content: `❌ 此指令只能在 <#${BOT_CHANNEL_ID}> 使用。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // if (
    //     interaction.commandName === 'ask' &&
    //     !ASK_CHANNEL_IDS.has(interaction.channelId)
    // ) {
    //     await interaction.reply({
    //         content: '❌ 此指令只能在指定的 Bot / 語音文字頻道使用。',
    //         flags: MessageFlags.Ephemeral
    //     });
    //     return;
    // }

    // 允許在所有頻道使用 summary 指令，不做限制。

    if (interaction.commandName === 'ping') {
        await safeReply(interaction, '✅ 白雲機器人在線中！');
        return;
    }

    if (interaction.commandName === 'code-help') {
        await safeReply(interaction, {
            content: HELP_TEXT,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (interaction.commandName === 'code_info') {
        const inputCode = interaction.options
            .getString('code')
            .trim()
            .toUpperCase();

        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        try {
            const record = await findCode(inputCode);

            if (!record) {
                await safeEdit(interaction, {
                    content:
                        `❌ 找不到 **${inputCode}** 的歷史記錄。\n\n` +
                        `如果這是今天以前就存在的舊兌換碼，請重新發一次後才會開始記錄時間。`
                });
                return;
            }

            const malaysiaTime = formatMalaysiaTime(record.created_at);

            await safeEdit(interaction, {
                content:
`📋 **兌換碼資訊**

🔑 兌換碼：
${record.code}

🕒 首次記錄：
${malaysiaTime}

📌 狀態：
${record.status}`
            });
        } catch (error) {
            console.error('code_info Supabase error:', error);
            await safeEdit(interaction, {
                content: '❌ 讀取兌換碼資料失敗，請稍後再試。'
            });
        }
        return;
    }

    if (interaction.commandName === 'del') {
        const inputCode = interaction.options
            .getString('code')
            .trim()
            .toUpperCase();

        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        try {
            const deleted = await deleteCode(inputCode);

            if (!deleted) {
                await safeEdit(interaction, {
                    content: `❌ 找不到 **${inputCode}**，無法刪除。`
                });
                return;
            }

            await safeEdit(interaction, {
                content: `✅ 已刪除兌換碼：**${deleted.code}**`
            });
        } catch (error) {
            console.error('del Supabase error:', error);
            await safeEdit(interaction, {
                content: '❌ 刪除兌換碼失敗，請稍後再試。'
            });
        }
        return;
    }

    if (interaction.commandName === 'show-code-list') {
        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        try {
            const records = await listAllCodes();

            if (records.length === 0) {
                await safeEdit(interaction, {
                    content: '📋 最近 3 天內沒有任何兌換碼記錄。'
                });
                return;
            }

            let text = `📋 **兌換碼列表**（最近 3 天，共 ${records.length} 筆，最多 30 筆）\n\n`;

            for (const record of records) {
                text += `🔑 ${record.code} | ${record.status} | ${formatMalaysiaTime(record.created_at)}\n`;
            }

            await replyLong(interaction, text);
        } catch (error) {
            console.error('show-code-list Supabase error:', error);
            await safeEdit(interaction, {
                content: '❌ 讀取兌換碼列表失敗，請稍後再試。'
            });
        }
        return;
    }

    if (interaction.commandName === 'create-event') {
        await handleCreateEventSlash(interaction, [
            BOT_CHANNEL_ID,
            CREATE_EVENT_CHANNEL_ID
        ]);
        return;
    }

    if (interaction.commandName === 'sync-members') {
        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        const guild = interaction.guild;

        if (!guild) {
            await safeEdit(interaction, '❌ 此指令只能在伺服器內使用。');
            return;
        }

        try {
            await guild.members.fetch();

            const rows = [...guild.members.cache.values()]
                .filter(member =>
                    !member.user.bot &&
                    member.roles.cache.has(MEMBER_ROLE_ID)
                )
                .map(member => ({
                    discord_id: member.user.id,
                    username: member.displayName
                }));

            const { synced, removed } = await syncMembers(rows);

            let reply = `✅ 已同步 **${synced}** 位成員到資料庫（僅含 <@&${MEMBER_ROLE_ID}> 身份組）。`;

            if (removed > 0) {
                reply += `\n⏸️ 已將 **${removed}** 位不再擁有該身份組的成員標記為 inactive。`;
            }

            await safeEdit(interaction, reply);
        } catch (error) {
            console.error('sync-members error:', error?.message || error, error);
            await safeEdit(interaction, '❌ 同步成員失敗，請稍後再試。');
        }

        return;
    }

    if (interaction.commandName === 'sync_pic') {
        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        const guild = interaction.guild;

        if (!guild) {
            await safeEdit(interaction, '❌ 此指令只能在伺服器內使用。');
            return;
        }

        try {
            await guild.emojis.fetch();

            const rows = [...guild.emojis.cache.values()].map(emoji => ({
                pic_name: emoji.name,
                pic_code: emoji.toString(),
                pic_discord_id: emoji.id
            }));

            const { synced, inserted, updated } = await syncStickers(rows);

            await safeEdit(
                interaction,
                `✅ 已同步 **${synced}** 個伺服器表情到資料庫。\n` +
                `新增 **${inserted}** 個，更新 **${updated}** 個。`
            );
        } catch (error) {
            console.error('sync_pic error:', error?.message || error, error);
            await safeEdit(interaction, '❌ 同步表情失敗，請稍後再試。');
        }

        return;
    }

    if (interaction.commandName === 'sync_channels') {
        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        const guild = interaction.guild;

        if (!guild) {
            await safeEdit(interaction, '❌ 此指令只能在伺服器內使用。');
            return;
        }

        try {
            await guild.channels.fetch();

            const rows = [...guild.channels.cache.values()].map(channel => ({
                channel_name: channel.name,
                channel_id: channel.id,
                type: ChannelType[channel.type] || String(channel.type)
            }));

            const { synced, inserted, updated } = await syncChannels(rows);

            await safeEdit(
                interaction,
                `✅ 已同步 **${synced}** 個頻道到資料庫。\n` +
                `新增 **${inserted}** 個，更新 **${updated}** 個。`
            );
        } catch (error) {
            console.error('sync_channels error:', error?.message || error, error);
            await safeEdit(interaction, '❌ 同步頻道失敗，請稍後再試。');
        }

        return;
    }

    if (interaction.commandName === 'sync-roles') {
        if (!(await safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) return;

        const guild = interaction.guild;

        if (!guild) {
            await safeEdit(interaction, '❌ 此指令只能在伺服器內使用。');
            return;
        }

        try {
            await guild.roles.fetch();

            const rows = [...guild.roles.cache.values()];
            const { synced, removed } = await syncRoles(rows);

            let reply = `✅ 已同步 **${synced}** 個身份組到資料庫。`;

            if (removed > 0) {
                reply += `\n🗑️ 已刪除 **${removed}** 個 Discord 裡已不存在的身份組。`;
            }

            await safeEdit(interaction, reply);
        } catch (error) {
            console.error('sync-roles error:', error?.message || error, error);
            await safeEdit(interaction, '❌ 同步身份組失敗，請稍後再試。');
        }

        return;
    }

    if (interaction.commandName === 'ask') {
        const question = interaction.options.getString('question', true).trim();
        const channelId = interaction.channelId;
        const userId = interaction.user.id;

        if (!(await safeDefer(interaction))) return;

        try {
            const { systemPrompt, maxHistory } = await getConversationConfig(channelId);
            const history = await getConversationHistory(channelId, maxHistory);
            const answer = await askDeepSeek(question, { history, systemPrompt });

            await saveConversationTurn({
                channelId,
                userId,
                question,
                answer
            });

            const header = `<@${userId}> 問：${question}\n\n`;
            const maxAnswerLength = Math.max(100, 1900 - header.length);
            const body = answer.length > maxAnswerLength
                ? `${answer.slice(0, maxAnswerLength - 1)}…`
                : answer;

            await safeEdit(interaction, {
                content: header + body,
                allowedMentions: { users: [userId] }
            });
        } catch (error) {
            console.error('ask DeepSeek error:', error?.message || error, error);
            await safeEdit(
                interaction,
                `<@${userId}> 問：${question}\n\n❌ AI 回答失敗，請稍後再試。`
            );
        }

        return;
    }

    if (interaction.commandName === 'summary') {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;
        const now = Date.now();
        const lastUsedAt = summaryCooldowns.get(channelId) || 0;
        const remainingMs = SUMMARY_COOLDOWN_MS - (now - lastUsedAt);

        if (remainingMs > 0) {
            const remainingSec = Math.ceil(remainingMs / 1000);
            const minutes = Math.floor(remainingSec / 60);
            const seconds = remainingSec % 60;
            const waitText = minutes > 0
                ? `${minutes} 分 ${seconds} 秒`
                : `${seconds} 秒`;

            await safeReply(interaction, {
                content: `⏳ 此頻道 /summary 冷卻中，請再等 **${waitText}**。`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (!(await safeDefer(interaction))) return;

        summaryCooldowns.set(channelId, Date.now());

        try {
            const summary = await summarizeChannel(interaction.channel);
            const header = `📝 **頻道訊息總結**（由 <@${userId}> 請求）\n\n`;
            const full = header + summary;

            if (full.length <= 1900) {
                await safeEdit(interaction, {
                    content: full,
                    allowedMentions: { users: [userId] }
                });
            } else {
                await safeEdit(interaction, {
                    content: full.slice(0, 1900),
                    allowedMentions: { users: [userId] }
                });

                let remaining = full.slice(1900);
                while (remaining.length > 0) {
                    await safeFollowUp(interaction, { content: remaining.slice(0, 1900) });
                    remaining = remaining.slice(1900);
                }
            }
        } catch (error) {
            summaryCooldowns.delete(channelId);
            console.error('summary DeepSeek error:', error?.message || error, error);
            await safeEdit(
                interaction,
                `❌ 總結失敗：${error.message || '請稍後再試。'}`
            );
        }
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!isCreatingEvent(message.author.id)) {
        try {
            await handleKeywordTrigger(message);
        } catch (error) {
            console.error('keyword trigger error:', error?.message || error, error);
        }
    }

    if (message.channel.id !== CODE_CHANNEL_ID) return;

    const matches = message.content.match(/[A-Za-z0-9\-]{6,40}/g);
    if (!matches) return;

    const uniqueCodes = [...new Set(
        matches.map(code => code.trim().toUpperCase())
    )];

    let existingCodes;

    try {
        existingCodes = await findExistingCodes(uniqueCodes);
    } catch (error) {
        console.error('code check Supabase error:', error);
        await message.reply('❌ 讀取兌換碼資料失敗，請稍後再試。');
        return;
    }

    const existingSet = new Set(existingCodes);
    const newCodes = [];
    const oldCodes = [];

    for (const code of uniqueCodes) {
        if (existingSet.has(code)) {
            oldCodes.push(code);
        } else {
            newCodes.push(code);
        }
    }

    if (newCodes.length > 0) {
        try {
            await insertCodes(newCodes);
        } catch (error) {
            console.error('code insert Supabase error:', error);
            await message.reply('❌ 儲存兌換碼失敗，請稍後再試。');
            return;
        }
    }

    let reply = '📋 **兌換碼檢查結果**\n\n';

    if (newCodes.length > 0) {
        reply += `✅ **新兌換碼 (${newCodes.length})**\n`;
        reply += newCodes.join('\n') + '\n\n';
    }

    if (oldCodes.length > 0) {
        reply += `❌ **已發過 (${oldCodes.length})**\n`;
        reply += oldCodes.join('\n') + '\n';
    }

    reply += `\n${CODE_REPLY_EMOJI} by <@${message.author.id}>`;

    await message.reply({
        content: reply,
        allowedMentions: { users: [message.author.id] }
    });

    await message.delete().catch(error => {
        console.error('刪除兌換碼訊息失敗:', error);
    });
});

if (!process.env.DISCORD_TOKEN) {
    console.warn('⚠️ DISCORD_TOKEN is missing; Discord bot will not start.');
} else {
    client.login(process.env.DISCORD_TOKEN).catch(error => {
        console.error('❌ Discord login failed:', error);
    });
}
