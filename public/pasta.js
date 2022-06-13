// Requires cors.js and pagination.js to be loaded first

"use strict";

var PASTA_CONFIG = {
   "server": "https://pasta.lternet.edu/package/search/eml?", // PASTA server
   "filter": '&fq=keyword:"Archbold Biological Station"', // Filter results on a unique keyword of a research group
   "limit": 20, // Max number of results to retrieve per page
   "resultsElementId": "searchResults", // Element to contain results
   "urlElementId": "searchUrl", // Element to display search URL. Use "searchUrl" to display or "" to remove FIXME: Empty string does not turn off.
   "countElementId": "resultCount", // Element showing number of results
   "csvElementId": "csvDownload", // Element with link to download results as CSV
   "pagesTopElementId": "paginationTop", // Element to display result page links above results
   "pagesBotElementId": "paginationBot", // Element to display result page links below results
   "showPages": 5, // MUST BE ODD NUMBER! Max number of page links to show
   "sortDiv": "sortDiv", // Element with interactive sort options
   "useCiteService": true // true if we should use EDI Cite service to build citations instead of building from PASTA results
};

var QUERY_URL = ""; // Query URL without row limit or start parameter

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
function buildHtml(citations) {
   var html = [];
   var citationCount = Object.keys(citations).length;

   for (var i = 0; i < citationCount; i++) {
      var citation = citations[i];
      var authors = citation["authors"];
      var date = (citation["pub_year"]) ? " Published " + citation["pub_year"] + "" : "";
      // default ESIP formatting has trailing period after DOI
      var link = (citation["doi"]) ? citation["doi"].slice(0, -1) : "https://portal.edirepository.org/nis/mapbrowse?packageid=" + citation["pid"];
      var title = '<a rel="external noopener" href="' + link + '" target="_blank" aria-label="open data in new tab">' + citation["title"] + '</a>';
      var row = '<p><span class="dataset-title">' + title +
         '</span><br><span class="dataset-author">' + authors + date +
         '</span></p>';
      html.push(row);
   }
   if (citationCount) {
      return html.join("\n");
   } else {
      return "<p>Your search returned no results.</p>";
   }
}

// Download citations to a dictionary keyed by package ID
function getCitations(packageIds) {
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
                  var html = buildHtml(citations);
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
   for (var i = 0; i < pastaDocs.length; i++) {
      var doc = pastaDocs[i];
      packageIds.push(doc.getElementsByTagName("packageid")[0].childNodes[0].nodeValue);
   }
   if (packageIds.length) {
      getCitations(packageIds);
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
      var row = '<p><span class="dataset-title">' + title +
         '</span><br><span class="dataset-author">' + names + date +
         '</span></p>';
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

function downloadCsv(count) {
   if (count) showLoading(true);
   var limit = 2000;
   var calls = count / limit;
   if (parseInt(calls) != calls) calls = parseInt(calls) + 1;
   var callsRemaining = calls;
   var allRows = [
      ["Title", "Creators", "Year_Published", "DOI", "Package_ID"]
   ];
   var start = 0;
   var baseUri = QUERY_URL + "&rows=" + limit + "&start="

   function addChunk(headers, response) {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(response, "text/xml");
      var docs = xmlDoc.getElementsByTagName("document");
      for (var i = 0; i < docs.length; i++) {
         var doc = docs[i];
         var authorNodes = doc.getElementsByTagName("author");
         var authors = [];
         for (var authorIndex = 0; authorIndex < authorNodes.length; authorIndex++) {
            authors.push(authorNodes[authorIndex].innerHTML);
         }
         var names = authors.join("; ");

         var date;
         try {
            date = doc.getElementsByTagName("pubdate")[0].childNodes[0].nodeValue;
         } catch (error) {
            date = "";
         }
         var doi = "";
         var els = doc.getElementsByTagName("doi");
         if (els.length && els[0].childNodes.length) {
            doi = els[0].childNodes[0].nodeValue;
         }
         var packageId = doc.getElementsByTagName("packageid")[0].childNodes[0].nodeValue;
         var title = doc.getElementsByTagName("title")[0].childNodes[0].nodeValue.trim();
         var row = [title, names, date, doi, packageId];
         allRows.push(row);
      }

      --callsRemaining;
      if (callsRemaining <= 0) {
         var csv = CSV.arrayToCsv(allRows);
         var exportedFilenmae = "dataset_catalog.csv";
         // Snippet from https://medium.com/@danny.pule/export-json-to-csv-file-using-javascript-a0b7bc5b00d2
         var blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8;'
         });
         showLoading(false);
         if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, exportedFilenmae);
         } else {
            var link = document.createElement("a");
            if (link.download !== undefined) { // feature detection
               // Browsers that support HTML5 download attribute
               var csvUrl = URL.createObjectURL(blob);
               link.setAttribute("href", csvUrl);
               link.setAttribute("download", exportedFilenmae);
               link.style.visibility = "hidden";
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
            }
         }
      }
   }

   for (var i = 0; i < calls; i++) {
      var url = baseUri + start;
      makeCorsRequest(url, null, addChunk, errorCallback);
      start += limit;
   }

   return false; // Prevents calling function from following href
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

   function makeQueryUrlBase(userQuery, coreArea, creator, sYear, eYear, datayear, pubyear,
      pkgId, taxon, geo, sortBy) {

      function makeDateQuery(sYear, eYear, datayear, pubyear) {
         var query = "";
         if (datayear && !pubyear) {
            query = "&fq=(singledate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+" + eYear + "-12-31T00:00:00Z/DAY]+OR+(begindate:[*+TO+" + eYear + "-12-31T00:00:00Z/DAY]+AND+enddate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+NOW]))";
         } else if (pubyear && !datayear) {
            query = "&fq=pubdate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+" + eYear + "-12-31T00:00:00Z/DAY]";
         } else if (datayear && pubyear) {
            query = "&fq=(pubdate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+" + eYear + "-12-31T00:00:00Z/DAY]+AND+(singledate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+" + eYear + "-12-31T00:00:00Z/DAY]+OR+(begindate:[*+TO+" + eYear + "-12-31T00:00:00Z/DAY]+AND+enddate:[" + sYear + "-01-01T00:00:00Z/DAY+TO+NOW])))";
         }
         return query;
      }

      function makeSortParam(sortBy) {
         var param = "&sort=" + sortBy + ",";
         if (sortBy === "score" || sortBy === "pubdate" || sortBy === "enddate")
            param += "desc";
         else
            param += "asc";
         param += "&sort=packageid,asc";
         return param;
      }

      // Enclose text in quotes if there are spaces and if the text does not already include quotes or special operators
      function addQuotes(text) {
         if (!~text.indexOf(" ") || ~text.indexOf("+") || ~text.indexOf('"'))
            return text;
         else
            return '"' + text + '"';
      }

      var base = PASTA_CONFIG["server"];
      var fields = ["title",
         "pubdate",
         "doi",
         "packageid",
         "author"
      ].toString();

      var params = "fl=" + fields + "&defType=edismax" + PASTA_CONFIG["filter"];
      if (coreArea && coreArea !== "any") {
         params += '&fq=keyword:"' + coreArea + '"';
      }
      var query = "&q=" + userQuery;
      if (creator) query += "+AND+(author:" + addQuotes(creator) + "+OR+organization:" + addQuotes(creator) + ")";
      if (pkgId) {
         pkgId = pkgId.replace(":", "%5C:");
         query += "+AND+(doi:" + pkgId + "+packageid:" + pkgId + "+id:" + pkgId + ")";
      }
      if (taxon) query += "+AND+taxonomic:" + addQuotes(taxon);
      if (geo) query += "+AND+geographicdescription:" + addQuotes(geo);
      var dateQuery = makeDateQuery(sYear, eYear, datayear, pubyear);
      var sort = makeSortParam(sortBy);
      var url = base + encodeURI(params + query + dateQuery + sort);
      return url;
   }

   var query = getParameterByName("q");
   var coreAreaParam = getParameterByName("coreArea");
   var creator = getParameterByName("creator");
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

   document.forms.dataSearchForm.q.value = query;
   if (document.forms.dataSearchForm.creator)
      document.forms.dataSearchForm.creator.value = creator;
   if (document.forms.dataSearchForm.identifier)
      document.forms.dataSearchForm.identifier.value = pkgId;
   if (document.forms.dataSearchForm.taxon)
      document.forms.dataSearchForm.taxon.value = taxon;
   if (document.forms.dataSearchForm.geo)
      document.forms.dataSearchForm.geo.value = geo;
   if (document.forms.dataSearchForm.data_year)
      document.forms.dataSearchForm.data_year.checked = datayear;
   if (document.forms.dataSearchForm.publish_year)
      document.forms.dataSearchForm.publish_year.checked = pubyear;
   var coreArea = setSelectValue("coreArea", coreAreaParam);
   var sortBy = setSelectValue("visibleSort", sortParam);
   if (sortBy && document.forms.dataSearchForm.sort)
      document.forms.dataSearchForm.sort.value = sortBy;
   else
      sortBy = document.forms.dataSearchForm.sort.value;

   if (isInteger(sYear) && document.forms.dataSearchForm.min_year)
      document.forms.dataSearchForm.min_year.value = sYear;
   else if (document.forms.dataSearchForm.min_year)
      sYear = document.forms.dataSearchForm.min_year.value;
   if (!isInteger(eYear)) eYear = (new Date()).getFullYear()
   if (document.forms.dataSearchForm.max_year)
      document.forms.dataSearchForm.max_year.value = eYear;

   initApp(expanded);

   if (!query) query = "*"; // default for empty query
   QUERY_URL = makeQueryUrlBase(query, coreArea, creator, sYear, eYear,
      datayear, pubyear, pkgId, taxon, geo, sortBy)
   searchPasta(PASTA_CONFIG["limit"], pageStart);

   if ("PASTA_LOOKUP" in window) {
      makeAutocomplete("creator", PASTA_LOOKUP["author"]);
      makeAutocomplete("taxon", PASTA_LOOKUP["taxonomic"]);
   }
};
