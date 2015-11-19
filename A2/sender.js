var udp = require('dgram');
var pack = require('./packet');
var fs = require('fs');

// some initial values
var seqNum = 0;
var baseWindow = 0;
var windowSize = 10;
var nEmuaddr = process.argv[2];
var nEmuport = process.argv[3];
var receivingAtPort = process.argv[4];
var readFilename = process.argv[5];
var backupBuffer = new Array(pack.packet.seqNumModulo);
var timeout = 110;
var baseWindowCycled = false;
var timeoutId;

// maintain log
var seqnumlog = '';
var acklog = '';

// state variables
var allDataSent = false;
var dataBuffer = new Array(0);
var streamPaused = false;

function sendEOTPacket() {
	if(allDataSent) {
		// we've finished sending and received
		// all the ACKs we need, send EOT packet
		try {
			var EOTpacket = pack.packet.createEOT(seqNum);
		} catch(e) {
			// error creating a packet
			console.error(e);
			exitProcess(-1);
		}
		senderSocket.send(EOTpacket.getUDPData(), 0, 512, nEmuport, nEmuaddr);
	}
}

// UDP socket creation and callback registration
var senderSocket = udp.createSocket('udp4', function(msg, rinfo) {
	var receiverPacket = pack.packet.parseUDPData(msg);
	if(receiverPacket.getType() === pack.ACK) {
		var ACKseqnum = receiverPacket.getSeqNum();
		baseWindow = (ACKseqnum + 1) % pack.packet.seqNumModulo;

		if(seqNum === baseWindow) {
			// stop timer since we've caught up
			clearTimeout(timeoutId);	
			
			// attempt sending EOT packet
			sendEOTPacket();

			if(dataBuffer.length > 0) {
				// saved some data
				timeoutId = setTimeout(timeoutHandler, timeout);
				var bufLength = dataBuffer.length;
				for(var i = 0; i < bufLength; i++) {
					// send those data
					sendData(dataBuffer.shift());
				}
			}
		} else {
			// stop and restart timer
			clearTimeout(timeoutId);
			timeoutId = setTimeout(timeoutHandler, timeout);
		}

		if(dataBuffer.length === 0 && streamPaused) {
			// if all buffered data has been sent
			// unpause stream if it was paused
			streamPaused = false;
			filereadStream.resume();
		}

		// record sequence number of ack
		if(acklog.length !== 0) {
			// give newline if this
			// is not the first ack
			acklog+= '\n'; 
		}
		acklog = acklog + receiverPacket.getSeqNum();
	} else if(receiverPacket.getType() === pack.EOT) {
		// finally write everything to the log file
		fs.writeFileSync('seqnum.log', seqnumlog);
		fs.writeFileSync('ack.log', acklog);

		exitProcess(0);
	}
});

// bind socket to port
senderSocket.bind(receivingAtPort);

function timeoutHandler() {
	// reset timer
	timeoutId = setTimeout(timeoutHandler, timeout);
	
	for(var i = baseWindow; i != seqNum; i = (i+1) % pack.packet.seqNumModulo) {
		if(seqnumlog.length !== 0) {
			// give newline if this
			// is not the first packet sent
			seqnumlog+= '\n';
		}
		seqnumlog = seqnumlog + backupBuffer[i][1];
		
		senderSocket.send(backupBuffer[i][0], 0, 512, nEmuport, nEmuaddr);
	}
}

// create read stream for file
var filereadStream = fs.createReadStream(readFilename,
		                 {bufferSize: pack.packet.maxDataLength-1});

function sendData(data) {
	if(streamPaused) {
		// still getting data after stream is paused?
		// and it is still full? keep the data to be sent later
		dataBuffer.push(data);
		return;
	}

	var nextSeqNum = (seqNum + 1) % pack.packet.seqNumModulo;
	if(nextSeqNum === (baseWindow + windowSize) % pack.packet.seqNumModulo) {
		// if we now have windowSize-many unACKed
		// packet after this send
		if(!streamPaused) {
			// stream not paused? pause it
			filereadStream.pause();
			streamPaused = true;
		}
	}

	try {
		var newPacket = pack.packet.createPacket(seqNum, data.toString());
	} catch(e) {
		// error creating a packet
		console.error(e);
		exitProcess(-1);
	}

	// backup the data to be resent again later possibly
	backupBuffer[seqNum] = [newPacket.getUDPData(), newPacket.getSeqNum()];

	if(baseWindow === seqNum) {
		// if we've caught up then set timeout
		timeoutId = setTimeout(timeoutHandler, timeout);
	}
	// send the packet
	senderSocket.send(backupBuffer[seqNum][0], 0, 512, nEmuport, nEmuaddr);
	// record sent packet sequence number
	if(seqnumlog.length !== 0) {
		// give newline if this
		// is not the first packet sent
		seqnumlog+= '\n';
	}

	seqnumlog = seqnumlog + seqNum;
	// now increment the sequence number
	seqNum = nextSeqNum;
}

// register on data read
filereadStream.on('data', sendData);

// register on end read
filereadStream.on('end', function() {
	// we've processed all the data
	// indicate this
	allDataSent = true;
});

function exitProcess(ecode) {
	// deallocate resources
	delete dataBuffer;
	delete backupBuffer;
	// stop timer
	clearTimeout(timeoutId);
	// destroy stream
	filereadStream.destroy();
	// close socket
	senderSocket.close();
	// exit
	process.exit(ecode);
}
