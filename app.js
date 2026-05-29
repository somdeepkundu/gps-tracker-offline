const VERSION = '0.1.0';

// DB Setup
const DB_NAME = 'GPSTrackerDB';
const STORE_NAME = 'locations';
let db;

// State
let tracking = false;
let watchId = null;
let currentTrackId = null;
let trackStartTime = null;
let lastLocation = null;
let totalDistance = 0;

// Elements
const statusEl = document.getElementById('status');
const accuracyEl = document.getElementById('accuracy');
const latEl = document.getElementById('latitude');
const lonEl = document.getElementById('longitude');
const altEl = document.getElementById('altitude');
const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const pointCountEl = document.getElementById('pointCount');
const durationEl = document.getElementById('duration');
const mapStatusEl = document.getElementById('map-status');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const historyBtn = document.getElementById('historyBtn');

const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistory');
const historyList = document.getElementById('historyList');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    registerServiceWorker();
    setupEventListeners();
    checkOnlineStatus();

    window.addEventListener('online', () => {
        updateStatus(true);
    });

    window.addEventListener('offline', () => {
        updateStatus(false);
    });
});

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized');
            resolve();
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('trackId', 'trackId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Register Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// Event Listeners
function setupEventListeners() {
    startBtn.addEventListener('click', startTracking);
    stopBtn.addEventListener('click', stopTracking);
    clearBtn.addEventListener('click', clearHistory);
    exportBtn.addEventListener('click', exportData);
    historyBtn.addEventListener('click', showHistory);
    closeHistoryBtn.addEventListener('click', closeHistory);
}

// GPS Tracking
function startTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    tracking = true;
    currentTrackId = Date.now();
    trackStartTime = Date.now();
    totalDistance = 0;
    lastLocation = null;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    clearBtn.disabled = true;

    mapStatusEl.textContent = 'Tracking...';

    // High accuracy tracking
    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    };

    watchId = navigator.geolocation.watchPosition(
        onLocationSuccess,
        onLocationError,
        options
    );

    // Update duration every second
    setInterval(() => {
        if (tracking) {
            const duration = Math.floor((Date.now() - trackStartTime) / 1000);
            durationEl.textContent = formatDuration(duration);
        }
    }, 1000);
}

function stopTracking() {
    tracking = false;

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    clearBtn.disabled = false;
    mapStatusEl.textContent = 'Tracking stopped';
}

function onLocationSuccess(position) {
    const { latitude, longitude, altitude, accuracy } = position.coords;
    const { speed, heading } = position.coords;

    // Update UI
    latEl.textContent = latitude.toFixed(6);
    lonEl.textContent = longitude.toFixed(6);
    altEl.textContent = altitude ? altitude.toFixed(2) + ' m' : '--';
    speedEl.textContent = speed ? (speed * 3.6).toFixed(2) + ' km/h' : '0 km/h';
    accuracyEl.textContent = `±${accuracy.toFixed(0)}m`;

    // Calculate distance
    if (lastLocation && tracking) {
        const distance = calculateDistance(lastLocation, { latitude, longitude });
        totalDistance += distance;
        distanceEl.textContent = (totalDistance / 1000).toFixed(2) + ' km';
    }

    lastLocation = { latitude, longitude };

    // Store in DB
    if (tracking) {
        storeLocation({
            trackId: currentTrackId,
            latitude,
            longitude,
            altitude,
            accuracy,
            speed: speed || 0,
            heading: heading || 0,
            timestamp: Date.now()
        });
    }

    // Update point count
    updatePointCount();
}

function onLocationError(error) {
    let message = 'Unknown error';

    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Permission denied. Please enable location access.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable. Please try again.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
    }

    mapStatusEl.textContent = message;
    console.error('Geolocation error:', message);
}

// Haversine formula for distance calculation
function calculateDistance(loc1, loc2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (loc1.latitude * Math.PI) / 180;
    const φ2 = (loc2.latitude * Math.PI) / 180;
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// IndexedDB Operations
function storeLocation(location) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(location);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getLocations(trackId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('trackId');
        const request = index.getAll(trackId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllLocations() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function clearLocations() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function updatePointCount() {
    const locations = await getLocations(currentTrackId);
    pointCountEl.textContent = locations.length;
}

// UI Actions
async function clearHistory() {
    if (confirm('Clear all tracking history? This cannot be undone.')) {
        await clearLocations();
        pointCountEl.textContent = '0';
        distanceEl.textContent = '0 km';
        durationEl.textContent = '0s';
        totalDistance = 0;
        mapStatusEl.textContent = 'History cleared';
    }
}

async function exportData() {
    const locations = await getAllLocations();

    const data = {
        version: VERSION,
        exportDate: new Date().toISOString(),
        totalPoints: locations.length,
        locations: locations.map(loc => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            altitude: loc.altitude,
            accuracy: loc.accuracy,
            speed: loc.speed,
            heading: loc.heading,
            timestamp: new Date(loc.timestamp).toISOString()
        }))
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gps-track-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function showHistory() {
    const locations = await getAllLocations();

    if (locations.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #757575;">No tracking data yet</p>';
    } else {
        const grouped = {};
        locations.forEach(loc => {
            const trackId = loc.trackId;
            if (!grouped[trackId]) {
                grouped[trackId] = [];
            }
            grouped[trackId].push(loc);
        });

        historyList.innerHTML = Object.entries(grouped).map(([trackId, locs]) => {
            const startTime = new Date(locs[0].timestamp).toLocaleString();
            const endTime = new Date(locs[locs.length - 1].timestamp).toLocaleString();
            const duration = formatDuration(Math.floor((locs[locs.length - 1].timestamp - locs[0].timestamp) / 1000));

            return `
                <div class="history-item">
                    <div class="history-item-title">Track ${new Date(locs[0].timestamp).toLocaleDateString()}</div>
                    <div class="history-item-details">
                        <div>Start: ${startTime}</div>
                        <div>End: ${endTime}</div>
                        <div>Points: ${locs.length}</div>
                        <div>Duration: ${duration}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    historyModal.classList.add('active');
}

function closeHistory() {
    historyModal.classList.remove('active');
}

// Utilities
function checkOnlineStatus() {
    updateStatus(navigator.onLine);
}

function updateStatus(isOnline) {
    if (isOnline) {
        statusEl.textContent = 'Online';
        statusEl.className = 'status online';
    } else {
        statusEl.textContent = 'Offline';
        statusEl.className = 'status offline';
    }
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
        return `${mins}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

console.log(`GPS Tracker v${VERSION} initialized`);
