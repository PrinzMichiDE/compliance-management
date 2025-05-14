import NextAuth, { AuthOptions, SessionStrategy, User as NextAuthUser, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { User as CustomUser } from "@/models/User";
import { JWT } from "next-auth/jwt";

// Erweitere den DefaultSession Typ, um unsere 'id' aufzunehmen
declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
    };
  }
  interface User { // Erweitere den User-Typ, der vom authorize Callback und Adapter verwendet wird
    id?: string;
  }
}

// Erweitere den JWT-Typ, um unsere 'id' aufzunehmen
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

export const authOptions: AuthOptions = {
  adapter: MongoDBAdapter(clientPromise) as AuthOptions['adapter'],
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials) {
          return null;
        }
        const { email, password } = credentials;
        
        const client = await clientPromise;
        const dbName = process.env.MONGODB_DB; 
        if (!dbName) {
          console.error("MONGODB_DB environment variable is not set.");
          // In einer realen Anwendung könntest du hier einen spezifischeren Fehler werfen oder null zurückgeben
          throw new Error("Database name is not configured. Please set MONGODB_DB environment variable.");
        }
        const db = client.db(dbName);
        const usersCollection = db.collection<CustomUser>("users");
        
        const userFromDb = await usersCollection.findOne({ email });

        if (!userFromDb || !userFromDb.password || !userFromDb._id) {
          // Benutzer nicht gefunden oder Passwort/ID nicht im DB-Dokument vorhanden
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, userFromDb.password);

        if (!isPasswordValid) {
          // Passwort stimmt nicht überein
          return null;
        }
        
        // Erfolgreiche Authentifizierung
        // Wichtig: Das User-Objekt für NextAuth muss eine 'id' Eigenschaft als String haben
        return { 
          id: userFromDb._id.toString(), // MongoDB _id zu string 'id' mappen
          name: userFromDb.name, 
          email: userFromDb.email, 
          image: userFromDb.image 
          // Du kannst hier weitere Eigenschaften vom userFromDb übernehmen, falls benötigt
          // und falls sie im NextAuthUser oder dem erweiterten User-Typ definiert sind.
        };
        
        // Temporäre Dummy-Logik wird entfernt
        // if (email === "test@test.com" && password === "password") {
        //   return { id: "1", name: "Test User", email: "test@test.com" }; 
        // } else {
        //   return null;
        // }
      },
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  secret: process.env.NEXTAUTH_SECRET, // Wichtig: Umgebungsvariable setzen!
  pages: {
    signIn: '/login', // Seite für den Login, erstellen wir später
    // error: '/auth/error', // (optional) Seite für Auth-Fehler
    // newUser: '/auth/new-user' // (optional) Seite für neue User nach OAuth
  },
  // Callbacks können hier hinzugefügt werden, z.B. um JWT anzupassen
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 