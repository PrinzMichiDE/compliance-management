import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { UserRole } from '@/types/enums';
import { Risk } from '@/types/risk';

// Hilfsfunktion für Rollenprüfung
const hasAllowedRole = (userRoles: UserRole[] | undefined, allowedRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => allowedRoles.includes(role as UserRole));
};

// GET: Einzelnes Risiko abrufen
export async function GET(request: NextRequest, { params }: { params: Promise<{ riskId: string }> }) {
  const { riskId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_READ,
    UserRole.RISK_MANAGER,
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db();
    const risk = await db.collection<Risk>('risks').findOne({ riskId });
    if (!risk) {
      return NextResponse.json({ message: 'Risiko nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(risk, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// PUT: Risiko aktualisieren
export async function PUT(request: NextRequest, { params }: { params: Promise<{ riskId: string }> }) {
  const { riskId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE,
    UserRole.RISK_MANAGER,
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }
    const updates = await request.json();
    delete updates._id;
    delete updates.riskId;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'Keine Aktualisierungsdaten angegeben' }, { status: 400 });
    }
    updates.updatedAt = new Date().toISOString();
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection<Risk>('risks').updateOne(
      { riskId },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Risiko nicht gefunden' }, { status: 404 });
    }
    const updatedRisk = await db.collection<Risk>('risks').findOne({ riskId });
    return NextResponse.json(updatedRisk, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// DELETE: Risiko löschen
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ riskId: string }> }) {
  const { riskId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.RISK_MANAGER,
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!riskId) {
      return NextResponse.json({ message: 'Risk ID fehlt' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection('risks').deleteOne({ riskId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Risiko nicht gefunden oder bereits gelöscht' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Risiko erfolgreich gelöscht' }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
} 