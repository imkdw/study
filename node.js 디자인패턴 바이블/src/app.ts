class Url {
  constructor(
    private protocol: string,
    private username: string,
    private password: string,
    private hostname: string,
    private port: string,
    private pathname: string,
    private search: string,
    private hash: string
  ) {
    this.validate();
  }

  private validate() {
    if (!this.protocol || !this.hostname) {
      throw new Error("protocol and hostname are required");
    }
  }

  toString() {
    return `${this.protocol}://${this.username}:${this.password}@${this.hostname}:${this.port}${this.pathname}${this.search}${this.hash}`;
  }
}

class UrlBuilder {
  private protocol: string;
  private username: string;
  private password: string;
  private hostname: string;
  private port: string;
  private pathname: string;
  private search: string;
  private hash: string;

  setProtocol(protocol: string) {
    this.protocol = protocol;
    return this;
  }

  setUsername(username: string) {
    this.username = username;
    return this;
  }

  setPassword(password: string) {
    this.password = password;
    return this;
  }

  setHostname(hostname: string) {
    this.hostname = hostname;
    return this;
  }

  setPort(port: string) {
    this.port = port;
    return this;
  }

  setPathname(pathname: string) {
    this.pathname = pathname;
    return this;
  }

  setSearch(search: string) {
    this.search = search;
    return this;
  }

  setHash(hash: string) {
    this.hash = hash;
    return this;
  }

  build() {
    return new Url(
      this.protocol,
      this.username,
      this.password,
      this.hostname,
      this.port,
      this.pathname,
      this.search,
      this.hash
    );
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
