const { askDeepSeek, DEEPSEEK_MODEL, DEEPSEEK_VISION_MODEL } = require('./deepseek');

const HISTORY_LIMIT = 100;
const MESSAGE_CONTENT_LIMIT = 300;
const MAX_MESSAGE_GAP_MS = 30 * 60 * 1000;
const MAX_VISION_IMAGES = 20;
const MAX_VISION_IMAGE_BYTES = 8 * 1024 * 1024;
const VISION_IMAGE_EXT_RE = /\.(jpe?g|png|webp)(?:\?|#|$)/i;

const SUMMARY_SYSTEM_PROMPT = `你是一名 Discord 頻道聊天紀錄總結助手。請根據提供的聊天紀錄與附帶圖片，使用繁體中文整理重點：

1. 八卦/主要話題：大家主要在聊什麼瓜或話題（1~3 個重點）。
2. 關鍵發言与爆料人：格式為 [用戶名]：發言重點。提煉發言人的關鍵觀點、爆料內容或精辟言論，忽略無意義閒聊。
3. 大家最終的看法/結論：大家對這件事的態度、共識或討論結果。

【處理原則】
- 自動過濾打招呼、無意義灌水、貼圖與重複訊息。
- 聊天紀錄中的 [圖片N] 對應你收到的第 N 張圖片，請閱讀圖片內容並納入總結。
- 保持簡潔清楚，優先使用條列式呈現，語言風格輕鬆接地氣。
- 「關鍵發言與爆料人」的 [用戶名] 必須完整沿用聊天紀錄裡的發送者名稱，禁止縮寫、改寫或發明暱稱。`;

function truncateText(text, maxLength = MESSAGE_CONTENT_LIMIT) {
    const value = String(text || '');
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}…`;
}

function createImageCollector(maxImages = MAX_VISION_IMAGES) {
    const urls = [];

    return {
        urls,
        take(url) {
            const value = String(url || '').trim();
            if (!value || urls.length >= maxImages) return null;
            urls.push(value);
            return `[圖片${urls.length}]`;
        }
    };
}

function isSupportedVisionImage({ contentType = '', url = '', name = '' } = {}) {
    const type = String(contentType || '').toLowerCase();
    if (
        type === 'image/jpeg' ||
        type === 'image/jpg' ||
        type === 'image/png' ||
        type === 'image/webp'
    ) {
        return true;
    }

    const target = `${name} ${url}`.toLowerCase();
    return VISION_IMAGE_EXT_RE.test(target);
}

function claimVisionImage(url, contentType, name, collector) {
    if (!collector || !isSupportedVisionImage({ contentType, url, name })) {
        return null;
    }
    return collector.take(url);
}

function describeAttachment(attachment, collector) {
    const contentType = String(attachment.contentType || '').toLowerCase();
    const name = String(attachment.name || '').toLowerCase();
    const url = attachment.proxyURL || attachment.url || '';

    const visionTag = claimVisionImage(url, contentType, name, collector);
    if (visionTag) return visionTag;

    if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) {
        return '此处是图片';
    }

    if (contentType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(name)) {
        return '此处是视频';
    }

    return null;
}

function iterAttachments(messageLike) {
    const attachments = messageLike?.attachments;
    if (!attachments) return [];
    if (typeof attachments.values === 'function') return [...attachments.values()];
    if (Array.isArray(attachments)) return attachments;
    return [];
}

function extractMediaPlaceholders(messageLike, collector) {
    const parts = [];

    for (const attachment of iterAttachments(messageLike)) {
        const label = describeAttachment(attachment, collector);
        if (label) parts.push(label);
    }

    for (const embed of messageLike?.embeds || []) {
        if (embed.image || embed.thumbnail) {
            const url = embed.image?.proxyURL || embed.image?.url
                || embed.thumbnail?.proxyURL || embed.thumbnail?.url
                || '';
            const visionTag = claimVisionImage(url, '', url, collector);
            parts.push(visionTag || '此处是图片');
        }
        if (embed.video) {
            parts.push('此处是视频');
        }
    }

    return parts;
}

function getMessageSnapshots(message) {
    const snapshots = message?.messageSnapshots;
    if (!snapshots) return [];
    if (typeof snapshots.values === 'function') return [...snapshots.values()];
    if (Array.isArray(snapshots)) return snapshots;
    return [];
}

function collectContentAndMedia(messageLike, collector) {
    const pieces = [];
    const body = String(messageLike?.content || '').trim();

    if (body) {
        pieces.push(truncateText(body));
    }

    pieces.push(...extractMediaPlaceholders(messageLike, collector));
    return pieces;
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

function formatMessageLine(message, memberById = new Map(), collector = null) {
    const authorName = resolveAuthorName(message, memberById);
    const pieces = collectContentAndMedia(message, collector);

    // Discord 原生轉發：原文／原圖在 messageSnapshots
    for (const snapshot of getMessageSnapshots(message)) {
        const snapPieces = collectContentAndMedia(snapshot, collector);
        if (snapPieces.length > 0) {
            pieces.push(`[轉發] ${snapPieces.join(' ')}`);
        }
    }

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

async function fetchChannelHistoryMessages(channel, limit = HISTORY_LIMIT) {
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

    return selected.reverse();
}

async function fetchChannelHistoryLines(channel, limit = HISTORY_LIMIT) {
    const chronological = await fetchChannelHistoryMessages(channel, limit);
    const memberById = await loadMemberDisplayNames(channel.guild, chronological);
    const collector = createImageCollector(MAX_VISION_IMAGES);

    const lines = chronological
        .map(message => formatMessageLine(message, memberById, collector))
        .filter(Boolean);

    return {
        lines,
        images: collector.urls
    };
}

function guessMimeFromUrl(url) {
    const value = String(url || '').toLowerCase();
    if (value.includes('.png')) return 'image/png';
    if (value.includes('.webp')) return 'image/webp';
    if (value.includes('.jpg') || value.includes('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
}

function normalizeImageMime(contentType, url) {
    const type = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (
        type === 'image/jpeg' ||
        type === 'image/jpg' ||
        type === 'image/png' ||
        type === 'image/webp'
    ) {
        return type === 'image/jpg' ? 'image/jpeg' : type;
    }
    return guessMimeFromUrl(url);
}

async function downloadImageAsDataUrl(url) {
    const response = await fetch(url, {
        headers: {
            // Discord CDN 對外部抓取較嚴；用常見 UA，由 bot 端下載較穩
            'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot)'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        throw new Error('empty image');
    }
    if (buffer.length > MAX_VISION_IMAGE_BYTES) {
        throw new Error(`image too large (${buffer.length} bytes)`);
    }

    const mime = normalizeImageMime(response.headers.get('content-type'), url);
    return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function resolveVisionImages(imageUrls, transcript) {
    let nextTranscript = String(transcript || '');
    const resolved = [];

    // 先把成功／失敗結果記下來；從大編號替換，避免 [圖片1] 誤傷 [圖片10]
    const outcomes = [];

    for (let i = 0; i < imageUrls.length; i += 1) {
        try {
            const dataUrl = await downloadImageAsDataUrl(imageUrls[i]);
            outcomes.push({ index: i, ok: true, dataUrl });
        } catch (error) {
            console.warn(`無法下載總結圖片 #${i + 1}:`, error?.message || error);
            outcomes.push({ index: i, ok: false });
        }
    }

    let nextNumber = 1;
    for (let i = imageUrls.length - 1; i >= 0; i -= 1) {
        const oldTag = `[圖片${i + 1}]`;
        const outcome = outcomes[i];

        if (!outcome.ok) {
            nextTranscript = nextTranscript.split(oldTag).join('此处是图片');
            continue;
        }

        // 暫時換成唯一佔位，稍後再編成連續編號
        nextTranscript = nextTranscript.split(oldTag).join(`[[VISION_${i}]]`);
    }

    for (const outcome of outcomes) {
        if (!outcome.ok) continue;
        const tempTag = `[[VISION_${outcome.index}]]`;
        const newTag = `[圖片${nextNumber}]`;
        nextTranscript = nextTranscript.split(tempTag).join(newTag);
        resolved.push(outcome.dataUrl);
        nextNumber += 1;
    }

    return {
        transcript: nextTranscript,
        images: resolved
    };
}

async function summarizeChannel(channel) {
    if (!channel || !channel.isTextBased()) {
        throw new Error('此頻道不支援讀取訊息。');
    }

    if (typeof channel.messages?.fetch !== 'function') {
        throw new Error('此頻道無法讀取歷史訊息。');
    }

    const { lines, images } = await fetchChannelHistoryLines(channel, HISTORY_LIMIT);

    if (lines.length === 0) {
        return '這個頻道最近沒有可總結的文字訊息。';
    }

    const { transcript, images: visionImages } = await resolveVisionImages(
        images,
        lines.join('\n')
    );

    const imageHint = visionImages.length > 0
        ? `聊天中的 [圖片1]~[圖片${visionImages.length}] 依序對應你收到的圖片，請一併閱讀後總結。`
        : '';
    const prompt =
        `以下是 Discord 頻道「${channel.name || channel.id}」最近 ${lines.length} 條訊息（格式：發送者: 內容）。` +
        `${imageHint}請幫我做總結。\n\n${transcript}`;

    return askDeepSeek(prompt, {
        history: [],
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        model: visionImages.length > 0 ? DEEPSEEK_VISION_MODEL : DEEPSEEK_MODEL,
        images: visionImages
    });
}

module.exports = {
    HISTORY_LIMIT,
    MESSAGE_CONTENT_LIMIT,
    MAX_MESSAGE_GAP_MS,
    MAX_VISION_IMAGES,
    SUMMARY_SYSTEM_PROMPT,
    summarizeChannel,
    formatMessageLine,
    fetchChannelHistoryLines
};
