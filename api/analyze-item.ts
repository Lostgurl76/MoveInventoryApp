import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

const ITEM_TYPES = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];
const ROOMS = ['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'];

const SYSTEM_PROMPT = `You are an AI assistant helping catalog household items for an international move. Analyze the provided image and return ONLY a valid JSON object with no markdown, no code fences, no explanation.

Return this exact structure:
{
  "item_name": "specific product name",
  "item_type": "type from list or short category name",
  "room": "room from list",
  "description": "one sentence fragment description",
  "est_value": 0,
  "replacement_value": 0,
  "prompt_serial": false,
  "confidence": "high"
}

Rules:
- item_type: map to this list first: ${ITEM_TYPES.join(', ')}. If nothing fits, suggest a 1-2 word category (e.g. Books, Kitchen Appliance, Musical Instrument). Never be more granular than that.
- room: must be one of: ${ROOMS.join(', ')}
- description: fragment style, no full sentences. E.g. "Tilt-head stand mixer, 5qt bowl, red finish."
- est_value: current used market value in USD from eBay/Poshmark/Facebook Marketplace. Default 1 if unknown.
- replacement_value: current retail price in USD from Amazon or major retailer. Default 1 if unknown.
- prompt_serial: true for electronics, appliances, jewelry, instruments, or if est_value >= 200. Otherwise false.
- confidence: "high" if clearly identified, "medium" if probably correct, "low" if guessing.
- For books: item_name = book title, description = "Book by {Author Name}."
- For unbranded items: use generic category name, not "Unknown Item".
- identification fallback: brand+model → generic category → broader category → "Unknown Item"`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });

    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';

    // Extract base64 image from multipart form data
    const bodyStr = body.toString('binary');
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return res.status(400).json({ error: true });

    const boundary = boundaryMatch[1];
    const parts = bodyStr.split(`--${boundary}`);
    const imagePart = parts.find(p => p.includes('Content-Type: image/'));
    if (!imagePart) return res.status(400).json({ error: true });

    const imageContentTypeMatch = imagePart.match(/Content-Type: (image\/\w+)/);
    const imageContentType = imageContentTypeMatch?.[1] || 'image/jpeg';
    const imageData = imagePart.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n--$/, '');
    const base64Image = Buffer.from(imageData, 'binary').toString('base64');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            parts: [
              { text: 'Analyze this household item and return the JSON object as specified.' },
              { inline_data: { mime_type: imageContentType, data: base64Image } }
            ]
          }],
          tools: [{ google_search: {} }],
          generation_config: { temperature: 0.1, max_output_tokens: 1024 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (e: any) {
    console.error('analyze-item error:', e.message);
    res.status(200).json({ error: true });
  }
}
