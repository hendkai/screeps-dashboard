# 🚀 Screeps Dashboard Starten

## Schritt 1: Proxy-Server starten
```bash
python3 proxy-server.py
```

## Schritt 2: Dashboard öffnen
Öffne in deinem Browser: **http://localhost:8081**

## Schritt 3: API-Token eingeben
- Klicke auf das ⚙️ Zahnrad-Symbol
- Gib deinen API-Token ein: `16b0222c-47e4-482b-bf6e-6ba76994a35e`
- Klicke auf "Speichern"

## ✅ Fertig!
Das Dashboard sollte jetzt ohne CORS-Fehler funktionieren!

---

## 🔧 Problemlösung

### Problem: "Proxy-Server nicht erreichbar"
**Lösung:** Starte den Proxy-Server neu:
```bash
python3 proxy-server.py
```

### Problem: Canvas-Größenfehler
**Lösung:** Bereits behoben! Charts sind jetzt größenbeschränkt.

### Problem: API-Token funktioniert nicht
**Lösung:** 
1. Überprüfe den Token in der Screeps-Webseite
2. Erstelle einen neuen Token falls nötig
3. Stelle sicher, dass der Token alle Berechtigungen hat

---

## 📂 Dateien Übersicht
- `proxy-server.py` - CORS-Proxy-Server
- `index.html` - Haupt-Dashboard
- `test-api.html` - API-Test-Tool
- `dashboard.js` - Dashboard-Logik
- `screeps-api.js` - API-Verbindung
- `styles.css` - Design

## 🌐 URLs
- **Dashboard:** http://localhost:8081
- **API-Test:** http://localhost:8081/test-api.html 