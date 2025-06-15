// Vercel Serverless Function - CORS Proxy für Screeps API
// Datei: /api/screeps-proxy.js

export default async function handler(req, res) {
    // CORS Headers setzen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // OPTIONS Request (Preflight) behandeln
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // API-Pfad aus der URL extrahieren
        const { path } = req.query;
        
        if (!path) {
            return res.status(400).json({ error: 'API path is required' });
        }

        // Screeps API URL zusammenbauen
        const screepsUrl = `https://screeps.com/api/${Array.isArray(path) ? path.join('/') : path}`;
        
        // Headers aus Original-Request kopieren
        const headers = {};
        if (req.headers['x-token']) {
            headers['X-Token'] = req.headers['x-token'];
        }
        if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
        }

        // Request an Screeps API weiterleiten
        const fetchOptions = {
            method: req.method,
            headers,
        };

        // Body für POST/PUT Requests hinzufügen
        if (req.method === 'POST' || req.method === 'PUT') {
            fetchOptions.body = JSON.stringify(req.body);
        }

        // API-Anfrage an Screeps
        const response = await fetch(screepsUrl, fetchOptions);
        const data = await response.json();

        // Response zurückgeben
        res.status(response.status).json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy server error',
            message: error.message 
        });
    }
} 