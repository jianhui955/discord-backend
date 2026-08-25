const supabase = require('./supabase');

const BATCH_SIZE = 200;

async function fetchExistingDiscordIds(discordIds) {
    const existing = new Set();

    for (let i = 0; i < discordIds.length; i += BATCH_SIZE) {
        const chunk = discordIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
            .from('members')
            .select('discord_id')
            .in('discord_id', chunk);

        if (error) throw error;

        for (const row of data || []) {
            if (row.discord_id != null) {
                existing.add(String(row.discord_id));
            }
        }
    }

    return existing;
}

async function upsertMembers(members) {
    if (members.length === 0) return 0;

    const discordIds = members.map(member => member.discord_id);
    const existingIds = await fetchExistingDiscordIds(discordIds);

    const toInsert = [];
    const toUpdate = [];

    for (const member of members) {
        const roles = Array.isArray(member.roles)
            ? member.roles.map(String)
            : [];

        if (existingIds.has(String(member.discord_id))) {
            toUpdate.push({
                discord_id: member.discord_id,
                username: member.username,
                roles
            });
        } else {
            toInsert.push({
                discord_id: member.discord_id,
                username: member.username,
                status: 'active',
                roles
            });
        }
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const { error } = await supabase
            .from('members')
            .insert(toInsert.slice(i, i + BATCH_SIZE));

        if (error) throw error;
    }

    for (const member of toUpdate) {
        const { error } = await supabase
            .from('members')
            .update({
                username: member.username,
                status: 'active',
                roles: member.roles
            })
            .eq('discord_id', member.discord_id);

        if (error) throw error;
    }

    return members.length;
}

async function deactivateMembersNotIn(activeDiscordIds) {
    const keepSet = new Set(activeDiscordIds.map(String));

    const { data, error } = await supabase
        .from('members')
        .select('discord_id')
        .not('discord_id', 'is', null)
        .neq('status', 'inactive');

    if (error) throw error;

    const toDeactivate = (data || [])
        .map(row => String(row.discord_id))
        .filter(id => !keepSet.has(id));

    if (toDeactivate.length === 0) return 0;

    for (let i = 0; i < toDeactivate.length; i += BATCH_SIZE) {
        const { error: updateError } = await supabase
            .from('members')
            .update({ status: 'inactive' })
            .in('discord_id', toDeactivate.slice(i, i + BATCH_SIZE));

        if (updateError) throw updateError;
    }

    return toDeactivate.length;
}

async function syncMembers(members) {
    const synced = await upsertMembers(members);
    const removed = await deactivateMembersNotIn(members.map(member => member.discord_id));

    return { synced, removed };
}

module.exports = { syncMembers };
