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
//    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//        attribution: '&copy; OpenStreetMap contributors'
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a> contributors'
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
                    color: '#006699', // strong blue border
                    weight: 3,
                    fillColor: '#66b3e6', // light blue fill
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
    if (!window.L || !map) return;
    if (!window.L.Control.Draw) {
        return;
    }
    // Remove existing draw controls if present
    if (map._drawControl) {
        map.removeControl(map._drawControl);
        map._drawControl = null;
    }
    // Remove existing drawnItems layer if present
    if (map._drawnItems) {
        map.removeLayer(map._drawnItems);
        map._drawnItems = null;
    }
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    map._drawnItems = drawnItems;

    // Updated draw control configuration to disable specific buttons
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            edit: false, // Disable "Edit layers"
            remove: false // Disable "Delete layers"
        },
        draw: {
            polygon: false, // Disable "Draw a polygon"
            circlemarker: false, // Disable "Draw a circlemarker"
            rectangle: true, // Keep "Draw a rectangle" enabled
            marker: false,
            circle: false,
            polyline: false
        }
    });
    map.addControl(drawControl);
    map._drawControl = drawControl;

    // When a shape is drawn, call the callback
    map.on('draw:created', function(e) {
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
