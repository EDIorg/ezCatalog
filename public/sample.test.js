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
        const mockResponse = {
            response: {
                docs: [
                    { packageid: 'cos-spu.12.1' },
                    { packageid: 'cos-spu.13.1' }
                ]
            }
        };
        fetch.mockResolvedValue({ ok: true, json: async () => mockResponse });
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual(['cos-spu.12.1', 'cos-spu.13.1']);
    });
    it('returns empty array if docs missing', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ response: { docs: [] } }) });
        const pids = await fetchDataPackageIdentifiers('cos-spu');
        expect(pids).toEqual([]);
    });
    it('throws error on fetch failure', async () => {
        fetch.mockResolvedValue({ ok: false, status: 500 });
        await expect(fetchDataPackageIdentifiers('cos-spu')).rejects.toThrow('Failed to fetch data packages: 500');
    });
});
