/**
 * EML XML to GeoJSON converter
 * @param {Document} xmlDoc - The shared, in-memory EML XML state object
 * @returns {object} GeoJSON FeatureCollection
 */
function emlXmlToGeoJSON(xmlDoc) {
    const features = [];
    const docs = xmlDoc.getElementsByTagName('document');
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const geoCovElems = doc.getElementsByTagName('geographicCoverage');
        for (let k = 0; k < geoCovElems.length; k++) {
            const geoCovElem = geoCovElems[k];
            // Extract description
            const descElem = geoCovElem.getElementsByTagName('geographicDescription')[0];
            const description = descElem ? descElem.textContent.trim() : '';
            // Extract bounding coordinates
            const boundsElem = geoCovElem.getElementsByTagName('boundingCoordinates')[0];
            let geometry = null;
            if (boundsElem) {
                const west = parseFloat(boundsElem.getElementsByTagName('westBoundingCoordinate')[0]?.textContent);
                const east = parseFloat(boundsElem.getElementsByTagName('eastBoundingCoordinate')[0]?.textContent);
                const north = parseFloat(boundsElem.getElementsByTagName('northBoundingCoordinate')[0]?.textContent);
                const south = parseFloat(boundsElem.getElementsByTagName('southBoundingCoordinate')[0]?.textContent);
                if (!isNaN(west) && !isNaN(east) && !isNaN(north) && !isNaN(south)) {
                    if (north === south && east === west) {
                        // Point
                        geometry = {
                            type: 'Point',
                            coordinates: [west, north]
                        };
                    } else {
                        // Polygon (bounding box)
                        geometry = {
                            type: 'Polygon',
                            coordinates: [[
                                [west, north],
                                [east, north],
                                [east, south],
                                [west, south],
                                [west, north]
                            ]]
                        };
                    }
                }
            }
            if (geometry) {
                features.push({
                    type: 'Feature',
                    properties: {
                        description,
                        docIndex: i
                    },
                    geometry
                });
            }
        }
    }
    return {
        type: 'FeatureCollection',
        features
    };
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = emlXmlToGeoJSON;
} else if (typeof window !== 'undefined') {
    window.emlXmlToGeoJSON = emlXmlToGeoJSON;
}
