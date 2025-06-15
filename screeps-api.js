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

    async getOverview(interval = 8) {
        return await this.request(`user/overview?interval=${interval}`);
    }

    async getWorldStatus() {
        return await this.request("game/world-status");
    }

    async getGameStats() {
        try {
            const [userInfo, rooms, overview] = await Promise.all([
                this.getUserInfo(),
                this.getUserRooms(),
                this.getOverview().catch(() => null) // Optional, falls nicht verfügbar
            ]);
            
            let totalEnergy = 0;
            let totalEnergyCapacity = 0;
            let totalCreeps = 0;
            let totalSpawns = 0;
            let totalExtensions = 0;
            let totalTowers = 0;
            let totalConstructionSites = 0;
            let totalMinerals = 0;
            let roomControlLevels = [];
            let cpuUsed = userInfo.cpu || 0;
            let cpuLimit = userInfo.cpuLimit || 20;

            rooms.forEach(room => {
                if (room.data && room.data.objects) {
                    const objects = room.data.objects;
                    
                    // Creeps zählen
                    const creeps = objects.filter(obj => obj.type === "creep");
                    totalCreeps += creeps.length;

                    // Strukturen zählen
                    const spawns = objects.filter(obj => obj.type === "spawn");
                    const extensions = objects.filter(obj => obj.type === "extension");
                    const towers = objects.filter(obj => obj.type === "tower");
                    const constructionSites = objects.filter(obj => obj.type === "constructionSite");
                    const controller = objects.find(obj => obj.type === "controller");
                    
                    totalSpawns += spawns.length;
                    totalExtensions += extensions.length;
                    totalTowers += towers.length;
                    totalConstructionSites += constructionSites.length;

                    // Controller Level
                    if (controller && controller.level) {
                        roomControlLevels.push({
                            room: room.name,
                            level: controller.level,
                            progress: controller.progress || 0,
                            progressTotal: controller.progressTotal || 0
                        });
                    }

                    // Energie berechnen
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

                    // Mineralien zählen
                    const minerals = objects.filter(obj => obj.type === "mineral");
                    totalMinerals += minerals.length;
                }
            });

            // Zusätzliche Daten aus Overview
            let overviewStats = {};
            if (overview && overview.totals) {
                overviewStats = {
                    creepsProduced: overview.totals.creepsProduced || 0,
                    energyHarvested: overview.totals.energyHarvested || 0,
                    energyConstruction: overview.totals.energyConstruction || 0,
                    energyControl: overview.totals.energyControl || 0,
                    energyCreeps: overview.totals.energyCreeps || 0
                };
            }

            return {
                // Basis-Statistiken
                energy: totalEnergy,
                energyCapacity: totalEnergyCapacity,
                creeps: totalCreeps,
                cpu: cpuUsed,
                cpuLimit: cpuLimit,
                rooms: rooms.length,
                roomsData: rooms,
                
                // Erweiterte Statistiken
                spawns: totalSpawns,
                extensions: totalExtensions,
                towers: totalTowers,
                constructionSites: totalConstructionSites,
                minerals: totalMinerals,
                roomControlLevels: roomControlLevels,
                
                // Benutzer-Info
                gcl: userInfo.gcl || 0,
                credits: userInfo.credits || 0,
                
                // Overview-Statistiken
                ...overviewStats,
                
                // Berechnete Werte
                energyPercentage: totalEnergyCapacity > 0 ? Math.round((totalEnergy / totalEnergyCapacity) * 100) : 0,
                cpuPercentage: cpuLimit > 0 ? Math.round((cpuUsed / cpuLimit) * 100) : 0,
                avgRoomLevel: roomControlLevels.length > 0 ? 
                    Math.round(roomControlLevels.reduce((sum, room) => sum + room.level, 0) / roomControlLevels.length * 10) / 10 : 0
            };
        } catch (error) {
            console.error('Failed to get game stats:', error);
            throw error;
        }
    }
} 