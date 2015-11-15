function packet(type, seqNum, strData) {
	if(strData.length > packet.maxDataLength) {
		throw "data too large (max 500 chars)";
	}

	this.type = type;
	this.seqNum = seqNum % packet.seqNumModulo;
	this.data = strData;
};

packet.maxDataLength = 500;
packet.seqNumModulo = 32;

packet.createACK = function(seqNum) {
	return new packet(0, seqNum, '');
};

packet.createPacket = function(seqNum, data) {
	return new packet(1, seqNum, data);
};

packet.createEOT = function(seqNum) {
	return new packet(2, seqNum, '');
}

packet.parseUDPData = function(UDPdata) {
	var type = UDPdata.readUInt32BE(0);
	var seqnum = UDPdata.readUInt32BE(4);
	var length = UDPdata.readUInt32BE(8);
	// get the data
	var data = UDPdata.toString('utf8',12,length + 12);
	return new packet(type, seqnum, data);
};

packet.prototype.getType = function() {
	return this.type;
};

packet.prototype.getSeqNum = function() {
	return this.seqNum;
};

packet.prototype.getLength = function() {
	return this.data.length;
};

packet.prototype.getData = function() {
	return this.data;
};

packet.prototype.getUDPData = function() {
	var buf = new Buffer(512);

	buf.writeUInt32BE(this.type, 0);
	buf.writeUInt32BE(this.seqNum, 4);
	buf.writeUInt32BE(this.data.length, 8);
	buf.write(this.data, 12);
	return buf;
};

// export packet
module.exports = {
	packet: packet,
	ACK: 0,
	Data: 1,
	EOT: 2
};
