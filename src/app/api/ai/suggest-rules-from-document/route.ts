import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/types/enums';
// import { Rule } from '@/types/rule'; // Für später, wenn wir den Typ genauer verwenden

// Dummy-Funktion zur Simulation der KI-Regelerstellung
async function generateRuleSuggestionFromDocument(documentId: string, documentContent?: string): Promise<Partial<any>> {
  // In einer echten Anwendung:
  // 1. Dokumentinhalt basierend auf documentId abrufen (aus DB oder Dateispeicher)
  // 2. KI-Service aufrufen, um Regelvorschläge zu generieren
  // Hier nur Mock-Daten:
  return {
    name: `KI Regel für Dok ${documentId}`,
    description: `Dies ist eine KI-generierte Beschreibung für eine Regel basierend auf dem Dokument ${documentId}. Der Inhalt des Dokuments war: '${documentContent || 'Nicht abrufbar (Simulation)'}'.`,
    category: 'KI-Vorschlag',
    priority: 'Mittel',
    status: 'Entwurf', // Standardmäßig Entwurf
    tags: ['KI', 'Vorschlag', documentId],
    // Weitere Felder könnten hier basierend auf der Rule-Definition und KI-Analyse hinzugefügt werden
  };
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  console.log('[API suggest-rules] Token empfangen:', JSON.stringify(token, null, 2));

  if (!token) {
    return NextResponse.json({ error: 'Nicht autorisiert - kein Token' }, { status: 401 });
  }

  console.log('[API suggest-rules] token.role (Singular):', JSON.stringify(token.role, null, 2));

  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE,
  ];
  
  const userRole = token.role as UserRole;
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.error('[API suggest-rules] Autorisierung fehlgeschlagen. userRole (Singular):', userRole, 'AllowedRoles:', allowedRoles);
    return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion oder Rolle nicht korrekt formatiert' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'documentId ist erforderlich' }, { status: 400 });
  }

  try {
    // Hier könnte man den tatsächlichen Dokumenteninhalt laden, falls für die KI nötig
    // const document = await fetchDocumentById(documentId); // Pseudocode
    // const suggestedRule = await generateRuleSuggestionFromDocument(documentId, document.content);

    const suggestedRule = await generateRuleSuggestionFromDocument(documentId);

    return NextResponse.json({ suggestedRule });
  } catch (error) {
    console.error('Fehler bei der Regelerstellung durch KI:', error);
    let errorMessage = 'Unbekannter Fehler';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Fehler bei der KI-Regelerstellung', details: errorMessage }, { status: 500 });
  }
} 