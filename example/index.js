"use strict";

const {MacScanner} = require("./../index.js");

const config = {
    debug: false,
    initial: false, //if false omits initial entering of all available hosts in the network
    network: "192.168.1.1/24",
    concurrency: 50, //amount of ips that are pinged in parallel
    scanTimeout: 15000 //runs scan every 30 seconds (+ time it takes to execute 250 ips ~ 5 secs)
};

const scanner = new MacScanner(config);
scanner.start();

scanner.on("error", console.error);
scanner.on("scanned", availableHosts => { console.log(availableHosts); });

scanner.on("entered", target => {
    console.log("he is here", target.ip, target.mac);
});

scanner.on("left", target => {
    console.log("he is gone", target.ip, target.mac);
});

scanner.on("changed", target => {
    console.log("changed ip", target.mac, "from", target.oldIP, "to", target.newIP);
});

//scanner.stop(); / scanner.close();