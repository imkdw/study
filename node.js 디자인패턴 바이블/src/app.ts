import { readFile } from "fs";

function readJSON(
  filename: string,
  cb: (err: Error | unknown | null, arg?: string) => void
) {
  readFile(filename, "utf8", (err, data) => {
    if (err) {
      return cb(err);
    }

    cb(null, JSON.parse(data)); // 에러가 발생한다면?
  });
}

readJSON("a.json", (err) => console.error(err));
