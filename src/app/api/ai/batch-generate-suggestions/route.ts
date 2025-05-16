import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import OpenAI from 'openai';
import { UserRole } from '@/types/enums';
import { Rule } from '@/types/rule';
import { Risk, RiskProbability, RiskImpact, RiskStatus } from '@/types/risk';
import { ObjectId } from 'mongodb';

// OpenAI Client Initialisierung
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_CUSTOM_ENDPOINT_URL || undefined,
});

// Annahme: Sie haben Datenbankmodelle und -dienste
// import DocumentModel from '@/models/Document'; // Ihr Mongoose Document Modell
// import RuleModel from '@/models/Rule';       // Ihr Mongoose Rule Modell
// import RiskModel from '@/models/Risk';       // Ihr Mongoose Risk Modell

// --- PLATZHALTER FÜR ECHTE DATENBANKFUNKTIONEN ---
interface RealDocument { // Definieren Sie dies entsprechend Ihrem Document-Modell
  _id: string | ObjectId;
  name: string;
  content: string; // Oder wie auch immer Sie auf den Dokumenteninhalt zugreifen
  lastModified?: Date;
  // ... weitere Felder Ihres Dokumentmodells
}

async function fetchAllDocumentsFromDB(): Promise<RealDocument[]> {
  console.log('[DB Service] Fetching all documents for AI analysis...');
  // TODO: Implementieren Sie die Logik, um alle relevanten Dokumente aus Ihrer Datenbank abzurufen.
  // Beispiel (Mongoose): return await DocumentModel.find({ /* Ihre Kriterien */ }).lean();
  // Stellen Sie sicher, dass der Dokumenteninhalt für die KI-Analyse verfügbar ist.
  throw new Error('fetchAllDocumentsFromDB function not implemented');
  // return [{_id: "doc1", name: "Testdokument", content: "Das ist ein Test."}]; // Für erste Tests
}

async function findExistingRuleInDB(docId: string | ObjectId, ruleIdentifier: string): Promise<Rule | null> {
  console.log(`[DB Service] Checking for existing AI rule for doc ${docId} based on identifier "${ruleIdentifier}"`);
  // TODO: Implementieren Sie die Logik, um eine existierende, von KI generierte Regel zu finden.
  // Kriterien könnten sein: sourceDocumentId, aiGenerated: true und ein von der KI gelieferter Identifier oder ein Hash des Regelnamens/der Beschreibung.
  // Beispiel (Mongoose): return await RuleModel.findOne({ sourceDocumentId: docId, name: ruleIdentifier, aiGenerated: true }).lean();
  throw new Error('findExistingRuleInDB function not implemented');
  // return null; 
}

async function findExistingRiskInDB(docId: string | ObjectId, riskIdentifier: string): Promise<Risk | null> {
  console.log(`[DB Service] Checking for existing AI risk for doc ${docId} based on identifier "${riskIdentifier}"`);
  // TODO: Implementieren Sie die Logik analog zu findExistingRuleInDB für Risiken.
  // Beispiel (Mongoose): return await RiskModel.findOne({ sourceDocumentId: docId, title: riskIdentifier, aiGenerated: true }).lean();
  throw new Error('findExistingRiskInDB function not implemented');
  // return null;
}

async function createRuleInDB(ruleData: Partial<Rule>, userId?: string): Promise<Rule> {
  console.log(`[DB Service] Creating new AI-generated rule: "${ruleData.name}"`);
  // TODO: Implementieren Sie die Logik zum Erstellen einer neuen Regel in Ihrer Datenbank.
  // Achten Sie darauf, Felder wie _id, ruleId, createdAt, createdBy, aiGenerated, sourceDocumentId, lastAiUpdate etc. korrekt zu setzen.
  // const newRule = new RuleModel({ ...ruleData, createdBy: userId, createdAt: new Date(), ... });
  // await newRule.save();
  // return newRule.toObject(); 
  throw new Error('createRuleInDB function not implemented');
}

async function updateRuleInDB(existingRuleId: string | ObjectId, ruleData: Partial<Rule>, userId?: string): Promise<Rule | null> {
  console.log(`[DB Service] Updating AI-generated rule with ID: ${existingRuleId}`);
  // TODO: Implementieren Sie die Logik zum Aktualisieren einer bestehenden Regel.
  // Mergen Sie ruleData mit dem bestehenden Eintrag, aktualisieren Sie updatedAt, lastModifiedBy, lastAiUpdate, version etc.
  // Beispiel (Mongoose): 
  // const ruleToUpdate = await RuleModel.findById(existingRuleId);
  // if (!ruleToUpdate) return null;
  // Object.assign(ruleToUpdate, { ...ruleData, lastModifiedBy: userId, updatedAt: new Date(), lastAiUpdate: new Date(), version: (ruleToUpdate.version || 1) + 1 });
  // await ruleToUpdate.save();
  // return ruleToUpdate.toObject();
  throw new Error('updateRuleInDB function not implemented');
}

async function createRiskInDB(riskData: Partial<Risk>, userId?: string): Promise<Risk> {
  console.log(`[DB Service] Creating new AI-generated risk: "${riskData.title}"`);
  // TODO: Implementieren Sie die Logik analog zu createRuleInDB für Risiken.
  throw new Error('createRiskInDB function not implemented');
}

async function updateRiskInDB(existingRiskId: string | ObjectId, riskData: Partial<Risk>, userId?: string): Promise<Risk | null> {
  console.log(`[DB Service] Updating AI-generated risk with ID: ${existingRiskId}`);
  // TODO: Implementieren Sie die Logik analog zu updateRuleInDB für Risiken.
  throw new Error('updateRiskInDB function not implemented');
}

// --- ECHTE KI-SERVICE AUFRUFE mit OpenAI ---

async function fetchRuleSuggestionsFromRealAI(documentContent: string, documentName: string, docId: string | ObjectId): Promise<Array<Partial<Rule>>> {
  console.log(`[OpenAI Service] Fetching rule suggestions for document: ${documentName}`);
  const prompt = `
    Analysiere den folgenden Dokumenteninhalt und identifiziere potenzielle Compliance-Anforderungen oder Unternehmensregeln.
    Dokumentname: "${documentName}"
    Dokumenteninhalt:
    """
    ${documentContent}
    """

    Gib für jede identifizierte Regel die folgenden Informationen im JSON-Format zurück. Jede Regel soll ein separates JSON-Objekt in einem Array sein:
    [
      {
        "name": "Eindeutiger und prägnanter Regelname (max. 150 Zeichen)",
        "description": "Detaillierte Beschreibung der Regel, ihres Zwecks und der betroffenen Prozesse (max. 1000 Zeichen)",
        "category": "Kategorie der Regel (z.B. Datenschutz, IT-Sicherheit, Finanz-Compliance, Arbeitsrecht, Umweltvorschrift, Interne Unternehmensrichtlinie)",
        "priority": "Priorität der Regel ('Hoch', 'Mittel', 'Niedrig') basierend auf potenziellen Auswirkungen und Dringlichkeit",
        "status": "Entwurf",
        "tags": ["tag1", "tag2"]
      }
    ]
    Wenn keine Regeln gefunden werden, gib ein leeres Array zurück: [].
    Stelle sicher, dass die Ausgabe valides JSON ist und nur das JSON-Array enthält, ohne zusätzliche Erklärungen oder Formatierungen.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // Niedrigere Temperatur für präzisere, weniger kreative Antworten im JSON-Format
      // response_format: { type: "json_object" }, // Aktivieren, wenn Ihr Modell dies unterstützt und Sie sicherstellen wollen, dass die Ausgabe JSON ist.
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      console.warn('[OpenAI Service] Leere Antwort für Regelvorschläge erhalten.', {docId, documentName});
      return [];
    }

    let suggestions: Array<Partial<Rule>> = [];
    try {
      // Erwartung: OpenAI liefert direkt das JSON-Array als String
      suggestions = JSON.parse(rawResponse);
      if (!Array.isArray(suggestions)) {
        // Fallback, falls es in ein Objekt gewrappt ist
         if (typeof suggestions === 'object' && suggestions !== null) {
            const keyHoldingArray = Object.keys(suggestions).find(k => Array.isArray((suggestions as any)[k]));
            if (keyHoldingArray) {
                suggestions = (suggestions as any)[keyHoldingArray];
            } else {
                 console.warn('[OpenAI Service] Antwort für Regeln war valides JSON, aber kein Array und kein Objekt mit einem Array-Schlüssel. Antwort:', rawResponse);
                 return [];
            }
        } else {
            console.warn('[OpenAI Service] Antwort für Regeln war valides JSON, aber kein Array. Antwort:', rawResponse);
            return [];
        }
      }
    } catch (parseError) {
      console.error('[OpenAI Service] Fehler beim Parsen der Regelvorschläge von OpenAI:', parseError, "Raw Response:", rawResponse);
      // Versuch, Markdown-Code-Block zu entfernen, falls vorhanden
      const cleanedResponse = rawResponse.replace(/```json\n|```/g, '').trim();
      try {
        suggestions = JSON.parse(cleanedResponse);
         if (!Array.isArray(suggestions)) {
            // Fallback, falls es in ein Objekt gewrappt ist
            if (typeof suggestions === 'object' && suggestions !== null) {
                const keyHoldingArray = Object.keys(suggestions).find(k => Array.isArray((suggestions as any)[k]));
                if (keyHoldingArray) {
                    suggestions = (suggestions as any)[keyHoldingArray];
                } else {
                    console.warn('[OpenAI Service] Bereinigte Antwort für Regeln war valides JSON, aber kein Array und kein Objekt mit einem Array-Schlüssel. Antwort:', cleanedResponse);
                    return [];
                }
            } else {
                console.warn('[OpenAI Service] Bereinigte Antwort für Regeln war valides JSON, aber kein Array. Antwort:', cleanedResponse);
                return [];
            }
        }
      } catch (cleanedParseError) {
         console.error('[OpenAI Service] Fehler beim Parsen der bereinigten Regelvorschläge von OpenAI:', cleanedParseError, "Cleaned Response:", cleanedResponse);
         return []; // Keine Vorschläge, wenn Parsen fehlschlägt
      }
    }
    
    return suggestions.map(sugg => ({
      ...sugg,
      status: 'Entwurf', // Sicherstellen, dass Status immer Entwurf ist
      sourceDocumentId: docId.toString(),
      aiGenerated: true,
      lastAiUpdate: new Date(),
    }));

  } catch (error) {
    console.error('[OpenAI Service] Schwerwiegender Fehler beim Abrufen der Regelvorschläge von OpenAI:', error);
    // throw error; // Fehler weiterwerfen oder spezifisch behandeln
    return []; // Im Fehlerfall leeres Array zurückgeben, um Batch nicht komplett zu stoppen
  }
}

async function fetchRiskSuggestionsFromRealAI(documentContent: string, documentName: string, docId: string | ObjectId, rulesForContext?: Partial<Rule>[]): Promise<Array<Partial<Risk>>> {
  console.log(`[OpenAI Service] Fetching risk suggestions for document: ${documentName}`);
  
  let ruleContext = "";
  if (rulesForContext && rulesForContext.length > 0) {
    ruleContext = "Basierend auf den folgenden, zuvor für dieses Dokument identifizierten Regeln:\n";
    rulesForContext.forEach(rule => {
      ruleContext += `- Regel: "${rule.name}" (Beschreibung: ${rule.description})\n`;
    });
  }

  const prompt = `
    Analysiere den folgenden Dokumenteninhalt und die optional gegebenen Regeln. Identifiziere potenzielle Risiken, die sich aus der Nichterfüllung von Compliance-Anforderungen oder Unternehmensregeln ergeben könnten, die im Dokument impliziert oder explizit genannt werden.
    Dokumentname: "${documentName}"
    ${ruleContext}
    Dokumenteninhalt:
    """
    ${documentContent}
    """

    Gib für jedes identifizierte Risiko die folgenden Informationen im JSON-Format zurück. Jedes Risiko soll ein separates JSON-Objekt in einem Array sein:
    [
      {
        "title": "Eindeutiger und prägnanter Risikotitel (max. 150 Zeichen)",
        "description": "Detaillierte Beschreibung des Risikos, seiner Ursachen und potenziellen Auswirkungen (max. 1000 Zeichen)",
        "source": "KI-Analyse: ${documentName}",
        "category": "Risikokategorie (z.B. Finanziell, Operationell, Compliance, Strategisch, Reputation, IT)",
        "probability": "Wahrscheinlichkeit des Eintritts ('Hoch', 'Mittel', 'Niedrig')",
        "impact": "Auswirkung bei Eintritt ('Hoch', 'Mittel', 'Niedrig')",
        "status": "Offen", 
        "identifiedDate": "YYYY-MM-DD" // Aktuelles Datum
        // "linkedRuleIds": ["ruleId1", "ruleId2"] // Optional: IDs der Regeln, die dieses Risiko mitigieren könnten (falls bekannt)
      }
    ]
    Wenn keine Risiken gefunden werden, gib ein leeres Array zurück: [].
    Stelle sicher, dass die Ausgabe valides JSON ist und nur das JSON-Array enthält, ohne zusätzliche Erklärungen oder Formatierungen.
    Setze identifiedDate auf das aktuelle Datum im Format YYYY-MM-DD.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      // response_format: { type: "json_object" },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      console.warn('[OpenAI Service] Leere Antwort für Risikovorschläge erhalten.', {docId, documentName});
      return [];
    }
    
    let suggestions: Array<Partial<Risk>> = [];
    try {
      suggestions = JSON.parse(rawResponse);
       if (!Array.isArray(suggestions)) {
         if (typeof suggestions === 'object' && suggestions !== null) {
            const keyHoldingArray = Object.keys(suggestions).find(k => Array.isArray((suggestions as any)[k]));
            if (keyHoldingArray) {
                suggestions = (suggestions as any)[keyHoldingArray];
            } else {
                 console.warn('[OpenAI Service] Antwort für Risiken war valides JSON, aber kein Array und kein Objekt mit einem Array-Schlüssel. Antwort:', rawResponse);
                 return [];
            }
        } else {
            console.warn('[OpenAI Service] Antwort für Risiken war valides JSON, aber kein Array. Antwort:', rawResponse);
            return [];
        }
      }
    } catch (parseError) {
      console.error('[OpenAI Service] Fehler beim Parsen der Risikovorschläge von OpenAI:', parseError, "Raw Response:", rawResponse);
      const cleanedResponse = rawResponse.replace(/```json\n|```/g, '').trim();
      try {
        suggestions = JSON.parse(cleanedResponse);
        if (!Array.isArray(suggestions)) {
             if (typeof suggestions === 'object' && suggestions !== null) {
                const keyHoldingArray = Object.keys(suggestions).find(k => Array.isArray((suggestions as any)[k]));
                if (keyHoldingArray) {
                    suggestions = (suggestions as any)[keyHoldingArray];
                } else {
                    console.warn('[OpenAI Service] Bereinigte Antwort für Risiken war valides JSON, aber kein Array und kein Objekt mit einem Array-Schlüssel. Antwort:', cleanedResponse);
                    return [];
                }
            } else {
                console.warn('[OpenAI Service] Bereinigte Antwort für Risiken war valides JSON, aber kein Array. Antwort:', cleanedResponse);
                return [];
            }
        }
      } catch (cleanedParseError) {
         console.error('[OpenAI Service] Fehler beim Parsen der bereinigten Risikovorschläge von OpenAI:', cleanedParseError, "Cleaned Response:", cleanedResponse);
        return [];
      }
    }

    return suggestions.map(sugg => ({
      ...sugg,
      status: RiskStatus.OPEN, // Sicherstellen, dass Status immer Offen ist
      identifiedDate: sugg.identifiedDate || new Date().toISOString().split('T')[0], // Fallback für identifiedDate
      sourceDocumentId: docId.toString(),
      aiGenerated: true,
      lastAiUpdate: new Date(),
      // Map enums for probability and impact if OpenAI returns strings
      probability: sugg.probability ? (RiskProbability[sugg.probability.toUpperCase() as keyof typeof RiskProbability] || RiskProbability.LOW) : RiskProbability.LOW,
      impact: sugg.impact ? (RiskImpact[sugg.impact.toUpperCase() as keyof typeof RiskImpact] || RiskImpact.LOW) : RiskImpact.LOW,
    }));

  } catch (error) {
    console.error('[OpenAI Service] Schwerwiegender Fehler beim Abrufen der Risikovorschläge von OpenAI:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.sub || token?.id as string | undefined;

  if (!token) {
    return NextResponse.json({ error: 'Nicht autorisiert - kein Token' }, { status: 401 });
  }

  const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL];
  const userRole = token.role as UserRole;
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.error('[API batch-generate] Autorisierung fehlgeschlagen.', { userRole, allowedRoles });
    return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion.' }, { status: 403 });
  }

  let rulesProcessed = 0;
  let risksProcessed = 0;
  let errorsCount = 0;
  const processingSummary: string[] = [];

  try {
    const documents = await fetchAllDocumentsFromDB();
    if (!documents || documents.length === 0) {
      processingSummary.push('Keine Dokumente für die Verarbeitung gefunden.');
      return NextResponse.json({ message: 'Keine Dokumente gefunden.', rulesProcessed, risksProcessed, errorsCount, processingSummary });
    }
    processingSummary.push(`Starte Batch-Verarbeitung für ${documents.length} Dokument(e)...`);

    for (const doc of documents) {
      processingSummary.push(`--- Verarbeitung Dokument: ${doc.name} (ID: ${doc._id}) ---`);
      let ruleSuggestions: Partial<Rule>[] = []; // Für Kontext bei Risiken
      try {
        // Regeln verarbeiten mit echter KI und echter DB
        ruleSuggestions = await fetchRuleSuggestionsFromRealAI(doc.content, doc.name, doc._id);
        for (const ruleSugg of ruleSuggestions) {
          if (!ruleSugg.name) {
            processingSummary.push(`    [WARNUNG] Regelvorschlag ohne Namen übersprungen für Dokument ${doc._id}`);
            continue;
          }
          const existingRule = await findExistingRuleInDB(doc._id, ruleSugg.name);
          if (existingRule && existingRule._id) {
            await updateRuleInDB(existingRule._id, ruleSugg, userId);
            processingSummary.push(`    [OK] Regel aktualisiert: "${ruleSugg.name}"`);
          } else {
            await createRuleInDB(ruleSugg, userId);
            processingSummary.push(`    [OK] Regel erstellt: "${ruleSugg.name}"`);
          }
          rulesProcessed++;
        }

        // Risiken verarbeiten mit echter KI und echter DB
        const riskSuggestions = await fetchRiskSuggestionsFromRealAI(doc.content, doc.name, doc._id, ruleSuggestions);
        for (const riskSugg of riskSuggestions) {
          if (!riskSugg.title) {
            processingSummary.push(`    [WARNUNG] Risikovorschlag ohne Titel übersprungen für Dokument ${doc._id}`);
            continue;
          }
          const existingRisk = await findExistingRiskInDB(doc._id, riskSugg.title);
          if (existingRisk && existingRisk._id) {
            await updateRiskInDB(existingRisk._id.toString(), riskSugg, userId);
            processingSummary.push(`    [OK] Risiko aktualisiert: "${riskSugg.title}"`);
          } else {
            await createRiskInDB(riskSugg, userId);
            processingSummary.push(`    [OK] Risiko erstellt: "${riskSugg.title}"`);
          }
          risksProcessed++;
        }
      } catch (docError: any) {
        errorsCount++;
        processingSummary.push(`    [FEHLER] Bei der Verarbeitung von Dokument ${doc.name} (ID: ${doc._id}): ${docError.message}`);
        console.error(`Fehler bei Verarbeitung von Dokument ${doc._id} (Name: ${doc.name}):`, docError);
      }
    }
    processingSummary.push('Batch-Verarbeitung erfolgreich abgeschlossen.');
    return NextResponse.json({
      message: 'Batch-Verarbeitung abgeschlossen.',
      rulesProcessed,
      risksProcessed,
      errorsCount,
      processingSummary,
    });
  } catch (error: any) {
    console.error('Schwerer Fehler bei der Batch-Verarbeitung:', error);
    processingSummary.push(`Schwerer Fehler während des Batch-Laufs: ${error.message}`);
    return NextResponse.json({
      error: 'Schwerer Fehler bei der Batch-Verarbeitung',
      details: error.message,
      rulesProcessed,
      risksProcessed,
      errorsCount,
      processingSummary
    }, { status: 500 });
  }
}
