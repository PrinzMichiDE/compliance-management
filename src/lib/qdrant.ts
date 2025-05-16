import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL;

if (!qdrantUrl) {
  throw new Error('QDRANT_URL is not defined in the environment variables.');
}

// Erstelle eine globale Instanz des Qdrant-Clients
// Dies ist nützlich in serverlosen Umgebungen, um Verbindungen wiederzuverwenden.
let qdrantClient: QdrantClient;

if (process.env.NODE_ENV === 'production') {
  qdrantClient = new QdrantClient({
    url: qdrantUrl,
    apiKey: process.env.QDRANT_API_KEY, // Kann undefined sein, wenn nicht gesetzt
  });
} else {
  // Im Development wollen wir möglicherweise bei jeder Codeänderung eine neue Verbindung,
  // aber für die Wiederverwendung deklarieren wir sie hier ähnlich.
  // TypeScript benötigt die explizite Deklaration im globalen Scope, wenn wir
  // eine Variable auf dem globalen Objekt anhängen wollen.
  if (!(global as any)._qdrantClient) {
    (global as any)._qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  qdrantClient = (global as any)._qdrantClient;
}

export default qdrantClient; 