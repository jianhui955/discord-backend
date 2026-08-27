const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PERSONA =
    '你是一个幽默、毒舌且极其简短的 Discord 助手。我们玩的游戏是「燕云十六声」。请用 1-2 句话以调侃的语气回答用户，但必须包含事实本质。回答时优先结合燕云十六声相关背景，但非游戏问题也可正常回答。如果用户提出了与前文无关的新问题，请直接回答新问题，不要强制链接之前的角色或主题。';

function getDeepSeekApiKey() {
    return process.env.DEEPSEEK_API_KEY || '';
}

function buildUserContent(question, images = []) {
    const imageUrls = (Array.isArray(images) ? images : [])
        .map(url => String(url || '').trim())
        .filter(Boolean);

    if (imageUrls.length === 0) {
        return question;
    }

    return [
        { type: 'text', text: question },
        ...imageUrls.map(url => ({
            type: 'image_url',
            image_url: { url }
        }))
    ];
}

function toDeepSeekMessages(
    question,
    history = [],
    systemPrompt = SYSTEM_PERSONA,
    images = []
) {
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    for (const row of history) {
        if (row.role !== 'user' && row.role !== 'assistant') continue;
        messages.push({
            role: row.role,
            content: row.content
        });
    }

    messages.push({
        role: 'user',
        content: buildUserContent(question, images)
    });

    return messages;
}

async function askDeepSeek(
    question,
    {
        history = [],
        systemPrompt = SYSTEM_PERSONA,
        model = DEEPSEEK_MODEL,
        images = []
    } = {}
) {
    const prompt = String(question || '').trim();

    if (!prompt) {
        throw new Error('問題不能為空。');
    }

    const apiKey = getDeepSeekApiKey();

    if (!apiKey) {
        throw new Error('缺少 DEEPSEEK_API_KEY，請在 .env 中配置 DeepSeek API Key。');
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: toDeepSeekMessages(prompt, history, systemPrompt, images),
            stream: false
        })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const detail = payload?.error?.message || JSON.stringify(payload) || response.statusText;
        throw new Error(`DeepSeek API 錯誤 (${response.status}): ${detail}`);
    }

    const text = payload?.choices?.[0]?.message?.content?.trim();

    if (!text) {
        throw new Error('DeepSeek 沒有返回內容。');
    }

    return text;
}

module.exports = {
    DEEPSEEK_MODEL,
    DEEPSEEK_VISION_MODEL,
    SYSTEM_PERSONA,
    askDeepSeek
};
