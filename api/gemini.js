export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    var b = req.body;
    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

    // Intentar con gemini-2.0-flash (v1beta) que es el modelo más nuevo
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=' + apiKey;
    
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: b.imageType || 'image/jpeg', data: b.imageBase64 } },
          { text: b.prompt }
        ]}],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
      })
    });
    var data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    var text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
