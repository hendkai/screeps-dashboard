# Firebase Setup für Screeps Dashboard

## Übersicht

Das Screeps Dashboard unterstützt jetzt Firebase für Benutzerauthentifizierung und Datenspeicherung. Dies ermöglicht:

- **Benutzer-Login** mit Google oder E-Mail
- **Sichere API-Key Speicherung** pro Benutzer
- **Historische Datensammlung** aller API-Abfragen
- **Offline-Zugriff** auf bereits gesammelte Daten

## Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Klicke auf "Projekt hinzufügen"
3. Gib einen Projektnamen ein (z.B. "screeps-dashboard")
4. Aktiviere Google Analytics (optional)
5. Erstelle das Projekt

## Authentication einrichten

1. Gehe zu **Authentication** > **Sign-in method**
2. Aktiviere **Google** als Anbieter
3. Aktiviere **E-Mail/Passwort** als Anbieter
4. Füge deine Domain zu den autorisierten Domains hinzu:
   - `localhost` (für lokale Entwicklung)
   - `hendkai.github.io` (für GitHub Pages)

## Firestore Database einrichten

1. Gehe zu **Firestore Database**
2. Klicke auf "Datenbank erstellen"
3. Wähle **Testmodus** (später auf Produktionsmodus umstellen)
4. Wähle eine Region (z.B. europe-west3)

### Firestore Sicherheitsregeln

Ersetze die Standard-Regeln mit:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users können nur ihre eigenen Daten lesen/schreiben
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Game data ist nur für den jeweiligen Benutzer zugänglich
    match /gameData/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Firebase Konfiguration

1. Gehe zu **Projekteinstellungen** (Zahnrad-Symbol)
2. Scrolle zu "Deine Apps" und klicke auf "Web-App hinzufügen"
3. Gib einen App-Namen ein
4. Kopiere die Firebase-Konfiguration

## Konfiguration in das Dashboard einbauen

Bearbeite `firebase-config.js` und ersetze die Platzhalter-Werte:

```javascript
const firebaseConfig = {
    apiKey: "dein-api-key",
    authDomain: "dein-projekt.firebaseapp.com",
    projectId: "dein-projekt-id",
    storageBucket: "dein-projekt.appspot.com",
    messagingSenderId: "123456789",
    appId: "deine-app-id"
};
```

## Datenstruktur

### Users Collection
```
/users/{userId}
├── email: string
├── apiKey: string (verschlüsselt)
└── lastUpdated: timestamp
```

### Game Data Collection
```
/gameData/{userId}/
├── stats/{timestamp}
│   ├── data: object (Spielstatistiken)
│   ├── timestamp: timestamp
│   └── userId: string
└── rooms/{timestamp}
    ├── data: array (Raumdaten)
    ├── timestamp: timestamp
    └── userId: string
```

## Funktionen

### Automatische Datenspeicherung
- Alle 5 Minuten werden aktuelle Daten automatisch gespeichert
- Historische Daten werden für Vergleiche und Trends verwendet
- Lokaler Cache für Offline-Zugriff

### Datenexport
- Benutzer können ihre gesammelten Daten als JSON exportieren
- Nützlich für Backups oder externe Analysen

### Historische Ansicht
- Zeigt Datentrends über Zeit
- Vergleich verschiedener Zeiträume
- Performance-Analyse

## Deployment

### GitHub Pages
Das Dashboard funktioniert direkt auf GitHub Pages mit Firebase:

1. Konfiguriere Firebase wie oben beschrieben
2. Committe alle Änderungen
3. Pushe zu GitHub
4. GitHub Pages wird automatisch aktualisiert

### Lokale Entwicklung
Für lokale Tests:

```bash
# Einfacher HTTP-Server
python -m http.server 8000
# oder
npx serve .
```

## Sicherheit

### Produktions-Firestore-Regeln
Für Produktion sollten strengere Regeln verwendet werden:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId
        && request.auth.token.email_verified == true;
    }
    
    match /gameData/{userId}/{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId
        && request.auth.token.email_verified == true;
      
      // Begrenze Schreibvorgänge
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.time < timestamp.date(2025, 12, 31); // Ablaufdatum
    }
  }
}
```

### API-Key Verschlüsselung
Für zusätzliche Sicherheit können API-Keys verschlüsselt gespeichert werden:

```javascript
// Beispiel für Client-seitige Verschlüsselung
async function encryptApiKey(apiKey, userPassword) {
    // Implementierung mit Web Crypto API
    // Nur als Beispiel - in Produktion sollte server-seitige Verschlüsselung verwendet werden
}
```

## Troubleshooting

### Häufige Probleme

1. **CORS-Fehler**: Stelle sicher, dass deine Domain in Firebase autorisiert ist
2. **Firestore-Berechtigungen**: Überprüfe die Sicherheitsregeln
3. **API-Limits**: Firebase hat kostenlose Limits - überwache die Nutzung

### Debug-Modus
Aktiviere Debug-Logs in der Browser-Konsole:

```javascript
// In firebase-config.js
firebase.firestore.setLogLevel('debug');
```

## Kosten

Firebase bietet großzügige kostenlose Limits:
- **Authentication**: 10.000 Verifizierungen/Monat
- **Firestore**: 50.000 Lese-/20.000 Schreibvorgänge/Tag
- **Hosting**: 10 GB Speicher, 360 MB/Tag Transfer

Für ein persönliches Screeps Dashboard sind diese Limits mehr als ausreichend. 