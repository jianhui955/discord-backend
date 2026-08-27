const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');

const supabase = require('./supabase');

const EVENT_TIMEZONE = 'Asia/Hong_Kong';
const BUTTON_PREFIX = 'event_role_';

function isExpiredInteraction(error) {
    return error?.code === 10062 || error?.code === 40060;
}

async function safeDeferUpdate(interaction) {
    try {
        if (interaction.deferred || interaction.replied) return true;
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ event button expired on defer (${error.code})`);
            return false;
        }
        throw error;
    }
}

async function safeDeferReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) return true;
        await interaction.deferReply(options);
        return true;
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ event button expired on defer (${error.code})`);
            return false;
        }
        throw error;
    }
}

async function safeReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp(options);
        }
        return await interaction.reply(options);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ event button expired on reply (${error.code})`);
            return null;
        }
        throw error;
    }
}

async function safeEdit(interaction, options) {
    try {
        if (!interaction.deferred && !interaction.replied) return null;
        return await interaction.editReply(options);
    } catch (error) {
        if (isExpiredInteraction(error)) {
            console.warn(`⚠️ event button expired on edit (${error.code})`);
            return null;
        }
        throw error;
    }
}

function parseSingleDatePart(dateRaw) {
    const value = String(dateRaw || '').trim();

    let year = null;
    let day;
    let month;

    // 2026-08-09 / 2026/08/09
    const ymd = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    // 09/08、09/08/2026
    const dmySlash = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    // 08-09、09-09、08-09-2026（日-月）
    const dmyDash = value.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{4}))?$/);

    if (ymd) {
        year = Number(ymd[1]);
        month = Number(ymd[2]);
        day = Number(ymd[3]);
    } else if (dmySlash) {
        day = Number(dmySlash[1]);
        month = Number(dmySlash[2]);
        if (dmySlash[3]) year = Number(dmySlash[3]);
    } else if (dmyDash) {
        day = Number(dmyDash[1]);
        month = Number(dmyDash[2]);
        if (dmyDash[3]) year = Number(dmyDash[3]);
    } else {
        return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    const dateStr = year
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;

    return {
        dateStr,
        year: year || new Date().getFullYear(),
        month,
        day,
        hasYear: Boolean(year)
    };
}

function parseEventDate(dateInput) {
    const dateRaw = String(dateInput || '').trim();

    // 支援區間：08-09 to 09-09 / 08-09到09-09 / 08-09 - 09-09
    // 注意：不能用單獨的 - 當分隔，否則會把 08-09 拆壞
    const rangeMatch = dateRaw.match(/^(.+?)\s*(?:到|to)\s*(.+)$/i)
        || dateRaw.match(/^(.+?)\s+-\s+(.+)$/);

    if (rangeMatch) {
        const start = parseSingleDatePart(rangeMatch[1]);
        const end = parseSingleDatePart(rangeMatch[2]);

        if (!start || !end) return null;

        return {
            ...start,
            dateStr: `${start.dateStr}到${end.dateStr}`,
            endDateStr: end.dateStr
        };
    }

    return parseSingleDatePart(dateRaw);
}

function parseEventTimeInput(timeInput) {
    const original = String(timeInput || '').trim();

    // 輸入 - 代表跳過時間
    if (original === '-') {
        return { skipped: true, timeStr: null };
    }

    const timeRaw = original.toLowerCase().replace(/\s+/g, '');
    let hour;
    let minute;

    const ampmMatch = timeRaw.match(/^(\d{1,2})[.:](\d{2})(am|pm)$/);
    const h24Match = timeRaw.match(/^(\d{1,2})[.:](\d{2})$/);

    if (ampmMatch) {
        hour = Number(ampmMatch[1]);
        minute = Number(ampmMatch[2]);
        const ampm = ampmMatch[3];

        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
    } else if (h24Match) {
        hour = Number(h24Match[1]);
        minute = Number(h24Match[2]);
    } else {
        return null;
    }

    if (hour < 0 || hour > 23 || minute > 59) {
        return null;
    }

    return {
        skipped: false,
        timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    };
}

function formatCreatedAtLabel(date) {
    const value = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(value.getTime())) {
        return String(date || '—');
    }

    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: EVENT_TIMEZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(value);
}

function formatStoredDateLabel(dateStr) {
    const value = String(dateStr || '').trim();
    return value || '—';
}

function formatStoredTimeLabel(timeStr) {
    const value = String(timeStr || '').trim();
    if (!value || value === '-') return '未定';
    return value;
}

function combineDateTimeToDate(dateStr, timeStr) {
    // 區間日期用起始日做提醒判斷
    const startPart = String(dateStr || '').split('到')[0];
    const parsedDate = parseSingleDatePart(startPart) || parseEventDate(dateStr);
    if (!parsedDate) return null;

    const parsedTime = timeStr && String(timeStr).trim() !== '-'
        ? parseEventTimeInput(timeStr)
        : { skipped: true, timeStr: null };

    if (!parsedTime) return null;

    const hour = parsedTime.skipped ? 0 : Number(parsedTime.timeStr.slice(0, 2));
    const minute = parsedTime.skipped ? 0 : Number(parsedTime.timeStr.slice(3, 5));

    let year = parsedDate.year;
    const build = (y) => new Date(
        `${y}-${String(parsedDate.month).padStart(2, '0')}-${String(parsedDate.day).padStart(2, '0')}T` +
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
    );

    let value = build(year);
    if (Number.isNaN(value.getTime())) return null;

    if (!parsedDate.hasYear && value.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
        value = build(year + 1);
        if (Number.isNaN(value.getTime())) return null;
    }

    return value;
}

function buttonStyleForColor(color) {
    const key = String(color || '').trim().toLowerCase();

    // Discord 按鈕只有少數固定顏色，做最接近對應
    switch (key) {
        case 'blue':
        case '紫色':
        case 'purple':
            return ButtonStyle.Primary; // 藍 / 紫都接近 blurple
        case 'green':
            return ButtonStyle.Success;
        case 'red':
            return ButtonStyle.Danger;
        case 'brown':
        case 'grey':
        case 'gray':
            return ButtonStyle.Secondary;
        default:
            return ButtonStyle.Secondary;
    }
}

function normalizeMembers(member) {
    if (!Array.isArray(member)) return [];

    return member
        .map(entry => {
            if (typeof entry === 'string') {
                return { user_id: entry, game_role_id: null, username: entry };
            }

            if (entry && typeof entry === 'object') {
                return {
                    user_id: String(entry.user_id || ''),
                    game_role_id: entry.game_role_id != null ? Number(entry.game_role_id) : null,
                    username: entry.username || String(entry.user_id || '')
                };
            }

            return null;
        })
        .filter(entry => entry && entry.user_id);
}

function memberUserIds(member) {
    return [...new Set(normalizeMembers(member).map(entry => entry.user_id))];
}

async function fetchGameRoles() {
    const { data, error } = await supabase
        .from('game_role')
        .select('id, name, role, icon, color')
        .order('name', { ascending: true })
        .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
}

function getEmbedFieldValue(embed, fieldName) {
    return embed?.fields?.find(field => field.name.includes(fieldName))?.value || null;
}

function getDateKeyInTimezone(dateInput, timeZone = EVENT_TIMEZONE) {
    const value = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(value.getTime())) return null;

    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(value);
}

function isSameCalendarDay(dateA, dateB, timeZone = EVENT_TIMEZONE) {
    const keyA = getDateKeyInTimezone(dateA, timeZone);
    const keyB = getDateKeyInTimezone(dateB, timeZone);
    return Boolean(keyA && keyB && keyA === keyB);
}

// Discord 會依「最寬那一行」決定 embed 寬度；普通空格幾乎無效
// Hangul Filler 看起來空白，但能撐開寬度
const EMBED_WIDTH_SPACER = '\u3164'.repeat(60);

function buildEmbedDescription(content) {
    const text = String(content || '').slice(0, 3900).trimEnd();
    return `${text}\n${EMBED_WIDTH_SPACER}`;
}

function buildEventEmbed({
    title,
    content,
    organizerName,
    createdAt,
    eventDate,
    eventTime,
    gameRoles,
    members
}) {
    const signups = normalizeMembers(members);
    const total = new Set(signups.map(entry => entry.user_id)).size;

    const embed = new EmbedBuilder()
        .setColor(0x00B4D8)
        .setTitle(title.slice(0, 256))
        .setDescription(buildEmbedDescription(content))
        .addFields(
            {
                // 再隔开 content 与下方字段，并辅助撑宽
                name: '\u200b',
                value: EMBED_WIDTH_SPACER,
                inline: false
            },
            {
                name: '發起人',
                value: String(organizerName || '未知').slice(0, 256),
                inline: true
            },
            {
                name: '創建日期',
                value: formatCreatedAtLabel(createdAt || new Date()),
                inline: true
            },
            {
                name: '\u200b',
                value: '\u200b',
                inline: true
            },
            {
                name: '👥 人數',
                value: String(total),
                inline: true
            },
            {
                name: '📅 日期',
                value: formatStoredDateLabel(eventDate),
                inline: true
            },
            {
                name: '🕐 時間',
                value: formatStoredTimeLabel(eventTime),
                inline: true
            }
        );

    // 以 game_role.name 分組；每行 3 個，行與行之間加空白拉開間距
    for (let i = 0; i < gameRoles.length; i++) {
        const role = gameRoles[i];
        const roleId = Number(role.id);
        const icon = String(role.icon || '').trim();
        const roleMembers = signups
            .filter(entry => Number(entry.game_role_id) === roleId)
            .sort((a, b) =>
                String(a.user_id).localeCompare(String(b.user_id), undefined, {
                    numeric: true
                })
            );

        const lines = roleMembers.length > 0
            ? roleMembers.map((entry, index) => `${index + 1}. ${entry.username}`).join('\n')
            : '—';

        const titlePrefix = icon ? `${icon} ` : '';
        embed.addFields({
            name: `${titlePrefix}${role.name} (${roleMembers.length})`,
            value: `${lines}\n\u200b`.slice(0, 1024),
            inline: true
        });

        // 每滿 3 個後插入一列空白，讓下一行隔開一點
        if ((i + 1) % 3 === 0 && i + 1 < gameRoles.length) {
            embed.addFields({
                name: '\u200b',
                value: '\u200b',
                inline: false
            });
        }
    }

    return embed;
}

function buildRoleButtons(eventId, gameRoles) {
    const buttons = gameRoles.map(role =>
        new ButtonBuilder()
            .setCustomId(`${BUTTON_PREFIX}${eventId}_${role.id}`)
            .setLabel(String(role.name).slice(0, 80))
            .setStyle(buttonStyleForColor(role.color))
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    return rows;
}

const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;

function buildReminderMessages(eventGuildId, eventName, dateStr, timeStr, memberIds) {
    const when = [
        formatStoredDateLabel(dateStr),
        formatStoredTimeLabel(timeStr)
    ].join(' ');

    const header =
        `⏰ **活動開始提醒！場次 #${eventGuildId}**\n` +
        `**項目：** ${eventName}\n` +
        `**時間：** ${when}\n\n`;

    if (!memberIds.length) {
        return [{
            content: header + '（目前沒有報名成員）',
            allowedMentions: { users: [] }
        }];
    }

    const messages = [];
    let chunk = header;
    let chunkUserIds = [];

    for (const userId of memberIds) {
        const mention = `<@${userId}>`;
        const next = chunk === header ? chunk + mention : `${chunk} ${mention}`;

        if (next.length > 1900) {
            messages.push({
                content: chunk,
                allowedMentions: { users: chunkUserIds }
            });
            chunk = mention;
            chunkUserIds = [userId];
        } else {
            chunk = next;
            chunkUserIds.push(userId);
        }
    }

    if (chunk.length > 0) {
        messages.push({
            content: chunk,
            allowedMentions: { users: chunkUserIds }
        });
    }

    return messages;
}

async function sendEventReminder(client, eventChannelId, eventGuild) {
    const channel = await client.channels.fetch(eventChannelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
        throw new Error(`找不到活動頻道 ${eventChannelId}`);
    }

    const { data: eventRow, error: eventError } = await supabase
        .from('event')
        .select('title, content')
        .eq('id', eventGuild.event_id)
        .single();

    if (eventError) throw eventError;

    const memberIds = memberUserIds(eventGuild.member);
    const eventName = eventRow?.title || eventRow?.content || '未知活動';

    const messages = buildReminderMessages(
        eventGuild.id,
        eventName,
        eventGuild.date,
        eventGuild.time,
        memberIds
    );

    for (const payload of messages) {
        await channel.send(payload);
    }
}

async function checkDueEventReminders(client, eventChannelId) {
    const { data: pendingEvents, error } = await supabase
        .from('event_guild')
        .select('id, event_id, date, time, member')
        .eq('reminded', false);

    if (error) {
        console.error('讀取到期活動失敗:', error);
        return;
    }

    if (!pendingEvents || pendingEvents.length === 0) return;

    const now = Date.now();
    const dueEvents = pendingEvents.filter(eventGuild => {
        // 跳過時間的活動不自動提醒
        if (!eventGuild.time || String(eventGuild.time).trim() === '-') {
            return false;
        }

        const dueAt = combineDateTimeToDate(eventGuild.date, eventGuild.time);
        return dueAt && dueAt.getTime() <= now;
    });

    if (dueEvents.length === 0) return;

    for (const eventGuild of dueEvents) {
        const { data: claimed, error: claimError } = await supabase
            .from('event_guild')
            .update({ reminded: true })
            .eq('id', eventGuild.id)
            .eq('reminded', false)
            .select('id');

        if (claimError) {
            console.error(`標記場次 #${eventGuild.id} 提醒狀態失敗:`, claimError);
            continue;
        }

        if (!claimed || claimed.length === 0) continue;

        try {
            await sendEventReminder(client, eventChannelId, eventGuild);
            console.log(`✅ 已發送場次 #${eventGuild.id} 活動提醒`);
        } catch (reminderError) {
            console.error(`發送場次 #${eventGuild.id} 提醒失敗:`, reminderError);

            await supabase
                .from('event_guild')
                .update({ reminded: false })
                .eq('id', eventGuild.id)
                .then(({ error: revertError }) => {
                    if (revertError) {
                        console.error(`還原場次 #${eventGuild.id} 提醒狀態失敗:`, revertError);
                    }
                });
        }
    }
}

function setupEventReminders(client, eventChannelId) {
    const runCheck = () => {
        checkDueEventReminders(client, eventChannelId).catch(error => {
            console.error('活動提醒檢查失敗:', error);
        });
    };

    runCheck();
    return setInterval(runCheck, REMINDER_CHECK_INTERVAL_MS);
}

const creatingEventUsers = new Set();

function waitForUserMessage(channel, userId, timeoutMs = 90_000) {
    return new Promise((resolve, reject) => {
        const filter = m => m.author.id === userId && !m.author.bot;

        const collector = channel.createMessageCollector({
            filter,
            max: 1,
            time: timeoutMs
        });

        collector.on('collect', message => resolve(message));

        collector.on('end', collected => {
            if (collected.size === 0) {
                reject(new Error('TIMEOUT'));
            }
        });
    });
}

function isCancelInput(text) {
    const value = String(text || '').trim().toLowerCase();
    return value === 'cancel' || value === '取消';
}

async function ephemeralFollowUp(interaction, content) {
    await interaction.followUp({
        content,
        flags: MessageFlags.Ephemeral
    });
}

async function askStep(interaction, channel, userId, prompt) {
    const replyPromise = waitForUserMessage(channel, userId);

    await ephemeralFollowUp(
        interaction,
        `${prompt}\n（在此頻道直接輸入回覆；輸入 \`取消\` 可中止）`
    );

    const message = await replyPromise;
    const text = message.content.trim();

    // 盡量刪掉使用者剛輸入的內容，減少頻道曝光
    await message.delete().catch(() => {});

    if (isCancelInput(text)) {
        throw new Error('CANCELLED');
    }

    if (!text) {
        throw new Error('EMPTY');
    }

    return { message, text };
}

async function handleCreateEventSlash(interaction, allowedChannelIds, publishChannelId) {
    const allowed = new Set(
        (Array.isArray(allowedChannelIds) ? allowedChannelIds : [allowedChannelIds])
            .map(id => String(id))
    );
    const commandChannelId = String(interaction.channelId);
    const eventChannelId = String(publishChannelId || interaction.channelId);

    if (!allowed.has(commandChannelId)) {
        const channelMentions = [...allowed].map(id => `<#${id}>`).join('、');
        await interaction.reply({
            content: `❌ 此指令只能在 ${channelMentions} 使用。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const userId = interaction.user.id;
    const channel = interaction.channel;
    const organizerName = interaction.member?.displayName || interaction.user.username;

    if (creatingEventUsers.has(userId)) {
        await interaction.reply({
            content: '⏳ 你已有一個進行中的建立流程，請先完成或輸入 `取消`。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    creatingEventUsers.add(userId);

    await interaction.reply({
        content: '📝 開始建立活動。以下步驟訊息只有你看得到，請依序在此頻道輸入回覆。',
        flags: MessageFlags.Ephemeral
    });

    try {
        const gameRoles = await fetchGameRoles();

        if (gameRoles.length === 0) {
            await ephemeralFollowUp(interaction, '❌ `game_role` 表沒有資料，請先新增職業/角色。');
            return;
        }

        const { text: title } = await askStep(
            interaction,
            channel,
            userId,
            '**步驟 1/4** 請輸入活動標題：'
        );

        const { text: content } = await askStep(
            interaction,
            channel,
            userId,
            '**步驟 2/4** 請輸入活動內容：'
        );

        let parsedDate = null;
        let parsedTime = null;

        for (let attempt = 0; attempt < 3 && !parsedDate; attempt++) {
            const { text: dateInput } = await askStep(
                interaction,
                channel,
                userId,
                '**步驟 3/4** 請輸入活動日期：\n例：`08-09`、`08-09 to 09-09`、`08-09到09-09`'
            );

            parsedDate = parseEventDate(dateInput);

            if (!parsedDate) {
                await ephemeralFollowUp(
                    interaction,
                    '❌ 日期格式錯誤，請重新輸入。' +
                    (attempt < 2 ? '' : '\n已達重試上限，請重新使用 `/create-event`。')
                );
            }
        }

        if (!parsedDate) return;

        for (let attempt = 0; attempt < 3 && !parsedTime; attempt++) {
            const { text: timeInput } = await askStep(
                interaction,
                channel,
                userId,
                '**步驟 4/4** 請輸入活動時間：\n例：`8.30pm`、`20:30`\n若要跳過請輸入 `-`'
            );

            parsedTime = parseEventTimeInput(timeInput);

            if (!parsedTime) {
                await ephemeralFollowUp(
                    interaction,
                    '❌ 時間格式錯誤，請重新輸入；或輸入 `-` 跳過。' +
                    (attempt < 2 ? '' : '\n已達重試上限，請重新使用 `/create-event`。')
                );
            }
        }

        if (!parsedTime) return;

        const eventChannel = await interaction.client.channels
            .fetch(eventChannelId)
            .catch(() => null);

        if (!eventChannel || !eventChannel.isTextBased()) {
            await ephemeralFollowUp(interaction, '❌ 找不到活動頻道，請聯絡管理員。');
            return;
        }

        const { data: eventRow, error: insertEventError } = await supabase
            .from('event')
            .insert({
                title,
                content,
                channel_id: String(eventChannelId),
                message_id: null
            })
            .select('id, created_at')
            .single();

        if (insertEventError) throw insertEventError;

        const eventId = eventRow.id;
        const embed = buildEventEmbed({
            title,
            content,
            organizerName,
            createdAt: eventRow.created_at || new Date(),
            eventDate: parsedDate.dateStr,
            eventTime: parsedTime.timeStr,
            gameRoles,
            members: []
        });
        const components = buildRoleButtons(eventId, gameRoles);

        const sentMessage = await eventChannel.send({
            embeds: [embed],
            components
        });

        const { error: updateEventError } = await supabase
            .from('event')
            .update({ message_id: String(sentMessage.id) })
            .eq('id', eventId);

        if (updateEventError) throw updateEventError;

        const { error: insertGuildError } = await supabase
            .from('event_guild')
            .insert({
                event_id: eventId,
                date: parsedDate.dateStr,
                time: parsedTime.timeStr,
                member: [],
                reminded: false
            });

        if (insertGuildError) throw insertGuildError;

        await ephemeralFollowUp(interaction, '✅ 活動已發布。');
    } catch (error) {
        if (error?.message === 'TIMEOUT') {
            await ephemeralFollowUp(interaction, '❌ 等待逾時，請重新輸入 `/create-event`。').catch(() => {});
            return;
        }

        if (error?.message === 'CANCELLED') {
            await ephemeralFollowUp(interaction, '已取消建立活動。').catch(() => {});
            return;
        }

        if (error?.message === 'EMPTY') {
            await ephemeralFollowUp(interaction, '❌ 內容不能為空，請重新輸入 `/create-event`。').catch(() => {});
            return;
        }

        console.error('create-event 指令錯誤:', error);
        await ephemeralFollowUp(
            interaction,
            `❌ 建立活動時發生錯誤：${error.message || '未知錯誤'}`
        ).catch(() => {});
    } finally {
        creatingEventUsers.delete(userId);
    }
}

async function handleEventRoleButton(interaction) {
    if (!(await safeDeferUpdate(interaction))) return;

    const payload = interaction.customId.slice(BUTTON_PREFIX.length);
    const splitAt = payload.indexOf('_');

    if (splitAt <= 0) {
        await safeReply(interaction, {
            content: '❌ 無效的報名按鈕。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const eventId = Number(payload.slice(0, splitAt));
    const gameRoleId = Number(payload.slice(splitAt + 1));
    const userId = interaction.user.id;
    const username = interaction.member?.displayName || interaction.user.username;

    if (!Number.isFinite(eventId) || !Number.isFinite(gameRoleId)) {
        await safeReply(interaction, {
            content: '❌ 無效的報名按鈕。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const { data: eventRow, error: eventError } = await supabase
        .from('event')
        .select('id, title, content, message_id, channel_id, created_at')
        .eq('id', eventId)
        .single();

    if (eventError) throw eventError;

    const { data: guildRows, error: guildError } = await supabase
        .from('event_guild')
        .select('id, date, time, member, updated_at')
        .eq('event_id', eventId)
        .order('id', { ascending: false })
        .limit(1);

    if (guildError) throw guildError;

    const eventGuild = guildRows?.[0];
    if (!eventGuild) return;

    // const previousUpdatedAt = eventGuild.updated_at || eventRow.created_at;
    // const shouldEdit = isSameCalendarDay(previousUpdatedAt, new Date());

    const gameRoles = await fetchGameRoles();
    const selectedRole = gameRoles.find(role => Number(role.id) === gameRoleId);
    if (!selectedRole) return;

    let members = normalizeMembers(eventGuild.member);
    const alreadySigned = members.some(
        entry => entry.user_id === userId && Number(entry.game_role_id) === gameRoleId
    );

    if (alreadySigned) {
        // 重複點同一職業 = 取消該職業
        members = members.filter(
            entry => !(entry.user_id === userId && Number(entry.game_role_id) === gameRoleId)
        );
    } else {
        // 支援一人多職業
        members.push({
            user_id: userId,
            game_role_id: gameRoleId,
            username
        });
    }

    const { error: updateError } = await supabase
        .from('event_guild')
        .update({
            member: members,
            updated_at: new Date().toISOString()
        })
        .eq('id', eventGuild.id);

    if (updateError) throw updateError;

    const currentEmbed = interaction.message.embeds?.[0];
    const organizerName = getEmbedFieldValue(currentEmbed, '發起人') || '未知';

    const embed = buildEventEmbed({
        title: eventRow.title || '活動',
        content: eventRow.content || '',
        organizerName,
        createdAt: eventRow.created_at || new Date(),
        eventDate: eventGuild.date,
        eventTime: eventGuild.time,
        gameRoles,
        members
    });

    const components = buildRoleButtons(eventId, gameRoles);

    // 暫時一律 edit；跨日 repost 邏輯先保留
    // updated_at 與今天同一天：edit；跨日才重新發布
    // if (shouldEdit) {
    try {
        await interaction.message.edit({
            embeds: [embed],
            components
        });
    } catch (editError) {
        console.error('更新活動訊息失敗:', editError);
        await safeReply(interaction, {
            content: '❌ 報名已寫入資料庫，但更新活動訊息失敗。請用 `/repost` 重新發布。',
            flags: MessageFlags.Ephemeral
        });
    }
    return;
    // }

    /*
    // 不同日期：先發新訊息再刪舊的，讓最新活動帖排在頻道最下方
    let channel = interaction.channel;
    const channelId = String(
        eventRow.channel_id || interaction.channelId || ''
    );

    if (
        (!channel || typeof channel.send !== 'function') &&
        channelId
    ) {
        channel = interaction.client.channels.cache.get(channelId) || null;
    }

    if ((!channel || typeof channel.send !== 'function') && channelId) {
        try {
            channel = await interaction.client.channels.fetch(channelId);
        } catch (fetchError) {
            console.error('找不到原始活動頻道，無法發布新訊息:', fetchError);
            await safeReply(interaction, {
                content: '❌ 報名已寫入資料庫，但更新活動訊息失敗（找不到頻道）。請用 `/repost` 重新發布。',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

    if (!channel || typeof channel.send !== 'function') {
        console.error('找不到原始活動頻道，無法發布新訊息');
        await safeReply(interaction, {
            content: '❌ 報名已寫入資料庫，但更新活動訊息失敗（找不到頻道）。請用 `/repost` 重新發布。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    let sent;
    try {
        sent = await channel.send({
            embeds: [embed],
            components
        });
    } catch (sendError) {
        console.error('發送新活動訊息失敗:', sendError);
        await safeReply(interaction, {
            content: '❌ 報名已寫入資料庫，但發送新活動訊息失敗。舊訊息不會刪除。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await supabase
        .from('event')
        .update({
            message_id: String(sent.id),
            channel_id: String(channel.id)
        })
        .eq('id', eventId);

    // 新訊息成功後才刪舊訊息
    await interaction.message.delete().catch((err) => {
        console.warn('刪除舊活動訊息失敗:', err?.message || err);
    });
    */
}

function setupEventHandlers(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId.startsWith(BUTTON_PREFIX)) {
            try {
                await handleEventRoleButton(interaction);
            } catch (error) {
                if (isExpiredInteraction(error)) {
                    console.warn(`⚠️ event role button expired (${error.code})`);
                    return;
                }

                console.error('活動報名按鈕失敗:', error);

                await safeReply(interaction, {
                    content: '❌ 報名失敗，請稍後再試。',
                    flags: MessageFlags.Ephemeral
                });
            }
            return;
        }

        if (!interaction.customId.startsWith('join_guild_event_')) return;

        const eventGuildId = interaction.customId.replace('join_guild_event_', '');
        const userId = interaction.user.id;

        try {
            if (!(await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }))) return;

            const { data: eventData, error: fetchError } = await supabase
                .from('event_guild')
                .select('member, event_id')
                .eq('id', eventGuildId)
                .single();

            if (fetchError) throw fetchError;

            const currentMembers = memberUserIds(eventData?.member);

            if (currentMembers.includes(userId)) {
                await safeEdit(interaction, {
                    content: 'ℹ️ 你已經報名過這場活動囉！'
                });
                return;
            }

            const nextMembers = [
                ...normalizeMembers(eventData?.member),
                {
                    user_id: userId,
                    game_role_id: null,
                    username: interaction.member?.displayName || interaction.user.username
                }
            ];

            const { error: updateError } = await supabase
                .from('event_guild')
                .update({ member: nextMembers })
                .eq('id', eventGuildId);

            if (updateError) throw updateError;

            await safeEdit(interaction, {
                content: `🎉 報名成功！你已成功加入場次 **#${eventGuildId}** 的名單。`
            });
        } catch (error) {
            if (isExpiredInteraction(error)) {
                console.warn(`⚠️ event button interaction expired (${error.code})`);
                return;
            }

            console.error('按鈕處理失敗:', error);
            await safeReply(interaction, {
                content: '❌ 報名失敗，資料庫更新時出現錯誤。',
                flags: MessageFlags.Ephemeral
            });
        }
    });
}

async function handleRepostSlash(interaction, allowedChannelIds, publishChannelId) {
    const allowed = new Set(
        (Array.isArray(allowedChannelIds) ? allowedChannelIds : [allowedChannelIds])
            .map(id => String(id))
    );
    const targetChannelId = String(publishChannelId || interaction.channelId);

    if (!allowed.has(String(interaction.channelId))) {
        const channelMentions = [...allowed].map(id => `<#${id}>`).join('、');
        await interaction.reply({
            content: `❌ 此指令只能在 ${channelMentions} 使用。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const eventIdRaw = interaction.options.getString('id', true).trim();
    const eventId = Number(eventIdRaw);

    if (!Number.isFinite(eventId)) {
        await interaction.reply({
            content: '❌ 請輸入有效的 `event` id（數字）。',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { data: eventRow, error: eventError } = await supabase
            .from('event')
            .select('id, title, content, message_id, channel_id, created_at')
            .eq('id', eventId)
            .single();

        if (eventError || !eventRow) {
            await interaction.editReply(`❌ 找不到 event id = **${eventIdRaw}**。`);
            return;
        }

        const { data: guildRows, error: guildError } = await supabase
            .from('event_guild')
            .select('id, date, time, member')
            .eq('event_id', eventId)
            .order('id', { ascending: false })
            .limit(1);

        if (guildError) throw guildError;

        const eventGuild = guildRows?.[0];
        if (!eventGuild) {
            await interaction.editReply(
                `❌ event **#${eventId}** 沒有對應的 event_guild 場次。`
            );
            return;
        }

        const gameRoles = await fetchGameRoles();
        if (gameRoles.length === 0) {
            await interaction.editReply('❌ `game_role` 表沒有資料，請先新增職業/角色。');
            return;
        }

        let organizerName =
            interaction.member?.displayName || interaction.user.username || '未知';

        // 若舊訊息還在，嘗試沿用原本發起人
        if (eventRow.message_id && eventRow.channel_id) {
            try {
                const oldChannel = await interaction.client.channels.fetch(eventRow.channel_id);
                if (oldChannel?.isTextBased?.()) {
                    const oldMessage = await oldChannel.messages.fetch(String(eventRow.message_id));
                    const fromEmbed = getEmbedFieldValue(oldMessage.embeds?.[0], '發起人');
                    if (fromEmbed) organizerName = fromEmbed;
                }
            } catch {
                // 舊訊息找不到就略過
            }
        }

        const targetChannel = await interaction.client.channels
            .fetch(targetChannelId)
            .catch(() => null);

        if (!targetChannel || typeof targetChannel.send !== 'function') {
            await interaction.editReply(`❌ 找不到發布頻道 <#${targetChannelId}>。`);
            return;
        }

        const embed = buildEventEmbed({
            title: eventRow.title || '活動',
            content: eventRow.content || '',
            organizerName,
            createdAt: eventRow.created_at || new Date(),
            eventDate: eventGuild.date,
            eventTime: eventGuild.time,
            gameRoles,
            members: eventGuild.member
        });

        // 按鈕仍綁 event.id（與報名邏輯一致）
        const components = buildRoleButtons(eventRow.id, gameRoles);

        const sent = await targetChannel.send({
            embeds: [embed],
            components
        });

        const { error: updateError } = await supabase
            .from('event')
            .update({
                message_id: String(sent.id),
                channel_id: String(targetChannel.id)
            })
            .eq('id', eventRow.id);

        if (updateError) throw updateError;

        // 新訊息發成功後，盡量刪掉舊訊息
        if (
            eventRow.message_id &&
            String(eventRow.message_id) !== String(sent.id)
        ) {
            try {
                const oldChannelId = eventRow.channel_id || targetChannel.id;
                const oldChannel =
                    oldChannelId === targetChannel.id
                        ? targetChannel
                        : await interaction.client.channels.fetch(oldChannelId);
                if (oldChannel?.isTextBased?.()) {
                    const oldMessage = await oldChannel.messages.fetch(String(eventRow.message_id));
                    await oldMessage.delete();
                }
            } catch (deleteError) {
                console.warn('repost 刪除舊訊息失敗:', deleteError?.message || deleteError);
            }
        }

        await interaction.editReply(
            `✅ 已重新發布活動 **#${eventRow.id}** 到 <#${targetChannel.id}>。`
        );
    } catch (error) {
        console.error('repost 指令錯誤:', error);
        await interaction.editReply(
            `❌ 重新發布失敗：${error.message || '未知錯誤'}`
        ).catch(() => {});
    }
}

function isCreatingEvent(userId) {
    return creatingEventUsers.has(String(userId));
}

module.exports = {
    setupEventHandlers,
    handleCreateEventSlash,
    handleRepostSlash,
    setupEventReminders,
    isCreatingEvent
};
