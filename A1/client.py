import sys
import socket
from getsocket import getsocket

def client(saddr, nport, reqcode, message):
    #retrieve the IP address of server's machine
    hostname = socket.gethostbyname(socket.gethostname())

    clientSocket = getsocket(socket.SOCK_STREAM)

    # connect to server's socket
    clientSocket.connect((saddr, int(nport)))
    
    # send reqcode to server
    clientSocket.sendall(reqcode)

    # receive the UDP port used by the server, max 16 bytes
    udpport = clientSocket.recv(16)

    if udpport == '':
        sys.stderr.write('Given request code is incorrect\n')
        clientSocket.close()
        exit(-1)

    # close TCP connection
    clientSocket.close()

    # create a UDP socket and send message, make sure the data is all sent
    clientSocket = getsocket(socket.SOCK_DGRAM)
    
    bytesSent = 0
    udpport = int(udpport)
    while bytesSent != len(message):
        bytesSent+= clientSocket.sendto(message[bytesSent:], (saddr, udpport))

    clientSocket.sendto('***', (saddr, udpport))

    reversedMsg = ''
    while True:
        if reversedMsg == '':
            reversedMsg = clientSocket.recvfrom(1024)[0]
        else:
            incdata = clientSocket.recvfrom(1024)[0]
            if incdata == '***':
                # if sent data identify the last batch to send
                break
            else:
                reversedMsg+= incdata

    print 'Reversed message from server:', reversedMsg
    clientSocket.close()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.stderr.write('Incorrect number of arguments given to server.\nUsage: ./client.sh <server_address> <n_port> <req_code> <message>\n')
    else:
        client(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
