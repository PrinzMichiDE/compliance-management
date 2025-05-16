import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool;

function getPgPool(): Pool {
    if (!pool) {
        const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
        
        pool = new Pool({
            connectionString: connectionString,
            ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
            max: 20, // Maximale Anzahl von Clients im Pool
            idleTimeoutMillis: 30000, // Wie lange ein Client im Leerlauf bleiben kann
            connectionTimeoutMillis: 2000, // Wie lange auf eine Verbindung gewartet wird
        });

        pool.on('connect', (client: PoolClient) => {
            console.log('New client connected to PostgreSQL');
            // Hier könnten initiale Abfragen pro Verbindung stehen, z.B. Timezone setzen
            // client.query('SET TIME ZONE \'UTC\'');
        });

        pool.on('error', (err: Error, client: PoolClient) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
            // process.exit(-1); // Bei kritischen Fehlern ggf. beenden
        });

        console.log(`PostgreSQL Pool created for database ${process.env.PGDATABASE}`);
    }
    return pool;
}

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
    const poolInstance = getPgPool();
    const start = Date.now();
    try {
        const res = await poolInstance.query(text, params);
        const duration = Date.now() - start;
        console.log('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (err) {
        console.error('Error executing PostgreSQL query', { text, params, error: err });
        throw err;
    }
}

// Optional: Eine Funktion, um einen Client direkt zu erhalten, falls Transaktionen benötigt werden
export async function getClient(): Promise<PoolClient> {
    const poolInstance = getPgPool();
    const client = await poolInstance.connect();
    return client;
}

// Sicherstellen, dass der Pool bei Anwendungsende geschlossen wird (wichtig für Serverless-Umgebungen ist das ggf. anders)
// Diese Logik ist eher für langlebige Server. Für Next.js API-Routen, die kurzlebig sind,
// ist das Management des Pools (Erstellung bei Bedarf) oft ausreichend.
// process.on('SIGINT', () => pool?.end().then(() => console.log('PostgreSQL pool has been closed')));
// process.on('SIGTERM', () => pool?.end().then(() => console.log('PostgreSQL pool has been closed'))); 