const { connect } = require("net");
const { spawn } = require("child_process");
const Deferred = require("es6-deferred");
let port = 2000;
let socket = null;
class Fastlane {
  constructor(port = 2000, isInteractive = true) {
    this.port = port;
    this.socket = null;
    this.isInterfactive = isInteractive;
    this.childProcess = null;
  }
  async start() {
    if (!this.childProcess)
      this.childProcess = await launch(isInteractive, this.port);
    if (!this.socket) this.socket = await init(this.port);
  }
  async close() {
    const { resolve, promise } = new Deferred();
    const remove = once(this.socket, "error", () => {});
    this.socket.end(() => {
      remove();
      socket = null;
      this.childProcess.kill("SIGHUP");
      this.childProcess = null;
      resolve();
    });
    return promise;
  }
  async send({ commandType, command }) {
    if (!socket) throw "Socket not initialized";
    const json = JSON.stringify({ commandType, command });
    this.socket.write(json);
    const { resolve, promise, reject } = new Deferred();
    this.socket.setEncoding("utf8");
    const removeError = once(this.socket, "error", (d) => reject(d));
    once("data", (d) => {
      try {
        removeError();
        const o = JSON.parse(d);
        try {
          if (o.payload) {
            if (o.payload.status === "failure") {
              reject({
                error: "fastlane_failure",
                description: o.payload.failure_information.join("\n"),
                raw: o,
              });
            } else if (typeof o.payload.return_object === "undefined") {
              reject(o);
            }
            const result = o.payload.return_object;
            resolve(result);
          }
        } catch (e) {
          console.log("Problem resolving the payload after parsing");
          reject(e);
        }
      } catch (e) {
        console.log("Could not parse json", d);
        removeError();
        reject(e);
      }
    });
    return promise;
  }
  async doAction(action, argObj) {
    await this.start();
    const args = argObj
      ? Object.entries(argObj).map(([name, value]) => ({ name, value }))
      : undefined;
    const command = {
      commandType: "action",
      command: { methodName: action, args },
    };
    return this.send(command);
  }
}
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
const launch = (interactive = true, port = 2000) => {
  return spawn(
    "fastlane",
    ["socket_server", "-c", "30", "-s", ...(port !== 2000 ? ["-p", port] : [])],
    { ...(interactive ? { stdio: "inherit" } : {}) }
  );
};
const init = async (port = 2000) => {
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
    if (s) return s;
    sleep(500);
  }
};
const once = (socket, event, f) => {
  const listener = (d) => {
    socket.removeListener(event, listener);
    f(d);
  };
  socket.on(event, listener);
  return () => socket.removeListener(event, listener);
};
//#endregion
//#region Exported Functions

const withFastlane = async (options, f) => {
  port = 2000;
  isInteractive = true;
  if (!options) f = options;
  else {
    port = options.port;
    isInteractive = options.isInteractive;
  }
  const fastlane = new Fastlane(port, isInteractive);
  const result = await f(fastlane);
  fastlane.close();
  return result;
};
const doActionOnce = async (
  action,
  argobj,
  isInteractive = true,
  port = 2000
) =>
  withFastLane({ port, isInteractive }, ({ doAction }) =>
    doAction(action, argobj)
  );

//#endregion
module.exports = {
  Fastlane,
  doActionOnce,
  withFastlane,
};
