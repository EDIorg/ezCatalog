/**
 * Utility: Safely get text content from the first matching child node.
 * @param {Element} parent - Parent XML node.
 * @param {string} tag - Tag name to search for.
 * @returns {string} Text content or empty string.
 */
function getText(parent, tag) {
    const node = parent.getElementsByTagName(tag)[0];
    return node ? node.textContent.trim() : '';
}

/**
 * Utility: Map text content from all child nodes of a given tag.
 * @param {Element} parent - Parent XML node.
 * @param {string} tag - Tag name to search for.
 * @returns {string[]} Array of trimmed text contents.
 */
function mapText(parent, tag) {
    return Array.from(parent.getElementsByTagName(tag)).map(n => n.textContent.trim());
}

const { DOMParser } = require('xmldom');
const PASTA_SERVER = "https://pasta.lternet.edu/package/search/eml?";

/**
 * Fetch package identifiers from PASTA server.
 * @param {string} scope
 * @param {string} [filter]
 * @returns {Promise<string[]>}
 */
async function fetchDataPackageIdentifiers(scope, filter = `&fq=scope:${scope}`) {
    const url = `${PASTA_SERVER}fl=packageid&defType=edismax${filter}&q=*&rows=1000`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch data packages: ${response.status}`);
    const xmlText = await response.text();
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    return mapText(doc, 'packageid');
}

/**
 * Build the JSON payload for the Ridare endpoint.
 * @param {string[]} pids
 * @returns {object}
 */
function buildRidarePayload(pids) {
    return {
        pid: pids,
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
    };
}

/**
 * POST JSON payload to Ridare endpoint and get XML response.
 * @param {object} payload
 * @param {string} [url]
 * @returns {Promise<string>}
 */
async function postToRidareEndpoint(payload, url = 'http://127.0.0.1:5000/multi') {
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/xml'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Ridare POST failed: ${response.status}`);
    return await response.text();
}

/**
 * Parse Ridare XML response and extract relevant fields.
 * @param {string} xmlText
 * @returns {Array<Object>}
 */
function parseRidareXmlResponse(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    return Array.from(doc.getElementsByTagName('document')).map(documentNode => {
        const packageid = getText(documentNode, 'packageid');
        const keywords = mapText(documentNode, 'keyword');
        const geographicDescription = getText(documentNode, 'geographicDescription');
        const projectTitles = Array.from(documentNode.getElementsByTagName('projectTitle')).map(pt => getText(pt, 'title')).filter(Boolean);
        const taxonRankValues = mapText(documentNode, 'taxonRankValue');
        const commonNames = mapText(documentNode, 'commonName');
        // Authors: combine surName and givenName(s)
        const individualNameNodes = documentNode.getElementsByTagName('individualName');
        const authors = Array.from(individualNameNodes).map(indNode => {
            const surName = getText(indNode, 'surName');
            const givenNames = mapText(indNode, 'givenName').join(' ');
            return `${surName}, ${givenNames}`.trim();
        }).filter(a => a !== ',');
        return {
            packageid,
            keywords,
            geographicDescription,
            projectTitles,
            taxonRankValues,
            commonNames,
            authors: authors.join('\n')
        };
    });
}

module.exports = {
    fetchDataPackageIdentifiers,
    buildRidarePayload,
    postToRidareEndpoint,
    parseRidareXmlResponse
};
