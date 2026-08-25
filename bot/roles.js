const supabase = require('./supabase');

const BATCH_SIZE = 200;

function toRoleRow(role) {
    const permissions = role.permissions?.bitfield;
    const iconHash = role.icon || null;

    return {
        id: String(role.id),
        guild_id: String(role.guild.id),
        name: String(role.name || '').slice(0, 100),
        color: Number.isFinite(role.color) ? role.color : 0,
        position: Number.isFinite(role.position) ? role.position : 0,
        permissions: permissions == null ? '0' : String(permissions),
        hoist: Boolean(role.hoist),
        managed: Boolean(role.managed),
        mentionable: Boolean(role.mentionable),
        icon: iconHash,
        unicode_emoji: role.unicodeEmoji || null,
        updated_at: new Date().toISOString()
    };
}

async function deleteMissingRoles(guildId, keepIds) {
    const keepSet = new Set(keepIds.map(String));

    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('guild_id', guildId);

    if (error) throw error;

    const toDelete = (data || [])
        .map(row => String(row.id))
        .filter(id => !keepSet.has(id));

    if (toDelete.length === 0) return 0;

    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const { error: deleteError } = await supabase
            .from('roles')
            .delete()
            .eq('guild_id', guildId)
            .in('id', toDelete.slice(i, i + BATCH_SIZE));

        if (deleteError) throw deleteError;
    }

    return toDelete.length;
}

async function syncRoles(roles) {
    if (roles.length === 0) {
        return { synced: 0, upserted: 0, removed: 0 };
    }

    const rows = roles.map(toRoleRow);
    const guildId = rows[0].guild_id;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const { error } = await supabase
            .from('roles')
            .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: 'id' });

        if (error) throw error;
    }

    const removed = await deleteMissingRoles(guildId, rows.map(row => row.id));

    return {
        synced: rows.length,
        upserted: rows.length,
        removed
    };
}

module.exports = { syncRoles, toRoleRow };
