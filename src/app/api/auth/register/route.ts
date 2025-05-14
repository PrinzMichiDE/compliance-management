import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  // Prüfen, ob lokale Registrierung aktiviert ist (serverseitig)
  if (process.env.ENABLE_LOCAL_REGISTRATION !== 'true') {
    return NextResponse.json(
      { message: 'Die lokale Registrierung ist derzeit deaktiviert.' },
      { status: 403 } // Forbidden
    );
  }

  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Name, E-Mail und Passwort sind erforderlich.' },
        { status: 400 } // Bad Request
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Ungültiges E-Mail-Format.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Das Passwort muss mindestens 6 Zeichen lang sein.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' },
        { status: 409 } // Conflict
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: 'User', // Standardrolle
      emailVerified: null,
      image: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    if (result.insertedId) {
      return NextResponse.json(
        { message: 'Benutzer erfolgreich registriert.', userId: result.insertedId },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        { message: 'Benutzerregistrierung fehlgeschlagen.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Registrierungs-API-Fehler:', error);
    return NextResponse.json(
      { message: 'Ein interner Serverfehler ist aufgetreten.' },
      { status: 500 }
    );
  }
} 