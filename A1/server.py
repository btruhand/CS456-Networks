import socket
import sys
from getsocket import getsocket
from udp import udpsender, udpreceiver

BUFSIZE = 1024

def server(reqcode):
    #retrieve the IP address of server's machine
    hostname = socket.gethostbyname(socket.gethostname())
    
    serverSocket = getsocket(socket.SOCK_STREAM)
    print 'SERVER_PORT=' + str(serverSocket.getsockname()[1])
    
    #start listening, queue 0 connections because we only have one client at a time
    serverSocket.listen(0)
    

    while True:
        sys.stderr.write('Accepting Connection...\n')
        conn, addr = serverSocket.accept()

        # accept a TCP connection from the client
        # conn is the socket endpoint of the client and addr is the address bound to conn
        # receive 32 bytes, enough size for an integer
        data = conn.recv(32)
        
        if reqcode != data:
            # received incorrect req_code from client, close TCP connection with client
            conn.shutdown(1)
            continue
        
        # create a UDP socket
        serverUDP = getsocket(socket.SOCK_DGRAM)

        # send the port number bound to the UDP socket over to the client
        conn.sendall(str(serverUDP.getsockname()[1]))
       
        # receive the message from client
        sys.stderr.write('Waiting to receive message...\n')
        message, clientaddr = udpreceiver(serverUDP, BUFSIZE)

        #reverse message
        message = message[::-1]

        sys.stderr.write('Sending reversed message to client...\n')
        udpsender(serverUDP, message, clientaddr)

        # close UDP socket
        serverUDP.close()

    # close TCP connection
    serverSocket.close()

if __name__ == "__main__":
	if len(sys.argv) != 2:
	    sys.stderr.write('Incorrect number of arguments given to server.\nUsage: ./server.sh <req_code>\n')
	else:
	    server(sys.argv[1])
