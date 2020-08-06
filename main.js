
//#region Imports
const Discord = require("discord.js");
const http = require('http');
const fs = require('fs')
var streamBuffers = require('stream-buffers');
const ytdl = require("ytdl-core");
const { Console, time } = require("console");
const { filterFormats } = require("ytdl-core");
const { formatWithOptions } = require("util");
const { exit } = require("process");
const stream = require('stream');
const { addFormatMeta } = require("ytdl-core/lib/util");
const { setTimeout } = require("timers");
////#endregion

var _prefix = '!';
var _token = null;
//load config file
var f_ = -1;
if (fs.existsSync('./configOverride.json')) {
  var { prefix, token } = require("./configOverride.json");
  _prefix = prefix;
  _token = token;
  f_ = 1;
}
else {
  var { prefix, token } = require("./config.json");
  _prefix = prefix;
  _token = token;
  f_ = 0;
}
console.log("loaded config {" + f_ + "}");

//static objects
const client = new Discord.Client();
const guildData = new Map();

//#region EventHandlers
client.once("ready", () => {
  console.log('ready');
});

client.once("reconnecting", () => {
  console.log("Reconnecting...");
});


client.once("disconnect", () => {
  console.log("Disconnect!");
});

//#endregion

//on message recieved
client.on("message", async message => {
  //checking if server data does exist
  const guildID = message.guild.id;
  checkData(guildID);
  //if message is not from a bot
  if (message.author.bot) return;
  //if message is truly a command
  if (!message.content.startsWith(prefix)) return;

  //initialize voice channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  //check if the bot has proper privileges
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  //pull data
  var prefab = dPull(guildID);
  //set initial parameters
  prefab.voiceChannel = voiceChannel;
  prefab.textChannel = message.channel;


  if (message.content == `${_prefix}link`) {
    try {
      //link to user and clear song queue
      prefab.userID = message.author.id;
      prefab.songs = [];
      //initialize connection
      var connection = await voiceChannel.join();
      prefab.connection = connection;

      prefab.textChannel.send("User **" + message.author.username + "** linked");
      return;
    } catch (err) {
      console.log(err);
      guildData.delete(guildID);
      return;
    }
  } else if (message.content.startsWith(`${_prefix}stop`)) {
    stop(prefab);//stop voice interaction
    dSet(guildID, prefab);
    return;
  } else if (message.content.startsWith(`${_prefix}query `)) {
    prefab.query = message.content.substr(`${_prefix}query`.length + 1)//change query to find youtube video
    dSet(guildID, prefab);
    message.channel.send("updated query");
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

client.on("voiceStateUpdate", async (oldMember, newMember) => {
  let oldUserChannel = oldMember.channel;
  let newUserChannel = newMember.channel;

  const guildID = oldMember.guild.id;
  var prefab = dPull(guildID);

  var userid = newMember.member.id;
  var type = 0;
  if (newUserChannel === null)//user left
    type = -1;
  else if (oldUserChannel === null)//user joined
    type = 1;


  if (userid == prefab.userID) {
    if (type == -1) {//user left the channel
      stop(prefab);//stop voice interaction
      prefab.userID = null;//disconnect user link

      //if users in channel is 1 or 0
      if (oldUserChannel.members.size < 2)
        oldUserChannel.leave();

      //remove guild data
      dSet(guildID, prefab);
      guildData.delete(prefab);
    }
  }
});

client.on("presenceUpdate", async data => {

  if (data === undefined)
    return;
  const guildID = data.guild.id;
  var prefab;
  if (!(prefab = dPull(guildID)))//data created previously from commmand
    return;
  var userid = data.userID;
  if (prefab.userID != userid)//user matches
    return;

  var activities = data.user.presence.activities;

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
  if (!found)
    return "Spotify is not the current status";

  //spotify is an activity of the user
  let songname = activity.details;
  let artist = activity.state;
  let timestamps = activity.timestamps;
  var dNow = Date.now();
  var tStart = Date.parse(timestamps.start);
  var tEnd = Date.parse(timestamps.end);
  var songlength = (tEnd - tStart) / 1000;
  var songoffset = (tStart - dNow) / 1000;

  console.log("user presence updated");

  http.get("http://youtube-scrape.herokuapp.com/api/search?q=" + prefab.query.replace("$title", songname).replace("$artist", artist) + "&page=1", function (res) {
    let data = ''

    res.on('data', function (stream) {
      data += stream;
    });
    res.on('end', function () {
      processVideoList(guildID, data, [songname, artist, dNow, songlength, songoffset]);
    });
  });
  return "0";
});

function processVideoList(guildID, data, inp) {
  json_data = JSON.parse(data);
  songname = inp[0];
  artist = inp[1];
  startDelay = inp[2];
  songlength = inp[3];
  songoffset = inp[4];

  var songlist = [];

  for (var i = 0; i < json_data.results.length; i++) {
    console.log("checking video [" + i + "]");

    let video = json_data.results[i].video;
    var duration = 0;
    if (video != undefined) {
      let dur = video.duration;
      duration = (parseInt(dur.split(':')[0]) * 60 + parseInt(dur.split(':')[1]));

      const song = {
        title: songname,
        artist: artist,
        url: video.url,
        data: null,
        delay: 0,
        match: Math.abs(songlength - duration) < 2
      };
      if(song.match)
      songlist.push(song);
    }
  }
  downloadData(guildID, songlist, 0, [startDelay, songoffset]);
}

async function stop(prefab) {
  prefab.songs = [];
  if (prefab.connection.dispatcher !== null)
    prefab.connection.disconnect();
}

function checkData(guildID) {
  if (!dPull(guildID)) {
    console.log("creating guild prefab");
    const guildPrefab = {
      guildID: guildID,
      textChannel: null,
      voiceChannel: null,
      connection: null,
      songs: [],
      volume: 5,
      userID: null,
      playing: false,
      delay: 0,
      query: "$title $artist"
    };
    dSet(guildID, guildPrefab);
  }
}
function dPull(guildID) {
  return guildData.get(guildID);
}
function dSet(guildID, guildPrefab) {
  return guildData.set(guildID, guildPrefab);
}

async function playStream(guildID) {
  prefab = dPull(guildID);
  var song = prefab.songs.shift();
  console.log('begin');
  var d = Date.now();
  var myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 10,      // in milliseconds.
    chunkSize: 2048     // in bytes.
  });

  // With a buffer
  myReadableStreamBuffer.put(song.data);

  let dispatcher = prefab.connection
    .play(myReadableStreamBuffer)
    .once("speaking", () => {
      prefab = guildData.get(prefab.guildID);
      console.log("speaking");
      prefab.textChannel.send(`Start playing: **${song.title}**`);
      song.delay += Date.now() - d;
      console.log("delay=" + song.delay);
      if (song.delay > prefab.delay)
        prefab.delay = song.delay + 500;
      prefab.playing = true;
      guildData.set(prefab.guildID, prefab);
    })
    .on("finish", () => {
      prefab = guildData.get(prefab.guildID);
      console.log("natural stop");
      prefab.playing = false;
      guildData.set(prefab.guildID, prefab);
    })
    .on("error", (e) => {
      console.log(e);
    });

  dispatcher.setVolumeLogarithmic();
  dispatcher.setVolumeLogarithmic(prefab.volume / 5);
  console.log('end');
}

function downloadData(guildID, matchsongs, index, inp) {
  startdelay = inp[0];
  songoffset = inp[1];

  var song = matchsongs[index];

  var bufs = [];
  var unique = 0;
  var end = 0;
  try {
    //, dlChunkSize: 1024
    ytdl(song.url, { filter: 'audioonly', begin: songoffset }).on("data", (chunk) => {
      bufs.push(chunk);
    }).on("progress", (chunksize, val, total) => {
      var percent = Math.round(val * 100 / total);
      if (percent != unique) {
        unique = percent;
        console.log("downloading [" + val + "/" + total + "]  " + Math.round(val * 100 / total) + "%");
      }
    }).on("end", () => {
      var buf = Buffer.concat(bufs);
      console.log("data downloaded");
      end = 1;

      var param = dPull(guildID);
      song.delay = Date.now() - startDelay;
      song.data = buf;
      param.songs.push(song);

      var delay_old = param.delay;
      param.delay = song.delay;
      if (param.playing)
        delay_old = 0;

      dSet(guildID, param);
      setTimeout(playStream, delay_old, guildID);
      return;
    });
  } catch (e) {
    console.log("song download failed. moving to next one");
    downloadData(guildID, matchsongs, index+1, inp);
  }
}

client.login(_token);
