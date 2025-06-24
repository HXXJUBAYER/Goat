const {
  spawn
} = require("child_process");
const http = require("http");
const axios = require("axios");
const logger = require('./utils/log');
const dashboard = http.createServer(function (_0x4a257d, _0xf20805) {
  _0xf20805.writeHead(0xc8, 'OK', {
    'Content-Type': "text/plain"
  });
  _0xf20805.write("HI! EVERYONE , THIS BOT WAS MADE BY Bayjid CHOWDHURY AND FEEL THIS NAME Bayjid BOSS 🌺 ");
  _0xf20805.end();
});
dashboard.listen(process.env.port || 0x0);
logger("Opened server site...", "[ Starting ]");
function startBot(_0x2ed961) {
  if (_0x2ed961) {
    logger(_0x2ed961, "[ Starting ]");
  } else {
    '';
  }
  const _0xe3e7c0 = spawn("node", ["--trace-warnings", "--async-stack-traces", 'mirai.js'], {
    'cwd': __dirname,
    'stdio': "inherit",
    'shell': true
  });
  _0xe3e7c0.on("close", _0x4432ae => {
    if (_0x4432ae != 0x0 || global.countRestart && global.countRestart < 0x5) {
      startBot("Restarting...");
      global.countRestart += 0x1;
      return;
    } else {
      return;
    }
  });
  _0xe3e7c0.on('error', function (_0x4e4d41) {
    logger("An error occurred: " + JSON.stringify(_0x4e4d41), "[ Starting ]");
  });
}
;
axios.get("https://raw.githubusercontent.com/Mrchandu7/chandv2/main/package.json").then(_0x2724e1 => {});
startBot();
