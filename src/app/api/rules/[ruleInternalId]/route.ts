import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import clientPromise from '@/lib/mongodb';
import { Rule } from '@/types/rule';
import { ObjectId } from 'mongodb';

const secret = process.env.AUTH_SECRET;

// GET /api/rules/{ruleInternalId} - Eine spezifische Regel abrufen
export async function GET(
  req: NextRequest,
  // @ts-ignore Next.js type generation mismatch for dynamic route context.params
  context: { params: { ruleInternalId: string } }
) {
  const token = await getToken({ req, secret });
  if (!token) {
    return NextResponse.json({ message: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Rollenbasierte Berechtigung für Lesezugriff
  const allowedReadRoles = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager READ', 'Compliancer Manager WRITE'];
  if (!token.role || !allowedReadRoles.includes(token.role as string)) {
    return NextResponse.json({ message: 'Nicht autorisiert, diese Regel anzuzeigen' }, { status: 403 });
  }

  try {
    const { ruleInternalId } = context.params;
    if (!ObjectId.isValid(ruleInternalId)) {
      return NextResponse.json({ message: 'Ungültige Regel-ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const rule = await db.collection('rules').findOne({ _id: new ObjectId(ruleInternalId) });

    if (!rule) {
      return NextResponse.json({ message: 'Regel nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(rule, { status: 200 });
  } catch (error) {
    const { ruleInternalId } = context.params;
    console.error(`Fehler beim Abrufen der Regel ${ruleInternalId}:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// PUT /api/rules/{ruleInternalId} - Eine spezifische Regel aktualisieren
export async function PUT(
  req: NextRequest,
  // @ts-ignore Next.js type generation mismatch for dynamic route context.params
  context: { params: { ruleInternalId: string } }
) {
  const token = await getToken({ req, secret });
  if (!token || !token.id) {
    return NextResponse.json({ message: 'Nicht authentifiziert oder Benutzer-ID fehlt' }, { status: 401 });
  }

  const allowedWriteRoles = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager WRITE'];
  if (!token.role || !allowedWriteRoles.includes(token.role)) {
    return NextResponse.json({ message: 'Nicht autorisiert zum Aktualisieren von Regeln' }, { status: 403 });
  }

  try {
    const { ruleInternalId } = context.params;
    if (!ObjectId.isValid(ruleInternalId)) {
      return NextResponse.json({ message: 'Ungültige Regel-ID' }, { status: 400 });
    }

    const requestBody = await req.json() as Partial<Rule>; 

    const { 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _id: _unusedId, 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        createdBy: _unusedCreatedBy, 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        createdAt: _unusedCreatedAt, 
        ...updatableClientData 
    } = requestBody;

    if (Object.keys(updatableClientData).length === 0) {
        return NextResponse.json({ message: 'Keine Aktualisierungsdaten bereitgestellt' }, { status: 400 });
    }

    // Wenn ruleId geändert wird, sicherstellen, dass sie eindeutig bleibt
    if (updatableClientData.ruleId) {
        const clientCheck = await clientPromise;
        const dbCheck = clientCheck.db();
        const existingRuleWithId = await dbCheck.collection('rules').findOne({
            ruleId: updatableClientData.ruleId,
            _id: { $ne: new ObjectId(ruleInternalId) } 
        });
        if (existingRuleWithId) {
            return NextResponse.json({ message: `Eine andere Regel mit der ID '${updatableClientData.ruleId}' existiert bereits.` }, { status: 409 });
        }
    }

    // Erstelle das $set-Objekt nur mit den erlaubten und den System-generierten Update-Feldern
    const setData: Partial<Rule> = {
        ...updatableClientData, // Nur die erlaubten Felder vom Client
        lastModifiedBy: new ObjectId(token.id as string),
        updatedAt: new Date(),
    };
    
    // Optional: Version Inkrementieren, falls vorhanden und geändert wurde
    // if (updatableClientData.version && typeof updatableClientData.version === 'number') {
    //   const currentRule = await db.collection('rules').findOne({ _id: new ObjectId(ruleInternalId) });
    //   if (currentRule && typeof currentRule.version === 'number') {
    //     setData.version = currentRule.version + 1;
    //   } else {
    //     setData.version = 1; // Falls vorher keine Version vorhanden war
    //   }
    // } else if (Object.keys(updatableClientData).length > 0 && !updatableClientData.hasOwnProperty('version')) {
       // setData.version = ... // Alte Version lesen und inkrementieren
    // }

    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection('rules').updateOne(
      { _id: new ObjectId(ruleInternalId) },
      { $set: setData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Regel nicht gefunden' }, { status: 404 });
    }

    const updatedRule = await db.collection('rules').findOne({ _id: new ObjectId(ruleInternalId) });
    return NextResponse.json(updatedRule, { status: 200 });

  } catch (error) {
    const { ruleInternalId } = context.params;
    console.error(`Fehler beim Aktualisieren der Regel ${ruleInternalId}:`, error);
    if (error instanceof Error && error.message.includes('Argument passed in must be a string of 12 bytes or a string of 24 hex characters')) {
        return NextResponse.json({ message: 'Ungültige Benutzer-ID im Token für lastModifiedBy.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// DELETE /api/rules/{ruleInternalId} - Eine spezifische Regel löschen
export async function DELETE(
  req: NextRequest,
  // @ts-ignore Next.js type generation mismatch for dynamic route context.params
  context: { params: { ruleInternalId: string } }
) {
  const token = await getToken({ req, secret });
  if (!token) {
    return NextResponse.json({ message: 'Nicht authentifiziert' }, { status: 401 });
  }

  const allowedDeleteRoles = ['Admin', 'Compliancer Manager FULL']; // Nur bestimmte Rollen dürfen löschen
  if (!token.role || !allowedDeleteRoles.includes(token.role)) {
    return NextResponse.json({ message: 'Nicht autorisiert zum Löschen von Regeln' }, { status: 403 });
  }

  try {
    const { ruleInternalId } = context.params;
    if (!ObjectId.isValid(ruleInternalId)) {
      return NextResponse.json({ message: 'Ungültige Regel-ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection('rules').deleteOne({ _id: new ObjectId(ruleInternalId) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Regel nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Regel erfolgreich gelöscht' }, { status: 200 }); // Oder 204 No Content
  } catch (error) {
    const { ruleInternalId } = context.params;
    console.error(`Fehler beim Löschen der Regel ${ruleInternalId}:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
} 