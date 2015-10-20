# A module to control how the data will be sent through UDP sockets
# Assumption is there is no "sendall" functionality with UDP sockets

def udpsender(socket, message, addr):
    bytesSent = 0
    while bytesSent != len(message):
        bytesSent+= socket.sendto(message[bytesSent:], addr)

    # tell the receiver that we've sent everything, assume that
    # everything will be sent perfectly
    socket.sendto('***', addr)

def udpreceiver(socket, bufsize):
    data = ''
    senderaddr = None
    while True:
        incdata = None
        if data == '':
            incdata, senderaddr = socket.recvfrom(bufsize)
        else:
            incdata = socket.recvfrom(bufsize)[0]
        
        # if sent data identify the last batch
        # to send then end loop
        if incdata == '***':
            break
        else:
            data+= incdata

    return (data, senderaddr)
