/*\
title: $:/core/modules/server/server.js
type: application/javascript
module-type: library

Serve tiddlers over http

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

if($tw.node) {
	var util = require("util"),
		fs = require("fs"),
		url = require("url"),
		path = require("path"),
		http = require("http");
}

/*
A simple HTTP server with regexp-based routes
options: variables - optional hashmap of variables to set (a misnomer - they are really constant parameters)
		 routes - optional array of routes to use
		 wiki - reference to wiki object
*/
function Server(options) {
	var self = this;
	this.routes = options.routes || [];
	this.authenticators = options.authenticators || [];
	this.wiki = options.wiki;
	this.servername = this.wiki.getTiddlerText("$:/SiteTitle") || "TiddlyWiki5";
	// Initialise the variables
	this.variables = $tw.utils.extend({},this.defaultVariables);
	if(options.variables) {
		for(var variable in options.variables) {
			if(options.variables[variable]) {
				this.variables[variable] = options.variables[variable];
			}
		}		
	}
	$tw.utils.extend({},this.defaultVariables,options.variables);
	// Initialise authorization
	this.authorizationPrincipals = {
		readers: (this.get("readers") || this.get("username") || "(anon)").split(",").map($tw.utils.trim),
		writers: (this.get("writers") || this.get("username") || "(anon)").split(",").map($tw.utils.trim)
	}
	// Load and initialise authenticators
	$tw.modules.forEachModuleOfType("authenticator", function(title,authenticatorDefinition) {
		// console.log("Loading server route " + title);
		self.addAuthenticator(authenticatorDefinition.AuthenticatorClass);
	});
	// Load route handlers
	$tw.modules.forEachModuleOfType("route", function(title,routeDefinition) {
		// console.log("Loading server route " + title);
		self.addRoute(routeDefinition);
	});
}

Server.prototype.defaultVariables = {
	port: "8080",
	host: "127.0.0.1",
	rootTiddler: "$:/core/save/all",
	renderType: "text/plain",
	serveType: "text/html",
	debugLevel: "none"
};

Server.prototype.get = function(name) {
	return this.variables[name];
};

Server.prototype.addRoute = function(route) {
	this.routes.push(route);
};

Server.prototype.addAuthenticator = function(AuthenticatorClass) {
	// Instantiate and initialise the authenticator
	var authenticator = new AuthenticatorClass(this),
		result = authenticator.init();
	if(typeof result === "string") {
		$tw.utils.error("Error: " + result);
	} else if(result) {
		// Only use the authenticator if it initialised successfully
		this.authenticators.push(authenticator);
	}
};

Server.prototype.findMatchingRoute = function(request,state) {
	var pathprefix = this.get("pathprefix") || "";
	for(var t=0; t<this.routes.length; t++) {
		var potentialRoute = this.routes[t],
			pathRegExp = potentialRoute.path,
			pathname = state.urlInfo.pathname,
			match;
		if(pathprefix) {
			if(pathname.substr(0,pathprefix.length) === pathprefix) {
				pathname = pathname.substr(pathprefix.length) || "/";
				match = potentialRoute.path.exec(pathname);
			} else {
				match = false;
			}
		} else {
			match = potentialRoute.path.exec(pathname);
		}
		if(match && request.method === potentialRoute.method) {
			state.params = [];
			for(var p=1; p<match.length; p++) {
				state.params.push(match[p]);
			}
			return potentialRoute;
		}
	}
	return null;
};

Server.prototype.methodMappings = {
	"GET": "readers",
	"OPTIONS": "readers",
	"HEAD": "readers",
	"PUT": "writers",
	"POST": "writers",
	"DELETE": "writers"
};

Server.prototype.requestHandler = function(request,response) {
	// Compose the state object
	var self = this;
	var state = {};
	state.wiki = self.wiki;
	state.server = self;
	state.urlInfo = url.parse(request.url);
	// Get the principals authorized to access this resource
	var principals = this.authorizationPrincipals[this.methodMappings[request.method] || "readers"] || [];
	// Check whether anonymous access is enabled
	if(principals.indexOf("(anon)") === -1) {
		// Complain if there are no active authenticators
		if(this.authenticators.length < 1) {
			$tw.utils.error("Warning: Authentication required but no authentication modules are active");
			response.writeHead(401,"Authentication required to login to '" + this.servername + "'");
			response.end();
			return;
		}
		// Authenticate
		if(!this.authenticators[0].authenticateRequest(request,response,state)) {
			// Bail if we failed (the authenticator will have sent the response)
			return;
		}
		// Authorize with the authenticated username
		if(principals.indexOf(state.authenticatedUsername) === -1) {
			response.writeHead(401,"'" + state.authenticatedUsername + "' is not authorized to access '" + this.servername + "'");
			response.end();
			return;
		}
	}
	// Find the route that matches this path
	var route = self.findMatchingRoute(request,state);
	// Optionally output debug info
	if(self.get("debugLevel") !== "none") {
		console.log("Request path:",JSON.stringify(state.urlInfo));
		console.log("Request headers:",JSON.stringify(request.headers));
		console.log("authenticatedUsername:",state.authenticatedUsername);
	}
	// Return a 404 if we didn't find a route
	if(!route) {
		response.writeHead(404);
		response.end();
		return;
	}
	// Set the encoding for the incoming request
	// TODO: Presumably this would need tweaking if we supported PUTting binary tiddlers
	request.setEncoding("utf8");
	// Dispatch the appropriate method
	switch(request.method) {
		case "GET": // Intentional fall-through
		case "DELETE":
			route.handler(request,response,state);
			break;
		case "PUT":
			var data = "";
			request.on("data",function(chunk) {
				data += chunk.toString();
			});
			request.on("end",function() {
				state.data = data;
				route.handler(request,response,state);
			});
			break;
	}
};

/*
Listen for requests
port: optional port number (falls back to value of "port" variable)
host: optional host address (falls back to value of "hist" variable)
*/
Server.prototype.listen = function(port,host) {
	// Handle defaults for port and host
	port = port || this.get("port");
	host = host || this.get("host");
	// Check for the port being a string and look it up as an environment variable
	if(parseInt(port,10).toString() !== port) {
		port = process.env[port] || 8080;
	}
	$tw.utils.log("Serving on " + host + ":" + port,"brown/orange");
	$tw.utils.log("(press ctrl-C to exit)","red");
	// Warn if required plugins are missing
	if(!$tw.wiki.getTiddler("$:/plugins/tiddlywiki/tiddlyweb") || !$tw.wiki.getTiddler("$:/plugins/tiddlywiki/filesystem")) {
		$tw.utils.warning("Warning: Plugins required for client-server operation (\"tiddlywiki/filesystem\" and \"tiddlywiki/tiddlyweb\") are missing from tiddlywiki.info file");
	}
	return http.createServer(this.requestHandler.bind(this)).listen(port,host);
};

exports.Server = Server;

})();