"use strict";
class Url {
    constructor(protocol, username, password, hostname, port, pathname, search, hash) {
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.hostname = hostname;
        this.port = port;
        this.pathname = pathname;
        this.search = search;
        this.hash = hash;
        this.validate();
    }
    validate() {
        if (!this.protocol || !this.hostname) {
            throw new Error("protocol and hostname are required");
        }
    }
    toString() {
        return `${this.protocol}://${this.username}:${this.password}@${this.hostname}:${this.port}${this.pathname}${this.search}${this.hash}`;
    }
}
class UrlBuilder {
    setProtocol(protocol) {
        this.protocol = protocol;
        return this;
    }
    setUsername(username) {
        this.username = username;
        return this;
    }
    setPassword(password) {
        this.password = password;
        return this;
    }
    setHostname(hostname) {
        this.hostname = hostname;
        return this;
    }
    setPort(port) {
        this.port = port;
        return this;
    }
    setPathname(pathname) {
        this.pathname = pathname;
        return this;
    }
    setSearch(search) {
        this.search = search;
        return this;
    }
    setHash(hash) {
        this.hash = hash;
        return this;
    }
    build() {
        return new Url(this.protocol, this.username, this.password, this.hostname, this.port, this.pathname, this.search, this.hash);
    }
}
const url = new UrlBuilder()
    .setProtocol("http")
    .setHostname("localhost")
    .setPort("8080")
    .setPathname("/api/v1")
    .setSearch("?key=value")
    .setHash("#hash")
    .build();
console.log(url.toString());
