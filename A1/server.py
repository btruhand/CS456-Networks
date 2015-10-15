import socket
import sys
from getsocket import getsocket

def server(reqcode):
	#retrieve the IP address of server's machine
	hostname = socket.gethostbyname(socket.gethostname())

	serverSocket = getsocket(socket.SOCK_STREAM)
	print 'SERVER_PORT=' + str(serverSocket.getsockname()[1])

	#start listening, queue 0 connections because we only have one client at a time
	serverSocket.listen(0)

	# start accepting connections			
	while True:
		# accept a TCP connection from the client
		# conn is the socket endpoint of the client and addr is the address bound to conn
		print 'here'
		conn, addr = serverSocket.accept()
		print 'hey'
		# receive 32 bytes, enough size for an integer
		data = conn.recv(32)
		if reqcode != data:
		# received incorrect req_code from client, close TCP connection
			break
		
		# create a UDP socket
		serverUDP = getsocket(socket.SOCK_DGRAM)
	
		# send the port number bound to the UDP socket over to the client
		conn.sendall(str(serverUDP.getsockname()[1]))

		# receive data 1024 bytes max, get the address of sender
		data, addr = serverUDP.recvfrom(1024)
		reversedData = data[::-1]

		# send reversed string to client, do some more stuff here
		serverUDP.sendto(reversedData, addr)

	serverSocket.close()

if __name__ == "__main__":
	if len(sys.argv) != 2:
		sys.stderr.write('Incorrect number of arguments given to server.\nUsage: ./server.sh <req_code>\n')
	else:
		server(sys.argv[1])
