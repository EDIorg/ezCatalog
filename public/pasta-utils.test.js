const { fetchDataPackageIdentifiers, buildRidarePayload, postToRidareEndpoint, getThumbnailUrl } = require('./pasta-utils');

const runRealRequests = process.env.RUN_REAL_REQUESTS === 'true';

// Helper for mock fetch responses
function mockFetchResponse(xml, ok = true, status = 200) {
    fetch.mockResolvedValue({ ok, status, text: async () => xml });
}

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
        mockFetchResponse(xmlResponse);
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual(['cos-spu.12.1', 'cos-spu.13.1']);
    });
    it('returns empty array if docs missing', async () => {
        const xmlResponse = `<?xml version="1.0"?><resultset></resultset>`;
        mockFetchResponse(xmlResponse);
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual([]);
    });
    it('throws error on fetch failure', async () => {
        mockFetchResponse('', false, 500);
        await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow('Failed to fetch data packages: 500');
    });
    it('appends apiKey parameter if passed as argument', async () => {
        const xmlResponse = `<?xml version="1.0"?><resultset></resultset>`;
        mockFetchResponse(xmlResponse);
        await fetchDataPackageIdentifiers('cos-spu', '&fq=scope:cos-spu', 'test-key-123');
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&key=test-key-123'));
    });
    it('appends apiKey parameter from global PASTA_CONFIG if defined', async () => {
        const xmlResponse = `<?xml version="1.0"?><resultset></resultset>`;
        mockFetchResponse(xmlResponse);
        global.PASTA_CONFIG = { apiKey: 'global-test-key' };
        await fetchDataPackageIdentifiers('cos-spu');
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('&key=global-test-key'));
        delete global.PASTA_CONFIG;
    });
});

const describeRealRequests = runRealRequests ? describe : describe.skip;

describeRealRequests('fetchDataPackageIdentifiers (real request)', () => {
    it('fetches real pids from the PASTA endpoint', async () => {
        global.fetch = require('node-fetch');
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(Array.isArray(pids)).toBe(true);
        expect(pids.length).toBeGreaterThan(0);
        pids.forEach(pid => {
            expect(typeof pid).toBe('string');
            expect(pid).toMatch(/^cos-spu\.[0-9]+\.[0-9]+$/);
        });
    });
});

describe('buildRidarePayload', () => {
    it('returns correct payload for multiple pids', () => {
        const pids = ['cos-spu.13.3', 'cos-spu.9.1'];
        const payload = buildRidarePayload(pids);
        expect(payload).toEqual({
            pid: ['cos-spu.13.3', 'cos-spu.9.1'],
            query: [
                { creators: "//creator" },
                { keywords: "//keywordSet/keyword" },
                "//creator/individualName",
                "//contact/individualName",
                "//associatedParty/individualName",
                { geographicCoverage: "//geographicCoverage" },
                { projectTitle: "//project/title" },
                { relatedProjectTitle: "//relatedProject" },
                "//dataset/abstract",
                "//taxonRankValue",
                "//commonName",
                "//dataset/title",
                "//dataset/pubDate"
            ]
        });
    });
    it('returns correct payload for single pid', () => {
        const pids = ['cos-spu.13.3'];
        const payload = buildRidarePayload(pids);
        expect(payload.pid).toEqual(['cos-spu.13.3']);
        expect(Array.isArray(payload.query)).toBe(true);
    });
    it('returns correct payload for empty pid array', () => {
        const pids = [];
        const payload = buildRidarePayload(pids);
        expect(payload.pid).toEqual([]);
        expect(Array.isArray(payload.query)).toBe(true);
    });
});

describe('postToRidareEndpoint', () => {
    beforeAll(() => {
        global.fetch = jest.fn();
    });
    afterEach(() => {
        fetch.mockClear();
    });
    it('sends POST request and returns XML response', async () => {
        const payload = { pid: ['cos-spu.13.3'], query: ['//creator/individualName'] };
        const xmlResponse = `<?xml version="1.0"?><resultset><document><packageid>cos-spu.13.3</packageid></document></resultset>`;
        fetch.mockResolvedValue({ ok: true, text: async () => xmlResponse });
        const result = await postToRidareEndpoint(payload, 'https://ridare.edirepository.org/multi');
        expect(result).toBe(xmlResponse);
        expect(fetch).toHaveBeenCalledWith('https://ridare.edirepository.org/multi', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
                'Accept': 'application/xml'
            }),
            body: JSON.stringify(payload)
        }));
    });
});

describeRealRequests('postToRidareEndpoint (real request)', () => {
    it('sends real POST request and receives XML', async () => {
        global.fetch = require('node-fetch');
        const payload = { pid: ['cos-spu.13.3'], query: ['//creator/individualName'] };
        const xml = await postToRidareEndpoint(payload, 'https://ridare.edirepository.org/multi');
        expect(typeof xml).toBe('string');
        expect(xml.startsWith('<?xml')).toBe(true);
    });
});

describe('Integration: fetchDataPackageIdentifiers + buildRidarePayload + postToRidareEndpoint', () => {
    beforeAll(() => {
        global.fetch = jest.fn();
    });
    afterEach(() => {
        fetch.mockClear();
    });
    it('chains identifier fetch, payload build, and POST correctly', async () => {
        // Step 1: Mock fetch for identifier GET
        const xmlResponse = `<?xml version="1.0"?><resultset><document><packageid>cos-spu.12.1</packageid></document><document><packageid>cos-spu.13.1</packageid></document></resultset>`;
        fetch.mockResolvedValueOnce({ ok: true, text: async () => xmlResponse });
        // Step 2: Call fetchDataPackageIdentifiers
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual(['cos-spu.12.1', 'cos-spu.13.1']);
        // Step 3: Build payload
        const payload = buildRidarePayload(pids);
        expect(payload.pid).toEqual(['cos-spu.12.1', 'cos-spu.13.1']);
        // Step 4: Mock fetch for POST
        const postXmlResponse = `<?xml version="1.0"?><resultset><document><packageid>cos-spu.12.1</packageid></document></resultset>`;
        fetch.mockResolvedValueOnce({ ok: true, text: async () => postXmlResponse });
        // Step 5: Call postToRidareEndpoint
        const result = await postToRidareEndpoint(payload, 'https://ridare.edirepository.org/multi');
        expect(result).toBe(postXmlResponse);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('getThumbnailUrl', () => {
    it('returns empty string for invalid packageId', () => {
        expect(getThumbnailUrl('')).toBe('');
        expect(getThumbnailUrl('invalid-pid')).toBe('');
    });
    it('returns standard URL when no apiKey is present', () => {
        const url = getThumbnailUrl('edi.123.4');
        expect(url).toBe('https://pasta.lternet.edu/package/thumbnail/eml/edi/123/4');
    });
    it('appends apiKey when passed as parameter', () => {
        const url = getThumbnailUrl('edi.123.4', 'my-secret-key');
        expect(url).toBe('https://pasta.lternet.edu/package/thumbnail/eml/edi/123/4?key=my-secret-key');
    });
    it('appends apiKey from global PASTA_CONFIG when present', () => {
        global.PASTA_CONFIG = { apiKey: 'another-secret-key' };
        const url = getThumbnailUrl('edi.123.4');
        expect(url).toBe('https://pasta.lternet.edu/package/thumbnail/eml/edi/123/4?key=another-secret-key');
        delete global.PASTA_CONFIG;
    });
});
