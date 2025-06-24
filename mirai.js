const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");
const logger = require("./utils/log");
const login = require("./mirai");
const moment = require("moment-timezone");
const axios = require("axios");
const cron = require("node-cron");

const listPackage = JSON.parse(fs.readFileSync("./package.json")).dependencies;
const listbuiltinModules = require("module").builtinModules;

console.log(chalk.bold.blue(`[${moment().tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY")}]`));

global.client = {
  commands: new Map(),
  events: new Map(),
  cooldowns: new Map(),
  eventRegistered: [],
  handleSchedule: [],
  handleReaction: [],
  handleReply: [],
  mainPath: process.cwd(),
  configPath: path.join(process.cwd(), "config.json"),
  getTime: (format) => moment().tz("Asia/Dhaka").format(format),
};

global.data = {
  threadInfo: new Map(),
  threadData: new Map(),
  userName: new Map(),
  userBanned: new Map(),
  threadBanned: new Map(),
  commandBanned: new Map(),
  threadAllowNSFW: [],
  allUserID: [],
  allCurrenciesID: [],
  allThreadID: [],
};

global.utils = require("./utils");
global.nodemodule = {};
global.config = {};
global.language = {};

let configValue;
try {
  configValue = require(global.client.configPath);
  logger("Config Loaded!");
} catch {
  if (fs.existsSync(global.client.configPath.replace(".json", ".js"))) {
    configValue = require(global.client.configPath.replace(".json", ".js"));
    logger(`Found file config: ${global.client.configPath.replace(".json", ".js")}`);
  } else {
    logger("config.json not found!", "error");
    return;
  }
}
Object.assign(global.config, configValue);

const langFile = fs.readFileSync(path.join(__dirname, "/languages/", global.config.language || "en") + ".lang", { encoding: "utf-8" }).split(/\r?\n/);
const langData = langFile.filter(line => line && !line.startsWith("#"));
for (const item of langData) {
  const [key, value] = item.split("=");
  const [head, subKey] = key.split(".");
  global.language[head] = global.language[head] || {};
  global.language[head][subKey] = value.replace(/\\n/g, "\n");
}

let appState;
try {
  appState = require(path.join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json"));
  logger(global.utils.getText("mirai", "foundPathAppstate"));
} catch {
  logger(global.utils.getText("mirai", "notFoundPathAppstate"), "error");
  return;
}

async function checkBan(api) {
  global.checkBan = true;
  const [homeDir, platform] = [process.cwd(), process.platform];
  if (fs.existsSync("/home/runner/.miraigban")) {
    const readline = require("readline");
    const totp = require("totp-generator");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    logger(global.utils.getText("mirai", "checkListGban"), "warn");
    rl.on("line", async (input) => {
      if (isNaN(input) || input.length !== 6) {
        console.log(global.utils.getText("mirai", "keyNotSameFormat"));
      } else {
        const response = await axios.get("https://raw.githubusercontent.com/Mrchandu7/trick/main/listban.json");
        const totpCode = totp(String(response.data).replace(/\s+/g, "").toLowerCase());
        if (totpCode === input) {
          fs.rm("/home/runner/.miraigban", { recursive: true });
          rl.close();
          logger(global.utils.getText("mirai", "unbanDeviceSuccess"), "warn");
        } else {
          console.error(global.utils.getText("mirai", "keyNotSameFormat"));
        }
      }
    });
    return;
  }
  const response = await axios.get("https://raw.githubusercontent.com/Mrchandu7/trick/main/listban.json");
  for (const userID of global.data.allUserID) {
    if (response.data[userID] && !global.data.userBanned.has(userID)) {
      global.data.userBanned.set(userID, { reason: response.data[userID].reason, dateAdded: response.data[userID].dateAdded });
    }
  }
  for (const threadID of global.data.allThreadID) {
    if (response.data[threadID] && !global.data.threadBanned.has(threadID)) {
      global.data.threadBanned.set(threadID, { reason: response.data[threadID].reason, dateAdded: response.data[threadID].dateAdded });
    }
  }
  const adminBots = require(global.client.configPath).ADMINBOT || [];
  for (const adminID of adminBots) {
    if (response.data[adminID]) {
      logger(global.utils.getText("mirai", "userBanned", response.data[adminID].dateAdded, response.data[adminID].reason), "warn");
      fs.mkdirSync(homeDir + "/.miraigban");
      if (platform === "win32") execSync(`attrib +H +S ${homeDir}/.miraigban`);
      process.exit(0);
    }
  }
  if (response.data[api.getCurrentUserID()]) {
    logger(global.utils.getText("mirai", "userBanned", response.data[api.getCurrentUserID()].dateAdded, response.data[api.getCurrentUserID()].reason), "warn");
    fs.mkdirSync(homeDir + "/.miraigban");
    if (platform === "win32") execSync(`attrib +H +S ${homeDir}/.miraigban`);
    process.exit(0);
  }
  const factResponse = await axios.get("https://raw.githubusercontent.com/Mrchandu7/trick/main/data.json");
  logger(factResponse.data[Math.floor(Math.random() * factResponse.data.length)], "");
  logger(global.utils.getText("mirai", "finishCheckListGban"), "warn");
}

async function onBot({ models }) {
  const api = await login({ appState });
  global.config.FCAOption = api.getAppState();
  fs.writeFileSync(path.join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json"), JSON.stringify(api.getAppState(), null, "\t"));
  global.config.version = "10.2.14";
  global.client.timeStart = new Date().getTime();

  const commandFiles = fs.readdirSync(path.join(global.client.mainPath, "/modules/commands")).filter(file => file.endsWith(".js") && !file.includes("example") && !global.config.commandDisabled.includes(file));
  for (const file of commandFiles) {
    try {
      const command = require(path.join(global.client.mainPath, "/modules/commands", file));
      if (!command.config || !command.run || !command.config.name) throw new Error(global.utils.getText("mirai", "notFoundPackage"));
      if (global.client.commands.has(command.config.name)) throw new Error(global.utils.getText("mirai", "nameExist"));
      if (command.config.dependencies) {
        for (const dep in command.config.dependencies) {
          const depPath = path.join(__dirname, "nodemodules", "node_modules", dep);
          if (!global.nodemodule[dep]) {
            if (listPackage[dep] || listbuiltinModules.includes(dep)) {
              global.nodemodule[dep] = require(dep);
            } else {
              global.utils[dep] = require(depPath);
            }
          }
        }
      }
      if (command.onLoad) {
        await command.onLoad({ api, models });
      }
      global.client.commands.set(command.config.name, command);
      logger(global.utils.getText("mirai", "successLoadModule", command.config.name));
    } catch (error) {
      logger(global.utils.getText("mirai", "failLoadModule", command.config.name, error), "error");
    }
  }

  // Load events
  const eventFiles = fs.readdirSync(path.join(global.client.mainPath, "/modules/events")).filter(file => file.endsWith(".js") && !global.config.eventDisabled.includes(file));
  for (const file of eventFiles) {
    try {
      const event = require(path.join(global.client.mainPath, "/modules/events", file));
      if (!event.config || !event.run) throw new Error(global.utils.getText("mirai", "notFoundPackage"));
      if (global.client.events.has(event.config.name)) throw new Error(global.utils.getText("mirai", "nameExist"));
      if (event.config.dependencies) {
        for (const dep in event.config.dependencies) {
          const depPath = path.join(__dirname, "nodemodules", "node_modules", dep);
          if (!global.nodemodule[dep]) {
            if (listPackage[dep] || listbuiltinModules.includes(dep)) {
              global.nodemodule[dep] = require(dep);
            } else {
              global.utils[dep] = require(depPath);
            }
          }
        }
      }
      if (event.onLoad) {
        await event.onLoad({ api, models });
      }
      global.client.events.set(event.config.name, event);
      logger(global.utils.getText("mirai", "successLoadModule", event.config.name));
    } catch (error) {
      logger(global.utils.getText("mirai", "failLoadModule", event.config.name, error), "error");
    }
  }

  logger(global.utils.getText("mirai", "finishLoadModule", global.client.commands.size, global.client.events.size));
  logger(`=== ${Date.now() - global.client.timeStart}ms ===`);
  fs.writeFileSync(global.client.configPath, JSON.stringify(global.config, null, 4));
  fs.unlinkSync(global.client.configPath + ".temp");

  global.client.api = api;
  const handleListen = require("./includes/listen")({ api, models });
  global.handleListen = api.listenMqtt((error, event) => {
    if (error) return logger(global.utils.getText("mirai", "handleListenError", JSON.stringify(error)), "error");
    if (["presence", "typ", "read_receipt"].includes(event.type)) return;
    return handleListen(event);
  });

  await checkBan(api);
  if (!global.checkBan) logger(global.utils.getText("mirai", "banDevice"), "warn");

  const cron = require("node-cron");
  const randomFact = cron.schedule("0 */5 * * * *", () => {
    api.getThreadList(100, null, ["INBOX"], (error, threads) => {
      if (error) return console.error("ERR: " + error);
      threads.forEach(thread => {
        if (thread.isGroup && thread.threadID !== threads.threadID) {
          api.sendMessage("THIS BOT MADE BY BAYJID,CHOWDHURY.\n\n" + randomFact, thread.threadID);
        }
      });
    });
  }, { scheduled: true, timezone: "Asia/Dhaka" });
}

(async () => {
  try {
    await sequelize.authenticate();
    const models = require("./includes/database/model")({ Sequelize, sequelize });
    logger(global.utils.getText("mirai", "successConnectDatabase"), "success");
    await onBot({ models });
  } catch (error) {
    logger(global.utils.getText("mirai", "error", JSON.stringify(error)), "error");
  }
})();
