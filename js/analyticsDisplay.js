import { ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';
import { database } from './configFirebase.js';

let hourlyChart = null;
let dailyChart = null;

async function loadAnalytics() {
    if (hourlyChart) {
        hourlyChart.destroy();
    }
    if (dailyChart) {
        dailyChart.destroy();
    }

    const today = new Date();
    const analyticsRef = ref(database, `analytics/${today.getFullYear()}/${today.getMonth() + 1}`);
    
    // Initialize data arrays
    const hourlyData = new Array(24).fill(0);
    const dailyData = new Array(7).fill(0);
    let todayCount = 0;
    let weekCount = 0;

    const snapshot = await get(analyticsRef);
    if (snapshot.exists()) {
        const data = snapshot.val();
        
        Object.values(data).forEach(day => {
            Object.values(day).forEach(entry => {
                if (entry.date === today.getDate()) {
                    todayCount++;
                    hourlyData[entry.hour]++;
                }
                
                const entryDate = new Date(entry.timestamp);
                const dayDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
                if (dayDiff < 7) {
                    weekCount++;
                    dailyData[entry.day]++;
                }
            });
        });
    }

    // Update counters
    document.getElementById('todayTotal').textContent = todayCount;
    document.getElementById('weekTotal').textContent = weekCount;

    // Create charts with the processed data
    hourlyChart = new Chart(document.getElementById('hourlyChart'), {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Jumlah Antrian per Jam',
                data: hourlyData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)'
            }]
        }
    });
    
    dailyChart = new Chart(document.getElementById('dailyChart'), {
        type: 'bar',
        data: {
            labels: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
            datasets: [{
                label: 'Jumlah Antrian per Hari',
                data: dailyData,
                backgroundColor: 'rgba(255, 99, 132, 0.5)'
            }]
        }
    });
}

function resetAnalytics() {
    document.getElementById('resetAnalytics').addEventListener('click', async () => {
        if (confirm('Apakah Anda yakin ingin menghapus semua data analisis? Tindakan ini tidak dapat dibatalkan.')) {
            const analyticsRef = ref(database, 'analytics');
            await remove(analyticsRef);
            
            document.getElementById('todayTotal').textContent = '0';
            document.getElementById('weekTotal').textContent = '0';
            
            await loadAnalytics();
            
            alert('Data analisis berhasil direset');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
    resetAnalytics();
});
