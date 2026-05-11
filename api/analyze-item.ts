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
      console.error('Failed to fetch image from URL:', imageRes.status);
      return res.status(200).json({ error: true });
    }
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageMime || 'image/jpeg';

    console.log('Image fetched, size (bytes):', imageBuffer.byteLength);

    const validTypes = ['Cleaning','Clothing','Cookware','Crafts','Decor','Electronics','Food','Furniture','Jewelry','Keepsakes','Misc.','Puppers','Soft Goods','Toiletries','Utility'];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this image of a household item being packed for an international move. Return ONLY a valid JSON object with no markdown, no code fences, no explanation. Use exactly this structure: {"item_name":"","item_type":"","description":"","est_value":0,"replacement_value":0,"prompt_serial":false,"confidence":"low"}. Rules: item_type must be exactly one of: ${validTypes.join(', ')}. est_value and replacement_value must be plain numbers with no currency symbols or units. prompt_serial must be boolean true only for electronics, appliances, or items with a visible serial number. confidence must be exactly "high", "medium", or "low" based on how clearly the item is identifiable.`
              },
              { inline_data: { mime_type: mimeType, data: base64Image } }
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

    if (!geminiRes.ok) {
      console.error('Gemini error response:', JSON.stringify(geminiData));
      return res.status(200).json({ error: true });
    }

    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('No JSON found in response');
      return res.status(200).json({ error: true });
    }

    const parsed = JSON.parse(match[0]);

    return res.status(200).json({
      item_name: typeof parsed.item_name === 'string' ? parsed.item_name : '',
      item_type: validTypes.includes(parsed.item_type) ? parsed.item_type : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      est_value: typeof parsed.est_value === 'number' ? parsed.est_value : 0,
      replacement_value: typeof parsed.replacement_value === 'number' ? parsed.replacement_value : 0,
      prompt_serial: parsed.prompt_serial === true,
      confidence: ['high','medium','low'].includes(parsed.confidence) ? parsed.confidence : 'low'
    });

  } catch (e: any) {
    console.error('Handler error:', e.message);
    return res.status(200).json({ error: true });
  }
}
