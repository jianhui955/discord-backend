const { askDeepSeek } = require('./deepseek');

const HISTORY_LIMIT = 200;
const MESSAGE_CONTENT_LIMIT = 300;
const MAX_MESSAGE_GAP_MS = 30 * 60 * 1000;

const SUMMARY_SYSTEM_PROMPT = `你是一名 Discord 頻道聊天紀錄總結助手。請根據提供的聊天紀錄，使用繁體中文整理重點：

1. 八卦/主要話題：大家主要在聊什麼瓜或話題（1~3 個重點）。
2. 關鍵發言与爆料人：格式為 [用戶名]：發言重點。提煉發言人的關鍵觀點、爆料內容或精辟言論，忽略無意義閒聊。
3. 大家最終的看法/結論：大家對這件事的態度、共識或討論結果。

【處理原則】
- 自動過濾打招呼、無意義灌水、貼圖與重複訊息。
- 保持簡潔清楚，優先使用條列式呈現，語言風格輕鬆接地氣。
- 「關鍵發言與爆料人」的 [用戶名] 必須完整沿用聊天紀錄裡的發送者名稱，禁止縮寫、改寫或發明暱稱。`;

function truncateText(text, maxLength = MESSAGE_CONTENT_LIMIT) {
    const value = String(text || '');
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}…`;
}

function describeAttachment(attachment) {
    const contentType = String(attachment.contentType || '').toLowerCase();
    const name = String(attachment.name || '').toLowerCase();

    if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) {
        return '此处是图片';
    }

    if (contentType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(name)) {
        return '此处是视频';
    }

    return null;
}

function extractMediaPlaceholders(message) {
    const parts = [];

    for (const attachment of message.attachments.values()) {
        const label = describeAttachment(attachment);
        if (label) parts.push(label);
    }

    for (const embed of message.embeds || []) {
        if (embed.image || embed.thumbnail) {
            parts.push('此处是图片');
        }
        if (embed.video) {
            parts.push('此处是视频');
        }
    }

    return parts;
}

function resolveAuthorName(message, memberById = new Map()) {
    const userId = message.author?.id ? String(message.author.id) : null;
    const member = message.member || (userId ? memberById.get(userId) : null);

    return (
        member?.displayName ||
        message.author?.globalName ||
        message.author?.username ||
        '未知使用者'
    );
}

function formatMessageLine(message, memberById = new Map()) {
    const authorName = resolveAuthorName(message, memberById);

    const mediaParts = extractMediaPlaceholders(message);
    let body = String(message.content || '').trim();

    if (body) {
        body = truncateText(body);
    }

    const pieces = [];
    if (body) pieces.push(body);
    if (mediaParts.length > 0) pieces.push(...mediaParts);

    if (pieces.length === 0) {
        return null;
    }

    return `${authorName}: ${pieces.join(' ')}`;
}

async function loadMemberDisplayNames(guild, messages) {
    const memberById = new Map();
    if (!guild) return memberById;

    const missingIds = [];

    for (const message of messages) {
        const userId = message.author?.id ? String(message.author.id) : null;
        if (!userId || memberById.has(userId)) continue;

        if (message.member) {
            memberById.set(userId, message.member);
            continue;
        }

        const cached = guild.members.cache.get(userId);
        if (cached) {
            memberById.set(userId, cached);
            continue;
        }

        missingIds.push(userId);
    }

    if (missingIds.length > 0) {
        try {
            const fetched = await guild.members.fetch({ user: missingIds });
            for (const member of fetched.values()) {
                memberById.set(String(member.id), member);
            }
        } catch (error) {
            // 批次失敗時逐個補；失敗就退回 username/globalName
            for (const userId of missingIds) {
                if (memberById.has(userId)) continue;
                try {
                    const member = await guild.members.fetch(userId);
                    memberById.set(userId, member);
                } catch {
                    // ignore
                }
            }
        }
    }

    return memberById;
}

async function fetchChannelHistoryLines(channel, limit = HISTORY_LIMIT) {
    const DISCORD_FETCH_MAX = 100;
    const selected = [];
    let before = undefined;
    let hitGap = false;

    // Discord 單次最多 100；若 HISTORY_LIMIT > 100 需分批往回抓
    while (selected.length < limit && !hitGap) {
        const batchSize = Math.min(DISCORD_FETCH_MAX, limit - selected.length);
        const options = { limit: batchSize };
        if (before) options.before = before;

        const fetched = await channel.messages.fetch(options);
        const batch = [...fetched.values()]; // 新 → 舊

        if (batch.length === 0) break;

        for (const message of batch) {
            if (selected.length === 0) {
                selected.push(message);
                continue;
            }

            if (selected.length >= limit) break;

            const newer = selected[selected.length - 1];
            const gapMs = newer.createdTimestamp - message.createdTimestamp;

            if (gapMs > MAX_MESSAGE_GAP_MS) {
                hitGap = true;
                break;
            }

            selected.push(message);
        }

        if (hitGap || batch.length < batchSize || selected.length >= limit) {
            break;
        }

        before = batch[batch.length - 1].id;
    }

    const chronological = selected.reverse();
    const memberById = await loadMemberDisplayNames(channel.guild, chronological);

    return chronological
        .map(message => formatMessageLine(message, memberById))
        .filter(Boolean);
}

async function summarizeChannel(channel) {
    if (!channel || !channel.isTextBased()) {
        throw new Error('此頻道不支援讀取訊息。');
    }

    if (typeof channel.messages?.fetch !== 'function') {
        throw new Error('此頻道無法讀取歷史訊息。');
    }

    const lines = await fetchChannelHistoryLines(channel, HISTORY_LIMIT);

    if (lines.length === 0) {
        return '這個頻道最近沒有可總結的文字訊息。';
    }

    const transcript = lines.join('\n');
    const prompt =
        `以下是 Discord 頻道「${channel.name || channel.id}」最近 ${lines.length} 條訊息（格式：發送者: 內容）。` +
        `請幫我做總結。\n\n${transcript}`;

    return askDeepSeek(prompt, {
        history: [],
        systemPrompt: SUMMARY_SYSTEM_PROMPT
    });
}

module.exports = {
    HISTORY_LIMIT,
    MESSAGE_CONTENT_LIMIT,
    MAX_MESSAGE_GAP_MS,
    SUMMARY_SYSTEM_PROMPT,
    summarizeChannel,
    formatMessageLine,
    fetchChannelHistoryLines
};
