// Dashboard Controller
class ScreepsDashboard {
    constructor() {
        this.api = new ScreepsAPI();
        this.updateInterval = 5000;
        this.intervalId = null;
        this.charts = {};
        this.chartData = {
            energy: { labels: [], data: [] },
            cpu: { labels: [], data: [] }
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
        
        // Update mode buttons based on current proxy setting
        this.updateModeButtons();
    }

    updateModeButtons() {
        const directBtn = document.getElementById('directModeBtn');
        const proxyBtn = document.getElementById('proxyModeBtn');
        
        if (directBtn && proxyBtn) {
            if (this.api.useProxy) {
                proxyBtn.classList.add('active');
                directBtn.classList.remove('active');
            } else {
                directBtn.classList.add('active');
                proxyBtn.classList.remove('active');
            }
        }
    }

    initCharts() {
        // Get canvas elements and set maximum dimensions
        const energyCanvas = document.getElementById('energyChart');
        const cpuCanvas = document.getElementById('cpuChart');
        
        // Set maximum canvas dimensions to prevent size errors
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const maxHeight = 400;
        
        energyCanvas.style.maxWidth = maxWidth + 'px';
        energyCanvas.style.maxHeight = maxHeight + 'px';
        cpuCanvas.style.maxWidth = maxWidth + 'px';
        cpuCanvas.style.maxHeight = maxHeight + 'px';

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
                devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Limit pixel ratio
                animation: {
                    duration: 0 // Disable animations to reduce canvas operations
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
                            maxTicksLimit: 10 // Limit number of ticks
                        },
                        grid: { color: '#333333' }
                    },
                    y: {
                        ticks: { 
                            color: '#00ff88',
                            maxTicksLimit: 8 // Limit number of ticks
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
                devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Limit pixel ratio
                animation: {
                    duration: 0 // Disable animations to reduce canvas operations
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
                            maxTicksLimit: 10 // Limit number of ticks
                        },
                        grid: { color: '#333333' }
                    },
                    y: {
                        ticks: { 
                            color: '#00ff88',
                            maxTicksLimit: 8 // Limit number of ticks
                        },
                        grid: { color: '#333333' }
                    }
                }
            }
        });
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'connected':
                icon.className = 'fas fa-circle';
                text.textContent = 'Verbunden';
                break;
            case 'disconnected':
                icon.className = 'fas fa-circle';
                text.textContent = 'Getrennt';
                break;
            case 'connecting':
                icon.className = 'fas fa-circle';
                text.textContent = 'Verbindung wird hergestellt...';
                break;
        }
    }

    async updateDashboard() {
        try {
            this.updateConnectionStatus('connecting');
            
            const stats = await this.api.getGameStats();
            
            document.getElementById('energyValue').textContent = 
                `${stats.energy}/${stats.energyCapacity}`;
            document.getElementById('creepCount').textContent = stats.creeps;
            document.getElementById('cpuUsage').textContent = 
                `${stats.cpu.toFixed(1)}/${stats.cpuLimit}`;
            document.getElementById('roomCount').textContent = stats.rooms;
            
            this.updateCharts(stats);
            this.updateCreepsDisplay(stats.roomsData);
            this.updateRoomsDisplay(stats.roomsData);
            await this.updateConsole();
            
            this.updateConnectionStatus('connected');
            
        } catch (error) {
            console.error('Dashboard update failed:', error);
            this.updateConnectionStatus('disconnected');
            this.addConsoleMessage('error', error.message);
        }
    }

    updateCharts(stats) {
        const now = new Date().toLocaleTimeString();
        
        this.chartData.energy.labels.push(now);
        this.chartData.energy.data.push(stats.energy);
        
        this.chartData.cpu.labels.push(now);
        this.chartData.cpu.data.push(stats.cpu);
        
        if (this.chartData.energy.labels.length > this.maxDataPoints) {
            this.chartData.energy.labels.shift();
            this.chartData.energy.data.shift();
            this.chartData.cpu.labels.shift();
            this.chartData.cpu.data.shift();
        }
        
        this.charts.energy.update();
        this.charts.cpu.update();
    }

    updateCreepsDisplay(roomsData) {
        const creepsGrid = document.getElementById('creepsGrid');
        creepsGrid.innerHTML = '';
        
        roomsData.forEach(room => {
            if (room.data && room.data.objects) {
                const creeps = room.data.objects.filter(obj => obj.type === 'creep');
                
                creeps.forEach(creep => {
                    const creepCard = document.createElement('div');
                    creepCard.className = 'creep-card';
                    
                    const role = creep.name.split('_')[0] || 'unknown';
                    const energy = creep.store ? creep.store.energy || 0 : 0;
                    const energyCapacity = creep.storeCapacity || 0;
                    const hits = creep.hits || 0;
                    const hitsMax = creep.hitsMax || 0;
                    
                    creepCard.innerHTML = `
                        <div class="creep-header">
                            <div class="creep-name">${creep.name}</div>
                            <div class="creep-role">${role}</div>
                        </div>
                        <div class="creep-stats">
                            <div class="stat-item">
                                <span>Energie</span>
                                <span>${energy}/${energyCapacity}</span>
                            </div>
                            <div class="stat-item">
                                <span>Leben</span>
                                <span>${hits}/${hitsMax}</span>
                            </div>
                            <div class="stat-item">
                                <span>Raum</span>
                                <span>${room.name}</span>
                            </div>
                        </div>
                    `;
                    
                    creepsGrid.appendChild(creepCard);
                });
            }
        });
    }

    updateRoomsDisplay(roomsData) {
        const roomsGrid = document.getElementById('roomsGrid');
        roomsGrid.innerHTML = '';
        
        roomsData.forEach(room => {
            if (room.data && room.data.objects) {
                const roomCard = document.createElement('div');
                roomCard.className = 'room-card';
                
                const controller = room.data.objects.find(obj => obj.type === 'controller');
                const level = controller ? controller.level || 0 : 0;
                
                const spawns = room.data.objects.filter(obj => obj.type === 'spawn').length;
                const extensions = room.data.objects.filter(obj => obj.type === 'extension').length;
                const towers = room.data.objects.filter(obj => obj.type === 'tower').length;
                
                roomCard.innerHTML = `
                    <div class="room-header">
                        <div class="room-name">${room.name}</div>
                        <div class="room-level">RCL ${level}</div>
                    </div>
                    <div class="room-stats">
                        <div class="stat-item">
                            <span>Spawns</span>
                            <span>${spawns}</span>
                        </div>
                        <div class="stat-item">
                            <span>Extensions</span>
                            <span>${extensions}</span>
                        </div>
                        <div class="stat-item">
                            <span>Towers</span>
                            <span>${towers}</span>
                        </div>
                    </div>
                `;
                
                roomsGrid.appendChild(roomCard);
            }
        });
    }

    async updateConsole() {
        try {
            const consoleData = await this.api.getConsole();
            
            if (consoleData && consoleData.messages) {
                consoleData.messages.forEach(msg => {
                    this.addConsoleMessage('message', msg);
                });
            }
        } catch (error) {
            console.warn('Failed to update console:', error);
        }
    }

    addConsoleMessage(type, message) {
        const consoleOutput = document.getElementById('consoleOutput');
        const consoleLine = document.createElement('div');
        consoleLine.className = 'console-line';
        
        const timestamp = new Date().toLocaleTimeString();
        consoleLine.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message ${type}">${message}</span>
        `;
        
        consoleOutput.appendChild(consoleLine);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        const lines = consoleOutput.querySelectorAll('.console-line');
        if (lines.length > 100) {
            lines[0].remove();
        }
    }

    startUpdating() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.updateDashboard();
        
        this.intervalId = setInterval(() => {
            this.updateDashboard();
        }, this.updateInterval);
    }

    stopUpdating() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateConnectionStatus('disconnected');
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
    
    dashboard.api.setToken(token);
    
    if (serverUrl === 'custom' && customUrl) {
        dashboard.api.setServerUrl(customUrl);
    } else {
        dashboard.api.setServerUrl('https://screeps.com/api/');
    }
    
    window.closeConfigModal();
    dashboard.startUpdating();
    dashboard.addConsoleMessage('success', 'Konfiguration gespeichert');
};

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ScreepsDashboard();
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('configModal');
    if (e.target === modal) {
        window.closeConfigModal();
    }
});