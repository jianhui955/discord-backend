const supabase = require('./supabase');

const TIMEZONE = 'Asia/Kuala_Lumpur';
const CHECK_INTERVAL_MS = 30 * 1000;

function getMalaysiaTimeParts(timezone = TIMEZONE) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());

    const get = (type) => parts.find(part => part.type === type).value;

    return {
        dateKey: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${String(Number(get('hour')) % 24).padStart(2, '0')}:${get('minute')}`
    };
}

function normalizeTime(time) {
    const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseRemindTimes(remindTime) {
    if (remindTime == null) return [];

    let values = remindTime;

    if (typeof remindTime === 'string') {
        try {
            values = JSON.parse(remindTime);
        } catch {
            values = [remindTime];
        }
    }

    if (!Array.isArray(values)) return [];

    return [...new Set(
        values.map(normalizeTime).filter(Boolean)
    )];
}

async function getEventRemindConfig(eventCode) {
    const { data, error } = await supabase
        .from('event_remind')
        .select('remind, channel_id, remind_time')
        .eq('event_code', eventCode)
        .maybeSingle();

    if (error) throw error;
    return data;
}

function setupEventRemindSchedule(client, { eventCode, logLabel, onSlot }) {
    let checkTimer = null;
    let lastRunSlot = null;

    async function check() {
        const config = await getEventRemindConfig(eventCode);
        if (!config?.remind) return;

        const channelId = config.channel_id != null ? String(config.channel_id) : null;
        if (!channelId) {
            console.log(`${logLabel} 已啟用，但 channel_id 為空，跳過。`);
            return;
        }

        const scheduleTimes = parseRemindTimes(config.remind_time);
        if (scheduleTimes.length === 0) return;

        const { dateKey, time } = getMalaysiaTimeParts();
        if (!scheduleTimes.includes(time)) return;

        const slotKey = `${dateKey} ${time}`;
        if (lastRunSlot === slotKey) return;

        lastRunSlot = slotKey;

        try {
            await onSlot(client, channelId, slotKey, config);
        } catch (error) {
            console.error(`${logLabel} ${slotKey} 失敗:`, error);
        }
    }

    const runCheck = () => {
        check().catch(error => {
            console.error(`${logLabel} 排程檢查失敗:`, error);
        });
    };

    runCheck();
    checkTimer = setInterval(runCheck, CHECK_INTERVAL_MS);

    getEventRemindConfig(eventCode).then(config => {
        const times = parseRemindTimes(config?.remind_time);
        console.log(
            `${logLabel} 排程已啟用：${times.length > 0 ? times.join(', ') : '（未設定 remind_time）'} (${TIMEZONE})`
        );
    }).catch(error => {
        console.error(`${logLabel} 讀取排程設定失敗:`, error);
    });

    return () => {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    };
}

module.exports = {
    TIMEZONE,
    getMalaysiaTimeParts,
    normalizeTime,
    parseRemindTimes,
    getEventRemindConfig,
    setupEventRemindSchedule
};
