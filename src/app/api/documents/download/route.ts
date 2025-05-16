import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { stat } from 'fs/promises';

const UPLOAD_DIR = path.join(process.cwd(), 'persistent_uploads', 'documents');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return NextResponse.json({ error: 'Dateiname ist erforderlich' }, { status: 400 });
  }

  // Sicherheitsüberprüfung: Verhindern von Path Traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await stat(filePath); // Prüfen, ob Datei existiert
    const fileStream = fs.createReadStream(filePath);
    
    // Header setzen, um den Download zu erzwingen und den Dateinamen festzulegen
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    // Content-Type könnte dynamisch basierend auf der Dateiendung gesetzt werden, 
    // aber für einen generischen Download ist application/octet-stream oft ausreichend.
    headers.set('Content-Type', 'application/octet-stream');

    return new NextResponse(fileStream as any, { headers });

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }
    console.error('Fehler beim Herunterladen der Datei:', error);
    return NextResponse.json({ error: 'Interner Serverfehler beim Herunterladen der Datei' }, { status: 500 });
  }
} 