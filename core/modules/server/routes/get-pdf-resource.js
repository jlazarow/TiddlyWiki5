/*\
title: $:/core/modules/server/routes/get-pdf-resource.js
type: application/javascript
module-type: route

GET /pdf/:title/page/:page/image/:image

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.method = "GET";

exports.path = /^\/pdf\/(.+)\/page\/(\d+)\/resource\/(.+)$/;

var cache = {};

exports.handler = function(request, response, state) {
    var path = require("path");
    var fs = require("fs");
    var png = require("pngjs");
        
    var name = decodeURIComponent(state.params[0]);
    var pageIndex = decodeURIComponent(state.params[1]);
    var resourceName = decodeURIComponent(state.params[2]);
    console.log("someone asking for PDF resource! " + "name: " + name + " page: " + pageIndex + " resource: " + resourceName);

    var root = path.resolve($tw.boot.wikiPath, $tw.config.wikiDocumentsSubDir);
    var documentPath = path.resolve(root, name);
    if (!fs.existsSync(documentPath)) {
        $tw.utils.error("unknown document: " + documentPath);
    }

    // Ask the cache.
    var document = undefined;
    if (documentPath in cache) {
        console.log("cache hit");
        document = cache[documentPath]
    }
    else {
        console.log("reading document at path: " + documentPath);
        document = new $tw.PDFDocument(documentPath);
        cache[documentPath] = document;
    }

    if (pageIndex < 0 || pageIndex >= document.pages.length) {
        $tw.utils.error("bad page index " + pageIndex);
    }

    var page = document.pages[pageIndex];
    if (!page.hasRead) {
        console.log("reading page at index: " + pageIndex);
        page.read();
    }

    var foundImages = page.resources.xobject.images;
    var foundEmbeds = page.resources.xobject.embedded;
    
    if (resourceName in foundImages) {
        console.log("reading image resource");
        var foundImage = foundImages[resourceName];
        while (!(foundImage instanceof $tw.PDFImage)) {
            foundImage = foundImage[Object.keys(foundImage)[0]];
        }

        var imageData = foundImage.read();
        response.writeHead(200, {
            "Content-Type": "image/png"
        });

        imageData.pack().pipe(response);
    }
    else if (resourceName in foundEmbeds) {
        console.log("reading embed resource");
        var foundEmbed = foundEmbeds[resourceName];
        var embeddedData = foundEmbed.read();

        response.writeHead(200, {
            "Content-Type": "image/png"
        });
        
        // convert to PNG.
        $tw.convertPDFToPNG(embeddedData, 1).then(function(pngData) {
            response.write(pngData);
            response.end();
        });
    }
    else {
        // not good.
        console.log("bad resource name: " + resourceName);
        response.writeHead(404);
        response.end();
    }
};

}());
