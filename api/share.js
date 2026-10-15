import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // POST /api/share  →  { lyrics, title }  →  { id }
        if (req.method === 'POST') {
            const { lyrics, title } = req.body || {};
            if (!lyrics) return res.status(400).json({ error: 'No lyrics provided' });

            // Generate a short 8-character alphanumeric ID.
            const id = Math.random().toString(36).slice(2, 6) +
                       Math.random().toString(36).slice(2, 6);

            await kv.set(`song:${id}`, { lyrics, title: title || 'Untitled' });
            return res.status(200).json({ id });
        }

        // GET /api/share?id=xxxx  →  { lyrics, title }
        if (req.method === 'GET') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'No id provided' });

            const data = await kv.get(`song:${id}`);
            if (!data) return res.status(404).json({ error: 'Song not found' });
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Share API failed:', error);
        return res.status(500).json({ error: 'Share service is unavailable. Check the KV database configuration.' });
    }
}
