class ScreepsAPI {
    constructor() {
        // Direct connection to Screeps API (GitHub Pages compatible)
        this.baseUrl = "https://screeps.com/api/";
        this.token = null;
        this.isConnected = false;
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
                throw new Error('CORS-Problem: Direkte API-Anfragen blockiert. Lösung: Installiere eine CORS-Browser-Extension (z.B. "CORS Unblock" für Chrome oder "CORS Everywhere" für Firefox) oder verwende einen anderen Browser.');
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
            console.error('Failed to get game stats:', error);
            throw error;
        }
    }
} 