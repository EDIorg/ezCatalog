const PASTA_SERVER = "https://pasta.lternet.edu/package/search/eml?";
async function fetchDataPackageIdentifiers(scope, filter = `&fq=scope:${scope}`) {
    const url = `${PASTA_SERVER}fl=packageid&defType=edismax${filter}&q=*&rows=1000`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch data packages: ${response.status}`);
    }
    const xmlText = await response.text();
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const packageidNodes = doc.getElementsByTagName('packageid');
    const pids = [];
    for (let i = 0; i < packageidNodes.length; i++) {
        const pid = packageidNodes[i].textContent.trim();
        if (pid) pids.push(pid);
    }
    return pids;
}

/**
 * Build the JSON payload for the Ridare endpoint.
 * @param {string[]} pids - Array of package identifiers.
 * @returns {object} Ridare payload JSON object.
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
            "//dataset/abstract",
            "//taxonRankValue",
            "//commonName"
        ]
    };
}

/**
 * Send a POST request to the Ridare endpoint with the constructed payload.
 * @param {object} payload - JSON payload for Ridare.
 * @param {string} [url] - Optional endpoint URL (default: 'http://127.0.0.1:5000/multi').
 * @returns {Promise<string>} - XML response from Ridare as a string.
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
    if (!response.ok) {
        throw new Error(`Ridare POST failed: ${response.status}`);
    }
    return await response.text();
}

/**
 * Parse Ridare XML response and extract relevant fields.
 * @param {string} xmlText - Ridare XML response as a string.
 * @returns {Array<Object>} Array of parsed document objects.
 */
function parseRidareXmlResponse(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const documents = Array.from(doc.getElementsByTagName('document')).map(documentNode => {
        // Package ID
        const packageid = documentNode.getElementsByTagName('packageid')[0]?.textContent.trim() || '';
        // Keywords
        const keywordNodes = documentNode.getElementsByTagName('keyword');
        const keywords = Array.from(keywordNodes).map(k => k.textContent.trim());
        // Geographic Description
        const geoDescNode = documentNode.getElementsByTagName('geographicDescription')[0];
        const geographicDescription = geoDescNode ? geoDescNode.textContent.trim() : '';
        // Project Titles
        const projectTitleNodes = documentNode.getElementsByTagName('projectTitle');
        const projectTitles = Array.from(projectTitleNodes).map(pt => pt.getElementsByTagName('title')[0]?.textContent.trim()).filter(Boolean);
        // Taxon Rank Values
        const taxonRankNodes = documentNode.getElementsByTagName('taxonRankValue');
        const taxonRankValues = Array.from(taxonRankNodes).map(tr => tr.textContent.trim());
        // Common Names
        const commonNameNodes = documentNode.getElementsByTagName('commonName');
        const commonNames = Array.from(commonNameNodes).map(cn => cn.textContent.trim());
        // Authors
        const individualNameNodes = documentNode.getElementsByTagName('individualName');
        const authors = Array.from(individualNameNodes).map(indNode => {
            const surName = indNode.getElementsByTagName('surName')[0]?.textContent.trim() || '';
            const givenNameNodes = indNode.getElementsByTagName('givenName');
            const givenNames = Array.from(givenNameNodes).map(gn => gn.textContent.trim());
            return `${surName}, ${givenNames.join(' ')}`.trim();
        }).filter(a => a !== ',');
        // Abstract
        const abstractNode = documentNode.getElementsByTagName('abstract')[0];
        let abstract = '';
        if (abstractNode) {
            // If abstract has child elements, concatenate their textContent
            if (abstractNode.children && abstractNode.children.length > 0) {
                abstract = Array.from(abstractNode.children)
                    .map(child => child.textContent.trim())
                    .filter(Boolean)
                    .join(' ');
            } else {
                abstract = abstractNode.textContent.trim();
            }
        }
        // Strip any XML tags from abstract
        abstract = abstract.replace(/<[^>]+>/g, '');
        return {
            packageid,
            keywords,
            geographicDescription,
            projectTitles,
            taxonRankValues,
            commonNames,
            authors: authors.join('\n'),
            abstract
        };
    });
    return documents;
}

/**
 * Reformat an XML document according to custom rules.
 * @param {Document} xmlDoc - The XML document to reformat.
 * @returns {Document} Reformatted XML document.
 */
function reformatXMLDocument(xmlDoc) {
    // TODO: Implement reformatting logic in subsequent steps
    return xmlDoc;
}

// Remove Node.js module.exports and attach functions to window for browser use
window.fetchDataPackageIdentifiers = fetchDataPackageIdentifiers;
window.buildRidarePayload = buildRidarePayload;
window.postToRidareEndpoint = postToRidareEndpoint;
window.parseRidareXmlResponse = parseRidareXmlResponse;
window.reformatXMLDocument = reformatXMLDocument;
