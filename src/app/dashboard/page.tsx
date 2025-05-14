'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

// Definiere den erweiterten Session-Typ, falls noch nicht global oder in einer .d.ts Datei geschehen
// um Zugriff auf user.role und user.id zu haben.
// Du könntest eine `next-auth.d.ts` im `src` Verzeichnis erstellen mit:
// import NextAuth, { DefaultSession, DefaultUser } from "next-auth"
// import { JWT, DefaultJWT } from "next-auth/jwt"
// 
// declare module "next-auth" {
//   interface Session extends DefaultSession {
//     user: {
//       id: string;
//       role?: string | null;
//     } & DefaultSession["user"];
//   }
// 
//   interface User extends DefaultUser {
//     role?: string | null;
//   }
// }
// 
// declare module "next-auth/jwt" {
//   interface JWT extends DefaultJWT {
//     role?: string | null;
//     id?: string;
//   }
// }

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <p className="text-center mt-10">Lade Dashboard...</p>;
  }

  if (status === 'unauthenticated' || !session) {
    // Sollte bereits durch useEffect behandelt werden, aber als Fallback
    return <p className="text-center mt-10">Bitte zuerst anmelden.</p>; 
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
        >
          Abmelden
        </button>
      </header>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Willkommen, {session.user?.name || 'Benutzer'}!</h2>
        <p className="text-gray-600 mb-2">Deine E-Mail: {session.user?.email}</p>
        {/* Zugriff auf die erweiterte Session-Information */} 
        { session.user?.id && <p className="text-gray-600 mb-2">Deine Benutzer-ID: {session.user.id}</p>}
        { session.user?.role && <p className="text-gray-600 mb-2">Deine Rolle: {session.user.role}</p>}
        
        <p className="mt-4 text-gray-700">
          Dies ist dein persönliches Dashboard. Hier werden bald weitere Compliance-Informationen und Funktionen zu finden sein.
        </p>

        {/* Beispielhafter Link zur Admin-Seite, falls der User Admin ist */} 
        {session.user?.role === 'Admin' && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-700">Admin-Bereich</h3>
            <p className="text-gray-600">
              Als Administrator hast du Zugriff auf erweiterte Einstellungen.
              <Link href="/admin" className="text-indigo-600 hover:text-indigo-800 ml-2">
                Zum Admin-Panel
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 