var x = new Buffer(4);
x[0] = 100;
x[1] = 100;
x[2] = 0;
console.log(x[0]);
console.log(x[1]);
console.log(x.length);
console.log(x.toString('utf8',0));
