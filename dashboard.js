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
        this.historicalChartData = {
            energy: { labels: [], data: [] },
            cpu: { labels: [], data: [] },
            creeps: { labels: [], data: [] },
            roomEfficiency: { labels: [], data: [] }
        };
        this.maxDataPoints = 20;
        this.currentChartMode = 'session'; // 'session' or 'historical'
        
        // Room visualization and multi-room management
        this.roomVisualization = {
            canvas: null,
            ctx: null,
            selectedRoom: null,
            roomData: null
        };
        this.roomsData = new Map();
        
        // Data storage for historical data
        this.lastStats = null;
        this.lastRooms = null;
        this.dataHistory = {
            stats: [],
            rooms: [],
            maxEntries: 100
        };
        
        // Don't call init() automatically - it will be called manually as async
    }

    async init() {
        this.setupEventListeners();
        await this.loadConfig();
        this.loadFromLocalStorage(); // Load historical data
        this.initCharts();
        this.initRoomVisualization();
        this.initMultiRoomManagement();
        
        // Check for API token linking after Firebase is ready
        setTimeout(async () => {
            await this.checkAndPromptApiTokenLink();
            // Sync with Firestore if user is authenticated
            await this.syncWithFirestore();
        }, 2000);
        
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
            // Try to load API token from account first
            setTimeout(async () => {
                const loaded = await this.loadApiTokenFromAccount();
                if (!loaded) {
                    if (typeof openConfigModal === 'function') {
                        openConfigModal();
                    }
                    this.addConsoleMessage('info', 'Please configure your API token to begin');
                } else {
                    // Start updating if token was loaded from account
                    this.startUpdating();
                }
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

    async loadConfig() {
        // Check if we're coming from login page (prevent redirect loop)
        const urlParams = new URLSearchParams(window.location.search);
        const fromLogin = urlParams.get('from') === 'login';
        
        // Check if user is in demo mode
        const demoMode = localStorage.getItem('demoMode');
        
        // Wait for Firebase to be fully ready if it exists
        let hasValidAuth = false;
        if (window.firebaseManager) {
            try {
                // Wait a bit longer for Firebase to be fully initialized
                let retries = 0;
                while (!window.firebaseManager.isInitialized && retries < 10) {
                    console.log('Waiting for Firebase to initialize...');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    retries++;
                }
                
                if (window.firebaseManager.isInitialized) {
                    const user = await window.firebaseManager.getCurrentUser();
                    if (user) {
                        console.log('Firebase user found:', user.email);
                        // Try to load API key from Firebase
                        const apiKey = await window.firebaseManager.getUserApiKey();
                        if (apiKey) {
                            localStorage.setItem('screepsApiToken', apiKey);
                            hasValidAuth = true;
                        }
                    }
                } else {
                    console.log('Firebase not fully initialized after waiting');
                }
            } catch (error) {
                console.log('Firebase auth check failed:', error);
            }
        }
        
        // Check for stored token in localStorage
        const storedToken = localStorage.getItem('screepsApiToken');
        if (storedToken) {
            this.api.setToken(storedToken);
            hasValidAuth = true;
        }
        
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

        // Only redirect to login if no valid authentication found AND not coming from login
        if (!hasValidAuth && !demoMode && !token && !fromLogin) {
            console.log('No valid authentication found, redirecting to login...');
            // Add a small delay to ensure all checks are complete
            setTimeout(() => {
                this.redirectToLogin();
            }, 500);
            return;
        }
        
        // Clean up URL parameter if coming from login
        if (fromLogin) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        console.log('Authentication check complete:', {
            hasValidAuth,
            demoMode: !!demoMode,
            token: !!token,
            fromLogin,
            firebaseInitialized: window.firebaseManager?.isInitialized,
            firebaseUser: window.firebaseManager?.user?.email
        });
        console.log('Valid authentication found, staying on dashboard');
    }

    redirectToLogin() {
        // Redirect to login page if no token is found
        console.log('No API token found, redirecting to login...');
        window.location.href = 'login.html';
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
        
        // Historical chart canvases
        const energyCanvasHistorical = document.getElementById('energyChartHistorical');
        const cpuCanvasHistorical = document.getElementById('cpuChartHistorical');
        const creepsCanvasHistorical = document.getElementById('creepsChartHistorical');
        const roomEfficiencyCanvas = document.getElementById('roomEfficiencyChart');
        
        if (!energyCanvas || !cpuCanvas) {
            console.warn('Chart canvases not found');
            return;
        }
        
        // Check if canvases are already in use by checking for existing chart instances
        const canvases = [
            energyCanvas, cpuCanvas, creepsCanvas, roomLevelCanvas,
            energyCanvasHistorical, cpuCanvasHistorical, creepsCanvasHistorical, roomEfficiencyCanvas
        ].filter(c => c);
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

            // Initialize Historical Charts
            this.initHistoricalCharts();
            
            console.log('Charts initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize charts:', error);
        }
    }

    initHistoricalCharts() {
        try {
            const energyCanvasHistorical = document.getElementById('energyChartHistorical');
            const cpuCanvasHistorical = document.getElementById('cpuChartHistorical');
            const creepsCanvasHistorical = document.getElementById('creepsChartHistorical');
            const roomEfficiencyCanvas = document.getElementById('roomEfficiencyChart');

            // Historical Energy Chart
            if (energyCanvasHistorical) {
                const energyCtxHistorical = energyCanvasHistorical.getContext('2d');
                this.charts.energyHistorical = new Chart(energyCtxHistorical, {
                    type: 'line',
                    data: {
                        labels: this.historicalChartData.energy.labels,
                        datasets: [{
                            label: 'Energie (Historisch)',
                            data: this.historicalChartData.energy.data,
                            borderColor: '#00ff88',
                            backgroundColor: 'rgba(0, 255, 136, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: this.getHistoricalChartOptions()
                });
            }

            // Historical CPU Chart
            if (cpuCanvasHistorical) {
                const cpuCtxHistorical = cpuCanvasHistorical.getContext('2d');
                this.charts.cpuHistorical = new Chart(cpuCtxHistorical, {
                    type: 'line',
                    data: {
                        labels: this.historicalChartData.cpu.labels,
                        datasets: [{
                            label: 'CPU (Historisch)',
                            data: this.historicalChartData.cpu.data,
                            borderColor: '#4ecdc4',
                            backgroundColor: 'rgba(78, 205, 196, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: this.getHistoricalChartOptions()
                });
            }

            // Historical Creeps Chart
            if (creepsCanvasHistorical) {
                const creepsCtxHistorical = creepsCanvasHistorical.getContext('2d');
                this.charts.creepsHistorical = new Chart(creepsCtxHistorical, {
                    type: 'bar',
                    data: {
                        labels: this.historicalChartData.creeps.labels,
                        datasets: [{
                            label: 'Creeps (Historisch)',
                            data: this.historicalChartData.creeps.data,
                            backgroundColor: 'rgba(255, 159, 64, 0.6)',
                            borderColor: '#ff9f40',
                            borderWidth: 2
                        }]
                    },
                    options: this.getHistoricalChartOptions()
                });
            }

            // Room Efficiency Chart
            if (roomEfficiencyCanvas) {
                const roomEfficiencyCtx = roomEfficiencyCanvas.getContext('2d');
                this.charts.roomEfficiency = new Chart(roomEfficiencyCtx, {
                    type: 'line',
                    data: {
                        labels: this.historicalChartData.roomEfficiency.labels,
                        datasets: [{
                            label: 'Raum-Effizienz (%)',
                            data: this.historicalChartData.roomEfficiency.data,
                            borderColor: '#9966ff',
                            backgroundColor: 'rgba(153, 102, 255, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: this.getHistoricalChartOptions()
                });
            }

            console.log('Historical charts initialized successfully');
        } catch (error) {
            console.error('Failed to initialize historical charts:', error);
        }
    }

    getHistoricalChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            animation: { duration: 0 },
            plugins: {
                legend: { labels: { color: '#00ff88' } }
            },
            scales: {
                x: {
                    ticks: { 
                        color: '#00ff88',
                        maxTicksLimit: 12
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
        };
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
        // Store current stats for historical data
        this.lastStats = stats;
        this.saveStatsToHistory(stats);
        
        // Save to Firestore if user is authenticated
        this.saveStatsToFirestore(stats);
        
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
            li.textContent = 'No creeps found';
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
            li.textContent = 'No rooms found';
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
            li.textContent = 'No controllers found';
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
                statusInfo += ` | Upgrade blocked for ${room.upgradeBlocked} Ticks`;
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
            { label: 'Creeps produced', value: stats.creepsProduced || 0, icon: 'fas fa-users' },
            { label: 'Energy harvested', value: (stats.energyHarvested || 0).toLocaleString(), icon: 'fas fa-bolt' },
            { label: 'Energy for construction', value: (stats.energyConstruction || 0).toLocaleString(), icon: 'fas fa-hammer' },
            { label: 'Energy for control', value: (stats.energyControl || 0).toLocaleString(), icon: 'fas fa-crown' },
            { label: 'Energy for creeps', value: (stats.energyCreeps || 0).toLocaleString(), icon: 'fas fa-robot' },
            { label: 'Energy efficiency', value: `${stats.energyPercentage || 0}%`, icon: 'fas fa-percentage' },
            { label: 'CPU efficiency', value: `${stats.cpuPercentage || 0}%`, icon: 'fas fa-microchip' },
            { label: 'GCL Level', value: stats.gcl || 0, icon: 'fas fa-star' },
            { label: 'Total structures', value: stats.totalStructures || 0, icon: 'fas fa-building' },
            { label: 'Average room level', value: stats.avgRoomLevel || 0, icon: 'fas fa-level-up-alt' }
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
        
        this.addConsoleMessage('info', 'Dashboard updates started');
        this.updateDashboard(); // Initial update
        
        this.intervalId = setInterval(() => {
            this.updateDashboard();
        }, this.updateInterval);
    }

    stopUpdating() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.addConsoleMessage('info', 'Dashboard updates stopped');
        }
    }

    // Method to handle configuration updates
    updateConfiguration(token, serverUrl, customUrl) {
        try {
            if (!token) {
                throw new Error('API Token is required');
            }
            
            this.api.setToken(token);
            
            if (serverUrl === 'custom' && customUrl) {
                this.api.setServerUrl(customUrl);
            } else if (serverUrl !== 'custom') {
                this.api.setServerUrl(serverUrl);
            }
            
            this.addConsoleMessage('success', 'Configuration saved');
            
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
            // Test direct API calls with detailed logging
            console.log('Testing direct API calls...');
            console.log('API Token:', this.api.getToken());
            
            const roomObjectsResponse = await fetch('https://screeps.com/api/game/room-objects?room=W26N53&shard=shard3', {
                headers: { 'X-Token': this.api.getToken() },
                mode: 'cors'
            });
            
            console.log('Room objects response status:', roomObjectsResponse.status);
            console.log('Room objects response headers:', [...roomObjectsResponse.headers.entries()]);
            
            if (roomObjectsResponse.ok) {
                const roomObjectsData = await roomObjectsResponse.json();
                console.log('Direct room objects API response:', roomObjectsData);
                
                if (roomObjectsData.ok && roomObjectsData.objects && roomObjectsData.objects.length > 0) {
                    console.log(`Found ${roomObjectsData.objects.length} objects directly from API`);
                    
                    // Test terrain API
                    const terrainResponse = await fetch('https://screeps.com/api/game/room-terrain?room=W26N53&shard=shard3', {
                        headers: { 'X-Token': this.api.getToken() },
                        mode: 'cors'
                    });
                    
                    console.log('Terrain response status:', terrainResponse.status);
                    
                    if (terrainResponse.ok) {
                        const terrainData = await terrainResponse.json();
                        console.log('Direct terrain API response:', terrainData);
                        
                        // Manually set room data and draw
                        this.roomVisualization.roomData = {
                            objects: roomObjectsData.objects,
                            terrain: terrainData.terrain || [],
                            name: 'W26N53'
                        };
                        
                        console.log('Manually set room data:', this.roomVisualization.roomData);
                        
                        // Force draw with test data if no real data
                        if (!this.roomVisualization.roomData.objects.length) {
                            this.drawTestRoom();
                        } else {
                            this.drawRoomMap();
                        }
                        
                        this.updateRoomInfo();
                        
                        this.addConsoleMessage('success', `Direkte API-Verbindung erfolgreich! ${roomObjectsData.objects.length} Objekte geladen.`);
                        
                        // Update room selector
                        const roomSelect = document.getElementById('roomSelect');
                        if (roomSelect) {
                            roomSelect.value = 'W26N53';
                        }
                        
                        return;
                    } else {
                        const terrainError = await terrainResponse.text();
                        console.error('Terrain API error:', terrainError);
                    }
                } else {
                    console.log('No objects found or API error:', roomObjectsData);
                }
            } else {
                const errorText = await roomObjectsResponse.text();
                console.error('Room objects API error:', errorText);
            }
            
            console.log('Direct API failed, drawing test room...');
            this.drawTestRoom();
            
        } catch (error) {
            console.error('Test room visualization failed:', error);
            this.addConsoleMessage('error', `Test fehlgeschlagen: ${error.message}`);
            this.drawTestRoom();
        }
    }

    drawTestRoom() {
        console.log('Drawing test room with sample data...');
        
        // Create test data to verify the drawing functions work
        const testObjects = [
            { type: 'spawn', x: 15, y: 9, name: 'Spawn1' },
            { type: 'extension', x: 16, y: 9 },
            { type: 'extension', x: 14, y: 9 },
            { type: 'extension', x: 15, y: 8 },
            { type: 'creep', x: 20, y: 15, name: 'TestCreep' },
            { type: 'controller', x: 42, y: 35, level: 2 },
            { type: 'source', x: 14, y: 3 },
            { type: 'mineral', x: 14, y: 34, mineralType: 'K' }
        ];
        
        // Create test terrain
        const testTerrain = [];
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                let type = 'plain';
                // Add some walls around the edges
                if (x === 0 || x === 49 || y === 0 || y === 49) {
                    type = 'wall';
                }
                // Add some swamps
                if ((x > 10 && x < 15 && y > 20 && y < 25) || (x > 30 && x < 35 && y > 10 && y < 15)) {
                    type = 'swamp';
                }
                testTerrain.push({ x, y, type });
            }
        }
        
        this.roomVisualization.roomData = {
            objects: testObjects,
            terrain: testTerrain,
            name: 'W26N53 (Test)'
        };
        
        console.log('Test room data:', this.roomVisualization.roomData);
        this.drawRoomMap();
        this.updateRoomInfo();
        
        this.addConsoleMessage('info', 'Test-Raum mit Beispieldaten geladen');
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
            // Set canvas size explicitly
            roomEnergyCanvas.style.height = '300px';
            roomEnergyCanvas.style.maxHeight = '300px';
            
            const ctx = roomEnergyCanvas.getContext('2d');
            this.charts.roomEnergy = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Energy',
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
            // Set canvas size explicitly
            roomCreepsCanvas.style.height = '300px';
            roomCreepsCanvas.style.maxHeight = '300px';
            
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
        roomSelect.innerHTML = '<option value="">Select room...</option>';
        
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
            this.addConsoleMessage('info', `Automatically selected room ${firstRoom}`);
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
            return { text: 'Inactive', class: 'danger' };
        } else if (room.energy < room.energyCapacity * 0.3) {
            return { text: 'Low Energy', class: 'warning' };
        } else {
            return { text: 'Active', class: 'active' };
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
            
            // Save rooms data to Firestore if user is authenticated
            this.saveRoomsToFirestore(roomsData);
            
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
            this.addConsoleMessage('error', `Error updating room management: ${error.message}`);
        }
    }

    // Data storage methods
    saveStatsToHistory(stats) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, data: stats };
        
        this.dataHistory.stats.push(entry);
        
        // Keep only the last maxEntries
        if (this.dataHistory.stats.length > this.dataHistory.maxEntries) {
            this.dataHistory.stats.shift();
        }
        
        // Save to localStorage
        this.saveToLocalStorage();
    }

    saveRoomsToHistory(roomsData) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, data: roomsData };
        
        this.dataHistory.rooms.push(entry);
        
        // Keep only the last maxEntries
        if (this.dataHistory.rooms.length > this.dataHistory.maxEntries) {
            this.dataHistory.rooms.shift();
        }
        
        // Save to localStorage
        this.saveToLocalStorage();
    }

    saveToLocalStorage() {
        try {
            const dataToSave = {
                stats: this.dataHistory.stats.slice(-20), // Keep last 20 entries
                rooms: this.dataHistory.rooms.slice(-20),
                lastUpdate: new Date().toISOString()
            };
            
            localStorage.setItem('screepsHistoricalData', JSON.stringify(dataToSave));
        } catch (error) {
            console.warn('Failed to save data to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('screepsHistoricalData');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.dataHistory.stats = parsed.stats || [];
                this.dataHistory.rooms = parsed.rooms || [];
                console.log('Historical data loaded from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load data from localStorage:', error);
        }
    }

    exportData() {
        const exportData = {
            stats: this.dataHistory.stats,
            rooms: this.dataHistory.rooms,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screeps-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async checkAndPromptApiTokenLink() {
        // Check if user is logged in with Firebase and has no API token saved
        if (window.firebaseManager && window.firebaseManager.user) {
            const localApiKey = localStorage.getItem('screepsApiToken');
            const hasEncryptedToken = localStorage.getItem('hasEncryptedApiToken');
            
            // If user has local API token but no encrypted token saved, prompt to link
            if (localApiKey && !hasEncryptedToken) {
                this.showApiTokenLinkPrompt(localApiKey);
            } else if (hasEncryptedToken && !localApiKey) {
                // If user has encrypted token but no local token, try to load it
                const loaded = await this.loadSecureApiTokenFromAccount();
                if (!loaded) {
                    // If loading failed, remove the flag
                    localStorage.removeItem('hasEncryptedApiToken');
                }
            }
        }
    }

    showApiTokenLinkPrompt(apiToken) {
        const modal = document.createElement('div');
        modal.className = 'config-modal show';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="config-content">
                <h2><i class="fas fa-shield-alt"></i> Secure API Token Storage</h2>
                <p style="color: #ccc; margin-bottom: 20px;">
                    Would you like to securely save your Screeps API token to your account? 
                    Your token will be encrypted with a master password that only you know.
                </p>
                <div style="background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 5px; padding: 15px; margin-bottom: 20px;">
                    <p style="color: #00ff88; margin: 0 0 10px 0; font-size: 0.9rem;">
                        <i class="fas fa-lock"></i> <strong>Maximum Security:</strong>
                    </p>
                    <ul style="color: #ccc; margin: 0; padding-left: 20px; font-size: 0.85rem;">
                        <li>Your API token is encrypted with AES-256-GCM</li>
                        <li>Only you can decrypt it with your master password</li>
                        <li>Even admins cannot read your token</li>
                        <li>Password is never stored or transmitted</li>
                    </ul>
                </div>
                <div class="form-group">
                    <label for="masterPassword">Master Password:</label>
                    <input type="password" id="masterPassword" placeholder="Enter a secure master password" 
                           style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); 
                                  border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; 
                                  color: white; font-size: 1rem;">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Choose a strong password you'll remember. This cannot be recovered if lost.
                    </small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="this.closest('.config-modal').remove()">
                        <i class="fas fa-times"></i> Not now
                    </button>
                    <button type="button" class="btn" onclick="window.dashboard.linkSecureApiTokenToAccount('${apiToken}', this.closest('.config-modal'))">
                        <i class="fas fa-save"></i> Save Securely
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on password field
        setTimeout(() => {
            const passwordField = modal.querySelector('#masterPassword');
            if (passwordField) passwordField.focus();
        }, 100);
    }

    async linkSecureApiTokenToAccount(apiToken, modal) {
        try {
            if (!window.firebaseManager || !window.firebaseManager.user) {
                throw new Error('Not logged in');
            }
            
            const masterPassword = modal.querySelector('#masterPassword').value;
            if (!masterPassword) {
                alert('Please enter a master password');
                return;
            }
            
            if (masterPassword.length < 8) {
                alert('Master password must be at least 8 characters long');
                return;
            }
            
            // Show loading state
            const saveButton = modal.querySelector('button[onclick*="linkSecureApiTokenToAccount"]');
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Encrypting...';
            saveButton.disabled = true;
            
            await window.firebaseManager.saveSecureApiKey(apiToken, masterPassword);
            this.addConsoleMessage('success', 'API token securely encrypted and saved to your account!');
            
            // Store a flag that user has encrypted token
            localStorage.setItem('hasEncryptedApiToken', 'true');
            
            // Remove modal
            if (modal) {
                modal.remove();
            }
            
        } catch (error) {
            console.error('Failed to link secure API token:', error);
            this.addConsoleMessage('error', `Failed to save secure API token: ${error.message}`);
            
            // Restore button state
            const saveButton = modal.querySelector('button[onclick*="linkSecureApiTokenToAccount"]');
            if (saveButton) {
                saveButton.innerHTML = '<i class="fas fa-save"></i> Save Securely';
                saveButton.disabled = false;
            }
        }
    }

    async loadSecureApiTokenFromAccount() {
        try {
            if (!window.firebaseManager || !window.firebaseManager.user) {
                return false;
            }
            
            // Prompt for master password
            const masterPassword = await this.promptForMasterPassword();
            if (!masterPassword) {
                return false;
            }
            
            const savedApiKey = await window.firebaseManager.getSecureApiKey(masterPassword);
            if (savedApiKey) {
                localStorage.setItem('screepsApiToken', savedApiKey);
                this.api.setToken(savedApiKey);
                this.addConsoleMessage('success', 'Secure API token loaded from your account');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to load secure API token:', error);
            this.addConsoleMessage('error', 'Failed to decrypt API token - wrong password?');
            return false;
        }
    }

    async promptForMasterPassword() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'config-modal show';
            modal.style.zIndex = '10000';
            
            modal.innerHTML = `
                <div class="config-content">
                    <h2><i class="fas fa-unlock"></i> Enter Master Password</h2>
                    <p style="color: #ccc; margin-bottom: 20px;">
                        Enter your master password to decrypt your API token.
                    </p>
                    <div class="form-group">
                        <label for="unlockPassword">Master Password:</label>
                        <input type="password" id="unlockPassword" placeholder="Enter your master password" 
                               style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); 
                                      border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; 
                                      color: white; font-size: 1rem;">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn" onclick="this.closest('.config-modal').remove(); window.dashboard.resolveMasterPasswordPrompt(null);">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button type="button" class="btn" onclick="window.dashboard.resolveMasterPasswordPrompt(document.getElementById('unlockPassword').value); this.closest('.config-modal').remove();">
                            <i class="fas fa-unlock"></i> Unlock
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Focus on password field
            setTimeout(() => {
                const passwordField = modal.querySelector('#unlockPassword');
                if (passwordField) {
                    passwordField.focus();
                    // Allow Enter key to submit
                    passwordField.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            const password = passwordField.value;
                            modal.remove();
                            resolve(password);
                        }
                    });
                }
            }, 100);
            
            // Store resolve function for button click
            this.masterPasswordResolve = resolve;
        });
    }

    resolveMasterPasswordPrompt(password) {
        if (this.masterPasswordResolve) {
            this.masterPasswordResolve(password);
            this.masterPasswordResolve = null;
        }
    }

    async loadApiTokenFromAccount() {
        try {
            if (!window.firebaseManager || !window.firebaseManager.user) {
                return false;
            }
            
            // Check if user has encrypted token
            const hasEncryptedToken = localStorage.getItem('hasEncryptedApiToken');
            if (hasEncryptedToken) {
                return await this.loadSecureApiTokenFromAccount();
            }
            
            // Fallback: try to load unencrypted token (legacy)
            const savedApiKey = await window.firebaseManager.getUserApiKey();
            if (savedApiKey) {
                localStorage.setItem('screepsApiToken', savedApiKey);
                this.api.setToken(savedApiKey);
                this.addConsoleMessage('success', 'API token loaded from your account');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to load API token from account:', error);
            return false;
        }
    }

    // Firestore integration methods
    async saveStatsToFirestore(stats) {
        if (!window.firebaseManager || !window.firebaseManager.user) {
            return; // User not authenticated, skip Firestore save
        }

        try {
            await window.firebaseManager.saveGameData('stats', {
                ...stats,
                timestamp: new Date().toISOString(),
                source: 'dashboard'
            });
            console.log('Stats saved to Firestore');
        } catch (error) {
            console.warn('Failed to save stats to Firestore:', error);
        }
    }

    async saveRoomsToFirestore(roomsData) {
        if (!window.firebaseManager || !window.firebaseManager.user) {
            return; // User not authenticated, skip Firestore save
        }

        try {
            await window.firebaseManager.saveGameData('rooms', {
                rooms: roomsData,
                timestamp: new Date().toISOString(),
                source: 'dashboard'
            });
            console.log('Rooms data saved to Firestore');
        } catch (error) {
            console.warn('Failed to save rooms data to Firestore:', error);
        }
    }

    async loadStatsFromFirestore(limit = 24) {
        if (!window.firebaseManager || !window.firebaseManager.user) {
            return [];
        }

        try {
            const data = await window.firebaseManager.getGameData('stats', limit);
            console.log(`Loaded ${data.length} stats entries from Firestore`);
            return data;
        } catch (error) {
            console.warn('Failed to load stats from Firestore:', error);
            return [];
        }
    }

    async loadRoomsFromFirestore(limit = 24) {
        if (!window.firebaseManager || !window.firebaseManager.user) {
            return [];
        }

        try {
            const data = await window.firebaseManager.getGameData('rooms', limit);
            console.log(`Loaded ${data.length} rooms entries from Firestore`);
            return data;
        } catch (error) {
            console.warn('Failed to load rooms from Firestore:', error);
            return [];
        }
    }

    async syncWithFirestore() {
        if (!window.firebaseManager || !window.firebaseManager.user) {
            console.log('User not authenticated, skipping Firestore sync');
            return;
        }

        try {
            console.log('Syncing historical data with Firestore...');
            
            // Load recent data from Firestore
            const firestoreStats = await this.loadStatsFromFirestore(50);
            const firestoreRooms = await this.loadRoomsFromFirestore(50);
            
            // Merge with local data (avoid duplicates by timestamp)
            const localStats = this.dataHistory.stats;
            const localRooms = this.dataHistory.rooms;
            
            // Create timestamp sets for deduplication
            const localStatsTimestamps = new Set(localStats.map(entry => entry.timestamp));
            const localRoomsTimestamps = new Set(localRooms.map(entry => entry.timestamp));
            
            // Add Firestore data that's not in local storage
            firestoreStats.forEach(entry => {
                if (entry.data && entry.data.timestamp && !localStatsTimestamps.has(entry.data.timestamp)) {
                    this.dataHistory.stats.push({
                        timestamp: entry.data.timestamp,
                        data: entry.data
                    });
                }
            });
            
            firestoreRooms.forEach(entry => {
                if (entry.data && entry.data.timestamp && !localRoomsTimestamps.has(entry.data.timestamp)) {
                    this.dataHistory.rooms.push({
                        timestamp: entry.data.timestamp,
                        data: entry.data.rooms || entry.data
                    });
                }
            });
            
            // Sort by timestamp and keep only recent entries
            this.dataHistory.stats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            this.dataHistory.rooms.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Keep only the last maxEntries
            if (this.dataHistory.stats.length > this.dataHistory.maxEntries) {
                this.dataHistory.stats = this.dataHistory.stats.slice(-this.dataHistory.maxEntries);
            }
            if (this.dataHistory.rooms.length > this.dataHistory.maxEntries) {
                this.dataHistory.rooms = this.dataHistory.rooms.slice(-this.dataHistory.maxEntries);
            }
            
            // Save merged data to localStorage
            this.saveToLocalStorage();
            
            console.log('Firestore sync completed');
        } catch (error) {
            console.error('Failed to sync with Firestore:', error);
        }
    }

    // Enhanced export function that includes Firestore data
    async exportAllData() {
        try {
            const allData = {
                stats: this.dataHistory.stats,
                rooms: this.dataHistory.rooms,
                exportTime: new Date().toISOString(),
                version: '1.0'
            };
            
            const dataStr = JSON.stringify(allData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `screeps-dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('All data exported successfully');
        } catch (error) {
            console.error('Failed to export all data:', error);
        }
    }

    // DEBUG: CPU-Daten testen
    debugCpuData() {
        console.log('=== CPU DEBUG INFO ===');
        
        // Aktuelle Chart-Daten
        if (this.chartData.cpu) {
            console.log('CPU Chart Data:', this.chartData.cpu.data);
            console.log('Last 5 CPU values:', this.chartData.cpu.data.slice(-5));
        }
        
        // Letzte Stats
        if (this.lastStats) {
            console.log('Last Stats CPU:', this.lastStats.cpu);
            console.log('Last Stats CPU Limit:', this.lastStats.cpuLimit);
            console.log('Last Stats CPU Percentage:', this.lastStats.cpuPercentage);
        }
        
        // API-Test
        if (this.api) {
            console.log('Testing API CPU data...');
            this.api.getGameStats().then(stats => {
                console.log('Fresh API CPU data:', {
                    cpu: stats.cpu,
                    cpuLimit: stats.cpuLimit,
                    cpuPercentage: stats.cpuPercentage
                });
            }).catch(err => {
                console.error('API test failed:', err);
            });
        }
        
        console.log('=== END CPU DEBUG ===');
    }

    // ERWEITERTE CPU-DIAGNOSE
    async debugCpuDetailed() {
        console.log('🔍 === DETAILED CPU ANALYSIS ===');
        
        try {
            // Test alle API-Endpunkte parallel
            const [userInfo, memory, overview] = await Promise.all([
                this.api.getUserInfo().catch(e => ({ error: e.message })),
                this.api.getMemory().catch(e => ({ error: e.message })),
                this.api.getOverview().catch(e => ({ error: e.message }))
            ]);
            
            console.log('📊 Raw API Responses:');
            console.log('UserInfo:', userInfo);
            console.log('Memory:', memory);
            console.log('Overview:', overview);
            
            // Analysiere CPU-Daten aus jeder Quelle
            console.log('\n🎯 CPU Data Analysis:');
            
            // 1. UserInfo CPU-Daten
            if (userInfo && !userInfo.error) {
                console.log('1️⃣ UserInfo CPU Data:');
                console.log('  cpu:', userInfo.cpu);
                console.log('  cpuLimit:', userInfo.cpuLimit);
                console.log('  cpuShard:', userInfo.cpuShard);
                console.log('  cpuAvailable:', userInfo.cpuAvailable);
                console.log('  cpuUsed:', userInfo.cpuUsed);
                
                // Bestimme wahrscheinlichste CPU-Verbrauchswerte
                const possibleUsage = [];
                if (userInfo.cpuUsed !== undefined) possibleUsage.push({ source: 'cpuUsed', value: userInfo.cpuUsed });
                if (userInfo.cpu !== undefined && userInfo.cpu < (userInfo.cpuLimit || 20)) {
                    possibleUsage.push({ source: 'cpu (if < limit)', value: userInfo.cpu });
                }
                console.log('  Possible usage values:', possibleUsage);
            }
            
            // 2. Memory CPU-Daten
            if (memory && !memory.error && memory.dashboard) {
                console.log('2️⃣ Memory Dashboard CPU Data:');
                console.log('  dashboard.stats.cpu:', memory.dashboard.stats?.cpu);
                if (memory.dashboard.stats?.cpu) {
                    console.log('  ✅ This should be the most accurate!');
                }
            } else {
                console.log('2️⃣ Memory Dashboard: No data found');
                console.log('  💡 Make sure dashboard_exporter.js is running in Screeps');
            }
            
            // 3. Overview CPU-Daten
            if (overview && !overview.error) {
                console.log('3️⃣ Overview CPU Data:');
                console.log('  stats:', overview.stats);
                console.log('  stats.cpu:', overview.stats?.cpu);
            }
            
            // 4. Aktuelle Dashboard-Werte
            console.log('\n📈 Current Dashboard Values:');
            if (this.lastStats) {
                console.log('  Dashboard CPU:', this.lastStats.cpu);
                console.log('  Dashboard CPU Limit:', this.lastStats.cpuLimit);
                console.log('  Dashboard CPU %:', this.lastStats.cpuPercentage);
                console.log('  CPU Data Source:', this.lastStats.debug?.cpuDataSource || 'unknown');
                
                // Prüfe ob Werte realistisch sind
                if (this.lastStats.cpu === this.lastStats.cpuLimit) {
                    console.log('  ❌ CPU equals limit - showing limit instead of usage!');
                } else if (this.lastStats.cpu >= 2 && this.lastStats.cpu <= 6) {
                    console.log('  ✅ CPU values look realistic (2-6 range for your setup)');
                } else {
                    console.log('  ⚠️ CPU values outside expected 2-6 range for your setup');
                }
            }
            
            // 5. Test Live CPU Data
            console.log('\n🔥 Testing Live CPU Data:');
            try {
                const liveCpuData = await this.api.getLiveCpuData();
                if (liveCpuData) {
                    console.log('  ✅ Live CPU Data:', liveCpuData);
                } else {
                    console.log('  ❌ Live CPU Data not available');
                }
            } catch (liveError) {
                console.log('  ❌ Live CPU Data failed:', liveError.message);
            }
            
            // 6. Test CPU Estimation
            console.log('\n🤖 CPU Estimation Test:');
            const creepCount = this.lastStats?.creeps || 5;
            const roomCount = this.lastStats?.rooms || 1;
            const spawnCount = this.lastStats?.spawns || 1;
            
            const estimatedCpu = this.api.estimateCpuUsage(creepCount, roomCount, spawnCount);
            console.log(`  Based on ${creepCount} creeps, ${roomCount} rooms, ${spawnCount} spawns:`);
            console.log(`  Estimated CPU: ${estimatedCpu.toFixed(1)} (should be close to Screeps interface value)`);
            
            // 7. Empfehlungen
            console.log('\n💡 Recommendations:');
            if (memory && memory.dashboard && memory.dashboard.stats?.cpu) {
                console.log('  ✅ Use Memory.dashboard.stats.cpu (most accurate)');
                console.log('  Current value:', memory.dashboard.stats.cpu.used || memory.dashboard.stats.cpu);
            } else {
                console.log('  ❌ Memory.dashboard not available');
                console.log('  🔧 Enable dashboard_exporter.js in your Screeps code');
                console.log('  📝 Add to main.js: dashboardExporter.run() every 10 ticks');
                console.log('  🤖 Using CPU estimation as fallback');
            }
            
        } catch (error) {
            console.error('❌ Detailed CPU analysis failed:', error);
        }
        
        console.log('🔍 === END DETAILED ANALYSIS ===');
    }

    // CHART MODE SWITCHING FUNCTIONS
    switchChartMode(mode) {
        this.currentChartMode = mode;
        
        const sessionCharts = document.getElementById('sessionCharts');
        const historicalCharts = document.getElementById('historicalCharts');
        const sessionBtn = document.getElementById('sessionModeBtn');
        const historicalBtn = document.getElementById('historicalModeBtn');
        const chartModeInfo = document.getElementById('chartModeInfo');
        
        if (mode === 'session') {
            sessionCharts.style.display = 'grid';
            historicalCharts.style.display = 'none';
            sessionBtn.classList.add('active');
            historicalBtn.classList.remove('active');
            chartModeInfo.textContent = 'Showing: Current session data (last 20 updates)';
            console.log('📊 Switched to session chart mode');
        } else if (mode === 'historical') {
            sessionCharts.style.display = 'none';
            historicalCharts.style.display = 'grid';
            sessionBtn.classList.remove('active');
            historicalBtn.classList.add('active');
            chartModeInfo.textContent = 'Showing: Historical data from database (last 24 hours)';
            console.log('📊 Switched to historical chart mode');
            
            // Load historical data if not already loaded
            if (this.historicalChartData.energy.labels.length === 0) {
                this.loadHistoricalChartData();
            }
        }
    }

    async loadHistoricalChartData() {
        try {
            console.log('📥 Loading historical chart data from Firestore...');
            
            if (!window.firebaseManager || !window.firebaseManager.isInitialized) {
                console.warn('Firebase not available, cannot load historical data');
                this.addConsoleMessage('warning', 'Database not available - historical charts disabled');
                return;
            }

            // Load historical stats from Firestore (last 24 hours)
            const historicalStats = await this.loadStatsFromFirestore(48); // 48 entries = ~24 hours at 30min intervals
            
            if (!historicalStats || historicalStats.length === 0) {
                console.warn('No historical data found in Firestore');
                this.addConsoleMessage('warning', 'No historical data found in database');
                return;
            }

            // Process historical data for charts
            this.processHistoricalDataForCharts(historicalStats);
            
            // Update historical charts
            this.updateHistoricalCharts();
            
            console.log(`✅ Loaded ${historicalStats.length} historical data points`);
            this.addConsoleMessage('success', `Loaded ${historicalStats.length} historical data points from database`);
            
        } catch (error) {
            console.error('Failed to load historical chart data:', error);
            this.addConsoleMessage('error', 'Failed to load historical data: ' + error.message);
        }
    }

    processHistoricalDataForCharts(historicalStats) {
        // Clear existing historical data
        this.historicalChartData = {
            energy: { labels: [], data: [] },
            cpu: { labels: [], data: [] },
            creeps: { labels: [], data: [] },
            roomEfficiency: { labels: [], data: [] }
        };

        // Sort by timestamp
        historicalStats.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Process each data point
        historicalStats.forEach(stat => {
            const timestamp = new Date(stat.timestamp);
            const timeLabel = timestamp.toLocaleDateString('de-DE') + ' ' + 
                            timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            
            // Energy data
            this.historicalChartData.energy.labels.push(timeLabel);
            this.historicalChartData.energy.data.push(stat.energy || 0);
            
            // CPU data
            this.historicalChartData.cpu.labels.push(timeLabel);
            this.historicalChartData.cpu.data.push(stat.cpu || 0);
            
            // Creeps data
            this.historicalChartData.creeps.labels.push(timeLabel);
            this.historicalChartData.creeps.data.push(stat.creeps || 0);
            
            // Room efficiency data (calculate from energy percentage)
            this.historicalChartData.roomEfficiency.labels.push(timeLabel);
            this.historicalChartData.roomEfficiency.data.push(stat.energyPercentage || 0);
        });

        console.log('📊 Processed historical data for charts:', {
            energyPoints: this.historicalChartData.energy.data.length,
            cpuPoints: this.historicalChartData.cpu.data.length,
            creepsPoints: this.historicalChartData.creeps.data.length,
            efficiencyPoints: this.historicalChartData.roomEfficiency.data.length
        });
    }

    updateHistoricalCharts() {
        // Update Energy Historical Chart
        if (this.charts.energyHistorical) {
            this.charts.energyHistorical.data.labels = this.historicalChartData.energy.labels;
            this.charts.energyHistorical.data.datasets[0].data = this.historicalChartData.energy.data;
            this.charts.energyHistorical.update();
        }

        // Update CPU Historical Chart
        if (this.charts.cpuHistorical) {
            this.charts.cpuHistorical.data.labels = this.historicalChartData.cpu.labels;
            this.charts.cpuHistorical.data.datasets[0].data = this.historicalChartData.cpu.data;
            this.charts.cpuHistorical.update();
        }

        // Update Creeps Historical Chart
        if (this.charts.creepsHistorical) {
            this.charts.creepsHistorical.data.labels = this.historicalChartData.creeps.labels;
            this.charts.creepsHistorical.data.datasets[0].data = this.historicalChartData.creeps.data;
            this.charts.creepsHistorical.update();
        }

        // Update Room Efficiency Chart
        if (this.charts.roomEfficiency) {
            this.charts.roomEfficiency.data.labels = this.historicalChartData.roomEfficiency.labels;
            this.charts.roomEfficiency.data.datasets[0].data = this.historicalChartData.roomEfficiency.data;
            this.charts.roomEfficiency.update();
        }

        console.log('📊 Historical charts updated successfully');
    }
}

// Globale Debug-Funktionen
global.debugCpu = function() {
    if (window.dashboard) {
        window.dashboard.debugCpuData();
    } else {
        console.log('Dashboard not available');
    }
};

global.debugCpuDetailed = function() {
    if (window.dashboard) {
        window.dashboard.debugCpuDetailed();
    } else {
        console.log('Dashboard not available');
    }
};

// NEUE DEBUG-FUNKTIONEN FÜR CHART-MODI
global.testChartModes = function() {
    if (window.dashboard) {
        console.log('🧪 Testing Chart Mode Switching...');
        console.log('Current mode:', window.dashboard.currentChartMode);
        
        // Test session mode
        console.log('📊 Testing session mode...');
        window.dashboard.switchChartMode('session');
        
        setTimeout(() => {
            // Test historical mode
            console.log('📊 Testing historical mode...');
            window.dashboard.switchChartMode('historical');
            
            setTimeout(() => {
                // Back to session mode
                console.log('📊 Back to session mode...');
                window.dashboard.switchChartMode('session');
                console.log('✅ Chart mode switching test completed');
            }, 2000);
        }, 2000);
    } else {
        console.log('Dashboard not available');
    }
};

global.loadHistoricalData = function() {
    if (window.dashboard) {
        console.log('📥 Loading historical chart data...');
        window.dashboard.loadHistoricalChartData();
    } else {
        console.log('Dashboard not available');
    }
};

global.showChartInfo = function() {
    if (window.dashboard) {
        console.log('📊 Chart Information:');
        console.log('Current mode:', window.dashboard.currentChartMode);
        console.log('Session data points:', {
            energy: window.dashboard.chartData.energy.data.length,
            cpu: window.dashboard.chartData.cpu.data.length,
            creeps: window.dashboard.chartData.creeps.data.length
        });
        console.log('Historical data points:', {
            energy: window.dashboard.historicalChartData.energy.data.length,
            cpu: window.dashboard.historicalChartData.cpu.data.length,
            creeps: window.dashboard.historicalChartData.creeps.data.length,
            roomEfficiency: window.dashboard.historicalChartData.roomEfficiency.data.length
        });
        console.log('Available charts:', Object.keys(window.dashboard.charts));
    } else {
        console.log('Dashboard not available');
    }
};

global.testCpuFix = function() {
    console.log('🧪 Testing CPU fix...');
    if (window.dashboard && window.dashboard.api) {
        window.dashboard.api.getGameStats().then(stats => {
            console.log('✅ CPU Test Results:');
            console.log(`CPU Used: ${stats.cpu}`);
            console.log(`CPU Limit: ${stats.cpuLimit}`);
            console.log(`CPU Percentage: ${stats.cpuPercentage}%`);
            console.log(`Expected: CPU should be between 2-4 and vary over time`);
            
            if (stats.cpu === stats.cpuLimit) {
                console.log('❌ Still showing CPU limit instead of usage!');
                console.log('💡 Check if dashboard_exporter.js is running in Screeps');
            } else if (stats.cpu >= 2 && stats.cpu <= 4) {
                console.log('✅ CPU values look realistic!');
            } else {
                console.log('⚠️ CPU values outside expected 2-4 range');
                console.log('💡 Run debugCpuDetailed() for more analysis');
            }
        });
    }
};

// Schnelle CPU-Analyse
global.quickCpuCheck = function() {
    console.log('⚡ Quick CPU Check...');
    if (window.dashboard && window.dashboard.lastStats) {
        const stats = window.dashboard.lastStats;
        console.log(`Current CPU: ${stats.cpu}`);
        console.log(`CPU Limit: ${stats.cpuLimit}`);
        console.log(`CPU %: ${stats.cpuPercentage}%`);
        
        if (stats.cpu >= 2 && stats.cpu <= 4) {
            console.log('✅ Values look good!');
        } else {
            console.log('❌ Values look wrong - run debugCpuDetailed()');
        }
    } else {
        console.log('No dashboard data available');
    }
};

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
        alert('Please enter an API token');
        return;
    }
    
    if (!window.dashboard) {
        alert('Dashboard not initialized. Please reload the page.');
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
    window.dashboard.addConsoleMessage('success', 'Configuration saved');
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