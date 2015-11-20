var packs = require('./packets');
var udp = require('dgram');
var util = require('util');

var routerId = parseInt(process.argv[2]);
var nseAddr = process.argv[3];
var nsePort = process.argv[4];
var routerPort = process.argv[5];

// the stages that this router is in:
// 0 - waiting for circuit DB packet
// 1 - waiting for LS PDUs
var stage = 0;

// topology databse
var topDB = {};

function printTopology() {
	console.log('# Topology Database');
	for(router_num in topDB) {
		var linkcosts = topDB[router_num];
		console.log(util.format('R%s -> R%s nbr link %s', routerId, router_num, linkcosts.length));
		linkcosts.forEach(function(lc) {
			console.log(util.format('R%s -> R%s link %s cost %s', routerId, routerId, lc.lid, lc.cost));
		});
	}
	console.log();
};

function insertTopologyEntry(router_id, linkcost) {
	if(!topDB.hasOwnProperty(router_id)) {
		// first entry
		topDB[router_id] = [linkcost];
		printTopology();
	} else {
		// check if link cost is already an entry
		var inTopologyDB = topDB[router_id].reduce(function(prevVal, curVal) {
			return prevVal || (curVal.lid === linkcost.lid);
		}, false);

		if(!inTopologyDB) {
			// if not, insert it
			topDB[router_id].push(linkcost);
			printTopology();
		}
	}
};

var routerSocket = udp.createSocket('udp4', function(data, rinfo) {
	// do something here
	if(stage === 0) {
		console.log(util.format('R%s has received circuit DB\n', routerId));
		// change state
		stage = 1;
		// insert own's circuit DB
		circDB = packs.circuit_DB.parseUDPData(data);
		circDB.linkcost.forEach(function(link_cost) {
			insertTopologyEntry(routerId, link_cost);
		});
	}
});

function main() {
	var initPacket = new packs.pkt_INIT(routerId);
	var initUDP = initPacket.getUDPData();
	routerSocket.send(initUDP, 0, initUDP.length, nsePort, nseAddr);
};

main();
