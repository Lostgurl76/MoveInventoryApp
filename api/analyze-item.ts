import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

const ITEM_TYPES = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];
const ROOMS = ['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'];

const SYSTEM_PROMPT = `You are an AI assistant helping catalog household items for an international move. Analyze the provided image and return ONLY a valid JSON object with no markdown, no code fences, no explanation, no extra text of any kind.

Return exactly this structure:
{
  "item_name": "specific product name",
  "item_type": "type from list or short category name",
  "room": "room from list",
  "description": "one sentence fragment description",
  "est_value": 1,
  "replacement_value": 1,
  "prompt_serial": false,
  "confidence": "high"
}

Rules:
- item_type: map to this list first: ${ITEM_TYPES.join(', ')}. If nothing fits, suggest a 1-2 word category only.
- room: must be exactly one of: ${ROOMS.join(', ')}
- description: fragment style only. E.g. "Ceramic mug, Stranger Things design, red and black."
- est_value: estimate current used market value in USD as a number. Use your training data for pricing. Default 1 if truly unknown.
- replacement_value: estimate current retail price in USD as a number. Default 1 if truly unknown.
- prompt_serial: true only for electronics, appliances, jewelry, or instruments. false otherwise.
- confidence: "high" if clearly identified, "medium" if probably correct, "low" if guessing.
- For books: item_name = title, description = "Book by {Author}."
- Return ONLY the JSON object. Nothing else.`;

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

    const bodyStr = body.toString('binary');
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      console.error('No boundary found in content-type:', contentType);
      return res.status(200).json({ error: true });
    }

    const boundary = boundaryMatch[1];
    const parts = bodyStr.split(`--${boundary}`);
    const imagePart = parts.find(p => p.includes('Content-Type: image/'));
    if (!imagePart) {
      console.error('No image part found. Parts:', parts.length);
      return res.status(200).json({ error: true });
    }

    const imageContentTypeMatch = imagePart.match(/Content-Type: (image\/\w+)/);
    const imageContentType = imageContentTypeMatch?.[1] || 'image/jpeg';
    const imageData = imagePart.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n--$/, '');
    const base64Image = Buffer.from(imageData, 'binary').toString('base64');

    console.log('Image extracted, size:', base64Image.length, 'type:', imageContentType);

    const requestBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        parts: [
          { text: 'Analyze this household item image and return the JSON object.' },
          { inline_data: { mime_type: imageContentType, data: base64Image } }
        ]
      }],
      generation_config: { temperature: 0.1, max_output_tokens: 512 }
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    const responseText = await geminiResponse.text();
    console.log('Gemini status:', geminiResponse.status);
    console.log('Gemini response:', responseText.substring(0, 500));

    const geminiData = JSON.parse(responseText);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Extracted text:', text);

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (e: any) {
    console.error('analyze-item error:', e.message);
    res.status(200).json({ error: true });
  }
}
