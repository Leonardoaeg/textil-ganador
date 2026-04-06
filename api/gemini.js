export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var b = req.body;
    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

    var prendaNombre = b.prendaNombre || 'prenda textil';

    // PASO 1: Búsqueda de novedad con Google Search grounding
    var searchUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

    var searchBody = {
      contents: [{
        parts: [
          { inline_data: { mime_type: b.imageType || 'image/jpeg', data: b.imageBase64 } },
          { text: `Analiza esta prenda textil detalladamente y busca en internet si es novedosa o está saturada en el mercado colombiano.

Busca referencias en:
- Pinterest Colombia: ¿está de moda o es tendencia?
- TikTok Colombia: ¿hay muchos videos con esta prenda? ¿está viral?
- MercadoLibre Colombia: ¿cuántos vendedores la tienen?
- Meta Ads Colombia: ¿hay muchos anuncios activos?
- Google Shopping Colombia: ¿está disponible en tiendas online?

Evalúa específicamente:
1. DESCRIPCIÓN DETALLADA DE LA PRENDA: tipo, material, corte, colores, acabados, detalles únicos que ves en la imagen
2. NIVEL DE NOVEDAD (1-10): qué tan nueva o diferente es esta prenda en el mercado colombiano
3. SATURACIÓN DE MERCADO: si está disponible en muchos lugares o es difícil de conseguir
4. TENDENCIA ACTUAL: si está subiendo, en pico, o bajando en popularidad

Responde ÚNICAMENTE con este JSON:
{
  "descripcion_detallada": "descripción muy precisa de lo que ves en la imagen: tipo de prenda, material visible, corte, colores exactos, detalles especiales, acabados",
  "novedad_score": 8,
  "novedad_nivel": "Alta|Media|Baja",
  "novedad_razon": "por qué es novedosa o no",
  "saturacion_meta": "Alta|Media|Baja",
  "saturacion_tiktok": "Alta|Media|Baja",
  "saturacion_mercadolibre": "Alta|Media|Baja",
  "saturacion_tiendas": "Alta|Media|Baja",
  "tendencia": "Subiendo|En pico|Bajando|Estable",
  "tendencia_razon": "explicación de la tendencia actual",
  "referencias_encontradas": ["referencia 1", "referencia 2", "referencia 3"],
  "recomendacion_novedad": "recomendación específica basada en la novedad"
}` }
        ]
      }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    var searchResp = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    });
    var searchData = await searchResp.json();

    // Extract search results
    var novedadText = '';
    var parts = searchData?.candidates?.[0]?.content?.parts || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].text && !parts[i].thought) {
        novedadText = parts[i].text;
        break;
      }
    }
    if (!novedadText && parts.length > 0) {
      novedadText = parts[parts.length - 1]?.text || '';
    }

    // Parse novedad JSON
    var novedadData = {};
    try {
      var cleanN = novedadText.replace(/```json\s*/gi,'').replace(/```\s*/g,'');
      var fb = cleanN.indexOf('{'), lb = cleanN.lastIndexOf('}');
      if (fb !== -1 && lb !== -1) {
        novedadData = JSON.parse(cleanN.substring(fb, lb+1));
      }
    } catch(e) { novedadData = { novedad_score: 5, novedad_nivel: 'Media' }; }

    // PASO 2: Análisis completo con toda la información
    var analysisBody = {
      contents: [{
        parts: [
          { inline_data: { mime_type: b.imageType || 'image/jpeg', data: b.imageBase64 } },
          { text: b.prompt + `

DATOS DE NOVEDAD YA INVESTIGADOS (úsalos en el análisis):
- Descripción detallada: ${novedadData.descripcion_detallada || 'ver imagen'}
- Novedad en mercado colombiano: ${novedadData.novedad_nivel || 'Media'} (score ${novedadData.novedad_score || 5}/10)
- Razón de novedad: ${novedadData.novedad_razon || ''}
- Saturación Meta Ads: ${novedadData.saturacion_meta || 'Media'}
- Saturación TikTok: ${novedadData.saturacion_tiktok || 'Media'}
- Saturación MercadoLibre: ${novedadData.saturacion_mercadolibre || 'Media'}
- Saturación tiendas físicas: ${novedadData.saturacion_tiendas || 'Media'}
- Tendencia: ${novedadData.tendencia || 'Estable'} — ${novedadData.tendencia_razon || ''}
- Referencias encontradas: ${(novedadData.referencias_encontradas || []).join(', ')}
- Recomendación: ${novedadData.recomendacion_novedad || ''}

Usa TODOS estos datos de novedad en tu análisis. La descripcion_detallada debe ir en datos_prenda.
En competencia usa los datos reales de saturación encontrados.` }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    var analysisResp = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisBody)
    });
    var analysisData = await analysisResp.json();

    if (analysisData.error) return res.status(400).json({ error: analysisData.error.message });

    // Extract analysis text
    var text = '';
    var aParts = analysisData?.candidates?.[0]?.content?.parts || [];
    for (var j = 0; j < aParts.length; j++) {
      if (aParts[j].text && !aParts[j].thought) {
        text = aParts[j].text;
        break;
      }
    }
    if (!text && aParts.length > 0) text = aParts[aParts.length-1]?.text || '';

    return res.status(200).json({
      text: text,
      novedad: novedadData
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
