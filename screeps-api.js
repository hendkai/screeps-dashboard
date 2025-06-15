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
            console.log('Raw memory response:', memory);
            
            // FIXED: Dekomprimiere gzip-komprimierte Memory-Daten
            if (memory && memory.data && typeof memory.data === 'string' && memory.data.startsWith('gz:')) {
                try {
                    console.log('Decompressing gzipped memory data...');
                    const compressedData = memory.data.substring(3); // Entferne 'gz:' Prefix
                    
                    // Dekomprimierung im Browser mit pako (falls verfügbar) oder native Streams
                    if (typeof window !== 'undefined' && window.pako) {
                        const binaryData = atob(compressedData);
                        const uint8Array = new Uint8Array(binaryData.length);
                        for (let i = 0; i < binaryData.length; i++) {
                            uint8Array[i] = binaryData.charCodeAt(i);
                        }
                        const decompressed = window.pako.inflate(uint8Array, { to: 'string' });
                        const parsedMemory = JSON.parse(decompressed);
                        console.log('✅ Successfully decompressed memory:', parsedMemory);
                        return { data: parsedMemory };
                    } else {
                        console.warn('⚠️ pako library not available for decompression');
                        console.log('💡 Memory data is compressed but cannot be decompressed in browser');
                        return memory; // Return raw data
                    }
                } catch (decompError) {
                    console.warn('❌ Failed to decompress memory data:', decompError);
                    return memory; // Return raw data as fallback
                }
            }
            
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

    // Versuche Live-CPU-Daten über Console API zu bekommen
    async getLiveCpuData() {
        try {
            // Sende Console-Befehl um CPU-Daten zu bekommen
            const consoleResult = await this.sendConsole('JSON.stringify({used: Game.cpu.getUsed(), limit: Game.cpu.limit, bucket: Game.cpu.bucket})');
            
            // Warte kurz und hole Console-Logs
            await new Promise(resolve => setTimeout(resolve, 1000));
            const logs = await this.getConsole();
            
            if (logs && logs.messages) {
                // Suche nach der JSON-Antwort in den letzten Nachrichten
                for (let i = logs.messages.length - 1; i >= Math.max(0, logs.messages.length - 5); i--) {
                    const message = logs.messages[i];
                    if (message && typeof message === 'string' && message.includes('"used"')) {
                        try {
                            const cpuData = JSON.parse(message);
                            if (cpuData.used !== undefined) {
                                return cpuData;
                            }
                        } catch (parseError) {
                            // Ignore parse errors
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to get live CPU data:', error);
            return null;
        }
    }

    // Intelligente CPU-Schätzung basierend auf Spielzustand
    estimateCpuUsage(creepCount, roomCount, spawnCount) {
        // Basis-CPU für das Spiel
        let estimatedCpu = 0.5;
        
        // CPU pro Creep (basierend auf typischen Werten)
        estimatedCpu += creepCount * 0.3; // ~0.3 CPU pro Creep
        
        // CPU pro Raum (Room-Management)
        estimatedCpu += roomCount * 0.8; // ~0.8 CPU pro Raum
        
        // CPU für Spawning
        estimatedCpu += spawnCount * 0.2; // ~0.2 CPU pro Spawn
        
        // Zusätzliche CPU für komplexere Operationen
        if (creepCount > 10) {
            estimatedCpu += (creepCount - 10) * 0.1; // Skalierung für größere Basen
        }
        
        // Begrenze auf realistische Werte (1-15 CPU für normale Operationen)
        return Math.max(1.0, Math.min(15.0, estimatedCpu));
    }

    async getGameStats() {
        try {
            console.log('Fetching game stats...');
            
            // Hole alle verfügbaren Daten parallel (inklusive Memory für CPU-Daten)
            const [userInfo, rooms, overview, userStats, userCreeps, userStructures, memory] = await Promise.all([
                this.getUserInfo(),
                this.getUserRooms(),
                this.getOverview().catch(e => { console.warn('Overview API failed:', e); return null; }),
                this.getUserStats().catch(e => { console.warn('User stats API failed:', e); return null; }),
                this.getUserCreeps().catch(e => { console.warn('User creeps API failed:', e); return null; }),
                this.getUserStructures().catch(e => { console.warn('User structures API failed:', e); return null; }),
                this.getMemory().catch(e => { console.warn('Memory API failed:', e); return null; })
            ]);
            
            console.log('User info:', userInfo);
            console.log('Rooms data:', rooms);
            console.log('Overview data:', overview);
            console.log('User stats:', userStats);
            console.log('User creeps:', userCreeps);
            console.log('User structures:', userStructures);
            console.log('Memory data:', memory);
            
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
            // FIXED: Verwende Memory.dashboard für korrekte CPU-Daten falls verfügbar
            let cpuUsed = 0;
            let cpuLimit = userInfo.cpuLimit || userInfo.cpuShard?.shard3 || 20;
            
            // MULTI-STRATEGY CPU DATA COLLECTION
            let cpuDataSource = 'unknown';
            
            // Strategy 1: Memory.dashboard (most accurate if available AND recent)
            if (memory && memory.dashboard && memory.dashboard.stats && memory.dashboard.stats.cpu) {
                const memoryAge = memory.dashboard.lastUpdate ? (Date.now() / 1000 - memory.dashboard.lastUpdate * 3) : Infinity;
                
                // Nur verwenden wenn Memory-Daten weniger als 5 Minuten alt sind
                if (memoryAge < 300) {
                    cpuUsed = memory.dashboard.stats.cpu.used || 0;
                    cpuLimit = memory.dashboard.stats.cpu.limit || cpuLimit;
                    cpuDataSource = 'memory.dashboard';
                    console.log(`✅ Using accurate CPU data from dashboard: ${cpuUsed.toFixed(2)}/${cpuLimit} (age: ${Math.round(memoryAge)}s)`);
                } else {
                    console.log(`⚠️ Memory dashboard data too old (${Math.round(memoryAge)}s), using estimation instead`);
                    // Fall through to estimation
                }
            }
            
            // Strategy 2: Intelligent estimation (often more accurate than old memory data)
            if (cpuDataSource === 'unknown') {
                const estimatedCpu = this.estimateCpuUsage(totalCreeps, rooms.length, totalSpawns);
                cpuUsed = estimatedCpu;
                cpuDataSource = 'estimated';
                console.log(`🤖 Using estimated CPU data: ${cpuUsed.toFixed(1)}/${cpuLimit} (based on ${totalCreeps} creeps, ${rooms.length} rooms)`);
            }
            
            // Strategy 3: Try to get live CPU via console API (experimental)
            else if (this.getToken() && cpuDataSource === 'unknown') {
                try {
                    console.log('🔄 Attempting to get live CPU data via console...');
                    const liveCpuData = await this.getLiveCpuData();
                    if (liveCpuData && liveCpuData.used !== undefined) {
                        cpuUsed = liveCpuData.used;
                        cpuLimit = liveCpuData.limit || cpuLimit;
                        cpuDataSource = 'live.console';
                        console.log(`🔥 Using live CPU data: ${cpuUsed.toFixed(2)}/${cpuLimit}`);
                    } else {
                        throw new Error('No live CPU data available');
                    }
                } catch (liveError) {
                    console.warn('Live CPU data failed:', liveError.message);
                    // Fall through to next strategy
                }
            }
            
            // Strategy 4: Overview data (backup)
            if (cpuDataSource === 'unknown' && overview && overview.stats && overview.stats.cpu) {
                cpuUsed = overview.stats.cpu.used || overview.stats.cpu || 0;
                cpuLimit = overview.stats.cpu.limit || cpuLimit;
                cpuDataSource = 'overview';
                console.log(`⚠️ Using CPU data from overview: ${cpuUsed}/${cpuLimit}`);
            }
            
            // Strategy 5: Last resort fallback
            if (cpuDataSource === 'unknown') {
                if (userInfo.cpuUsed !== undefined) {
                    cpuUsed = userInfo.cpuUsed;
                    cpuDataSource = 'userInfo.cpuUsed';
                } else if (userInfo.cpu !== undefined && userInfo.cpu < cpuLimit) {
                    cpuUsed = userInfo.cpu;
                    cpuDataSource = 'userInfo.cpu';
                } else {
                    cpuUsed = cpuLimit * 0.25; // Conservative estimate
                    cpuDataSource = 'fallback';
                }
                console.log(`❌ Using fallback CPU data (${cpuDataSource}): ${cpuUsed}/${cpuLimit}`);
            }

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
                    totalStructuresFromRooms: totalSpawns + totalExtensions + totalTowers + totalStorage + totalTerminals + totalLabs,
                    cpuDataSource: cpuDataSource
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