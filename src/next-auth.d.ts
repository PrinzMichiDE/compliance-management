import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import { UserRole } from './types/enums';

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique identifier from the database. */
      id: string;
      /** The user's role (kann als primäre oder Standardrolle dienen). */
      role?: string | null;
      /** Die Sammlung aller Rollen des Benutzers. */
      roles?: UserRole[]; 
      // Behält die Standard-User-Eigenschaften bei (name, email, image)
    } & DefaultSession["user"];
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   * Dieses User-Objekt ist auch das, was dem `jwt` Callback übergeben wird (als `user` Parameter).
   */
  interface User extends DefaultUser {
    // DefaultUser enthält bereits id: string, name?: string, email?: string, image?: string
    // id ist hier also bereits korrekt als string definiert.
    role?: string | null;
    roles?: UserRole[];
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    // DefaultJWT enthält: name?, email?, picture? (image), sub? (oft die Provider User ID)
    /** The user's unique identifier from our database. Wird im jwt callback gesetzt. */
    id: string;
    /** OpenID ID Token, falls vorhanden */
    idToken?: string;
    /** Die primäre Rolle des Benutzers. */
    role?: string | null;
    /** Die Sammlung aller Rollen des Benutzers. */
    roles?: UserRole[];
  }
} 