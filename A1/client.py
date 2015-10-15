import sys
import socket
from getsocket import getsocket

def client(saddr, nport, reqcode, message):
	#retrieve the IP address of server's machine
	hostname = socket.gethostbyname(socket.gethostname())

	clientSocket = getsocket(socket.SOCK_STREAM)

	# connect to server's socket
	clientSocket.connect((saddr, nport))
	
	# send reqcode to server
	clientSocket.sendall(reqcode)

	# receive the UDP port used by the server, max 16 bytes
	udpport = clientSocket.recv(16)

	# close TCP connection
	clientSocket.close()

	# create a UDP socket and send message, make sure the data is all sent
	clientSocket = getsocket(socket.SOCK_DGRAM)
	
	sendallData = 0
	while sendallData != len(message):
		bytesSent = clientSocket.sendto(message[bytesSenti:], (saddr, udpport))
		sendallData+= bytesSent


	clientSocket.sendall(message)

	pass

if __name__ == "__main__":
	if len(sys.argv) != 5:
		sys.stderr.write('Incorrect number of arguments given to server.\nUsage: ./client.sh <server_address> <n_port> <req_code> <message>\n')
	else:
		client(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
