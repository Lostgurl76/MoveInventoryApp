import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageUrl, imageMime } = req.body;

  if (!imageUrl) {
    console.error('No imageUrl in request body');
    return res.status(200).json({ error: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return res.status(200).json({ error: true });
  }

  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      console.error('Failed to fetch image:', imageRes.status);
      return res.status(200).json({ error: true });
    }
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Look at this image and extract any visible serial number. Return ONLY this JSON with no markdown and no explanation: {"serial_number":""}. If no serial number is visible, return {"serial_number":""}.' },
              { inline_data: { mime_type: imageMime || 'image/jpeg', data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0, max_output_tokens: 64 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ serial_number: '' });
    const parsed = JSON.parse(match[0]);
    return res.status(200).json({
      serial_number: typeof parsed.serial_number === 'string' ? parsed.serial_number : ''
    });

  } catch (e: any) {
    console.error('analyze-serial error:', e.message);
    return res.status(200).json({ error: true });
  }
}
