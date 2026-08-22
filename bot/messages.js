const supabase = require('./supabase');

async function insertMessage({ channelId, userId, role, content }) {
    const { error } = await supabase
        .from('messages')
        .insert({
            channel_id: String(channelId),
            user_id: String(userId),
            role,
            content
        });

    if (error) throw error;
}

async function getConversationHistory(channelId, maxHistory) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('channel_id', String(channelId))
        .in('role', ['user', 'assistant'])
        .gte('created_at', oneHourAgo)
        .order('id', { ascending: false })
        .limit(maxHistory);

    if (error) throw error;

    return (data || []).reverse();
}

async function saveConversationTurn({ channelId, userId, question, answer }) {
    await insertMessage({
        channelId,
        userId,
        role: 'user',
        content: question
    });

    await insertMessage({
        channelId,
        userId,
        role: 'assistant',
        content: answer
    });
}

module.exports = {
    insertMessage,
    getConversationHistory,
    saveConversationTurn
};
