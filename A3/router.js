'use strict';
var packs = require('./packets');
var pcs = require('./processing');
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

function handleCircuitDBPacket(data) {
	var circDB = packs.circuit_DB.parseUDPData(data);
	logCircDBreceive();
	
	// insert own's circuit DB
	circDB.linkcost.forEach(function(link_cost) {
		pcs.insertTopologyEntry(routerId, link_cost);
	});

	// send HELLO packets to neighbours
	for(var router_num in pcs.topDB) {
		pcs.topDB[router_num].forEach(function(lc) {
			var helloUDP = (new packs.pkt_HELLO(routerId, lc[0].lid)).getUDPData();
			logHELLOsend(routerId, lc[0].lid);
			routerSocket.send(helloUDP, 0, helloUDP.length, nsePort, nseAddr);
		});
	}
};

function handleHelloPacket(data) {
	var helloPkt = packs.pkt_HELLO.parseUDPData(data);

	// send my circuit DB to the HELLO sender
	var helloSender = helloPkt.getRouterID();
	var via = helloPkt.getLinkID();
	
	// register HELLO sender to have sent me a HELLO
	// via a particular route so I can reuse the route again
	// later in the future
	pcs.helloNeighbours.push([helloSender,via,[]]);

	logHELLOreceive(helloSender, via);

	for(var router_num in pcs.topDB) {
		pcs.topDB[router_num].forEach(function(linkcost) {
			var sender = routerId;
			var link_id = linkcost[0].lid;
			var cost = linkcost[0].cost;
			
			var LSPDUpkt = new packs.pkt_LSPDU(sender, parseInt(router_num), link_id, cost, via); 
			var LSPDUudp = LSPDUpkt.getUDPData();

			// indicate that I have sent this LSPDU packet
			// to this neighbour
			pcs.helloNeighbours[pcs.helloNeighbours.length - 1][2].push(LSPDUpkt);
			logLSPDUsend(sender, routerId, link_id, cost, via);
			routerSocket.send(LSPDUudp, 0, LSPDUudp.length, nsePort, nseAddr);
		});
	}
};

function handleLSPDUPacket(data) {
	var LSPDUpkt = packs.pkt_LSPDU.parseUDPData(data);

	var sender = LSPDUpkt.getSender();
	var original_router = LSPDUpkt.getRouterID();
	var link_id = LSPDUpkt.getLinkID();
	var cost = LSPDUpkt.getCost();
	
	logLSPDUreceive(sender, original_router, link_id, cost, LSPDUpkt.getVia()); 
	var lc = new packs.link_cost(link_id, cost);
	pcs.insertTopologyEntry(original_router, lc);
	
	// attempt to forward the LSPDU packet
	pcs.helloNeighbours.forEach(function(neighbourInfo) {
		var neighbour = neighbourInfo[0];
		if(neighbour !== sender && neighbour !== original_router) {
			// my neighbour was not the original sender
			// nor the sender of this package
			if(!pcs.LSPDUequivalence(neighbourInfo[2], LSPDUpkt)) {
				// indicate that I have sent this LSPDU packet
				// to this neighbour
				neighbourInfo[2].push(LSPDUpkt);

				// I haven't sent this LS PDU packet to my neighbour
				var LSPDUudp = LSPDUpkt.setSender(routerId).setVia(neighbourInfo[1]).getUDPData();
				logLSPDUsend(routerId, original_router, link_id, cost, neighbourInfo[1]);
				routerSocket.send(LSPDUudp, 0, LSPDUudp.length, nsePort, nseAddr);
			}
		}
	});
};

var routerSocket = udp.createSocket('udp4', function(data, rinfo) {
	if(stage === 0) {
		// change state
		stage = 1;
		handleCircuitDBPacket(data);
	} else {
		var packetLength = data.length;
		if(packetLength === packs.pkt_HELLO.packetLength()) {
			// a HELLO packet
			handleHelloPacket(data);
		} else {
			// a LSPDU packet
			handleLSPDUPacket(data);
		}
	}
});

// bind socket
routerSocket.bind(routerPort);

// logging functions
function logCircDBreceive() {
	console.log(util.format('R%s has received circuit DB\n', routerId));
};

function logHELLOsend(router_id, link_id) {
	console.log('R%s is sending HELLO packet: router_id %s,link_id %s\n', routerId,
			router_id, link_id);
};

function logHELLOreceive(router_id, link_id) {
	console.log(util.format('R%s has received Hello packet: router_id %s,link_id %s\n', routerId,
				router_id, link_id));
};

function logLSPDUsend(sender, router_id, link_id, cost, via) {
	console.log(util.format('R%s is sending LS PDU packet: sender %s,router_id %s,link_id %s,cost %s,via %s\n',
				routerId, sender, router_id, link_id, cost, via));
};

function logLSPDUreceive(sender, router_id, link_id, cost, via) {
	console.log(util.format('R%s has received LS PDU packet: sender %s,router_id %s,link_id %s,cost %s,via %s\n',
				routerId, sender, router_id, link_id, cost, via));
};

function main() {
	pcs.initRIB();
	var initUDP = (new packs.pkt_INIT(routerId)).getUDPData();
	console.log(util.format('R%s is sending an INIT packet: router_id %s', routerId, routerId));
	routerSocket.send(initUDP, 0, initUDP.length, nsePort, nseAddr);
};

main();
