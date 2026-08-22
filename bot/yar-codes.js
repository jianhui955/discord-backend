const YAR_CODES_URL = 'https://codes.yar.gg/api/codes';
const RECENT_DAYS = 3;

function isWithinRecentDays(addedAt, days = RECENT_DAYS) {
    const addedTime = new Date(addedAt).getTime();
    if (Number.isNaN(addedTime)) return false;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return addedTime >= cutoff;
}

async function fetchYarCodes() {
    const response = await fetch(YAR_CODES_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; yanyun-code-bot/1.0)',
            Accept: 'application/json'
        },
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(`抓取失败：HTTP ${response.status}`);
    }

    const data = await response.json();
    const active = Array.isArray(data?.active) ? data.active : [];

    if (active.length === 0) {
        throw new Error('API 没有返回 active 兑换码');
    }

    const codes = active
        .filter(entry => isWithinRecentDays(entry?.addedAt))
        .map(entry => String(entry?.code || '').trim().toUpperCase())
        .filter(Boolean);

    return [...new Set(codes)];
}

module.exports = { fetchYarCodes, YAR_CODES_URL };
