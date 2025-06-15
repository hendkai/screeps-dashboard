// Dashboard Controller
class ScreepsDashboard {
    constructor() {
        this.api = new ScreepsAPI();
        this.updateInterval = 5000;
        this.intervalId = null;
        this.charts = {};
        this.chartData = {
            energy: { labels: [], data: [] },
            cpu: { labels: [], data: [] },
            creeps: { labels: [], data: [] }
        };
        this.maxDataPoints = 20;
        
        // Room visualization and multi-room management
        this.roomVisualization = {
            canvas: null,
            ctx: null,
            selectedRoom: null,
            roomData: null
        };
        this.roomsData = new Map();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConfig();
        this.initCharts();
        this.initRoomVisualization();
        this.initMultiRoomManagement();
        
        if (this.api.getToken()) {
            this.startUpdating();
            // Try to load a default room after a short delay
            setTimeout(() => {
                this.tryLoadDefaultRoom();
            }, 1000);
            // Try again after a longer delay in case the first attempt fails
            setTimeout(() => {
                this.tryLoadDefaultRoom();
            }, 5000);
            // Force load W26N53 for testing
            setTimeout(() => {
                console.log('Force loading W26N53 for testing...');
                this.testRoomVisualization();
            }, 3000);
        } else {
            setTimeout(() => {
                if (typeof openConfigModal === 'function') {
                    openConfigModal();
                }
                this.addConsoleMessage('info', 'Bitte konfiguriere deinen API Token um zu beginnen');
            }, 1000);
        }
    }

    setupEventListeners() {
        // Check if elements exist before adding listeners
        const serverUrlElement = document.getElementById('serverUrl');
        if (serverUrlElement) {
            serverUrlElement.addEventListener('change', (e) => {
                const customGroup = document.getElementById('customUrlGroup');
                if (customGroup) {
                    if (e.target.value === 'custom') {
                        customGroup.style.display = 'block';
                    } else {
                        customGroup.style.display = 'none';
                    }
                }
            });
        }
    }

    loadConfig() {
        const token = this.api.getToken();
        const serverUrl = this.api.getServerUrl();
        
        const tokenElement = document.getElementById('apiToken');
        if (token && tokenElement) {
            tokenElement.value = token;
        }
        
        const serverUrlElement = document.getElementById('serverUrl');
        const customUrlElement = document.getElementById('customUrl');
        const customUrlGroup = document.getElementById('customUrlGroup');
        
        if (serverUrl !== 'https://screeps.com/api/' && serverUrlElement) {
            serverUrlElement.value = 'custom';
            if (customUrlElement) customUrlElement.value = serverUrl;
            if (customUrlGroup) customUrlGroup.style.display = 'block';
        }
    }

    destroyCharts() {
        // Destroy existing charts to prevent "Canvas is already in use" error
        Object.keys(this.charts).forEach(chartKey => {
            if (this.charts[chartKey]) {
                this.charts[chartKey].destroy();
                this.charts[chartKey] = null;
            }
        });
    }

    initCharts() {
        // Destroy existing charts first
        this.destroyCharts();
        
        // Get canvas elements and set maximum dimensions
        const energyCanvas = document.getElementById('energyChart');
        const cpuCanvas = document.getElementById('cpuChart');
        const creepsCanvas = document.getElementById('creepsChart');
        const roomLevelCanvas = document.getElementById('roomLevelChart');
        
        if (!energyCanvas || !cpuCanvas) {
            console.warn('Chart canvases not found');
            return;
        }
        
        // Check if canvases are already in use by checking for existing chart instances
        const canvases = [energyCanvas, cpuCanvas, creepsCanvas, roomLevelCanvas].filter(c => c);
        canvases.forEach(canvas => {
            if (Chart.getChart(canvas)) {
                console.log(`Destroying existing chart on ${canvas.id}`);
                Chart.getChart(canvas).destroy();
            }
        });
        
        // Set maximum canvas dimensions to prevent size errors
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const maxHeight = 400;
        
        canvases.forEach(canvas => {
            canvas.style.maxWidth = maxWidth + 'px';
            canvas.style.maxHeight = maxHeight + 'px';
        });

        try {
            const energyCtx = energyCanvas.getContext('2d');
            this.charts.energy = new Chart(energyCtx, {
                type: 'line',
                data: {
                    labels: this.chartData.energy.labels,
                    datasets: [{
                        label: 'Energie',
                        data: this.chartData.energy.data,
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                    animation: {
                        duration: 0
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#00ff88' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: '#00ff88',
                                maxTicksLimit: 10
                            },
                            grid: { color: '#333333' }
                        },
                        y: {
                            ticks: { 
                                color: '#00ff88',
                                maxTicksLimit: 8
                            },
                            grid: { color: '#333333' }
                        }
                    }
                }
            });

            const cpuCtx = cpuCanvas.getContext('2d');
            this.charts.cpu = new Chart(cpuCtx, {
                type: 'line',
                data: {
                    labels: this.chartData.cpu.labels,
                    datasets: [{
                        label: 'CPU Verbrauch',
                        data: this.chartData.cpu.data,
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                    animation: {
                        duration: 0
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#00ff88' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: '#00ff88',
                                maxTicksLimit: 10
                            },
                            grid: { color: '#333333' }
                        },
                        y: {
                            ticks: { 
                                color: '#00ff88',
                                maxTicksLimit: 8
                            },
                            grid: { color: '#333333' }
                        }
                    }
                }
            });

            // Creeps Chart (falls Canvas vorhanden)
            if (creepsCanvas) {
                const creepsCtx = creepsCanvas.getContext('2d');
                this.charts.creeps = new Chart(creepsCtx, {
                    type: 'bar',
                    data: {
                        labels: this.chartData.creeps?.labels || [],
                        datasets: [{
                            label: 'Creeps Anzahl',
                            data: this.chartData.creeps?.data || [],
                            backgroundColor: 'rgba(255, 159, 64, 0.6)',
                            borderColor: '#ff9f40',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                        animation: { duration: 0 },
                        plugins: {
                            legend: { labels: { color: '#00ff88' } }
                        },
                        scales: {
                            x: {
                                ticks: { color: '#00ff88', maxTicksLimit: 10 },
                                grid: { color: '#333333' }
                            },
                            y: {
                                ticks: { color: '#00ff88', maxTicksLimit: 8 },
                                grid: { color: '#333333' }
                            }
                        }
                    }
                });
            }

            // Room Level Chart (falls Canvas vorhanden)
            if (roomLevelCanvas) {
                const roomLevelCtx = roomLevelCanvas.getContext('2d');
                this.charts.roomLevel = new Chart(roomLevelCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8'],
                        datasets: [{
                            data: [0, 0, 0, 0, 0, 0, 0, 0],
                            backgroundColor: [
                                '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0',
                                '#9966ff', '#ff9f40', '#ff6384', '#c9cbcf'
                            ],
                            borderColor: '#333333',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                        animation: { duration: 0 },
                        plugins: {
                            legend: { 
                                labels: { color: '#00ff88' },
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
            
            console.log('Charts initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize charts:', error);
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connected':
                if (icon) icon.className = 'fas fa-circle';
                if (text) text.textContent = 'Verbunden';
                break;
            case 'disconnected':
                if (icon) icon.className = 'fas fa-circle';
                if (text) text.textContent = 'Getrennt';
                break;
            case 'connecting':
                if (icon) icon.className = 'fas fa-circle';
                if (text) text.textContent = 'Verbindung wird hergestellt...';
                break;
        }
    }

    async updateDashboard() {
        try {
            this.updateConnectionStatus('connecting');
            
            const stats = await this.api.getGameStats();
            
            this.updateStats(stats);
            this.updateCharts(stats);
            this.updateCreepsDisplay(stats.roomsData);
            this.updateRoomsDisplay(stats.roomsData);
            this.updateControllersDisplay(stats.roomControlLevels);
            this.updateProductionStats(stats);
            // await this.updateConsole(); // Disabled due to API 404 error
            
            // Update room management features
            await this.updateRoomManagement();
            
            this.updateConnectionStatus('connected');
            
        } catch (error) {
            console.error('Dashboard update failed:', error);
            this.updateConnectionStatus('disconnected');
            this.addConsoleMessage('error', error.message);
        }
    }

    updateStats(stats) {
        const elements = {
            energyValue: document.getElementById('energyValue'),
            creepCount: document.getElementById('creepCount'),
            cpuUsage: document.getElementById('cpuUsage'),
            roomCount: document.getElementById('roomCount'),
            gclValue: document.getElementById('gclValue'),
            creditsValue: document.getElementById('creditsValue'),
            spawnsValue: document.getElementById('spawnsValue'),
            towersValue: document.getElementById('towersValue'),
            constructionValue: document.getElementById('constructionValue'),
            mineralsValue: document.getElementById('mineralsValue'),
            avgRoomLevel: document.getElementById('avgRoomLevel'),
            energyHarvested: document.getElementById('energyHarvested'),
            storageValue: document.getElementById('storageValue'),
            terminalsValue: document.getElementById('terminalsValue'),
            labsValue: document.getElementById('labsValue'),
            totalStructures: document.getElementById('totalStructures'),
            subscriptionTokens: document.getElementById('subscriptionTokens'),
            powerExperimentations: document.getElementById('powerExperimentations')
        };

        // Basis-Statistiken
        if (elements.energyValue) {
            elements.energyValue.textContent = `${stats.energy}/${stats.energyCapacity}`;
        }
        if (elements.creepCount) {
            elements.creepCount.textContent = stats.creeps;
        }
        if (elements.cpuUsage) {
            elements.cpuUsage.textContent = `${stats.cpu.toFixed(1)}/${stats.cpuLimit}`;
        }
        if (elements.roomCount) {
            elements.roomCount.textContent = stats.rooms;
        }

        // Erweiterte Statistiken
        if (elements.gclValue) {
            elements.gclValue.textContent = stats.gcl || 0;
        }
        if (elements.creditsValue) {
            elements.creditsValue.textContent = (stats.credits || 0).toLocaleString();
        }
        if (elements.spawnsValue) {
            elements.spawnsValue.textContent = stats.spawns || 0;
        }
        if (elements.towersValue) {
            elements.towersValue.textContent = stats.towers || 0;
        }
        if (elements.constructionValue) {
            elements.constructionValue.textContent = stats.constructionSites || 0;
        }
        if (elements.mineralsValue) {
            elements.mineralsValue.textContent = stats.minerals || 0;
        }
        if (elements.avgRoomLevel) {
            elements.avgRoomLevel.textContent = stats.avgRoomLevel || 0;
        }
        if (elements.energyHarvested) {
            elements.energyHarvested.textContent = (stats.energyHarvested || 0).toLocaleString();
        }
        if (elements.storageValue) {
            elements.storageValue.textContent = stats.storage || 0;
        }
        if (elements.terminalsValue) {
            elements.terminalsValue.textContent = stats.terminals || 0;
        }
        if (elements.labsValue) {
            elements.labsValue.textContent = stats.labs || 0;
        }
        if (elements.totalStructures) {
            elements.totalStructures.textContent = stats.totalStructures || 0;
        }
        if (elements.subscriptionTokens) {
            elements.subscriptionTokens.textContent = stats.subscriptionTokens || 0;
        }
        if (elements.powerExperimentations) {
            elements.powerExperimentations.textContent = stats.powerExperimentations || 0;
        }
    }

    updateCharts(stats) {
        const now = new Date().toLocaleTimeString();
        
        // Update Energy Chart
        if (this.charts.energy) {
            this.chartData.energy.labels.push(now);
            this.chartData.energy.data.push(stats.energy);
            
            if (this.chartData.energy.labels.length > this.maxDataPoints) {
                this.chartData.energy.labels.shift();
                this.chartData.energy.data.shift();
            }
            this.charts.energy.update();
        }
        
        // Update CPU Chart
        if (this.charts.cpu) {
            this.chartData.cpu.labels.push(now);
            this.chartData.cpu.data.push(stats.cpu);
            
            if (this.chartData.cpu.labels.length > this.maxDataPoints) {
                this.chartData.cpu.labels.shift();
                this.chartData.cpu.data.shift();
            }
            this.charts.cpu.update();
        }
        
        // Update Creeps Chart
        if (this.charts.creeps) {
            this.chartData.creeps.labels.push(now);
            this.chartData.creeps.data.push(stats.creeps);
            
            if (this.chartData.creeps.labels.length > this.maxDataPoints) {
                this.chartData.creeps.labels.shift();
                this.chartData.creeps.data.shift();
            }
            this.charts.creeps.update();
        }
        
        // Update Room Level Chart
        if (this.charts.roomLevel && stats.roomControlLevels) {
            const levelCounts = [0, 0, 0, 0, 0, 0, 0, 0];
            stats.roomControlLevels.forEach(room => {
                if (room.level >= 1 && room.level <= 8) {
                    levelCounts[room.level - 1]++;
                }
            });
            
            this.charts.roomLevel.data.datasets[0].data = levelCounts;
            this.charts.roomLevel.update();
        }
    }

    updateCreepsDisplay(roomsData) {
        const creepsList = document.getElementById('creepsList');
        if (!creepsList || !roomsData) return;
        
        creepsList.innerHTML = '';
        
        let totalCreeps = 0;
        roomsData.forEach(room => {
            if (room.data && room.data.objects) {
                const creeps = room.data.objects.filter(obj => obj.type === "creep");
                creeps.forEach(creep => {
                    const li = document.createElement('li');
                    li.className = 'data-item';
                    li.innerHTML = `
                        <span>${creep.name}</span>
                        <span>${room.name}</span>
                    `;
                    creepsList.appendChild(li);
                    totalCreeps++;
                });
            }
        });
        
        if (totalCreeps === 0) {
            const li = document.createElement('li');
            li.className = 'data-item';
            li.textContent = 'Keine Creeps gefunden';
            creepsList.appendChild(li);
        }
    }

    updateRoomsDisplay(roomsData) {
        const roomsList = document.getElementById('roomsList');
        if (!roomsList || !roomsData) return;
        
        roomsList.innerHTML = '';
        
        if (roomsData.length === 0) {
            const li = document.createElement('li');
            li.className = 'data-item';
            li.textContent = 'Keine Räume gefunden';
            roomsList.appendChild(li);
            return;
        }
        
        roomsData.forEach(room => {
            const li = document.createElement('li');
            li.className = 'data-item';
            
            let energyInfo = '-';
            if (room.data && room.data.objects) {
                const spawns = room.data.objects.filter(obj => obj.type === "spawn");
                const extensions = room.data.objects.filter(obj => obj.type === "extension");
                
                let energy = 0;
                let capacity = 0;
                
                spawns.forEach(spawn => {
                    if (spawn.store) {
                        energy += spawn.store.energy || 0;
                        capacity += spawn.storeCapacity || 300;
                    }
                });
                
                extensions.forEach(ext => {
                    if (ext.store) {
                        energy += ext.store.energy || 0;
                        capacity += ext.storeCapacity || 50;
                    }
                });
                
                energyInfo = `${energy}/${capacity}`;
            }
            
            li.innerHTML = `
                <span>${room.name}</span>
                <span>${energyInfo}</span>
            `;
            roomsList.appendChild(li);
        });
    }

    updateControllersDisplay(roomControlLevels) {
        const controllersList = document.getElementById('controllersList');
        if (!controllersList || !roomControlLevels) return;
        
        controllersList.innerHTML = '';
        
        if (roomControlLevels.length === 0) {
            const li = document.createElement('li');
            li.className = 'data-item';
            li.textContent = 'Keine Controller gefunden';
            controllersList.appendChild(li);
            return;
        }
        
        roomControlLevels.forEach(room => {
            const li = document.createElement('li');
            li.className = 'data-item';
            
            const progressPercent = room.progressTotal > 0 ? 
                Math.round((room.progress / room.progressTotal) * 100) : 0;
            
            let statusInfo = '';
            if (room.ticksToDowngrade > 0) {
                const hoursToDowngrade = Math.round(room.ticksToDowngrade / 60 / 60 * 100) / 100;
                statusInfo += ` | Downgrade in ${hoursToDowngrade}h`;
            }
            if (room.upgradeBlocked > 0) {
                statusInfo += ` | Upgrade blockiert für ${room.upgradeBlocked} Ticks`;
            }
            
            li.innerHTML = `
                <span>${room.room} (Level ${room.level})${statusInfo}</span>
                <span>${progressPercent}% (${room.progress.toLocaleString()}/${room.progressTotal.toLocaleString()})</span>
            `;
            controllersList.appendChild(li);
        });
    }

    updateProductionStats(stats) {
        const productionStats = document.getElementById('productionStats');
        if (!productionStats) return;
        
        productionStats.innerHTML = '';
        
        const statsData = [
            { label: 'Creeps produziert', value: stats.creepsProduced || 0, icon: 'fas fa-users' },
            { label: 'Energie geerntet', value: (stats.energyHarvested || 0).toLocaleString(), icon: 'fas fa-bolt' },
            { label: 'Energie für Bau', value: (stats.energyConstruction || 0).toLocaleString(), icon: 'fas fa-hammer' },
            { label: 'Energie für Kontrolle', value: (stats.energyControl || 0).toLocaleString(), icon: 'fas fa-crown' },
            { label: 'Energie für Creeps', value: (stats.energyCreeps || 0).toLocaleString(), icon: 'fas fa-robot' },
            { label: 'Energie Effizienz', value: `${stats.energyPercentage || 0}%`, icon: 'fas fa-percentage' },
            { label: 'CPU Effizienz', value: `${stats.cpuPercentage || 0}%`, icon: 'fas fa-microchip' },
            { label: 'GCL Level', value: stats.gcl || 0, icon: 'fas fa-star' },
            { label: 'Strukturen gesamt', value: stats.totalStructures || 0, icon: 'fas fa-building' },
            { label: 'Durchschnitt Raum Level', value: stats.avgRoomLevel || 0, icon: 'fas fa-level-up-alt' }
        ];
        
        statsData.forEach(stat => {
            const li = document.createElement('li');
            li.className = 'data-item';
            li.innerHTML = `
                <span><i class="${stat.icon}"></i> ${stat.label}</span>
                <span>${stat.value}</span>
            `;
            productionStats.appendChild(li);
        });
    }

    async updateConsole() {
        try {
            // Console API endpoint doesn't exist, skip for now
            // const consoleData = await this.api.getConsole();
            // Console data display could be implemented here
        } catch (error) {
            // Silently fail for console updates
        }
    }

    addConsoleMessage(type, message) {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput) {
            console.warn('Console output element not found');
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `console-message ${type}`;
        messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        consoleOutput.appendChild(messageDiv);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        // Limit console messages
        const messages = consoleOutput.children;
        if (messages.length > 50) {
            consoleOutput.removeChild(messages[0]);
        }
    }

    startUpdating() {
        if (this.intervalId) {
            this.stopUpdating();
        }
        
        this.addConsoleMessage('info', 'Dashboard Updates gestartet');
        this.updateDashboard(); // Initial update
        
        this.intervalId = setInterval(() => {
            this.updateDashboard();
        }, this.updateInterval);
    }

    stopUpdating() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.addConsoleMessage('info', 'Dashboard Updates gestoppt');
        }
    }

    // Method to handle configuration updates
    updateConfiguration(token, serverUrl, customUrl) {
        try {
            if (!token) {
                throw new Error('API Token ist erforderlich');
            }
            
            this.api.setToken(token);
            
            if (serverUrl === 'custom' && customUrl) {
                this.api.setServerUrl(customUrl);
            } else if (serverUrl !== 'custom') {
                this.api.setServerUrl(serverUrl);
            }
            
            this.addConsoleMessage('success', 'Konfiguration gespeichert');
            
            // Restart dashboard
            this.stopUpdating();
            setTimeout(() => this.startUpdating(), 1000);
            
            return true;
        } catch (error) {
            this.addConsoleMessage('error', error.message);
            return false;
        }
    }

    // Room Visualization Methods
    initRoomVisualization() {
        this.roomVisualization.canvas = document.getElementById('roomMap');
        console.log('Room visualization canvas:', this.roomVisualization.canvas);
        if (this.roomVisualization.canvas) {
            this.roomVisualization.ctx = this.roomVisualization.canvas.getContext('2d');
            console.log('Room visualization context:', this.roomVisualization.ctx);
            
            // Setup room selector
            const roomSelect = document.getElementById('roomSelect');
            const refreshBtn = document.getElementById('refreshRoomBtn');
            
            if (roomSelect) {
                roomSelect.addEventListener('change', (e) => {
                    this.selectRoom(e.target.value);
                });
            }
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.refreshRoomData();
                });
            }
            
            // Setup canvas click handler for room interaction
            this.roomVisualization.canvas.addEventListener('click', (e) => {
                this.handleRoomMapClick(e);
            });
        }
    }

    async selectRoom(roomName) {
        if (!roomName) return;
        
        this.roomVisualization.selectedRoom = roomName;
        this.addConsoleMessage('info', `Lade Raum ${roomName}...`);
        
        try {
            console.log(`Loading room data for ${roomName}...`);
            
            // Try to get room data from existing API methods first
            let roomObjects = null;
            let roomTerrain = null;
            
            // First try the specific room API endpoints
            try {
                const roomResponse = await this.api.getRoomObjects(roomName);
                console.log('Room objects API response:', roomResponse);
                
                // Extract objects from API response
                if (roomResponse && roomResponse.objects) {
                    roomObjects = roomResponse.objects;
                } else if (Array.isArray(roomResponse)) {
                    roomObjects = roomResponse;
                } else {
                    roomObjects = [];
                }
                
                console.log('Processed room objects:', roomObjects);
            } catch (error) {
                console.warn('getRoomObjects failed, trying alternative:', error);
                
                // Fallback: try to get room data from getUserRooms
                try {
                    const userRooms = await this.api.getUserRooms();
                    const roomData = userRooms.find(room => room.name === roomName);
                    if (roomData && roomData.data && roomData.data.objects) {
                        roomObjects = roomData.data.objects;
                        console.log('Room objects from getUserRooms:', roomObjects);
                    }
                } catch (fallbackError) {
                    console.warn('getUserRooms fallback failed:', fallbackError);
                }
            }
            
            // Try to get terrain data
            try {
                const terrainResponse = await this.api.getRoomTerrain(roomName);
                console.log('Room terrain API response:', terrainResponse);
                
                // Extract terrain from API response
                if (terrainResponse && terrainResponse.terrain) {
                    roomTerrain = terrainResponse.terrain;
                } else if (Array.isArray(terrainResponse)) {
                    roomTerrain = terrainResponse;
                } else {
                    roomTerrain = new Array(2500).fill(0);
                }
                
                console.log('Processed room terrain:', roomTerrain);
            } catch (error) {
                console.warn('getRoomTerrain failed:', error);
                // Create a default terrain (all plain)
                roomTerrain = new Array(2500).fill(0);
                console.log('Using default terrain');
            }
            
            if (!roomObjects) {
                // If we still don't have room objects, create a minimal visualization
                this.addConsoleMessage('warning', `Keine Raum-Objekte für ${roomName} gefunden. Zeige nur Terrain.`);
                roomObjects = [];
            }
            
            this.roomVisualization.roomData = {
                objects: roomObjects,
                terrain: roomTerrain,
                name: roomName
            };
            
            console.log('Final room data:', this.roomVisualization.roomData);
            
            this.drawRoomMap();
            this.updateRoomInfo();
            
            this.addConsoleMessage('success', `Raum ${roomName} erfolgreich geladen`);
            
        } catch (error) {
            console.error('Error loading room:', error);
            this.addConsoleMessage('error', `Fehler beim Laden von Raum ${roomName}: ${error.message}`);
        }
    }

    drawRoomMap() {
        console.log('drawRoomMap called');
        console.log('Canvas context:', this.roomVisualization.ctx);
        console.log('Room data:', this.roomVisualization.roomData);
        
        if (!this.roomVisualization.ctx || !this.roomVisualization.roomData) {
            console.warn('Missing canvas context or room data');
            return;
        }
        
        const ctx = this.roomVisualization.ctx;
        const canvas = this.roomVisualization.canvas;
        const roomData = this.roomVisualization.roomData;
        
        console.log(`Drawing room map for ${roomData.name}`);
        console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const cellSize = 10; // 50x50 room = 500px canvas
        
        // Draw a background first to ensure something is visible
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw terrain
        if (roomData.terrain && roomData.terrain.length > 0) {
            console.log(`Drawing terrain with ${roomData.terrain.length} cells`);
            this.drawTerrain(ctx, roomData.terrain, cellSize);
        } else {
            console.log('No terrain data, drawing default grid');
            // Draw a basic grid pattern if no terrain
            ctx.fillStyle = '#2a2a2a';
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
        
        // Draw structures and objects
        if (roomData.objects && roomData.objects.length > 0) {
            console.log(`Drawing ${roomData.objects.length} objects`);
            this.drawRoomObjects(ctx, roomData.objects, cellSize);
        } else {
            console.log('No objects to draw');
        }
        
        // Draw grid
        this.drawGrid(ctx, cellSize);
        
        console.log('Room map drawing completed');
    }

    drawTerrain(ctx, terrain, cellSize) {
        // Initialize terrain grid (all plain by default)
        const terrainGrid = new Array(2500).fill(0);
        
        // If terrain is an array of objects (from API), convert it
        if (Array.isArray(terrain) && terrain.length > 0 && terrain[0].type) {
            terrain.forEach(cell => {
                const index = cell.y * 50 + cell.x;
                if (cell.type === 'swamp') {
                    terrainGrid[index] = 1;
                } else if (cell.type === 'wall') {
                    terrainGrid[index] = 2;
                }
            });
        } else if (Array.isArray(terrain) && terrain.length === 2500) {
            // If terrain is already a numeric array, use it directly
            terrain.forEach((value, index) => {
                terrainGrid[index] = value;
            });
        }
        
        // Draw the terrain grid
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                const terrainType = terrainGrid[y * 50 + x];
                let color = '#2a2a2a'; // Plain
                
                if (terrainType === 1 || terrainType & 1) color = '#8BC34A'; // Swamp
                if (terrainType === 2 || terrainType & 2) color = '#333'; // Wall
                
                ctx.fillStyle = color;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                
                // Add a subtle border to make terrain more visible
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    drawRoomObjects(ctx, objects, cellSize) {
        const colors = {
            spawn: '#4CAF50',
            extension: '#2196F3',
            creep: '#FF9800',
            controller: '#9C27B0',
            source: '#FFEB3B',
            mineral: '#795548',
            storage: '#607D8B',
            tower: '#F44336',
            constructionSite: '#FFC107',
            road: '#666',
            container: '#8BC34A',
            link: '#E91E63',
            lab: '#3F51B5',
            terminal: '#009688',
            observer: '#FF5722',
            powerSpawn: '#673AB7',
            extractor: '#795548',
            nuker: '#F44336',
            factory: '#607D8B'
        };
        
        objects.forEach(obj => {
            if (obj.x !== undefined && obj.y !== undefined) {
                const color = colors[obj.type] || '#FFF';
                
                ctx.fillStyle = color;
                ctx.fillRect(
                    obj.x * cellSize + 1,
                    obj.y * cellSize + 1,
                    cellSize - 2,
                    cellSize - 2
                );
                
                // Add energy/health bars for certain objects
                if (obj.type === 'spawn' || obj.type === 'extension') {
                    this.drawEnergyBar(ctx, obj, cellSize);
                } else if (obj.type === 'creep') {
                    this.drawHealthBar(ctx, obj, cellSize);
                }
            }
        });
    }

    drawEnergyBar(ctx, obj, cellSize) {
        if (obj.energy !== undefined && obj.energyCapacity !== undefined) {
            const barWidth = cellSize - 2;
            const barHeight = 2;
            const x = obj.x * cellSize + 1;
            const y = obj.y * cellSize + cellSize - barHeight - 1;
            
            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Energy bar
            const energyPercent = obj.energy / obj.energyCapacity;
            ctx.fillStyle = '#FFEB3B';
            ctx.fillRect(x, y, barWidth * energyPercent, barHeight);
        }
    }

    drawHealthBar(ctx, obj, cellSize) {
        if (obj.hits !== undefined && obj.hitsMax !== undefined) {
            const barWidth = cellSize - 2;
            const barHeight = 2;
            const x = obj.x * cellSize + 1;
            const y = obj.y * cellSize + cellSize - barHeight - 1;
            
            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Health bar
            const healthPercent = obj.hits / obj.hitsMax;
            ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : '#F44336';
            ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        }
    }

    drawGrid(ctx, cellSize) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let x = 0; x <= 50; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, 50 * cellSize);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= 50; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(50 * cellSize, y * cellSize);
            ctx.stroke();
        }
    }

    handleRoomMapClick(e) {
        if (!this.roomVisualization.roomData) return;
        
        const rect = this.roomVisualization.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / 10);
        const y = Math.floor((e.clientY - rect.top) / 10);
        
        // Find object at clicked position
        const clickedObject = this.roomVisualization.roomData.objects.find(obj => 
            obj.x === x && obj.y === y
        );
        
        if (clickedObject) {
            this.showObjectDetails(clickedObject, x, y);
        }
    }

    showObjectDetails(obj, x, y) {
        const details = document.getElementById('roomDetails');
        if (!details) return;
        
        let html = `<h4>Objekt bei (${x}, ${y})</h4>`;
        html += `<p><strong>Typ:</strong> ${obj.type}</p>`;
        
        if (obj.energy !== undefined) {
            html += `<p><strong>Energie:</strong> ${obj.energy}/${obj.energyCapacity}</p>`;
        }
        
        if (obj.hits !== undefined) {
            html += `<p><strong>Lebenspunkte:</strong> ${obj.hits}/${obj.hitsMax}</p>`;
        }
        
        if (obj.level !== undefined) {
            html += `<p><strong>Level:</strong> ${obj.level}</p>`;
        }
        
        if (obj.progress !== undefined) {
            html += `<p><strong>Fortschritt:</strong> ${obj.progress}/${obj.progressTotal}</p>`;
        }
        
        details.innerHTML = html;
    }

    updateRoomInfo() {
        if (!this.roomVisualization.roomData) return;
        
        const roomTitle = document.getElementById('roomTitle');
        const roomDetails = document.getElementById('roomDetails');
        
        if (roomTitle) {
            roomTitle.textContent = `Raum ${this.roomVisualization.roomData.name}`;
        }
        
        if (roomDetails) {
            const objects = this.roomVisualization.roomData.objects;
            const stats = this.calculateRoomStats(objects);
            
            let html = `
                <p><strong>Strukturen:</strong> ${stats.structures}</p>
                <p><strong>Creeps:</strong> ${stats.creeps}</p>
                <p><strong>Energie:</strong> ${stats.energy}/${stats.energyCapacity}</p>
                <p><strong>Spawns:</strong> ${stats.spawns}</p>
                <p><strong>Extensions:</strong> ${stats.extensions}</p>
                <p><strong>Türme:</strong> ${stats.towers}</p>
                <p><strong>Baustellen:</strong> ${stats.constructionSites}</p>
            `;
            
            roomDetails.innerHTML = html;
        }
    }

    calculateRoomStats(objects) {
        const stats = {
            structures: 0,
            creeps: 0,
            energy: 0,
            energyCapacity: 0,
            spawns: 0,
            extensions: 0,
            towers: 0,
            constructionSites: 0
        };
        
        objects.forEach(obj => {
            if (obj.type === 'creep') {
                stats.creeps++;
            } else if (obj.type === 'constructionSite') {
                stats.constructionSites++;
            } else {
                stats.structures++;
                
                if (obj.energy !== undefined) {
                    stats.energy += obj.energy;
                    stats.energyCapacity += obj.energyCapacity;
                }
                
                switch (obj.type) {
                    case 'spawn': stats.spawns++; break;
                    case 'extension': stats.extensions++; break;
                    case 'tower': stats.towers++; break;
                }
            }
        });
        
        return stats;
    }

    async refreshRoomData() {
        if (this.roomVisualization.selectedRoom) {
            await this.selectRoom(this.roomVisualization.selectedRoom);
        }
    }

    async testRoomVisualization() {
        console.log('=== Testing Room Visualization ===');
        
        try {
            // Test direct API calls
            console.log('Testing direct API calls...');
            
            const roomObjectsResponse = await fetch('https://screeps.com/api/game/room-objects?room=W26N53&shard=shard3', {
                headers: { 'X-Token': this.api.getToken() }
            });
            
            if (roomObjectsResponse.ok) {
                const roomObjectsData = await roomObjectsResponse.json();
                console.log('Direct room objects API response:', roomObjectsData);
                
                if (roomObjectsData.objects && roomObjectsData.objects.length > 0) {
                    console.log(`Found ${roomObjectsData.objects.length} objects directly from API`);
                    
                    // Test terrain API
                    const terrainResponse = await fetch('https://screeps.com/api/game/room-terrain?room=W26N53&shard=shard3', {
                        headers: { 'X-Token': this.api.getToken() }
                    });
                    
                    if (terrainResponse.ok) {
                        const terrainData = await terrainResponse.json();
                        console.log('Direct terrain API response:', terrainData);
                        
                        // Manually set room data and draw
                        this.roomVisualization.roomData = {
                            objects: roomObjectsData.objects,
                            terrain: terrainData.terrain,
                            name: 'W26N53'
                        };
                        
                        console.log('Manually set room data:', this.roomVisualization.roomData);
                        this.drawRoomMap();
                        this.updateRoomInfo();
                        
                        this.addConsoleMessage('success', `Direkte API-Verbindung erfolgreich! ${roomObjectsData.objects.length} Objekte geladen.`);
                        
                        // Update room selector
                        const roomSelect = document.getElementById('roomSelect');
                        if (roomSelect) {
                            roomSelect.value = 'W26N53';
                        }
                        
                        return;
                    }
                }
            }
            
            console.log('Direct API failed, trying selectRoom method...');
            await this.selectRoom('W26N53');
            
        } catch (error) {
            console.error('Test room visualization failed:', error);
            this.addConsoleMessage('error', `Test fehlgeschlagen: ${error.message}`);
        }
    }

    async tryLoadDefaultRoom() {
        console.log('tryLoadDefaultRoom called');
        console.log('Current selected room:', this.roomVisualization.selectedRoom);
        
        // If no room is selected yet, try to load one
        if (!this.roomVisualization.selectedRoom) {
            try {
                console.log('Trying to get overview data...');
                const overview = await this.api.getOverview();
                console.log('Overview data:', overview);
                
                if (overview && overview.rooms) {
                    const roomNames = Object.keys(overview.rooms);
                    console.log('Available rooms:', roomNames);
                    
                    if (roomNames.length > 0) {
                        const firstRoom = roomNames[0];
                        this.addConsoleMessage('info', `Lade Standard-Raum ${firstRoom}...`);
                        console.log(`Selecting first room: ${firstRoom}`);
                        
                        await this.selectRoom(firstRoom);
                        
                        const roomSelect = document.getElementById('roomSelect');
                        if (roomSelect) {
                            // Update selector options if not already done
                            if (roomSelect.children.length <= 1) {
                                console.log('Populating room selector...');
                                roomNames.forEach(roomName => {
                                    const option = document.createElement('option');
                                    option.value = roomName;
                                    option.textContent = roomName;
                                    roomSelect.appendChild(option);
                                });
                            }
                            roomSelect.value = firstRoom;
                            console.log('Room selector updated');
                        }
                    } else {
                        this.addConsoleMessage('warning', 'Keine Räume in Overview gefunden');
                    }
                } else {
                    this.addConsoleMessage('warning', 'Keine Overview-Daten verfügbar');
                    
                    // Fallback: try getUserRooms
                    try {
                        console.log('Trying getUserRooms as fallback...');
                        const userRooms = await this.api.getUserRooms();
                        console.log('User rooms data:', userRooms);
                        
                        if (userRooms && userRooms.length > 0) {
                            const firstRoom = userRooms[0].name;
                            this.addConsoleMessage('info', `Lade Standard-Raum ${firstRoom} (Fallback)...`);
                            await this.selectRoom(firstRoom);
                            
                            const roomSelect = document.getElementById('roomSelect');
                            if (roomSelect) {
                                userRooms.forEach(room => {
                                    const option = document.createElement('option');
                                    option.value = room.name;
                                    option.textContent = room.name;
                                    roomSelect.appendChild(option);
                                });
                                roomSelect.value = firstRoom;
                            }
                        }
                    } catch (fallbackError) {
                        console.error('Fallback getUserRooms failed:', fallbackError);
                        this.addConsoleMessage('error', 'Konnte keine Räume laden');
                    }
                }
            } catch (error) {
                console.warn('Could not load default room:', error);
                this.addConsoleMessage('warning', `Konnte keinen Standard-Raum laden: ${error.message}`);
            }
        } else {
            console.log('Room already selected:', this.roomVisualization.selectedRoom);
        }
    }

    // Multi-Room Management Methods
    initMultiRoomManagement() {
        this.initRoomComparisonTable();
        this.initRoomPerformanceCharts();
    }

    initRoomComparisonTable() {
        // Table will be updated when room data is available
    }

    initRoomPerformanceCharts() {
        const roomEnergyCanvas = document.getElementById('roomEnergyChart');
        const roomCreepsCanvas = document.getElementById('roomCreepsChart');
        
        if (roomEnergyCanvas) {
            const ctx = roomEnergyCanvas.getContext('2d');
            this.charts.roomEnergy = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Energie',
                        data: [],
                        backgroundColor: 'rgba(0, 255, 136, 0.6)',
                        borderColor: '#00ff88',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#00ff88' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#00ff88' },
                            grid: { color: '#333333' }
                        },
                        y: {
                            ticks: { color: '#00ff88' },
                            grid: { color: '#333333' }
                        }
                    }
                }
            });
        }
        
        if (roomCreepsCanvas) {
            const ctx = roomCreepsCanvas.getContext('2d');
            this.charts.roomCreeps = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Creeps',
                        data: [],
                        backgroundColor: 'rgba(255, 152, 0, 0.6)',
                        borderColor: '#FF9800',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#00ff88' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#00ff88' },
                            grid: { color: '#333333' }
                        },
                        y: {
                            ticks: { color: '#00ff88' },
                            grid: { color: '#333333' }
                        }
                    }
                }
            });
        }
    }

    updateRoomSelector(rooms) {
        const roomSelect = document.getElementById('roomSelect');
        if (!roomSelect) return;
        
        // Clear existing options except the first one
        roomSelect.innerHTML = '<option value="">Raum wählen...</option>';
        
        // Add room options
        rooms.forEach(roomName => {
            const option = document.createElement('option');
            option.value = roomName;
            option.textContent = roomName;
            roomSelect.appendChild(option);
        });
        
        // Automatically select and load the first room if available
        if (rooms.length > 0 && !this.roomVisualization.selectedRoom) {
            const firstRoom = rooms[0];
            roomSelect.value = firstRoom;
            this.selectRoom(firstRoom);
            this.addConsoleMessage('info', `Automatisch Raum ${firstRoom} ausgewählt`);
        }
    }

    updateRoomComparison(roomsData) {
        const tbody = document.getElementById('roomComparisonBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        roomsData.forEach(room => {
            const row = document.createElement('tr');
            
            const efficiency = this.calculateRoomEfficiency(room);
            const status = this.getRoomStatus(room);
            
            row.innerHTML = `
                <td>${room.name}</td>
                <td>${room.level || 0}</td>
                <td>${room.energy || 0}/${room.energyCapacity || 0}</td>
                <td>${room.creepCount || 0}</td>
                <td>${room.structureCount || 0}</td>
                <td><span class="efficiency-badge efficiency-${efficiency.class}">${efficiency.value}%</span></td>
                <td><span class="status-badge status-${status.class}">${status.text}</span></td>
            `;
            
            tbody.appendChild(row);
        });
    }

    calculateRoomEfficiency(room) {
        // Simple efficiency calculation based on energy ratio and creep activity
        let efficiency = 0;
        
        if (room.energyCapacity > 0) {
            efficiency = (room.energy / room.energyCapacity) * 100;
        }
        
        let efficiencyClass = 'low';
        if (efficiency > 70) efficiencyClass = 'high';
        else if (efficiency > 40) efficiencyClass = 'medium';
        
        return {
            value: Math.round(efficiency),
            class: efficiencyClass
        };
    }

    getRoomStatus(room) {
        if (room.creepCount === 0) {
            return { text: 'Inaktiv', class: 'danger' };
        } else if (room.energy < room.energyCapacity * 0.3) {
            return { text: 'Niedrige Energie', class: 'warning' };
        } else {
            return { text: 'Aktiv', class: 'active' };
        }
    }

    updateRoomPerformanceCharts(roomsData) {
        if (this.charts.roomEnergy) {
            const labels = roomsData.map(room => room.name);
            const energyData = roomsData.map(room => room.energy || 0);
            
            this.charts.roomEnergy.data.labels = labels;
            this.charts.roomEnergy.data.datasets[0].data = energyData;
            this.charts.roomEnergy.update('none');
        }
        
        if (this.charts.roomCreeps) {
            const labels = roomsData.map(room => room.name);
            const creepsData = roomsData.map(room => room.creepCount || 0);
            
            this.charts.roomCreeps.data.labels = labels;
            this.charts.roomCreeps.data.datasets[0].data = creepsData;
            this.charts.roomCreeps.update('none');
        }
    }

    async updateRoomManagement() {
        try {
            const overview = await this.api.getOverview();
            const roomsData = [];
            
            if (overview && overview.rooms) {
                for (const [roomName, roomData] of Object.entries(overview.rooms)) {
                    const processedRoom = {
                        name: roomName,
                        level: roomData.level || 0,
                        energy: 0,
                        energyCapacity: 0,
                        creepCount: 0,
                        structureCount: 0
                    };
                    
                    // Get detailed room data
                    try {
                        const roomObjects = await this.api.getRoomObjects(roomName);
                        const stats = this.calculateRoomStats(roomObjects);
                        
                        processedRoom.energy = stats.energy;
                        processedRoom.energyCapacity = stats.energyCapacity;
                        processedRoom.creepCount = stats.creeps;
                        processedRoom.structureCount = stats.structures;
                        
                    } catch (error) {
                        console.warn(`Could not get detailed data for room ${roomName}:`, error);
                    }
                    
                    roomsData.push(processedRoom);
                }
            }
            
            // Update room selector (this will auto-select first room if none selected)
            this.updateRoomSelector(roomsData.map(room => room.name));
            
            // Update room comparison table
            this.updateRoomComparison(roomsData);
            
            // Update room performance charts
            this.updateRoomPerformanceCharts(roomsData);
            
            // Store room data for future use
            this.roomsData.clear();
            roomsData.forEach(room => {
                this.roomsData.set(room.name, room);
            });
            
            // If no room is selected yet and we have rooms, select the first one
            if (!this.roomVisualization.selectedRoom && roomsData.length > 0) {
                const firstRoom = roomsData[0].name;
                await this.selectRoom(firstRoom);
                const roomSelect = document.getElementById('roomSelect');
                if (roomSelect) {
                    roomSelect.value = firstRoom;
                }
            }
            
        } catch (error) {
            console.error('Error updating room management:', error);
            this.addConsoleMessage('error', `Fehler beim Aktualisieren der Raum-Verwaltung: ${error.message}`);
        }
    }
}

// Global Modal Functions
window.openConfigModal = function() {
    document.getElementById('configModal').classList.add('show');
};

window.closeConfigModal = function() {
    document.getElementById('configModal').classList.remove('show');
};

window.saveConfig = function() {
    const token = document.getElementById('apiToken').value.trim();
    const serverUrl = document.getElementById('serverUrl').value;
    const customUrl = document.getElementById('customUrl').value.trim();
    
    if (!token) {
        alert('Bitte gib einen API Token ein');
        return;
    }
    
    if (!window.dashboard) {
        alert('Dashboard nicht initialisiert. Bitte lade die Seite neu.');
        return;
    }
    
    window.dashboard.api.setToken(token);
    
    if (serverUrl === 'custom' && customUrl) {
        window.dashboard.api.setServerUrl(customUrl);
    } else {
        window.dashboard.api.setServerUrl('https://screeps.com/api/');
    }
    
    window.closeConfigModal();
    window.dashboard.startUpdating();
    window.dashboard.addConsoleMessage('success', 'Konfiguration gespeichert');
};

// Dashboard wird über window.dashboard in index.html initialisiert
// Keine lokale dashboard Variable mehr nötig

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('configModal');
    if (e.target === modal) {
        window.closeConfigModal();
    }
});