import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { UserRole } from '@/types/enums'; // Pfad angepasst
import { Risk } from '@/types/risk';
import { ObjectId } from 'mongodb'; // Wird benötigt, falls wir nach _id suchen, aber wir verwenden riskId

interface Params {
  riskId: string;
}

// Helper function to check for allowed roles
const hasAllowedRole = (userRoles: UserRole[] | undefined, allowedRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => allowedRoles.includes(role as UserRole));
};

// GET Handler: Abrufen eines spezifischen Risikos
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_READ,
    UserRole.RISK_MANAGER, // Risk Manager sollte auch lesen dürfen
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const { riskId } = params;
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const risk = await db.collection<Risk>('risks').findOne({ riskId: riskId });

    if (!risk) {
      return NextResponse.json({ message: 'Risiko nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(risk, { status: 200 });
  } catch (error) {
    console.error('Fehler beim Abrufen des Risikos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// PUT Handler: Aktualisieren eines spezifischen Risikos
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE,
    UserRole.RISK_MANAGER, // Risk Manager sollte auch bearbeiten dürfen
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const { riskId } = params;
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }
    const updates = await request.json();

    // Entferne _id und riskId aus den Updates, um zu verhindern, dass sie geändert werden
    const { _id, riskId: idFromPayload, createdAt, ...validUpdates } = updates;
    
    // Validierung: Stellen Sie sicher, dass zumindest ein Feld zum Aktualisieren vorhanden ist.
    if (Object.keys(validUpdates).length === 0) {
        return NextResponse.json({ message: 'Keine Aktualisierungsdaten angegeben' }, { status: 400 });
    }

    validUpdates.updatedAt = new Date().toISOString();

    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection<Risk>('risks').updateOne(
      { riskId: riskId },
      { $set: validUpdates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Risiko nicht gefunden' }, { status: 404 });
    }
    
    const updatedRisk = await db.collection<Risk>('risks').findOne({ riskId: riskId });
    return NextResponse.json(updatedRisk, { status: 200 });

  } catch (error) {
    console.error('Fehler beim Aktualisieren des Risikos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// DELETE Handler: Löschen eines spezifischen Risikos
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.RISK_MANAGER, // Risk Manager sollte auch löschen dürfen
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    const { riskId } = params;
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection('risks').deleteOne({ riskId: riskId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Risiko nicht gefunden oder bereits gelöscht' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Risiko erfolgreich gelöscht' }, { status: 200 }); // Status 204 (No Content) wäre auch möglich
  } catch (error) {
    console.error('Fehler beim Löschen des Risikos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
} 