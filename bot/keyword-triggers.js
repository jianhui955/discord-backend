const OpenCC = require('opencc-js');
const supabase = require('./supabase');
const { askDeepSeek } = require('./deepseek');

const CACHE_TTL_MS = 60_000;
const RETRY_DELAY_MS = 2000;
const MIN_NICKNAME_LENGTH = 2;

const twToCn = OpenCC.Converter({ from: 'tw', to: 'cn' });
const hkToCn = OpenCC.Converter({ from: 'hk', to: 'cn' });

let cache = {
    fetchedAt: 0,
    rows: []
};

let membersNicknameCache = {
    fetchedAt: 0,
    entries: [] // { discordId, nicknames, introduce }
};

// 串行处理 DeepSeek 回复，避免连发时并行打爆 API
let replyQueue = Promise.resolve();

function enqueueReply(task) {
    const run = replyQueue.then(task, task);
    replyQueue = run.catch(() => {});
    return run;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toSimplified(text) {
    return hkToCn(twToCn(String(text || '')));
}

function normalizeForMatch(text) {
    return toSimplified(text).toLowerCase();
}

function normalizeChannelIds(channelIds) {
    if (Array.isArray(channelIds)) {
        return channelIds.map(id => String(id));
    }

    if (typeof channelIds === 'string') {
        try {
            const parsed = JSON.parse(channelIds);
            if (Array.isArray(parsed)) {
                return parsed.map(id => String(id));
            }
        } catch {
            return [];
        }
    }

    return [];
}

function normalizeNicknameList(nickname) {
    let values = nickname;

    if (typeof nickname === 'string') {
        const trimmed = nickname.trim();
        if (!trimmed) return [];

        try {
            values = JSON.parse(trimmed);
        } catch {
            // 容错：不是 JSON 时当单一昵称
            values = [trimmed];
        }
    }

    if (!Array.isArray(values)) return [];

    return [...new Set(
        values
            .map(v => String(v || '').trim())
            .filter(v => v.length >= MIN_NICKNAME_LENGTH)
    )];
}

function normalizePercentage(percentage) {
    const rate = Number(percentage);

    if (!Number.isFinite(rate)) return 100;
    if (rate <= 0) return 0;
    if (rate >= 100) return 100;
    return rate;
}

function shouldTriggerByPercentage(percentage) {
    const rate = normalizePercentage(percentage);
    if (rate <= 0) return false;
    if (rate >= 100) return true;
    return Math.random() * 100 < rate;
}

function contentIncludesKeyword(content, keyword) {
    const text = normalizeForMatch(content);
    const key = normalizeForMatch(String(keyword || '').trim());

    if (!text || !key) return false;

    return text.includes(key);
}

async function fetchActiveTriggers() {
    const now = Date.now();

    if (now - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.rows;
    }

    const { data, error } = await supabase
        .from('keyword_triggers')
        .select('id, keyword, channel_ids, personality, status, percentage')
        .eq('status', 1);

    if (error) throw error;

    cache = {
        fetchedAt: now,
        rows: (data || []).map(row => ({
            ...row,
            channel_ids: normalizeChannelIds(row.channel_ids),
            percentage: normalizePercentage(row.percentage)
        }))
    };

    return cache.rows;
}

async function fetchMembersNicknameIndex() {
    const now = Date.now();

    if (now - membersNicknameCache.fetchedAt < CACHE_TTL_MS) {
        return membersNicknameCache.entries;
    }

    const { data, error } = await supabase
        .from('members')
        .select('discord_id, nickname, introduce')
        .not('nickname', 'is', null);

    if (error) throw error;

    const entries = [];

    for (const row of data || []) {
        const nicknames = normalizeNicknameList(row.nickname);
        if (nicknames.length === 0) continue;

        entries.push({
            discordId: row.discord_id != null ? String(row.discord_id) : null,
            nicknames,
            introduce: String(row.introduce || '').trim()
        });
    }

    membersNicknameCache = {
        fetchedAt: now,
        entries
    };

    return entries;
}

function findMatchingTrigger(channelId, content) {
    const channelKey = String(channelId);
    const matches = [];

    for (const row of cache.rows) {
        if (!row.channel_ids.includes(channelKey)) continue;
        if (!contentIncludesKeyword(content, row.keyword)) continue;
        matches.push(row);
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => String(b.keyword).length - String(a.keyword).length);
    return matches[0];
}

/**
 * 在 content 里找出被提到的成员小名（可多人）。
 * 同一成员只返回一次；优先匹配较长小名，减少短名误伤。
 */
function findMentionedMembersByNickname(content, entries, { excludeDiscordId = null } = {}) {
    const normalizedContent = normalizeForMatch(content);
    if (!normalizedContent) return [];

    const candidates = [];

    for (const entry of entries) {
        for (const nickname of entry.nicknames) {
            candidates.push({
                discordId: entry.discordId,
                nickname,
                introduce: entry.introduce,
                normalizedNickname: normalizeForMatch(nickname)
            });
        }
    }

    candidates.sort((a, b) => b.normalizedNickname.length - a.normalizedNickname.length);

    const usedRanges = [];
    const mentionedById = new Map();

    for (const candidate of candidates) {
        if (!candidate.normalizedNickname) continue;
        if (excludeDiscordId && candidate.discordId === String(excludeDiscordId)) continue;

        let searchFrom = 0;
        while (searchFrom < normalizedContent.length) {
            const index = normalizedContent.indexOf(candidate.normalizedNickname, searchFrom);
            if (index === -1) break;

            const end = index + candidate.normalizedNickname.length;
            const overlaps = usedRanges.some(range => index < range.end && end > range.start);

            if (!overlaps) {
                usedRanges.push({ start: index, end });

                const key = candidate.discordId || `nick:${candidate.nickname}`;
                if (!mentionedById.has(key)) {
                    mentionedById.set(key, {
                        discordId: candidate.discordId,
                        matchedNicknames: [candidate.nickname],
                        introduce: candidate.introduce
                    });
                } else {
                    const existing = mentionedById.get(key);
                    if (!existing.matchedNicknames.includes(candidate.nickname)) {
                        existing.matchedNicknames.push(candidate.nickname);
                    }
                    if (!existing.introduce && candidate.introduce) {
                        existing.introduce = candidate.introduce;
                    }
                }

                break;
            }

            searchFrom = index + 1;
        }
    }

    return [...mentionedById.values()].filter(item => item.introduce);
}

async function getMemberIntroduce(discordId) {
    if (!discordId) return null;

    const { data, error } = await supabase
        .from('members')
        .select('introduce')
        .eq('discord_id', String(discordId))
        .maybeSingle();

    if (error) throw error;

    const introduce = String(data?.introduce || '').trim();
    return introduce || null;
}

function buildSystemPrompt(personality, { speakerIntroduce = null, mentionedPeople = [] } = {}) {
    const parts = [
        '【主规则】回复必须以 personality 为人设与语气标准，不可偏离。',
        String(personality || '').trim(),
        '请用简短的 Discord 聊天语气回复，控制在 1-3 句话，不要使用标题或列表。'
    ];

    if (speakerIntroduce) {
        parts.push(
            '【发言者背景｜辅助】以下是发言用户自己的介绍。',
            '若能自然融入回复就轻微结合；无关或硬加会很突兀，就完全不要提。',
            String(speakerIntroduce).trim()
        );
    }

    if (mentionedPeople.length > 0) {
        parts.push(
            '【消息中提到的人｜背景说明】以下小名出现在用户这句话里。',
            '这些资料只是帮你理解「某某是谁」，回复时若话题相关可自然用到；',
            '不要生硬科普、不要把背景整段复述出来，也不要为了用资料而硬扯。'
        );

        for (const person of mentionedPeople) {
            const nickLabel = (person.matchedNicknames || []).join('/');
            parts.push(`- 小名「${nickLabel}」：${String(person.introduce).trim()}`);
        }
    }

    return parts.filter(Boolean).join('\n');
}

async function askDeepSeekWithRetry(content, systemPrompt) {
    try {
        return await askDeepSeek(content, {
            history: [],
            systemPrompt
        });
    } catch (error) {
        const message = String(error?.message || error);
        const shouldRetry = message.includes('429') || /rate|Too Many|限流|配额/i.test(message);

        if (!shouldRetry) throw error;

        await sleep(RETRY_DELAY_MS);
        return askDeepSeek(content, {
            history: [],
            systemPrompt
        });
    }
}

async function handleKeywordTrigger(message) {
    const content = String(message.content || '').trim();
    if (!content) return false;

    await fetchActiveTriggers();

    const trigger = findMatchingTrigger(message.channel.id, content);
    if (!trigger) return false;

    // 概率未中：静默跳过（不是冷却）
    if (!shouldTriggerByPercentage(trigger.percentage)) {
        return true;
    }

    let speakerIntroduce = null;
    let mentionedPeople = [];

    try {
        speakerIntroduce = await getMemberIntroduce(message.author.id);
    } catch (error) {
        console.error('keyword member introduce lookup error:', error?.message || error, error);
    }

    try {
        const nicknameEntries = await fetchMembersNicknameIndex();
        mentionedPeople = findMentionedMembersByNickname(content, nicknameEntries, {
            excludeDiscordId: message.author.id
        });
    } catch (error) {
        console.error('keyword nickname mention lookup error:', error?.message || error, error);
    }

    const systemPrompt = buildSystemPrompt(trigger.personality, {
        speakerIntroduce,
        mentionedPeople
    });

    await enqueueReply(async () => {
        try {
            const answer = await askDeepSeekWithRetry(content, systemPrompt);
            const body = answer.length > 1900 ? `${answer.slice(0, 1899)}…` : answer;
            // await message.reply({
            //     content: body,
            //     allowedMentions: { repliedUser: true }
            // });
            await message.channel.send({
                content: body
            });
        } catch (error) {
            console.error('keyword DeepSeek error:', error?.message || error, error);
            await message.react('⚠️').catch(() => {});
        }
    });

    return true;
}

module.exports = {
    handleKeywordTrigger,
    fetchActiveTriggers,
    findMatchingTrigger,
    getMemberIntroduce,
    buildSystemPrompt,
    normalizeNicknameList,
    findMentionedMembersByNickname,
    fetchMembersNicknameIndex
};
