# GPS Tracker - Offline PWA

A Progressive Web App for offline GPS tracking with real-time location monitoring, responsive design, and local data storage.

## Features

✨ **Offline-First Architecture**
- Works completely offline using Service Workers
- IndexedDB for persistent local storage
- Network-first fetch strategy with cache fallback

📍 **GPS Tracking**
- Real-time location updates with high accuracy
- Distance calculation using Haversine formula
- Speed and heading tracking
- Location accuracy indicator

📊 **Data Management**
- Automatic location history storage
- Export tracking data as JSON
- View complete tracking history
- Clear history when needed

📱 **Responsive Design**
- Adaptive layout for all screen sizes
- Landscape/portrait orientation support
- Touch-friendly interface
- Mobile-optimized controls

🔧 **Technical Stack**
- Vanilla JavaScript (no dependencies)
- Geolocation API
- IndexedDB
- Service Workers
- CSS Grid & Flexbox

## Getting Started

### Requirements
- Modern browser with:
  - Geolocation API support
  - IndexedDB support
  - Service Workers support
  - HTTPS (required for Geolocation on production)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/somdeepkundu/gps-tracker-offline.git
cd gps-tracker-offline
```

2. Install locally (for development):
```bash
# Simple HTTP server for testing
python -m http.server 8000
# or with Python 3:
python3 -m http.server 8000
```

3. Open in browser:
```
http://localhost:8000
```

### Install as PWA

1. Open the app in your browser
2. Click the "Install" button (appears in address bar on supported browsers)
3. Or use the browser menu: Menu → "Install GPS Tracker"
4. The app will be installed on your home screen

## Usage

### Starting a Track

1. Click **"Start Tracking"** button
2. Allow location access when prompted
3. The app will begin recording GPS coordinates
4. Real-time statistics update as you move

### Monitoring Location

The app displays:
- **Latitude/Longitude**: Current position
- **Altitude**: Height above sea level
- **Speed**: Current speed in km/h
- **Distance**: Total distance traveled
- **Accuracy**: GPS signal accuracy margin

### Stopping & Saving

1. Click **"Stop Tracking"** to pause recording
2. Data is automatically saved to IndexedDB
3. Click **"View History"** to see past tracks
4. Use **"Export as JSON"** to download data

### Data Export

Export tracking data in JSON format:
```json
{
  "version": "0.1.0",
  "exportDate": "2026-05-30T12:00:00.000Z",
  "totalPoints": 150,
  "locations": [
    {
      "latitude": 19.0760,
      "longitude": 72.8777,
      "altitude": 10.5,
      "accuracy": 5.2,
      "speed": 5.5,
      "heading": 45.0,
      "timestamp": "2026-05-30T12:00:00.000Z"
    }
  ]
}
```

## Architecture

### Core Files

- **index.html** - Main UI structure
- **styles.css** - Responsive styling with mobile-first approach
- **app.js** - GPS tracking logic and data management
- **service-worker.js** - Offline support and caching
- **manifest.json** - PWA configuration

### Data Flow

```
GPS Coordinates (Geolocation API)
        ↓
   Calculate Distance
        ↓
   Store in IndexedDB
        ↓
   Update UI Display
        ↓
   Sync/Export (when online)
```

## API Usage

### Geolocation API
```javascript
navigator.geolocation.watchPosition(success, error, options)
```
- Enables high accuracy mode
- 5-second timeout
- Continuous position monitoring

### IndexedDB
```javascript
db.transaction([STORE_NAME], 'readwrite')
```
- Stores location data with timestamps
- Indexes by track ID and timestamp
- Persistent storage across sessions

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Geolocation | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Workers | ✅ | ✅ | ✅ (12.1+) | ✅ |
| PWA Install | ✅ | ❌ | ⚠️ (iOS 16.4+) | ✅ |

## Privacy & Security

- ✅ All data stored locally on your device
- ✅ No server communication required
- ✅ No cloud sync or tracking
- ✅ HTTPS enforced in production
- ✅ Geolocation permission required by browser

## Performance

- Lightweight: ~30KB (minified + gzipped)
- No external dependencies
- Optimized for mobile devices
- Low memory footprint
- Efficient distance calculations

## Troubleshooting

### GPS Not Working
1. Check location permissions in browser settings
2. Ensure HTTPS in production (required by spec)
3. Try opening developer console for error messages
4. Verify device has GPS hardware

### Data Not Saving
1. Check browser's IndexedDB storage limits
2. Verify browser allows local storage
3. Try clearing browser cache and reloading
4. Check for storage quota exceeded errors

### Offline Mode Issues
1. Service Worker must be registered (check console)
2. Page must be served over HTTPS
3. Clear cache and re-register service worker
4. Check Network tab in DevTools for cache hits

## Future Enhancements

- [ ] Map visualization using Leaflet or Mapbox
- [ ] Route playback and visualization
- [ ] Waypoint markers and annotations
- [ ] Import GPX/KML files
- [ ] Cloud sync (optional)
- [ ] Advanced analytics
- [ ] Multiple track management
- [ ] Mobile app wrapping (Capacitor)

## Development

### Local Development
```bash
python3 -m http.server 8000
```

### Testing in DevTools
1. Open DevTools (F12)
2. Go to Application tab
3. Check Service Workers status
4. View IndexedDB data
5. Monitor Network requests

### Building for Production
1. Minify CSS and JavaScript
2. Optimize images
3. Set up HTTPS
4. Configure cache headers
5. Test offline functionality

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues first
- Provide device/browser details
- Include console error messages

---

Made with ❤️ for offline location tracking
