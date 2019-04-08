/*\
title: $:/core/modules/server/routes/get-pdf.js
type: application/javascript
module-type: route

GET /pdf/:title

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.method = "GET";

exports.path = /^\/pdf\/(.+)$/;

exports.handler = function(request, response, state) {
    var path = require("path");
        
    var name = decodeURIComponent(state.params[0]);
    console.log("someone asking for PDF stuff! " + name);
    console.log(state.params);

    var root = path.resolve($tw.boot.wikiPath, $tw.config.wikiDocumentsSubDir);
    console.log("looking for it! " + root);

    var document = new $tw.PDFDocument(
        path.resolve(root, name));

    var result = {};

    response.writeHead(200);
    response.end();
};

}());
