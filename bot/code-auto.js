const { fetchYarCodes } = require('./yar-codes');
const { findExistingCodes, insertCodes } = require('./codes');
const { setupEventRemindSchedule } = require('./event-remind');

const CODES_EVENT_CODE = 'CODES';

// 特別處理：自動抓取有新碼時，順便也發到另一個 Discord server 的頻道
const EXTRA_CODE_GUILD_ID = '1530782498819412199';
const EXTRA_CODE_CHANNEL_ID = '1530801631707402432';

function splitMessage(text, maxLength = 1900) {
    const chunks = [];
    let current = '';

    for (const line of text.split('\n')) {
        if ((current + line + '\n').length > maxLength) {
            chunks.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

async function runCodeAuto() {
    const scrapedCodes = await fetchYarCodes();
    if (scrapedCodes.length === 0) {
        return { newCodes: [] };
    }

    const existingCodes = await findExistingCodes(scrapedCodes);
    const existingSet = new Set(existingCodes);
    const newCodes = scrapedCodes.filter(code => !existingSet.has(code));

    if (newCodes.length === 0) {
        return { newCodes: [] };
    }

    await insertCodes(newCodes);

    return { newCodes };
}

async function sendCodeAutoResult(channel, newCodes) {
    if (!newCodes.length) return;

    const reply =
        `✅ **新兌換碼 (${newCodes.length})**\n` +
        newCodes.join('\n');

    for (const chunk of splitMessage(reply)) {
        await channel.send({ content: chunk });
    }
}

async function sendCodeAutoExtra(client, newCodes) {
    if (!newCodes.length) return;

    const guild = await client.guilds.fetch(EXTRA_CODE_GUILD_ID).catch(() => null);
    if (!guild) {
        console.warn(`⚠️ 特別投放伺服器找不到：${EXTRA_CODE_GUILD_ID}`);
        return;
    }

    const channel = await guild.channels.fetch(EXTRA_CODE_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) {
        console.warn(`⚠️ 特別投放頻道找不到：${EXTRA_CODE_CHANNEL_ID}`);
        return;
    }

    const reply =
        `✅ **新兌換碼 (${newCodes.length})**\n` +
        newCodes.join('\n');

    for (const chunk of splitMessage(reply)) {
        await channel.send({ content: chunk });
    }
}

function setupCodeAutoSchedule(client) {
    return setupEventRemindSchedule(client, {
        eventCode: CODES_EVENT_CODE,
        logLabel: '🧾 兌換碼自動抓取',
        onSlot: async (discordClient, channelId, slotKey) => {
            const { newCodes } = await runCodeAuto();

            if (newCodes.length === 0) {
                console.log(`🧾 兌換碼自動抓取 ${slotKey}：沒有新兌換碼`);
                return;
            }

            const channel = await discordClient.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                throw new Error(`找不到兌換碼投放頻道 ${channelId}`);
            }

            await sendCodeAutoResult(channel, newCodes);

            // 原本投放保留；另外順便發到特別頻道
            await sendCodeAutoExtra(discordClient, newCodes).catch(err => {
                console.error('⚠️ 特別投放兌換碼失敗:', err.message || err);
            });

            console.log(`✅ 兌換碼自動抓取 ${slotKey}：新增 ${newCodes.length} 個兌換碼`);
        }
    });
}

module.exports = {
    setupCodeAutoSchedule,
    runCodeAuto,
    sendCodeAutoResult
};
