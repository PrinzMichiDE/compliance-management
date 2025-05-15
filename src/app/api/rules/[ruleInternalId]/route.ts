import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import clientPromise from '@/lib/mongodb';
import { UserRole } from '@/types/enums';
import { Rule } from '@/types/rule';

// Hilfsfunktion für Rollenprüfung
const hasAllowedRole = (userRoles: UserRole[] | undefined, allowedRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => allowedRoles.includes(role as UserRole));
};

// GET: Einzelne Regel abrufen
export async function GET(request: NextRequest, { params }: { params: Promise<{ ruleInternalId: string }> }) {
  const { ruleInternalId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_READ
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!ruleInternalId) {
      return NextResponse.json({ message: 'Rule ID fehlt' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db();
    const rule = await db.collection<Rule>('rules').findOne({ ruleInternalId });
    if (!rule) {
      return NextResponse.json({ message: 'Regel nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(rule, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// PUT: Regel aktualisieren
export async function PUT(request: NextRequest, { params }: { params: Promise<{ ruleInternalId: string }> }) {
  const { ruleInternalId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!ruleInternalId) {
      return NextResponse.json({ message: 'Rule ID fehlt' }, { status: 400 });
    }
    const updates = await request.json();
    delete updates._id;
    delete updates.ruleInternalId;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'Keine Aktualisierungsdaten angegeben' }, { status: 400 });
    }
    updates.updatedAt = new Date().toISOString();
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection<Rule>('rules').updateOne(
      { ruleInternalId },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Regel nicht gefunden' }, { status: 404 });
    }
    const updatedRule = await db.collection<Rule>('rules').findOne({ ruleInternalId });
    return NextResponse.json(updatedRule, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
}

// DELETE: Regel löschen
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ ruleInternalId: string }> }) {
  const { ruleInternalId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const userRoles = session.user.roles;
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL
  ];

  if (!hasAllowedRole(userRoles, allowedRoles)) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  try {
    if (!ruleInternalId) {
      return NextResponse.json({ message: 'Rule ID fehlt' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection('rules').deleteOne({ ruleInternalId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Regel nicht gefunden oder bereits gelöscht' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Regel erfolgreich gelöscht' }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: 'Interner Serverfehler', error: errorMessage }, { status: 500 });
  }
} 