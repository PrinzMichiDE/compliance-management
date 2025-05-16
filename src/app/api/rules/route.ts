import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import clientPromise from '@/lib/mongodb';
import { Rule } from '@/types/rule';
import { ObjectId } from 'mongodb';
import { UserRole } from '@/types/enums';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { revalidatePath } from 'next/navigation';

const secret = process.env.AUTH_SECRET;

// Hilfsfunktion zur Überprüfung der Benutzerrollen
function hasRequiredRole(userRoles: UserRole[] | undefined | null, requiredRoles: UserRole[]): boolean {
  if (!userRoles) {
    return false;
  }
  return userRoles.some(role => requiredRoles.includes(role));
}

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
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id || !hasRequiredRole(session.user.roles as UserRole[], [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { ruleId, name, description, status, category, priority, targetAudience, linkedDocuments, tags, validFrom, validTo, customFields, embedding } = body as Partial<Rule>;

    if (!ruleId || !name || !description || !status) {
      return NextResponse.json({ message: 'Pflichtfelder fehlen (Regel-ID, Name, Beschreibung, Status)' }, { status: 400 });
    }

    await clientPromise;
    const db = (await clientPromise).db(process.env.MONGODB_DB_NAME);
    const rulesCollection = db.collection<Rule>('rules');

    // Check for duplicate ruleId
    const existingRuleById = await rulesCollection.findOne({ ruleId });
    if (existingRuleById) {
      return NextResponse.json({ message: `Eine Regel mit der ID '${ruleId}' existiert bereits.` }, { status: 409 });
    }

    const newRule: Omit<Rule, '_id'> = {
      ruleId,
      name,
      description,
      status,
      category: category || undefined,
      priority: priority || undefined,
      targetAudience: targetAudience || [],
      linkedDocuments: linkedDocuments || [],
      tags: tags || [],
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      customFields: customFields || undefined,
      embedding: embedding || undefined,
      version: 1,
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await rulesCollection.insertOne(newRule as Rule);

    if (!result.insertedId) {
      return NextResponse.json({ message: 'Fehler beim Erstellen der Regel in der Datenbank.' }, { status: 500 });
    }
    
    // Revalidate path for on-demand ISR
    revalidatePath('/rule-manager');
    revalidatePath(`/rule-manager/${ruleId}`);

    // Anstatt das ganze Objekt zurückzugeben, nur eine Erfolgsmeldung oder die ID
    return NextResponse.json({ message: 'Regel erfolgreich erstellt', ruleInternalId: result.insertedId }, { status: 201 });

  } catch (error) {
    console.error('Fehler beim Erstellen der Regel:', error);
    // Spezifischere Fehlermeldungen für z.B. ungültige ObjectId
    if (error instanceof Error && error.message.includes('Argument passed in must be a string of 12 bytes or a string of 24 hex characters')) {
        return NextResponse.json({ message: 'Ungültige Benutzer-ID im Token.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
} 