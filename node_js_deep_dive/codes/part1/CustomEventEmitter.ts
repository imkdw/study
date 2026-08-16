import CustomerEventEmitter from "./app.ts";

class MyEventEmitter extends CustomerEventEmitter {}
const myEventEmitter = new MyEventEmitter();

myEventEmitter.on("alert", () => console.log("알림 발생함"));
myEventEmitter.on("state_updated", (state: number, msg: string) => {
  console.log(`[상태수정] state: ${state}, msg: ${msg}`);
});
myEventEmitter.on("error", (err: Error) => console.log(`에러발생 : ${err.message}`));

// 알림 발생함
// [상태수정] state: 200, msg: GOOD
// 에러발생 : Test Error
myEventEmitter.emit("alert");
myEventEmitter.emit("state_updated", 200, "GOOD");
myEventEmitter.emit("error", new Error("Test Error"));
