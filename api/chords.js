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

    const bpmGuide = `
RANGOS DE BPM OBLIGATORIOS POR GÉNERO (respétalos SIEMPRE):
- Reggaeton: 70–95 BPM (dembow pattern, típicamente 80-90)
- Trap: 130–160 BPM (o 65–80 si es half-time)
- Drill: 130–145 BPM
- Hip-Hop: 80–100 BPM
- R&B: 60–100 BPM
- Afrobeat: 95–115 BPM
- Pop: 100–130 BPM
- Dancehall: 85–110 BPM
- Latin Pop: 90–120 BPM
- Lo-fi: 60–90 BPM
Si el género no está en la lista, usa un BPM lógico para ese estilo.`;

    const keyGuide = `
TONALIDADES MÁS USADAS POR GÉNERO (úsalas si no se especifica tonalidad):
- Reggaeton: Am, Gm, Dm, Fm, Cm (predominan menores)
- Trap: Am, F#m, Bm, Em, Cm (oscuras y menores)
- Drill: F#m, Bm, Em, Am, Dm (muy oscuras)
- Hip-Hop: Am, Dm, Gm, Cm, Fm (menores o blues)
- R&B: Dbmaj, Bbm, Ebmaj, Fm, Abmaj (ricas en color)
- Afrobeat: Fmaj, Cmaj, Gmaj, Am, Dm (mezcla mayor/menor)
- Pop: Cmaj, Gmaj, Dmaj, Amaj, Emaj (mayores brillantes)
- Lo-fi: Dbmaj, Abmaj, Bbm, Fm (jazz-influenced)`;

    const prompt = `Eres un productor musical experto. Genera ${count || 3} progresiones de acordes únicas para un beat de: ${parts.join(' | ')}.

${bpmGuide}

${keyGuide}

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
    "bpm": 85,
    "scale": "A menor",
    "vibe": "descripción del feeling y cómo usar esta progresión (2 oraciones)"
  }
]

Reglas:
- Cada progresión debe tener entre 3 y 6 acordes
- Los nombres de acordes deben ser notación estándar (Am, Cmaj7, F#m, Bb, etc.)
- Las notas deben ser las notas reales del acorde
- El BPM DEBE estar dentro del rango indicado para el género — esto es obligatorio
- Si el usuario especificó tonalidad, úsala; si no, elige una típica del género
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
