import os from "node:os";

const netInterfaces = os.networkInterfaces();

// [
//   'lo0',       'utun0',
//   'utun1',     'utun2',
//   'utun3',     'en0',
//   'awdl0',     'llw0',
//   'bridge100', 'bridge101',
//   'bridge102', 'bridge104',
//   'bridge103', 'utun4',
//   'utun5',     'utun6',
//   'utun7'
// ]
console.log(Object.keys(netInterfaces));

// {
//   address: '127.0.0.1',
//   netmask: '255.0.0.0',
//   family: 'IPv4',
//   mac: '00:00:00:00:00:00',
//   internal: true,
//   cidr: '127.0.0.1/8'
// }
console.log(netInterfaces["lo0"][0]);
