"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' }); // Nach dem Logout zur Login-Seite weiterleiten
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <p className="text-lg text-gray-700">Lade Sitzungsinformationen...</p>
        {/* Hier könnte ein ansprechenderer Ladeindikator hin */}
      </div>
    );
  }

  if (status === "authenticated" && session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl">
          <h1 className="text-3xl font-bold mb-4 text-gray-800">
            Willkommen zurück, {session.user.name || session.user.email}!
          </h1>
          <p className="text-gray-600 mb-6">
            Du bist erfolgreich angemeldet.
          </p>
          {
            session.user.image && (
              <img 
                src={session.user.image} 
                alt="Profilbild" 
                className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-indigo-500"
              />
            )
          }
          <p className="text-sm text-gray-500 mb-2">Deine User-ID: {session.user.id}</p> 
          <p className="text-sm text-gray-500 mb-6">Deine E-Mail: {session.user.email}</p>
          
          {/* Hier könnte der Inhalt des Dashboards beginnen */}
          <div className="mb-8 p-4 border border-dashed border-gray-300 rounded-md">
            <h2 className="text-xl font-semibold text-gray-700">Dashboard Bereich</h2>
            <p className="text-gray-500 mt-2">Weitere Funktionen und Inhalte folgen hier...</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full sm:w-auto bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  // Nicht authentifiziert
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Willkommen!</h1>
        <p className="text-gray-600 mb-8">
          Bitte melde dich an oder registriere dich, um fortzufahren.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/login">
            <span className="block w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out cursor-pointer">
              Anmelden
            </span>
          </Link>
          <Link href="/register">
            <span className="block w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out cursor-pointer">
              Registrieren
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
