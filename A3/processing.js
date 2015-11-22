var util = require('util');
var packs = require('./packets');

var routerId = parseInt(process.argv[2]);

// topology database
// each entry is of the form:
// { router_id: array of [link_cost, neighbour] }
var topDB = {};

// RIB
// each entry is of the form:
// [next hop, total path cost]
// indexed by router_id - 1
var RIB = [];

// keep track of those who sent me
// HELLO packets
// each entry is of the form:
// [neighbour_id, connecting link,
//  an array of LSPDU packets sent to this neighbour so far]
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

function dijkstraAlg() {
	var vQueue = [];
	for(var i = 0; i < packs.NBR_ROUTER; i++) {
		// one less than the router numbers
		// 0 indexing rather than 1 indexing
		vQueue.push(i);
	}

	// while not empty
	while(vQueue.length !== 0) {
		// grab the vertex(router) with the minimum
		// distance as of now from the vQueue
		var vMinDistance = vQueue.reduce(function(prevMinV, curVector) {
			return RIB[prevMinV][1] < RIB[curVector][1] ? prevMinV : curVector;
		});
		// take out vMinDistance from vQueue
		vQueue.splice(vQueue.indexOf(vMinDistance), 1);	
		
		if((vMinDistance+1) in topDB) {
			// try to update the RIB entries for the neighbours
			// of vMinDistance based on the distance of vMinDistance
			topDB[vMinDistance+1].forEach(function(linkcost) {
				var newPathCost = linkcost[0].cost + RIB[vMinDistance][1];
				if(newPathCost < RIB[linkcost[1]-1][1]) {
					// if the old calculated path to my neighbour
					// (vMinDistance's neighbour) is longer than
					// what I have calculated, set a new path
					
					RIB[linkcost[1]-1][1] = newPathCost;
					// the path to this router is equal
					// to the path of taken to vMinDistance
					// except if vMinDistance is myself
					RIB[linkcost[1]-1][0] = vMinDistance + 1 === routerId ? linkcost[1] : RIB[vMinDistance][0];
				}
			});
		}
	}
};

function printTopology() {
	console.log('# Topology Database');
	for(var router_num in topDB) {
		var linkcosts = topDB[router_num];
		console.log(util.format('R%s -> R%s nbr link %s', routerId, router_num, linkcosts.length));
		linkcosts.forEach(function(lc) {
			console.log(util.format('R%s -> R%s link %s,cost %s', routerId, router_num, lc[0].lid, lc[0].cost));
		});
	}
	console.log();
};

function printRIB() {
	console.log('# RIB');
	RIB.forEach(function(entry, entryIndex) {
		if(entry[0] !== 'Local' && entry[0] !== Infinity) {
			// not entry for my own or entry for something I cannot reach
			console.log(util.format('R%s -> R%s -> R%s, %s', routerId, entryIndex+1, entry[0], entry[1]));
		} else {
			console.log(util.format('R%s -> R%s -> %s, %s', routerId, entryIndex+1, entry[0], entry[1]));
		}
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
		if(router_num !== routerId) {
			var res = linkEquivalence(topDB[router_num], lc)
			if(res.equivalence) {
				// set the neighbour of my neighbour to be me
				topDB[router_num][res.entry][1] = router
				return router_num;
			}
		}
	}
	// if a neighbour can't be found
	// I am my own neighbour for this
	// particular link
	return router;
};

// Insert a linkcost to the topology database
// Returns:
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

// find if an LSPDU is equivalent to one
// another from an array of LSPDUs
// an LSPDU is equivalent to one another if:
// * the LSPDU is sent originally by the same router
// * the LSPDU is giving information about the same link
function LSPDUequivalence(LSPDUlist, pkt) {
	for(var i = 0; i < LSPDUlist.length; i++) {
		if(LSPDUlist[i].getRouterID() === pkt.getRouterID() &&
		   LSPDUlist[i].getLinkID() === pkt.getLinkID()) {
			return true;
		}
	}
	return false;
};

module.exports = exports = {
	initRIB : initRIB,
	insertTopologyEntry : insertTopologyEntry,
	LSPDUequivalence : LSPDUequivalence,
	topDB : topDB,
	helloNeighbours : helloNeighbours
};
