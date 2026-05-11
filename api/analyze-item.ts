import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { base64Image, imageMime } = req.body;

  if (!base64Image) {
    console.error('No base64Image in request body');
    return res.status(200).json({ error: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return res.status(200).json({ error: true });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Analyze this image of a household item being packed for a move. Return ONLY this JSON, no markdown: {"item_name":"","item_type":"","description":"","est_value":0,"replacement_value":0,"prompt_serial":false,"confidence":"high|medium|low"}' },
              { inline_data: { mime_type: imageMime || 'image/jpeg', data: base64Image } }
            ]
          }],
          generation_config: { temperature: 0, max_output_tokens: 256 }
        })
      }
    );

    console.log('Gemini status:', geminiRes.status);
    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('AI text:', text);

    if (!geminiRes.ok) return res.status(200).json({ error: true });

    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return res.status(200).json({ error: true });

    return res.status(200).json(JSON.parse(match[0]));
  } catch (e: any) {
    console.error('Gemini error:', e.message);
    return res.status(200).json({ error: true });
  }
}
