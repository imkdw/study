import fs from "fs";
import path from "path";
import superagent from "superagent";
import { mkdirp } from "mkdirp";
import { urlToFilename } from "./utils.js";

export function spider(
  url: string,
  cb: (err: Error | null, filename?: string, downloaded?: boolean) => void
) {
  const filename = urlToFilename(url);
  fs.access(filename, (err) => {
    // [1]
    if (err && err.code === "ENOENT") {
      console.log(`Downloading ${url} into ${filename}`);
      superagent.get(url).end((err, res) => {
        // [2]
        if (err) {
          cb(err);
        } else {
          saveFile(filename, res.text, (err) => {
            if (err) {
              cb(err);
            } else {
              cb(null, filename, true);
            }
          });
        }
      });
    } else {
      cb(null, filename, false);
    }
  });
}

function saveFile(
  filename: string,
  contents: string,
  cb: (err: Error | null) => void
) {
  mkdirp(path.dirname(filename), (err) => {
    if (err) {
      return cb(err);
    }

    fs.writeFile(filename, contents, (err) => {
      if (err) {
        return cb(err);
      }

      cb(null);
    });
  });
}
