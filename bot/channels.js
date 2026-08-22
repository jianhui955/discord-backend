const supabase = require('./supabase');

const BATCH_SIZE = 200;

async function fetchExistingChannelIds(channelIds) {
    const existing = new Set();

    for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
        const chunk = channelIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
            .from('channel')
            .select('channel_id')
            .in('channel_id', chunk);

        if (error) throw error;

        for (const row of data || []) {
            if (row.channel_id != null) {
                existing.add(String(row.channel_id));
            }
        }
    }

    return existing;
}

async function syncChannels(channels) {
    if (channels.length === 0) return { synced: 0, inserted: 0, updated: 0 };

    const channelIds = channels.map(channel => channel.channel_id);
    const existingIds = await fetchExistingChannelIds(channelIds);

    const toInsert = [];
    const toUpdate = [];

    for (const channel of channels) {
        if (existingIds.has(String(channel.channel_id))) {
            toUpdate.push(channel);
        } else {
            toInsert.push({
                channel_name: channel.channel_name,
                channel_id: channel.channel_id,
                type: channel.type
            });
        }
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const { error } = await supabase
            .from('channel')
            .insert(toInsert.slice(i, i + BATCH_SIZE));

        if (error) throw error;
    }

    for (const channel of toUpdate) {
        const { error } = await supabase
            .from('channel')
            .update({
                channel_name: channel.channel_name,
                type: channel.type
            })
            .eq('channel_id', channel.channel_id);

        if (error) throw error;
    }

    return {
        synced: channels.length,
        inserted: toInsert.length,
        updated: toUpdate.length
    };
}

module.exports = { syncChannels };
