(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.markdownittiddlywiki = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
Take advantage of TiddlyWiki features within your CommonMark.
*/

/*jslint node: true */
'use strict';

var GET_PDF_ROUTE = "http://localhost:8080/pdf/";
var GET_IMG_ROUTE = "http://localhost:8080/files/img/";

module.exports = function tiddlywiki_plugin(md, tw, currentTitle) {
    function transcludeReferences(src) {
        var matchExpression = /\:\[\S+[a-zA-Z0-9\/\-_\s]+\]\(\S+[a-zA-Z0-9\/\-_\s\=]+\)/ig;
        
        // Nothing fancy for now.
        var match = null;
        while ((match = matchExpression.exec(src))) {
            // Try to figure out if this is a Tiddler;
            var matchText = match[0];
            var startName = matchText.indexOf("[") + 1;
            var endName = matchText.indexOf("]");
            var name = matchText.slice(startName, endName);
            var startReference = matchText.indexOf("(") + 1;
            var endReference = matchText.indexOf(")");
            var referenceText = matchText.slice(startReference, endReference);
            if (referenceText.startsWith("pdf://")) {
                // A PDF link.
                var resourcePart = referenceText.replace(/^pdf?:\/\//, GET_PDF_ROUTE);
                var resourceParts = resourcePart.split(" ");
                var resourceURL = resourceParts[0];
                
                // pass on anything after a space.
                var resourceExtra = "\"" + name + "\"";
                if (resourceParts.length > 1) {
                    resourceExtra = resourceParts[1];
                }

                var imageText = "![" + name + "]" + "(" + resourceURL + " " + resourceExtra + ")";
                src = src.slice(0, match.index) + imageText + src.slice(match.index + matchText.length);
                continue;
            }
            else if (referenceText.startsWith("img://")) {
                // A PDF link.
                var resourcePart = referenceText.replace(/^img?:\/\//, GET_IMG_ROUTE);
                var resourceParts = resourcePart.split(" ");
                var resourceURL = resourceParts[0];
                
                // pass on anything after a space.
                var resourceExtra = "\"" + name + "\"";
                if (resourceParts.length > 1) {
                    resourceExtra = resourceParts[1];
                }

                var imageText = "![" + name + "]" + "(" + resourceURL + " " + resourceExtra + ")";
                src = src.slice(0, match.index) + imageText + src.slice(match.index + matchText.length);
                continue;
            }

            var textReference = tw.utils.parseTextReference(referenceText);
            if (!textReference.title)
            {
                textReference.title = currentTitle;
            }

            // The user is referencing a tiddler title through a field.
            var referencedTitle = textReference.title;
            if (textReference.field)
            {
                var throughTiddler = tw.wiki.getTiddler(textReference.title);
                referencedTitle = throughTiddler.fields[textReference.field];
            }

            console.log(referencedTitle);
            var targetTiddler = null;
            if (!(targetTiddler = tw.wiki.getTiddler(referencedTitle)))
            {
                // Don't look here again.
                matchExpression.lastIndex = match.index + matchText.length;
                continue;
            }

            var transcludedText = targetTiddler.fields.text;
            src = src.slice(0, match.index) + transcludedText + src.slice(match.index + matchText.length);

            // No recursion for now.
            matchExpression.lastIndex = match.index + transcludedText.length;
        }
                                  
        return src;
    }

    function transcludeRule(state) {
        state.src = transcludeReferences(state.src);
    }

    function normalizeTiddlerLinks(src)
    {
        var matchExpression = /\[\S[a-zA-Z0-9\/\-_\s]+\]\(\#\S.*\)/ig;
        
        // Nothing fancy for now.
        var match = null;
        while ((match = matchExpression.exec(src))) {
            // Try to figure out if this is a Tiddler;
            var matchText = match[0];

            var startReference = matchText.indexOf("#") + 1;
            var endReference = matchText.indexOf(")");
            var referenceText = matchText.slice(startReference, endReference);
            referenceText = referenceText.replace(/ /g, "%20");

            // Support a single concatenation for now.
            var concatIndex = referenceText.indexOf("+");
            console.log("concat at " + concatIndex);
            var concatenation = "";
            if (concatIndex >= 0) {
                concatenation = referenceText.slice(concatIndex + 1);
                referenceText = referenceText.slice(0, concatIndex);
            }

            console.log("user asking for " + referenceText + " a bit extra of " + concatenation);
            var textReference = tw.utils.parseTextReference(referenceText);
            if (textReference.field)
            {
                var throughTiddler = tw.wiki.getTiddler(currentTitle);
                referenceText = throughTiddler.fields[textReference.field];
                console.log("resolved to" + referenceText);

                // remove the #.
                startReference -= 1;
                referenceText += concatenation;
            }
            else
            {
                // put this back just in case we messed something up.
                referenceText = referenceText + concatenation;
            }
            
            src = src.slice(0, match.index + startReference) + referenceText + src.slice(match.index + endReference);

            // No recursion for now.
            matchExpression.lastIndex = match.index + referenceText.length + 1;
        }
                                  
        return src;
    }

    function tiddlerLinkRule(state)
    {
        state.src = normalizeTiddlerLinks(state.src);
    }

    md.core.ruler.before("normalize", "transclude", transcludeRule);
    md.core.ruler.before("normalize", "tiddlerlink", tiddlerLinkRule);
};

},{}]},{},[1])(1)
});
