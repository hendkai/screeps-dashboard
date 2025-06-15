class ScreepsAPI {
    constructor() {
        // Use direct connection to Screeps API by default (for GitHub Pages hosting)
        this.baseUrl = "https://screeps.com/api/";
        this.fallbackUrl = "https://screeps.com/api/";
        this.token = null;
        this.isConnected = false;
        this.useProxy = false; // Changed to false by default
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
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            // Custom local server
            this.baseUrl = url.endsWith("/") ? url : url + "/";
            this.useProxy = false;
        } else if (url === 'https://screeps.com/api/') {
            // Official server - check if user prefers proxy
            const useProxy = localStorage.getItem("screeps_use_proxy") === 'true';
            if (useProxy) {
                this.baseUrl = "http://localhost:8081/api/";
                this.useProxy = true;
            } else {
                this.baseUrl = "https://screeps.com/api/";
                this.useProxy = false;
            }
        } else {
            // Other server - try direct connection
            this.baseUrl = url.endsWith("/") ? url : url + "/";
            this.useProxy = false;
        }
        localStorage.setItem("screeps_server", this.baseUrl);
        localStorage.setItem("screeps_use_proxy", this.useProxy.toString());
    }

    getServerUrl() {
        const stored = localStorage.getItem("screeps_server");
        const useProxyStored = localStorage.getItem("screeps_use_proxy");
        
        if (stored) {
            this.baseUrl = stored;
            this.useProxy = useProxyStored === 'true';
        }
        return this.baseUrl;
    }

    enableProxyMode(enable = true) {
        localStorage.setItem("screeps_use_proxy", enable.toString());
        if (enable) {
            this.baseUrl = "http://localhost:8081/api/";
            this.useProxy = true;
        } else {
            this.baseUrl = "https://screeps.com/api/";
            this.useProxy = false;
        }
        localStorage.setItem("screeps_server", this.baseUrl);
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
            
            // Handle CORS errors with helpful message
            if (error.message.includes('NetworkError') || error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                if (this.useProxy) {
                    throw new Error('Proxy-Server nicht erreichbar. Starte den Proxy-Server mit: python3 proxy-server.py oder aktiviere den direkten Modus.');
                } else {
                    throw new Error('CORS-Problem: Die Screeps API blockiert direkte Anfragen. Dies kann bei einigen Browsern auftreten. Versuche den Proxy-Modus oder nutze ein Browser-Plugin zur CORS-Deaktivierung.');
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