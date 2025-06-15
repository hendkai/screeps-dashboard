#!/usr/bin/env node

// TEST SCRIPT für CPU API Debugging
// Testet alle verfügbaren API-Endpunkte für CPU-Daten

const https = require('https');

// API Token aus Umgebungsvariable oder Argument
const API_TOKEN = process.env.SCREEPS_TOKEN || process.argv[2];

if (!API_TOKEN) {
    console.log('❌ Kein API Token gefunden!');
    console.log('Verwendung: node test_cpu_api.js <TOKEN>');
    console.log('Oder: SCREEPS_TOKEN=<token> node test_cpu_api.js');
    process.exit(1);
}

console.log('🧪 Testing Screeps CPU API...');
console.log('Token:', API_TOKEN.substring(0, 8) + '...');

// API Request Funktion
function apiRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'screeps.com',
            port: 443,
            path: `/api${endpoint}`,
            method: 'GET',
            headers: {
                'X-Token': API_TOKEN,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data, error: e.message });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('Timeout')));
        req.end();
    });
}

// Test alle relevanten Endpunkte
async function testAllEndpoints() {
    const endpoints = [
        '/user/me',
        '/user/memory',
        '/user/overview',
        '/game/time'
    ];

    for (const endpoint of endpoints) {
        console.log(`\n📡 Testing ${endpoint}...`);
        try {
            const result = await apiRequest(endpoint);
            console.log(`Status: ${result.status}`);
            
            if (result.status === 200) {
                // Analysiere CPU-relevante Daten
                if (endpoint === '/user/me') {
                    console.log('👤 User Info CPU Data:');
                    const data = result.data;
                    console.log('  cpu:', data.cpu);
                    console.log('  cpuLimit:', data.cpuLimit);
                    console.log('  cpuShard:', data.cpuShard);
                    console.log('  cpuAvailable:', data.cpuAvailable);
                    console.log('  cpuUsed:', data.cpuUsed);
                }
                
                if (endpoint === '/user/memory') {
                    console.log('🧠 Memory CPU Data:');
                    const data = result.data;
                    if (data.data && data.data.dashboard) {
                        console.log('  dashboard.stats.cpu:', data.data.dashboard.stats?.cpu);
                    } else {
                        console.log('  No dashboard data in memory');
                    }
                }
                
                if (endpoint === '/user/overview') {
                    console.log('📊 Overview CPU Data:');
                    const data = result.data;
                    console.log('  stats:', data.stats);
                    console.log('  cpu in stats:', data.stats?.cpu);
                }
                
                if (endpoint === '/game/time') {
                    console.log('⏰ Game Time:');
                    console.log('  time:', result.data.time);
                }
            } else {
                console.log('❌ Error:', result.data);
            }
        } catch (error) {
            console.log('❌ Request failed:', error.message);
        }
    }
}

// Teste Memory-spezifische CPU-Daten
async function testMemoryDetails() {
    console.log('\n🔍 Detailed Memory Analysis...');
    try {
        const result = await apiRequest('/user/memory');
        if (result.status === 200 && result.data.data) {
            const memory = result.data.data;
            
            console.log('Memory structure:');
            console.log('  Keys:', Object.keys(memory));
            
            if (memory.dashboard) {
                console.log('  dashboard keys:', Object.keys(memory.dashboard));
                if (memory.dashboard.stats) {
                    console.log('  dashboard.stats keys:', Object.keys(memory.dashboard.stats));
                    console.log('  dashboard.stats.cpu:', JSON.stringify(memory.dashboard.stats.cpu, null, 2));
                }
            }
            
            // Suche nach anderen CPU-Referenzen
            const memoryStr = JSON.stringify(memory);
            const cpuMatches = memoryStr.match(/cpu[^"]*":\s*[0-9.]+/gi);
            if (cpuMatches) {
                console.log('  Found CPU references:', cpuMatches);
            }
        }
    } catch (error) {
        console.log('❌ Memory analysis failed:', error.message);
    }
}

// Hauptfunktion
async function main() {
    await testAllEndpoints();
    await testMemoryDetails();
    
    console.log('\n🎯 Summary:');
    console.log('Expected CPU values should be between 2-4 as mentioned.');
    console.log('Check which endpoint provides the most accurate real-time CPU usage.');
}

main().catch(console.error); 