import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // CORS Helper
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY missing.' });
    }

    const { userMessage, contextData } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'userMessage is required' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
      You are 'FoodieBot', the AI assistant for FOOD-HUNT, a campus food discovery app.
      Your goal is to help students find food, suggest meal splits, and answer questions about vendors.
      
      Here is the current data about vendors on campus:
      ${contextData || 'No specific vendor data provided.'}

      Rules:
      1. Be friendly and casual (student vibe).
      2. If asked for recommendations, use the vendor data provided.
      3. If asked about "splitting meals", explain that they can join open splits in the "Meal Split" tab.
      4. Keep answers concise (under 100 words).
    `;

        const result = await model.generateContent([
            systemPrompt,
            "\n\nUser Question: " + userMessage
        ]);
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({ response: text });

    } catch (error) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({
            error: 'Failed to generate response.',
            details: error.message
        });
    }
}
