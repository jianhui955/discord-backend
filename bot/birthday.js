const supabase = require('./supabase');
const { setupEventRemindSchedule, getMalaysiaTimeParts } = require('./event-remind');

const BIRTHDAY_EVENT_CODE = 'BIRTHDAY';

function getMonthDayFromDob(dob) {
    if (!dob) return null;

    const match = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    return `${match[2]}-${match[3]}`;
}

function formatDob(dob) {
    const match = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';

    const month = Number(match[2]);
    const day = Number(match[3]);

    return `${month}月${day}日`;
}

function renderTemplate(content, member) {
    const mention = member.discord_id ? `<@${member.discord_id}>` : (member.username || '成員');

    return content
        .replaceAll('{{username}}', mention)
        .replaceAll('{{dob}}', formatDob(member.dob))
        .replaceAll('{{discord_id}}', member.discord_id || '');
}

async function getBirthdayMembersToday() {
    const todayMonthDay = getMalaysiaTimeParts().dateKey.slice(5);

    const { data, error } = await supabase
        .from('members')
        .select('username, discord_id, dob')
        .not('dob', 'is', null);

    if (error) throw error;

    return (data || []).filter(member => getMonthDayFromDob(member.dob) === todayMonthDay);
}

async function getActiveBirthdayTemplates() {
    const { data, error } = await supabase
        .from('birthday_reminder_templates')
        .select('id, content')
        .eq('status', true)
        .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
}

function pickRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
}

async function sendBirthdayReminders(client, channelId) {
    const birthdayMembers = await getBirthdayMembersToday();
    if (birthdayMembers.length === 0) return;

    const templates = await getActiveBirthdayTemplates();
    if (templates.length === 0) {
        console.warn('生日提醒已啟用，但沒有 status = true 的模板。');
        return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
        throw new Error(`找不到生日提醒頻道 ${channelId}`);
    }

    const mentionUserIds = birthdayMembers
        .map(member => member.discord_id)
        .filter(Boolean)
        .map(String);

    for (const member of birthdayMembers) {
        const template = pickRandomTemplate(templates);
        const content = renderTemplate(template.content, member);

        await channel.send({
            content,
            allowedMentions: { users: mentionUserIds }
        });
    }

    console.log(`✅ 已發送 ${birthdayMembers.length} 位成員的生日提醒到頻道 ${channelId}`);
}

function setupBirthdayReminders(client) {
    return setupEventRemindSchedule(client, {
        eventCode: BIRTHDAY_EVENT_CODE,
        logLabel: '🎂 生日提醒',
        onSlot: async (discordClient, channelId, slotKey) => {
            await sendBirthdayReminders(discordClient, channelId);
            console.log(`🎂 生日提醒 ${slotKey} 檢查完成`);
        }
    });
}

module.exports = {
    setupBirthdayReminders,
    sendBirthdayReminders,
    getBirthdayMembersToday,
    renderTemplate,
    formatDob,
    pickRandomTemplate
};
