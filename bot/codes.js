const supabase = require('./supabase');

async function findCode(code) {
    const { data, error } = await supabase
        .from('codes')
        .select('id, code, status, created_at')
        .eq('code', code.toUpperCase())
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function findExistingCodes(codes) {
    if (codes.length === 0) return [];

    const { data, error } = await supabase
        .from('codes')
        .select('code')
        .in('code', codes.map(code => code.toUpperCase()));

    if (error) throw error;
    return (data || []).map(row => row.code.toUpperCase());
}

async function insertCodes(codes) {
    if (codes.length === 0) return;

    const { error } = await supabase
        .from('codes')
        .insert(
            codes.map(code => ({
                code: code.toUpperCase(),
                status: 'new'
            }))
        );

    if (error) throw error;
}

async function deleteCode(code) {
    const { data, error } = await supabase
        .from('codes')
        .delete()
        .eq('code', code.toUpperCase())
        .select('code')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function listAllCodes() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data, error } = await supabase
        .from('codes')
        .select('code, status, created_at')
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) throw error;
    return data || [];
}

module.exports = {
    findCode,
    findExistingCodes,
    insertCodes,
    deleteCode,
    listAllCodes
};
