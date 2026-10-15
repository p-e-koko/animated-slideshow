import { createClient } from '@libsql/client';

function getDatabaseConfig() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    return {
        url,
        authToken,
        missing: [
            !url && 'TURSO_DATABASE_URL',
            !authToken && 'TURSO_AUTH_TOKEN'
        ].filter(Boolean)
    };
}

let schemaReady;
function ensureSchema(db) {
    if (!schemaReady) {
        schemaReady = db.execute(`
            CREATE TABLE IF NOT EXISTS shared_songs (
                id TEXT PRIMARY KEY,
                lyrics TEXT NOT NULL,
                title TEXT NOT NULL
            )
        `).catch(error => {
            schemaReady = undefined;
            throw error;
        });
    }
    return schemaReady;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const config = getDatabaseConfig();
    if (config.missing.length) {
        console.error(`Share API is missing: ${config.missing.join(', ')}`);
        return res.status(503).json({
            error: `Share service is not configured. Missing: ${config.missing.join(', ')}.`
        });
    }

    try {
        const db = createClient({ url: config.url, authToken: config.authToken });
        await ensureSchema(db);

        // POST /api/share  →  { lyrics, title }  →  { id }
        if (req.method === 'POST') {
            const { lyrics, title } = req.body || {};
            if (!lyrics) return res.status(400).json({ error: 'No lyrics provided' });

            // Generate a short 8-character alphanumeric ID.
            const id = Math.random().toString(36).slice(2, 6) +
                       Math.random().toString(36).slice(2, 6);

            await db.execute({
                sql: 'INSERT INTO shared_songs (id, lyrics, title) VALUES (?, ?, ?)',
                args: [id, lyrics, title || 'Untitled']
            });
            return res.status(200).json({ id });
        }

        // GET /api/share?id=xxxx  →  { lyrics, title }
        if (req.method === 'GET') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'No id provided' });

            const result = await db.execute({
                sql: 'SELECT lyrics, title FROM shared_songs WHERE id = ?',
                args: [id]
            });
            const song = result.rows[0];
            if (!song) return res.status(404).json({ error: 'Song not found' });
            return res.status(200).json({
                lyrics: String(song.lyrics),
                title: String(song.title)
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Share API failed:', error);
        return res.status(503).json({ error: 'Share service is unavailable. Check the Turso database connection.' });
    }
}
