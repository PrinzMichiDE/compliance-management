import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import fsSync from 'node:fs'; // Für existsSync
import path from 'node:path';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { UserRole } from '@/types/enums';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');

interface DownloadParams {
  params: {
    filename: string;
  };
}

export async function GET(req: NextRequest, { params }: DownloadParams) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id || !session.user.roles) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  const userRoles = session.user.roles as UserRole[];

  const { filename: storageFilename } = params;
  const { searchParams } = new URL(req.url);
  const originalFilename = searchParams.get('originalFilename') || storageFilename;
  // Den fileType aus den Query-Parametern nehmen, da er für den Content-Type Header wichtig ist.
  // Ein Fallback ist hier weniger sinnvoll, da der Typ stimmen sollte.
  const fileType = searchParams.get('fileType');

  if (!storageFilename) {
    return NextResponse.json({ error: 'Dateiname erforderlich' }, { status: 400 });
  }

  if (!fileType) {
    return NextResponse.json({ error: 'Dateityp (fileType) als Query-Parameter erforderlich' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    // Finde das Dokument in der DB anhand des storageFilename, um Berechtigungen zu prüfen
    const document = await db.collection('documents').findOne({ filename: storageFilename });

    if (!document) {
      return NextResponse.json({ error: 'Dokument nicht in der Datenbank gefunden oder Dateiname-Mismatch' }, { status: 404 });
    }

    // Rollenbasierte Zugriffskontrolle
    const allowedViewRoles: UserRole[] = document.accessControl?.viewRoles || 
                                         [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE]; // Fallback auf Standardrollen

    if (!userRoles.some(role => allowedViewRoles.includes(role))) {
      return NextResponse.json({ error: 'Keine Berechtigung zum Herunterladen dieses Dokuments.' }, { status: 403 });
    }

    const filePath = path.join(UPLOAD_DIR, storageFilename);

    // Sicherheitscheck: Verhindere Path Traversal
    if (path.dirname(filePath) !== UPLOAD_DIR) {
        console.error(`Path Traversal Versuch unterbunden: ${storageFilename}`);
        return NextResponse.json({ error: 'Ungültiger Dateipfad' }, { status: 400 });
    }
    
    // Prüfen, ob die Datei existiert
    if (!fsSync.existsSync(filePath)) {
        console.error(`Datei nicht gefunden auf dem Server: ${filePath}`);
        return NextResponse.json({ error: 'Datei nicht auf dem Server gefunden' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    const headers = new Headers();
    headers.set('Content-Type', fileType); // Wichtig: Den korrekten Mime-Type verwenden
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Fehler beim Herunterladen der Datei:', error);
    return NextResponse.json({ error: 'Interner Serverfehler beim Herunterladen der Datei' }, { status: 500 });
  }
} 