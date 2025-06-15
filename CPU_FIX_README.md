# CPU Dashboard Fix - Anleitung

## Problem gelöst ✅

Das Dashboard zeigte eine flache Linie bei 20.0 CPU an, weil es das **CPU-Limit** anstatt des **tatsächlichen CPU-Verbrauchs** anzeigte.

## Implementierte Lösung

### 1. **API-Fix** (screeps-api.js)
- Dashboard lädt jetzt CPU-Daten aus `Memory.dashboard` (vom dashboard_exporter.js)
- Fallback-System für verschiedene Datenquellen
- Bessere Fehlerbehandlung und Logging

### 2. **Datenquellen-Priorität**
1. **✅ Memory.dashboard** - Genaueste Daten (von dashboard_exporter.js)
2. **⚠️ Overview API** - Backup-Quelle
3. **❌ UserInfo** - Ungenau (meist CPU-Limit statt Verbrauch)

## Sicherstellen dass es funktioniert

### Schritt 1: Dashboard-Exporter aktivieren
Der `dashboard_exporter.js` muss in deinem Screeps-Code laufen:

```javascript
// In main.js sollte stehen:
const dashboardExporter = require('dashboard_exporter');

module.exports.loop = function () {
    // ... anderer Code ...
    
    // Dashboard Data Export (alle 10 Ticks für Performance)
    if(Game.time % 10 === 0) {
        dashboardExporter.run();
    }
}
```

### Schritt 2: Prüfen ob es läuft
Im Screeps-Konsole eingeben:
```javascript
// Prüfe ob Dashboard-Daten exportiert werden
console.log(JSON.stringify(Memory.dashboard, null, 2));

// Manueller Export (zum Testen)
exportDashboard();
```

### Schritt 3: Dashboard-Logs prüfen
Im Browser-Dashboard solltest du sehen:
- `✅ Using accurate CPU data from dashboard: X.XX/20` - **Perfekt!**
- `⚠️ Using CPU data from overview: X/20` - **OK, aber weniger genau**
- `❌ Using estimated CPU data: X/20 (inaccurate)` - **Aktiviere dashboard_exporter.js!**

## Erwartete Ergebnisse

### Vorher:
- Flache Linie bei 20.0 CPU (CPU-Limit)
- Keine Variation im Chart

### Nachher:
- Realistische CPU-Werte (z.B. 2.5, 8.1, 15.3)
- Schwankende Linie je nach tatsächlichem Verbrauch
- Korrekte CPU-Prozentanzeige

## Troubleshooting

### Problem: Immer noch flache Linie
**Lösung**: Dashboard-Exporter ist nicht aktiv
```javascript
// In Screeps-Konsole prüfen:
Memory.dashboard
// Sollte Objekt mit stats.cpu.used zurückgeben
```

### Problem: CPU-Werte zu hoch/niedrig
**Lösung**: Cache-Problem im Browser
- Browser-Cache leeren (Ctrl+F5)
- Dashboard neu laden

### Problem: "Memory API failed" Fehler
**Lösung**: API-Token-Berechtigung prüfen
- Token muss Memory-Zugriff haben
- Neuen Token generieren falls nötig

## Technische Details

### CPU-Datenquellen im Detail:
```javascript
// 1. Memory.dashboard (Beste Quelle)
Memory.dashboard.stats.cpu = {
    used: Game.cpu.getUsed(),      // Tatsächlicher Verbrauch
    limit: Game.cpu.limit,         // Maximum
    bucket: Game.cpu.bucket,       // CPU-Bucket
    percentage: (used/limit)*100   // Prozent
}

// 2. Overview API (Backup)
overview.stats.cpu.used

// 3. UserInfo (Ungenau)
userInfo.cpu  // Meist das Limit, nicht Verbrauch!
```

### Chart-Update-Logik:
```javascript
// Dashboard aktualisiert CPU-Chart mit:
stats.cpu = cpuUsed;  // Jetzt korrekt!

// Chart zeigt:
this.chartData.cpu.data.push(stats.cpu);
```

## Erfolg prüfen

Das Dashboard sollte jetzt zeigen:
- **CPU-Verbrauch**: Realistische schwankende Werte
- **CPU-Chart**: Lebendige Linie statt flacher 20.0
- **CPU-Prozent**: Korrekte Berechnung (z.B. 42% statt 100%)

🎉 **CPU-Dashboard ist jetzt repariert!** 