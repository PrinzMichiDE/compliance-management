import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Für eindeutige Dateinamen im Storage
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/authOptions'; // Pfad anpassen, falls nötig
import { UserRole } from '@/types/enums'; // Pfad anpassen, falls nötig

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');

// Sicherstellen, dass das Upload-Verzeichnis existiert
async function ensureUploadDirExists() {
  try {
    await stat(UPLOAD_DIR);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      await mkdir(UPLOAD_DIR, { recursive: true });
    } else {
      console.error("Fehler beim Überprüfen/Erstellen des Upload-Verzeichnisses:", e);
      throw e; // Fehler weiterwerfen, um den Upload zu stoppen
    }
  }
}

interface DocumentSchema {
  filename: string; // Eindeutiger Name im Storage (z.B. UUID + Extension)
  originalFilename: string;
  storagePath: string;
  fileType: string;
  size: number;
  uploaderId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  currentVersionId: ObjectId;
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  embeddingVector?: number[]; // Hinzugefügt für die Speicherung des Embeddings
  lastIndexedAt?: Date; // Hinzugefügt (war im analyze-document, sollte auch hier sein)
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  tags?: string[];
  description?: string;
  accessControl: {
    viewRoles: UserRole[];
    editRoles: UserRole[]; 
  };
}

interface DocumentVersionSchema {
  documentId: ObjectId;
  versionNumber: number;
  storagePath: string; 
  size: number;
  fileType: string;
  uploaderId: ObjectId;
  createdAt: Date;
  changeDescription?: string;
}

export async function POST(req: NextRequest) {
  await ensureUploadDirExists();
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  // Rollenprüfung für Upload (Beispiel)
  const allowedUploadRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE];
  if (!session.user.roles || !session.user.roles.some(role => allowedUploadRoles.includes(role as UserRole))) {
      return NextResponse.json({ error: 'Keine Berechtigung zum Hochladen.' }, { status: 403 });
  }

  const uploaderId = new ObjectId(session.user.id);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei im Upload gefunden' }, { status: 400 });
    }

    const originalFilename = file.name;
    const fileExtension = path.extname(originalFilename);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const storageFilePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Datei ins Dateisystem schreiben
    const bytes = await file.arrayBuffer();
    await writeFile(storageFilePath, Buffer.from(bytes));

    const client = await clientPromise;
    const db = client.db(); // Hier ggf. den Datenbanknamen angeben, falls nicht in URI

    const now = new Date();

    // 1. DocumentVersion-Eintrag erstellen
    const newVersion: DocumentVersionSchema = {
      documentId: new ObjectId(), // Platzhalter, wird unten mit der echten documentId überschrieben
      versionNumber: 1,
      storagePath: uniqueFilename, // Relativer Pfad innerhalb des UPLOAD_DIR
      size: file.size,
      fileType: file.type,
      uploaderId: uploaderId,
      createdAt: now,
      changeDescription: 'Initial version',
    };
    const versionResult = await db.collection('documentVersions').insertOne(newVersion);
    const newVersionId = versionResult.insertedId;

    // 2. Document-Eintrag erstellen
    const newDocument: DocumentSchema = {
      filename: uniqueFilename,
      originalFilename: originalFilename,
      storagePath: uniqueFilename, // Könnte auch der volle Pfad sein, je nach Konvention
      fileType: file.type,
      size: file.size,
      uploaderId: uploaderId,
      createdAt: now,
      updatedAt: now,
      currentVersionId: newVersionId,
      embeddingStatus: 'pending',
      status: 'draft',
      // Standard-Zugriffsrollen, anpassbar
      accessControl: {
        viewRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.RISK_MANAGER, UserRole.USER],
        editRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE],
      },
      // Optional: tags, description
    };
    const documentResult = await db.collection('documents').insertOne(newDocument);
    const newDocumentId = documentResult.insertedId;

    // documentId in der Version aktualisieren
    await db.collection('documentVersions').updateOne(
      { _id: newVersionId }, 
      { $set: { documentId: newDocumentId } }
    );

    // Asynchronen Analyseprozess anstoßen (Fire-and-Forget)
    const analysisApiUrl = new URL('/api/rules/analyze-document', req.nextUrl.origin); // Konstruiert die volle URL
    fetch(analysisApiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Ggf. Authentifizierungsheader, falls der analyze-document Endpunkt geschützt ist und eine server-seitige Anfrage dies benötigt.
        // Für interne Aufrufe innerhalb derselben App ist dies oft nicht nötig, oder man nutzt einen internen API-Key.
        // Hier gehen wir davon aus, dass der analyze-document Endpunkt entweder offen ist oder die Session serverseitig prüft.
      },
      body: JSON.stringify({
        filePath: `persistent_uploads/documents/${newDocument.filename}`, // newDocument.filename ist der unique storage name
        originalFileType: newDocument.fileType,
        documentId: newDocumentId.toString(),
      }),
    }).then(async analysisResponse => {
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.text();
        console.error(`Fehler beim automatischen Anstoßen der Analyse für ${newDocumentId.toString()}: ${analysisResponse.status}`, errorData);
      } else {
        console.log(`Analyse für Dokument ${newDocumentId.toString()} automatisch angestoßen.`);
      }
    }).catch(error => {
      console.error(`Netzwerkfehler beim automatischen Anstoßen der Analyse für ${newDocumentId.toString()}:`, error);
    });

    return NextResponse.json({
      message: 'Datei erfolgreich hochgeladen und in DB gespeichert. Analyseprozess gestartet.',
      filename: originalFilename,
      documentId: newDocumentId,
      versionId: newVersionId,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Fehler beim Hochladen der Datei:", error);
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei', details: error.message }, { status: 500 });
  }
} 