import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import { User as CustomUser } from "@/models/User"; // Unser User-Modell

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    // Stärke des Passworts könnte hier serverseitig geprüft werden (optional)

    const client = await clientPromise;
    const dbName = process.env.MONGODB_DB;

    if (!dbName) {
      console.error("MONGODB_DB environment variable is not set.");
      return NextResponse.json(
        { message: "Datenbankkonfiguration fehlt serverseitig." },
        { status: 500 }
      );
    }
    const db = client.db(dbName);
    const usersCollection = db.collection<CustomUser>("users");

    // Prüfen, ob der Benutzer bereits existiert
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "Ein Benutzer mit dieser E-Mail existiert bereits." },
        { status: 409 } // 409 Conflict
      );
    }

    // Passwort hashen
    const hashedPassword = await bcrypt.hash(password, 10); // 10 ist die Salt-Runde, üblicher Wert

    // Neuen Benutzer erstellen
    const newUser: Omit<CustomUser, '_id'> = {
      email,
      password: hashedPassword,
      name: name || null, // Name ist optional, standardmäßig null
      emailVerified: null, // E-Mail ist initial nicht verifiziert
      image: null, // Kein Profilbild initial
      // createdAt: new Date(), // Optional: Erstellungsdatum hinzufügen
      // updatedAt: new Date(), // Optional: Aktualisierungsdatum hinzufügen
    };

    const result = await usersCollection.insertOne(newUser as CustomUser);

    if (result.insertedId) {
      return NextResponse.json(
        { message: "Benutzer erfolgreich registriert.", userId: result.insertedId },
        { status: 201 } // 201 Created
      );
    } else {
      return NextResponse.json(
        { message: "Benutzerregistrierung fehlgeschlagen." },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Registrierungsfehler:", error);
    let errorMessage = "Ein interner Serverfehler ist aufgetreten.";
    if (error instanceof Error) {
        // errorMessage = error.message; // Sei vorsichtig, interne Fehlermeldungen preiszugeben
    }
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 }
    );
  }
} 