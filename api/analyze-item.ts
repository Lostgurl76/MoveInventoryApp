import { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const busboy = Busboy({ headers: req.headers });
  const chunks: Buffer[] = [];
  let imageMime = 'image/jpeg';
  let gotFile = false;

  busboy.on('file', (_field, stream, info) => {
    gotFile = true;
    imageMime = info.mimeType || 'image/jpeg';
    stream.on('data', chunk => chunks.push(chunk));
  });

  busboy.on('finish', async () => {
    if (!gotFile || chunks.length === 0) {
      console.error('No file received');
      return res.status(200).json({ error: true });
    }

    const base64Image = Buffer.concat(chunks).toString('base64');
    console.log('Image size (bytes):', Buffer.concat(chunks).length);
    console.log('MIME type:', imageMime);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set');
      return res.status(200).json({ error: true });
    }

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Look at this image. If there is a serial number visible, return only this JSON: {"serial_number":"value"}. If no serial number is visible, return {"serial_number":""}. No markdown. No explanation. JSON only.' },
                { inline_data: { mime_type: imageMime, data: base64Image } }
              ]
            }],
            generation_config: { temperature: 0, max_output_tokens: 64 }
          })
        }
      );

      console.log('Gemini status:', geminiRes.status);
      const geminiData = await geminiRes.json();
      console.log('Gemini raw:', JSON.stringify(geminiData).slice(0, 300));

      if (!geminiRes.ok) return res.status(200).json({ error: true });

      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('AI text:', text);

      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) return res.status(200).json({ serial_number: '' });

      const parsed = JSON.parse(match[0]);
      return res.status(200).json(parsed);

    } catch (e: any) {
      console.error('Gemini fetch error:', e.message);
      return res.status(200).json({ error: true });
    }
  });

  busboy.on('error', (e: any) => {
    console.error('Busboy error:', e.message);
    return res.status(200).json({ error: true });
  });

  req.pipe(busboy);
}
