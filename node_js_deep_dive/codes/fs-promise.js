import promiseFs from "node:fs/promises";
import fs from "node:fs";

/**
 * Promise API
 */
try {
  await promiseFs.copyFile("./src.txt", "./copied-src.txt");
  console.log("Promise API : Complete!");
} catch (error) {
  console.log("error: ", error);
}

/**
 * Callback API
 */
fs.copyFile("./src.txt", "./copied-src.txt", (error) => {
  if (error) {
    console.log("error: ", error);
    return;
  }

  console.log("Callback API : Complete!");
});

/**
 * Sync API
 */
fs.copyFileSync("./src.txt", "./copied-src.txt");
console.log("Sync API : Complete!");
