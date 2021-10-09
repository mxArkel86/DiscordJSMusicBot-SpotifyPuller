const fs = require("fs");
const ERROR = require("./errorcodes.js");

const serverData = new Map();
var gconfig = {
    token: null,
    downloadUpdateInterval: null,
    deepDebug: null
};

const guildDataDef = {
    textChannel: null, //text channel where bot is linked
    voiceChannel: null, //voice channel where bot is in
    connection: null, //backend connection util
    dispatcher: null, //bot audio manager
    userID: null, //id of user that is linked
    playing: false, //is song playing
    songqueue: [],
    delay: 0, //song delay (backend stuff)
    song: null //song being played
};


function GetData(key) {
    var data = serverData[key];
    if (!data) {
        var output = ERROR.errorcode_1(key);
        if (output != "") console.log(output);
        return null;
    } else
        return data;
}

function ResetTempData(key){
    serverData[key][0] = guildDataDef;
}

function importSettings(file, callback) {
    fs.readFile(file, "utf8", (err, data) => {
        var tree = JSON.parse(data);

        gconfig.token = tree.token;
        gconfig.downloadUpdateInterval = tree.downloadUpdateInterval;
        gconfig.songmaxdeviation = tree.songmaxdeviation;
        gconfig.deepDebug = tree.deepDebug;

        for (var guild of tree.servers) {
            let guildSettings = tree.formats[guild.format];
            serverData[guild.id] = [guildDataDef, guildSettings];
        }
        callback();
    });
}

function writeHelpCommands(channel) {
    fs.readFile("help.txt", { encoding: "utf8" }, (err, d) => {
        var msg = "";
        for (var line of d.split("\n")) {
            if (line.includes(":")) msg += "**" + line.replace(":", ":**");
            else msg += line;
        }
        channel.send(msg);
    });
}


module.exports = {
    importSettings, writeHelpCommands, GetData, ResetTempData, gconfig
}