// Requires cors.js and pagination.js to be loaded first

"use strict";

var PASTA_CONFIG = {
   "server": "https://pasta.lternet.edu/package/search/eml?", // PASTA server
   "filter": '&fq=scope:cos-spu', // Filter results on a unique keyword of a research group
   "limit": 20, // Max number of results to retrieve per page
   "resultsElementId": "searchResults", // Element to contain results
   "urlElementId": "searchUrl", // Element to display search URL. Use "searchUrl" to display or "" to remove FIXME: Empty string does not turn off.
   "countElementId": "resultCount", // Element showing number of results
   "csvElementId": "csvDownload", // Element with link to download results as CSV
   "pagesTopElementId": "paginationTop", // Element to display result page links above results
   "pagesBotElementId": "paginationBot", // Element to display result page links below results
   "showPages": 5, // MUST BE ODD NUMBER! Max number of page links to show
   "sortDiv": "sortDiv", // Element with interactive sort options
   "useCiteService": true, // true if we should use EDI Cite service to build citations instead of building from PASTA results,
   "showAbstracts": true, // true if we should show abstracts in search results
   "abstractLimit": 500 // Limit the number of characters in the abstract
};

// --- Legacy server-driven search and pagination logic removed for client-side faceted search migration ---

// Get URL arguments
function getParameterByName(name, url) {
   if (!url) url = window.location.href;
   name = name.replace(/[\[\]]/g, "\\$&");
   var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
   if (!results) return null;
   if (!results[2]) return "";
   return decodeURIComponent(results[2].replace(/\+/g, " ")).trim();
}

// Parse citation dictionary into HTML
function buildHtml(citations, abstracts) {
   var html = [];
   var citationCount = Object.keys(citations).length;

   for (var i = 0; i < citationCount; i++) {
      var citation = citations[i];
      var abstract = abstracts[i];
      if (abstract.length > PASTA_CONFIG["abstractLimit"]) {
         abstract = abstract.substring(0, PASTA_CONFIG["abstractLimit"]) + "...";
      }
      var authors = citation["authors"];
      var date = (citation["pub_year"]) ? " Published " + citation["pub_year"] + "" : "";
      // default ESIP formatting has trailing period after DOI
      var link = (citation["doi"]) ? citation["doi"].slice(0, -1) : "https://portal.edirepository.org/nis/mapbrowse?packageid=" + citation["pid"];
      var title = '<a rel="external noopener" href="' + link + '" target="_blank" aria-label="open data in new tab">' + citation["title"] + '</a>';
      if (PASTA_CONFIG["showAbstracts"]) {
         var row = '<p><span class="dataset-title">' + title +
            '</span><br><span class="dataset-author">' + authors + date +
            '</span><br>' + abstract + '</p>';
      } else {
         var row = '<p><span class="dataset-title">' + title +
            '</span><br><span class="dataset-author">' + authors + date +
            '</span></p>';
      }
      html.push(row);
   }
   if (citationCount) {
      return html.join("\n");
   } else {
      return "<p>Your search returned no results.</p>";
   }
}

// Download citations to a dictionary keyed by package ID
function getCitations(packageIds, abstracts) {
   var header = {
      "Accept": "application/json"
   };
   var callsRemaining = packageIds.length;
   var baseUri = "https://cite.edirepository.org/cite/";
   var citations = {};

   packageIds.forEach(function (pid, index) {
      var uri = baseUri + pid;
      makeCorsRequest(
         uri,
         header,
         (function (index) { // enable the callback to know which package this is
            return function (headers, response) {
               var citation = JSON.parse(response);
               citation["pid"] = packageIds[index];
               citations[index] = citation;

               --callsRemaining;
               if (callsRemaining <= 0) {
                  var html = buildHtml(citations, abstracts);
                  document.getElementById("searchResults").innerHTML = html;
                  showLoading(false);
               }
            };
         })(index), // immediately call the closure with the current index value
         errorCallback
      );
   });
}

// Build dataset citations using Cite service, with package IDs from PASTA
function buildCitationsFromCite(pastaDocs) {
   var packageIds = [];
   var abstracts = [];
   for (var i = 0; i < pastaDocs.length; i++) {
      var doc = pastaDocs[i];
      packageIds.push(doc.getElementsByTagName("packageid")[0].childNodes[0].nodeValue);
      abstracts.push(doc.getElementsByTagName("abstract")[0].childNodes[0].nodeValue);
   }
   if (packageIds.length) {
      getCitations(packageIds, abstracts);
   } else {
      document.getElementById("searchResults").innerHTML = "<p>Your search returned no results.</p>";
      showLoading(false);
   }
}

// Build dataset citations from PASTA XML
function buildCitationsFromPasta(pastaDocs) {
   var html = [];
   for (var i = 0; i < pastaDocs.length; i++) {
      var doc = pastaDocs[i];
      var authorNodes = doc.getElementsByTagName("author");
      var authors = [];
      for (var authorIndex = 0; authorIndex < authorNodes.length; authorIndex++) {
         authors.push(authorNodes[authorIndex].innerHTML);
      }

      var names = authors.join("; ");
      var date;
      try {
         date = " (Published " + doc.getElementsByTagName("pubdate")[0].childNodes[0].nodeValue + ")";
      } catch (error) {
         date = "";
      }
      var link = "";
      try {
         var doi = doc.getElementsByTagName("doi")[0].childNodes[0].nodeValue;
         if (doi.slice(0, 4) === "doi:") {
            doi = doi.slice(4);
         }
         link = "http://dx.doi.org/" + doi;
      } catch (err) {
         link = ("https://portal.edirepository.org/nis/mapbrowse?packageid=" +
            doc.getElementsByTagName("packageid")[0].childNodes[0].nodeValue);
      }
      var title = '<a rel="external noopener" href="' + link + '" target="_blank" aria-label="open data in new tab">' +
         doc.getElementsByTagName("title")[0].childNodes[0].nodeValue.trim() + '</a>';
      var abstract;
      try {
         abstract = '<br><span class="dataset-abstract">' + doc.getElementsByTagName("abstract")[0].childNodes[0].nodeValue + '</span>';
         if (abstract.length > PASTA_CONFIG["abstractLimit"]) {
            abstract = abstract.substring(0, PASTA_CONFIG["abstractLimit"]) + "...";
         }
      } catch (error) {
         abstract = '';
      }
      if (PASTA_CONFIG["showAbstracts"]) {
         var row = '<p><span class="dataset-title">' + title +
            '</span><br><span class="dataset-author">' + names + date +
            '</span>' + abstract + '</p>';
      } else {
         var row = '<p><span class="dataset-title">' + title +
            '</span><br><span class="dataset-author">' + names + date +
            '</span></p>';
      }
      html.push(row);
   }
   var resultHtml;
   if (html.length) {
      resultHtml = html.join("\n");
   } else {
      resultHtml = "<p>Your search returned no results.</p>";
   }
   document.getElementById("searchResults").innerHTML = resultHtml;
   showLoading(false);
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
   var sortDiv = document.getElementById(PASTA_CONFIG["sortDiv"]);
   if (sortDiv) {
      if (docs.length)
         sortDiv.style.display = "block";
      else
         sortDiv.style.display = "none";
   }
   if (PASTA_CONFIG["useCiteService"]) {
      buildCitationsFromCite(docs);
   } else {
      buildCitationsFromPasta(docs);
   }
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

// Passes search URL and callbacks to CORS function
function searchPasta(limit, pageStart) {
   var params = "&rows=" + limit + "&start=" + pageStart;
   var url = QUERY_URL + params;
   showUrl(url);
   showLoading(true);
   makeCorsRequest(url, null, successCallback, errorCallback);
}

function initCollapsible(expanded) {
   // Handles collapsible sections
   function showHide(el, show) {
      if (show) el.style.maxHeight = "900px";
      else el.style.maxHeight = null;
   }

   // Expand if user tabs into hidden element
   function listenForFocus(collapsibleEl, toggle) {
      function addFocusListener(collapsibleEl, tagName, toggle) {
         var els = collapsibleEl.getElementsByTagName(tagName);
         var i;
         for (i = 0; i < els.length; i++) {
            els[i].onfocus = function () {
               if (!toggle.checked) toggle.click();
            };
         };
      }
      addFocusListener(collapsibleEl, "SELECT", toggle);
      addFocusListener(collapsibleEl, "INPUT", toggle);
   }

   // Collapse when checked
   var els = document.getElementsByClassName("collapse-toggle");
   var i;
   for (i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.type && el.type === 'checkbox') {
         el.checked = expanded;
         var target = document.getElementById(el.getAttribute("aria-controls"));
         listenForFocus(target, el);
         showHide(target, expanded);
         el.setAttribute("aria-expanded", expanded.toString());
         el.onchange = function () {
            showHide(target, this.checked);
            this.setAttribute("aria-expanded", this.checked.toString());
         };
      }
   }
   // Toggle checkbox when user presses space or enter on label
   els = document.getElementsByClassName("lbl-toggle");
   for (i = 0; i < els.length; i++) {
      var label = els[i];
      label.onkeydown = function (e) {
         if (e.which === 32 || e.which === 13) {
            e.preventDefault();
            this.click();
         };
      };
   };
}

function clearParams() {
   var areas = document.getElementById("coreArea");
   areas[0].selected = true;
   document.forms.dataSearchForm.creator.value = "";
   document.forms.dataSearchForm.project.value = "";
//    document.forms.dataSearchForm.identifier.value = "";
   document.forms.dataSearchForm.taxon.value = "";
   document.forms.dataSearchForm.geo.value = "";
   document.forms.dataSearchForm.data_year.checked = false;
   document.forms.dataSearchForm.publish_year.checked = false;
   document.forms.dataSearchForm.min_year.value = "1900";
   document.forms.dataSearchForm.max_year.value = "2022";
}

// Selects the desired value in the Select control. If value is not in the
// control, then first index is used. Returns actual selected value.
function setSelectValue(elId, desiredValue) {
   var el = document.getElementById(elId);
   if (!el || !el.length) return null;
   var result = el[0].value;
   for (var i = 0; i < el.length; i++) {
      if (desiredValue === el[i].value) {
         el[i].selected = true;
         result = desiredValue;
         break;
      }
   }
   return result;
}

function isInteger(x) {
   return (typeof x === 'number') && (x % 1 === 0);
}

function makeAutocomplete(elementId, choices, minChars) {
   if (!minChars) minChars = 2;
   var autocomplete = new autoComplete({
      selector: "#" + elementId,
      minChars: minChars,
      source: function (term, suggest) {
         term = term.toLowerCase();
         var suggestions = [];
         for (var i = 0; i < choices.length; i++)
            if (~choices[i].toLowerCase().indexOf(term))
               suggestions.push(choices[i]);
         suggest(suggestions);
      }
   });
   return autocomplete;
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
   var creatorSet = new Set();
   var creatorCounts = {};
   for (var i = 0; i < docs.length; i++) {
      var authorNodes = docs[i].getElementsByTagName("author");
      for (var j = 0; j < authorNodes.length; j++) {
         var creator = authorNodes[j].innerHTML;
         creatorSet.add(creator);
         creatorCounts[creator] = (creatorCounts[creator] || 0) + 1;
      }
   }
   var creatorDropdown = document.getElementById("creator-dropdown");
   var creators = Array.from(creatorSet).sort();
   creatorDropdown.innerHTML = renderCreatorCheckboxes(creators, selected || [], creatorCounts);
}

function filterDocsByCreators(docs, selectedCreators) {
   if (!selectedCreators.length) return docs;
   return docs.filter(function(doc) {
      var authorNodes = doc.getElementsByTagName("author");
      var authors = Array.from(authorNodes).map(function(n) { return n.innerHTML; });
      return selectedCreators.some(function(sel) { return authors.includes(sel); });
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
      for (var j = 0; j < keywordNodes.length; j++) {
         var keyword = keywordNodes[j].innerHTML;
         keywordSet.add(keyword);
         keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
   }
   var keywordDropdown = document.getElementById("keyword-dropdown");
   var keywords = Array.from(keywordSet).sort();
   keywordDropdown.innerHTML = renderKeywordCheckboxes(keywords, selected || [], keywordCounts);
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
      var projectNodes = docs[i].getElementsByTagName("projectTitle");
      var relatedProjectNodes = docs[i].getElementsByTagName("relatedProjectTitle");
      // Add projectTitle values
      for (var j = 0; j < projectNodes.length; j++) {
         var project = projectNodes[j].innerHTML.trim();
         if (project) {
            projectSet.add(project);
            projectCounts[project] = (projectCounts[project] || 0) + 1;
         }
      }
      // Add relatedProjectTitle values
      for (var k = 0; k < relatedProjectNodes.length; k++) {
         var relatedProject = relatedProjectNodes[k].innerHTML.trim();
         if (relatedProject) {
            projectSet.add(relatedProject);
            projectCounts[relatedProject] = (projectCounts[relatedProject] || 0) + 1;
         }
      }
   }
   var projectDropdown = document.getElementById("project-dropdown");
   var projects = Array.from(projectSet).sort();
   projectDropdown.innerHTML = renderProjectCheckboxes(projects, selected || [], projectCounts);
}

function filterDocsByProjects(docs, selectedProjects) {
   if (!selectedProjects.length) return docs;
   return docs.filter(function(doc) {
      var projectNodes = doc.getElementsByTagName("projectTitle");
      var relatedProjectNodes = doc.getElementsByTagName("relatedProjectTitle");
      var projects = Array.from(projectNodes).map(function(n) { return n.innerHTML; })
         .concat(Array.from(relatedProjectNodes).map(function(n) { return n.innerHTML; }));
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
      var locationNodes = docs[i].getElementsByTagName("geographicdescription");
      for (var j = 0; j < locationNodes.length; j++) {
         var location = locationNodes[j].innerHTML;
         locationSet.add(location);
         locationCounts[location] = (locationCounts[location] || 0) + 1;
      }
   }
   var locationDropdown = document.getElementById("location-dropdown");
   var locations = Array.from(locationSet).sort();
   locationDropdown.innerHTML = renderLocationCheckboxes(locations, selected || [], locationCounts);
}

function filterDocsByLocations(docs, selectedLocations) {
   if (!selectedLocations.length) return docs;
   return docs.filter(function(doc) {
      var locationNodes = doc.getElementsByTagName("geographicdescription");
      var locations = Array.from(locationNodes).map(function(n) { return n.innerHTML; });
      return selectedLocations.some(function(sel) { return locations.includes(sel); });
   });
}

// Patch successCallback to store all docs and update creator, keyword, projects, and location facets
var origSuccessCallback = successCallback;
successCallback = function(headers, response) {
   var parser = new DOMParser();
   var xmlDoc = parser.parseFromString(response, "text/xml");
   var docs = Array.from(xmlDoc.getElementsByTagName("document"));
   ALL_PASTA_DOCS = docs;
   var selectedCreators = getSelectedCreators();
   var selectedKeywords = getSelectedKeywords();
   var selectedProjects = getSelectedProjects();
   var selectedLocations = getSelectedLocations();
   populateCreatorFacetOptions(docs, selectedCreators);
   populateKeywordFacetOptions(docs, selectedKeywords);
   populateProjectFacetOptions(docs, selectedProjects);
   populateLocationFacetOptions(docs, selectedLocations);
   var filteredDocs = filterDocsByCreators(docs, selectedCreators);
   filteredDocs = filterDocsByKeywords(filteredDocs, selectedKeywords);
    filteredDocs = filterDocsByProjects(filteredDocs, selectedProjects);
   filteredDocs = filterDocsByLocations(filteredDocs, selectedLocations);
   if (PASTA_CONFIG["useCiteService"]) {
      buildCitationsFromCite(filteredDocs);
   } else {
      buildCitationsFromPasta(filteredDocs);
   }
   var count = filteredDocs.length;
   setHtml(PASTA_CONFIG["csvElementId"], '');
   var currentStart = getParameterByName("start");
   if (!currentStart) currentStart = 0; else currentStart = parseInt(currentStart);
   var limit = parseInt(PASTA_CONFIG["limit"]);
   var showPages = parseInt(PASTA_CONFIG["showPages"]);
   var pageTopElementId = PASTA_CONFIG["pagesTopElementId"];
   var pageBotElementId = PASTA_CONFIG["pagesBotElementId"];
   showPageLinks(count, limit, showPages, currentStart, pageTopElementId);
   showPageLinks(count, limit, showPages, currentStart, pageBotElementId);
   var query = getParameterByName("q");
   showResultCount(query, count, limit, currentStart, PASTA_CONFIG["countElementId"]);
}

// --- Active Filters UI ---
//function renderActiveFilters(selectedCreators, selectedKeywords, selectedLocations, selectedProjects) {
//  var container = document.getElementById('active-filters');
//  if (!container) return;
//  var tags = [];
//  selectedCreators.forEach(function(creator) {
//    tags.push(`<span class="filter-tag">${creator} <button class="remove-filter" data-type="creator" data-value="${encodeURIComponent(creator)}" title="Remove filter">×</button></span>`);
//  });
//  selectedKeywords.forEach(function(keyword) {
//    tags.push(`<span class="filter-tag">${keyword} <button class="remove-filter" data-type="keyword" data-value="${encodeURIComponent(keyword)}" title="Remove filter">×</button></span>`);
//  });
//  selectedProjects.forEach(function(project) {
//    tags.push(`<span class="filter-tag">${project} <button class="remove-filter" data-type="project" data-value="${encodeURIComponent(project)}" title="Remove filter">×</button></span>`);
//  });
//  selectedLocations.forEach(function(location) {
//    tags.push(`<span class="filter-tag">${location} <button class="remove-filter" data-type="location" data-value="${encodeURIComponent(location)}" title="Remove filter">×</button></span>`);
//  });
//  var clearBtn = (tags.length > 0) ? '<button id="clear-all-filters" class="clear-all-filters">Clear all filters</button>' : '';
//  container.innerHTML = tags.join(' ') + ' ' + clearBtn;
//}
function renderActiveFilters(selectedCreators, selectedKeywords, selectedLocations, selectedProjects) {
  var container = document.getElementById('active-filters');
  if (!container) return;
  var tags = [];
  selectedCreators.forEach(function(creator) {
    tags.push(`<span class="filter-tag">${creator} <button class="remove-filter" data-type="creator" data-value="${encodeURIComponent(creator)}" title="Remove filter">×</button></span>`);
  });
  selectedKeywords.forEach(function(keyword) {
    tags.push(`<span class="filter-tag">${keyword} <button class="remove-filter" data-type="keyword" data-value="${encodeURIComponent(keyword)}" title="Remove filter">×</button></span>`);
  });
  selectedProjects.forEach(function(project) {
    tags.push(`<span class="filter-tag">${project} <button class="remove-filter" data-type="project" data-value="${encodeURIComponent(project)}" title="Remove filter">×</button></span>`);
  });
  selectedLocations.forEach(function(location) {
    tags.push(`<span class="filter-tag">${location} <button class="remove-filter" data-type="location" data-value="${encodeURIComponent(location)}" title="Remove filter">×</button></span>`);
  });
  var clearBtn = (tags.length > 0)
    ? '<span id="clear-all-filters" class="clear-all-filters-link">Clear all filters</span>'
    : '';
  container.innerHTML = tags.join(' ') + ' ' + clearBtn;
}

function uncheckFacet(type, value) {
  var selector =
    type === 'creator' ? '.creator-checkbox' :
    type === 'keyword' ? '.keyword-checkbox' :
    type === 'project' ? '.project-checkbox' :
    '.location-checkbox';
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
    '.location-checkbox'
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
  var filteredDocs = filterDocsByCreators(ALL_PASTA_DOCS, selectedCreators || []);
  filteredDocs = filterDocsByKeywords(filteredDocs, selectedKeywords || []);
  filteredDocs = filterDocsByProjects(filteredDocs, selectedProjects || []);
  filteredDocs = filterDocsByLocations(filteredDocs, selectedLocations || []);
  populateCreatorFacetOptions(filteredDocs, selectedCreators);
  populateKeywordFacetOptions(filteredDocs, selectedKeywords);
  populateProjectFacetOptions(filteredDocs, selectedProjects);
  populateLocationFacetOptions(filteredDocs, selectedLocations);
  renderActiveFilters(selectedCreators, selectedKeywords, selectedLocations, selectedProjects);
  if (PASTA_CONFIG["useCiteService"]) {
    buildCitationsFromCite(filteredDocs);
  } else {
    buildCitationsFromPasta(filteredDocs);
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

document.addEventListener("DOMContentLoaded", function() {
   // Fetch initial dataset from PASTA server and initialize facets/results
   var url = PASTA_CONFIG.server + "fl=title,pubdate,doi,packageid,author,abstract,keyword,geographicdescription,projectTitle,relatedProjectTitle&defType=edismax" + PASTA_CONFIG.filter + "&q=*&rows=1000";
   showLoading(true);
   makeCorsRequest(url, null, function(headers, response) {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(response, "text/xml");
      var docs = Array.from(xmlDoc.getElementsByTagName("document"));
      ALL_PASTA_DOCS = docs;
      populateCreatorFacetOptions(docs, []);
      populateKeywordFacetOptions(docs, []);
      populateProjectFacetOptions(docs, []);
      populateLocationFacetOptions(docs, []);
      // Render all results initially
      if (PASTA_CONFIG["useCiteService"]) {
         buildCitationsFromCite(docs);
      } else {
         buildCitationsFromPasta(docs);
      }
      showLoading(false);
   }, errorCallback);

   var creatorToggleBtn = document.getElementById("creator-toggle-btn");
   var creatorDropdown = document.getElementById("creator-dropdown");
   var creatorArrow = document.getElementById("creator-arrow");
   var expanded = false;
   if (creatorToggleBtn && creatorDropdown && creatorArrow) {
      creatorToggleBtn.addEventListener("click", function(e) {
         e.preventDefault();
         expanded = !expanded;
         if (expanded) {
            creatorDropdown.style.display = "block";
            creatorArrow.innerHTML = "&#x25B2;";
            creatorDropdown.focus();
         } else {
            creatorDropdown.style.display = "none";
            creatorArrow.innerHTML = "&#x25BC;";
         }
      });
      // Optional: collapse when focus is lost
      creatorDropdown.addEventListener("blur", function(e) {
         setTimeout(function() {
            // Only collapse if focus is not on a child element (e.g., a checkbox)
            if (!creatorDropdown.contains(document.activeElement)) {
               creatorDropdown.style.display = "none";
               creatorArrow.innerHTML = "&#x25BC;";
               expanded = false;
            }
         }, 150);
      });
      // Debounce utility
      function debounce(func, wait) {
        var timeout;
        return function() {
          var context = this, args = arguments;
          clearTimeout(timeout);
          timeout = setTimeout(function() {
            func.apply(context, args);
          }, wait);
        };
      }
      // Unified handler for facet (creator/keyword/location/project) changes
      var processFacetChange = debounce(function() {
        var selectedCreators = getSelectedCreators();
        var selectedKeywords = getSelectedKeywords();
        var selectedProjects = getSelectedProjects();
        var selectedLocations = getSelectedLocations();
        // Apply both filters to get filteredDocs
        var filteredDocs = filterDocsByCreators(ALL_PASTA_DOCS, selectedCreators || []);
        filteredDocs = filterDocsByKeywords(filteredDocs, selectedKeywords || []);
        filteredDocs = filterDocsByProjects(filteredDocs, selectedProjects || []);
        filteredDocs = filterDocsByLocations(filteredDocs, selectedLocations || []);
        // Dynamically update facet options based on filteredDocs
        populateCreatorFacetOptions(filteredDocs, selectedCreators);
        populateKeywordFacetOptions(filteredDocs, selectedKeywords);
        populateProjectFacetOptions(filteredDocs, selectedProjects);
        populateLocationFacetOptions(filteredDocs, selectedLocations);
        // Render active filters UI
        renderActiveFilters(selectedCreators, selectedKeywords, selectedLocations, selectedProjects);
        // Render filtered results
        if (PASTA_CONFIG["useCiteService"]) {
          buildCitationsFromCite(filteredDocs);
        } else {
          buildCitationsFromPasta(filteredDocs);
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
      }, 400);
      // Listen for creator checkbox changes
      creatorDropdown.addEventListener("change", function(e) {
        if (e.target.classList.contains('creator-checkbox')) {
          processFacetChange();
        }
      });
   }
   // Keyword dropdown logic
   var keywordToggleBtn = document.getElementById("keyword-toggle-btn");
   var keywordDropdown = document.getElementById("keyword-dropdown");
   var keywordArrow = document.getElementById("keyword-arrow");
   var keywordExpanded = false;
   if (keywordToggleBtn && keywordDropdown && keywordArrow) {
      keywordToggleBtn.addEventListener("click", function(e) {
         e.preventDefault();
         keywordExpanded = !keywordExpanded;
         if (keywordExpanded) {
            keywordDropdown.style.display = "block";
            keywordArrow.innerHTML = "\u25B2"; // Remove the semicolon
            keywordDropdown.focus();
         } else {
            keywordDropdown.style.display = "none";
            keywordArrow.innerHTML = "\u25BC"; // Remove the semicolon
         }
      });
      keywordDropdown.addEventListener("blur", function(e) {
         setTimeout(function() {
            if (!keywordDropdown.contains(document.activeElement)) {
               keywordDropdown.style.display = "none";
               keywordArrow.innerHTML = "\u25BC"; // Remove the semicolon
               keywordExpanded = false;
            }
         }, 150);
      });
      // Listen for keyword checkbox changes
      keywordDropdown.addEventListener("change", function(e) {
        if (e.target.classList.contains('keyword-checkbox')) {
          processFacetChange();
        }
      });
   }

   // Project dropdown logic
   var projectToggleBtn = document.getElementById("project-toggle-btn");
   var projectDropdown = document.getElementById("project-dropdown");
   var projectArrow = document.getElementById("project-arrow");
   var projectExpanded = false;
   if (projectToggleBtn && projectDropdown && projectArrow) {
      projectToggleBtn.addEventListener("click", function(e) {
         e.preventDefault();
         projectExpanded = !projectExpanded;
         if (projectExpanded) {
            projectDropdown.style.display = "block";
            projectArrow.innerHTML = "\u25B2"; // Remove the semicolon
            projectDropdown.focus();
         } else {
            projectDropdown.style.display = "none";
            projectArrow.innerHTML = "\u25BC"; // Remove the semicolon
         }
      });
      projectDropdown.addEventListener("blur", function(e) {
         setTimeout(function() {
            if (!projectDropdown.contains(document.activeElement)) {
               projectDropdown.style.display = "none";
               projectArrow.innerHTML = "\u25BC"; // Remove the semicolon
               projectExpanded = false;
            }
         }, 150);
      });
      // Listen for project checkbox changes
      projectDropdown.addEventListener("change", function(e) {
        if (e.target.classList.contains('project-checkbox')) {
          processFacetChange();
        }
      });
   }

   // Location dropdown logic
   var locationToggleBtn = document.getElementById("location-toggle-btn");
   var locationDropdown = document.getElementById("location-dropdown");
   var locationArrow = document.getElementById("location-arrow");
   var locationExpanded = false;
   if (locationToggleBtn && locationDropdown && locationArrow) {
      locationToggleBtn.addEventListener("click", function(e) {
         e.preventDefault();
         locationExpanded = !locationExpanded;
         if (locationExpanded) {
            locationDropdown.style.display = "block";
            locationArrow.innerHTML = "\u25B2"; // Remove the semicolon
            locationDropdown.focus();
         } else {
            locationDropdown.style.display = "none";
            locationArrow.innerHTML = "\u25BC"; // Remove the semicolon
         }
      });
      locationDropdown.addEventListener("blur", function(e) {
         setTimeout(function() {
            if (!locationDropdown.contains(document.activeElement)) {
               locationDropdown.style.display = "none";
               locationArrow.innerHTML = "\u25BC"; // Remove the semicolon
               locationExpanded = false;
            }
         }, 150);
      });
      // Listen for location checkbox changes
      locationDropdown.addEventListener("change", function(e) {
        if (e.target.classList.contains('location-checkbox')) {
          processFacetChange();
        }
      });
   }

   // Listen for remove filter clicks and clear all
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
});

// When the window loads, read query parameters and perform search
window.onload = function () {
   function initApp(expanded) {
      initCollapsible(expanded);

      var sortControl = document.getElementById("visibleSort");
      if (sortControl) {
         sortControl.onchange = function () {
            var hiddenSortControl = document.getElementById("sort");
            hiddenSortControl.value = this.options[this.selectedIndex].value;
            var form = document.getElementById("dataSearchForm");
            form.submit();
         };
      }
   }

   var query = getParameterByName("q");
   var coreAreaParam = getParameterByName("coreArea");
   var creator = getParameterByName("creator");
   var project = getParameterByName("project");
   var sYear = parseInt(getParameterByName("s"));
   var eYear = parseInt(getParameterByName("e"));
   var datayear = getParameterByName("datayear") === "y";
   var pubyear = getParameterByName("pubyear") === "y";
   var pkgId = getParameterByName("id");
   var taxon = getParameterByName("taxon");
   var geo = getParameterByName("geo");
   var expanded = Boolean(getParameterByName("expanded"));
   var pageStart = getParameterByName("start");
   var sortParam = getParameterByName("sort");
   if (!pageStart) pageStart = 0;

   initApp(expanded);

   if (!query) query = "*"; // default for empty query
   QUERY_URL = makeQueryUrlBase(query, coreArea, creator, sYear, eYear,
      datayear, pubyear, pkgId, taxon, geo, project, sortParam)
   searchPasta(PASTA_CONFIG["limit"], pageStart);

   if ("PASTA_LOOKUP" in window) {
      makeAutocomplete("creator", PASTA_LOOKUP["author"]);
      makeAutocomplete("project", PASTA_LOOKUP["projectTitle"].concat(PASTA_LOOKUP["relatedProjectTitle"]));
      makeAutocomplete("taxon", PASTA_LOOKUP["taxonomic"]);
   }
};
