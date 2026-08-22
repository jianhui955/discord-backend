const supabase = require('./supabase');
const { SYSTEM_PERSONA } = require('./deepseek');

const DEFAULT_MAX_HISTORY = 40;

async function getConversationConfig(channelId) {
    const { data, error } = await supabase
        .from('conversations')
        .select('system_prompt, max_history')
        .eq('channel_id', String(channelId))
        .maybeSingle();

    if (error) throw error;

    const systemPrompt = data?.system_prompt?.trim() || SYSTEM_PERSONA;
    const maxHistory = Number.isFinite(data?.max_history) && data.max_history > 0
        ? data.max_history
        : DEFAULT_MAX_HISTORY;

    return { systemPrompt, maxHistory };
}

module.exports = {
    DEFAULT_MAX_HISTORY,
    getConversationConfig
};
