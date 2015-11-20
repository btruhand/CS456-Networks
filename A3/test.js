var packets = require('./packets');

obj = new packets.pkt_HELLO(1,2);
obj2 = new packets.pkt_LSPDU(1,1,1,1);

console.log(Object.getOwnPropertyNames(obj));
console.log(obj.getRouterID());
console.log(Object.getOwnPropertyNames(obj2));
