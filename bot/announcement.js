const supabase = require('./supabase');
const {
    TIMEZONE,
    getMalaysiaTimeParts,
    normalizeTime
} = require('./event-remind');

const CHECK_INTERVAL_MS = 60 * 1000;

// 週一 = 1 … 週日 = 7（與 date JSON 例 [3,4] 對齊）
const WEEKDAY_MAP = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
};

function getMalaysiaWeekday(timezone = TIMEZONE) {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short'
    }).format(new Date());

    return WEEKDAY_MAP[weekday] || null;
}

function parseAnnouncementDays(dateValue) {
    let values = dateValue;

    if (typeof dateValue === 'string') {
        try {
            values = JSON.parse(dateValue);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(values)) return [];

    return [...new Set(
        values
            .map(v => Number(v))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
    )];
}

async function getActiveAnnouncements() {
    const { data, error } = await supabase
        .from('announcements')
        .select('id, content, date, time, status, channel_id')
        .eq('status', true);

    if (error) throw error;
    return data || [];
}

function isDueAnnouncement(row, weekday, time) {
    const days = parseAnnouncementDays(row.date);
    if (!days.includes(weekday)) return false;

    const rowTime = normalizeTime(row.time);
    if (!rowTime) return false;

    return rowTime === time;
}

function renderAnnouncementContent(content, memberRoleId) {
    const roleMention = memberRoleId ? `<@&${memberRoleId}>` : '';

    return String(content || '')
        .replaceAll('{{role_id}}', roleMention)
        .trim();
}

async function sendAnnouncement(client, row, memberRoleId) {
    const channelId = row.channel_id != null ? String(row.channel_id) : null;
    if (!channelId) {
        console.warn(`⚠️ 公告 #${row.id} 沒有 channel_id，跳過。`);
        return;
    }

    const content = renderAnnouncementContent(row.content, memberRoleId);
    if (!content) {
        console.warn(`⚠️ 公告 #${row.id} 內容為空，跳過。`);
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
        throw new Error(`找不到公告投放頻道 ${channelId}（公告 #${row.id}）`);
    }

    const payload = { content };
    if (memberRoleId && content.includes(`<@&${memberRoleId}>`)) {
        payload.allowedMentions = { roles: [String(memberRoleId)] };
    }

    await channel.send(payload);
}

async function checkDueAnnouncements(client, sentSlots, memberRoleId) {
    const weekday = getMalaysiaWeekday();
    if (!weekday) return;

    const { dateKey, time } = getMalaysiaTimeParts();
    const rows = await getActiveAnnouncements();

    for (const row of rows) {
        if (!isDueAnnouncement(row, weekday, time)) continue;

        const slotKey = `${row.id}-${dateKey}-${time}`;
        if (sentSlots.has(slotKey)) continue;

        sentSlots.add(slotKey);

        try {
            await sendAnnouncement(client, row, memberRoleId);
            console.log(`✅ 已發送公告 #${row.id} 到頻道 ${row.channel_id}（${slotKey}）`);
        } catch (error) {
            sentSlots.delete(slotKey);
            console.error(`❌ 發送公告 #${row.id} 失敗:`, error);
        }
    }

    // 只保留今天的去重 key，避免集合無限成長
    for (const key of sentSlots) {
        if (!key.includes(`-${dateKey}-`)) {
            sentSlots.delete(key);
        }
    }
}

function setupAnnouncementReminders(client, memberRoleId) {
    const sentSlots = new Set();

    const runCheck = () => {
        checkDueAnnouncements(client, sentSlots, memberRoleId).catch(error => {
            console.error('📢 公告提醒檢查失敗:', error);
        });
    };

    runCheck();
    const checkTimer = setInterval(runCheck, CHECK_INTERVAL_MS);

    console.log(`📢 公告提醒排程已啟用 (${TIMEZONE})`);

    return () => {
        clearInterval(checkTimer);
    };
}

module.exports = {
    setupAnnouncementReminders,
    checkDueAnnouncements,
    getActiveAnnouncements,
    parseAnnouncementDays,
    getMalaysiaWeekday,
    isDueAnnouncement,
    renderAnnouncementContent
};
