import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/authOptions';
import { UserRole } from '@/types/enums';
import qdrantClient from '@/lib/qdrant'; // Qdrant Client importieren

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');
const QDRANT_COLLECTION_NAME = 'document_embeddings';

interface BatchDeleteBody {
  documentIds: string[];
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const userRoles = session.user.roles as UserRole[];

  try {
    const body = await req.json() as BatchDeleteBody;
    const { documentIds } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Ein Array von documentIds ist erforderlich' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    let deletedCount = 0;
    const errors: { documentId: string, error: string }[] = [];

    for (const docIdString of documentIds) {
      if (!ObjectId.isValid(docIdString)) {
        errors.push({ documentId: docIdString, error: 'Ungültige ID' });
        continue;
      }
      const docId = new ObjectId(docIdString);

      const docToDelete = await db.collection('documents').findOne({ _id: docId });

      if (!docToDelete) {
        errors.push({ documentId: docIdString, error: 'Dokument nicht gefunden' });
        continue;
      }

      // Rollenbasierte Berechtigungsprüfung für das Löschen
      const allowedDeleteRoles: UserRole[] = docToDelete.accessControl?.editRoles || [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL];
      if (!userRoles.some(role => allowedDeleteRoles.includes(role))) {
        errors.push({ documentId: docIdString, error: 'Keine Berechtigung zum Löschen' });
        continue;
      }

      // 1. Dokument aus der DB löschen
      await db.collection('documents').deleteOne({ _id: docId });

      // 2. Zugehörige Versionen aus der DB löschen
      await db.collection('documentVersions').deleteMany({ documentId: docId });

      // 3. Datei aus dem Dateisystem löschen
      if (docToDelete.filename) {
        const storageFilePath = path.join(UPLOAD_DIR, docToDelete.filename);
        try {
          await fs.unlink(storageFilePath);
        } catch (fileError: any) {
          if (fileError.code !== 'ENOENT') {
            console.warn(`Konnte Datei ${storageFilePath} für Dokument ${docIdString} nicht löschen, DB-Einträge wurden aber entfernt:`, fileError);
            // Optional: Fehler hier sammeln, aber nicht den gesamten Batch-Prozess abbrechen
          }
        }
      }
      
      // 4. Zugehörige Embeddings aus Qdrant löschen
      try {
        // Lösche alle Punkte, deren Payload documentId mit der aktuellen docIdString übereinstimmt
        // Qdrant erwartet, dass Filterbedingungen in einem `must`, `should` oder `must_not` Array liegen.
        await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
          points: [], // Nicht verwendet, wenn Filter aktiv ist
          filter: {
            must: [
              {
                key: 'documentId', // Payload-Feld
                match: { value: docIdString } // Exakter Abgleich
              }
            ]
          }
        });
        console.log(`Embeddings für documentId ${docIdString} aus Qdrant gelöscht.`);
      } catch (qdrantError: any) {
        console.error(`Fehler beim Löschen der Embeddings für documentId ${docIdString} aus Qdrant:`, qdrantError);
        errors.push({ documentId: docIdString, error: `Qdrant Löschfehler: ${qdrantError.message || 'Unbekannter Fehler'}` });
        // Hier entscheiden, ob der Fehler das erfolgreiche Löschen des Dokuments ungültig macht
        // Fürs Erste fahren wir fort, aber loggen den Qdrant-Fehler.
      }

      deletedCount++;
    }

    let message = `${deletedCount} Dokument(e) erfolgreich gelöscht.`;
    if (errors.length > 0) {
      message += ` ${errors.length} Dokument(e) konnten nicht gelöscht werden oder hatten Fehler beim Löschen von Embeddings.`
      console.warn('Fehler beim Batch-Löschen:', errors);
    }

    return NextResponse.json({ message, deletedCount, errors });

  } catch (error: any) {
    console.error('Schwerwiegender Fehler beim Batch-Löschen:', error);
    return NextResponse.json({ error: `Allgemeiner Fehler: ${error.message || 'Unbekannter Fehler'}` }, { status: 500 });
  }
} 