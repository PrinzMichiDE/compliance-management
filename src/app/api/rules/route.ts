import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import clientPromise from '@/lib/mongodb';
import { Rule } from '@/types/rule';
import { ObjectId } from 'mongodb';
import { UserRole } from '@/types/enums';

const secret = process.env.AUTH_SECRET;

// GET /api/rules - Alle Regeln abrufen
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret });
  if (!token) {
    return NextResponse.json({ message: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Rollenbasierte Berechtigung für Lesezugriff implementieren
  const allowedReadRoles = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_READ,
    UserRole.COMPLIANCE_MANAGER_WRITE
  ];
  if (!token.role || !allowedReadRoles.includes(token.role as UserRole)) {
    return NextResponse.json({ message: 'Nicht autorisiert, Regeln anzuzeigen' }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const rules = await db.collection('rules').find({}).toArray();
    return NextResponse.json(rules, { status: 200 });
  } catch (error) {
    console.error('Fehler beim Abrufen der Regeln:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// POST /api/rules - Neue Regel erstellen
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret });
  if (!token || !token.id) {
    return NextResponse.json({ message: 'Nicht authentifiziert oder Benutzer-ID fehlt' }, { status: 401 });
  }

  // Rollenbasierte Berechtigung für Erstellung
  const allowedWriteRoles = [
    UserRole.ADMIN,
    UserRole.COMPLIANCE_MANAGER_FULL,
    UserRole.COMPLIANCE_MANAGER_WRITE
  ];
  if (!token.role || !allowedWriteRoles.includes(token.role as UserRole)) {
    return NextResponse.json({ message: 'Nicht autorisiert zum Erstellen von Regeln' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, ruleId, status, category, priority, targetAudience, linkedDocuments, tags, validFrom, validTo, customFields } = body as Partial<Rule>;

    if (!name || !description || !ruleId || !status) {
      return NextResponse.json({ message: 'Name, Beschreibung, RuleId und Status sind erforderlich' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const rulesCollection = db.collection('rules');

    // Prüfen, ob ruleId bereits existiert
    const existingRuleById = await rulesCollection.findOne({ ruleId });
    if (existingRuleById) {
      return NextResponse.json({ message: `Eine Regel mit der ID '${ruleId}' existiert bereits.` }, { status: 409 });
    }

    const newRule: Omit<Rule, '_id'> = {
      ruleId,
      name,
      description,
      status: status || 'Entwurf',
      category: category || undefined,
      priority: priority || 'Mittel',
      targetAudience: targetAudience || [],
      responsiblePersonIds: [], // Vorerst leer, kann später über PUT aktualisiert werden
      linkedDocuments: linkedDocuments || [],
      tags: tags || [],
      version: 1,
      createdBy: new ObjectId(token.id as string), // token.id ist die ObjectId des Users als string
      createdAt: new Date(),
      updatedAt: new Date(),
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      customFields: customFields || {},
    };

    const result = await rulesCollection.insertOne(newRule as Rule);

    if (result.insertedId) {
      // Hole das erstellte Dokument zurück, um es in der Antwort zu senden
      const createdRule = await rulesCollection.findOne({ _id: result.insertedId });
      return NextResponse.json(createdRule, { status: 201 });
    } else {
      return NextResponse.json({ message: 'Regelerstellung fehlgeschlagen' }, { status: 500 });
    }
  } catch (error) {
    console.error('Fehler beim Erstellen der Regel:', error);
    // Spezifischere Fehlermeldungen für z.B. ungültige ObjectId
    if (error instanceof Error && error.message.includes('Argument passed in must be a string of 12 bytes or a string of 24 hex characters')) {
        return NextResponse.json({ message: 'Ungültige Benutzer-ID im Token.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
} 