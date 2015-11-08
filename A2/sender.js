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
var backupBuffer = new Array(windowSize);
var timeout = 150;

var seqnumlog = '';
var acklog = '';

var allDataSent = false;
var dataBuffer = new Array(0);
var streamPaused = false;

function sendEOTPacket() {
	if(allDataSent) {
		console.log('EOT being sent');
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
	console.log('Expecting sequence number ' + baseWindow);
	if(receiverPacket.getType() === pack.ACK) {
		var ACKseqnum = receiverPacket.getSeqNum();
		console.log('Got ACK with sequence number ' + ACKseqnum);
		
		if((ACKseqnum < baseWindow) || ACKseqnum > seqNum) {
			// here ACKseqnum maybe an ACK for a packet older
			// than the most recent ACKed packet
			// this may happen if the current packet sequence #
			// is less than the baseWindow, or if the baseWindow
			// has wrapped around, then that must mean that
			// the packet sequence # is greater than the next
			// sequence # to use
			// we simply exit in this case
			//
			// here we use the fact that the windowSize is only 10
			// or generally <= n/2, where n is the sequence number pool
			return;
		}

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

			// stream possibly paused before, resume it
			filereadStream.resume();
		} else {
			// stop and restart timer
			clearTimeout(timeoutId);
			timeoutId = setTimeout(timeoutHandler, timeout);
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

		console.log('Sender shutting down...\n');
		exitProcess(0);
	}
});

// bind socket to port
senderSocket.bind(receivingAtPort);

function timeoutHandler() {
	// reset timer
	timeoutId = setTimeout(timeoutHandler, timeout);
	for(var i = baseWindow % windowSize; i != seqNum % windowSize; i = (i+1) % windowSize) {
		if(seqnumlog.length !== 0) {
			// give newline if this
			// is not the first packet sent
			seqnumlog+= '\n';
		}
		seqnumlog = seqnumlog + backupBuffer[i][1].getSeqNum();
		
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
		// oacket after this send
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
	backupBuffer[seqNum % windowSize] = [newPacket.getUDPData(), newPacket];

	senderSocket.send(backupBuffer[seqNum % windowSize][0], 0, 512, nEmuport, nEmuaddr);
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

// set timeout at 150 seconds
var timeoutId = setTimeout(timeoutHandler, timeout);

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
