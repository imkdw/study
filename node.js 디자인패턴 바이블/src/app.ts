import { createServer } from "http";
import { cpus } from "os";
import cluster from "cluster";
import { once } from "events";

const { pid } = process;

if (cluster.isMaster) {
  console.log("master", pid);

  const availableCpus = cpus();
  console.log("Clustering with %d CPUs", availableCpus.length);
  availableCpus.forEach(() => cluster.fork());

  process.on("SIGUSR2", async () => {
    const workers = Object.values(cluster.workers!);
    for (const worker of workers) {
      console.log("Stopping Worker: %d", worker?.process.pid);
      worker?.disconnect();
      await once(worker!, "exit");
      if (!worker?.exitedAfterDisconnect) {
        continue;
      }
      const newWorker = cluster.fork();
      await once(newWorker!, "listening");
    }
  });
} else {
  const server = createServer((req, res) => {
    let i = 1e7;
    while (i > 0) {
      i--;
    }

    res.end(`Hello from worker ${pid}`);
  });

  server.listen(8080, () => {
    console.log(`Worker pid: ${pid}`);
  });
}
