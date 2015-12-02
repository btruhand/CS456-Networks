var udp = require('dgram');
var pack = require('./packet');
var fs = require('fs');

// some initial values
var seqNum = 0;
var nEmuaddr = process.argv[2];
var nEmuport = process.argv[3];
var receivingAtPort = process.argv[4];
var writeFilename = process.argv[5];

var arrivallog = '';
var lastACKpacket = null;

// create a file stream to write data
var writefileStream = fs.createWriteStream(writeFilename);
var streamAvailable = true;
var writeBuffer = new Array(0);


writefileStream.on('drain', function() {
	// stream is available again
	streamAvailable = true;
	if(writeBuffer.length > 0) {
		// there are recorded data
		var bufLength = writeBuffer.length;
		for(var i = 0; i < bufLength; i++) {
			writefileStream.write(writeBuffer.shift())
		}
	}
});

// UDP socket creation
var receiverSocket = udp.createSocket('udp4', function(msg, rinfo) {
	var senderPacket = pack.packet.parseUDPData(msg);

	if(senderPacket.getType() === pack.Data) {
		// record sequence number from sent packet
		if(arrivallog.length !== 0) {
			arrivallog+= '\n';
		}
		arrivallog = arrivallog + senderPacket.getSeqNum();

		if(senderPacket.getSeqNum() === seqNum) {
			// yes this is the data I'm expecting
			try {
				lastACKpacket = pack.packet.createACK(seqNum).getUDPData();
			} catch(e) {
				// error creating ACK packet
				console.error(e);
				process.exit(ecode);
			}

			receiverSocket.send(lastACKpacket, 0, 512, nEmuport, nEmuaddr);

			if(streamAvailable) {
				streamAvailable = writefileStream.write(senderPacket.getData(0, senderPacket.getLength()));
			} else {
				// stream is full, store data for now
				writeBuffer.push(senderPacket.getData().slice(0, senderPacket.getLength()));
			}

			// increment sequence number
			seqNum = (seqNum + 1) %	pack.packet.seqNumModulo;
		} else {
			// out of order packet
			if(lastACKpacket !== null) {
				// if I've actually ACKed something,
				// resend that ACK packet
				receiverSocket.send(lastACKpacket, 0, 512, nEmuport, nEmuaddr);
			}
		}
	} else if(senderPacket.getType() === pack.EOT) {
		// this is an EOT packet, send it back since
		// the sender then must have received all my ACKs
		// and it's the end of the file being sent
		
		try {
			var EOTpacket = pack.packet.createEOT(seqNum);
		} catch(e) {
			// error creating a packet
			console.error(e);
			exitProcess(-1);
		}

		receiverSocket.send(EOTpacket.getUDPData(), 0, 512, nEmuport, nEmuaddr, endFunc);
	}
});

// bind socket
receiverSocket.bind(receivingAtPort);

function exitProcess(ecode) {
	// deallocate resources
	delete writeBuffer;
	writefileStream.destroy();
	receiverSocket.close();
	process.exit(ecode);
}

function endFunc() {
	fs.writeFileSync('arrival.log', arrivallog);
	exitProcess(0);
}
