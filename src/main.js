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
  //if (UTIL.gconfig.deepDebug)
    //console.log(e);
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
  data.connection.setSpeaking(0);
  data.voiceChannel = voicechannel;

}

async function notify(sData, user, voicechannel, exclaim = false) {
  let data = sData[0];
  if (!exclaim) {
    data.textChannel.send(
      "Spotify of **" +
      user.displayName +
      "** linked to **" +
      voicechannel.name +
      "**"
    );
  } else {
    data.textChannel.send(
      "Spotify of **" +
      user.toString() +
      "** linked to **" +
      voicechannel.name +
      "**"
    );
  }
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
  var arguments = message.content.split(" ").slice(1)
  var contentleng = arguments.length - 1;

  // LINK command
  if (message.content.startsWith(`${prefix}link`)) {
    data.textChannel = message.channel;

    //if link command has more than one ARGUMENT
    if (contentleng > 0) {
      var username_ = "";
      var extUser = false;
      if (arguments[0] == "here") {
        username_ = arguments.slice(1).join(" ");
        extUser = true;
      }
      else
        username_ = arguments.join(" ");
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

        //if queried user is not in voice channel, send error
        if (voicechann == null) {
          data.textChannel.send(ERROR.errorcode_3(u.displayName));
          return;
        }

        //if user sending request is not in a voice channel, send error
        if (curusr_voicechann == null) {
          data.textChannel.send(ERROR.errorcode_4(currentuser.displayName));
          return;
        }

        //if the:
        // - sending user's channel is not the same as the queried user's channel
        // - command did not include 'here' mention
        // send error

        if (curusr_voicechann.id != voicechann.id && !extUser) {
          data.textChannel.send(ERROR.errorcode_7());
          return;
        }
        //link queried user
        linkUser(data, user_, voicechann);

        if (extUser) {
          notify(sData, user_, voicechann, true);
        } else {
          notify(sData, user_, voicechann);
        }
      }
    } else {//basic no argument command (link to self)
      //if current user is not in a voice channe
      if (currentuser.voice.channel == null) {
        data.textChannel.send(ERROR.errorcode_4(currentuser.displayName));
        return;
      }

      //notify and link
      linkUser(data, currentuser, currentuser.voice.channel);
      notify(sData, currentuser, currentuser.voice.channel);
    }
  } else if (message.content == `${prefix}playing`) {
    //convert minutes to seconds, and figure out song progress
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

    //if current user is not in a voice channel
    if (!currentuser.voice.channel) {
      message.channel.send(ERROR.errorcode_4(currentuser.displayName));
      return;
    }

    //if current user's voice channel is not the same as the linked one
    if (currentuser.voice.channel.id != data.voiceChannel.id) {
      message.channel.send(ERROR.errorcode_5(currentuser.displayName));
      return;
    }

    //unlink bot
    client.voice.connections.get(guildID).disconnect();
    data = guildDataDef;
    message.channel.send("Bot disconnected from voice channel");

  } else if (message.content == `${prefix}help`) {//HELP commands
    UTIL.writeHelpCommands(message.channel);
  } else {
    //command not recognized
    message.channel.send("You need to enter a valid command!");
  }
});

//when a user's voice state changes (joins/leaves channel)
client.on("voiceStateUpdate", async (oldMember, newMember) => {
  if (UTIL.gconfig.deepDebug) console.log("voice state updated");
  let oldUserChannel = oldMember.channel;
  let newUserChannel = newMember.channel;

  const guildID = oldMember.guild.id;
  let sData = UTIL.GetData(guildID);
  if (sData == null) return;
  let data = sData[0];

  //frame join and leave events in simpler terms
  var type = 0;
  if (newUserChannel === null)
    type = -1;
  else if (oldUserChannel === null)
    type = 1;

  //if the context user is the same as the linked user
  if (newMember.member.id == data.userID) {

    //and the context user left a channel
    if (type == -1) {

      //reset server temporary bot data
      UTIL.ResetTempData(guildID);

      //if there are no users in the voice channel, leave the voice channel as well
      if (oldUserChannel.members.size < 2) oldUserChannel.leave();
    }
  }
});

//when the user's activities change (every time spotify changes songs)
client.on("presenceUpdate", async (presenceEvtArgs) => {
  if (UTIL.gconfig.deepDebug) console.log("presence updated");

  //return if presence is null (user is not doing anything)
  if (presenceEvtArgs === undefined) return;
  const guildID = presenceEvtArgs.guild.id;

  //get usual data package
  let sData = UTIL.GetData(guildID);
  if (sData == null) return;
  let data = sData[0];
  let settings = sData[1];

  //if the context user is the same as the linked user, then continue on
  var userid = presenceEvtArgs.userID;
  if (data.userID != userid)
    return;

  //get user activities  
  var activities = presenceEvtArgs.user.presence.activities;

  //look through activities for spotify
  var found = false;
  var activity = null;
  for (a of activities) {
    var name = a.name;
    if (name != "Spotify")
      continue;
    found = true;
    activity = a;
    break;
  }
  if (!found) return;

  //spotify is in fact an activity of the user
  let songname = activity.details;
  let artist = activity.state;
  let timestamps = activity.timestamps;
  var tStart = Date.parse(timestamps.start);
  var tEnd = Date.parse(timestamps.end);
  var songlength = (tEnd - tStart) / 1000;
  //get time of request
  var requeststart = activity.createdTimestamp;

  //stop if song is alread in queue to be played
  if (data.songqueue.find((s) => s.title == songname) != undefined) return;

  //generate a unique song id
  var r = -1;
  while (true) {
    r = Math.round(Math.random() * 999);

    for (var song1 of data.songqueue) {
      if (song1.id == r) {
        r = -1;
        break;
      }
    }
    if (song1 != -1)
      break;
  }
  var song = {
    title: songname,
    artist: artist,
    id: r,
    songlength: songlength,
    requesttime: requeststart
  };
  //push song to queue
  data.songqueue.push(song);

  if (UTIL.gconfig.deepDebug)
    console.log("user presence updated - [" + songname + "] - " + r);

  DWNLD.searchPage(0, sData, song,

    //video search was successful
    function successful(song, songlist) {
      if (UTIL.gconfig.deepDebug) console.log(songlist.length + " songs found");

      //sort songs based on variation to activity song length
      songlist.sort((a, b) => (a.timedeviation > b.timedeviation) ? 1 : -1)

      //remove current song from queue
      data.songqueue.splice(data.songqueue.findIndex((a) => (a.r == song.r)));

      //sort the songlist by request time
      data.songqueue.sort((a, b) => (a.requesttime < b.requesttime) ? 1 : -1)

      //if the first song in the list (latest called) is not this one, then skip
      if (data.length > 0 && data[0].r != song.r) {
        return;
      }
      if (data.song != null && song.requesttime < data.song.requesttime) {//if song requested had a request time that is earlier 
        return;                                  // than the currently playing song (delayed processing)
      }
      data.song = song;//make queried song the current song for the player
      DWNLD.downloadData(0, songlist, sData, song, playStream);
    },
    function failed(code) {

    }
  );
});
//#endregion

async function playStream(song, sData) {
  if (UTIL.gconfig.deepDebug) console.log("play stream");

  let data = sData[0];
  let settings = sData[1];

  //begin playing song on new stream
  var dispatcher = data.connection.play(data.stream);
  dispatcher.on("start", () => {
    //data.textChannel.send(`Started playing: **${song.title} by ${song.artist}**`);
    console.log(`Playing: ${song.title} by ${song.artist}`);
    data.playing = true;
    data.connection.setSpeaking(1);
  });
  dispatcher.on("error", (e) => {
    console.log("error=" + e);
  });
  dispatcher.on("end", (e) => {
    data.song = null;
    data.connection.setSpeaking(0);
  });
  dispatcher.setVolume(settings.volume*0.5);
  data.dispatcher = dispatcher;
}

/*
  Reading the json config files and then initializing the bot with it.
  ConfigOverride.json overrides config.json in priority
*/

UTIL.importSettings("configs/config.json", init);

console.log("loaded config");
