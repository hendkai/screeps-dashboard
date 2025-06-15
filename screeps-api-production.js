class ScreepsAPI {
    constructor() {
        // Detect hosting environment and set appropriate base URL
        this.detectEnvironment();
        this.token = null;
        this.isConnected = false;
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Local development - use proxy server
            this.baseUrl = "http://localhost:8081/api/";
            this.useProxy = true;
            this.environment = 'local';
        } else if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
            // Vercel/Netlify - use serverless functions
            this.baseUrl = "/api/screeps/";
            this.useProxy = false;
            this.environment = 'serverless';
        } else if (hostname.includes('github.io')) {
            // GitHub Pages - use public CORS proxy
            this.baseUrl = "https://screeps-cors-proxy.vercel.app/api/";
            this.useProxy = false;
            this.environment = 'github-pages';
        } else {
            // Default fallback
            this.baseUrl = "https://screeps.com/api/";
            this.useProxy = false;
            this.environment = 'direct';
        }
        
        console.log(`🌐 Environment detected: ${this.environment}`);
        console.log(`📡 API Base URL: ${this.baseUrl}`);
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem("screeps_token", token);
    }

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem("screeps_token");
        }
        return this.token;
    }

    setServerUrl(url) {
        // Allow manual override
        this.baseUrl = url.endsWith("/") ? url : url + "/";
        this.useProxy = false;
        this.environment = 'custom';
        localStorage.setItem("screeps_server", this.baseUrl);
        localStorage.setItem("screeps_environment", this.environment);
    }

    getServerUrl() {
        const stored = localStorage.getItem("screeps_server");
        const storedEnv = localStorage.getItem("screeps_environment");
        
        if (stored && storedEnv) {
            this.baseUrl = stored;
            this.environment = storedEnv;
        }
        
        return this.baseUrl;
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error("API Token nicht gesetzt");
        }

        const url = this.baseUrl + endpoint;
        const headers = {
            "X-Token": token,
            "Content-Type": "application/json",
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            return data;
        } catch (error) {
            console.error("API Request failed:", error);
            
            // Provide environment-specific error messages
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                switch (this.environment) {
                    case 'local':
                        throw new Error('❌ Lokaler Proxy-Server nicht erreichbar. Starte: python3 proxy-server.py');
                    case 'serverless':
                        throw new Error('❌ Serverless-Function nicht erreichbar. Vercel/Netlify korrekt konfiguriert?');
                    case 'github-pages':
                        throw new Error('❌ CORS-Proxy nicht erreichbar. Nutze eine Browser-Extension oder hoste auf Vercel.');
                    case 'direct':
                        throw new Error('❌ CORS-Fehler: Nutze einen Proxy-Server oder Browser-Extension.'); 
                    default:
                        throw new Error('❌ Verbindung fehlgeschlagen. Überprüfe Server-URL und Internetverbindung.');
                }
            }
            
            throw error;
        }
    }

    // ... rest of the methods remain the same
    async getUserInfo() {
        return await this.request("auth/me");
    }

    async getMemory(path = "") {
        const endpoint = path ? `user/memory?path=${encodeURIComponent(path)}` : "user/memory";
        return await this.request(endpoint);
    }

    async getRoom(roomName) {
        return await this.request(`game/room-objects?room=${roomName}`);
    }

    async getUserRooms() {
        const userInfo = await this.getUserInfo();
        const rooms = [];
        
        if (userInfo.rooms) {
            for (const roomName of userInfo.rooms) {
                try {
                    const roomData = await this.getRoom(roomName);
                    rooms.push({
                        name: roomName,
                        data: roomData
                    });
                } catch (error) {
                    console.warn(`Failed to get room data for ${roomName}:`, error);
                }
            }
        }
        
        return rooms;
    }

    async getConsole() {
        return await this.request("user/console");
    }

    async sendConsole(expression) {
        return await this.request("user/console", {
            method: "POST",
            body: JSON.stringify({ expression })
        });
    }

    async testConnection() {
        try {
            await this.getUserInfo();
            this.isConnected = true;
            return true;
        } catch (error) {
            this.isConnected = false;
            throw error;
        }
    }

    async getGameStats() {
        try {
            const userInfo = await this.getUserInfo();
            const rooms = await this.getUserRooms();
            
            let totalEnergy = 0;
            let totalEnergyCapacity = 0;
            let totalCreeps = 0;
            let cpuUsed = userInfo.cpu || 0;
            let cpuLimit = userInfo.cpuLimit || 20;

            rooms.forEach(room => {
                if (room.data && room.data.objects) {
                    const creeps = room.data.objects.filter(obj => obj.type === "creep");
                    totalCreeps += creeps.length;

                    const spawns = room.data.objects.filter(obj => obj.type === "spawn");
                    const extensions = room.data.objects.filter(obj => obj.type === "extension");

                    spawns.forEach(spawn => {
                        if (spawn.store) {
                            totalEnergy += spawn.store.energy || 0;
                            totalEnergyCapacity += spawn.storeCapacity || 300;
                        }
                    });

                    extensions.forEach(ext => {
                        if (ext.store) {
                            totalEnergy += ext.store.energy || 0;
                            totalEnergyCapacity += ext.storeCapacity || 50;
                        }
                    });
                }
            });

            return {
                energy: totalEnergy,
                energyCapacity: totalEnergyCapacity,
                creeps: totalCreeps,
                cpu: cpuUsed,
                cpuLimit: cpuLimit,
                rooms: rooms.length,
                roomsData: rooms
            };
        } catch (error) {
            console.error("Failed to get game stats:", error);
            throw error;
        }
    }
} 