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
        try {
            // Versuche zuerst die user/rooms API
            const roomsResponse = await this.request("user/rooms").catch(() => null);
            if (roomsResponse && roomsResponse.rooms) {
                const rooms = [];
                for (const roomName of Object.keys(roomsResponse.rooms)) {
                    try {
                        const roomData = await this.getRoom(roomName);
                        rooms.push({
                            name: roomName,
                            data: roomData,
                            info: roomsResponse.rooms[roomName]
                        });
                    } catch (error) {
                        console.warn(`Failed to get room data for ${roomName}:`, error);
                        // Füge Raum trotzdem hinzu, auch ohne detaillierte Daten
                        rooms.push({
                            name: roomName,
                            data: null,
                            info: roomsResponse.rooms[roomName]
                        });
                    }
                }
                return rooms;
            }

            // Fallback: Verwende userInfo
            const userInfo = await this.getUserInfo();
            const rooms = [];
            
            if (userInfo.rooms) {
                for (const roomName of userInfo.rooms) {
                    try {
                        const roomData = await this.getRoom(roomName);
                        rooms.push({
                            name: roomName,
                            data: roomData,
                            info: null
                        });
                    } catch (error) {
                        console.warn(`Failed to get room data for ${roomName}:`, error);
                    }
                }
            }
            
            return rooms;
        } catch (error) {
            console.error('Failed to get user rooms:', error);
            return [];
        }
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

    async getUserStats() {
        return await this.request("user/stats");
    }

    async getUserBadges() {
        return await this.request("user/badge");
    }

    async getMarketOrders() {
        return await this.request("game/market/orders");
    }

    async getMarketHistory(resourceType) {
        return await this.request(`game/market/history?resourceType=${resourceType}`);
    }

    async getUserMoney() {
        return await this.request("user/money-history");
    }

    async getGameStats() {
        try {
            console.log('Fetching game stats...');
            
            // Hole alle verfügbaren Daten parallel
            const [userInfo, rooms, overview, userStats] = await Promise.all([
                this.getUserInfo(),
                this.getUserRooms(),
                this.getOverview().catch(e => { console.warn('Overview API failed:', e); return null; }),
                this.getUserStats().catch(e => { console.warn('User stats API failed:', e); return null; })
            ]);
            
            console.log('User info:', userInfo);
            console.log('Rooms data:', rooms);
            console.log('Overview data:', overview);
            console.log('User stats:', userStats);
            
            let totalEnergy = 0;
            let totalEnergyCapacity = 0;
            let totalCreeps = 0;
            let totalSpawns = 0;
            let totalExtensions = 0;
            let totalTowers = 0;
            let totalConstructionSites = 0;
            let totalMinerals = 0;
            let totalStorage = 0;
            let totalTerminals = 0;
            let totalLabs = 0;
            let roomControlLevels = [];
            
            // CPU-Daten aus verschiedenen Quellen
            let cpuUsed = userInfo.cpu || 0;
            let cpuLimit = userInfo.cpuLimit || userInfo.cpuShard?.shard3 || 20;

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
                    const storage = objects.filter(obj => obj.type === "storage");
                    const terminals = objects.filter(obj => obj.type === "terminal");
                    const labs = objects.filter(obj => obj.type === "lab");
                    const controller = objects.find(obj => obj.type === "controller");
                    
                    totalSpawns += spawns.length;
                    totalExtensions += extensions.length;
                    totalTowers += towers.length;
                    totalConstructionSites += constructionSites.length;
                    totalStorage += storage.length;
                    totalTerminals += terminals.length;
                    totalLabs += labs.length;

                    // Controller Level
                    if (controller) {
                        roomControlLevels.push({
                            room: room.name,
                            level: controller.level || 0,
                            progress: controller.progress || 0,
                            progressTotal: controller.progressTotal || 0,
                            ticksToDowngrade: controller.ticksToDowngrade || 0,
                            upgradeBlocked: controller.upgradeBlocked || 0
                        });
                    }

                    // Energie aus verschiedenen Quellen berechnen
                    spawns.forEach(spawn => {
                        if (spawn.store) {
                            totalEnergy += spawn.store.energy || 0;
                            totalEnergyCapacity += spawn.storeCapacity || 300;
                        } else if (spawn.energy !== undefined) {
                            totalEnergy += spawn.energy || 0;
                            totalEnergyCapacity += spawn.energyCapacity || 300;
                        }
                    });

                    extensions.forEach(ext => {
                        if (ext.store) {
                            totalEnergy += ext.store.energy || 0;
                            totalEnergyCapacity += ext.storeCapacity || 50;
                        } else if (ext.energy !== undefined) {
                            totalEnergy += ext.energy || 0;
                            totalEnergyCapacity += ext.energyCapacity || 50;
                        }
                    });

                    // Storage und Terminal Energie
                    storage.forEach(store => {
                        if (store.store && store.store.energy) {
                            totalEnergy += store.store.energy;
                            totalEnergyCapacity += store.storeCapacity || 1000000;
                        }
                    });

                    terminals.forEach(terminal => {
                        if (terminal.store && terminal.store.energy) {
                            totalEnergy += terminal.store.energy;
                            totalEnergyCapacity += terminal.storeCapacity || 300000;
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

            const result = {
                // Basis-Statistiken
                energy: totalEnergy,
                energyCapacity: totalEnergyCapacity,
                creeps: totalCreeps,
                cpu: cpuUsed,
                cpuLimit: cpuLimit,
                rooms: rooms.length,
                roomsData: rooms,
                
                // Erweiterte Strukturen
                spawns: totalSpawns,
                extensions: totalExtensions,
                towers: totalTowers,
                constructionSites: totalConstructionSites,
                minerals: totalMinerals,
                storage: totalStorage,
                terminals: totalTerminals,
                labs: totalLabs,
                roomControlLevels: roomControlLevels,
                
                // Benutzer-Info aus verschiedenen Quellen
                gcl: userInfo.gcl || 0,
                credits: userInfo.credits || userInfo.money || 0,
                subscriptionTokens: userInfo.subscriptionTokens || 0,
                powerExperimentations: userInfo.powerExperimentations || 0,
                
                // Badge-Info
                badge: userInfo.badge || {},
                
                // Overview-Statistiken
                ...overviewStats,
                
                // Berechnete Werte
                energyPercentage: totalEnergyCapacity > 0 ? Math.round((totalEnergy / totalEnergyCapacity) * 100) : 0,
                cpuPercentage: cpuLimit > 0 ? Math.round((cpuUsed / cpuLimit) * 100) : 0,
                avgRoomLevel: roomControlLevels.length > 0 ? 
                    Math.round(roomControlLevels.reduce((sum, room) => sum + room.level, 0) / roomControlLevels.length * 10) / 10 : 0,
                
                // Zusätzliche Metriken
                totalStructures: totalSpawns + totalExtensions + totalTowers + totalStorage + totalTerminals + totalLabs,
                energyEfficiency: totalEnergyCapacity > 0 ? Math.round((totalEnergy / totalEnergyCapacity) * 100) : 0,
                
                // Debug-Info
                debug: {
                    userInfoKeys: Object.keys(userInfo),
                    roomCount: rooms.length,
                    hasOverview: !!overview,
                    hasUserStats: !!userStats
                }
            };
            
            console.log('Final game stats:', result);
            return result;
        } catch (error) {
            console.error('Failed to get game stats:', error);
            throw error;
        }
    }
} 