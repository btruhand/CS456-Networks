import sys
import socket
from getsocket import getsocket
from udp import udpsender, udpreceiver

BUFSIZE = 1024

def incorrectIP():
    sys.stderr.write('Incorrect format of address given. Address should be in IPv4 format\n')
    return False

# argument checking
def argscheck():
	if len(sys.argv) != 5:
		sys.stderr.write("Incorrect number of arguments given to server.\nUsage: "
						 "./client.sh <server_address> <n_port> <req_code> <message>\n")
		return False
	else:
		saddr = sys.argv[1]
		count = 0
	for ippart in saddr.split('.'):
		count+= 1
		if not ippart.isdigit():
			return incorrectIP()
		if int(ippart) > 255:
			return incorrectIP()

	if count != 4:
		return incorrectIP()

	if not (sys.argv[2].isdigit() and sys.argv[3].isdigit()):
		sys.stderr.write('Given port and request code needs to be an integer\n')
		return False
	if int(sys.argv[2]) > 65535:
		sys.stder.write('Given port is invalid\n')
		return False

	return True

def client(saddr, nport, reqcode, message):
    #retrieve the IP address of server's machine
    hostname = socket.gethostbyname(socket.gethostname())

    clientSocket = getsocket(socket.SOCK_STREAM)

    # connect to server's socket
    try:
        clientSocket.connect((saddr, int(nport)))
    except socket.error:
        sys.stderr.write('Connection to server failed\n')
        exit(-1)
    
    # send reqcode to server
    clientSocket.sendall(reqcode)

    # receive the UDP port used by the server
    # enough size for a port number
    udpport = clientSocket.recv(16)

    # check if the server gives us the okay sign
    if udpport == '':
        sys.stderr.write('Given request code is incorrect\n')
        clientSocket.close()
        exit(-1)

    # close TCP connection
    clientSocket.close()

    # create a UDP socket and send message, make sure the data is all sent
    clientSocket = getsocket(socket.SOCK_DGRAM)
    
    bytesSent = 0
    sendaddr = (saddr, int(udpport))

    # send the message through udp socket to server
    udpsender(clientSocket, message, sendaddr)

    # receive the reversed message through udp socket from server
    reversedMsg = udpreceiver(clientSocket, BUFSIZE)[0]
    print reversedMsg
	
	# close socket
    clientSocket.close()


if __name__ == "__main__":
    if argscheck():
        # if arguments are correct run client
        client(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
