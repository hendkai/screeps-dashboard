# 🚀 Screeps Dashboard Deployment Guide

## 🏠 Lokale Entwicklung (FUNKTIONIERT)
```bash
python3 proxy-server.py
```
➜ **http://localhost:8081**

---

## 🌐 GitHub Pages (❌ CORS-Problem)

### Problem:
- GitHub Pages = nur statische Dateien
- Python Proxy-Server funktioniert NICHT
- CORS-Fehler beim API-Zugriff

### Lösungen:

#### **Option 1: Browser-Extension (Einfachste Lösung)**
1. Installiere "CORS Unblock" Extension
2. Aktiviere die Extension
3. Dashboard auf GitHub Pages verwenden

#### **Option 2: Zu Vercel migrieren (Empfohlen)**
```bash
# 1. Vercel CLI installieren
npm i -g vercel

# 2. Dashboard deployen
vercel

# 3. Serverless Functions werden automatisch aktiviert
```

---

## ⚡ Vercel (✅ EMPFOHLEN)

### Setup:
1. **Repository zu Vercel connecten**
2. **Automatisches Deployment**
3. **Serverless Functions aktiv**

### Dateien:
- `api/screeps-proxy.js` - Serverless CORS-Proxy
- `vercel.json` - Konfiguration  
- `screeps-api-production.js` - Smart API-Client

### Vorteile:
- ✅ CORS-Problem gelöst
- ✅ Automatic Deployments
- ✅ CDN + Performance
- ✅ Free Plan verfügbar

---

## 🟢 Netlify (✅ Alternative)

### Setup:
```bash
# netlify.toml erstellen
[build]
  functions = "api"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/screeps/*"
  to = "/.netlify/functions/screeps-proxy?path=:splat"
  status = 200
```

---

## 🔄 Smart Environment Detection

Die neue `screeps-api-production.js` erkennt automatisch:

### 🏠 Localhost
- Nutzt Python Proxy: `http://localhost:8081/api/`

### ⚡ Vercel/Netlify  
- Nutzt Serverless Functions: `/api/screeps/`

### 🌐 GitHub Pages
- Nutzt Public CORS-Proxy: `https://screeps-cors-proxy.vercel.app/api/`

### 🔧 Custom
- Manuelle Server-URL möglich

---

## 📋 Migration Checklist

### Von GitHub Pages zu Vercel:

1. **[ ] Repository bei Vercel importieren**
   ```
   https://vercel.com/new
   ```

2. **[ ] Production API einbinden**
   ```html
   <script src="screeps-api-production.js"></script>
   ```

3. **[ ] Testen**
   - API-Token eingeben
   - Verbindung prüfen
   - Charts funktionieren?

4. **[ ] Domain setup (optional)**
   - Custom domain bei Vercel
   - SSL automatisch aktiviert

---

## ⚠️ Troubleshooting

### "Function not found"
```bash
# Vercel functions neu deployen
vercel --prod
```

### "CORS still blocked"
- Cache leeren: Ctrl+Shift+R
- Extension deaktivieren/aktivieren
- Andere Browser testen

### "API Token invalid"
- Neuen Token in Screeps generieren
- Alle Permissions aktivieren

---

## 🎯 Empfehlung

**Für Produktion: Vercel nutzen!**

- ✅ Einfaches Setup
- ✅ Automatische Deployments  
- ✅ Keine CORS-Probleme
- ✅ Schnell & zuverlässig
- ✅ Kostenlos für kleine Projekte

**Für Development: Lokaler Proxy**
- Python-Server für lokale Tests
- Schnelle Entwicklung 