// Requires cors.js and pagination.js to be loaded first

"use strict";

// Use Node.js imports for testing, otherwise use browser globals
if (typeof module !== 'undefined' && module.exports) {
  var fetchDataPackageIdentifiers, buildRidarePayload, postToRidareEndpoint, reformatXMLDocument;
  ({ fetchDataPackageIdentifiers, buildRidarePayload, postToRidareEndpoint, reformatXMLDocument } = require('./pasta-utils'));
} else if (typeof window !== 'undefined') {
  if (typeof fetchDataPackageIdentifiers === 'undefined') {
    var fetchDataPackageIdentifiers = window.fetchDataPackageIdentifiers;
  }
  if (typeof buildRidarePayload === 'undefined') {
    var buildRidarePayload = window.buildRidarePayload;
  }
  if (typeof postToRidareEndpoint === 'undefined') {
    var postToRidareEndpoint = window.postToRidareEndpoint;
  }
  if (typeof reformatXMLDocument === 'undefined') {
    var reformatXMLDocument = window.reformatXMLDocument;
  }
}

// Import GeoJSON transformer and map view component
if (typeof require !== 'undefined') {
  var emlXmlToGeoJSON = require('./eml-xml-to-geojson');
  var { renderMapData, initMap, enableMapDrawing } = require('./leaflet-map-view');
  var { geojsonToMapFilterXML } = require('./geojson-to-xml');
} else {
  var emlXmlToGeoJSON = window.emlXmlToGeoJSON;
  var renderMapData = window.renderMapData;
  var initMap = window.initMap;
  var enableMapDrawing = window.enableMapDrawing;
  var geojsonToMapFilterXML = window.geojsonToMapFilterXML;
}

const PASTA_CONFIG = {
   // User configurable options --------------------------------------------------------------------------------
   "filter": '&fq=scope:cos-spu', // Filter results on a unique keyword of a research group
   "brandingText": "Seattle Public Utilities Data Catalog",
   "logoAltText": "The City of Seattle Logo. The logo is a stylized, circular emblem featuring the profile of Chief Seattle (Si'ahl), the Duwamish and Suquamish leader for whom the city is named.", //
   "showAbstracts": true, // true if we should show abstracts in search results
   "abstractLimit": 750, // Limit the number of characters in the abstract
   "showUserStoriesLink": true, // If false, do not display the user stories link for datasets
   "showThumbnails": true, // If false, do not display dataset thumbnail images
   "showBanner": true, // If false, the top banner will not be displayed
   "hideMapView": false, // true to hide the map view
   "facetVisibility": { // Facet visibility toggles
      "creator": true,
      "keyword": true,
      "project": true,
      "location": true,  // Must be true to enable location-based map filtering
      "taxon": true,
      "commonName": true
   },
   // Internal use only ---------------------------------------------------------------------------------------------
   "server": "https://pasta.lternet.edu/package/search/eml?", // PASTA server
   "countElementId": "resultCount", // Element showing number of results
   "limit": 2000,  // Max number of results to retrieve per page
   "resultsElementId": "searchResults", // Element to contain results
   // Centralized element IDs
   "loadingDivId": "loading-div",
   "creatorDropdownId": "creator-dropdown",
   "keywordDropdownId": "keyword-dropdown",
   "projectDropdownId": "project-dropdown",
   "locationDropdownId": "location-dropdown",
   "taxonDropdownId": "taxonRankValue-dropdown",
   "commonNameDropdownId": "commonName-dropdown",
   "activeFiltersId": "active-filters",
   "brandingTextId": "branding-text",
   // Centralized URLs
   "imgBasePath": "images/",
   "portalBaseUrl": "https://portal.edirepository.org/nis/mapbrowse?packageid=",
   "citeBaseUrl": "https://cite.edirepository.org/cite/",
   // Delays
   "baseDelay": 200 // ms
   // ----------------------------------------------------------------------------------------------------------------
};

/**
 * Get URL arguments by name
 * @param {string} name
 * @param {string} [url]
 * @returns {string|null}
 */
function getParameterByName(name, url) {
   url = url || window.location.href;
   name = name.replace(/[\[\]]/g, "\\$&");
   const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
   const results = regex.exec(url);
   if (!results) return null;
   if (!results[2]) return "";
   return decodeURIComponent(results[2].replace(/\+/g, " ")).trim();
}

// --- HTML fragment helpers ---
function authorHtml(authors, date) {
   return `<div class='dataset-author'>${authors}${date}</div>`;
}
function abstractHtml(abstract) {
   return `<div class='dataset-abstract'>${abstract}</div>`;
}
function titleHtml(title) {
   return `<div class='dataset-title'><h3>${title}</h3></div>`;
}
function imgHtml(pkgid) {
   if (!PASTA_CONFIG.showThumbnails) return "";
   const imgSrc = window.getThumbnailUrl ? window.getThumbnailUrl(pkgid) : '';
   // Add click handler to enlarge image
   return `<div class='dataset-thumb-container'><img class='dataset-thumb' src='${imgSrc}' alt='' onerror="this.style.display='none';this.parentNode.classList.add('no-image');" onclick="enlargeThumbnail('${imgSrc}')"></div>`;
}
function exploreLink(link, title) {
   return `<a class='explore-link' href='${link}' target='_blank' rel='noopener noreferrer' aria-label='Explore data package: ${title} in the Environmental Data Initiative repository'>Explore Data <i class='fas fa-external-link-alt' style='margin-left:6px;font-size:0.98em;vertical-align:middle;'></i></a>`;
}
function relatedStoriesLink(pkgid, title) {
   if (!PASTA_CONFIG.showUserStoriesLink) return "";

   // Check if the dataset exists in related_stories.csv
   const relatedStories = window.relatedStories || [];
   const pkgidNoRev = pkgid.split('.').slice(0,2).join('.');
   const existsInCsv = relatedStories.includes(pkgidNoRev);

   if (!existsInCsv) return "";

   const encodedTitle = encodeURIComponent(title);
   return `<a class='explore-link' href='related_content.html?package_id=${pkgidNoRev}&title=${encodedTitle}' style='margin-left:18px;' aria-label='View related content for data package: ${title}'>Related Content <i class='fas fa-book-open' style='margin-left:6px;font-size:0.98em;vertical-align:middle;'></i></a>`;
}

/**
 * Parse citation dictionary into HTML
 * @param {Object[]} citations
 * @param {string[]} abstracts
 * @returns {string}
 */
function buildHtml(citations, abstracts) {
   const html = [];
   const citationCount = Object.keys(citations).length;
   for (let i = 0; i < citationCount; i++) {
      const citation = citations[i];
      let abstract = abstracts[i] || ""; // Ensure abstract is a string
      if (abstract.length > PASTA_CONFIG.abstractLimit) {
         abstract = abstract.substring(0, PASTA_CONFIG.abstractLimit) + "...";
      }
      let authors = citation.authors;
      if (authors && !authors.endsWith(".")) {
         authors += ".";
      }
      let date = citation.pub_year ? ` Published ${citation.pub_year}.` : "";
      const link = citation.doi ? citation.doi.slice(0, -1) : `${PASTA_CONFIG.portalBaseUrl}${citation.pid}`;
      const row = `<div class='dataset-row'><div class='dataset-info'>${titleHtml(citation.title)}${authorHtml(authors, date)}${PASTA_CONFIG.showAbstracts ? abstractHtml(abstract) : ""}<div class='dataset-actions'>${exploreLink(link, citation.title)}${relatedStoriesLink(citation.pid, citation.title)}</div></div>${imgHtml(citation.pid)}</div>`;
      html.push(row);
   }
   return citationCount ? html.join("\n") : "<p>Your search returned no results.</p>";
}

// Build dataset citations directly from Ridare XML response
function buildCitationsFromCite(pastaDocs) {
   var citations = {};
   var abstracts = [];
   for (var i = 0; i < pastaDocs.length; i++) {
      var doc = pastaDocs[i];
      var packageidNode = doc.getElementsByTagName && doc.getElementsByTagName("packageid")[0];
      var abstractNode = doc.getElementsByTagName && doc.getElementsByTagName("abstract")[0];
      var titleNode = doc.getElementsByTagName && doc.getElementsByTagName("title")[0];
      var pubYearNode = doc.getElementsByTagName && doc.getElementsByTagName("pub_year")[0];
      var doiNode = doc.getElementsByTagName && doc.getElementsByTagName("doi")[0];
      // Extract authors from <authors> node and reformat for citation
      var authorsNode = doc.getElementsByTagName && doc.getElementsByTagName("authors")[0];
      var authors = "";
      if (authorsNode) {
         var authorElems = authorsNode.getElementsByTagName("author");
         authors = Array.from(authorElems).map(function(n) {
            var name = n.textContent.trim();
            if (name.includes(",")) {
               var parts = name.split(",");
               var last = parts[0].trim();
               var given = parts[1]?.trim() || "";
               var initial = given.length > 0 ? given[0].toUpperCase() + "." : "";
               return initial ? initial + " " + last : last;
            } else {
               // Organization name, display as is
               return name;
            }
         }).join(", ");
      }
      var pub_year = pubYearNode && pubYearNode.textContent ? pubYearNode.textContent.trim() : "";
      var packageid = packageidNode && packageidNode.childNodes.length > 0 ? packageidNode.childNodes[0].nodeValue : doc.packageid || "";
      var abstract = abstractNode && abstractNode.childNodes.length > 0 ? abstractNode.childNodes[0].nodeValue : doc.abstract || "";
      var title = titleNode && titleNode.childNodes.length > 0 ? titleNode.childNodes[0].nodeValue : doc.title || "";
      var pub_year = pubYearNode && pubYearNode.childNodes.length > 0 ? pubYearNode.childNodes[0].nodeValue : doc.pub_year || "";
      var doi = doiNode && doiNode.childNodes.length > 0 ? doiNode.childNodes[0].nodeValue : doc.doi || "";
      citations[i] = {
         pid: packageid,
         title: title,
         authors: authors, // No year appended here
         pub_year: pub_year,
         doi: doi
      };
      abstracts.push(abstract);
   }
   var html = Object.keys(citations).length ? buildHtml(citations, abstracts) : "<p>Your search returned no results.</p>";
   document.getElementById(PASTA_CONFIG.resultsElementId).innerHTML = html;
   showLoading(false);
   var count = Object.keys(citations).length;
   var currentStart = 0;
   var limit = parseInt(PASTA_CONFIG["limit"]);
   var query = getParameterByName("q");
   showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
}

function showLoading(isLoading) {
   var x = document.getElementById(PASTA_CONFIG.loadingDivId);
   if (!x) {
      console.warn('showLoading: loading-div element not found in DOM');
      document.body.style.cursor = isLoading ? "wait" : "default";
      return;
   }
   if (isLoading) {
      document.body.style.cursor = "wait";
      x.style.display = "block";
   } else {
      document.body.style.cursor = "default";
      x.style.display = "none";
   }
}

function updateElementHtml(elId, innerHtml) {
   var el = document.getElementById(elId);
   if (el)
      el.innerHTML = innerHtml;
}

// Function to call if CORS request is successful
function handleSuccess(headers, response) {
   function makeCsvLink(count) {
      if (!count) return "";
      var html = '<a href="" onclick="return downloadCsv(' + count + ');">' +
         'Download all results as CSV</a>';
      return html;
   }

   // Write results to page
   var parser = new DOMParser();
   var xmlDoc = parser.parseFromString(response, "text/xml");
   var docs = xmlDoc.getElementsByTagName("document");
   buildCitationsFromCite(docs);
   var count = parseInt(xmlDoc.getElementsByTagName("resultset")[0].getAttribute("numFound"));
   updateElementHtml(PASTA_CONFIG["csvElementId"], makeCsvLink(count));

   // Add links to additional search result pages if necessary
   var currentStart = getParameterByName("start");
   if (!currentStart) {
      currentStart = 0;
   } else {
      currentStart = parseInt(currentStart);
   }
   var limit = parseInt(PASTA_CONFIG["limit"]);
   var showPages = parseInt(PASTA_CONFIG["showPages"]);
   var pageTopElementId = PASTA_CONFIG["pagesTopElementId"];
   var pageBotElementId = PASTA_CONFIG["pagesBotElementId"];
   var query = getParameterByName("q");
   // Moved showResultCount here to ensure it runs after all CITE calls are complete
   showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
}

// Function to call if CORS request fails
function handleError() {
   showLoading(false);
   alert("There was an error making the request.");
}

// --- Faceted Creator Dropdown Logic ---
// Store search terms for each dropdown
var facetSearchTerms = {};

function renderFacetDropdown(items, selected, counts, className, searchTerm, dropdownId) {
  const filteredItems = items.filter(item =>
    item.toLowerCase().includes((searchTerm || '').toLowerCase())
  );
  // Escape user-controlled search term for safe insertion into HTML attribute
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const safeSearchTerm = escapeHtml(searchTerm || '');
  // Search box with icon, rectangular borders
  const searchBox = `
    <div class="facet-search-bar" style="position:sticky;top:0;z-index:1;background:#f7f8fa;">
      <input type="text" class="facet-search" placeholder="Select..." value="${safeSearchTerm}"
        style="width:95%;padding:7px 10px;border:1.5px solid #c2c7d0;border-radius:0;background:#f7f8fa;box-shadow:0 1px 2px rgba(0,0,0,0.03);font-size:1em;transition:border 0.2s;outline:none;"
        data-dropdown-id="${dropdownId}"
        onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#c2c7d0'"
        aria-label="Select within this facet category"
      >
    </div>
  `;
  const checkboxes = filteredItems.map(function(item) {
    const checked = selected.includes(item) ? 'checked' : '';
    const count = counts[item] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="${className}" value="${item.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" ${checked} style="margin-right:8px;">${item} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
  return searchBox + checkboxes;
}

function restoreFacetSearchFocus(dropdownId) {
  setTimeout(function() {
    var input = document.querySelector(`#${dropdownId} .facet-search`);
    if (input) {
      input.focus();
      // Move cursor to end
      var val = input.value;
      input.value = '';
      input.value = val;
    }
  }, 0);
}

function setFacetBlockVisibility(facet, visible) {
  var blockId = {
    creator: 'creator-block',
    keyword: 'keyword-block',
    project: 'project-block',
    location: 'location-block',
    taxon: 'taxon-block',
    commonName: 'commonName-block'
  }[facet];
  var block = document.getElementById(blockId);
  if (block) block.style.display = visible ? '' : 'none';
}

function populateCreatorFacetOptions(docs, selected) {
   setFacetBlockVisibility('creator', PASTA_CONFIG.facetVisibility.creator);
   if (!PASTA_CONFIG.facetVisibility.creator) return;
   var personnelSet = new Set();
   var personnelCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var personnelNodes = docs[i].getElementsByTagName("personnel")[0];
      var uniquePersonnel = new Set();
      if (personnelNodes) {
         var personElems = personnelNodes.getElementsByTagName("person");
         for (var j = 0; j < personElems.length; j++) {
            var person = personElems[j].textContent;
            if (person) uniquePersonnel.add(person);
         }
      }
      uniquePersonnel.forEach(function(person) {
         personnelSet.add(person);
         personnelCounts[person] = (personnelCounts[person] || 0) + 1;
      });
   }
   var creatorDropdown = document.getElementById(PASTA_CONFIG.creatorDropdownId);
   var personnel = Array.from(personnelSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.creatorDropdownId] || '';
   creatorDropdown.innerHTML = renderFacetDropdown(personnel, selected || [], personnelCounts, 'creator-checkbox', searchTerm, PASTA_CONFIG.creatorDropdownId);
   bindFacetEvents();
   // Do NOT call restoreFacetSearchFocus here
}

function populateKeywordFacetOptions(docs, selected) {
   setFacetBlockVisibility('keyword', PASTA_CONFIG.facetVisibility.keyword);
   if (!PASTA_CONFIG.facetVisibility.keyword) return;
   var keywordSet = new Set();
   var keywordCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var keywordNodes = docs[i].getElementsByTagName("keyword");
      var uniqueKeywords = new Set();
      for (var j = 0; j < keywordNodes.length; j++) {
         var keyword = keywordNodes[j].innerHTML;
         if (keyword) {
            uniqueKeywords.add(keyword);
         }
      }
      uniqueKeywords.forEach(function(keyword) {
         keywordSet.add(keyword);
         keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
   }
   var keywordDropdown = document.getElementById(PASTA_CONFIG.keywordDropdownId);
   var keywords = Array.from(keywordSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.keywordDropdownId] || '';
   keywordDropdown.innerHTML = renderFacetDropdown(keywords, selected || [], keywordCounts, 'keyword-checkbox', searchTerm, PASTA_CONFIG.keywordDropdownId);
   bindFacetEvents();
   // Do NOT call restoreFacetSearchFocus here
}

function populateProjectFacetOptions(docs, selected) {
   setFacetBlockVisibility('project', PASTA_CONFIG.facetVisibility.project);
   if (!PASTA_CONFIG.facetVisibility.project) return;
   var projectSet = new Set();
   var projectCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var projectTitlesElem = docs[i].getElementsByTagName("projectTitles")[0];
      var uniqueProjects = new Set();
      if (projectTitlesElem) {
         var titleNodes = projectTitlesElem.getElementsByTagName("title");
         for (var j = 0; j < titleNodes.length; j++) {
            var title = titleNodes[j].innerHTML;
            if (title) {
               uniqueProjects.add(title);
            }
         }
      }
      uniqueProjects.forEach(function(title) {
         projectSet.add(title);
         projectCounts[title] = (projectCounts[title] || 0) + 1;
      });
   }
   var projectDropdown = document.getElementById(PASTA_CONFIG.projectDropdownId);
   var projects = Array.from(projectSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.projectDropdownId] || '';
   projectDropdown.innerHTML = renderFacetDropdown(projects, selected || [], projectCounts, 'project-checkbox', searchTerm, PASTA_CONFIG.projectDropdownId);
   bindFacetEvents();
   // Do NOT call restoreFacetSearchFocus here
}

function populateLocationFacetOptions(docs, selected) {
   setFacetBlockVisibility('location', PASTA_CONFIG.facetVisibility.location);
   if (!PASTA_CONFIG.facetVisibility.location) return;
   var locationSet = new Set();
   var locationCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var geoCovElem = docs[i].getElementsByTagName("geographicCoverage")[0];
      var uniqueLocations = new Set();
      if (geoCovElem) {
         var geoDescNodes = geoCovElem.getElementsByTagName("geographicDescription");
         for (var j = 0; j < geoDescNodes.length; j++) {
            var location = geoDescNodes[j].innerHTML;
            if (location) {
               uniqueLocations.add(location);
            }
         }
      }
      uniqueLocations.forEach(function(location) {
         locationSet.add(location);
         locationCounts[location] = (locationCounts[location] || 0) + 1;
      });
   }
   var locationDropdown = document.getElementById(PASTA_CONFIG.locationDropdownId);
   var locations = Array.from(locationSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.locationDropdownId] || '';
   locationDropdown.innerHTML = renderFacetDropdown(locations, selected || [], locationCounts, 'location-checkbox', searchTerm, PASTA_CONFIG.locationDropdownId);
   bindFacetEvents();
   // Do NOT call restoreFacetSearchFocus here
}

function populateTaxonFacetOptions(docs, selected) {
   setFacetBlockVisibility('taxon', PASTA_CONFIG.facetVisibility.taxon);
   if (!PASTA_CONFIG.facetVisibility.taxon) return;
   var taxonSet = new Set();
   var taxonCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var node = docs[i];
      var taxonNodes = node.getElementsByTagName("taxonRankValue");
      var uniqueTaxa = new Set();
      for (var j = 0; j < taxonNodes.length; j++) {
         var taxon = taxonNodes[j].textContent.trim();
         if (taxon) {
            uniqueTaxa.add(taxon);
         }
      }
      uniqueTaxa.forEach(function(taxon) {
         taxonSet.add(taxon);
         taxonCounts[taxon] = (taxonCounts[taxon] || 0) + 1;
      });
   }
   var taxonDropdown = document.getElementById(PASTA_CONFIG.taxonDropdownId);
   // Ensure the correct class is set for styling
   taxonDropdown.classList.add('taxon-dropdown');
   var taxa = Array.from(taxonSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.taxonDropdownId] || '';
   if (taxa.length === 0) {
     taxonDropdown.innerHTML = '<span style="color:#888;">No scientific names found in data.</span>';
   } else {
     taxonDropdown.innerHTML = renderFacetDropdown(taxa, selected || [], taxonCounts, 'taxon-checkbox', searchTerm, PASTA_CONFIG.taxonDropdownId);
     bindFacetEvents();
     // Do NOT call restoreFacetSearchFocus here
   }
}

function populateCommonNameFacetOptions(docs, selected) {
   setFacetBlockVisibility('commonName', PASTA_CONFIG.facetVisibility.commonName);
   if (!PASTA_CONFIG.facetVisibility.commonName) return;
   var commonNameSet = new Set();
   var commonNameCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var node = docs[i];
      var commonNameNodes = node.getElementsByTagName("commonName");
      var uniqueCommonNames = new Set();
      for (var j = 0; j < commonNameNodes.length; j++) {
         var commonName = commonNameNodes[j].textContent.trim();
         if (commonName) {
            uniqueCommonNames.add(commonName);
         }
      }
      uniqueCommonNames.forEach(function(commonName) {
         commonNameSet.add(commonName);
         commonNameCounts[commonName] = (commonNameCounts[commonName] || 0) + 1;
      });
   }
   var commonNameDropdown = document.getElementById(PASTA_CONFIG.commonNameDropdownId);
   var commonNames = Array.from(commonNameSet).sort();
   var searchTerm = facetSearchTerms[PASTA_CONFIG.commonNameDropdownId] || '';
   if (commonNames.length === 0) {
     commonNameDropdown.innerHTML = '<span style="color:#888;">No common names found in data.</span>';
   } else {
     commonNameDropdown.innerHTML = renderFacetDropdown(commonNames, selected || [], commonNameCounts, 'commonname-checkbox', searchTerm, PASTA_CONFIG.commonNameDropdownId);
     bindFacetEvents();
     // Do NOT call restoreFacetSearchFocus here
   }
}

// Helper: get docs filtered by all facets except the one being rendered
function getDocsFilteredByAllExcept(facet) {
  let docs = ALL_PASTA_DOCS;
  if (facet !== 'creator') docs = filterDocsByCreators(docs, getSelectedCreators());
  if (facet !== 'keyword') docs = filterDocsByKeywords(docs, getSelectedKeywords());
  if (facet !== 'project') docs = filterDocsByProjects(docs, getSelectedProjects());
  if (facet !== 'location') docs = filterDocsByLocations(docs, getSelectedLocations());
  if (facet !== 'taxon') docs = filterDocsByTaxa(docs, getSelectedTaxa());
  if (facet !== 'commonName') docs = filterDocsByCommonNames(docs, getSelectedCommonNames());
  return docs;
}

// Update facet search event handler to use filtered docs
if (typeof window !== 'undefined') {
  document.addEventListener('input', function(e) {
    if (e.target.classList && e.target.classList.contains('facet-search')) {
      var dropdownId = e.target.getAttribute('data-dropdown-id');
      facetSearchTerms[dropdownId] = e.target.value;
      // Determine which facet is being searched
      if (dropdownId === PASTA_CONFIG.creatorDropdownId) {
        const docs = getDocsFilteredByAllExcept('creator');
        populateCreatorFacetOptions(docs, getSelectedCreators());
        restoreFacetSearchFocus(PASTA_CONFIG.creatorDropdownId);
      } else if (dropdownId === PASTA_CONFIG.keywordDropdownId) {
        const docs = getDocsFilteredByAllExcept('keyword');
        populateKeywordFacetOptions(docs, getSelectedKeywords());
        restoreFacetSearchFocus(PASTA_CONFIG.keywordDropdownId);
      } else if (dropdownId === PASTA_CONFIG.projectDropdownId) {
        const docs = getDocsFilteredByAllExcept('project');
        populateProjectFacetOptions(docs, getSelectedProjects());
        restoreFacetSearchFocus(PASTA_CONFIG.projectDropdownId);
      } else if (dropdownId === PASTA_CONFIG.locationDropdownId) {
        const docs = getDocsFilteredByAllExcept('location');
        populateLocationFacetOptions(docs, getSelectedLocations());
        restoreFacetSearchFocus(PASTA_CONFIG.locationDropdownId);
      } else if (dropdownId === PASTA_CONFIG.taxonDropdownId) {
        const docs = getDocsFilteredByAllExcept('taxon');
        populateTaxonFacetOptions(docs, getSelectedTaxa());
        restoreFacetSearchFocus(PASTA_CONFIG.taxonDropdownId);
      } else if (dropdownId === PASTA_CONFIG.commonNameDropdownId) {
        const docs = getDocsFilteredByAllExcept('commonName');
        populateCommonNameFacetOptions(docs, getSelectedCommonNames());
        restoreFacetSearchFocus(PASTA_CONFIG.commonNameDropdownId);
      }
    }
  });
}

// --- Faceted Creator Dropdown Logic ---
// Store all results for client-side filtering
var ALL_PASTA_DOCS = [];

function getSelectedCreators() {
  var boxes = document.querySelectorAll('.creator-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByCreators(docs, selectedPersonnel) {
   if (!selectedPersonnel.length) return docs;
   return docs.filter(function(doc) {
      var personnelNodes = doc.getElementsByTagName("personnel")[0];
      var personnel = [];
      if (personnelNodes) {
         var personElems = personnelNodes.getElementsByTagName("person");
         personnel = Array.from(personElems).map(function(n) { return n.textContent; });
      }
      return selectedPersonnel.some(function(sel) { return personnel.includes(sel); });
   });
}

// --- Faceted Keyword Dropdown Logic ---
function getSelectedKeywords() {
  var boxes = document.querySelectorAll('.keyword-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByKeywords(docs, selectedKeywords) {
   if (!selectedKeywords.length) return docs;
   return docs.filter(function(doc) {
      var keywordNodes = doc.getElementsByTagName("keyword");
      var keywords = Array.from(keywordNodes).map(function(n) { return n.innerHTML; });
      return selectedKeywords.some(function(sel) { return keywords.includes(sel); });
   });
}

// --- Faceted Project Dropdown Logic ---
function getSelectedProjects() {
  var boxes = document.querySelectorAll('.project-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByProjects(docs, selectedProjects) {
   if (!selectedProjects.length) return docs;
   return docs.filter(function(doc) {
      // Use <title> children of <projectTitles> for filtering
      var projectTitlesElem = doc.getElementsByTagName("projectTitles")[0];
      var projects = [];
      if (projectTitlesElem) {
         var titleNodes = projectTitlesElem.getElementsByTagName("title");
         for (var j = 0; j < titleNodes.length; j++) {
            projects.push(titleNodes[j].innerHTML);
         }
      }
      return selectedProjects.some(function(sel) { return projects.includes(sel); });
   });
}



// --- Faceted Location Dropdown Logic ---
function getSelectedLocations() {
  var boxes = document.querySelectorAll('.location-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByLocations(docs, selectedLocations) {
   if (!selectedLocations.length) return docs;
   return docs.filter(function(doc) {
      // Use <geographicDescription> children of <geographicCoverage> for filtering
      var geoCovElem = doc.getElementsByTagName("geographicCoverage")[0];
      var locations = [];
      if (geoCovElem) {
         var geoDescNodes = geoCovElem.getElementsByTagName("geographicDescription");
         for (var j = 0; j < geoDescNodes.length; j++) {
            locations.push(geoDescNodes[j].innerHTML);
         }
      }
      return selectedLocations.some(function(sel) { return locations.includes(sel); });
   });
}

// --- Faceted Taxon Dropdown Logic ---
function getSelectedTaxa() {
  var boxes = document.querySelectorAll('.taxon-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByTaxa(docs, selectedTaxa) {
   if (!selectedTaxa.length) return docs;
   return docs.filter(function(doc) {
      var taxonNodes = doc.getElementsByTagName("taxonRankValue");
      var taxa = Array.from(taxonNodes).map(function(n) { return n.textContent.trim(); });
      return selectedTaxa.some(function(sel) { return taxa.includes(sel); });
   });
}

// --- Faceted Common Name Dropdown Logic ---
function getSelectedCommonNames() {
  var boxes = document.querySelectorAll('.commonname-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function filterDocsByCommonNames(docs, selectedCommonNames) {
   if (!selectedCommonNames.length) return docs;
   return docs.filter(function(doc) {
      var commonNameNodes = doc.getElementsByTagName("commonName");
      var commonNames = Array.from(commonNameNodes).map(function(n) { return n.textContent.trim(); });
      return selectedCommonNames.some(function(sel) { return commonNames.includes(sel); });
   });
}


// Patch successCallback to store all docs and update creator, keyword, projects, location, taxon, and common name facets
handleSuccess = function(headers, response) {
   var parser = new DOMParser();
   var xmlDoc = parser.parseFromString(response, "text/xml");
   var docs = Array.from(xmlDoc.getElementsByTagName("doc"));
   var selectedCreators = getSelectedCreators();
   var selectedKeywords = getSelectedKeywords();
   var selectedProjects = getSelectedProjects();
   var selectedLocations = getSelectedLocations();
   var selectedTaxa = getSelectedTaxa();
   var selectedCommonNames = getSelectedCommonNames();
   populateCreatorFacetOptions(docs, selectedCreators);
   populateKeywordFacetOptions(docs, selectedKeywords);
   populateProjectFacetOptions(docs, selectedProjects);
   populateLocationFacetOptions(docs, selectedLocations);
   populateTaxonFacetOptions(docs, selectedTaxa);
   populateCommonNameFacetOptions(docs, selectedCommonNames);
   var filtered = docs;
   filtered = filterDocsByCreators(filtered, selectedCreators);
   filtered = filterDocsByKeywords(filtered, selectedKeywords);
   filtered = filterDocsByProjects(filtered, selectedProjects);
   filtered = filterDocsByLocations(filtered, selectedLocations);
   filtered = filterDocsByTaxa(filtered, selectedTaxa);
   filtered = filterDocsByCommonNames(filtered, selectedCommonNames);
   renderResults(filtered);
   renderActiveFilters({
     creators: selectedCreators,
     keywords: selectedKeywords,
     projects: selectedProjects,
     locations: selectedLocations,
     taxa: selectedTaxa,
     commonNames: selectedCommonNames
   });
};

// Update renderActiveFilters to include tags for selected scientific and common names
function renderActiveFilters(selected) {
  var container = document.getElementById(PASTA_CONFIG.activeFiltersId);
  if (!container) return;
  var tags = [];
  selected.creators.forEach(function(creator) {
    tags.push(`<span class="filter-tag">${creator} <button class="remove-filter" data-type="creator" data-value="${encodeURIComponent(creator)}" title="Remove filter">×</button></span>`);
  });
  selected.keywords.forEach(function(keyword) {
    tags.push(`<span class="filter-tag">${keyword} <button class="remove-filter" data-type="keyword" data-value="${encodeURIComponent(keyword)}" title="Remove filter">×</button></span>`);
  });
  selected.projects.forEach(function(project) {
    tags.push(`<span class="filter-tag">${project} <button class="remove-filter" data-type="project" data-value="${encodeURIComponent(project)}" title="Remove filter">×</button></span>`);
  });
  selected.locations.forEach(function(location) {
    tags.push(`<span class="filter-tag">${location} <button class="remove-filter" data-type="location" data-value="${encodeURIComponent(location)}" title="Remove filter">×</button></span>`);
  });
  // Add tags for scientific names
  selected.taxa.forEach(function(taxon) {
    tags.push(`<span class="filter-tag">${taxon} <button class="remove-filter" data-type="taxa" data-value="${encodeURIComponent(taxon)}" title="Remove filter">×</button></span>`);
  });
  // Add tags for common names
  selected.commonNames.forEach(function(commonName) {
    tags.push(`<span class="filter-tag">${commonName} <button class="remove-filter" data-type="commonNames" data-value="${encodeURIComponent(commonName)}" title="Remove filter">×</button></span>`);
  });
  var clearBtn = (tags.length > 0)
    ? '<span id="clear-all-filters" class="clear-all-filters-link">Clear all filters</span>'
    : '';
  container.innerHTML = tags.join(' ') + ' ' + clearBtn;
}

function uncheckFacet(facetType, value) {
  var selector =
    facetType === 'creator' ? '.creator-checkbox' :
    facetType === 'keyword' ? '.keyword-checkbox' :
    facetType === 'project' ? '.project-checkbox' :
    facetType === 'location' ? '.location-checkbox' :
    facetType === 'taxa' ? '.taxon-checkbox' :
    '.commonname-checkbox';
  var boxes = document.querySelectorAll(selector);
  boxes.forEach(function(box) {
    if (box.value === value) box.checked = false;
  });
}

function clearAllFacets() {
  var selectors = [
    '.creator-checkbox',
    '.keyword-checkbox',
    '.project-checkbox',
    '.location-checkbox',
    '.taxon-checkbox',
    '.commonname-checkbox'
  ];
  selectors.forEach(function(selector) {
    var boxes = document.querySelectorAll(selector);
    boxes.forEach(function(box) { box.checked = false; });
  });
  focusTopOfPage(); // Ensure top-of-page focus after clearing filters
}

// Move processFacetChange to top-level scope so it can be called from anywhere
function processFacetChange() {
  var selectedCreators = getSelectedCreators();
  var selectedKeywords = getSelectedKeywords();
  var selectedProjects = getSelectedProjects();
  var selectedLocations = getSelectedLocations();
  var selectedTaxa = getSelectedTaxa();
  var selectedCommonNames = getSelectedCommonNames();
  var filteredDocs = filterDocsByCreators(ALL_PASTA_DOCS, selectedCreators || []);
  filteredDocs = filterDocsByKeywords(filteredDocs, selectedKeywords || []);
  filteredDocs = filterDocsByProjects(filteredDocs, selectedProjects || []);
  filteredDocs = filterDocsByLocations(filteredDocs, selectedLocations || []);
  filteredDocs = filterDocsByTaxa(filteredDocs, selectedTaxa || []);
  filteredDocs = filterDocsByCommonNames(filteredDocs, selectedCommonNames || []);
  populateCreatorFacetOptions(filteredDocs, selectedCreators);
  populateKeywordFacetOptions(filteredDocs, selectedKeywords);
  populateProjectFacetOptions(filteredDocs, selectedProjects);
  populateLocationFacetOptions(filteredDocs, selectedLocations);
  populateTaxonFacetOptions(filteredDocs, selectedTaxa);
  populateCommonNameFacetOptions(filteredDocs, selectedCommonNames);
  renderActiveFilters({
    creators: selectedCreators,
    keywords: selectedKeywords,
    projects: selectedProjects,
    locations: selectedLocations,
    taxa: selectedTaxa,
    commonNames: selectedCommonNames
  });
  // Update dataset list immediately
  if (typeof renderResults === 'function') {
    renderResults(filteredDocs);
  } else {
    buildCitationsFromCite(filteredDocs);
  }
  var count = filteredDocs.length;
  updateElementHtml(PASTA_CONFIG["csvElementId"], '');
  var currentStart = 0;
  var limit = parseInt(PASTA_CONFIG["limit"]);
  var showPages = parseInt(PASTA_CONFIG["showPages"]);
  var pageTopElementId = PASTA_CONFIG["pagesTopElementId"];
  var pageBotElementId = PASTA_CONFIG["pagesBotElementId"];
  var query = getParameterByName("q");
  showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);

  // --- Map update wiring ---
  // If map tab is visible, update map with filtered docs
  var mapTab = document.getElementById('map-tab');
  var mapContainer = document.getElementById('map-container');
  if (mapTab && mapContainer && mapTab.style.display !== 'none') {
    var tempXmlDoc = document.implementation.createDocument('', 'resultset', null);
    filteredDocs.forEach(function(doc) {
      tempXmlDoc.documentElement.appendChild(doc.cloneNode(true));
    });
    var geojson = emlXmlToGeoJSON(tempXmlDoc);
    window.geojson = geojson; // Expose for debugging
    renderMapData(geojson);
  }
}

// Hook: When map tab is activated, enable drawing and handle filter
function onMapTabActivated() {
    enableMapDrawing(window.leafletMap, function(drawnGeojson) {
        var featuresInShape = [];
        if (window.geojson && window.geojson.features) {
            var drawnLayer = L.geoJSON(drawnGeojson);
            var drawnBounds = drawnLayer.getBounds();
            window.geojson.features.forEach(function(feature) {
                var featureLayer = L.geoJSON(feature);
                var featureBounds = featureLayer.getBounds();
                if (drawnBounds.contains(featureBounds)) {
                    featuresInShape.push(feature);
                }
            });
        }
        var descriptions = featuresInShape.map(function(feature) {
            return feature.properties && feature.properties.description ? feature.properties.description : null;
        }).filter(Boolean);
        // Update location facet filter with selected descriptions
        var locationDropdown = document.getElementById(PASTA_CONFIG.locationDropdownId);
        if (locationDropdown) {
            // Uncheck all first
            locationDropdown.querySelectorAll('.location-checkbox').forEach(function(box) {
                box.checked = false;
            });
            // Check only those matching selected descriptions
            locationDropdown.querySelectorAll('.location-checkbox').forEach(function(box) {
                if (descriptions.includes(box.value)) {
                    box.checked = true;
                }
            });
        }
        // Trigger facet update
        processFacetChange();
    });
}

// Utility to get logo alt text from config
function getLogoAltText() {
    if (typeof PASTA_CONFIG.logoAltText === 'string' && PASTA_CONFIG.logoAltText.trim().length > 0) {
        return PASTA_CONFIG.logoAltText;
    }
    return "ezCatalog logo.";
}

// Helper to initialise a dropdown (toggle + blur collapse)
function initDropdown(toggleId, dropdownId, arrowId) {
  const toggleBtn = document.getElementById(toggleId);
  const dropdown = document.getElementById(dropdownId);
  const arrow = document.getElementById(arrowId);
  if (!toggleBtn || !dropdown || !arrow) return;

  let expanded = false;
  toggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    expanded = !expanded;
    dropdown.style.display = expanded ? 'block' : 'none';
    arrow.innerHTML = expanded ? '\u25B2' : '\u25BC';
    if (expanded) dropdown.focus();
  });

  dropdown.addEventListener('blur', function() {
    setTimeout(function() {
      if (!dropdown.contains(document.activeElement)) {
        expanded = false;
        dropdown.style.display = 'none';
        arrow.innerHTML = '\u25BC';
      }
    }, 150);
  });
}

// --- Helper functions for initData refactor ---
async function fetchPackageIds() {
  const scope = PASTA_CONFIG.scope || 'edi';
  const filter = PASTA_CONFIG.filter || '';
  return await fetchDataPackageIdentifiers(scope, filter);
}

async function buildAndPostRidarePayload(pids) {
  const payload = buildRidarePayload(pids);
  return await postToRidareEndpoint(payload);
}

function updateDomWithDocs(response) {
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(response, "text/xml");
  xmlDoc = reformatXMLDocument(xmlDoc);
  var docs = Array.from(xmlDoc.getElementsByTagName("document"));
  ALL_PASTA_DOCS = docs;
  populateCreatorFacetOptions(docs, []);
  populateKeywordFacetOptions(docs, []);
  populateProjectFacetOptions(docs, []);
  populateLocationFacetOptions(docs, []);
  populateTaxonFacetOptions(docs, []);
  populateCommonNameFacetOptions(docs, []);
  buildCitationsFromCite(docs);
}

// Main initialization split into focused functions
async function initData() {
  // Guard: Wait for loading-div to exist before proceeding
  if (!document.getElementById(PASTA_CONFIG.loadingDivId)) {
    setTimeout(initData, 50);
    return;
  }
  showLoading(true);
  try {
    const pids = await fetchPackageIds();
    const response = await buildAndPostRidarePayload(pids);
    updateDomWithDocs(response);
    focusTopOfPage(); // Ensure top-of-page focus after catalogue refresh
  } catch (err) {
    console.error('Error initializing data:', err);
    errorCallback(err);
  }
}

function initDropdowns() {
  initDropdown('creator-toggle-btn', 'creator-dropdown', 'creator-arrow');
  initDropdown('keyword-toggle-btn', 'keyword-dropdown', 'keyword-arrow');
  initDropdown('project-toggle-btn', 'project-dropdown', 'project-arrow');
  initDropdown('location-toggle-btn', 'location-dropdown', 'location-arrow');
}

function bindFacetEvents() {
  [
    'creator-checkbox',
    'keyword-checkbox',
    'project-checkbox',
    'location-checkbox',
    'taxon-checkbox',
    'commonname-checkbox'
  ].forEach(function(className) {
    document.querySelectorAll('.' + className).forEach(function(box) {
      box.addEventListener('change', processFacetChange);
    });
  });
}

function bindFilterEvents() {
  document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-filter')) {
      e.preventDefault();
      e.stopPropagation();
      var type = e.target.getAttribute('data-type');
      var value = decodeURIComponent(e.target.getAttribute('data-value'));
      uncheckFacet(type, value);
      processFacetChange();
    }
    if (e.target.id === 'clear-all-filters') {
      e.preventDefault();
      clearAllFacets();
      processFacetChange();
    }
  });
}

// Branding text for banner bar
function setBrandingText() {
  if (!PASTA_CONFIG.showBanner) {
    var brandingSpan = document.getElementById(PASTA_CONFIG.brandingTextId);
    if (brandingSpan) brandingSpan.style.display = "none";
    return;
  }
  var brandingText = PASTA_CONFIG.brandingText;
  var brandingSpan = document.getElementById(PASTA_CONFIG.brandingTextId);
  if (brandingSpan) {
    // Render as semantic <h1> for accessibility
    brandingSpan.innerHTML = `<h1 style='display:inline; font-size:2rem; margin-left:10px; vertical-align:middle;'>${brandingText}</h1>`;
  }
}

// Focus top of page
function focusTopOfPage() {
  var topEl = document.getElementById('branding-text') || document.body;
  if (topEl && typeof topEl.focus === 'function') {
    topEl.focus();
  } else {
    window.scrollTo(0, 0);
  }
}

// Refactored DOMContentLoaded

document.addEventListener("DOMContentLoaded", function() {
  var bannerBar = document.querySelector('.banner-bar');
  if (PASTA_CONFIG.showBanner) {
    if (bannerBar) bannerBar.style.display = '';
    document.body.classList.remove('no-banner');
  } else {
    if (bannerBar) bannerBar.style.display = 'none';
    document.body.classList.add('no-banner');
  }
  const mapTabBtn = document.getElementById('map-tab-btn');
  if (PASTA_CONFIG.hideMapView && mapTabBtn) {
    mapTabBtn.style.display = 'none';
  }
  // Only call loadRelatedStories, which will call initData after related stories are loaded
  initDropdowns();
  bindFacetEvents();
  bindFilterEvents();
  setBrandingText();
  focusTopOfPage(); // Ensure top-of-page focus after load
  loadRelatedStories(function() {
    initData();
  });
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchDataPackageIdentifiers,
        buildRidarePayload,
        postToRidareEndpoint,
        reformatXMLDocument,
        initData,
        setBrandingText
    };
}

// Ensure initData is called only after related stories are loaded
function loadRelatedStories(callback) {
    fetch('related_content.csv')
        .then(response => response.text())
        .then(csvText => {
            const rows = csvText.split('\n').slice(1); // Skip header row
            const relatedStories = new Set();
            rows.forEach(row => {
                const columns = row.split(',');
                if (columns.length > 0) {
                    const packageId = columns[0].trim();
                    if (packageId) {
                        relatedStories.add(packageId);
                    }
                }
            });
            window.relatedStories = Array.from(relatedStories); // Store as array in global scope
            if (callback) callback();
        })
        .catch(error => {
            console.error('Error loading related stories:', error);
            if (callback) callback();
        });
}

// Preload related stories and then initialize the catalog
loadRelatedStories(function() {
    initData();
});

// Overlay logic for enlarged thumbnails
function enlargeThumbnail(imgSrc) {
   // Remove any existing overlay
   var existing = document.getElementById('thumb-overlay');
   if (existing) existing.remove();
   // Create overlay
   var overlay = document.createElement('div');
   overlay.id = 'thumb-overlay';
   overlay.className = 'thumb-overlay';
   overlay.innerHTML = `
     <div class='thumb-overlay-content'>
       <button class='thumb-overlay-close' aria-label='Close enlarged image' onclick='closeThumbOverlay()'>&times;</button>
       <img src='${imgSrc}' alt='Enlarged dataset thumbnail' class='thumb-overlay-img' />
     </div>
   `;
   document.body.appendChild(overlay);
   // Trap focus on close button
   var closeBtn = overlay.querySelector('.thumb-overlay-close');
   if (closeBtn) closeBtn.focus();
   // Close on ESC
   overlay.addEventListener('keydown', function(e) {
     if (e.key === 'Escape') closeThumbOverlay();
   });
   overlay.tabIndex = -1;
   overlay.focus();
}
function closeThumbOverlay() {
   var overlay = document.getElementById('thumb-overlay');
   if (overlay) overlay.remove();
}

