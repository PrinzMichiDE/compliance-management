import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OpenAI } from 'openai';
import clientPromise from '@/lib/mongodb';
import qdrantClient from '@/lib/qdrant';
import { authOptions } from '@/lib/authOptions';
import { UserRole } from '@/types/enums';
import { Document as BSONDocument, ObjectId } from 'mongodb';


export const runtime = 'nodejs';

const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL_NAME = process.env.OPENAI_EMBEDDING_MODEL_NAME || 'text-embedding-ada-002';
const OPENAI_CUSTOM_ENDPOINT_URL = process.env.OPENAI_CUSTOM_ENDPOINT_URL; // Kann null oder undefined sein

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY ist nicht gesetzt. Die semantische Suche wird möglicherweise nicht funktionieren.');
}

const openai = OPENAI_CUSTOM_ENDPOINT_URL ?
  new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_CUSTOM_ENDPOINT_URL }) :
  new OpenAI({ apiKey: OPENAI_API_KEY });

interface SearchRequestBody {
  query: string;
  topK?: number; // Anzahl der zu suchenden Vektoren
  minSimilarity?: number; // Minimale Ähnlichkeitsschwelle
}

// Angepasstes Interface für die Frontend-Anzeige
interface DocumentForFrontend {
  _id: string;
  name: string; // originalFilename
  size: number;
  lastModified: string; // createdAt als ISO String
  fileType: string;
  storageFilename: string; // Der eindeutige Name der Datei im Storage (aus doc.filename)
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  status?: 'draft' | 'inReview' | 'approved' | 'rejected';
  // Eventuell Score oder Relevanz hinzufügen, wenn vom Frontend benötigt
  searchScore?: number;
}


async function getEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API Key nicht konfiguriert.');
  }
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL_NAME,
      input: text.replace(/\n/g, ' '), // OpenAI Empfehlung
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Fehler beim Erstellen des Embeddings:", error);
    throw new Error("Fehler beim Erstellen des Embeddings über OpenAI.");
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const userRoles = session.user.roles as UserRole[];

  try {
    const body: SearchRequestBody = await req.json();
    const { query, topK = 10, minSimilarity = 0.3 } = body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json({ error: 'Suchanfrage (query) ist erforderlich und darf nicht leer sein.' }, { status: 400 });
    }

    // 1. Embedding für die Suchanfrage generieren
    const queryEmbedding = await getEmbedding(query);

    // 2. Ähnlichkeitssuche in Qdrant durchführen
    console.log(`[Search API] Suche in Qdrant mit topK=${topK} für Query: "${query}"`);
    const searchResult = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true, // Sicherstellen, dass Payload (inkl. documentId) mitkommt
      // score_threshold: minSimilarity, // Aktivieren, wenn Qdrant Client dies unterstützt und gewünscht ist
    });
    
    console.log('[Search API] Roh-Ergebnis von Qdrant:', JSON.stringify(searchResult, null, 2));

    const relevantDocumentIdsWithScores: { id: string; score: number }[] = [];
    const uniqueDocumentIds = new Set<string>();

    for (const hit of searchResult) {
      if (hit.payload && typeof hit.payload.documentId === 'string' && hit.score >= minSimilarity) {
        if (!uniqueDocumentIds.has(hit.payload.documentId)) {
          relevantDocumentIdsWithScores.push({ id: hit.payload.documentId, score: hit.score });
          uniqueDocumentIds.add(hit.payload.documentId);
        }
      }
    }
    
    console.log('[Search API] Relevante Document IDs nach Score-Filterung:', JSON.stringify(relevantDocumentIdsWithScores, null, 2));

    if (relevantDocumentIdsWithScores.length === 0) {
      console.log('[Search API] Keine Dokumente nach Score-Filterung. minSimilarity war', minSimilarity);
      return NextResponse.json({ documents: [], message: 'Keine relevanten Dokumente gefunden (nach Score-Filterung).' });
    }

    // IDs in ObjectId umwandeln für MongoDB-Abfrage
    const objectIdsToFetch = relevantDocumentIdsWithScores.map(item => new ObjectId(item.id));

    // 3. Metadaten der gefundenen Dokumente aus MongoDB abrufen
    const client = await clientPromise;
    const db = client.db();

    const mongoQuery: BSONDocument = {
      _id: { $in: objectIdsToFetch },
      'accessControl.viewRoles': { $in: userRoles } // Berechtigungsprüfung
    };
    
    const documentsFromDb = await db.collection('documents').find(mongoQuery).toArray();
    console.log('[Search API] Von MongoDB abgerufene Dokumente (Anzahl):', documentsFromDb.length);
    // Optional: Logge die ersten paar Dokumentnamen, um zu sehen, was gefunden wurde
    if (documentsFromDb.length > 0) {
      console.log('[Search API] Erste MongoDB-Dokumente (IDs):', documentsFromDb.slice(0, 3).map(d => d._id.toString()));
    }

    // Dokumente mit Scores anreichern und für das Frontend formatieren
    const documentsForFrontend: DocumentForFrontend[] = documentsFromDb.map(doc => {
      const docIdString = (doc._id as ObjectId).toString();
      const qdrantHit = relevantDocumentIdsWithScores.find(item => item.id === docIdString);
      return {
        _id: docIdString,
        name: doc.originalFilename as string,
        size: doc.size as number,
        lastModified: (doc.createdAt as Date).toISOString(),
        fileType: doc.fileType as string,
        storageFilename: doc.filename as string, // storageFilename aus MongoDB (ist der UUID-Name)
        embeddingStatus: doc.embeddingStatus as 'pending' | 'processing' | 'completed' | 'failed',
        status: doc.status as 'draft' | 'inReview' | 'approved' | 'rejected' | undefined,
        searchScore: qdrantHit ? qdrantHit.score : undefined,
      };
    }).sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0)); // Nach Score sortieren


    return NextResponse.json({ documents: documentsForFrontend });

  } catch (error: any) {
    console.error('Fehler bei der semantischen Suche:', error);
    if (error.message.includes("OpenAI")) {
        return NextResponse.json({ error: `Fehler bei der Kommunikation mit OpenAI: ${error.message}` }, { status: 502 }); // Bad Gateway
    }
    return NextResponse.json({ error: `Serverfehler bei der semantischen Suche: ${error.message}` }, { status: 500 });
  }
} 