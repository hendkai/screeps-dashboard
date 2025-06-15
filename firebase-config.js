// Firebase Configuration
const firebaseConfig = {
    // Diese Werte müssen durch echte Firebase-Konfiguration ersetzt werden
    apiKey: "your-api-key",
    authDomain: "screeps-dashboard.firebaseapp.com",
    projectId: "screeps-dashboard",
    storageBucket: "screeps-dashboard.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.user = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            // Firebase SDK wird über CDN geladen
            if (typeof firebase === 'undefined') {
                console.error('Firebase SDK not loaded');
                return false;
            }

            this.app = firebase.initializeApp(firebaseConfig);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Auth state listener
            this.auth.onAuthStateChanged((user) => {
                this.user = user;
                this.onAuthStateChanged(user);
            });

            this.isInitialized = true;
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            return false;
        }
    }

    onAuthStateChanged(user) {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        const userInfo = document.getElementById('userInfo');

        if (user) {
            console.log('User logged in:', user.email);
            if (loginSection) loginSection.style.display = 'none';
            if (dashboardSection) dashboardSection.style.display = 'block';
            if (userInfo) userInfo.textContent = user.email;
            
            // Load user's API key and data
            this.loadUserData();
        } else {
            console.log('User logged out');
            if (loginSection) loginSection.style.display = 'block';
            if (dashboardSection) dashboardSection.style.display = 'none';
            if (userInfo) userInfo.textContent = '';
        }
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            console.log('Google sign-in successful:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('Google sign-in failed:', error);
            throw error;
        }
    }

    async signInWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('Email sign-in successful:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('Email sign-in failed:', error);
            throw error;
        }
    }

    async signUpWithEmail(email, password) {
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            console.log('Email sign-up successful:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('Email sign-up failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            console.log('User signed out');
        } catch (error) {
            console.error('Sign-out failed:', error);
            throw error;
        }
    }

    async saveUserApiKey(apiKey) {
        if (!this.user) {
            throw new Error('User not authenticated');
        }

        try {
            await this.db.collection('users').doc(this.user.uid).set({
                email: this.user.email,
                apiKey: apiKey,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log('API key saved successfully');
        } catch (error) {
            console.error('Failed to save API key:', error);
            throw error;
        }
    }

    async getUserApiKey() {
        if (!this.user) {
            return null;
        }

        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            if (doc.exists) {
                return doc.data().apiKey;
            }
            return null;
        } catch (error) {
            console.error('Failed to get API key:', error);
            return null;
        }
    }

    async saveGameData(dataType, data) {
        if (!this.user) {
            throw new Error('User not authenticated');
        }

        try {
            const timestamp = new Date();
            await this.db.collection('gameData')
                .doc(this.user.uid)
                .collection(dataType)
                .doc(timestamp.toISOString())
                .set({
                    data: data,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: this.user.uid
                });

            console.log(`${dataType} data saved successfully`);
        } catch (error) {
            console.error(`Failed to save ${dataType} data:`, error);
            throw error;
        }
    }

    async getGameData(dataType, limit = 10) {
        if (!this.user) {
            return [];
        }

        try {
            const snapshot = await this.db.collection('gameData')
                .doc(this.user.uid)
                .collection(dataType)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const data = [];
            snapshot.forEach(doc => {
                data.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return data;
        } catch (error) {
            console.error(`Failed to get ${dataType} data:`, error);
            return [];
        }
    }

    async getLatestGameData(dataType) {
        const data = await this.getGameData(dataType, 1);
        return data.length > 0 ? data[0] : null;
    }

    async loadUserData() {
        if (!this.user) return;

        try {
            // Load API key
            const apiKey = await this.getUserApiKey();
            if (apiKey && window.dashboard) {
                window.dashboard.api.setToken(apiKey);
                console.log('API key loaded from Firebase');
            }

            // Load latest game data
            const latestStats = await this.getLatestGameData('stats');
            const latestRooms = await this.getLatestGameData('rooms');
            
            if (latestStats && window.dashboard) {
                console.log('Loading cached stats data');
                // window.dashboard.updateStats(latestStats.data);
            }

            if (latestRooms && window.dashboard) {
                console.log('Loading cached rooms data');
                // window.dashboard.updateRoomsDisplay(latestRooms.data);
            }

        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async saveCurrentGameState() {
        if (!this.user || !window.dashboard) return;

        try {
            // Save current dashboard state
            const currentStats = window.dashboard.lastStats;
            const currentRooms = window.dashboard.lastRooms;

            if (currentStats) {
                await this.saveGameData('stats', currentStats);
            }

            if (currentRooms) {
                await this.saveGameData('rooms', currentRooms);
            }

            console.log('Game state saved to Firebase');
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }

    // Auto-save every 5 minutes
    startAutoSave() {
        setInterval(() => {
            this.saveCurrentGameState();
        }, 5 * 60 * 1000); // 5 minutes
    }
}

// Global Firebase manager instance
window.firebaseManager = new FirebaseManager(); 