#!/usr/bin/env node

// Test script für CPU-Fix
const fs = require('fs');
const path = require('path');

// Simuliere Browser-Umgebung
global.window = {};
global.document = {
    getElementById: () => ({ textContent: '', style: {} }),
    createElement: () => ({ textContent: '', style: {} })
};
global.console = console;

// Lade pako für gzip-Dekomprimierung
const pako = require('pako');
global.pako = pako;

// Lade die API-Klasse
const apiCode = fs.readFileSync(path.join(__dirname, 'screeps-api.js'), 'utf8');

// Simuliere fetch für Node.js
global.fetch = require('node-fetch');

// Evaluiere den API-Code
eval(apiCode);

async function testCpuFix() {
    console.log('🧪 === CPU FIX TEST ===');
    
    const api = new ScreepsAPI();
    const token = '16b0222c-47e4-482b-bf6e-6ba76994a35e';
    api.setToken(token);
    
    try {
        console.log('📡 Testing API endpoints...');
        
        // Test alle Endpunkte
        const [userInfo, memory, overview] = await Promise.all([
            api.getUserInfo().catch(e => ({ error: e.message })),
            api.getMemory().catch(e => ({ error: e.message })),
            api.getOverview().catch(e => ({ error: e.message }))
        ]);
        
        console.log('\n📊 Results:');
        console.log('UserInfo CPU:', userInfo.cpu, '/', userInfo.cpuLimit || userInfo.cpuShard?.shard3);
        
        if (memory && memory.dashboard && memory.dashboard.stats?.cpu) {
            console.log('✅ Memory Dashboard CPU:', memory.dashboard.stats.cpu);
        } else {
            console.log('❌ No Memory Dashboard CPU data');
        }
        
        if (overview && overview.stats?.cpu) {
            console.log('Overview CPU:', overview.stats.cpu);
        } else {
            console.log('❌ No Overview CPU data');
        }
        
        // Test Game Stats (das ist was das Dashboard verwendet)
        console.log('\n🎮 Testing Game Stats (Dashboard Data):');
        const gameStats = await api.getGameStats();
        
        console.log('Game Stats CPU:', gameStats.cpu);
        console.log('Game Stats CPU Limit:', gameStats.cpuLimit);
        console.log('Game Stats CPU %:', gameStats.cpuPercentage);
        console.log('CPU Data Source:', gameStats.debug?.cpuDataSource);
        
        // Bewerte die Ergebnisse
        console.log('\n🎯 Analysis:');
        if (gameStats.cpu === gameStats.cpuLimit) {
            console.log('❌ PROBLEM: CPU equals limit - still showing limit instead of usage!');
        } else if (gameStats.cpu >= 2 && gameStats.cpu <= 6) {
            console.log('✅ SUCCESS: CPU values look realistic (2-6 range)');
        } else if (gameStats.cpu < 2) {
            console.log('⚠️ CPU very low - might be accurate or outdated memory data');
        } else {
            console.log('⚠️ CPU higher than expected - check if this matches Screeps interface');
        }
        
        // Test CPU-Schätzung
        const estimatedCpu = api.estimateCpuUsage(gameStats.creeps || 5, gameStats.rooms || 1, gameStats.spawns || 1);
        console.log(`🤖 Estimated CPU: ${estimatedCpu.toFixed(1)} (based on ${gameStats.creeps || 5} creeps)`);
        
        console.log('\n💡 Recommendations:');
        if (gameStats.debug?.cpuDataSource === 'memory.dashboard') {
            console.log('✅ Using accurate memory dashboard data');
        } else if (gameStats.debug?.cpuDataSource === 'estimated') {
            console.log('🤖 Using CPU estimation - should be close to Screeps interface value');
        } else {
            console.log('⚠️ Using fallback CPU data - may be inaccurate');
            console.log('💡 Enable dashboard_exporter.js in Screeps for accurate data');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    console.log('🧪 === END TEST ===');
}

// Führe Test aus
testCpuFix().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
}); 