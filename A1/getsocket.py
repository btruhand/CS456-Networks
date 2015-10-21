# Module to establish a socket endpoint on a free port

import socket

def getsocket(sockettype):
	# use all the IP address of this machine
	# including localhost (127.0.0.1) equivalent
	# to socket.INADDR_ANY
    hostname = ''
    
    s = None
    port = None
    # attempt to make a socket
    while True:
        try:
            portSocket = socket.socket(socket.AF_INET, sockettype)
            # request a port
            portSocket.bind((hostname, 0))
            port = portSocket.getsockname()[1]
            portSocket.close()
            
            # attempt to get socket
            s = socket.socket(socket.AF_INET, sockettype)
            # attempt to bind to port
            s.bind((hostname, port))
            # managed to get a socket connection
            break
        except socket.error:
            # failure to create socket or bind to socket
            continue
    return s
