exports.handler = async function(event) {
  var cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  try {
    var body = JSON.parse(event.body);
    var prompt = body.prompt;
    var imageBase64 = body.imageBase64;
    var imageType = body.imageType || 'image/jpeg';

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: 'API key no configurada en Netlify' })
      };
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
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: data.error.message })
      };
    }

    var text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      text = data.candidates[0].content.parts[0].text || '';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
