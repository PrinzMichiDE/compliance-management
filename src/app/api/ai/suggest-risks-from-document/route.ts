import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/types/enums';
import { RiskFormData, RiskProbability, RiskImpact, RiskStatus } from '@/types/risk'; // Angepasst für präzisere Typisierung

// Dummy-Funktion zur Simulation der KI-Risikoerstellung
async function generateRiskSuggestionFromDocument(documentId: string, documentContent?: string): Promise<Partial<RiskFormData>> {
  // In einer echten Anwendung:
  // 1. Dokumentinhalt basierend auf documentId abrufen
  // 2. KI-Service aufrufen, um Risikovorschläge zu generieren
  // Hier nur Mock-Daten:
  return {
    title: `KI Risiko für Dok ${documentId}`,
    description: `Dies ist eine KI-generierte Beschreibung für ein Risiko basierend auf Dokument ${documentId}. Inhalt: '${documentContent || 'Nicht abrufbar (Simulation)'}'.`,
    source: `KI-Analyse: Dokument ${documentId}`,
    category: 'KI-Vorschlag',
    probability: RiskProbability.MEDIUM, // Beispielwert
    impact: RiskImpact.MEDIUM, // Beispielwert
    status: RiskStatus.OPEN, // Standardmäßig Offen
    identifiedDate: new Date().toISOString().split('T')[0], // Heutiges Datum
    aiIdentified: true,
    aiGeneratedDescription: `KI generierte Detailbeschreibung für Risiko zu Dokument ${documentId}.`,
    aiSuggestedMitigation: 'Überprüfung und Implementierung von Kontrollmaßnahmen basierend auf Dokumentinhalt.',
    // Weitere Felder könnten hier basierend auf der RiskFormData-Definition und KI-Analyse hinzugefügt werden
  };
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  console.log('[API suggest-risks] Token empfangen:', JSON.stringify(token, null, 2));

  if (!token) {
    return NextResponse.json({ error: 'Nicht autorisiert - kein Token' }, { status: 401 });
  }

  console.log('[API suggest-risks] token.role (Singular):', JSON.stringify(token.role, null, 2));

  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE,
    UserRole.RISK_MANAGER,
  ];

  const userRole = token.role as UserRole;
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.error('[API suggest-risks] Autorisierung fehlgeschlagen. userRole (Singular):', userRole, 'AllowedRoles:', allowedRoles);
    return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion oder Rolle nicht korrekt formatiert' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'documentId ist erforderlich' }, { status: 400 });
  }

  try {
    // Hier könnte man den tatsächlichen Dokumenteninhalt laden
    // const suggestedRisk = await generateRiskSuggestionFromDocument(documentId, "Beispiel Dokumenteninhalt...");
    const suggestedRisk = await generateRiskSuggestionFromDocument(documentId);

    return NextResponse.json({ suggestedRisk });
  } catch (error) {
    console.error('Fehler bei der Risikoerstellung durch KI:', error);
    let errorMessage = 'Unbekannter Fehler';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Fehler bei der KI-Risikoerstellung', details: errorMessage }, { status: 500 });
  }
} 