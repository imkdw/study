import { resolve } from "path";

function createFSAdapter(db: any) {
  return {
    readFile(filename: string, options: any, callback: () => void) {},
    writeFile(filename: string, data: any, callback: () => void) {},
  };
}
