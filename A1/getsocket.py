import socket

def getsocket(sockettype):
	#retrieve the IP address of server's machine
	hostname = socket.gethostbyname(socket.gethostname())

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
			s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
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
