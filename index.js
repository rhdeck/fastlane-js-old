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
const init = async (interactive = true, newPort = 2000) => {
  if (!childProcess) launch(interactive);
  if (socket) return socket;
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
const once = (event, f) => {
  const listener = (d) => {
    socket.removeListener(event, listener);
    f(d);
  };
  socket.on(event, listener);
  return () => socket.removeListener(event, listener);
};
const send = async ({ commandType, command }) => {
  if (!socket) throw "Socket not initialized";
  const json = JSON.stringify({ commandType, command });
  socket.write(json);
  const { resolve, promise, reject } = new Deferred();
  socket.setEncoding("utf8");
  const removeError = once("error", (d) => reject(d));
  once("data", (d) => {
    try {
      removeError();
      const o = JSON.parse(d);
      if (o.payload) {
        if (o.payload.status === "failure") {
          reject({
            error: "fastlane_failure",
            description: o.payload.failure_information.join("\n"),
          });
        } else if (typeof o.payload.return_object === "undefined") {
          reject(o);
        }
        const result = o.payload.return_object;
        resolve(result);
      }
    } catch (e) {
      console.log("Coudl not parse json", d);
      removeError();
      reject(e);
    }
  });
  return promise;
};
//#endregion
//#region Exported Functions
const close = async () => {
  const { resolve, promise } = new Deferred();
  const remove = once("error", () => {});
  socket.end(() => {
    remove();
    socket = null;
    childProcess.kill("SIGHUP");
    childProcess = null;
    resolve();
  });
  return promise;
};
const doAction = async (action, argObj) => {
  await init();
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
module.exports = { doAction, close, doActionOnce, init };
