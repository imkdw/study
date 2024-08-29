import EventEmitter from "events";

let count = 0;

const tick = (emitter: EventEmitter, ms: number) => {
  if (ms % 5 === 0) {
    throw new Error("ms must be a multiple of 5");
  }

  count++;
  emitter.emit("tick");
};

const ticker = (ms: number, cb: (count: number) => void) => {
  const eventEmitter = new EventEmitter();

  try {
    tick(eventEmitter, ms);
    const interval = setInterval(() => tick(eventEmitter, ms), 50);
    setTimeout(() => {
      clearInterval(interval);
      cb(count);
    }, ms);
  } catch (err) {
    eventEmitter.emit("error", err);
  }

  return eventEmitter;
};

const emitter = ticker(500, (count) => {
  console.log(count);
})
  .on("tick", () => {})
  .on("error", (err) => {
    console.error(err);
  });
