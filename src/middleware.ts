import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` erweitert das `Request`-Objekt um `req.nextauth.token`.
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;

    // Beispiel: Nur Benutzer mit der Rolle "Admin" dürfen auf /admin zugreifen
    if (req.nextUrl.pathname.startsWith("/admin") && token?.role !== "Admin") {
      // Optional: Umleiten zu einer "Nicht autorisiert"-Seite oder zum Dashboard
      // return NextResponse.redirect(new URL('/unauthorized', req.url));
      // Oder einfach zum Dashboard zurückleiten, wenn keine spezielle Seite vorhanden ist
      console.log(`Nicht-Admin Zugriff auf /admin verweigert. Rolle: ${token?.role}`)
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized", req.url));
    }

    // Andere geschützte Routen, die keine spezielle Rolle erfordern, werden von withAuth standardmäßig behandelt.
    // Wenn der Benutzer nicht angemeldet ist, leitet withAuth zur Login-Seite weiter.
    return NextResponse.next();
  },
  {
    callbacks: {
      // Dieser Callback wird aufgerufen, um zu entscheiden, ob der Benutzer autorisiert ist.
      // Das Ergebnis dieses Callbacks (true/false) bestimmt, ob die Middleware-Funktion oben
      // überhaupt ausgeführt wird oder ob direkt eine Umleitung zur Login-Seite erfolgt.
      authorized: ({ token }) => !!token, // Einfach prüfen, ob ein Token vorhanden ist (Benutzer ist angemeldet)
    },
    pages: {
      signIn: "/login", // Muss mit der Konfiguration in authOptions übereinstimmen
      // error: "/auth/error", // Optionale Fehlerseite
    },
  }
);

// Definiert, auf welche Pfade die Middleware angewendet werden soll.
export const config = {
  matcher: [
    /*
     * Übereinstimmung mit allen Request-Pfaden außer denen, die mit Folgendem beginnen:
     * - api (API-Routen)
     * - _next/static (statische Dateien)
     * - _next/image (Bildoptimierungs-Dateien)
     * - favicon.ico (Favicon-Datei)
     * - /login (Login-Seite)
     * - /register (Registrierungs-Seite)
     * - / (Startseite)
     * - Alles innerhalb /img, /fonts, /styles (Beispiele für öffentliche Asset-Ordner unter /public)
     *   Diese werden typischerweise ohnehin nicht von der Middleware erfasst, aber zur Klarheit.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|$|img/|fonts/|styles/).*)',
  ],
}; 