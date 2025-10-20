const { DOMParser } = require('xmldom');

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
            "//taxonRankValue",
            "//commonName"
        ]
    };
}

module.exports = { fetchDataPackageIdentifiers, buildRidarePayload };
