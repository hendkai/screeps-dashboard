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
    }

    destroyCharts() {
        // Destroy existing charts to prevent "Canvas is already in use" error
        if (this.charts.energy) {
            this.charts.energy.destroy();
            this.charts.energy = null;
        }
        if (this.charts.cpu) {
            this.charts.cpu.destroy();
            this.charts.cpu = null;
        }
    }

    initCharts() {
        // Destroy existing charts first
        this.destroyCharts();
        
        // Get canvas elements and set maximum dimensions
        const energyCanvas = document.getElementById('energyChart');
        const cpuCanvas = document.getElementById('cpuChart');
        
        if (!energyCanvas || !cpuCanvas) {
            console.warn('Chart canvases not found');
            return;
        }
        
        // Check if canvases are already in use by checking for existing chart instances
        if (Chart.getChart(energyCanvas)) {
            console.log('Destroying existing chart on energyCanvas');
            Chart.getChart(energyCanvas).destroy();
        }
        if (Chart.getChart(cpuCanvas)) {
            console.log('Destroying existing chart on cpuCanvas');
            Chart.getChart(cpuCanvas).destroy();
        }
        
        // Set maximum canvas dimensions to prevent size errors
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const maxHeight = 400;
        
        energyCanvas.style.maxWidth = maxWidth + 'px';
        energyCanvas.style.maxHeight = maxHeight + 'px';
        cpuCanvas.style.maxWidth = maxWidth + 'px';
        cpuCanvas.style.maxHeight = maxHeight + 'px';

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
            roomCount: document.getElementById('roomCount')
        };

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
    }

    updateCharts(stats) {
        if (!this.charts.energy || !this.charts.cpu) return;
        
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