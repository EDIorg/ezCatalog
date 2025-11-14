// Leaflet Map View Component
// Requires Leaflet.js and Leaflet.css to be loaded in the page

let map = null;
let geoJsonLayer = null;

/**
 * Initialize the Leaflet map in the given container.
 * @param {string} containerId - The DOM element ID to render the map into.
 */
function initMap(containerId) {
    if (map) return; // Prevent re-initialization
    map = L.map(containerId).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

/**
 * Render GeoJSON data on the map, clearing previous data and fitting bounds.
 * @param {object} geojson - A valid GeoJSON FeatureCollection
 */
function renderMapData(geojson) {
    if (!map) return;
    // Remove previous layer
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }
    geoJsonLayer = L.geoJSON(geojson, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                color: '#2980b9',
                fillColor: '#2980b9',
                fillOpacity: 0.8,
                weight: 2
            });
        },
        style: function(feature) {
            if (feature.geometry.type === 'Polygon') {
                return {
                    color: '#e67e22',
                    weight: 3,
                    fillColor: '#f1c40f',
                    fillOpacity: 0.4
                };
            }
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.description) {
                layer.bindPopup(feature.properties.description);
            }
            // Removed click event for selection; only drawing triggers selection
        }
    }).addTo(map);
    try {
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { maxZoom: 14 });
        } else {
            map.setView([0, 0], 2);
        }
    } catch (e) {
        map.setView([0, 0], 2);
    }
}

// Add Leaflet.draw plugin and event listener for drawing features
function enableMapDrawing(map, onDrawCallback) {
    console.log('enableMapDrawing called');
    if (!window.L || !map) return;
    if (!window.L.Control.Draw) {
        console.error('Leaflet.draw plugin not loaded');
        return;
    }
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: { polygon: true, rectangle: true, marker: false, circle: false, polyline: false }
    });
    map.addControl(drawControl);
    // When a shape is drawn, call the callback
    map.on('draw:created', function(e) {
        console.log('Leaflet draw:created event triggered');
        drawnItems.clearLayers(); // Only one filter at a time
        drawnItems.addLayer(e.layer);
        if (onDrawCallback) {
            onDrawCallback(e.layer.toGeoJSON());
        }
    });
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initMap, renderMapData, enableMapDrawing };
} else if (typeof window !== 'undefined') {
    window.initMap = initMap;
    window.renderMapData = renderMapData;
    window.enableMapDrawing = enableMapDrawing;
}
