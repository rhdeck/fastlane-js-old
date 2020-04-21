//@TODO this is very much early WIP
const { spawnSync } = require("child_process");

const { stdout } = spawnSync("fastlane", ["action"]);
const str = stdout.toString();
// console.log(str);
const str2 = str.replace(/\x1b\[[0-9;]*m/g, ""); //  .replace(/[^ -~]+/g, "");
// console.log(str2);
const lines = str2.split("\n");
const gridLines = lines.filter((l) => l.match(/^[\+\|]/));
console.log(gridLines);
