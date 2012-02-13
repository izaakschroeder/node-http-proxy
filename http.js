var 
	http = require('http'), 
	hrtime = require('hrtime'),
	uuid = require('uuid');

//This parameter is important. Read the documentation.
http.globalAgent.maxSockets = 100;

function Proxy() {
	var self = this;	
	this.hostEndpoints = { };
	this.metrics = { 
		responseTime: { }
	};

	this.server = http.createServer(function(request, response) {
		
		//Caching

		var endpoints = self.hostEndpoints[request.headers["host"]];
		
		//Balancing

		if (endpoints.length === 0) {
			console.log("No endpoint defined for host!");
			response.writeHead(500);
			response.end();
			return;
		}
		
		
		var lastResponseTime = undefined, endpoint = null;
		for (var i in endpoints) {
			var time = self.metrics.responseTime[endpoints[i].id]
			console.log("Checking time "+time);	
			if (lastResponseTime === undefined || time < lastResponseTime) {
				lastResponseTime = time;
				endpoint = endpoints[i];
				console.log("Thinking about using "+endpoint.host);
			}
		}

		console.log(endpoint);
		
		var now = Date.now(), proxyRequest = http.request({
			host: endpoint.host,
			port: endpoint.port,
			path: request.url
		}, (function(endpoint, now, endpointResponse) {
			var timeTaken = Date.now() - now;
			self.metrics.responseTime[endpoint.id] = timeTaken;
			console.log(self.metrics);

			//Load checking (how long request takes)
			for (var name in endpointResponse.headers)
				response.setHeader(name, endpointResponse.headers[name]);
			response.writeHead(endpointResponse.statusCode);
			endpointResponse.pipe(response);
			
			endpointResponse.on("end", function() {
				//var timeTaken = hrtime.time() - now;
				//console.log("Request took "+timeTaken+" ns.");
				
				//self.metrics.responseTime[endpoint.id] = timeTaken;
				//self.metrics.responseTime[endpoint.id] = 
				//	self.metrics.responseTime[endpoint.id]*0.8
				//	+ timeTaken*0.2;

			});
		}).bind(undefined, endpoint, now));
		request.pipe(proxyRequest);
	});
	
	this.checkTimer = setInterval(this.instanceChecks.bind(this), 1000)
}

Proxy.prototype.instanceChecks = function() {
	for (var host in this.hostEndpoints) {
		var endpoints = this.hostEndpoints[host];
		var overloaded = true;
		for (var i in endpoints) {
			var endpoint = endpoints[i];
			
			var responseTime = this.metrics.responseTime[endpoint.id];
			if (responseTime < 200*1000000)
				overloaded = false;
		}
		if (overloaded) {
			console.log(host+" is overloaded and needs new instance!");
			clearTimeout(this.checkTimer);
		}
	}
}

function Endpoint(args) {
	this.host = args.host;
	this.port = args.port || 80;
	this.id = uuid.generate();
}

Proxy.prototype.addHostEndpoint = function(host, endpoint) {
	endpoint = new Endpoint(endpoint);
	if (typeof this.hostEndpoints[host] === "undefined")
		this.hostEndpoints[host] = [];
	this.hostEndpoints[host].push(endpoint);
	
	this.metrics.responseTime[endpoint.id] = 0
}

Proxy.prototype.run = function() {
	this.server.listen(5555);
}

var proxy = new Proxy();

proxy.run();


proxy.addHostEndpoint("home.izaakschroeder.com:5555", { host: "www.google.ca" }); 
proxy.addHostEndpoint("home.izaakschroeder.com:5555", { host :"www.google.co.uk" });

