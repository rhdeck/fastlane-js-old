const { connect } = require("net");
const { spawn } = require("child_process");
const Deferred = require("es6-deferred");
let port = 2000;
let socket = null;
//#region Internal utility functions
const asyncConnect = (options) => {
  const { resolve, reject, promise } = new Deferred();
  const initError = (e) => reject(e);
  try {
    const c = connect(options, () => {
      c.removeListener("error", initError);
      resolve(c);
    });
    c.on("error", initError);
  } catch (e) {
    reject(e);
  }
  return promise;
};
const sleep = (ms) => new Promise((r) => setTimeout(() => r(), ms));
let childProcess;
const launch = (interactive = true) => {
  childProcess = spawn(
    "fastlane",
    ["socket_server", "-c", "30", "-s"],
    interactive
      ? {
          stdio: "inherit",
        }
      : {}
  );
};
const init = async (newPort = 2000) => {
  if (!childProcess) launch();
  // port = newPort; //Ignored for now because fastlane command line doesn't support setting the port
  while (true) {
    const s = (
      await Promise.all(
        ["::1", "127.0.0.1"].map(async (host) => {
          try {
            return await asyncConnect({ host, port });
          } catch (e) {
            return null;
          }
        })
      )
    ).find(Boolean);
    if (s) return (socket = s);
    sleep(500);
  }
};
const send = async ({ commandType, command }) => {
  if (!socket) throw "Socket not initialized";
  const { resolve, reject, promise } = new Deferred();
  const json = JSON.stringify({ commandType, command });
  socket.write(json);
  return waitForData();
};
const dataOnce = (f) => {
  const listener = (d) => {
    socket.removeListener("data", listener);
    f(d);
  };
  socket.on("data", listener);
};
const waitForData = async () => {
  const { resolve, promise } = new Deferred();
  socket.setEncoding("utf8");
  dataOnce((d) => {
    try {
      const o = JSON.parse(d);
      if (typeof o.payload.return_object === "undefined") reject(o);
      const result = o.payload.return_object;
      resolve(result);
    } catch (e) {
      console.log("Coudl not parse json", d);
      reject(e);
    }
  });
  return promise;
};
//#endregion
//#region Exported Functions
const close = async () => {
  const { resolve, promise } = new Deferred();
  childProcess.kill("SIGHUP");
  childProcess = null;
  socket.end(() => {
    socket = null;
    resolve();
  });
  return promise;
};
const doAction = async (action, argObj) => {
  if (!socket) await init();
  const args = argObj
    ? Object.entries(argObj).map(([name, value]) => ({ name, value }))
    : undefined;
  const command = {
    commandType: "action",
    command: { methodName: action, args },
  };
  return send(command);
};
const doActionOnce = async (action, argobj) => {
  const result = await doAction(action, argobj);
  await close();
  return result;
};
//#endregion
module.exports = { doAction, close, doActionOnce, launch };
