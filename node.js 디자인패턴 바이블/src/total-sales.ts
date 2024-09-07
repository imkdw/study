import { Level } from "level";
import subleveldown from "subleveldown";
import { LevelUp } from "levelup";

const db = new Level("example-db") as unknown as LevelUp;
const salesDb = subleveldown(db, "sales", { valueEncoding: "json" });

console.log(db, salesDb);
