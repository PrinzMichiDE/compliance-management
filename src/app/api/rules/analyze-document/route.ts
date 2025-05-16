import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import qdrantClient from '@/lib/qdrant';
import { v4 as uuidv4 } from 'uuid';

// pdf-parse wird dynamisch importiert

export const runtime = 'nodejs';

const QDRANT_COLLECTION_NAME = 'document_embeddings';
const OPENAI_EMBEDDING_DIMENSION = 3072;

// Definiere eine Schnittstelle für die Punktstruktur, die an Qdrant gesendet wird
interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

async function ensureCollectionExists() {
  try {
    await qdrantClient.getCollection(QDRANT_COLLECTION_NAME);
    console.log(`Qdrant collection "${QDRANT_COLLECTION_NAME}" already exists.`);
  } catch (error: any) {
    console.log(`Qdrant collection "${QDRANT_COLLECTION_NAME}" does not exist. Attempting to create.`);
    await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
      vectors: {
        size: OPENAI_EMBEDDING_DIMENSION,
        distance: 'Cosine',
      },
    });
    console.log(`Qdrant collection "${QDRANT_COLLECTION_NAME}" created.`);
  }
}

function chunkTextByParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/) // Teilt bei einem oder mehreren Zeilenumbrüchen, gefolgt von optionalen Leerzeichen und einem weiteren Zeilenumbruch
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
}

async function extractTextFromFile(filePath: string, originalFileType: string): Promise<string> {
  if (originalFileType === 'text/plain') {
    console.log('Extracting text from plain text file.');
    return fs.readFile(filePath, { encoding: 'utf-8' });
  } else if (originalFileType === 'application/pdf') {
    console.log('Attempting to extract text from PDF file at path:', filePath);
    try {
      const pdf = (await import('pdf-parse')).default;
      const fileBuffer = await fs.readFile(filePath);
      const data = await pdf(fileBuffer);
      console.log('PDF parsing successful. Extracted text length:', data.text.length);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      if (error instanceof Error) {
        console.error('PDF Parsing Error Stack:', error.stack);
      }
      throw new Error(`Fehler beim Parsen der PDF-Datei: ${(error as Error).message}`);
    }
  } else if (originalFileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalFileType === 'application/msword') {
    console.warn('DOC/DOCX text extraction is still a placeholder.');
    return `[Simulierter extrahierter Text aus Datei am Pfad ${filePath}] Für DOCX ist eine Bibliothek wie mammoth.js nötig.`;
  }
  console.warn(`Unsupported file type for direct text extraction: ${originalFileType}. Falling back to raw text attempt.`);
  return fs.readFile(filePath, { encoding: 'utf-8' });
}

// Vereinfachte Antwortstruktur
interface DocumentAnalysisResponse {
  extractedText: string | null;
  processedChunks?: number;
  message?: string;
  documentLevelError?: string;      // Fehler, die das gesamte Dokument betreffen (z.B. Dateiverarbeitung)
  embeddingError?: string;          // Fehler spezifisch für den Embeddingprozess
}

interface AnalyzeRequestBody {
  filePath: string; 
  originalFileType: string;
  documentId: string;
}

export async function POST(request: NextRequest) {
  console.log('Verwendete QDRANT_URL:', process.env.QDRANT_URL);
  let documentText: string | null = null;
  let responseData: DocumentAnalysisResponse = { 
    extractedText: null, 
  };
  let absoluteFilePath: string | null = null; 
  let docId: ObjectId | null = null;

  try {
    const body = await request.json() as AnalyzeRequestBody;
    const { filePath, originalFileType, documentId } = body;

    if (!documentId || !ObjectId.isValid(documentId)) {
      responseData.documentLevelError = 'Gültige documentId ist erforderlich.';
      return NextResponse.json(responseData, { status: 400 });
    }
    docId = new ObjectId(documentId);

    // Status auf 'processing' setzen, sobald die Anfrage hier ankommt
    try {
      const client = await clientPromise;
      const db = client.db();
      await db.collection('documents').updateOne(
        { _id: docId }, 
        { $set: { embeddingStatus: 'processing', lastIndexedAt: new Date() } }
      );
      console.log(`Dokument ${docId.toString()} Status auf 'processing' gesetzt.`);
    } catch (dbError) {
      // Fehler beim Setzen auf 'processing' sollte geloggt werden, aber die Analyse nicht unbedingt stoppen.
      console.error(`Fehler beim Setzen des Dokumentenstatus auf 'processing' für ${docId.toString()}:`, dbError);
    }

    if (!filePath || !originalFileType) {
      responseData.documentLevelError = 'Fehlender Dateipfad oder Dateityp im Request-Body.';
      return NextResponse.json(responseData, { status: 400 });
    }

    absoluteFilePath = path.resolve(process.cwd(), filePath);
    console.log(`Verarbeite Datei unter: ${absoluteFilePath}`);

    try {
      await fs.access(absoluteFilePath);
    } catch (e) {
      console.error(`Datei nicht gefunden unter: ${absoluteFilePath}`, e);
      responseData.documentLevelError = `Die angeforderte Datei wurde nicht gefunden: ${filePath}`;
      return NextResponse.json(responseData, { status: 404 });
    }

    try {
        documentText = await extractTextFromFile(absoluteFilePath, originalFileType);
        responseData.extractedText = documentText;
        console.log('Extrahierter documentText:', JSON.stringify(documentText));
        console.log('documentText.trim():', JSON.stringify(documentText?.trim()));
    } catch (error) {
        console.error('Fehler beim Extrahieren von Text aus der Datei:', error);
        responseData.documentLevelError = `Fehler beim Verarbeiten der Datei: ${(error as Error).message}`;
        // Status auf failed setzen, wenn Text-Extraktion fehlschlägt
        if (docId) {
            try {
                const client = await clientPromise;
                const db = client.db();
                await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'failed', lastIndexedAt: new Date() } });
            } catch (dbUpdateError) {
                console.error('Fehler beim Setzen des Status auf FAILED nach Text-Extraktionsfehler:', dbUpdateError);
            }
        }
        return NextResponse.json(responseData, { status: 500 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const customEndpointUrl = process.env.OPENAI_CUSTOM_ENDPOINT_URL;
    const embeddingModelName = process.env.OPENAI_EMBEDDING_MODEL_NAME;

    if (!apiKey) {
      responseData.embeddingError = 'OpenAI API Key nicht konfiguriert für Embedding.';
    }

    if (apiKey && customEndpointUrl && embeddingModelName && documentText) {
      try {
        await ensureCollectionExists();
        console.log('documentText vor Chunking:', JSON.stringify(documentText));
        console.log('documentText.trim().length vor Chunking:', documentText?.trim().length);

        let chunks = chunkTextByParagraphs(documentText);
        
        if (chunks.length === 0 && documentText.trim().length > 0) {
          console.warn('Keine Paragraphen-Chunks gefunden. Verwende gesamten Text als einen Chunk.');
          chunks = [documentText.trim()];
        } else if (chunks.length === 0) {
          console.error('Fehlerhafter Zustand: chunks.length ist 0. documentText:', JSON.stringify(documentText), 'documentText.trim():', JSON.stringify(documentText.trim()));
          throw new Error('Dokumententext konnte nicht in Chunks aufgeteilt werden oder ist nach dem Trimmen leer.');
        }
        console.log(`Dokument in ${chunks.length} Chunks aufgeteilt.`);

        const pointsToUpsert: QdrantPoint[] = [];
        const fullEmbeddingEndpointUrl = customEndpointUrl.endsWith('/') ? `${customEndpointUrl}v1/embeddings` : `${customEndpointUrl}/v1/embeddings`;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          // Zusätzlicher Check, um leere Chunks zu überspringen (sollte durch trim() schon minimiert sein)
          if (chunk.length === 0) {
            console.log(`Überspringe leeren Chunk ${i + 1}/${chunks.length}.`);
            continue;
          }
          console.log(`Verarbeite Chunk ${i + 1}/${chunks.length}... (Länge: ${chunk.length})`);
          const embeddingRequestBody = { input: chunk, model: embeddingModelName };
          const embeddingResponse = await fetch(fullEmbeddingEndpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(embeddingRequestBody),
          });

          if (!embeddingResponse.ok) {
            const errorText = await embeddingResponse.text();
            throw new Error(`Fehler vom OpenAI Service für Chunk ${i + 1}: ${embeddingResponse.status} ${errorText}`);
          }
          const embeddingData = await embeddingResponse.json();
          if (embeddingData.data && embeddingData.data[0] && embeddingData.data[0].embedding) {
            const embeddingVector = embeddingData.data[0].embedding as number[];
            pointsToUpsert.push({
              id: uuidv4(), 
              vector: embeddingVector,
              payload: {
                documentId: docId.toString(),
                chunkSequence: i,
                text: chunk, 
                originalFileType: originalFileType,
              },
            });
          } else {
            throw new Error(`Ungültiges Format der Embedding-Antwort für Chunk ${i + 1}.`);
          }
        }
        
        if (pointsToUpsert.length === 0 && chunks.length > 0) {
            // Dieser Fall tritt ein, wenn alle Chunks leer waren und übersprungen wurden.
            console.warn("Keine gültigen Chunks zum Indexieren nach dem Filtern leerer Chunks gefunden.");
            // Man könnte hier den Status auf 'failed' setzen oder als 'completed' ohne Embeddings betrachten.
            // Fürs Erste setzen wir es als eine Art Fehler, da keine Embeddings erstellt wurden.
            responseData.embeddingError = "Keine indexierbaren Text-Chunks nach Filterung gefunden.";
            throw new Error(responseData.embeddingError);
        }

        if (pointsToUpsert.length > 0) {
          console.log(`Versuche ${pointsToUpsert.length} Punkt(e) in Qdrant Collection "${QDRANT_COLLECTION_NAME}" einzufügen.`);
          await qdrantClient.upsert(QDRANT_COLLECTION_NAME, { points: pointsToUpsert });
          console.log('Punkte erfolgreich in Qdrant gespeichert.');
          responseData.processedChunks = pointsToUpsert.length;
        }

        if (docId) {
          const clientDB = await clientPromise;
          const db = clientDB.db();
          await db.collection('documents').updateOne(
            { _id: docId }, 
            { $set: { 
                embeddingStatus: 'completed', 
                lastIndexedAt: new Date(),
              } 
            }
          );
          responseData.message = `Text extrahiert und ${pointsToUpsert.length} Chunks erfolgreich in Qdrant gespeichert.`;
        }
      } catch (e: any) {
        console.error('Fehler bei der Embedding-Erstellung oder Qdrant-Speicherung:', e);
        if (e.status && e.data) {
          console.error('Qdrant Error Status:', e.status);
          console.error('Qdrant Error Data:', JSON.stringify(e.data, null, 2)); 
          responseData.embeddingError = `Qdrant Error ${e.status}: ${JSON.stringify(e.data)}`;
        } else {
          responseData.embeddingError = (e as Error).message;
        }
        
        if (docId) {
          const client = await clientPromise;
          const db = client.db();
          await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'failed', lastIndexedAt: new Date() } });
        }
      }
    } else if (!responseData.embeddingError && documentText) { 
        let missingConfig = 'Fehlende Konfiguration für Embedding Erstellung:';
        if (!customEndpointUrl) missingConfig += ' OPENAI_CUSTOM_ENDPOINT_URL';
        else if (!embeddingModelName) missingConfig += ' OPENAI_EMBEDDING_MODEL_NAME';
        console.warn(missingConfig);
        responseData.embeddingError = missingConfig;
        if (docId && apiKey) {
            const client = await clientPromise;
            const db = client.db();
            await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'failed', lastIndexedAt: new Date() } });
        }
    } else if (!documentText) {
        responseData.embeddingError = "Kein Dokumententext für Embedding vorhanden.";
        if (docId) {
            const client = await clientPromise;
            const db = client.db();
            await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'failed', lastIndexedAt: new Date() } });
        }
    }
    
    if (responseData.extractedText && !responseData.processedChunks && !responseData.embeddingError && !responseData.message) {
        responseData.message = "Text erfolgreich extrahiert. Embeddings wurden nicht erstellt oder gespeichert (siehe Konfiguration oder Fehlerlogs).";
        if (docId && !responseData.documentLevelError) {
            const client = await clientPromise;
            const db = client.db();
            const currentDoc = await db.collection('documents').findOne({ _id: docId });
            if (currentDoc && currentDoc.embeddingStatus !== 'failed') {
                 await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'pending', lastIndexedAt: new Date() } });
            }
        }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Schwerwiegender Fehler im analyze-document Endpunkt:', error);
    const finalResponseData: DocumentAnalysisResponse = responseData || { extractedText: null };
    finalResponseData.documentLevelError = finalResponseData.documentLevelError || `Allgemeiner Fehler: ${(error as Error).message}`;
    if (docId) {
      try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection('documents').updateOne({ _id: docId }, { $set: { embeddingStatus: 'failed', lastIndexedAt: new Date() } });
      } catch (dbError) {
        console.error("Fehler beim DB-Update im Catch-Block des Analyze-Endpunkts:", dbError);
      }
    }
    return NextResponse.json(finalResponseData, { status: 500 });
  } 
} 