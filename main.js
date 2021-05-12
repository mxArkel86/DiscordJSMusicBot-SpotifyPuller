const scrapeYt = require("scrape-yt");
//#region Imports
const Discord = require("discord.js");
const fs = require("fs");
const ERROR = require("./errorcodes.js");
var streamBuffers = require("stream-buffers");
const ytdl = require("ytdl-core");
const { setTimeout } = require("timers");
////#endregion
const serverData = new Map();
var token;
var downloadUpdateInterval = 1;
var songmaxdeviation = 1;
var deepDebug = false;

const guildDataDef = {
  textChannel: null, //text channel where bot is linked
  voiceChannel: null, //voice channel where bot is in
  connection: null, //backend connection util
  dispatcher: null, //bot audio manager
  songqueue: [], //song queue per server
  userID: null, //id of user that is linked
  playing: false, //is song playing
  delay: 0, //song delay (backend stuff)
  songhandler: -1, //id of the song being played
  stream: null, //song stream
  song: null, //song being played info
  songprogress: 0, //progress through the current song,
  songmax: 0, //song length
};

function importSettings(file) {
  fs.readFile(file, "utf8", (err, data) => {
    var tree = JSON.parse(data);

    token = tree.token;
    downloadUpdateInterval = tree.downloadUpdateInterval;
    songmaxdeviation = tree.songmaxdeviation;
    deepDebug = tree.deepDebug;

    for (var guild of tree.servers) {
      let guildSettings = tree.formats[guild.format];
      serverData[guild.id] = [guildDataDef, guildSettings];
    }
    init();
  });

  //dSet(guildID, guildPrefab);
}
//static objects
const client = new Discord.Client({
  disableMentions: "everyone",
  presence: true,
});

//#region EventHandlers
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
  console.error(e);
});

client.on("debug", (e) => {
  //if (deepDebug)
  //console.log(e);
});

//#endregion
function init() {
  try {
    client.login(token);
  } catch (e) {
    console.error(e);
    console.log("failed to initialize client. most likely an invalid token");
  }
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

//on message recieved
client.on("message", async (message) => {
  if (deepDebug) console.log("message received");
  //checking if server data does exist
  var currentuser = message.guild.member(message.author.id);

  const guildID = message.guild.id;
  //if message is not from a bot
  if (message.author.bot) return;
  //if message is truly a command
  if (message.content == "@serverid") {
    message.channel.send(message.guild.id);
    return;
  }
  let sData = GetData(guildID);
  if (sData == null) return;
  let settings = sData[1];
  let data = sData[0];
  var prefix = settings.prefix;

  if (!message.content.startsWith(prefix)) return;
  //initialize voice channel
  var contentleng = message.content.split(" ").length;
  if (message.content.startsWith(`${prefix}link`)) {
    data.textChannel = message.channel;
    //if message contains a second parameter
    if (contentleng > 1) {
      var username_ = message.content.split(" ").slice(1).join(" ");
      //fetch user in guild by username
      var user_ = null;
      var userlist = await message.guild.members.fetch({});
      for (var uobj of userlist) {
        var u = uobj[1];
        if (u.displayName.toLowerCase().startsWith(username_.toLowerCase())) {
          if (user_ != null) {
            data.textChannel.send(ERROR.errorcode_6(username_));
            return;
          }
          user_ = u;
          break;
        }
      }
      if (user_ == null) {
        data.textChannel.send(ERROR.errorcode_2(username_));
      } else {
        var voicechann = user_.voice.channel;

        var curusr_voicechann = currentuser.voice.channel;
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
      //link to user and clear song queue
      if (currentuser.voice.channel == null) {
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
    writeHelpCommands(channel);
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

client.on("voiceStateUpdate", async (oldMember, newMember) => {
  if (deepDebug) console.log("voice state updated");
  let oldUserChannel = oldMember.channel;
  let newUserChannel = newMember.channel;

  const guildID = oldMember.guild.id;
  let sData = GetData(guildID);
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

function GetData(key) {
  var data = serverData[key];
  if (!data) {
    var output = ERROR.errorcode_1(key);
    if (output != "") console.log(output);
    return null;
  }else
    return data;
}
client.on("presenceUpdate", async (presenceEvtArgs) => {
  if (deepDebug) console.log("presence updated");
  var dNow = Date.now();
  if (presenceEvtArgs === undefined) return;
  const guildID = presenceEvtArgs.guild.id;

  let sData = GetData(guildID);
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

  if (deepDebug)
    console.log("user presence updated - [" + songname + "] - " + r);

  searchPage(
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
      if (deepDebug) {
        console.log(backupsonglist.length + " unmatched songs found");
        console.log(mainsonglist.length + "close matches");
      }
      if (mainsonglist.length > 0) {
        if (deepDebug)
          mainsonglist.sort((a, b) =>
            a.lengthdeviation > b.lengthdeviation ? 1 : -1
          ); //sort list starting with lowest deviation to highest
      }

      backupsonglist.sort((a, b) =>
        a.lengthdeviation > b.lengthdeviation ? 1 : -1
      );

      downloadData(
        () => {
          downloadData(
            () => {
              console.log("no song able to be played"); //no music found
            },
            guildID,
            r,
            backupsonglist,
            0,
            dNow
          );
        },
        guildID,
        r,
        mainsonglist,
        0,
        dNow
      );
    }
  );
});

function searchPage(
  page,
  guildID,
  songname,
  artist,
  songlength,
  r,
  successful
) {
  var mainsonglist = [];
  var backupsonglist = [];

  let sData = GetData(guildID);
  if (sData == null) return;
  let settings = sData[1];

  scrapeYt
    .search(
      settings.query
        .replace("$title", songname)
        .replace("$artist", artist)
        .replace(" ", "%20"),
      { type: "video", page: page }
    )
    .then((videos) => {
      var data = processVideoList(guildID, page, videos, songlength); //parse videos from search
      var return_ = data[0];

      if (return_ == 2) {
        if (deepDebug) console.log("page " + page + " failed");
        successful([], [], null);
      } else {
        for (var song of data[1]) {
          mainsonglist.push(song);
        }
        for (var song of data[2]) {
          backupsonglist.push(song);
        }
        if (return_ == 1) {
          successful(mainsonglist, backupsonglist, r);
          if (deepDebug) console.log("page " + page + " successful but ended");
        } else {
          if (deepDebug) console.log("page " + page + " does not satisfy");
          searchPage(
            page + 1,
            guildID,
            songname,
            artist,
            songlength,
            r,
            function success(mainsonglist1, backupsonglist1, r) {
              for (var song of mainsonglist1) {
                mainsonglist.push(song);
              }
              for (var song of backupsonglist1) {
                backupsonglist.push(song);
              }
              successful(mainsonglist, backupsonglist, r);
            }
          );
        }
      }
    });
}

function processVideoList(guildID, page, videos, songlength) {
  let sData = GetData(guildID);
  if (sData == null) return;
  let settings = sData[1];
  //get input parameters

  var songlist = [];
  var unbiasedsonglist = [];

  if (videos.length == 0) {
    if (deepDebug) console.log("zero length data");
    return [2, 0, 0];
  }

  for (var i = 0; i < videos.length; i++) {
    //look through every video in request
    if (deepDebug) console.log("checking video [" + page * 10 + i + "]");
    let video = videos[i];
    var duration = 0;
    if (video != undefined) {
      duration = video.duration;
      var videosong = {
        id: video.id,
        match: Math.abs(songlength - duration) < songmaxdeviation,
        lengthdeviation: Math.abs(songlength - duration),
        length: duration,
      };
      if (videosong.match)
        //if song is close in length, add to "similar" list
        songlist.push(videosong);
      else unbiasedsonglist.push(videosong); //if song is not close in length, add to "unbiased" list
      if (
        songlist.length + unbiasedsonglist.length + page * 10 >
        settings.max_backup_searches
      )
        return [1, songlist, unbiasedsonglist];
    }
  }
  return [0, songlist, unbiasedsonglist];
}

function downloadData(unsuccessful, guildID, r, matchsongs, index, start) {
  let sData = GetData(guildID);
  if (sData == null) return;

  let data = sData[0];

  if (index == matchsongs.length) {
    //if there is no song in the index position (out of range exception)
    unsuccessful(guildID); //leave with exception
    return;
  }
  var song = matchsongs[index];

  var unique = 0;
  var firstchunk = 1;
  var url = "https://www.youtube.com/watch?v=" + song.id;
  var urlvalid = ytdl.validateURL(url);
  if (deepDebug) {
    console.log("url valid=" + urlvalid);
    if (urlvalid == false) {
      console.log("ytdl failed to recognize the video url");
      return;
    }
  }

  ytdl(url, { filter: "audioonly" })
    .on("data", (chunk) => {
      //download music file
      if (r != data.songhandler) {
        data.songqueue.shift();
        return;
      }
      if (firstchunk == 1) {
        if (data.stream != null) data.stream.destroy();
        data.stream = new streamBuffers.ReadableStreamBuffer({
          frequency: 10, // in milliseconds.
          chunkSize: 2048, // in bytes.
        });
        data.songmax = song.length;
        data.stream.on("data", (a) => {
          var percent = Math.round();
          //console.log("PROGRESS=" + percent);
          data.songprogress =
            ((data.stream.maxSize() - data.stream.size()) * song.length) /
            data.stream.maxSize();
        });
        data.stream.on("end", () => {
          data.playing = false;
        });
        firstchunk = 0;
        var delay = Date.now() - start;
        var action = 0;
        var delay_now = data.delay;

        if (delay >= data.delay || data.playing || data.songprogress > 95) {
          //if new song delay >= old delay
          action = 1;
          data.delay = delay; //next delay is higher
          delay_now = 0;
        } else {
          //new delay is less than old
          action = -1;
          delay_now = data.delay - delay; //difference between delays
        }

        if (deepDebug) {
          console.log("song play delay=" + delay + " [" + action + "]");
          console.log("queue adjustment delay=" + delay_now);
        }
        setTimeout(playStream, delay_now, guildID);
      }
      data.stream.put(chunk);
    })
    .on("progress", (chunksize, val, total) => {
      if (downloadUpdateInterval != 0 && deepDebug) {
        var percent = Math.floor((val * 100) / total);
        var percent_2 = Math.floor(percent / downloadUpdateInterval);
        if (percent_2 != unique) {
          unique = percent_2;
          console.log(
            "downloading [" + val + "/" + total + "]  " + percent + "%"
          ); //show download progress
        }
      }
    })
    .on("error", (e) => {
      if (deepDebug) {
        console.log("song download failed. moving to next one [" + index + "]");
        console.error("error=" + e);
      }
      downloadData(unsuccessful, guildID, r, matchsongs, index + 1, start);
    });
}

async function playStream(guildID) {
  if (deepDebug) console.log("play stream");
  let sData = GetData(guildID);
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

if (fs.existsSync("./configOverride.json")) {
  console.log("reading override config");
  importSettings("./configOverride.json");
} else {
  console.log("reading default config");
  importSettings("./config.json");
}
console.log("loaded config");
