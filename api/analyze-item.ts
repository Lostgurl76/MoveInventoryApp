import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

const ITEM_TYPES = ['Cleaning', 'Clothing', 'Cookware', 'Crafts', 'Decor', 'Electronics', 'Food', 'Furniture', 'Jewelry', 'Keepsakes', 'Misc.', 'Puppers', 'Soft Goods', 'Toiletries', 'Utility'];
const ROOMS = ['Bathroom', 'Bedroom', 'Dining', 'Garage', 'General', 'Hobby', 'Living Room', 'Kitchen', 'Office', 'Pantry', 'Patio', 'Puppers', 'Storage'];

const PROMPT = `Analyze this household item image. Return ONLY a JSON object, no markdown, no code fences, no explanation.

{"item_name":"name","item_type":"type","room":"room","description":"fragment","est_value":1,"replacement_value":1,"prompt_serial":false,"confidence":"high"}

item_type options: ${ITEM_TYPES.join(', ')} — or a 1-2 word category if none fit
room options: ${ROOMS.join(', ')}
description: fragment style, e.g. "Ceramic mug, Stranger Things design."
est_value: used market value USD, number
replacement_value: retail price USD, number
prompt_serial: true only for electronics/appliances/jewelry/instruments
confidence: high/medium/low
Books: item_name = title, description = "Book by Author."
Return ONLY the raw JSON object. No markdown. No backticks. No explanation.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';

    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) return res.status(200).json({ error: true });
    const boundary = Buffer.from(`--${boundaryMatch[1]}`);

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

    let imageBuffer: Buffer | null = null;
    let imageMime = 'image/jpeg';
    for (const part of parts) {
      const partStr = part.slice(0, 300).toString('utf8');
      if (partStr.includes('Content-Type: image/')) {
        const mimeMatch = partStr.match(/Content-Type: (image\/[^\r\n]+)/);
        if (mimeMatch) imageMime = mimeMatch[1].trim();
        const separator = Buffer.from('\r\n\r\n');
        const sepIdx = part.indexOf(separator);
        if (sepIdx !== -1) imageBuffer = part.slice(sepIdx + 4, part.length - 2);
        break;
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error('No image extracted');
      return res.status(200).json({ error: true });
    }

    const base64Image = imageBuffer.toString('base64');
    console.log('Image size:', imageBuffer.length, 'MIME:', imageMime);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: imageMime, data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0.1, max_output_tokens: 512 }
        })
      }
    );

    const responseText = await geminiRes.text();
    console.log('Gemini status:', geminiRes.status);

    if (!geminiRes.ok) {
      console.error('Gemini error:', responseText.substring(0, 200));
      return res.status(200).json({ error: true });
    }

    const geminiData = JSON.parse(responseText);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('AI text:', text.substring(0, 200));

    // Extract JSON — handle markdown wrapping, extra text, anything
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in response');
      return res.status(200).json({ error: true });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Parsed successfully:', parsed.item_name);
    res.status(200).json(parsed);

  } catch (e: any) {
    console.error('analyze-item error:', e.message);
    res.status(200).json({ error: true });
  }
}
