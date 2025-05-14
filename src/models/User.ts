import { ObjectId } from "mongodb";

// Wir definieren hier zunächst eine einfache User-Struktur.
// Wenn du komplexere Anforderungen hast (z.B. Rollen, weitere Profildaten), können wir das erweitern.
export interface User {
  _id?: ObjectId;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null; // Für Profilbilder, oft von OAuth Providern
  password?: string | null; // Wird gehasht gespeichert
  // Hier könnten weitere Felder hinzukommen, z.B.:
  // createdAt?: Date;
  // updatedAt?: Date;
  // role?: string; 
}

// Hinweis: NextAuth.js mit dem MongoDBAdapter erwartet bestimmte Felder.
// Die 'emailVerified' und 'image' Felder sind oft nützlich, wenn du OAuth-Logins (Google, GitHub etc.) hinzufügen möchtest.
// Für einen reinen Credentials-Login sind sie nicht zwingend, aber der Adapter könnte sie erwarten. 