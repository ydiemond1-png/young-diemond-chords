export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada en Vercel' });

  try {
    const { genre, freeText, key, mood, count } = req.body;

    const parts = [];
    if (genre)    parts.push(`Género: ${genre}`);
    if (freeText) parts.push(`Descripción: ${freeText}`);
    if (key)      parts.push(`Tonalidad preferida: ${key}`);
    if (mood)     parts.push(`Mood: ${mood}`);

    const prompt = `Eres un productor musical experto. Genera ${count || 3} progresiones de acordes únicas para un beat de: ${parts.join(' | ')}.

Responde ÚNICAMENTE con un JSON array válido. Sin texto adicional, sin markdown, sin explicaciones fuera del JSON.

Formato exacto:
[
  {
    "name": "nombre creativo de la progresión",
    "chords": [
      { "name": "Am", "notes": "A C E" },
      { "name": "F", "notes": "F A C" },
      { "name": "C", "notes": "C E G" },
      { "name": "G", "notes": "G B D" }
    ],
    "bpm": 140,
    "scale": "A menor",
    "vibe": "descripción del feeling y cómo usar esta progresión (2 oraciones)"
  }
]

Reglas:
- Cada progresión debe tener entre 3 y 6 acordes
- Los nombres de acordes deben ser notación estándar (Am, Cmaj7, F#m, Bb, etc.)
- Las notas deben ser las notas reales del acorde
- El BPM debe ser realista para el género
- Los nombres deben ser creativos y evocadores, en español o inglés
- Las progresiones deben sonar DIFERENTES entre sí`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return res.status(groqRes.status).json({ error: err.error?.message || 'Error de Groq' });
    }

    const data = await groqRes.json();
    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const progressions = JSON.parse(clean);
    return res.status(200).json({ progressions });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
