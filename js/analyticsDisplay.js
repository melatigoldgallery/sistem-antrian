import { ref, get, remove } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js';
import { database } from './configFirebase.js';

let hourlyChart = null;
let dailyChart = null;
let currentHourlyPeriod = 'today';
let currentDailyPeriod = 'week';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAnalytics();
    resetAnalyticsHandler();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// Set up all event listeners
function setupEventListeners() {
    // Period selectors for hourly chart
    const hourlyPeriodLinks = document.querySelectorAll('[data-period]');
    hourlyPeriodLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const period = e.target.getAttribute('data-period');
            currentHourlyPeriod = period;
            
            // Update dropdown button text
            const dropdownButton = e.target.closest('.dropdown').querySelector('.dropdown-toggle');
            dropdownButton.innerHTML = `<i class="fas fa-calendar"></i> ${e.target.textContent}`;
            
            loadAnalytics();
        });
    });
}



// Load analytics data and update UI
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
    let totalWaitTime = 0;
    let totalCustomers = 0;
    let peakHourCount = 0;
    let peakHourIndex = 0;

    try {
        const snapshot = await get(analyticsRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Calculate period start dates
            const periodStartHourly = new Date();
            if (currentHourlyPeriod === 'week') {
                periodStartHourly.setDate(today.getDate() - 7);
            } else if (currentHourlyPeriod === 'month') {
                periodStartHourly.setMonth(today.getMonth() - 1);
            }
            
            const periodStartDaily = new Date();
            if (currentDailyPeriod === 'week') {
                periodStartDaily.setDate(today.getDate() - 7);
            } else if (currentDailyPeriod === 'month') {
                periodStartDaily.setMonth(today.getMonth() - 1);
            } else if (currentDailyPeriod === 'quarter') {
                periodStartDaily.setMonth(today.getMonth() - 3);
            }
            
            // Process data
            Object.values(data).forEach(day => {
                Object.values(day).forEach(entry => {
                    const entryDate = new Date(entry.timestamp);
                    
                    // Calculate wait time if available
                    if (entry.waitTime) {
                        totalWaitTime += entry.waitTime;
                        totalCustomers++;
                    }
                    
                    // Today's data
                    if (entry.date === today.getDate() && entry.month === (today.getMonth() + 1)) {
                        todayCount++;
                    }
                    
                    // Hourly data based on selected period
                    if (currentHourlyPeriod === 'today') {
                        if (entry.date === today.getDate() && entry.month === (today.getMonth() + 1)) {
                            hourlyData[entry.hour]++;
                        }
                    } else if (entryDate >= periodStartHourly) {
                        hourlyData[entry.hour]++;
                    }
                    
                    // Weekly data
                    const dayDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
                    if (dayDiff < 7) {
                        weekCount++;
                    }
                    
                    // Daily data based on selected period
                    if (entryDate >= periodStartDaily) {
                        dailyData[entry.day]++;
                    }
                });
            });
            
            // Find peak hour
            hourlyData.forEach((count, index) => {
                if (count > peakHourCount) {
                    peakHourCount = count;
                    peakHourIndex = index;
                }
            });
        }
        
        // Calculate average wait time
        const avgWaitTime = totalCustomers > 0 ? Math.round(totalWaitTime / totalCustomers) : 0;
        
        // Format peak hour
        const peakHour = peakHourIndex < 10 ? `0${peakHourIndex}:00` : `${peakHourIndex}:00`;
        
        // Update UI elements
        document.getElementById('todayTotal').textContent = todayCount;
        document.getElementById('weekTotal').textContent = weekCount;
        document.getElementById('avgWaitTime').textContent = `${avgWaitTime} min`;
        document.getElementById('peakHour').textContent = peakHour;
        
        // Update detailed metrics if they exist
        const avgWaitTimeDetailed = document.getElementById('avgWaitTimeDetailed');
        if (avgWaitTimeDetailed) {
            avgWaitTimeDetailed.textContent = `${avgWaitTime} menit`;
        }
        
        // Create hourly chart
        const hourlyChartCanvas = document.getElementById('hourlyChart');
        if (hourlyChartCanvas) {
            hourlyChart = new Chart(hourlyChartCanvas, {
                type: 'bar',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${i < 10 ? '0' + i : i}:00`),
                    datasets: [{
                        label: 'Jumlah Antrian',
                        data: hourlyData,
                        backgroundColor: 'rgba(67, 97, 238, 0.7)',
                        borderColor: 'rgba(67, 97, 238, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 4,
                            displayColors: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(229, 231, 235, 0.5)'
                            }
                        }
                    }
                }
            });
        }
        
        // Create daily chart
        const dailyChartCanvas = document.getElementById('dailyChart');
        if (dailyChartCanvas) {
            dailyChart = new Chart(dailyChartCanvas, {
                type: 'line',
                data: {
                    labels: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
                    datasets: [{
                        label: 'Jumlah Antrian',
                        data: dailyData,
                        backgroundColor: 'rgba(76, 201, 240, 0.2)',
                        borderColor: 'rgba(76, 201, 240, 1)',
                        pointBackgroundColor: 'rgba(76, 201, 240, 1)',
                        pointBorderColor: '#fff',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#374151',
                            bodyColor: '#6b7280',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 4,
                            displayColors: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(229, 231, 235, 0.5)'
                            }
                        }
                    },
                    elements: {
                        point: {
                            radius: 4,
                            hitRadius: 10,
                            hoverRadius: 6
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error loading analytics:", error);
    }
}

// Handle reset analytics button
function resetAnalyticsHandler() {
    const resetButton = document.getElementById('resetAnalytics');
    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            if (confirm('Apakah Anda yakin ingin menghapus semua data analisis? Tindakan ini tidak dapat dibatalkan.')) {
                try {
                    // Show loading state on button
                    resetButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mereset...';
                    resetButton.disabled = true;
                    
                    const analyticsRef = ref(database, 'analytics');
                    await remove(analyticsRef);
                    
                    // Reset counters
                    document.getElementById('todayTotal').textContent = '0';
                    document.getElementById('weekTotal').textContent = '0';
                    document.getElementById('avgWaitTime').textContent = '0 min';
                    document.getElementById('peakHour').textContent = '--:--';
                    
                    // Reset detailed metrics if they exist
                    const avgWaitTimeDetailed = document.getElementById('avgWaitTimeDetailed');
                    if (avgWaitTimeDetailed) {
                        avgWaitTimeDetailed.textContent = '0 menit';
                    }
                    
                    // Reload charts
                    await loadAnalytics();
                    
                    alert('Data analisis berhasil direset');
                } catch (error) {
                    console.error("Error resetting analytics:", error);
                    alert('Gagal mereset data analisis');
                } finally {
                    // Reset button state
                    resetButton.innerHTML = '<i class="fas fa-trash-alt"></i> Reset Data';
                    resetButton.disabled = false;
                }
            }
        });
    }
}
