# Screeps Dashboard für GitHub Pages

Ein modernes Dashboard für das Screeps-Spiel, optimiert für das Hosting auf GitHub Pages.

## 🚀 Features

- **Direkte API-Kommunikation**: Funktioniert ohne Server, perfekt für GitHub Pages
- **Echtzeit-Statistiken**: Energie, CPU, Creeps, Räume
- **Interaktive Charts**: Verlaufsgrafiken für wichtige Metriken
- **Responsive Design**: Funktioniert auf Desktop und Mobile
- **Proxy-Modus**: Optional für lokale Entwicklung

## 📦 GitHub Pages Setup

1. **Repository erstellen**: Erstelle ein neues GitHub Repository
2. **Dateien hochladen**: Lade alle Dashboard-Dateien in das Repository hoch
3. **GitHub Pages aktivieren**: 
   - Gehe zu Settings → Pages
   - Wähle "Deploy from a branch"
   - Wähle "main" branch und "/ (root)"
4. **Fertig**: Dein Dashboard ist unter `https://username.github.io/repository-name` verfügbar

## 🔧 Konfiguration

1. **API Token besorgen**:
   - Gehe zu https://screeps.com/
   - Logge dich ein und gehe zu Account → Settings
   - Erstelle einen neuen API Token

2. **Dashboard konfigurieren**:
   - Öffne das Dashboard
   - Klicke auf "Konfiguration"
   - Gib deinen API Token ein
   - Speichere die Einstellungen

## 🌐 CORS-Behandlung

Das Dashboard verwendet standardmäßig den **direkten Modus**, der versucht, direkt mit der Screeps API zu kommunizieren. Bei CORS-Problemen:

### Lösung 1: Browser-Extension
Installiere eine CORS-Extension für deinen Browser:
- **Chrome**: "CORS Unblock" oder "Disable CORS"
- **Firefox**: "CORS Everywhere"

### Lösung 2: Proxy-Modus (nur lokal)
Für lokale Entwicklung kannst du den Proxy-Modus verwenden:

```bash
# Im Dashboard-Verzeichnis
python3 proxy-server.py
```

Dann klicke im Dashboard auf "Proxy-Modus".

## 📂 Projektstruktur

```
screeps-dashboard/
├── index.html              # Haupt-HTML-Datei
├── screeps-api.js          # API-Kommunikation
├── dashboard.js            # Dashboard-Logik
├── proxy-server.py         # Optional: CORS-Proxy für lokale Entwicklung
├── start-proxy.sh          # Script zum Starten des Proxys
└── README.md              # Diese Datei
```

## 🔨 Lokale Entwicklung

```bash
# Repository klonen
git clone https://github.com/username/screeps-dashboard.git
cd screeps-dashboard

# Option 1: Direkt öffnen
# Öffne index.html in deinem Browser

# Option 2: Mit lokalem Server
python3 -m http.server 8080
# Dann öffne http://localhost:8080

# Option 3: Mit CORS-Proxy
python3 proxy-server.py
# Dann aktiviere den Proxy-Modus im Dashboard
```

## 🛠️ Anpassungen

### Eigene Styles
Bearbeite die CSS-Variablen in `index.html`:

```css
:root {
    --screeps-green: #00ff88;  /* Hauptfarbe */
    --screeps-blue: #4ecdc4;   /* Akzentfarbe */
    --dark-bg: #1a1a1a;       /* Hintergrund */
    --card-bg: #2a2a2a;       /* Kartenfarbe */
}
```

### Weitere API-Endpunkte
Erweitere `screeps-api.js` um zusätzliche Funktionen:

```javascript
async getMarketOrders() {
    return await this.request("game/market/orders");
}
```

## 🚨 Fehlerbehebung

### "CORS Error" 
- Installiere eine Browser-Extension zur CORS-Deaktivierung
- Verwende den Proxy-Modus für lokale Entwicklung
- Prüfe, ob dein API Token korrekt ist

### "API Token nicht gesetzt"
- Klicke auf "Konfiguration" und gib deinen Token ein
- Überprüfe den Token auf der Screeps-Website

### "Proxy-Server nicht erreichbar"
- Stelle sicher, dass der Proxy läuft: `python3 proxy-server.py`
- Wechsle zum direkten Modus für GitHub Pages

## 📄 Lizenz

MIT License - siehe GitHub Repository für Details.

## 🤝 Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch
3. Committe deine Änderungen
4. Erstelle einen Pull Request

## 📧 Support

Bei Fragen oder Problemen erstelle ein Issue im GitHub Repository. 