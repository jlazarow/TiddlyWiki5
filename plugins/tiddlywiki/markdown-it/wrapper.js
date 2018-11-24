/*\
  title: $:/plugins/wikilabs/markdown-it/wrapper.js
  type: application/javascript
  module-type: parser

Wraps up the markdown-js parser for use in TiddlyWiki5

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var CONFIG_DIALECT_TIDDLER = "$:/config/markdown/dialect";
var DEFAULT_DIALECT = "markdown-it";
var EXPERIMENT_TYPE_FIELD = "experiment-type";
var EXPERIMENT_FENCE_PREFIX = "$:/config/NotebookPlugin/fences";
var DEFAULT_EXPERIMENT_FENCE_TIDDLER = "experiment/osmosis";
    
/*
The wiki text parser processes blocks of source text into a parse tree.

The parse tree is made up of nested arrays of these JavaScript objects:

	{type: "element", tag: <string>, attributes: {}, children: []} - an HTML element
	{type: "text", text: <string>} - a text node
	{type: "entity", value: <string>} - an entity
	{type: "raw", html: <string>} - raw HTML

Attributes are stored as hashmaps of the following objects:

	{type: "string", value: <string>} - literal string
	{type: "indirect", textReference: <textReference>} - indirect through a text reference
	{type: "macro", macro: <TBD>} - indirect through a macro invocation

*/

var PDFJS_URL = "http://localhost:8080/files/viewer.html?file=";

function PDFLinkTokenizer(tokens, idx) {
    // Make sure link contains only text
    if ((tokens[idx + 2].type !== 'link_close') ||
        (tokens[idx + 1].type !== 'text')) {
        return;
    }

    // Do replacement.
    var currentHref = tokens[idx].attrs[0][1];
    if (!currentHref.startsWith("#"))
    {
        // hacky override of the href.
        currentHref = currentHref.replace(/^pdf?:\/\//, "");

        currentHref = PDFJS_URL + currentHref;
        tokens[idx].attrs[0][0] = "onclick";
        tokens[idx].attrs[0][1] = "window.open('" + currentHref + "', '', 'location=0')";
        tokens[idx].attrPush(['href', '#']);
    }
}

function MarkdownParser(type, text, options) {
    // Note that your TW should have this modification in its core.
    var currentTiddlerTitle = options.title;
    var currentTiddler = options.wiki.getTiddler(currentTiddlerTitle);
    var dialect = options.wiki.getTiddlerText(CONFIG_DIALECT_TIDDLER, DEFAULT_DIALECT) || "gfm";
    var preset = "";
    var markdownArguments = {
        linkify: true,
        typographer: true
    };

    // Everything gets these plugins.
    var markdownPlugins = {
        "katex": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-katex.js",
            use: []
        },

        "inline": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-inline.js",
            use: ["url_beautify", "link_open", PDFLinkTokenizer]
        },

        "tiddlywiki": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-tiddlywiki.js",
            use: [$tw]
        },        

        "highlight": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-highlight.js",
            use: []
        },

        "imsize": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-imsize.js",
            use: [
                {
                    "autofill": true
                }
            ]
        },
        
        "link-attributes": {
            path: "$:/plugins/wikilabs/markdown-it/markdown-it-link-attributes.js",
            use: [
                {
                    pattern: /^https?:\/\//,
                    attrs: {
                        class: 'external-link'
                    }
                }
            ]
        }
    };

    switch (dialect) {
    case "gfm":
	preset = "default",
        markdownArguments.breaks = true;
	break;

    case "markdown-it":
	preset = "default";
	break;

    case "commonmark":
	preset = "commonmark";
	// this is a "strict" library preset. No special options needed.
	break;

    case "zero":
	preset = "zero";
	break;

    case "default":
    default: // fallthrough is intentional
	preset = "default";
	break;
    }
	
    var markdown = require("$:/plugins/wikilabs/markdown-it/markdown-it-min.js")(preset, markdownArguments);

    // Add plugins.
    Object.keys(markdownPlugins).forEach(function(key) {
        var markdownPlugin = markdownPlugins[key];
        var pluginHandle = require(markdownPlugin.path);

        var useArguments = markdownPlugin.use;
        if (key == "tiddlywiki")
        {
            useArguments = useArguments.concat([currentTiddlerTitle]);
        }

        markdown.use.apply(markdown, [pluginHandle].concat(useArguments));
    });

    // Is this an experiment run?
    if (EXPERIMENT_TYPE_FIELD in currentTiddler.fields)
    {
        var experimentType = currentTiddler.fields[EXPERIMENT_TYPE_FIELD];
        console.log(experimentType + " being rendered");

        var fenceTiddlerTitle = EXPERIMENT_FENCE_PREFIX + "/" + experimentType;
        var fenceTiddler = options.wiki.getTiddler(fenceTiddlerTitle);
        if (fenceTiddler === undefined)
        {
            console.log("found experiment but no corresponding fence tiddler: " + fenceTiddlerTitle);
            console.log("using generic osmosis fence");
            fenceTiddlerTitle = EXPERIMENT_FENCE_PREFIX + "/" + DEFAULT_EXPERIMENT_FENCE_TIDDLER;
        }

        // Load the fences.
        var experimentFence = require(fenceTiddlerTitle);
        var experimentFences = experimentFence.initialize($tw, markdown, currentTiddler);
        console.log("found " + experimentFences.length + " fences");
        console.log(experimentFences);
        experimentFences.forEach(function(fence) {
            markdown.use.apply(markdown, [fence]);
        });
    }
    else
    {
        console.log("not an experiment");
    }
                                          
    var element = {
	      type: "raw",
	      html: markdown.render(text)
    };

    this.tree = [element];
};

exports["text/x-markdown"] = MarkdownParser;

})();

