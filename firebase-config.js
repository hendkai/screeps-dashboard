// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyALqsFl17kuvfsfFAu0dYq-KXsyuMXQkDI",
    authDomain: "screeps-dashboard-72412.firebaseapp.com",
    projectId: "screeps-dashboard-72412",
    storageBucket: "screeps-dashboard-72412.firebasestorage.app",
    messagingSenderId: "892354091133",
    appId: "1:892354091133:web:f4f842be434b439ee5b914",
    measurementId: "G-FJMJRBVX47"
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

    // Encryption utilities for API keys
    async generateUserKey(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return await crypto.subtle.importKey(
            'raw',
            hashBuffer,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encryptApiKey(apiKey, userPassword) {
        try {
            const key = await this.generateUserKey(userPassword);
            const encoder = new TextEncoder();
            const data = encoder.encode(apiKey);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );
            
            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);
            
            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt API key');
        }
    }

    async decryptApiKey(encryptedApiKey, userPassword) {
        try {
            const key = await this.generateUserKey(userPassword);
            
            // Convert from base64
            const combined = new Uint8Array(
                atob(encryptedApiKey).split('').map(char => char.charCodeAt(0))
            );
            
            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);
            
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedData
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt API key - wrong password or corrupted data');
        }
    }

    async saveUserApiKey(apiKey, userPassword = null) {
        if (!this.user) {
            throw new Error('User not authenticated');
        }

        try {
            let encryptedApiKey;
            let isEncrypted = false;

            // If user provides password, encrypt the API key
            if (userPassword) {
                encryptedApiKey = await this.encryptApiKey(apiKey, userPassword);
                isEncrypted = true;
            } else {
                // Fallback: store without encryption (less secure)
                encryptedApiKey = apiKey;
                isEncrypted = false;
            }

            await this.db.collection('users').doc(this.user.uid).set({
                email: this.user.email,
                encryptedApiKey: encryptedApiKey,
                isEncrypted: isEncrypted,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                // Add security metadata
                keyCreatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                keyVersion: '1.0'
            }, { merge: true });

            console.log('Encrypted API key saved successfully');
        } catch (error) {
            console.error('Failed to save encrypted API key:', error);
            throw error;
        }
    }

    async getUserApiKey(userPassword = null) {
        if (!this.user) {
            return null;
        }

        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            if (!doc.exists) {
                return null;
            }

            const data = doc.data();
            if (!data.encryptedApiKey) {
                return null;
            }

            // If the key is encrypted, decrypt it
            if (data.isEncrypted && userPassword) {
                return await this.decryptApiKey(data.encryptedApiKey, userPassword);
            } else if (data.isEncrypted && !userPassword) {
                throw new Error('Password required to decrypt API key');
            } else {
                // Unencrypted key (legacy or fallback)
                return data.encryptedApiKey;
            }
        } catch (error) {
            console.error('Failed to get API key:', error);
            throw error;
        }
    }

    // Generate a secure password from user's email and a master password
    generateUserPassword(masterPassword) {
        if (!this.user || !this.user.email) {
            throw new Error('User not authenticated');
        }
        
        // Combine user email with master password for unique per-user encryption
        return this.user.email + '|' + masterPassword + '|screeps-dashboard';
    }

    // Secure API key management with user-provided master password
    async saveSecureApiKey(apiKey, masterPassword) {
        const userPassword = this.generateUserPassword(masterPassword);
        return await this.saveUserApiKey(apiKey, userPassword);
    }

    async getSecureApiKey(masterPassword) {
        const userPassword = this.generateUserPassword(masterPassword);
        return await this.getUserApiKey(userPassword);
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
            // Check if user has API key stored
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            if (doc.exists && doc.data().encryptedApiKey) {
                console.log('User has API key stored, but password required for decryption');
                // The API key will be loaded when user enters their master password in the dashboard
                return;
            } else {
                console.log('No API key found for user');
                return;
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

    // Dashboard helper function - prompt for master password and load API key
    async promptForMasterPasswordAndLoadApiKey() {
        if (!this.user) {
            throw new Error('User not authenticated');
        }

        // Check if user has encrypted API key
        const doc = await this.db.collection('users').doc(this.user.uid).get();
        if (!doc.exists || !doc.data().encryptedApiKey) {
            throw new Error('No API key found. Please set up your API key first.');
        }

        const data = doc.data();
        if (!data.isEncrypted) {
            // Unencrypted key (legacy), return directly
            return data.encryptedApiKey;
        }

        // Prompt for master password
        const masterPassword = prompt('Bitte geben Sie Ihr Master-Passwort ein, um den API-Schlüssel zu entschlüsseln:');
        if (!masterPassword) {
            throw new Error('Master password required');
        }

        try {
            const apiKey = await this.getSecureApiKey(masterPassword);
            console.log('API key successfully decrypted');
            return apiKey;
        } catch (error) {
            throw new Error('Falsches Passwort oder beschädigter API-Schlüssel');
        }
    }

    // Check if user has API key (without trying to decrypt)
    async hasApiKey() {
        if (!this.user) return false;
        
        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            return doc.exists && doc.data().encryptedApiKey;
        } catch (error) {
            console.error('Error checking API key:', error);
            return false;
        }
    }
}

// Global Firebase manager instance
window.firebaseManager = new FirebaseManager(); 