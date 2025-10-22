const { fetchDataPackageIdentifiers, buildRidarePayload, postToRidareEndpoint, parseRidareXmlResponse } = require('./pasta-utils');

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
});

describe('fetchDataPackageIdentifiers (real request)', () => {
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
                { keywords: "//keywordSet/keyword" },
                "//creator/individualName",
                "//contact/individualName",
                "//associatedParty/individualName",
                "//geographicCoverage/geographicDescription",
                { projectTitle: "//project/title" },
                { relatedProjectTitle: "//relatedProject" },
                "//taxonRankValue",
                "//commonName"
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
        const result = await postToRidareEndpoint(payload, 'http://127.0.0.1:5000/multi');
        expect(result).toBe(xmlResponse);
        expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:5000/multi', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
                'Accept': 'application/xml'
            }),
            body: JSON.stringify(payload)
        }));
    });
});

describe('postToRidareEndpoint (real request)', () => {
    it('sends real POST request and receives XML', async () => {
        global.fetch = require('node-fetch');
        const payload = { pid: ['cos-spu.13.3'], query: ['//creator/individualName'] };
        const xml = await postToRidareEndpoint(payload, 'http://127.0.0.1:5000/multi');
        expect(typeof xml).toBe('string');
        expect(xml.startsWith('<?xml')).toBe(true);
    });
});

describe('parseRidareXmlResponse', () => {
    it('parses a typical Ridare XML response', () => {
        const xml = `<?xml version="1.0"?>
        <resultset>
           <document>
              <packageid>cos-spu.13.3</packageid>
              <keywords>
                 <keyword>crown development</keyword>
                 <keyword>conifer forest</keyword>
              </keywords>
              <individualName>
                 <givenName>Rolf</givenName>
                 <surName>Gersonde</surName>
              </individualName>
              <individualName>
                 <givenName>Bill</givenName>
                 <surName>Richards</surName>
              </individualName>
              <geographicDescription>Cedar River Municipal Watershed</geographicDescription>
              <projectTitle>
                 <title>Upland Restoration Thinning</title>
              </projectTitle>
              <projectTitle>
                 <title>Lowland Restoration Thinning</title>
              </projectTitle>
              <taxonRankValue>Plantae</taxonRankValue>
              <taxonRankValue>Viridiplantae</taxonRankValue>
              <commonName>hemlock</commonName>
              <commonName>Pacific hemlock</commonName>
           </document>
        </resultset>`;
        const result = parseRidareXmlResponse(xml);
        expect(result.length).toBe(1);
        const doc = result[0];
        expect(doc.packageid).toBe('cos-spu.13.3');
        expect(doc.keywords).toEqual(['crown development', 'conifer forest']);
        expect(doc.geographicDescription).toBe('Cedar River Municipal Watershed');
        expect(doc.projectTitles).toEqual(['Upland Restoration Thinning', 'Lowland Restoration Thinning']);
        expect(doc.taxonRankValues).toEqual(['Plantae', 'Viridiplantae']);
        expect(doc.commonNames).toEqual(['hemlock', 'Pacific hemlock']);
        expect(doc.authors).toBe('Gersonde, Rolf\nRichards, Bill');
    });
    it('handles multiple givenNames and missing fields', () => {
        const xml = `<?xml version="1.0"?>
        <resultset>
           <document>
              <packageid>cos-spu.9.1</packageid>
              <individualName>
                 <givenName>Jane</givenName>
                 <givenName>Ann</givenName>
                 <surName>Doe</surName>
              </individualName>
           </document>
        </resultset>`;
        const result = parseRidareXmlResponse(xml);
        expect(result.length).toBe(1);
        const doc = result[0];
        expect(doc.packageid).toBe('cos-spu.9.1');
        expect(doc.authors).toBe('Doe, Jane Ann');
        expect(doc.keywords).toEqual([]);
        expect(doc.geographicDescription).toBe('');
        expect(doc.projectTitles).toEqual([]);
        expect(doc.taxonRankValues).toEqual([]);
        expect(doc.commonNames).toEqual([]);
    });
});
