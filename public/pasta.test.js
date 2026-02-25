// pasta.test.js
// Jest test scaffolding for pasta.js

jest.mock('./leaflet-map-view', () => ({
  renderMapData: jest.fn(),
  initMap: jest.fn(),
  enableMapDrawing: jest.fn()
}));

jest.mock('./geojson-to-xml', () => ({
  geojsonToMapFilterXML: jest.fn()
}));

jest.mock('./eml-xml-to-geojson', () => jest.fn());

const { fetchDataPackageIdentifiers, setBrandingText, bindFilterEvents, buildHtml, renderFacetDropdown } = require('./pasta');

describe('fetchDataPackageIdentifiers', () => {
  it('should fetch identifiers for a valid scope', async () => {
    // Mock fetch to return a valid XML response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?><resultset><packageid>cos-spu.10.1</packageid><packageid>cos-spu.12.1</packageid></resultset>`
    });
    const result = await fetchDataPackageIdentifiers('cos-spu');
    expect(result).toEqual(['cos-spu.10.1', 'cos-spu.12.1']);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should reject if fetch throws an error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow('Network error');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should return an empty array if no packageid elements are present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?><resultset></resultset>`
    });
    const result = await fetchDataPackageIdentifiers('cos-spu');
    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should throw an error if response XML is malformed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `<resultset><packageid>cos-spu.10.1<packageid>cos-spu.12.1</resultset>` // missing closing tag for first packageid
    });
    await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow('Malformed XML response');
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('UI/Event Logic', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="active-filters"></div>
      <div id="creator-dropdown"></div>
      <div id="keyword-dropdown"></div>
      <div id="project-dropdown"></div>
      <div id="location-dropdown"></div>
      <div id="taxonRankValue-dropdown"></div>
      <div id="commonName-dropdown"></div>
      <div id="creator-block"></div>
      <div id="keyword-block"></div>
      <div id="project-block"></div>
      <div id="location-block"></div>
      <div id="taxon-block"></div>
      <div id="commonName-block"></div>
      <div id="searchResults"></div>
      <div id="resultCount"></div>
      <span id="branding-text"></span>
      <span id="clear-all-filters"></span>
      <input type="checkbox" class="creator-checkbox" value="Alice" checked />
      <input type="checkbox" class="keyword-checkbox" value="water" checked />
      <input type="checkbox" class="project-checkbox" value="project" checked />
      <input type="checkbox" class="location-checkbox" value="Seattle" checked />
      <input type="checkbox" class="taxon-checkbox" value="Salmo" checked />
      <input type="checkbox" class="commonname-checkbox" value="Salmon" checked />
    `;
    global.showResultCount = jest.fn();
    global.showPageLinks = jest.fn();
    global.renderResults = jest.fn();
  });

  afterEach(() => {
    delete global.showResultCount;
    delete global.showPageLinks;
    delete global.renderResults;
  });

  it('sets the branding text in the DOM', () => {
    setBrandingText();
    const heading = document.querySelector('#branding-text h1');
    expect(heading).not.toBeNull();
    expect(heading.textContent).toBe('Seattle Public Utilities Data Catalog');
  });

  it('clears all filters when clear-all-filters is clicked', () => {
    bindFilterEvents();
    document.getElementById('clear-all-filters').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(box => expect(box.checked).toBe(false));
  });
});

describe('HTML escaping', () => {
  it('escapes metadata content in buildHtml', () => {
    window.relatedStories = [];
    const citations = {
      0: {
        pid: 'pkg.1.1',
        title: '<script>alert(1)</script>',
        authors: 'Evil & Co',
        pub_year: '2020',
        doi: ''
      }
    };
    const html = buildHtml(citations, ['An <b>abstract</b> & more']);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Evil &amp; Co');
    expect(html).toContain('An &lt;b&gt;abstract&lt;/b&gt; &amp; more');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escapes facet values in renderFacetDropdown', () => {
    const items = ['<b>bad</b>'];
    const counts = {};
    counts['<b>bad</b>'] = 2;
    const html = renderFacetDropdown(items, [], counts, 'keyword-checkbox', '', 'keyword-dropdown');
    expect(html).toContain('&lt;b&gt;bad&lt;/b&gt;');
    expect(html).toContain('value="&lt;b&gt;bad&lt;/b&gt;"');
  });
});

describe('Catalog initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="banner-bar"></div>
      <div id="loading-div"></div>
      <div id="searchResults"></div>
      <div id="resultCount"></div>
      <span id="branding-text"></span>
      <div id="active-filters"></div>
      <div id="creator-dropdown"></div>
      <div id="keyword-dropdown"></div>
      <div id="project-dropdown"></div>
      <div id="location-dropdown"></div>
      <div id="taxonRankValue-dropdown"></div>
      <div id="commonName-dropdown"></div>
      <div id="creator-block"></div>
      <div id="keyword-block"></div>
      <div id="project-block"></div>
      <div id="location-block"></div>
      <div id="taxon-block"></div>
      <div id="commonName-block"></div>
    `;
    global.showResultCount = jest.fn();
    global.renderResults = jest.fn();
    global.fetch = jest.fn((url) => {
      if (url === 'related_content.csv') {
        return Promise.resolve({
          ok: true,
          text: async () => 'package_id,story\ncos-spu.1,Story\n'
        });
      }
      if (String(url).includes('package/search/eml')) {
        return Promise.resolve({
          ok: true,
          text: async () => `<?xml version="1.0"?><resultset><packageid>cos-spu.1.1</packageid></resultset>`
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => `<?xml version="1.0"?><resultset></resultset>`
      });
    });
  });

  afterEach(() => {
    delete global.fetch;
    delete global.showResultCount;
    delete global.renderResults;
  });

  it('fetches related stories once on DOMContentLoaded', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    const relatedFetches = global.fetch.mock.calls.filter(([url]) => url === 'related_content.csv');
    expect(relatedFetches).toHaveLength(1);
  });
});
