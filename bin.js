const { program } = require("commander");
const { doAction, close, doActionOnce, launch } = require("./");

if (!process.argv[2]) process.argv.push("--help");
// program.parse(process.argv);

const main = async () => {
  launch(false);
  const out = await doAction("adb_devices");
  console.log("out was", out);
  const out2 = await doAction("sh", { command: "ls -l" });
  console.log("out2 was", out2);
  close();
};
main();
