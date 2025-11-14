// Converts a GeoJSON geometry (Polygon or Rectangle) to an XML fragment for map filtering
export function geojsonToMapFilterXML(geojson) {
    if (!geojson || !geojson.geometry) return '';
    const { geometry } = geojson;
    let xml = '<mapFilter>';
    if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
        // Find bounding box from polygon coordinates
        let lats = geometry.coordinates[0].map(c => c[1]);
        let lngs = geometry.coordinates[0].map(c => c[0]);
        const north = Math.max(...lats);
        const south = Math.min(...lats);
        const east = Math.max(...lngs);
        const west = Math.min(...lngs);
        xml += `<boundingCoordinates>`;
        xml += `<westBoundingCoordinate>${west}</westBoundingCoordinate>`;
        xml += `<eastBoundingCoordinate>${east}</eastBoundingCoordinate>`;
        xml += `<northBoundingCoordinate>${north}</northBoundingCoordinate>`;
        xml += `<southBoundingCoordinate>${south}</southBoundingCoordinate>`;
        xml += `</boundingCoordinates>`;
    }
    xml += '</mapFilter>';
    return xml;
}

