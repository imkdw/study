import glob from "glob";
import path from "path";

glob.glob("static/*", (err, files) => {
  if (err) {
    return console.error(err);
  }

  console.log("All files found");
});
