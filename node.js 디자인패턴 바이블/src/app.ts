async function delay(ms: number) {
  return setTimeout(() => {}, ms);
}

// @ts-ignore
function leakingLoop() {
  // @ts-ignore
  return delay(1).then(() => {
    console.log(`Tick ${Date.now()}`);
    return leakingLoop();
  });
}

leakingLoop();
