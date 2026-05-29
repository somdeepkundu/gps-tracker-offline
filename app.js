const VERSION = '0.2.1';

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
let map = null;
let locationMarker = null;
let accuracyCircle = null;
let trackLine = null;
let mapReady = false;
let userConsent = false;

// Device Sensors
let currentHeading = 0;
let compassMarker = null;

// Sampling
let samplingFrequency = 1; // points per minute
let lastSavedTime = 0; // timestamp of last saved point

// Elements
const statusEl = document.getElementById('status');
const accuracyEl = document.getElementById('accuracy');
const headingEl = document.getElementById('heading');
const versionBadge = document.getElementById('versionBadge');
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
const samplingSelect = document.getElementById('samplingSelect');

const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistory');
const historyList = document.getElementById('historyList');

const privacyModal = document.getElementById('privacyModal');
const acceptConsentBtn = document.getElementById('acceptConsent');
const declineConsentBtn = document.getElementById('declineConsent');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - Initializing GPS Tracker');

    await initDB();
    registerServiceWorker();
    setupEventListeners();

    // Check for existing consent
    if (!checkExistingConsent()) {
        // Show privacy consent modal
        if (privacyModal) {
            privacyModal.classList.add('active');
            console.log('Privacy modal shown');
        } else {
            console.error('Privacy modal element not found!');
        }
    }

    initMap();
    initDeviceSensors();
    checkOnlineStatus();

    // Display version
    if (versionBadge) {
        versionBadge.textContent = `v${VERSION}`;
    }

    console.log(`GPS Tracker v${VERSION} ready`);

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

// Device Sensors Initialization
function initDeviceSensors() {
    // Device Orientation (Compass Heading)
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (event) => {
            // event.alpha: rotation around Z axis (0-360) - HEADING
            // event.beta: rotation around X axis (-180 to 180)
            // event.gamma: rotation around Y axis (-90 to 90)

            currentHeading = Math.round(event.alpha) || 0;

            // Update heading display
            headingEl.textContent = `🧭 ${currentHeading}° ${getDirectionName(currentHeading)}`;

            // Update compass on map in real-time
            updateCompassMarker();

            console.log(`Heading: ${currentHeading}°`);
        });
    }

    // Accelerometer (Motion)
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', (event) => {
            // event.acceleration.x, y, z
            // event.accelerationIncludingGravity.x, y, z
            // event.rotationRate.alpha, beta, gamma
            // Useful for detecting movement patterns
        });
    }

    console.log('Device sensors initialized');
}

// Update compass marker rotation in real-time
function updateCompassMarker() {
    if (!map || !mapReady || !compassMarker) return;

    // Update the compass marker icon rotation
    const compassElement = document.querySelector('.compass-marker');
    if (compassElement) {
        compassElement.style.transform = `rotate(${currentHeading}deg)`;
    }

    // Update popup
    compassMarker.setPopupContent(`Heading: ${currentHeading}°<br/>Direction: ${getDirectionName(currentHeading)}`);
}

// Get compass direction name (N, NE, E, SE, etc.)
function getDirectionName(heading) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(heading / 22.5) % 16;
    return directions[index];
}

// Map Initialization
function initMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        // Default to Mumbai coordinates
        map = L.map('map').setView([19.0760, 72.8777], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 3
        }).addTo(map);

        mapReady = true;
        mapStatusEl.textContent = '';
        mapStatusEl.parentElement.classList.remove('active');
        console.log('Map initialized');
    } catch (error) {
        console.error('Map initialization failed:', error);
        mapStatusEl.textContent = 'Map unavailable - offline mode';
    }
}

function updateMapMarker(lat, lon, accuracy) {
    if (!map || !mapReady) return;

    // Remove old marker and accuracy circle
    if (locationMarker) map.removeLayer(locationMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    if (compassMarker) map.removeLayer(compassMarker);

    // Create heading arrow (compass)
    const headingIcon = L.divIcon({
        html: `<div style="
            width: 30px;
            height: 30px;
            background: #4caf50;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 12px;
            transform: rotate(${currentHeading}deg);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">↑</div>`,
        iconSize: [30, 30],
        className: 'compass-marker'
    });

    // Add compass marker with heading
    compassMarker = L.marker([lat, lon], { icon: headingIcon }).addTo(map);
    compassMarker.bindPopup(`Heading: ${currentHeading}°`);

    // Add accuracy circle
    accuracyCircle = L.circle([lat, lon], {
        radius: accuracy,
        color: '#1976d2',
        fillColor: '#1976d2',
        weight: 1,
        opacity: 0.2,
        fillOpacity: 0.1
    }).addTo(map);

    // Center map on marker
    map.panTo([lat, lon]);
}

function addTrackPoint(lat, lon) {
    if (!map || !mapReady) return;

    if (!trackLine) {
        trackLine = L.polyline([], {
            color: '#4caf50',
            weight: 3,
            opacity: 0.7
        }).addTo(map);
    }

    trackLine.addLatLng([lat, lon]);
}

// Consent Management
function checkExistingConsent() {
    const consent = localStorage.getItem('gps-tracker-consent');
    if (consent === 'accepted') {
        userConsent = true;
        privacyModal.classList.remove('active');
        return true;
    }
    return false;
}

function handleConsent(accepted) {
    console.log('Handling consent:', accepted);
    userConsent = accepted;

    try {
        if (accepted) {
            localStorage.setItem('gps-tracker-consent', 'accepted');
            console.log('Consent accepted');
        } else {
            localStorage.setItem('gps-tracker-consent', 'declined');
            console.log('Consent declined');
            startBtn.disabled = true;
            startBtn.textContent = 'View Only Mode';
            clearBtn.disabled = true;
        }

        // Hide modal
        if (privacyModal) {
            privacyModal.classList.remove('active');
            console.log('Modal hidden');
        }
    } catch (error) {
        console.error('Error in handleConsent:', error);
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

    // Sampling frequency selector
    samplingSelect.addEventListener('change', (e) => {
        samplingFrequency = parseInt(e.target.value);
        console.log(`Sampling frequency changed to: ${samplingFrequency} points/min`);
    });

    // Consent buttons
    if (acceptConsentBtn) {
        acceptConsentBtn.addEventListener('click', () => {
            console.log('Accept clicked');
            handleConsent(true);
        });
    } else {
        console.error('acceptConsentBtn not found');
    }

    if (declineConsentBtn) {
        declineConsentBtn.addEventListener('click', () => {
            console.log('Decline clicked');
            handleConsent(false);
        });
    } else {
        console.error('declineConsentBtn not found');
    }
}

// GPS Tracking
function startTracking() {
    // Check consent
    if (!userConsent) {
        alert('You must accept the privacy terms to enable GPS tracking.');
        privacyModal.classList.add('active');
        return;
    }

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    tracking = true;
    currentTrackId = Date.now();
    trackStartTime = Date.now();
    totalDistance = 0;
    lastLocation = null;
    lastSavedTime = Date.now();

    // Disable sampling control while tracking
    samplingSelect.disabled = true;

    console.log(`Tracking started - Sampling: ${samplingFrequency} points/min`);

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
    samplingSelect.disabled = false;
    mapStatusEl.textContent = 'Tracking stopped';

    setTimeout(() => {
        if (!tracking) mapStatusEl.textContent = '';
    }, 2000);
}

function onLocationSuccess(position) {
    const { latitude, longitude, altitude, accuracy } = position.coords;
    const { speed, heading } = position.coords;

    // Update UI
    latEl.textContent = latitude.toFixed(6);
    lonEl.textContent = longitude.toFixed(6);
    altEl.textContent = altitude ? altitude.toFixed(2) + ' m' : '--';
    speedEl.textContent = speed ? (speed * 3.6).toFixed(2) + ' km/h' : '0 km/h';

    // Show accuracy only if poor (> 20m)
    if (accuracy > 20) {
        accuracyEl.textContent = `Accuracy: ±${accuracy.toFixed(0)}m`;
    } else {
        accuracyEl.textContent = '✓ Good signal';
    }

    // Update map
    updateMapMarker(latitude, longitude, accuracy);

    // Calculate distance with drift filter
    if (lastLocation && tracking) {
        const distance = calculateDistance(lastLocation, { latitude, longitude });

        // Only count movement if greater than accuracy radius (GPS drift threshold)
        if (distance > accuracy) {
            totalDistance += distance;
            addTrackPoint(latitude, longitude);
        }

        distanceEl.textContent = (totalDistance / 1000).toFixed(2) + ' km';
    }

    lastLocation = { latitude, longitude };

    // Store in DB with sampling frequency control
    if (tracking) {
        const now = Date.now();
        const timeSinceLastPoint = (now - lastSavedTime) / 1000; // seconds
        const minIntervalMs = samplingFrequency > 0 ? (60 / samplingFrequency) * 1000 : 0; // ms

        // Check if enough time has passed to save this point
        if (samplingFrequency === 0 || timeSinceLastPoint >= (minIntervalMs / 1000)) {
            storeLocation({
                trackId: currentTrackId,
                latitude,
                longitude,
                altitude,
                accuracy,
                speed: speed || 0,
                heading: heading || currentHeading || 0,
                deviceHeading: currentHeading || 0,
                timestamp: now
            });

            lastSavedTime = now;
            console.log(`Point saved (${samplingFrequency} pts/min)`);

            // Update point count
            updatePointCount();
        }
    }
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
        lastLocation = null;

        // Clear map track
        if (trackLine && map) {
            map.removeLayer(trackLine);
            trackLine = null;
        }

        mapStatusEl.textContent = 'History cleared';
        setTimeout(() => {
            mapStatusEl.textContent = '';
        }, 2000);
    }
}

async function exportData() {
    const locations = await getAllLocations();

    if (locations.length === 0) {
        alert('No tracking data to export');
        return;
    }

    // Export as GeoJSON (compatible with MapShaper, QGIS, etc.)
    const coordinates = locations.map(loc => [loc.longitude, loc.latitude]);

    const geoJSON = {
        type: 'FeatureCollection',
        features: [
            // Track as LineString
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {
                    name: 'GPS Track',
                    totalPoints: locations.length,
                    totalDistance: `${(totalDistance / 1000).toFixed(2)} km`,
                    exportDate: new Date().toISOString()
                }
            },
            // Individual points as separate features
            ...locations.map((loc, idx) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [loc.longitude, loc.latitude]
                },
                properties: {
                    index: idx + 1,
                    altitude: loc.altitude,
                    accuracy: loc.accuracy,
                    speed: `${(loc.speed * 3.6).toFixed(2)} km/h`,
                    heading: `${loc.heading}°`,
                    timestamp: new Date(loc.timestamp).toISOString()
                }
            }))
        ]
    };

    const json = JSON.stringify(geoJSON, null, 2);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gps-track-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('GeoJSON exported successfully');
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
