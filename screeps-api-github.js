class ScreepsAPI {
    constructor() {
        // For GitHub Pages - use direct API connection
        this.baseUrl = "https://screeps.com/api/";
        this.token = null;
        this.isConnected = false;
        
        // Detect environment
        this.environment = this.detectEnvironment();
        console.log(`🌐 Environment: ${this.environment}`);
        
        if (this.environment === 'github-pages') {
            console.log('✅ GitHub Pages detected - CORS should work!');
        } else if (this.environment === 'localhost') {
            console.warn('⚠️ Localhost detected - CORS errors expected');
            console.log('💡 For local development, use: python3 proxy-server.py');
        }
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('github.io')) {
            return 'github-pages';
        } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'localhost';
        } else if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
            return 'serverless';
        } else {
            return 'other';
        }
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
        this.baseUrl = url.endsWith("/") ? url : url + "/";
        localStorage.setItem("screeps_server", this.baseUrl);
    }

    getServerUrl() {
        const stored = localStorage.getItem("screeps_server");
        if (stored) {
            this.baseUrl = stored;
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

        console.log(`📡 API Request: ${url}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                mode: 'cors',
                credentials: 'omit'
            });

            console.log(`📡 API Response: ${response.status} ${response.statusText}`);

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
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                if (this.environment === 'localhost') {
                    throw new Error('❌ CORS-Fehler auf Localhost. Lösungen:\n1. Nutze: python3 proxy-server.py\n2. Oder installiere Browser-Extension "CORS Unblock"\n3. Oder deploye auf GitHub Pages');
                } else if (this.environment === 'github-pages') {
                    throw new Error('❌ Unerwarteter CORS-Fehler auf GitHub Pages. Bitte überprüfe:\n1. Repository ist öffentlich\n2. API-Token ist korrekt\n3. Internetverbindung ist stabil');
                } else {
                    throw new Error('❌ CORS-Fehler. Versuche:\n1. GitHub Pages oder Vercel\n2. Browser-Extension "CORS Unblock"\n3. Lokalen Proxy-Server');
                }
            }
            
            throw error;
        }
    }

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
            console.log('🔍 Testing connection to Screeps API...');
            const userInfo = await this.getUserInfo();
            console.log('✅ Connection successful!', userInfo);
            this.isConnected = true;
            return true;
        } catch (error) {
            console.error('❌ Connection failed:', error);
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