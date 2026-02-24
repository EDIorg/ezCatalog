const emlXmlToGeoJSON = require('./eml-xml-to-geojson');

describe('emlXmlToGeoJSON', () => {
  it('returns empty FeatureCollection when no documents exist', () => {
    const xmlDoc = new DOMParser().parseFromString('<resultset></resultset>', 'text/xml');
    const result = emlXmlToGeoJSON(xmlDoc);
    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('creates point and polygon features from bounding coordinates', () => {
    const xml = `
      <resultset>
        <document>
          <geographicCoverage>
            <geographicDescription>Point</geographicDescription>
            <boundingCoordinates>
              <westBoundingCoordinate>-120</westBoundingCoordinate>
              <eastBoundingCoordinate>-120</eastBoundingCoordinate>
              <northBoundingCoordinate>45</northBoundingCoordinate>
              <southBoundingCoordinate>45</southBoundingCoordinate>
            </boundingCoordinates>
          </geographicCoverage>
        </document>
        <document>
          <geographicCoverage>
            <geographicDescription>Box</geographicDescription>
            <boundingCoordinates>
              <westBoundingCoordinate>-120</westBoundingCoordinate>
              <eastBoundingCoordinate>-118</eastBoundingCoordinate>
              <northBoundingCoordinate>47</northBoundingCoordinate>
              <southBoundingCoordinate>45</southBoundingCoordinate>
            </boundingCoordinates>
          </geographicCoverage>
        </document>
      </resultset>
    `;
    const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
    const result = emlXmlToGeoJSON(xmlDoc);

    expect(result.features).toHaveLength(2);
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [-120, 45] });
    expect(result.features[1].geometry.type).toBe('Polygon');
    expect(result.features[1].geometry.coordinates[0][0]).toEqual([-120, 47]);
    expect(result.features[1].geometry.coordinates[0][4]).toEqual([-120, 47]);
  });

  it('skips geographic coverage with missing coordinates', () => {
    const xml = `
      <resultset>
        <document>
          <geographicCoverage>
            <geographicDescription>Missing</geographicDescription>
          </geographicCoverage>
        </document>
      </resultset>
    `;
    const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
    const result = emlXmlToGeoJSON(xmlDoc);
    expect(result.features).toHaveLength(0);
  });
});
