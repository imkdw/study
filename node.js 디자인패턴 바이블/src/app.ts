import EventEmitter from "events";

class TaskQueue extends EventEmitter {
  private concurrency: number; // 동시성 제한
  private queue: any[]; // 보류중인 작업 저장
  private running: number; // 실행중인 모든 작업 개수
  private completed: number;

  constructor(concurrency: number) {
    super();

    this.concurrency = concurrency;
    this.queue = [];
    this.running = 0;
    this.completed = 0;
  }

  pushTask(task: any) {
    this.queue.push(task);
    process.nextTick(this.next.bind(this));
    return this;
  }

  next() {
    while (this.running === 0 && this.queue.length === 0) {
      return this.emit("empty");
    }

    while (this.running < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      task((err: unknown) => {
        if (err) {
          return this.emit("error", err);
        }

        this.running--;
        process.nextTick(this.next.bind(this));
      });
      this.running++;
    }
  }
}

const queue = new TaskQueue(2);
queue
  .on("empty", () => {
    console.log("all tasks are done");
  })
  .on("error", (err) => {
    console.error(err);
  });
