import socket
import sys
from getsocket import getsocket

def server(reqcode):
    #retrieve the IP address of server's machine
    hostname = socket.gethostbyname(socket.gethostname())

    serverSocket = getsocket(socket.SOCK_STREAM)
    print 'SERVER_PORT=' + str(serverSocket.getsockname()[1])
    print 'SERVER_ADDRESS=' + str(serverSocket.getsockname()[0])

    #start listening, queue 0 connections because we only have one client at a time
    serverSocket.listen(0)

    while True:
        # accept a TCP connection from the client
        # conn is the socket endpoint of the client and addr is the address bound to conn
        print 'Accepting Connection...'
        conn, addr = serverSocket.accept()
        # receive 32 bytes, enough size for an integer
        data = conn.recv(32)
        if reqcode != data:
        # received incorrect req_code from client, close TCP connection with client
            conn.shutdown(1)
            continue
        
        # create a UDP socket
        serverUDP = getsocket(socket.SOCK_DGRAM)

        print 'UDP port=' + str(serverUDP.getsockname()[1])
        print 'UDP IP=' + str(serverUDP.getsockname()[0])
        # send the port number bound to the UDP socket over to the client
        conn.sendall(str(serverUDP.getsockname()[1]))
        serverSocket.shutdown(1)
        serverSocket.close()
        
        print 'Waiting to receive string...'
        data = ''
        while True:
            if data == '':
                data, addr = serverUDP.recvfrom(1024)
            else:
                incdata = serverUDP.recvfrom(1024)[0]
                if incdata == '***':
                    # if sent data identify the last batch to send
                    break
                else:
                    data+= incdata

        print 'Reversing string...'
        data = data[::-1]

        print 'Sending reversed string to client...'
        bytesSent = 0
        while bytesSent != len(data):
            bytesSent+= serverUDP.sendto(data[bytesSent:], addr)

        serverUDP.sendto('***', addr)

        serverUDP.close()

    print 'Server shutting down'

if __name__ == "__main__":
	if len(sys.argv) != 2:
	    sys.stderr.write('Incorrect number of arguments given to server.\nUsage: ./server.sh <req_code>\n')
	else:
	    server(sys.argv[1])
