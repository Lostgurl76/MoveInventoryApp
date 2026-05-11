import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

const ITEM_TYPES = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];
const ROOMS = ['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'];

const SYSTEM_PROMPT = `You are an AI assistant helping catalog household items for an international move. Analyze the provided image and return ONLY a valid JSON object with no markdown, no code fences, no explanation.

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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data = await response.json();
  console.log('Available models:', JSON.stringify(data, null, 2));
  return new Response(JSON.stringify(data), { status: 200 });
}