import EventEmitter from "events";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ProcessPool } from "./process-pool";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerFile = join(__dirname, "subsetSumProcessWorker.js");
const workers = new ProcessPool(workerFile, 2);

export class SubsetSumFork extends EventEmitter {
  private sum: any;
  private set: any;

  constructor(sum: any, set: any) {
    super();
    this.sum = sum;
    this.set = set;
  }

  async start() {
    const worker = await workers.acquire();
    worker.send({ sum: this.sum, set: this.set });
    const onMessage = (msg: any) => {
      if (msg.event === "end") {
        worker.removeListener("message", onMessage);
        workers.release(worker);
      }

      this.emit(msg.event, msg.data);
    };

    worker.on("message", onMessage);
  }
}
