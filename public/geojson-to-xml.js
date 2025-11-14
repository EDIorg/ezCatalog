// public/geojson-to-xml.js

/**
 * Convert GeoJSON features to XML map filter containing only geographic descriptions.
 * @param {object} geojson - GeoJSON FeatureCollection
 * @returns {string} - XML string with <mapFilter> and <geographicDescription> elements
 */
export function geojsonToMapFilterXML(geojson) {
    if (!geojson || !geojson.features) return '<mapFilter></mapFilter>';
    let xml = '<mapFilter>';
    geojson.features.forEach(feature => {
        const desc = feature.properties && feature.properties.description
            ? feature.properties.description
            : '';
        if (desc) {
            xml += `<geographicDescription>${escapeXml(desc)}</geographicDescription>`;
        }
    });
    xml += '</mapFilter>';
    return xml;
}

// Helper to escape XML special characters
function escapeXml(str) {
    return str.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}
