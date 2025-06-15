class ScreepsAPI {
    constructor() {
        // Direct connection to Screeps API (GitHub Pages compatible)
        this.baseUrl = "https://screeps.com/api/";
        this.token = null;
        this.isConnected = false;
        this.shard = null; // Will be auto-detected from user info
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

    needsShardParameter(endpoint) {
        // List of endpoints that require shard parameter
        const shardEndpoints = [
            'user/memory',
            'user/overview',
            'user/rooms',
            'user/creeps',
            'user/structures',
            'user/stats',
            'game/room-objects',
            'game/room-terrain',
            'game/room-status'
        ];
        
        return shardEndpoints.some(shardEndpoint => endpoint.startsWith(shardEndpoint));
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error("API Token nicht gesetzt");
        }

        // Add shard parameter if available and endpoint needs it
        let finalEndpoint = endpoint;
        if (this.shard && this.needsShardParameter(endpoint)) {
            const separator = endpoint.includes('?') ? '&' : '?';
            finalEndpoint = `${endpoint}${separator}shard=${this.shard}`;
        }

        const url = this.baseUrl + finalEndpoint;
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
        const userInfo = await this.request("auth/me");
        
        // Auto-detect shard from user info
        if (userInfo && userInfo.cpuShard && !this.shard) {
            const shards = Object.keys(userInfo.cpuShard);
            if (shards.length > 0) {
                this.shard = shards[0]; // Use first available shard
                console.log(`Auto-detected shard: ${this.shard}`);
            }
        }
        
        return userInfo;
    }

    async getMemory() {
        try {
            console.log('Fetching memory data...');
            const memory = await this.request("user/memory");
            console.log('Memory response:', memory);
            return memory;
        } catch (error) {
            console.warn('Failed to get memory:', error);
            throw error;
        }
    }

    async getGameTime() {
        return await this.request("game/time");
    }

    async getUserCreeps() {
        try {
            console.log('Trying to get creeps data...');
            
            // Hole Räume und zähle Creeps direkt aus den Raum-Objekten
            const rooms = await this.getUserRooms();
            let totalCreeps = 0;
            const creepNames = [];
            
            for (const room of rooms) {
                if (room.data && room.data.objects) {
                    const roomCreeps = room.data.objects.filter(obj => obj.type === 'creep');
                    totalCreeps += roomCreeps.length;
                    roomCreeps.forEach(creep => {
                        if (creep.name) {
                            creepNames.push(creep.name);
                        }
                    });
                    console.log(`Found ${roomCreeps.length} creeps in room ${room.name}`);
                }
            }
            
            if (totalCreeps > 0) {
                console.log(`Total creeps found: ${totalCreeps}`, creepNames);
                return { creeps: creepNames, source: 'rooms', count: totalCreeps };
            }
            
            // Fallback: Versuche Memory
            try {
                const memoryData = await this.request('user/memory');
                if (memoryData && memoryData.data) {
                    // Memory ist gzip-komprimiert, aber wir können trotzdem versuchen es zu parsen
                    console.log('Memory data received, but it appears to be compressed');
                }
            } catch (error) {
                console.warn('Memory fallback failed:', error);
            }
            
            console.log('No creeps found');
            return { creeps: [], source: 'none', count: 0 };
        } catch (error) {
            console.warn('Failed to get creeps data:', error);
            return { creeps: [], source: 'error', count: 0 };
        }
    }

    async getUserStructures() {
        try {
            const structures = await this.request("user/structures").catch(() => null);
            if (structures) {
                console.log('Structures from user/structures:', structures);
                return structures;
            }
            return null;
        } catch (error) {
            console.warn('Failed to get structures data:', error);
            return null;
        }
    }



    async getRoom(roomName) {
        try {
            console.log(`Trying to get room data for: ${roomName}`);
            
            // Versuche den korrekten Screeps API Endpunkt
            const roomData = await this.request(`game/room-objects?room=${roomName}&encoded=false`).catch(e => {
                console.warn(`game/room-objects failed for ${roomName}:`, e);
                return null;
            });
            
            if (roomData) {
                console.log(`Room data for ${roomName}:`, roomData);
                return roomData;
            }
            
            // Fallback: Versuche ohne encoded Parameter
            const roomDataSimple = await this.request(`game/room-objects?room=${roomName}`).catch(e => {
                console.warn(`Simple room-objects failed for ${roomName}:`, e);
                return null;
            });
            
            if (roomDataSimple) {
                console.log(`Simple room data for ${roomName}:`, roomDataSimple);
                return roomDataSimple;
            }
            
            return { objects: [] };
        } catch (error) {
            console.warn(`Failed to get room data for ${roomName}:`, error);
            return { objects: [] };
        }
    }

    async getUserRooms() {
        try {
            console.log('Fetching user rooms...');
            
            // Hole Benutzer-Informationen und Overview
            const [userInfo, overview] = await Promise.all([
                this.getUserInfo(),
                this.getOverview().catch(e => { console.warn('Overview failed:', e); return null; })
            ]);
            
            console.log('User info:', userInfo);
            console.log('Overview:', overview);
            
            const rooms = [];
            let roomNames = [];
            
            // Primär: Verwende Overview-Daten (zuverlässigste Quelle)
            if (overview && overview.shards && this.shard) {
                const shardData = overview.shards[this.shard];
                if (shardData && shardData.rooms && Array.isArray(shardData.rooms)) {
                    roomNames = shardData.rooms;
                    console.log(`Found ${roomNames.length} rooms in overview for ${this.shard}:`, roomNames);
                }
            }
            
            // Fallback: Extrahiere Raumnamen aus userInfo
            if (roomNames.length === 0) {
                if (userInfo.rooms && Array.isArray(userInfo.rooms)) {
                    roomNames = userInfo.rooms;
                    console.log('Room names from userInfo.rooms array:', roomNames);
                } else if (userInfo.rooms && typeof userInfo.rooms === 'object') {
                    roomNames = Object.keys(userInfo.rooms);
                    console.log('Room names from userInfo.rooms object:', roomNames);
                } else if (userInfo.shards) {
                    // Screeps verwendet oft shard-basierte Struktur
                    Object.keys(userInfo.shards).forEach(shardName => {
                        const shard = userInfo.shards[shardName];
                        console.log(`Checking shard ${shardName}:`, shard);
                        if (shard.rooms && Array.isArray(shard.rooms)) {
                            roomNames = roomNames.concat(shard.rooms);
                            console.log(`Found rooms in shard ${shardName}:`, shard.rooms);
                        }
                    });
                }
            }
            
            // Hole Daten für jeden Raum
            for (const roomName of roomNames) {
                try {
                    console.log(`Fetching data for room: ${roomName}`);
                    const roomData = await this.getRoom(roomName);
                    
                    rooms.push({
                        name: roomName,
                        data: roomData,
                        info: null
                    });
                    console.log(`Successfully fetched data for room: ${roomName}`, roomData);
                } catch (error) {
                    console.warn(`Failed to get room data for ${roomName}:`, error);
                    // Füge Raum trotzdem hinzu, auch ohne detaillierte Daten
                    rooms.push({
                        name: roomName,
                        data: { objects: [] },
                        info: null
                    });
                }
            }
            
            console.log('Final rooms data:', rooms);
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

    async getUserStats(interval = 8) {
        return await this.request(`user/stats?interval=${interval}`);
    }

    // Get room objects for visualization
    async getRoomObjects(roomName) {
        return await this.request(`game/room-objects`, { room: roomName });
    }

    // Get room terrain for visualization
    async getRoomTerrain(roomName) {
        return await this.request(`game/room-terrain`, { room: roomName });
    }

    async getUserBadges() {
        // Badge info is available in getUserInfo(), no separate endpoint needed
        const userInfo = await this.getUserInfo();
        return userInfo.badge || {};
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
            const [userInfo, rooms, overview, userStats, userCreeps, userStructures] = await Promise.all([
                this.getUserInfo(),
                this.getUserRooms(),
                this.getOverview().catch(e => { console.warn('Overview API failed:', e); return null; }),
                this.getUserStats().catch(e => { console.warn('User stats API failed:', e); return null; }),
                this.getUserCreeps().catch(e => { console.warn('User creeps API failed:', e); return null; }),
                this.getUserStructures().catch(e => { console.warn('User structures API failed:', e); return null; })
            ]);
            
            console.log('User info:', userInfo);
            console.log('Rooms data:', rooms);
            console.log('Overview data:', overview);
            console.log('User stats:', userStats);
            console.log('User creeps:', userCreeps);
            console.log('User structures:', userStructures);
            
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
                console.log(`Processing room: ${room.name}`, room.data);
                
                // Behandle verschiedene Datenstrukturen
                let objects = [];
                if (room.data && room.data.objects) {
                    objects = room.data.objects;
                } else if (room.data && Array.isArray(room.data)) {
                    objects = room.data;
                } else if (room.info) {
                    // Verwende room.info falls verfügbar
                    console.log(`Using room info for ${room.name}:`, room.info);
                }
                
                if (objects && objects.length > 0) {
                    
                    // Creeps zählen
                    const creeps = objects.filter(obj => obj.type === "creep");
                    totalCreeps += creeps.length;
                    console.log(`Found ${creeps.length} creeps in room ${room.name}`);

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
                } else {
                    console.log(`No objects found for room: ${room.name}`);
                    // Auch ohne Objekte zählen wir den Raum als existent
                    // Falls room.info verfügbar ist, können wir daraus Daten extrahieren
                    if (room.info) {
                        // Hier könnten wir room.info Daten verwenden falls verfügbar
                        console.log(`Room info available for ${room.name}:`, room.info);
                    }
                }
            });
            
            // Verbesserte Creep-Zählung mit der neuen getUserCreeps Methode
            if (userCreeps && userCreeps.count !== undefined) {
                console.log(`Creep data from ${userCreeps.source}: ${userCreeps.count} creeps`);
                
                if (userCreeps.source === 'memory' || userCreeps.source === 'overview') {
                    // Memory und Overview haben Priorität über Raum-basierte Zählung
                    totalCreeps = userCreeps.count;
                    console.log(`Using ${userCreeps.source} creep count: ${totalCreeps}`);
                } else if (userCreeps.source === 'api') {
                    // API-Zählung als Fallback
                    if (userCreeps.count > totalCreeps) {
                        console.log(`Using API creep count (${userCreeps.count}) instead of room-based count (${totalCreeps})`);
                        totalCreeps = userCreeps.count;
                    }
                } else if (userCreeps.source === 'none' || userCreeps.source === 'error') {
                    console.log(`No reliable creep data found, using room-based count: ${totalCreeps}`);
                }
            } else {
                console.log(`Using room-based creep count: ${totalCreeps}`);
            }
            
            // Alternative Struktur-Zählung aus direkten API-Endpunkten
            if (userStructures) {
                console.log('Processing user structures data:', userStructures);
                
                if (userStructures.structures) {
                    const structures = userStructures.structures;
                    if (Array.isArray(structures)) {
                        structures.forEach(structure => {
                            switch(structure.type) {
                                case 'spawn': totalSpawns++; break;
                                case 'extension': totalExtensions++; break;
                                case 'tower': totalTowers++; break;
                                case 'storage': totalStorage++; break;
                                case 'terminal': totalTerminals++; break;
                                case 'lab': totalLabs++; break;
                            }
                            
                            // Energie aus Strukturen
                            if (structure.store && structure.store.energy) {
                                totalEnergy += structure.store.energy;
                                totalEnergyCapacity += structure.storeCapacity || 0;
                            } else if (structure.energy !== undefined) {
                                totalEnergy += structure.energy;
                                totalEnergyCapacity += structure.energyCapacity || 0;
                            }
                        });
                        
                        console.log(`Found ${structures.length} structures via API`);
                    }
                }
            }
            
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
            
            // Fallback: Verwende Overview-Daten für Raum-Informationen falls verfügbar
            if (overview && overview.shards) {
                Object.keys(overview.shards).forEach(shardName => {
                    const shard = overview.shards[shardName];
                    if (shard.rooms && Array.isArray(shard.rooms)) {
                        // Aktualisiere Raum-Anzahl falls mehr Räume in Overview gefunden werden
                        if (shard.rooms.length > rooms.length) {
                            console.log(`Found more rooms in overview: ${shard.rooms.length} vs ${rooms.length}`);
                            // Füge fehlende Räume hinzu
                            shard.rooms.forEach(roomName => {
                                if (!rooms.find(r => r.name === roomName)) {
                                    rooms.push({
                                        name: roomName,
                                        data: { objects: [] },
                                        info: null
                                    });
                                }
                            });
                        }
                    }
                    
                    // Extrahiere Statistiken aus Overview falls verfügbar
                    if (shard.stats) {
                        Object.keys(shard.stats).forEach(roomName => {
                            const roomStats = shard.stats[roomName];
                            if (roomStats && Array.isArray(roomStats)) {
                                // Verwende die neuesten Statistiken
                                const latestStats = roomStats[roomStats.length - 1];
                                if (latestStats && latestStats.value) {
                                    // Diese könnten Energie-Werte oder andere Metriken enthalten
                                    console.log(`Room stats for ${roomName}:`, latestStats);
                                }
                            }
                        });
                    }
                });
            }

            // Fallback-Werte falls keine Daten gefunden wurden
            const finalRoomCount = Math.max(rooms.length, 
                overview?.shards ? Object.values(overview.shards).reduce((sum, shard) => 
                    sum + (shard.rooms ? shard.rooms.length : 0), 0) : 0);
            
            const result = {
                // Basis-Statistiken
                energy: totalEnergy,
                energyCapacity: totalEnergyCapacity,
                creeps: totalCreeps,
                cpu: cpuUsed,
                cpuLimit: cpuLimit,
                rooms: finalRoomCount,
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
                    hasUserStats: !!userStats,
                    hasUserCreeps: !!userCreeps,
                    hasUserStructures: !!userStructures,
                    totalCreepsFromRooms: totalCreeps,
                    totalStructuresFromRooms: totalSpawns + totalExtensions + totalTowers + totalStorage + totalTerminals + totalLabs
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