const supabase = require('./supabase');

const BATCH_SIZE = 200;

async function fetchExistingDiscordIds(discordIds) {
    const existing = new Set();

    for (let i = 0; i < discordIds.length; i += BATCH_SIZE) {
        const chunk = discordIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
            .from('sticker')
            .select('pic_discord_id')
            .in('pic_discord_id', chunk);

        if (error) throw error;

        for (const row of data || []) {
            if (row.pic_discord_id != null) {
                existing.add(String(row.pic_discord_id));
            }
        }
    }

    return existing;
}

async function syncStickers(stickers) {
    if (stickers.length === 0) return { synced: 0, inserted: 0, updated: 0 };

    const discordIds = stickers.map(sticker => sticker.pic_discord_id);
    const existingIds = await fetchExistingDiscordIds(discordIds);

    const toInsert = [];
    const toUpdate = [];

    for (const sticker of stickers) {
        if (existingIds.has(String(sticker.pic_discord_id))) {
            toUpdate.push(sticker);
        } else {
            toInsert.push({
                pic_name: sticker.pic_name,
                pic_code: sticker.pic_code,
                pic_discord_id: sticker.pic_discord_id
            });
        }
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const { error } = await supabase
            .from('sticker')
            .insert(toInsert.slice(i, i + BATCH_SIZE));

        if (error) throw error;
    }

    for (const sticker of toUpdate) {
        const { error } = await supabase
            .from('sticker')
            .update({
                pic_name: sticker.pic_name,
                pic_code: sticker.pic_code
            })
            .eq('pic_discord_id', sticker.pic_discord_id);

        if (error) throw error;
    }

    return {
        synced: stickers.length,
        inserted: toInsert.length,
        updated: toUpdate.length
    };
}

module.exports = { syncStickers };
