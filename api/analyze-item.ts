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
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Collect raw body as Buffer
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks);

    // Extract boundary
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      console.error('No boundary');
      return res.status(200).json({ error: true });
    }
    const boundary = Buffer.from(`--${boundaryMatch[1]}`);

    // Split on boundary
    const parts: Buffer[] = [];
    let start = 0;
    while (start < rawBody.length) {
      const idx = rawBody.indexOf(boundary, start);
      if (idx === -1) break;
      const partStart = idx + boundary.length;
      const nextIdx = rawBody.indexOf(boundary, partStart);
      if (nextIdx === -1) break;
      parts.push(rawBody.slice(partStart, nextIdx));
      start = nextIdx;
    }

    // Find image part
    let imageBuffer: Buffer | null = null;
    let imageMime = 'image/jpeg';
    for (const part of parts) {
      const partStr = part.slice(0, 200).toString('utf8');
      if (partStr.includes('Content-Type: image/')) {
        const mimeMatch = partStr.match(/Content-Type: (image\/[^\r\n]+)/);
        if (mimeMatch) imageMime = mimeMatch[1].trim();
        // Find double CRLF separator between headers and body
        const separator = Buffer.from('\r\n\r\n');
        const sepIdx = part.indexOf(separator);
        if (sepIdx !== -1) {
          // Remove trailing \r\n
          imageBuffer = part.slice(sepIdx + 4, part.length - 2);
        }
        break;
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error('No image buffer extracted');
      return res.status(200).json({ error: true });
    }

    const base64Image = imageBuffer.toString('base64');
    console.log('Image size:', imageBuffer.length, 'MIME:', imageMime);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            parts: [
              { text: 'Identify this household item and return only the JSON.' },
              { inline_data: { mime_type: imageMime, data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0.1, max_output_tokens: 512 }
        })
      }
    );

    const responseText = await geminiRes.text();
    console.log('Gemini HTTP status:', geminiRes.status);
    console.log('Gemini response preview:', responseText.substring(0, 300));

    const geminiData = JSON.parse(responseText);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('AI text:', text);

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (e: any) {
    console.error('analyze-item error:', e.message, e.stack?.substring(0, 200));
    res.status(200).json({ error: true });
  }
}
