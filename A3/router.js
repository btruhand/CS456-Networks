'use strict';

var packs = require('./packets');
var udp = require('dgram');
var util = require('util');

var routerId = parseInt(process.argv[2]);
var nseAddr = process.argv[3];
var nsePort = process.argv[4];
var routerPort = process.argv[5];

// the stages that this router is in:
// 0 - waiting for circuit DB packet
// 1 - waiting for HELLO packet or LS_PDUs
var stage = 0;

// topology databse
// each entry is of the form:
// [link_cost, neighbour]
var topDB = {};

// RIB
// each entry is of the form:
// [next hope, total path cost]
var RIB = [];

// keep track of those who sent me
// HELLO packets
var helloNeighbours = [];

// initialize RIB contents
function initRIB() {
	for(var i = 0; i < packs.NBR_ROUTER; i++) {
		if(i !== routerId-1) {
			RIB.push([Infinity, Infinity]);
		} else {
			RIB.push(['Local', 0]);
		}
	}
};

// find if a link is equivalent to another from an
// array of linkcosts used in the next function
function linkEquivalence(linkcosts, lc) {
	for(var i = 0; i < linkcosts.length; i++) {
		if(linkcosts[i][0].lid === lc.lid) {
			return {entry: i, equivalence: true};
		}
	}
	return {entry: undefined, equivalence: false};
};

// find neighbour of specified router
function findNeighbour(lc, router) {
	for(var router_num in topDB) {
		var res = linkEquivalence(topDB[router_num], lc)
		if(res.equivalence) {
			// set the neighbour of my neighbour to be me
			topDB[router_num][res.entry][1] = router
			return router_num;
		}
	}
	// if a neighbour can't be found
	// I am my own neighbour
	return router;
}

function dijkstraAlg() {
	var vQueue = [];
	for(var i = 0; i < packs.NBR_ROUTER; i++) {
		vQueue.push(i+1);
	}

	// while not empty
	while(vQueue.length !== 0) {
		// grab the vertex(router) with the minimum
		// distance as of now from the vQueue
		var vMinDistance = vQueue.reduce(function(prevMinV, curVector) {
			return RIB[prevMinV][1] < RIB[curVector][1] ? prevMinV : curVector;
		});
		// take out vMinDistance from vQueue
		vQueue = vQueue.slice(vQueue.indexOf(vMinDistance), 1);

		// try to update the RIB entries for the neighbours
		// of vMinDistance based on the distance of vMinDistance
		topDB[vMinDistance].forEach(function(linkcost) {
			var newPathCost = linkcost[0].cost + RIB[vMinDistance][1];
			if(newPathCost < RIB[linkcost[1]][0]) {
				// if the old calculated path to my neighbour
				// (vMinDistance's neighbour) is longer than
				// what I have calculated, set a new path
				
				RIB[linkcost[1]][1] = newPathCost;
				var routerTaken = vMinDistance;
				while(routerTaken !== routerId) {
					// while current router is not the
					// starting point
					routerTaken = RIB[routerTaken][0];
				}
				RIB[linkcost[1]][0] = routerTaken;
			}
		});
	}
};

function printTopology() {
	console.log('# Topology Database');
	for(var router_num in topDB) {
		var linkcosts = topDB[router_num];
		console.log(util.format('R%s -> R%s nbr link %s', routerId, router_num, linkcosts.length));
		linkcosts.forEach(function(lc) {
			console.log(util.format('R%s -> R%s link %s,cost %s', routerId, routerId, lc.lid, lc.cost));
		});
	}
	console.log();
};

function printRIB() {
	console.log('# RIB');
	RIB.forEach(function(entry, entryIndex) {
		console.log(util.format('R%s -> R%s -> %s, %s', routerId, entryIndex+1, entry[0], entry[1]));
	});
	console.log();
}

function afterInsertion(insertingFor) {
	printTopology();
	if(insertingFor !== routerId) {
		// if we are not inserting entries
		// for myself, then run Dijkstra's Algorithm
		dijkstraAlg();
	}
	printRIB();
}

function insertTopologyEntry(router_id, linkcost) {
	if(!topDB.hasOwnProperty(router_id)) {
		// first entry
		// search for my neighbour
		var neighbour = findNeighbour(linkcost, router_id);
		topDB[router_id] = [[linkcost, neighbour]];
		afterInsertion(router_id);
	} else {
		// check if link cost is already an entry for
		// this router_id
		var inTopologyDB = linkEquivalence(topDB[router_id], linkcost);

		if(!(inTopologyDB.equivalence)) {
			// if not, insert it
			var neighbour = findNeighbour(linkcost, router_id);
			topDB[router_id].push([linkcost,neighbour]);
			afterInsertion(router_id);
		}
	}
};

var routerSocket = udp.createSocket('udp4', function(data, rinfo) {
	// do something here
	if(stage === 0) {
		// change state
		stage = 1;
		var circDB = packs.circuit_DB.parseUDPData(data);
		console.log(util.format('R%s has received circuit DB\n', routerId));
		
		// insert own's circuit DB
		circDB.linkcost.forEach(function(link_cost) {
			insertTopologyEntry(routerId, link_cost);
		});

		// send HELLO packets to neighbours
		for(var router_num in topDB) {
			topDB[router_num].forEach(function(lc) {
				var helloUDP = (new packs.pkt_HELLO(routerId, lc[0].lid)).getUDPData();
				console.log('R%s is sending HELLO packet: router_id %s,link_id %s\n', routerId,
						routerId, lc[0].lid);
				routerSocket.send(helloUDP, 0, helloUDP.length, nsePort, nseAddr);
			});
		}
	} else {
		var packetLength = data.length;
		if(packetLength === packs.pkt_HELLO.packetLength()) {
			// a HELLO packet
			var helloPkt = packs.pkt_HELLO.parseUDPData(data);
			console.log(util.format('R%s has received Hello packet: router_id %s,link_id %s\n', routerId,
						helloPkt.getRouterID(), helloPkt.getLinkID()));

			// send my circuit DB to the HELLO sender
			var helloSender = helloPkt.getRouterID();
			var via = helloPkt.getLinkID();

			topDB[routerId].forEach(function(linkcost) {
				var sender = routerId;
				var link_id = linkcost[0].lid;
				var cost = linkcost[0].cost;

				var LSPDUudp = (new packs.pkt_LSPDU(sender, routerId, link_id, cost, via)).getUDPData();
				routerSocket.send(LSPDUudp, 0, LSPDUudp.length, nsePort, nseAddr);
			});

			// register HELLO sender to have sent me a HELLO
			helloNeighbours.push(helloSender);
		} else {
			// an LS_PDU packet
			var LSPDUpkt = packs.pkt_LSPDU.parseUDPData(data);
			console.log(util.format('R%s has received LS PDU packet: sender %s,router_id %s,link_id %s,cost %s,via %s',
						routerId, LSPDUpkt.getSender(), LSPDUpkt.getRouterID(), LSPDUpkt.getLinkID(),
						LSPDUpkt.getCost(), LSPDUpkt.getVia()));
		}
	}
});

function main() {
	initRIB();
	var initUDP = (new packs.pkt_INIT(routerId)).getUDPData();
	console.log(util.format('R%s is sending an INIT packet: router_id %s', routerId, routerId));
	routerSocket.send(initUDP, 0, initUDP.length, nsePort, nseAddr);
};

main();
