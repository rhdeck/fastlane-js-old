# fastlane-js

Javascript interface to fastlane

## Requirements

**Fastlane** is required

## Installation

```
yarn add @raydeck/fastlane
```

## Usage

### async doAction(action, arguments) => Any

Returns the same result as running this fastlane result in Ruby would. (note that there are excceptions where the Fastlane socket driver delivers suboptimal serializations of Ruby objects, such as with the action `adb_devices`)

### async withFastlane(function ()=> Promise, isInteractive = true)

The main helper function to control a fastlane session. Wrap calls to doAction inside this call.

- **function**: `async` function (returning a promise) containing the block of code to run during the Fastlane session. Note the session is initialized right before executing the function and closed right afterward.
- **isInteractive**: Boolean of whether to pass stdin/stdout of the socket server to the calling client. This should be `true` when you might need to respond to requests for, say, apple logins.

```js
await withFastlane(async () => {
  await doAction("send_to_testflight", { application_id: "xxxx" /*...*/ });
});
```

## Additional Helper functions

### async init(isInteractive = true) => Socket

Imperatively initialize the child Fastlane server process and connect using sockets. The socket is returned as a convenience, but don't mess with it unless you really know what you are doing.

- **isInteractive**: Boolean of whether to pass stdin/stdout of the socket server to the calling client. This should be `true` when you might need to respond to requests for, say, apple logins.

**Note**: This is run by default at the start of `withFastlane`

### async close() => Void

Close the connection to the fastlane socket server and terminate the fastlane socket server process.

**Note**: This is run by default at the end of `withFastlane`
