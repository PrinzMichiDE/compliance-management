import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Beschreibung fehlt oder ungültig.' }, { status: 400 });
    }

    // Prompt für GPT-4o
    const prompt = `Analysiere folgende Risikobeschreibung und gib eine strukturierte Empfehlung zurück:

Beschreibung: """
${description}
"""

Antwortformat (JSON):
{
  "category": "...",
  "probability": "Niedrig|Mittel|Hoch",
  "impact": "Niedrig|Mittel|Hoch",
  "measures": ["Maßnahme 1", "Maßnahme 2", ...]
}`;

    // OpenAI API-Aufruf (ersetze API-Key und Modell nach Bedarf)
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Du bist ein deutschsprachiger Compliance- und Risiko-Experte.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      return NextResponse.json({ error: 'Fehler bei OpenAI: ' + err }, { status: 500 });
    }

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content;
    let suggestion = null;
    try {
      suggestion = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'Antwort der KI konnte nicht geparst werden.', raw: content }, { status: 500 });
    }

    return NextResponse.json({ suggestion });
  } catch (e) {
    return NextResponse.json({ error: 'Interner Fehler: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
} 