export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada en Vercel' });

  // BPM ranges enforced server-side — model cannot override these
  const BPM_RANGES = {
    'reggaeton':  { min: 70,  max: 95  },
    'trap':       { min: 130, max: 160 },
    'drill':      { min: 130, max: 145 },
    'hip-hop':    { min: 80,  max: 100 },
    'hip hop':    { min: 80,  max: 100 },
    'r&b':        { min: 60,  max: 100 },
    'rnb':        { min: 60,  max: 100 },
    'afrobeat':   { min: 95,  max: 115 },
    'pop':        { min: 100, max: 130 },
    'latin pop':  { min: 90,  max: 120 },
    'dancehall':  { min: 85,  max: 110 },
    'lo-fi':      { min: 60,  max: 90  },
    'lofi':       { min: 60,  max: 90  },
  };

  try {
    const { genre, freeText, key, mood, count } = req.body;

    const parts = [];
    if (genre)    parts.push(`Género: ${genre}`);
    if (freeText) parts.push(`Descripción: ${freeText}`);
    if (key)      parts.push(`Tonalidad preferida: ${key}`);
    if (mood)     parts.push(`Mood: ${mood}`);

    const genreKey = (genre || '').toLowerCase().trim();
    const range = BPM_RANGES[genreKey];
    const bpmInstruction = range
      ? `- El BPM DEBE estar entre ${range.min} y ${range.max} para ${genre}. Obligatorio.`
      : `- El BPM debe ser realista para el género indicado.`;

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
${bpmInstruction}
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

    // Enforce BPM server-side — if model ignored the instruction, we fix it here
    if (range) {
      progressions.forEach(p => {
        if (!p.bpm || p.bpm < range.min || p.bpm > range.max) {
          p.bpm = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        }
      });
    }

    return res.status(200).json({ progressions });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
