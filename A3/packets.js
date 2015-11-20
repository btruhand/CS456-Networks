var NBR_ROUTER = 5

var inherit = {
	getUDPData : function() {
		properties = Object.getOwnPropertyNames(this).sort();
		// all elements of every packets are unsigned ints
		// so 4 bytes each
		buf = new Buffer(properties.length * 4);
		properties.forEach(function(property, index) {
			buf.writeUInt32LE(this[property], index * 4);
		}.bind(this));
		return buf;
	}
};

function pkt_HELLO(router_id, link_id) {
	// router_id
	this.p1 = router_id;
	// link_id
	this.p2 = link_id;
};

pkt_HELLO.prototype = Object.create(inherit);
pkt_HELLO.prototype.getRouterID = function() {
	return this.p1;
};
pkt_HELLO.prototype.getLinkID = function() {
	return this.p2;
};

function pkt_LSPDU(sender, router_id, link_id, cost, via) {
	// sender
	this.p1 = sender;
	// router_id
	this.p2 = router_id;
	// link_id
	this.p3 = link_id;
	// cost
	this.p4 = cost;
	// via
	this.p5 = via;
};

pkt_LSPDU.prototype = Object.create(inherit);
pkt_LSPDU.prototype.getSender = function() {
	return this.p1;
};
pkt_LSPDU.prototype.getRouterID = function() {
	return this.p2;
};
pkt_LSPDU.prototype.getLinkID = function() {
	return this.p3;
};
pkt_LSPDU.prototype.getCost = function() {
	return this.p4;
};
pkt_LSPDU.prototype.getVia = function() {
	return this.p5;
};

function pkt_INIT(router_id) {
	this.rid = router_id;
};

pkt_INIT.prototype = Object.create(inherit);
pkt_INIT.prototype.getRouterID = function() {
	return this.rid;
};

function link_cost(link_id, cost) {
	this.lid = link_id;
	this.cost = cost;
};

function circuit_DB(nbr_link, linkcost) {
	this.nbr_link = nbr_link;
	this.linkcost = linkcost;
};

circuit_DB.parseUDPData = function(UDPData) {
	var nbr_link = UDPData.readUInt32LE(0);
	var linkcost = [];
	var beginOffset = 4;
	for(var i = 1; i <= nbr_link; i++, beginOffset+= 8) {
		linkcost.push(new link_cost(UDPData.readUInt32LE(beginOffset),UDPData.readUInt32LE(beginOffset+4)));
	}
	return new circuit_DB(nbr_link, linkcost);
};

module.exports = {
	pkt_HELLO : pkt_HELLO,
	pkt_LSPDU : pkt_LSPDU,
	pkt_INIT : pkt_INIT,
	link_cost : link_cost,
	circuit_DB : circuit_DB
};
