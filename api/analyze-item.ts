import type { VercelRequest, VercelResponse } from '@vercel/node';
export const config = { api: { bodyParser: false } };
const ITEM_TYPES = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];
const ROOMS = ['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'];
const SYSTEM_PROMPT = `You are an AI assistant helping catalog household items for an international move. Analyze the provided image and return ONLY a valid JSON object with no other text.
Return exactly this structure:
{"item_name":"name","item_type":"type","room":"room","description":"fragment description","est_value":1,"replacement_value":1,"prompt_serial":false,"confidence":"high"}
Rules:
- item_type: use one of: ${ITEM_TYPES.join(', ')}. If none fit, use a 1-2 word category.
- room: use one of: ${ROOMS.join(', ')}
- description: fragment style, no full sentences.
- est_value: used market value USD, number only, default 1.
- replacement_value: retail price USD, number only, default 1.
- prompt_serial: true for electronics/appliances/jewelry/instruments only.
- confidence: high/medium/low.
- Return ONLY valid JSON. No other text.`;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { base64Image, imageMime } = body;
    if (!base64Image || !imageMime) return res.status(400).json({ error: 'Missing image data' });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nIdentify this household item and return only the JSON.` },
              { inline_data: { mime_type: imageMime, data: base64Image } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json' }
        })
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini ${response.status}: ${err}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e: any) {
    console.error('analyze-item error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
