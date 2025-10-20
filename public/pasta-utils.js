/**
 * Fetch all data package identifiers (pids) for a given scope from the PASTA search endpoint.
 * @param {string} scope - The scope to filter data packages.
 * @returns {Promise<string[]>} - Promise resolving to an array of pid strings.
 */
const PASTA_SERVER = "https://pasta.lternet.edu/package/search/eml?";
async function fetchDataPackageIdentifiers(scope) {
    const filter = `&fq=scope:${scope}`;
    const url = `${PASTA_SERVER}${filter}&fl=packageid&wt=json&rows=1000`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch data packages: ${response.status}`);
    }
    const data = await response.json();
    if (!data.response || !Array.isArray(data.response.docs)) {
        return [];
    }
    return data.response.docs.map(doc => doc.packageid);
}

module.exports = { fetchDataPackageIdentifiers };
