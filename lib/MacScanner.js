"use strict";

const Promise = require("bluebird");
const EventEmitter = require("events");
const async = require("async");
const ipm = require("ip");
const ping = require ("net-ping");
const arp = require("node-arp");
const debugModule = require("debug");

const DEBUG_NAME = "macscanner:main";
const debug = debugModule(DEBUG_NAME);

const rangeToHosts = (start, stop) => {

    debug(start, "->", stop);

    start = ipm.toLong(start);
    stop = ipm.toLong(stop);

    const hosts = [];
    for(let i = start + 1; i < stop + 1; i++){
        hosts.push(ipm.fromLong(i));
    }

    debug("found hosts:", hosts.length);
    return hosts;
};

const pingPromise = (host, session = null) => {

    //debug("ping", host, !!session);

    if(!session){
        session = ping.createSession();
    }

    return new Promise((resolve, reject) => {
        session.pingHost (host, function (error, target) {

            if(error){
                return reject(error);
            }

            resolve(target);
        });
    });
};

const getAvailableHosts = (hosts, limit = 3, session = null) => {
    return new Promise((resolve, reject) => {
        
        if(!session){
            session = ping.createSession();
        }

        const available = [];
        async.eachLimit(hosts, limit, 
            (host, callback) => {
                pingPromise(host, session)
                    .then(target => {
                        available.push(host);
                        callback();
                    })
                    .catch(error => callback());
            },
            (error, results) => {
                
                if(error){
                    return reject(error);
                }

                resolve(available);
        });
    });
};

const getMacForIP = ip => {
    return new Promise((resolve, _) => {
        arp.getMAC(ip, (error, mac) => {

            if(error || !mac){
                return resolve(null);
            }

            resolve(mac);
        });
    });
};

const addMacToIPs = hosts => {

    const promises = hosts.map(ip => {
        return getMacForIP(ip).then(mac => {
            return {
                ip,
                mac
            };
        });
    });

    return Promise.all(promises);
};

class MacScanner extends EventEmitter {

    constructor(config = {}){
        super();

        if(config.debug){ //as the env vars might not work in sudo calls
            debugModule.enable(DEBUG_NAME);
        }

        config.icmp = {
            networkProtocol: ping.NetworkProtocol.IPv4,
            packetSize: 12,
            retries: 0,
            sessionId: (process.pid % 65535),
            timeout: 800,
            ttl: 128
        };

        this.config = config;

        this.session = ping.createSession(this.config.icmp);
        this.network = ipm.cidrSubnet(this.config.network);
        debug(this.network);
        this.hosts = rangeToHosts(this.network.firstAddress, this.network.lastAddress);

        this.hold = false;
        this.lstate = [];
    }

    _compareStates(state){

        //detect leaves

        this.lstate.forEach(lh => {

            let found = false;
            state.forEach(nh => {
                if(lh.mac === nh.mac){
                    found = true;

                    if(lh.ip !== nh.ip){
                        debug("changed ip", lh.mac, lh.ip, nh.ip);
                        super.emit("changed", {
                            mac: lh.mac,
                            oldIP: lh.ip,
                            newIP: nh.ip
                        });
                    }
                }
            });

            if(!found){
                debug("leaver", lh.ip, lh.mac);
                super.emit("left", lh);
            }
        });

        //detect entries

        state.forEach(nh => {

            if(!this.config.initial && !this.lstate.length){
                return; //no initial entries
            }

            let found = false;
            this.lstate.forEach(lh => {
                if(nh.mac === lh.mac){
                    found = true;
                }
            });

            if(!found){
                debug("appeared", nh.ip, nh.mac);
                super.emit("entered", nh);
            }
        });
        
        //new state = last state
        this.lstate = state;
    }

    _scanRecursive(){

        if(this.hold){
            return; //stop
        }

        this._runScan().then(_ => {
            setTimeout(() => {
                this._scanRecursive();
            }, this.config.scanTimeout);
        });
    }

    _runScan(){
        return getAvailableHosts(this.hosts, this.config.concurrency, this.session).then(ahosts => {
            return addMacToIPs(ahosts).then(rhosts => {
                debug("scan done", rhosts.length);
                super.emit("scanned", rhosts);
                this._compareStates(rhosts);
                return true;
            });
        }).catch(error => {
            debug("scan failed", error);
            super.emit("error", error);
            return false;
        });
    }

    /**
     * starts scan interval
     */
    start(){
        this.hold = false;
        this._scanRecursive();
    }

    /**
     * stops scan interval
     */
    stop(){
        this.hold = true;
    }

    /**
     * alias of stop
     */
    close(){
        this.stop();
    }
}

module.exports = {
    default: MacScanner,
    MacScanner,
    rangeToHosts,
    pingPromise,
    getAvailableHosts,
    getMacForIP,
    addMacToIPs
};