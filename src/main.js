//package imports
const Discord = require("discord.js");
const fs = require("fs");
//file imports
const ERROR = require("./errorcodes.js");
const UTIL = require("./util.js");
const DWNLD = require("./download.js");



//initialize discord client object
const client = new Discord.Client({
  disableMentions: "everyone",
  presence: true,
});

//#region BASIC EventHandlers
//basic event handlers involved with general functioning
client.once("ready", () => {
  console.log("ready");
});

client.once("reconnecting", () => {
  console.log("Reconnecting...");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("error", (e) => {
  console.error("[ERROR]: " + e);
});

client.on("debug", (e) => {
  if (UTIL.gconfig.deepDebug)
  console.log(e);
});
//#endregion

//initialize bot with token
function init() {
  try {
    client.login(UTIL.gconfig.token);
  } catch (e) {
    console.error("[ERROR]: " + e);
    console.log("failed to initialize client. most likely an invalid token");
  }
}

// set a user and voice channel
// for the bot to consider
async function linkUser(data, user, voicechannel) {
  data.userID = user.id;
  data.songs = [];
  //initialize connection
  data.connection = await voicechannel.join();
  data.voiceChannel = voicechannel;
  data.textChannel.send(
    "Spotify of **" +
      user.displayName +
      "** linked to **" +
      voicechannel.name +
      "**"
  );
}

//#region ADVANCED EVENTHANDLERS
//when a message is received in any server
client.on("message", async (message) => {
  //get basic message and server info
  var currentuser = message.guild.member(message.author.id);
  const guildID = message.guild.id;
  
  //if the message author is a bot, skip everything
  if (message.author.bot) return;

  //log event
  if (UTIL.gconfig.deepDebug) console.log("message received");

  //if message is @serverid, send guild id and return
  if (message.content == "@serverid") {
    message.channel.send(message.guild.id);
    return;
  }

  //get data associated with guild
  let sData = UTIL.GetData(guildID);
  if (sData == null) return;//return if it doesn't exist
  let settings = sData[1];
  let data = sData[0];
  var prefix = settings.prefix;

  //check if message is a command
  if (!message.content.startsWith(prefix)) return;
  
  //get number of "ARGUMENTS" of message
  var contentleng = message.content.split(" ").length;

  // LINK
  if (message.content.startsWith(`${prefix}link`)) {
    data.textChannel = message.channel;
    
    //if link command has more than one ARGUMENT
    if (contentleng > 1) {
      var username_ = message.content.split(" ").slice(1).join(" ");  
      var user_ = null;

      //get guild user list
      const userlist = await message.guild.members.fetch({});
      for (var uobj of userlist) {
        var u = uobj[1];
        
        //if USERS username begins with query, continue
        if (u.displayName.toLowerCase().startsWith(username_.toLowerCase())) {
          //if a user has already been found with query, send error (ambiguity in who to pick)
          if (user_ != null) {
            data.textChannel.send(ERROR.errorcode_6(username_));
            return;
          }
          user_ = u;
        }
      }
      
      //if a user has not been found, send error
      if (user_ == null) {
        data.textChannel.send(ERROR.errorcode_2(username_));
      } else {
        var voicechann = user_.voice.channel;
        var curusr_voicechann = currentuser.voice.channel;

        //if user is not in voice channel, send error
        if (voicechann == null) {
          data.textChannel.send(ERROR.errorcode_3(u.displayName));
          return;
        }
        
        if (curusr_voicechann == null) {
          data.textChannel.send(ERROR.errorcode_4(currentuser.displayName));
          return;
        }
        if (curusr_voicechann.id != voicechann.id) {
          data.textChannel.send(ERROR.errorcode_7());
          return;
        }
        linkUser(data, u, voicechann);
      }
    } else {
      
      if (currentuser.voice.channel == null) {//if current user is not in a voice channel
        data.textChannel.send(ERROR.errorcode_4(currentuser.displayName));
        return;
      }
      linkUser(data, currentuser, currentuser.voice.channel);
    }
  } else if (message.content == `${prefix}playing`) {
    if (currentuser.voice.channel.id != data.voiceChannel.id) {
      message.channel.send(ERROR.errorcode_5(currentuser.displayName));
      return;
    }
    var song = data.song;
    var progress = (data.songprogress * 10) / data.songmax;
    var str = ("#".repeat(progress) + "-".repeat(10 - progress)).toString();
    var minutes = Math.floor(data.songprogress / 60);
    var seconds = Math.round(data.songprogress - minutes * 60);
    var minutes1 = Math.floor(data.songmax / 60);
    var seconds1 = data.songmax - minutes1 * 60;
    var str2 =
      str.substring(0, str.length / 2) +
      ` ` +
      minutes +
      `:` +
      seconds +
      ` / ` +
      minutes1 +
      `:` +
      seconds1 +
      ` ` +
      str.substring(str.length / 2);
    message.channel.send(
      `Started playing: **${song.title} by ${song.artist}**\n[` + str2 + `]`
    );
  } else if (message.content == `${prefix}unlink`) {
    if(!currentuser.voice.channel){
      message.channel.send(ERROR.errorcode_4(currentuser.displayName));
      return;
    }
    if (currentuser.voice.channel.id != data.voiceChannel.id) {
      message.channel.send(ERROR.errorcode_5(currentuser.displayName));
      return;
    }
    client.voice.connections.get(guildID).disconnect();
    data = guildDataDef;
    message.channel.send("Bot disconnected from voice channel");
  } else if (message.content == `${prefix}help`) {
    UTIL.writeHelpCommands(message.channel);
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

client.on("voiceStateUpdate", async (oldMember, newMember) => {
  if (UTIL.gconfig.deepDebug) console.log("voice state updated");
  let oldUserChannel = oldMember.channel;
  let newUserChannel = newMember.channel;

  const guildID = oldMember.guild.id;
  let sData = UTIL.GetData(guildID);
  if (sData == null) return;
  let data = sData[0];

  var userid = newMember.member.id;
  var type = 0;
  if (newUserChannel === null)
    //user left
    type = -1;
  else if (oldUserChannel === null)
    //user joined
    type = 1;

  if (userid == data.userID) {
    if (type == -1) {
      //user left the channel
      data.userID = null; //disconnect user link

      //if users in channel is 1
      if (oldUserChannel.members.size < 2) oldUserChannel.leave();
    }
  }
});


client.on("presenceUpdate", async (presenceEvtArgs) => {
  if (UTIL.gconfig.deepDebug) console.log("presence updated");
  var dNow = Date.now();
  if (presenceEvtArgs === undefined) return;
  const guildID = presenceEvtArgs.guild.id;

  let sData = UTIL.GetData(guildID);
  if (sData == null) return;

  let data = sData[0];
  let settings = sData[1];
  var userid = presenceEvtArgs.userID;
  if (data.userID != userid)
    //user matches
    return;

  var activities = presenceEvtArgs.user.presence.activities; //get user activities
  var found = false;
  var activity = null;
  for (a of activities) {
    var name = a.name;
    if (name != "Spotify")
      //if one of the activities is spotify
      continue;
    found = true;
    activity = a;
    break;
  }
  if (!found) return;
  //spotify is an activity of the user
  let songname = activity.details;
  let artist = activity.state;
  let timestamps = activity.timestamps;
  //check if song is already playing
  if (data.songqueue.find((s) => s.title == songname) != null) return;

  var r;
  while ((r = Math.round(Math.random() * 999)) == data.songhandler) {}
  data.songhandler = r;
  const song = {
    title: songname,
    artist: artist,
    id: r,
    length: 0,
  };
  //add song to queue
  data.songqueue.push(song);
  var tStart = Date.parse(timestamps.start);
  var tEnd = Date.parse(timestamps.end);
  var songlength = (tEnd - tStart) / 1000;
  //var songoffset = (tStart - dNow) / 1000;

  if (UTIL.gconfig.deepDebug)
    console.log("user presence updated - [" + songname + "] - " + r);

    DWNLD.searchPage(
    0,
    guildID,
    songname,
    artist,
    songlength,
    r,
    function successful(mainsonglist, backupsonglist, r) {
      if (r != data.songhandler) {
        //song to be played switched during processing
        data.songqueue.shift();
        return 1;
      }
      if (UTIL.gconfig.deepDebug) {
        console.log(backupsonglist.length + " unmatched songs found");
        console.log(mainsonglist.length + "close matches");
      }
      if (mainsonglist.length > 0) {
        if (UTIL.gconfig.deepDebug)
          mainsonglist.sort((a, b) =>
            a.lengthdeviation > b.lengthdeviation ? 1 : -1
          ); //sort list starting with lowest deviation to highest
      }

      backupsonglist.sort((a, b) =>
        a.lengthdeviation > b.lengthdeviation ? 1 : -1
      );

      DWNLD.downloadData(
        () => {
          DWNLD.downloadData(
            () => {
              console.log("no song able to be played"); //no music found
            },
            guildID,
            r,
            backupsonglist,
            0,
            dNow,
            playStream
          );
        },
        guildID,
        r,
        mainsonglist,
        0,
        dNow,
        playStream
      );
    }
  );
});
//#endregion

async function playStream(guildID) {
  if (UTIL.gconfig.deepDebug) console.log("play stream");
  let sData = UTIL.GetData(guildID);
  if (sData == null) return;

  let data = sData[0];
  let settings = sData[1];

  var song = data.songqueue.shift();

  if (song == undefined) return;

  var dispatcher = data.connection.play(data.stream);
  dispatcher.on("start", () => {
    //data.textChannel.send(`Started playing: **${song.title} by ${song.artist}**`);
    console.log(`Playing: ${song.title} by ${song.artist}`);
    data.song = song;
    data.playing = true;
  });
  dispatcher.on("error", (e) => {
    console.log("error=" + e);
  });
  dispatcher.on("end", (e) => {
    data.song = null;
  });
  dispatcher.setVolume(settings.volume);
  data.dispatcher = dispatcher;
}

/*
  Reading the json config files and then initializing the bot with it.
  ConfigOverride.json overrides config.json in priority
*/
if (fs.existsSync("../configs/configOverride.json")) {
  console.log("reading override config");
  UTIL.importSettings("../configs/configOverride.json", init);
} else {
  console.log("reading default config");
  UTIL.importSettings("../configs/config.json", init);
}
console.log("loaded config");
