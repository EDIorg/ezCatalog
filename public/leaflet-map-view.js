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
    // Debug: log geojson to verify features
    console.log('GeoJSON passed to map:', geojson);
    // Remove previous layer
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }
    // Add new GeoJSON layer with custom styling
    geoJsonLayer = L.geoJSON(geojson, {
        pointToLayer: function(feature, latlng) {
            console.log('Rendering point feature:', feature);
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
                    color: '#27ae60',
                    weight: 2,
                    fillColor: '#2ecc71',
                    fillOpacity: 0.2
                };
            }
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.description) {
                layer.bindPopup(feature.properties.description);
            }
        }
    }).addTo(map);
    // Fit map to data
    try {
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { maxZoom: 14 });
        }
    } catch (e) {
        // If no valid bounds, reset view
        map.setView([0, 0], 2);
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initMap, renderMapData };
} else if (typeof window !== 'undefined') {
    window.initMap = initMap;
    window.renderMapData = renderMapData;
}
