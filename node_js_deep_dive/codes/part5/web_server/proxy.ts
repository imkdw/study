import http from "node:http";

/**
 * 실제 트래픽이 포워딩될 서버 목록
 */
const backendServers = [
  { host: "localhost", port: 9001 },
  { host: "localhost", port: 9002 },
];

/**
 * RR 알고리즘을 위한 변수
 */
let currentIndex = 0;

const proxyServer = http.createServer((clientReq, proxyRes) => {
  const targetServer = backendServers[currentIndex];
  currentIndex = (currentIndex + 1) % backendServers.length;
  console.log(`[LB] 요청주소 ${clientReq.url} -> 포트 ${targetServer.port} 라우팅`);

  const options = {
    hostname: targetServer.host,
    port: targetServer.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  /**
   * 프록시가 목적시 서버를 향해서 요청을 날림
   */
  const proxyReq = http.request(options, (targetRes) => {
    /**
     * 목적지 서버의 상태코드랑 헤더를 클라이언트 응답 객체에 그대로 복사함
     */
    proxyRes.writeHead(targetRes.statusCode!, targetRes.headers);
    targetRes.pipe(proxyRes);
  });

  proxyReq.on("error", (err) => {
    console.log(`[Proxy Error] 대상 서버랑 통신 불가능 : ${err.message}`);
    proxyRes.writeHead(500);
    proxyRes.end("Internal Server Error");
  });

  clientReq.pipe(proxyReq);
});

proxyServer.listen(9000, () => console.log(`[Proxy] Load Balancer가 9000번 포트에서 실행됨`));
