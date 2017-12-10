# MacScanner

## What does it do?

- with macscanner you can monitor mac-address appearances, leaves and ip address changes
- almost in real-time (depdening on configuration and network size)
- you can only monitor private networks, of which the host running the scanner is a client
- it works by calculating all hosts in the network, pinging them and grabbing the mac-address from an arp table

## What does it require?

- will not work on windows (tested on ubuntu only, but mac should work as well)
- requires `arp`
- requires access to `raw sockets`, there is a good chance that you need to start the app with elevated rights
- starting with elevated rights can work like this `sudo $(which node) index.js`
- requires node version >= 8

## How to use it?

- install via `npm -g mac-scanner`
- checkout the example [here](example/index.js)

```javascript
"use strict";
const {MacScanner} = require("mac-scanner");

const scanner = new MacScanner(config);
scanner.start();

scanner.on("entered", target => {
    console.log("he is here", target.ip, target.mac);
});

scanner.on("left", target => {
    console.log("he is gone", target.ip, target.mac);
});

scanner.on("changed", target => {
    console.log("changed ip", target.mac, "from", target.oldIP, "to", target.newIP);
});
```