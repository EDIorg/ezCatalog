const { fetchDataPackageIdentifiers } = require('./pasta-utils');

// Sample Jest test

describe('Sample Test', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(1 + 2).toBe(3);
  });
});

describe('fetchDataPackageIdentifiers', () => {
    beforeAll(() => {
        global.fetch = jest.fn();
    });
    afterEach(() => {
        fetch.mockClear();
    });
    it('returns array of pids for valid scope', async () => {
        const xmlResponse = `<?xml version="1.0"?>
            <resultset>
                <document><packageid>cos-spu.12.1</packageid></document>
                <document><packageid>cos-spu.13.1</packageid></document>
            </resultset>`;
        fetch.mockResolvedValue({ ok: true, text: async () => xmlResponse });
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual(['cos-spu.12.1', 'cos-spu.13.1']);
    });
    it('returns empty array if docs missing', async () => {
        const xmlResponse = `<?xml version="1.0"?><resultset></resultset>`;
        fetch.mockResolvedValue({ ok: true, text: async () => xmlResponse });
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual([]);
    });
    it('throws error on fetch failure', async () => {
        fetch.mockResolvedValue({ ok: false, status: 500 });
        await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow('Failed to fetch data packages: 500');
    });
});

describe('fetchDataPackageIdentifiers (real request)', () => {
    it('fetches real pids from the PASTA endpoint', async () => {
        // Assign node-fetch to global.fetch for Node.js
        global.fetch = require('node-fetch');
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(Array.isArray(pids)).toBe(true);
        expect(pids.length).toBeGreaterThan(0);
        // Check that each pid is a non-empty string and matches expected format
        pids.forEach(pid => {
            expect(typeof pid).toBe('string');
            expect(pid).toMatch(/^cos-spu\.[0-9]+\.[0-9]+$/);
        });
    });
});
