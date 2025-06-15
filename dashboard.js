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
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConfig();
        this.initCharts();
        
        if (this.api.getToken()) {
            this.startUpdating();
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
            await this.updateConsole();
            
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
            const consoleData = await this.api.getConsole();
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