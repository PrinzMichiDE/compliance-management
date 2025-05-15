import { NextRequest, NextResponse } from 'next/server';
import { Rule } from '@/types/rule';
// pdf-parse wird jetzt dynamisch importiert, wenn benötigt
// import pdf from 'pdf-parse'; 

export const runtime = 'nodejs'; // Stellt sicher, dass die Route in der Node.js-Umgebung läuft

// Helper function to attempt to extract text from various file types
// IMPORTANT: This is a very basic implementation. For robust PDF/DOCX extraction, 
// you'll likely need server-side libraries like 'pdf-parse' for PDFs or 'mammoth' for DOCX.
// These cannot be installed/run directly in this environment, so this is a placeholder.
async function extractTextFromFile(file: File): Promise<string> {
  const anaylseFile = file as any;
  if (file.type === 'text/plain') {
    console.log('Extracting text from plain text file.');
    return file.text();
  } else if (file.type === 'application/pdf') {
    console.log('Attempting to extract text from PDF file.');
    console.log('Received file details for PDF processing:', { name: file.name, size: file.size, type: file.type });
    try {
      const pdf = (await import('pdf-parse')).default;
      const fileBuffer = Buffer.from(await anaylseFile.arrayBuffer());
      // Optionen für pdf-parse können hier übergeben werden, falls nötig
      // const options = { // Beispieloptionen
      //   max: 10, // maximale Anzahl der zu lesenden Seiten
      // };
      const data = await pdf(fileBuffer /*, options */);
      console.log('PDF parsing successful. Extracted text length:', data.text.length);
      return data.text; // data.text enthält den extrahierten Text
    } catch (error) {
      console.error('Error parsing PDF:', error);
      if (error instanceof Error) {
        console.error('PDF Parsing Error Stack:', error.stack);
      }
      throw new Error(`Fehler beim Parsen der PDF-Datei: ${(error as Error).message}`);
    }
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/msword') {
    // Für DOCX würden Sie eine ähnliche Logik mit einer Bibliothek wie 'mammoth' implementieren
    // z.B. npm install mammoth
    // import mammoth from 'mammoth';
    // const arrayBuffer = await anaylseFile.arrayBuffer();
    // const { value } = await mammoth.extractRawText({ arrayBuffer });
    // return value;
    console.warn('DOC/DOCX text extraction is still a placeholder. Consider implementing with a library like mammoth.js.');
    return `[Simulierter extrahierter Text aus ${file.name}] Für DOCX ist eine Bibliothek wie mammoth.js nötig.`;
  }
  console.warn(`Unsupported file type for direct text extraction: ${file.type}. Falling back to raw text attempt.`);
  return file.text(); // Fallback, might be garbled for binary files
}

// Definiert die Struktur für eine einzelne analysierte Regel
interface SingleRuleAnalysis {
  extractedFields: Partial<Rule>; // Die extrahierten Felder für diese eine Regel
  // Optional: embedding?: number[]; // Falls wir später pro Regel Embeddings wollen
}

// Definiert die Gesamtantwort des Analyse-Endpunkts
interface DocumentAnalysisResponse {
  analyzedRules: SingleRuleAnalysis[]; // Array der erkannten Regeln
  documentEmbedding: number[] | null;  // Embedding für das gesamte Dokument
  documentLevelError?: string;      // Fehler, die das gesamte Dokument betreffen (z.B. Dateiverarbeitung)
  extractionError?: string;         // Fehler spezifisch für den Datenextraktionsprozess
  embeddingError?: string;          // Fehler spezifisch für den Embeddingprozess
}

export async function POST(request: NextRequest) {
  let documentText = '';
  // Initialisiert die Antwortstruktur
  let responseData: DocumentAnalysisResponse = { 
    analyzedRules: [], 
    documentEmbedding: null 
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      responseData.documentLevelError = 'Keine Datei hochgeladen.';
      return NextResponse.json(responseData, { status: 400 });
    }

    try {
        documentText = await extractTextFromFile(file);
    } catch (error) {
        console.error('Fehler beim Extrahieren von Text aus der Datei:', error);
        responseData.documentLevelError = `Fehler beim Verarbeiten der Datei: ${(error as Error).message}`;
        return NextResponse.json(responseData, { status: 500 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const customEndpointUrl = process.env.OPENAI_CUSTOM_ENDPOINT_URL;
    const extractionModelName = process.env.OPENAI_MODEL_NAME;
    const embeddingModelName = process.env.OPENAI_EMBEDDING_MODEL_NAME;

    if (!apiKey) {
      console.error('OPENAI_API_KEY nicht konfiguriert.');
      // Dieser Fehler betrifft beide Prozesse
      responseData.extractionError = 'OpenAI API Key nicht konfiguriert für Extraktion.';
      responseData.embeddingError = 'OpenAI API Key nicht konfiguriert für Embedding.';
    }

    // 1. Strukturierte Datenextraktion (jetzt eine Liste von Regeln erwartend)
    if (apiKey && customEndpointUrl && extractionModelName && documentText) {
      try {
        const fullCustomEndpointUrl = customEndpointUrl.endsWith('/') ? `${customEndpointUrl}v1/chat/completions` : `${customEndpointUrl}/v1/chat/completions`;
        console.log(`Sende Extraktions-Anfrage (erwarte Liste) an: ${fullCustomEndpointUrl} mit Modell: ${extractionModelName}`);
        
        const expectedFieldsString = JSON.stringify(['ruleId', 'name', 'description', 'category', 'status', 'priority', 'targetAudience', 'linkedDocuments', 'tags', 'validFrom', 'validTo']);
        // ANGEPASSTER SYSTEM PROMPT:
        const systemPrompt = `Du bist eine KI zur Analyse von regulatorischen Dokumenten. Extrahiere ALLE Regeln, die du im folgenden Text findest. Gib eine JSON-LISTE (Array) von Regelobjekten zurück. JEDES Objekt in der Liste sollte die Felder aus dieser Vorlage haben: ${expectedFieldsString}. Die Felder targetAudience, linkedDocuments und tags sollten Arrays von Strings sein. Die Datumsfelder validFrom und validTo sollten im Format YYYY-MM-DD sein. Wenn eine Information für ein Feld nicht im Text gefunden wird, lasse das Feld im JSON weg oder setze es auf null oder einen leeren String/Array. Wenn keine Regeln gefunden werden, gib eine leere Liste [] zurück.`;
        const userPrompt = `Bitte extrahiere alle Regel-Informationen aus dem folgenden Dokumententext:\n\n---\n${documentText}\n---`;

        const extractionRequestBody = {
          model: extractionModelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" } 
        };

        const extractionResponse = await fetch(fullCustomEndpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(extractionRequestBody),
        });

        if (!extractionResponse.ok) {
          const errorText = await extractionResponse.text();
          throw new Error(`Fehler vom Custom OpenAI Service (Extraktion): ${extractionResponse.status} ${errorText}`);
        }
        
        // Erwarte nun potenziell ein Objekt, das ein Array von Regeln enthält (abhängig von der KI und ob response_format: { type: "json_object" } immer ein Top-Level-Objekt erzwingt)
        // Oder direkt ein Array. Wir müssen flexibel sein oder die KI präziser anweisen.
        // Annahme: Die KI gibt ein Objekt zurück, das ein Feld enthält, welches das Array der Regeln ist, ODER direkt das Array.
        // z.B. { "rules": [...] } oder direkt [...] 
        const extractionResult = await extractionResponse.json();
        let extractedRulesArray: Partial<Rule>[] = [];

        if (Array.isArray(extractionResult)) {
            extractedRulesArray = extractionResult;
        } else if (extractionResult && typeof extractionResult === 'object' && extractionResult.rules && Array.isArray(extractionResult.rules)) {
            extractedRulesArray = extractionResult.rules;
        } else if (extractionResult && typeof extractionResult === 'object') {
            // Fallback: Wenn es ein einzelnes Objekt ist, behandeln wir es als eine einzelne Regel in einem Array
            // Dies ist nützlich, wenn die KI trotz Anweisung nur ein Objekt liefert.
            console.warn('KI-Antwort für Extraktion war ein einzelnes Objekt, erwartet wurde ein Array oder ein Objekt mit einem "rules"-Array. Behandle als einzelne Regel.');
            extractedRulesArray = [extractionResult as Partial<Rule>]; 
        } else {
            console.warn('Unerwartetes Format von der Extraktions-KI erhalten:', extractionResult);
            throw new Error('Unerwartetes Format von der Extraktions-KI erhalten.');
        }
        
        responseData.analyzedRules = extractedRulesArray.map(ruleFields => ({ extractedFields: ruleFields }));

      } catch (e) {
        console.error('Fehler bei der Datenextraktion:', e);
        responseData.extractionError = (e as Error).message;
      }
    } else if (!responseData.extractionError) { // Nur setzen, wenn nicht schon durch fehlenden API Key gesetzt
      let missingConfig = 'Fehlende Konfiguration für Datenextraktion:';
      if (!customEndpointUrl) missingConfig += ' OPENAI_CUSTOM_ENDPOINT_URL';
      if (!extractionModelName) missingConfig += ' OPENAI_MODEL_NAME';
      if (!documentText) missingConfig += ' Kein Dokumententext extrahiert';
      console.warn(missingConfig);
      responseData.extractionError = missingConfig;
    }

    // 2. Embedding-Erstellung für das gesamte Dokument (bleibt wie zuvor)
    if (apiKey && embeddingModelName && documentText) {
      try {
        const fullEmbeddingEndpointUrl = customEndpointUrl.endsWith('/') ? `${customEndpointUrl}v1/embeddings` : `${customEndpointUrl}/v1/embeddings`; // Wiederverwendung customEndpointUrl
        console.log(`Sende Embedding-Anfrage an Custom Endpoint: ${fullEmbeddingEndpointUrl} mit Modell: ${embeddingModelName}`);
        
        const embeddingRequestBody = { input: documentText, model: embeddingModelName };
        const embeddingResponse = await fetch(fullEmbeddingEndpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(embeddingRequestBody),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          throw new Error(`Fehler vom Custom OpenAI Service (Embedding): ${embeddingResponse.status} ${errorText}`);
        }
        const embeddingData = await embeddingResponse.json();
        if (embeddingData.data && embeddingData.data[0] && embeddingData.data[0].embedding) {
          responseData.documentEmbedding = embeddingData.data[0].embedding;
        } else {
          throw new Error('Ungültiges Format der Embedding-Antwort.');
        }
      } catch (e) {
        console.error('Fehler bei der Embedding-Erstellung:', e);
        responseData.embeddingError = (e as Error).message;
      }
    } else if (!responseData.embeddingError) { // Nur setzen, wenn nicht schon durch fehlenden API Key gesetzt
        let missingConfig = 'Fehlende Konfiguration für Embedding Erstellung:';
        if (!customEndpointUrl && !process.env.OPENAI_API_KEY) missingConfig += ' (Custom Endpoint URL für Embedding nicht konfiguriert oder API Key fehlt)';
        else if (!embeddingModelName) missingConfig += ' OPENAI_EMBEDDING_MODEL_NAME';
        if (!documentText) missingConfig += ' Kein Dokumententext extrahiert';
        console.warn(missingConfig);
        responseData.embeddingError = missingConfig;
    }
    
    // Erfolgreiche Antwort, auch wenn Teile fehlgeschlagen sind (Fehlerdetails sind in der Antwort)
    return NextResponse.json(responseData);

  } catch (error) { // Catch für generelle Fehler im äußeren try-Block
    console.error('Schwerwiegender Fehler im analyze-document Endpunkt:', error);
    // Stellen Sie sicher, dass responseData initialisiert ist, auch wenn der Fehler früh auftritt
    const finalResponseData: DocumentAnalysisResponse = responseData || { analyzedRules: [], documentEmbedding: null };
    finalResponseData.documentLevelError = finalResponseData.documentLevelError || `Allgemeiner Fehler: ${(error as Error).message}`;
    return NextResponse.json(finalResponseData, { status: 500 });
  }
} 