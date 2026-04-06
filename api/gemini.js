export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    var body = req.body;
    var prompt = body.prompt;
    var imageBase64 = body.imageBase64;
    var imageType = body.imageType || 'image/jpeg';

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key no configurada' });
    }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;

    var requestBody = {
      contents: [{
        parts: [
          { inline_data: { mime_type: imageType, data: imageBase64 } },
          { text: prompt }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000
      }
    };

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    var data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    var text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      text = data.candidates[0].content.parts[0].text || '';
    }

    return res.status(200).json({ text: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
