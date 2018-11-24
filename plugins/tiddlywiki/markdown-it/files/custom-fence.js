'use strict';

var yaml = require("$:/plugins/wikilabs/markdown-it/js-yaml.js");

var URL = "url";
var EXPERIMENT_TYPE = "experiment-type";
var EXPERIMENT = "experiment";
var RUN = "run";

function Fence(name, tw, markdown, current) {
    this.name = name;
    this.tw = tw;
    this.markdown = markdown;
    this.current = current;
}

Fence.prototype.parse = function(tokens, idx, options, env) {
    const token = tokens[idx];
    var parsed = null;
    try {
        parsed  = yaml.load(token.content)
    } catch (err) {
        throw err
    }

    return parsed;
}

Fence.prototype.getExperimentType = function() {
    return this.current.fields[EXPERIMENT_TYPE];
}

Fence.prototype.getExperimentURL = function(content) {
    // This function attempts to resolve the (osmosis) server URL for
    // a run. For an actual experiment run, this is quite easy although for
    // more general usage, we need the user to provide some additional information.
    // In particular, if they set the experiment-type field on their tiddler, we will use
    // that. Then, they need to provide the run name and experiment name so that we can
    // then resolve that tiddler and retrieve the URL from there.
    // Fast track.
    var explicitReference = (EXPERIMENT in content) || (RUN in content);
    if (!explicitReference)
    {
        return this.current.fields[URL];
    }

    // OK, the user is asking explicitly.
    var experimentType = null;
    var experimentName = null;    
    var runName = null;

    if ((EXPERIMENT in content) && (RUN in content))
    {
        // This should have been set to get the fence loaded at all.
        experimentType = this.current.fields[EXPERIMENT_TYPE];
        experimentName = content[EXPERIMENT];
        runName = content[RUN];
    }
    else if (RUN in content)
    {
        experimentType = this.current.fields[EXPERIMENT_TYPE];
        experimentName = this.current.fields["experiment-name"];
        runName = content[RUN];
    }

    // Now we can lookup this Tiddler.
    var referencedTitle = experimentType + "/" + experimentName + "/" + runName;
    console.log("referenced " + referencedTitle);
    var referencedTiddler = this.tw.wiki.getTiddler(referencedTitle);

    return referencedTiddler.fields[URL];
}


module.exports = Fence;
