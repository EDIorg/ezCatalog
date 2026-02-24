const { geojsonToMapFilterXML } = require('./geojson-to-xml');

describe('geojsonToMapFilterXML', () => {
  it('returns empty mapFilter when features are missing', () => {
    expect(geojsonToMapFilterXML(null)).toBe('<mapFilter></mapFilter>');
    expect(geojsonToMapFilterXML({})).toBe('<mapFilter></mapFilter>');
  });

  it('escapes geographic descriptions in XML output', () => {
    const geojson = {
      features: [
        { properties: { description: 'Lake & River <Area> "North"' } }
      ]
    };
    const xml = geojsonToMapFilterXML(geojson);
    expect(xml).toBe('<mapFilter><geographicDescription>Lake &amp; River &lt;Area&gt; &quot;North&quot;</geographicDescription></mapFilter>');
  });

  it('omits features without descriptions', () => {
    const geojson = {
      features: [
        { properties: {} },
        { properties: { description: '' } }
      ]
    };
    expect(geojsonToMapFilterXML(geojson)).toBe('<mapFilter></mapFilter>');
  });
});
