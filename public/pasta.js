// Requires cors.js and pagination.js to be loaded first

"use strict";

const PASTA_CONFIG = {
   "server": "https://pasta.lternet.edu/package/search/eml?", // PASTA server
   "filter": '&fq=scope:cos-spu', // Filter results on a unique keyword of a research group
   "resultsElementId": "searchResults", // Element to contain results
   "urlElementId": "searchUrl", // Element to display search URL. Use "searchUrl" to display or "" to remove FIXME: Empty string does not turn off.
   "countElementId": "resultCount", // Element showing number of results
   "csvElementId": "csvDownload", // Element with link to download results as CSV
   "pagesTopElementId": "paginationTop", // Element to display result page links above results
   "pagesBotElementId": "paginationBot", // Element to display result page links below results
   "showPages": 5, // MUST BE ODD NUMBER! Max number of page links to show
   "showAbstracts": true, // true if we should show abstracts in search results
   "abstractLimit": 750 // Limit the number of characters in the abstract
};

// This feature is deprecated. Please do not functionally depend on it.
PASTA_CONFIG.limit = 2000;  // Max number of results to retrieve per page

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
   return `<div class='dataset-title'><strong>${title}</strong></div>`;
}
function imgHtml(pkgid) {
   const imgBase = pkgid.split(".").slice(0,2).join(".");
   const imgSrc = `images/${imgBase}.png`;
   return `<div class='dataset-thumb-container'><img class='dataset-thumb' src='${imgSrc}' alt='' onerror="this.style.display='none'"></div>`;
}
function exploreLink(link) {
   return `<a class='explore-link' href='${link}' target='_blank' rel='noopener noreferrer'>Explore Data <i class='fas fa-external-link-alt' style='margin-left:6px;font-size:0.98em;vertical-align:middle;'></i></a>`;
}
function relatedStoriesLink(pkgid, title) {
   const pkgidNoRev = pkgid.split('.').slice(0,2).join('.');
   const encodedTitle = encodeURIComponent(title);
   return `<a class='explore-link' href='related_stories.html?package_id=${pkgidNoRev}&title=${encodedTitle}' rel='noopener noreferrer' style='margin-left:18px;'>Related Stories <i class='fas fa-book-open' style='margin-left:6px;font-size:0.98em;vertical-align:middle;'></i></a>`;
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
      const authors = citation.authors;
      const date = citation.pub_year ? ` Published ${citation.pub_year}` : "";
      const link = citation.doi ? citation.doi.slice(0, -1) : `https://portal.edirepository.org/nis/mapbrowse?packageid=${citation.pid}`;
      const row = `<div class='dataset-row'><div class='dataset-info'>${titleHtml(citation.title)}${authorHtml(authors, date)}${PASTA_CONFIG.showAbstracts ? abstractHtml(abstract) : ""}<div class='dataset-actions'>${exploreLink(link)}${relatedStoriesLink(citation.pid, citation.title)}</div></div>${imgHtml(citation.pid)}</div>`;
      html.push(row);
   }
   return citationCount ? html.join("\n") : "<p>Your search returned no results.</p>";
}

// Download citations to a dictionary keyed by package ID
function getCitations(packageIds, abstracts) {
   var header = {
      "Accept": "application/json"
   };
   var baseUri = "https://cite.edirepository.org/cite/";
   var citations = {};
   var callsRemaining = packageIds.length;
   const MAX_RETRIES = 5;
   const BASE_DELAY = 200; // ms

   function isTransientError(status) {
      return status === 429 || status === 503 || status === 0; // 0 for network error
   }

   function processNext(index, attempt = 0) {
      if (index >= packageIds.length) return;
      var pid = packageIds[index];
      var uri = baseUri + pid;
      makeCorsRequest(
         uri,
         header,
         function (headers, response) {
            var citation = JSON.parse(response);
            citation["pid"] = packageIds[index];
            citations[index] = citation;
            --callsRemaining;
            if (callsRemaining <= 0) {
               var html = buildHtml(citations, abstracts);
               document.getElementById("searchResults").innerHTML = html;
               showLoading(false);
               // Show result count after all CITE calls are done and results are rendered
               var count = Object.keys(citations).length;
               var currentStart = 0;
               var limit = parseInt(PASTA_CONFIG["limit"]);
               var query = getParameterByName("q");
               showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
            } else {
               setTimeout(function() {
                  processNext(index + 1);
               }, BASE_DELAY); // Small delay between successful requests
            }
         },
         function (status, error) {
            if (isTransientError(status) && attempt < MAX_RETRIES) {
               // Exponential backoff with jitter
               var delay = Math.floor(BASE_DELAY * Math.pow(2, attempt) + Math.random() * 100);
               setTimeout(function() {
                  processNext(index, attempt + 1);
               }, delay);
            } else {
               // On permanent error or max retries, log and continue
               citations[index] = { pid: packageIds[index], error: error || "Request failed" };
               --callsRemaining;
               if (callsRemaining <= 0) {
                  var html = buildHtml(citations, abstracts);
                  document.getElementById("searchResults").innerHTML = html;
                  showLoading(false);
                  // Show result count after all CITE calls are done and results are rendered
                  var count = Object.keys(citations).length;
                  var currentStart = 0;
                  var limit = parseInt(PASTA_CONFIG["limit"]);
                  var query = getParameterByName("q");
                  showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
               } else {
                  setTimeout(function() {
                     processNext(index + 1);
                  }, BASE_DELAY);
               }
            }
         }
      );
   }
   if (packageIds.length > 0) {
      showLoading(true);
      processNext(0);
   }
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
      // Extract authors from <authors> node
      var authorsNode = doc.getElementsByTagName && doc.getElementsByTagName("authors")[0];
      var authors = "";
      if (authorsNode) {
         var authorElems = authorsNode.getElementsByTagName("author");
         authors = Array.from(authorElems).map(function(n) { return n.textContent; }).join(", ");
      }
      var packageid = packageidNode && packageidNode.childNodes.length > 0 ? packageidNode.childNodes[0].nodeValue : doc.packageid || "";
      var abstract = abstractNode && abstractNode.childNodes.length > 0 ? abstractNode.childNodes[0].nodeValue : doc.abstract || "";
      var title = titleNode && titleNode.childNodes.length > 0 ? titleNode.childNodes[0].nodeValue : doc.title || "";
      var pub_year = pubYearNode && pubYearNode.childNodes.length > 0 ? pubYearNode.childNodes[0].nodeValue : doc.pub_year || "";
      var doi = doiNode && doiNode.childNodes.length > 0 ? doiNode.childNodes[0].nodeValue : doc.doi || "";
      citations[i] = {
         pid: packageid,
         title: title,
         authors: authors,
         pub_year: pub_year,
         doi: doi
      };
      abstracts.push(abstract);
   }
   var html = Object.keys(citations).length ? buildHtml(citations, abstracts) : "<p>Your search returned no results.</p>";
   document.getElementById("searchResults").innerHTML = html;
   showLoading(false);
   var count = Object.keys(citations).length;
   var currentStart = 0;
   var limit = parseInt(PASTA_CONFIG["limit"]);
   var query = getParameterByName("q");
   showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
}

function showLoading(isLoading) {
   var x = document.getElementById("loading-div");
   if (isLoading) {
      document.body.style.cursor = "wait";
      x.style.display = "block";
   } else {
      document.body.style.cursor = "default";
      x.style.display = "none";
   }
}

function setHtml(elId, innerHtml) {
   var el = document.getElementById(elId);
   if (el)
      el.innerHTML = innerHtml;
}

// Function to call if CORS request is successful
function successCallback(headers, response) {
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
   setHtml(PASTA_CONFIG["csvElementId"], makeCsvLink(count));

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
   showPageLinks(count, limit, showPages, currentStart, pageTopElementId);
   showPageLinks(count, limit, showPages, currentStart, pageBotElementId);
   var query = getParameterByName("q");
   // Moved showResultCount here to ensure it runs after all CITE calls are complete
   showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
}

// Function to call if CORS request fails
function errorCallback() {
   showLoading(false);
   alert("There was an error making the request.");
}

// Writes CORS request URL to the page so user can see it
function showUrl(url) {
   var txt = '<a href="' + url + '" target="_blank">' + url + '</a>';
   setHtml(PASTA_CONFIG["urlElementId"], txt);
}

// --- Faceted Creator Dropdown Logic ---
// Store all results for client-side filtering
var ALL_PASTA_DOCS = [];

function renderCreatorCheckboxes(creators, selected, creatorCounts) {
  return creators.map(function(creator, i) {
    var checked = selected.includes(creator) ? 'checked' : '';
    var count = creatorCounts[creator] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="creator-checkbox" value="${creator.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${creator} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedCreators() {
  var boxes = document.querySelectorAll('.creator-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateCreatorFacetOptions(docs, selected) {
   var personnelSet = new Set();
   var personnelCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var personnelNodes = docs[i].getElementsByTagName("author");
      var uniquePersonnel = new Set();
      for (var j = 0; j < personnelNodes.length; j++) {
         var person = personnelNodes[j].innerHTML;
         if (person) {
            uniquePersonnel.add(person);
         }
      }
      uniquePersonnel.forEach(function(person) {
         personnelSet.add(person);
         personnelCounts[person] = (personnelCounts[person] || 0) + 1;
      });
   }
   var creatorDropdown = document.getElementById("creator-dropdown");
   var personnel = Array.from(personnelSet).sort();
   creatorDropdown.innerHTML = renderCreatorCheckboxes(personnel, selected || [], personnelCounts);
   bindFacetEvents(); // Ensure listeners are attached after rendering
}

function filterDocsByCreators(docs, selectedPersonnel) {
   if (!selectedPersonnel.length) return docs;
   return docs.filter(function(doc) {
      var personnelNodes = doc.getElementsByTagName("author");
      var personnel = Array.from(personnelNodes).map(function(n) { return n.innerHTML; });
      return selectedPersonnel.some(function(sel) { return personnel.includes(sel); });
   });
}

// --- Faceted Keyword Dropdown Logic ---
function renderKeywordCheckboxes(keywords, selected, keywordCounts) {
  return keywords.map(function(keyword, i) {
    var checked = selected.includes(keyword) ? 'checked' : '';
    var count = keywordCounts[keyword] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="keyword-checkbox" value="${keyword.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${keyword} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedKeywords() {
  var boxes = document.querySelectorAll('.keyword-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateKeywordFacetOptions(docs, selected) {
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
   var keywordDropdown = document.getElementById("keyword-dropdown");
   var keywords = Array.from(keywordSet).sort();
   keywordDropdown.innerHTML = renderKeywordCheckboxes(keywords, selected || [], keywordCounts);
   bindFacetEvents(); // Ensure listeners are attached after rendering
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
function renderProjectCheckboxes(projects, selected, projectCounts) {
  return projects.map(function(project, i) {
    var checked = selected.includes(project) ? 'checked' : '';
    var count = projectCounts[project] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="project-checkbox" value="${project.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${project} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedProjects() {
  var boxes = document.querySelectorAll('.project-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateProjectFacetOptions(docs, selected) {
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
   var projectDropdown = document.getElementById("project-dropdown");
   var projects = Array.from(projectSet).sort();
   projectDropdown.innerHTML = renderProjectCheckboxes(projects, selected || [], projectCounts);
   bindFacetEvents(); // Ensure listeners are attached after rendering
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
function renderLocationCheckboxes(locations, selected, locationCounts) {
  return locations.map(function(location, i) {
    var checked = selected.includes(location) ? 'checked' : '';
    var count = locationCounts[location] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="location-checkbox" value="${location.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${location} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedLocations() {
  var boxes = document.querySelectorAll('.location-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateLocationFacetOptions(docs, selected) {
   var locationSet = new Set();
   var locationCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var geoDescsElem = docs[i].getElementsByTagName("geographicDescriptions")[0];
      var uniqueLocations = new Set();
      if (geoDescsElem) {
         var geoDescNodes = geoDescsElem.getElementsByTagName("geographicDescription");
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
   var locationDropdown = document.getElementById("location-dropdown");
   var locations = Array.from(locationSet).sort();
   locationDropdown.innerHTML = renderLocationCheckboxes(locations, selected || [], locationCounts);
   bindFacetEvents(); // Ensure listeners are attached after rendering
}

function filterDocsByLocations(docs, selectedLocations) {
   if (!selectedLocations.length) return docs;
   return docs.filter(function(doc) {
      // Use <geographicDescription> children of <geographicDescriptions> for filtering
      var geoDescsElem = doc.getElementsByTagName("projectTitles")[0];
      var locations = [];
      if (geoDescsElem) {
         var geoDescNodes = geoDescsElem.getElementsByTagName("geographicDescription");
         for (var j = 0; j < geoDescNodes.length; j++) {
            locations.push(geoDescNodes[j].innerHTML);
         }
      }
      return selectedLocations.some(function(sel) { return locations.includes(sel); });
   });
}

// --- Faceted Taxon Dropdown Logic ---
function renderTaxonCheckboxes(taxa, selected, taxonCounts) {
  return taxa.map(function(taxon, i) {
    var checked = selected.includes(taxon) ? 'checked' : '';
    var count = taxonCounts[taxon] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="taxon-checkbox" value="${taxon.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${taxon} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedTaxa() {
  var boxes = document.querySelectorAll('.taxon-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateTaxonFacetOptions(docs, selected) {
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
   var taxonDropdown = document.getElementById("taxonRankValue-dropdown");
   var taxa = Array.from(taxonSet).sort();
   if (taxa.length === 0) {
     taxonDropdown.innerHTML = '<span style="color:#888;">No scientific names found in data.</span>';
   } else {
     taxonDropdown.innerHTML = renderTaxonCheckboxes(taxa, selected || [], taxonCounts);
     bindFacetEvents(); // Ensure listeners are attached after rendering
   }
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
function renderCommonNameCheckboxes(commonNames, selected, commonNameCounts) {
  return commonNames.map(function(commonName, i) {
    var checked = selected.includes(commonName) ? 'checked' : '';
    var count = commonNameCounts[commonName] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="commonname-checkbox" value="${commonName.replace(/&/g,'&amp;').replace(/\"/g,'&quot;')}" ${checked} style="margin-right:8px;">${commonName} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

function getSelectedCommonNames() {
  var boxes = document.querySelectorAll('.commonname-checkbox:checked');
  return Array.from(boxes).map(function(box) { return box.value; });
}

function populateCommonNameFacetOptions(docs, selected) {
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
   var commonNameDropdown = document.getElementById("commonName-dropdown");
   var commonNames = Array.from(commonNameSet).sort();
   if (commonNames.length === 0) {
     commonNameDropdown.innerHTML = '<span style="color:#888;">No common names found in data.</span>';
   } else {
     commonNameDropdown.innerHTML = renderCommonNameCheckboxes(commonNames, selected || [], commonNameCounts);
     bindFacetEvents(); // Ensure listeners are attached after rendering
   }
}

function filterDocsByCommonNames(docs, selectedCommonNames) {
   if (!selectedCommonNames.length) return docs;
   return docs.filter(function(doc) {
      var commonNameNodes = doc.getElementsByTagName("commonName");
      var commonNames = Array.from(commonNameNodes).map(function(n) { return n.textContent.trim(); });
      return selectedCommonNames.some(function(sel) { return commonNames.includes(sel); });
   });
}

// --- Faceted Generic Logic ---
/**
 * Generic facet checkbox renderer
 */
function renderFacetCheckboxes(items, selected, counts, className) {
  return items.map(function(item) {
    const checked = selected.includes(item) ? 'checked' : '';
    const count = counts[item] || 0;
    return `<label style="display:flex;align-items:center;padding:2px 12px 2px 8px;cursor:pointer;font-size:0.98em;">
      <input type="checkbox" class="${className}" value="${item.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" ${checked} style="margin-right:8px;">${item} <span style='color:#888;font-size:0.95em;margin-left:6px;'">(${count})</span>
    </label>`;
  }).join('');
}

/**
 * Generic facet option populator
 */
function populateFacetOptions(docs, tagName, dropdownId, selected, className) {
   const set = new Set();
   const counts = {};
   for (let i = 0; i < docs.length; i++) {
      const nodes = docs[i].getElementsByTagName(tagName);
      for (let j = 0; j < nodes.length; j++) {
         const value = nodes[j].innerHTML.trim();
         if (value) {
            set.add(value);
            counts[value] = (counts[value] || 0) + 1;
         }
      }
   }
   const dropdown = document.getElementById(dropdownId);
   const items = Array.from(set).sort();
   dropdown.innerHTML = renderFacetCheckboxes(items, selected || [], counts, className);
}

/**
 * Generic facet filter
 */
function filterDocsByFacet(docs, tagName, selected) {
   if (!selected.length) return docs;
   return docs.filter(function(doc) {
      const nodes = doc.getElementsByTagName(tagName);
      const values = Array.from(nodes).map(n => n.innerHTML.trim());
      return selected.some(sel => values.includes(sel));
   });
}

// Patch successCallback to store all docs and update creator, keyword, projects, location, taxon, and common name facets
var origSuccessCallback = successCallback;
successCallback = function(headers, response) {
   var parser = new DOMParser();
   var xmlDoc = parser.parseFromString(response, "text/xml");
   var docs = Array.from(xmlDoc.getElementsByTagName("doc"));
   window.allDocs = docs;
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
  var container = document.getElementById('active-filters');
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
  setHtml(PASTA_CONFIG["csvElementId"], '');
  var currentStart = 0;
  var limit = parseInt(PASTA_CONFIG["limit"]);
  var showPages = parseInt(PASTA_CONFIG["showPages"]);
  var pageTopElementId = PASTA_CONFIG["pagesTopElementId"];
  var pageBotElementId = PASTA_CONFIG["pagesBotElementId"];
  showPageLinks(count, limit, showPages, currentStart, pageTopElementId);
  showPageLinks(count, limit, showPages, currentStart, pageBotElementId);
  var query = getParameterByName("q");
  showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
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

// Helper to initialise facet change listeners
function initFacetChangeListener(dropdownId, checkboxClass) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.addEventListener('change', function(e) {
      if (e.target.classList.contains(checkboxClass)) {
        processFacetChange();
      }
    });
  }
}

// Main initialization split into focused functions
async function initData() {
  showLoading(true);
  try {
    // Step 1: Get package IDs from PASTA
    const scope = PASTA_CONFIG.scope || 'edi'; // Adjust as needed
    const filter = PASTA_CONFIG.filter || '';
    const pids = await fetchDataPackageIdentifiers(scope, filter);
    // Step 2: Build Ridare payload
    const payload = buildRidarePayload(pids);
    // Step 3: POST to Ridare endpoint and get XML response
    const response = await postToRidareEndpoint(payload);
    // Step 4: Parse returned XML
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(response, "text/xml");
    // Apply XML reformatting
    xmlDoc = reformatXMLDocument(xmlDoc);
    var docs = Array.from(xmlDoc.getElementsByTagName("document"));
    ALL_PASTA_DOCS = docs;
    // Step 5: Pass to facet population and filtering functions
    populateCreatorFacetOptions(docs, []);
    populateKeywordFacetOptions(docs, []);
    populateProjectFacetOptions(docs, []);
    populateLocationFacetOptions(docs, []);
    populateTaxonFacetOptions(docs, []);
    populateCommonNameFacetOptions(docs, []);
    buildCitationsFromCite(docs);
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
  var brandingText = "Seattle Public Utilities Data Catalog"; // <-- Set this to your desired branding text
  var brandingSpan = document.getElementById('branding-text');
  if (brandingSpan) brandingSpan.textContent = brandingText;
}

// Refactored DOMContentLoaded

document.addEventListener("DOMContentLoaded", function() {
  initData();
  initDropdowns();
  bindFacetEvents();
  bindFilterEvents();
  setBrandingText();
});

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = { fetchDataPackageIdentifiers };
}
