import fs from "fs";

const originalReadFile = fs.readFile;
let mockedResponse: any = null;

function mockedReadFile(path: string, cb: (p1: any, p2: any) => void) {
  setImmediate(() => {
    cb(null, mockedResponse);
  });
}

export function mockEnable(respondWith: any) {
  mockedResponse = respondWith;
  fs.readFile = mockedReadFile as any;
}

export function mockDisable() {
  fs.readFile = originalReadFile;
}
