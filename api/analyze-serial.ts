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

    const body = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';

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
          contents: [{
            parts: [
              { text: 'Extract the serial number from this image. Return ONLY a JSON object: {"serial_number": "extracted text"}. If no serial number is visible, return {"serial_number": ""}. No markdown, no explanation.' },
              { inline_data: { mime_type: imageContentType, data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0, max_output_tokens: 128 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (e: any) {
    console.error('analyze-serial error:', e.message);
    res.status(200).json({ error: true });
  }
}
