import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import clientPromise from '@/lib/mongodb';
import { ObjectId, Filter, Document as BSONDocument } from 'mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/authOptions'; // Pfad anpassen, falls nötig
import { UserRole } from '@/types/enums'; // Pfad anpassen, falls nötig

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');

// Funktion zum sicheren Erstellen des Upload-Verzeichnisses, falls es nicht existiert
async function ensureUploadDirExists() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch (e) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log(`Upload-Verzeichnis erstellt: ${UPLOAD_DIR}`);
  }
}

// Typ für die Frontend-Anzeige, ggf. anpassen
interface DocumentForFrontend {
  _id: string; // Als String für Frontend
  name: string; // originalFilename
  size: number;
  lastModified: string; // createdAt als ISO String
  fileType: string;
  storageFilename: string; // Der eindeutige Name der Datei im Storage (aus doc.filename)
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed'; // Hinzugefügt
  status?: 'draft' | 'inReview' | 'approved' | 'rejected'; // Status hinzugefügt für Frontend
  // Weitere Felder bei Bedarf
}

// GET /api/documents - Alle Dokumente auflisten
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const userRoles = session.user.roles as UserRole[];

  try {
    const client = await clientPromise;
    const db = client.db();

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get('status');
    const filterFileType = searchParams.get('fileType');
    const filterDateFrom = searchParams.get('dateFrom');
    const filterDateTo = searchParams.get('dateTo');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    const sortOrder = sortOrderParam === 'asc' ? 1 : -1;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const query: Filter<BSONDocument> = {
      'accessControl.viewRoles': { $in: userRoles }
    };

    if (filterStatus && filterStatus !== 'all') {
      query.status = filterStatus;
    }
    if (filterFileType && filterFileType !== 'all') {
      query.fileType = filterFileType;
    }
    if (filterDateFrom) {
      query.createdAt = { ...(query.createdAt || {}), $gte: new Date(filterDateFrom) };
    }
    if (filterDateTo) {
      const dateTo = new Date(filterDateTo);
      dateTo.setHours(23, 59, 59, 999);
      query.createdAt = { ...(query.createdAt || {}), $lte: dateTo };
    }
    
    const sortOptions: { [key: string]: 1 | -1 } = {};
    const allowedSortByFields = ['originalFilename', 'createdAt', 'size', 'fileType', 'status'];
    if (allowedSortByFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder;
    } else {
      sortOptions['createdAt'] = -1;
    }
    if (sortBy === 'originalFilename' && !sortOptions.createdAt) {
        sortOptions.createdAt = -1; 
    }

    const totalDocuments = await db.collection('documents').countDocuments(query);

    const documentsFromDb = await db.collection('documents')
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    const documentsForFrontend: DocumentForFrontend[] = documentsFromDb.map(doc => ({
      _id: (doc._id as ObjectId).toString(),
      name: doc.originalFilename as string,
      size: doc.size as number,
      lastModified: (doc.createdAt as Date).toISOString(), 
      fileType: doc.fileType as string,
      storageFilename: doc.filename as string,
      embeddingStatus: doc.embeddingStatus as 'pending' | 'processing' | 'completed' | 'failed',
      status: doc.status as 'draft' | 'inReview' | 'approved' | 'rejected' | undefined,
    }));

    return NextResponse.json({
      documents: documentsForFrontend,
      totalDocuments,
      currentPage: page,
      totalPages: Math.ceil(totalDocuments / limit)
    });

  } catch (error) {
    console.error('Fehler beim Laden der Dokumente aus DB:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Dokumente' }, { status: 500 });
  }
}

// DELETE /api/documents - Ein Dokument löschen
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles as UserRole[];
  
  try {
    const { filename: originalFilenameToDelete, documentId } = await req.json();

    if (!documentId && !originalFilenameToDelete) {
        return NextResponse.json({ error: 'documentId oder originalFilenameToDelete ist erforderlich' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    let docToDelete;
    if (documentId) {
        if (!ObjectId.isValid(documentId)) {
            return NextResponse.json({ error: 'Ungültige documentId' }, { status: 400 });
        }
        docToDelete = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
    } else if (originalFilenameToDelete) {
        // Fallback, falls nur der alte Name gesendet wird (sollte aber documentId sein)
        docToDelete = await db.collection('documents').findOne({ originalFilename: originalFilenameToDelete });
    }

    if (!docToDelete) {
      return NextResponse.json({ error: 'Dokument nicht in DB gefunden' }, { status: 404 });
    }

    // Rollenbasierte Berechtigungsprüfung für das Löschen
    const allowedDeleteRoles: UserRole[] = docToDelete.accessControl?.editRoles || [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL];
    if (!userRoles.some(role => allowedDeleteRoles.includes(role))) {
        return NextResponse.json({ error: 'Keine Berechtigung zum Löschen dieses Dokuments.' }, { status: 403 });
    }

    const storageFilePath = path.join(UPLOAD_DIR, docToDelete.filename); // docToDelete.filename ist der unique Name

    // 1. Dokument aus der DB löschen
    await db.collection('documents').deleteOne({ _id: docToDelete._id });

    // 2. Zugehörige Versionen aus der DB löschen
    await db.collection('documentVersions').deleteMany({ documentId: docToDelete._id });

    // 3. Datei aus dem Dateisystem löschen
    try {
      await fs.unlink(storageFilePath);
    } catch (fileError: any) {
      // Wenn die Datei nicht existiert, ist das okay, da DB-Einträge wichtiger sind.
      // Logge den Fehler, aber fahre fort.
      if (fileError.code !== 'ENOENT') {
        console.warn(`Konnte Datei ${storageFilePath} nicht löschen, DB-Einträge wurden aber entfernt:`, fileError);
      }
    }

    return NextResponse.json({ message: `Dokument '${docToDelete.originalFilename}' und zugehörige Versionen erfolgreich gelöscht` });
  } catch (error) {
    console.error('Fehler beim Löschen des Dokuments:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Dokuments' }, { status: 500 });
  }
}

// POST /api/documents/batch-delete - Mehrere Dokumente löschen
export async function POST(req: NextRequest) {
  // Dieser Handler ist für /api/documents gedacht, nicht /api/documents/batch-delete
  // Wir müssen eine neue Datei für den Batch-Delete-Endpunkt erstellen.
  // Ich werde diesen POST-Handler hier entfernen und ihn in einer neuen Datei platzieren.
  return NextResponse.json({ error: 'Dieser Endpunkt ist für Batch-Operationen nicht korrekt konfiguriert.' }, { status: 405 });
} 