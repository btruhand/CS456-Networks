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
		portSocket = socket.socket(socket.AF_INET, sockettype)
		# request a port
		portSocket.bind((hostname, 0))
		port = portSocket.getsockname()[1]
		portSocket.close()

		try:
			s = socket.socket(socket.AF_INET, sockettype)
			#attempt to bind to port
			try:
				s.bind((hostname, port))
			except socket.error:
				#failure to bind
				continue
		except socket.error:
			#failure to create socket
			continue
		else:
			break
	
	return s
