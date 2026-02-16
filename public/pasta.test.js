// pasta.test.js
// Jest test scaffolding for pasta.js

const { fetchDataPackageIdentifiers } = require('./pasta');

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
    await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalled();
  });
});

// UI/Event logic test scaffolding
// Use jsdom to simulate DOM for event handler tests

describe('UI/Event Logic', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="clear-all-filters"></button>
      <span id="branding-text"></span>
    `;
  });

  it('should set branding text when called directly', () => {
    require('./pasta');
    const { setBrandingText } = require('./pasta');
    setBrandingText();
    expect(document.getElementById('branding-text').textContent).toBe('Seattle Public Utilities Data Catalog');
  });

  // Add more tests for event handlers and DOM updates as needed
});

describe('UI: setBrandingText', () => {
  beforeEach(() => {
    document.body.innerHTML = `<span id="branding-text"></span>`;
  });
  it('sets the branding text in the DOM', () => {
    const { setBrandingText } = require('./pasta');
    setBrandingText();
    expect(document.getElementById('branding-text').textContent).toBe('Seattle Public Utilities Data Catalog');
  });
});

// Instructions:
// - Mock network requests for fetchDataPackageIdentifiers.
// - Expand UI tests to cover event handlers and DOM updates.
// - Use Jest and jsdom for DOM-related tests.
