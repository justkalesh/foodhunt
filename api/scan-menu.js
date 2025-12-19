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

    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY missing.' });
    }

    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const systemPrompt = `Analyze this restaurant menu image. Extract all food items. Return ONLY a JSON array with objects.

For each item include:
- 'name': item name
- 'category': Use the SECTION HEADING visible on the menu (e.g., "CHAI", "SNACKS", "PIZZA", "BURGER", "COLD COFFEE"). Look for big/bold text that groups items together. If no heading visible above items, infer a logical category.
- 'price': default price (number only, no currency symbols)
- 'small_price': price for small size (only if menu shows S/M/L or Small/Regular/Large columns)
- 'medium_price': price for medium/regular size (only if menu shows size columns)
- 'large_price': price for large size (only if menu shows size columns)

IMPORTANT for categories:
- Look for SECTION HEADINGS like "CHAI", "SNACKS", "COLD COFFEE", "HOT COFFEE", "PASTA", "PIZZA", "BURGER", "FRENCH FRIES", "SANDWICH", "LASSI", "MAGGI", "MIX VEG ROLLS", "PANEER ROLLS", "CHINESE CUISINE", etc.
- These headings are usually in BIGGER/BOLDER font above a group of items
- Use the EXACT heading text as the category name
- Only infer a category if no visible heading exists for that section

Example output:
[{"name": "Adrak Chai", "category": "CHAI", "price": 0, "small_price": 20, "large_price": 50}]
[{"name": "Corn Chat", "category": "SNACKS", "price": 55}]
[{"name": "Black Cold Coffee", "category": "COLD COFFEE", "price": 50}]

Rules:
- Extract EVERY item visible
- Prices must be numbers only (strip ₹, Rs, $, /-)
- For size columns (S/M/L or Small/Regular/Large), map to small_price, medium_price, large_price
- If item has only one price, use 'price' field
- If no size variants, omit small_price, medium_price, large_price fields
- Return ONLY the JSON array, no markdown`;

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: mimeType || "image/jpeg"
            }
        };

        const result = await model.generateContent([systemPrompt, imagePart]);
        const response = await result.response;
        let text = response.text();

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        // Parse the JSON response
        let menuItems;
        try {
            menuItems = JSON.parse(text);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", text);
            return res.status(500).json({
                error: 'Failed to parse menu items from image.',
                rawResponse: text
            });
        }

        // Validate and clean the response
        if (!Array.isArray(menuItems)) {
            return res.status(500).json({ error: 'Invalid response format from AI.' });
        }

        // Clean up each item - strip currency symbols and ensure proper types
        const cleanPrice = (val) => {
            if (val === undefined || val === null) return undefined;
            const parsed = parseFloat(String(val).replace(/[₹$Rs,.]/g, ''));
            return isNaN(parsed) ? undefined : parsed;
        };

        const cleanedItems = menuItems.map(item => {
            const cleaned = {
                name: String(item.name || '').trim(),
                category: String(item.category || 'Uncategorized').trim(),
                price: cleanPrice(item.price) || 0
            };
            // Only add size prices if they exist
            if (item.small_price !== undefined) cleaned.small_price = cleanPrice(item.small_price);
            if (item.medium_price !== undefined) cleaned.medium_price = cleanPrice(item.medium_price);
            if (item.large_price !== undefined) cleaned.large_price = cleanPrice(item.large_price);
            return cleaned;
        }).filter(item => item.name); // Remove items without names

        return res.status(200).json({
            success: true,
            items: cleanedItems,
            count: cleanedItems.length
        });

    } catch (error) {
        console.error("Gemini Vision API Error:", error);
        console.error("Error details:", error.message, error.stack);
        return res.status(500).json({
            error: 'Failed to analyze menu image.',
            details: error.message,
            errorType: error.constructor.name
        });
    }
}
