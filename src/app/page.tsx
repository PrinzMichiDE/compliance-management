'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white p-8">
      <main className="text-center space-y-8 max-w-2xl">
        {/* Optional: Logo hier einfügen */}
        {/* <Image src="/logo.svg" alt="Firmenlogo" width={200} height={100} className="mb-8" /> */}
        
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          KI-gestützte Compliance & Risikomanagement Plattform
        </h1>
        
        <p className="text-lg text-slate-300 leading-relaxed">
          Willkommen zu unserer innovativen Lösung zur Vereinfachung und Automatisierung Ihrer Compliance- und Risikomanagement-Prozesse.
          Nutzen Sie die Kraft der KI für effizientere Audits, intelligentes Risikomanagement und umfassende Dokumentenanalyse.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-6">
          {status === 'loading' && (
            <p className="text-slate-400">Lade Sitzungsinformationen...</p>
          )}

          {status === 'unauthenticated' && (
            <>
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Anmelden
              </Link>
              <Link
                href="/register" // TODO: Entscheiden, ob Registrierung öffentlich ist
                className="text-lg font-semibold leading-6 text-indigo-300 hover:text-indigo-100"
              >
                Registrieren <span aria-hidden="true">&rarr;</span>
              </Link>
            </>
          )}

          {status === 'authenticated' && session && (
            <Link
              href="/dashboard"
              className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Zum Dashboard gehen
            </Link>
          )}
        </div>
      </main>

      <footer className="absolute bottom-8 text-center w-full text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Ihre Firma. Alle Rechte vorbehalten.</p>
        {/* Optional: Links zu Impressum, Datenschutz etc. */}
      </footer>
    </div>
  );
}
