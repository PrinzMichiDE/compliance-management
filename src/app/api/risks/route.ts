import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { UserRole } from '@/types/enums'; // Pfad angepasst

// Helper function to check for allowed roles (case-insensitive)
const hasAllowedRole = (userRoles: string[] | undefined, allowedRoles: string[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => allowedRoles.map(r => r.toLowerCase()).includes(role.toLowerCase()));
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // Zugriff auf session.user.id und session.user.roles ist jetzt typisiert durch next-auth.d.ts
  if (!session?.user?.id) { // Prüfe auf session und user und user.id
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  // Erlaubte Werte: 'Admin', 'Compliancer Manager FULL', 'Compliancer Manager WRITE'
  const allowedRolesCreate = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager WRITE'];

  if (!hasAllowedRole(userRoles, allowedRolesCreate)) {
    return NextResponse.json({ message: 'Zugriff verweigert für POST' }, { status: 403 });
  }

  try {
    const riskData = await request.json();

    // Validierung von riskData Feldern (Beispiel)
    if (!riskData.title || !riskData.description || !riskData.probability || !riskData.impact || !riskData.status) {
      return NextResponse.json({ message: 'Fehlende Pflichtfelder für Risikoerstellung' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const newRiskData = {
      ...riskData, // Übernehme alle Felder aus dem Request Body
      riskId: `RISK-${Date.now()}`,
      identifiedDate: riskData.identifiedDate ? new Date(riskData.identifiedDate).toISOString() : new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      // Fehlende optionale Felder werden undefined sein, was in MongoDB nicht gespeichert wird oder als null, je nach Schema.
    };

    // Explizite Typisierung für das Objekt, das in die DB eingefügt wird, kann optional sein,
    // wenn riskData bereits dem Risk-Typ (oder einem Teil davon) entspricht.
    // const newRisk: Omit<Risk, '_id'> = newRiskData; // Beispiel für explizite Typisierung

    const result = await db.collection('risks').insertOne(newRiskData);
    const insertedRisk = await db.collection('risks').findOne({ _id: result.insertedId });

    return NextResponse.json(insertedRisk, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Risikos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  // Erlaubte Werte: 'Admin', 'Compliancer Manager FULL', 'Compliancer Manager READ'
  const allowedRolesRead = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager READ'];
  
  if (!hasAllowedRole(userRoles, allowedRolesRead)) {
    return NextResponse.json({ message: 'Zugriff verweigert für GET' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const risks = await db.collection('risks').find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(risks, { status: 200 });
  } catch (error) {
    console.error('Fehler beim Abrufen der Risiken:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
} 