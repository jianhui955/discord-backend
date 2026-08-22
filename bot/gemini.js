const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PERSONA =
    '你是一个幽默、毒舌且极其简短的 Discord 助手。我们玩的游戏是「燕云十六声」。请用 1-2 句话以调侃的语气回答用户，但必须包含事实本质。回答时优先结合燕云十六声相关背景，但非游戏问题也可正常回答。';

function getGeminiApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
}

function createGeminiModel(systemPrompt = SYSTEM_PERSONA) {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
        throw new Error('缺少 GEMINI_API_KEY，请在 .env 中配置 Google AI Studio API Key。');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    return genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: systemPrompt
    });
}

function toGeminiHistory(history = []) {
    return history
        .filter(row => row.role === 'user' || row.role === 'assistant')
        .map(row => ({
            role: row.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: row.content }]
        }));
}

async function askGemini(question, { history = [], systemPrompt = SYSTEM_PERSONA } = {}) {
    const prompt = String(question || '').trim();

    if (!prompt) {
        throw new Error('問題不能為空。');
    }

    const model = createGeminiModel(systemPrompt);
    const geminiHistory = toGeminiHistory(history);

    let text;

    if (geminiHistory.length > 0) {
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(prompt);
        text = result?.response?.text?.()?.trim();
    } else {
        const result = await model.generateContent(prompt);
        text = result?.response?.text?.()?.trim();
    }

    if (!text) {
        throw new Error('Gemini 沒有返回內容。');
    }

    return text;
}

module.exports = {
    GEMINI_MODEL,
    SYSTEM_PERSONA,
    askGemini
};
