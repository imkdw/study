import EventEmitter from "events";

class Db extends EventEmitter {
  private connected: boolean;
  private commandsQueue: Array<() => void>;

  constructor() {
    super();
    this.connected = false;
    this.commandsQueue = [];
  }

  async query(queryString: string) {
    if (!this.connected) {
      console.log("Request Queued", queryString);

      return new Promise((resolve, reject) => {
        const command = () => {
          this.query(queryString).then(resolve, reject);
        };

        this.commandsQueue.push(command);
      });
    }

    console.log("Query executed", queryString);
  }

  connect() {
    setTimeout(() => {
      this.connected = true;
      this.emit("connected");
      this.commandsQueue.forEach((command) => command());
      this.commandsQueue = [];
    }, 500);
  }
}

export const db = new Db();

class InitializeState {
  async query(queryString: string) {
    console.log("query", queryString);
  }
}

const METHODS_REQUIRING_CONNECTION = ["query"];
const deactivate = Symbol("deactivate");
class QueueingState {
  private db: Db;
  private commandsQueue: Array<() => void>;
  private METHODS_REQUIRING_CONNECTION: string[];

  constructor(db: Db) {
    this.db = db;
    this.commandsQueue = [];
  }

  METHODS_REQUIRING_CONNECTIOn.forEach((method) => {
  (this as any)[method] = function (...args: any[]) {
    console.log("Queueing", method, args);
    return new Promise((resolve, reject) => {
      const command = () => {
        (this as any)[method](...args).then(resolve, reject);
      };

      this.commandsQueue.push(command);
    });
  };
});
}
