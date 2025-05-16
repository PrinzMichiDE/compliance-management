import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/authOptions';
import { UserRole } from '@/types/enums';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');

interface BatchDeleteRequestBody {
  documentIds: string[];
}

interface BatchDeleteResult {
  documentId: string;
  originalFilename?: string;
  status: 'success' | 'error' | 'not_found' | 'forbidden';
  error?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const userRoles = session.user.roles as UserRole[];
  // Admin oder Compliance Manager (Full) dürfen Batch-Löschungen durchführen
  const canPerformBatchDelete = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.COMPLIANCE_MANAGER_FULL);

  if (!canPerformBatchDelete) {
    return NextResponse.json({ error: 'Keine Berechtigung für Batch-Löschung.' }, { status: 403 });
  }

  try {
    const body = await req.json() as BatchDeleteRequestBody;
    const { documentIds } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Ein Array von documentIds ist erforderlich.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const results: BatchDeleteResult[] = [];

    for (const docId of documentIds) {
      if (!ObjectId.isValid(docId)) {
        results.push({ documentId: docId, status: 'error', error: 'Ungültige ID' });
        continue;
      }

      const docObjectId = new ObjectId(docId);
      const docToDelete = await db.collection('documents').findOne({ _id: docObjectId });

      if (!docToDelete) {
        results.push({ documentId: docId, status: 'not_found' });
        continue;
      }
      
      // Individuelle Berechtigungsprüfung pro Dokument (optional, alternativ globale Prüfung oben)
      // Für Batch könnte man argumentieren, dass die globale Prüfung ausreicht, wenn der ausführende User hohe Rechte hat.
      // Hier zur Sicherheit dennoch eine Prüfung, falls die globale nicht spezifisch genug ist.
      const allowedDeleteRoles: UserRole[] = docToDelete.accessControl?.editRoles || [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL];
      if (!userRoles.some(role => allowedDeleteRoles.includes(role))) {
          results.push({ documentId: docId, originalFilename: docToDelete.originalFilename, status: 'forbidden', error: 'Keine Löschberechtigung' });
          continue;
      }

      try {
        const storageFilePath = path.join(UPLOAD_DIR, docToDelete.filename);
        
        await db.collection('documents').deleteOne({ _id: docObjectId });
        await db.collection('documentVersions').deleteMany({ documentId: docObjectId });
        
        try {
          await fs.unlink(storageFilePath);
        } catch (fileError: any) {
          if (fileError.code !== 'ENOENT') {
            console.warn(`Konnte Datei ${storageFilePath} für Doc ID ${docId} nicht löschen, DB-Einträge wurden aber entfernt:`, fileError);
            // Man könnte entscheiden, dies als Teil-Erfolg oder Fehler im Result zu werten
          }
        }
        results.push({ documentId: docId, originalFilename: docToDelete.originalFilename, status: 'success' });
      } catch (deleteError: any) {
        console.error(`Fehler beim Löschen von Dokument ID ${docId}:`, deleteError);
        results.push({ documentId: docId, originalFilename: docToDelete.originalFilename, status: 'error', error: deleteError.message });
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Fehler bei der Batch-Lösch-Anfrage:', error);
    return NextResponse.json({ error: 'Serverfehler bei der Batch-Löschung.', details: error.message }, { status: 500 });
  }
} 