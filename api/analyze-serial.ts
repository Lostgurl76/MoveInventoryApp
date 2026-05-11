import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

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

    if (!imageBuffer || imageBuffer.length === 0) return res.status(200).json({ error: true });

    const base64Image = imageBuffer.toString('base64');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract the serial number from this image. Return only this JSON: {"serial_number":"value"} — no markdown, no explanation. If no serial number visible, return {"serial_number":""}.' },
              { inline_data: { mime_type: imageMime, data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0, max_output_tokens: 64 }
        })
      }
    );

    if (!geminiRes.ok) return res.status(200).json({ error: true });

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(200).json({ serial_number: '' });
    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);

  } catch (e: any) {
    console.error('analyze-serial error:', e.message);
    res.status(200).json({ error: true });
  }
}
