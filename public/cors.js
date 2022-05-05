"use strict";

// adapted from https://www.html5rocks.com/en/tutorials/cors/
// Create the XHR object.
function createCORSRequest(method, url) {
   var xhr = new XMLHttpRequest();
   if ("withCredentials" in xhr) {
      // XHR for Chrome/Firefox/Opera/Safari.
      //url = encodeURI(url);
      xhr.open(method, url, true);
   } else if (typeof XDomainRequest != "undefined") {
      // XDomainRequest for IE.
      xhr = new XDomainRequest();
      xhr.open(method, url);
   } else {
      // CORS not supported.
      xhr = null;
   }
   return xhr;
}

// Make the actual CORS request.
function makeCorsRequest(url, headerDict, successCallback, errorCallback) {
   var xhr = createCORSRequest("GET", url);
   if (!xhr) {
      alert("CORS not supported");
      return;
   }
   // Response handlers.
   xhr.onload = function () {
      var headers = xhr.getAllResponseHeaders().split("\n");
      var header_dict = {};
      for (var i = 0; i < headers.length; i++) {
         var parts = headers[i].split(": ");
         header_dict[parts[0].toLowerCase()] = parts[1];
      }
      successCallback(header_dict, xhr.responseText);
   };
   xhr.onerror = function () {
      errorCallback();
   };

   if (headerDict) {
      var keys = Object.keys(headerDict);
      for (var index = 0; index < keys.length; index++) {
         var key = keys[index];
         xhr.setRequestHeader(key, headerDict[key]);
      }
   }
   xhr.send();
}