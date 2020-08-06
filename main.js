
//#region Imports
const Discord = require("discord.js");
const http = require('http');
const fs = require('fs')
const ERROR = require('./errorcodes.js')
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
const serverData = new Map();
var token;

function importSettings(file){
  fs.readFile(file, 'utf8', (err, data)=>{
    var tree = JSON.parse(data);

    token = tree.token;
    
    for(var guild of tree.servers){
      let guildSettings = tree.formats[guild.format];
      const guildData = {
        textChannel: null,
        voiceChannel: null,
        connection: null,
        songs: [],
        userID: null,
        playing: false,
        delay: 0
      };
      serverData[guild.id] = [guildData, guildSettings];
    }
    init();
  });
 
  
  
  //dSet(guildID, guildPrefab);
}
if (fs.existsSync('./configOverride.json')) {
  importSettings("./configOverride.json");
}
else {
  importSettings("./config.json");
}
console.log("loaded config");

//static objects
const client = new Discord.Client();


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

client.on("error", (e)=>{
  console.log(e);
});

//#endregion
function init(){
client.login(token);
}
//on message recieved
client.on("message", async message => {
  //checking if server data does exist
  const guildID = message.guild.id;
  let sData = serverData[guildID];
  if(!sData){
    console.log(ERROR.errorcode_1(guildID));
    return;
    }
  let settings = sData[1];
  let data = sData[0];
  var prefix = settings.prefix;
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

  
  data.voiceChannel = voiceChannel;
  data.textChannel = message.channel;


  if (message.content == `${prefix}link`) {
    try {
      //link to user and clear song queue
      data.userID = message.author.id;
      data.songs = [];
      //initialize connection
      var connection = await voiceChannel.join();
      data.connection = connection;

      data.textChannel.send("User **" + message.author.username + "** linked");
      return;
    } catch (err) {
      console.log(err);
      serverData.delete(guildID);
      return;
    }
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(data);//stop voice interaction
    return;
  } else if (message.content.startsWith(`${prefix}query `)) {
    settings.query = message.content.substr(`${prefix}query`.length + 1)//change query to find youtube video
    
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
  let sData = serverData[guildID];
  if(!sData){
    console.log(ERROR.errorcode_1(guildID));
    return;
    }
  let data = sData[0];

  var userid = newMember.member.id;
  var type = 0;
  if (newUserChannel === null)//user left
    type = -1;
  else if (oldUserChannel === null)//user joined
    type = 1;


  if (userid == data.userID) {
    if (type == -1) {//user left the channel
      stop(data);//stop voice interaction
      data.userID = null;//disconnect user link

      //if users in channel is 1 or 0
      if (oldUserChannel.members.size < 2)
        oldUserChannel.leave();
    }
  }
});

client.on("presenceUpdate", async presenceEvtArgs => {

  if (presenceEvtArgs === undefined)
    return;
  const guildID = presenceEvtArgs.guild.id;
  
  let sData = serverData[guildID];
  if(!sData){
  console.log(ERROR.errorcode_1(guildID));
  return;
  }
  let data = sData[0];
  let settings = sData[1];

  var userid = presenceEvtArgs.userID;
  if (data.userID != userid)//user matches
    return;

  var activities = presenceEvtArgs.user.presence.activities;

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

  http.get("http://youtube-scrape.herokuapp.com/api/search?q=" + settings.query.replace("$title", songname).replace("$artist", artist) + "&page=1", function (res) {
    let data1 = ''

    res.on('data', function (stream) {
      data1 += stream;
    });
    res.on('end', function () {
      processVideoList(guildID, data1, [songname, artist, dNow, songlength, songoffset]);
    });
  });
  return "0";
});

function processVideoList(guildID, data, inp) {
  let sData = serverData[guildID];
  if(!sData){
    console.log(ERROR.errorcode_1(guildID));
    return;
    }
  let settings = sData[1];

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
      if(songlist.length>settings.max_backup_searches)
        break;
    }
  }
  console.log(songlist.length + " matches   backupsearches=[" + settings.max_backup_searches + "]");
  downloadData(guildID, songlist, 0, [startDelay, songoffset]);
}

async function playStream(guildID) {
  let sData = serverData[guildID];
  if(!sData){
    console.log(ERROR.errorcode_1(guildID));
    return;
    }

  let data = sData[0];
  let settings = sData[1];

  var song = data.songs.shift();
  var d = Date.now();
  var myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 10,      // in milliseconds.
    chunkSize: 2048     // in bytes.
  });

  // With a buffer
  myReadableStreamBuffer.put(song.data);

  let dispatcher = data.connection
    .play(myReadableStreamBuffer)
    .once("speaking", () => {
      console.log("speaking");
      data.textChannel.send(`Start playing: **${song.title}**`);
      song.delay += Date.now() - d;
      console.log("delay=" + song.delay);
      if (song.delay > data.delay)
        data.delay = song.delay + 500;
      data.playing = true;
    })
    .on("finish", () => {
      console.log("natural stop");
      data.playing = false;
    })
    .on("error", (e) => {
      console.log(e);
    });

  dispatcher.setVolume(settings.volume);
}

function downloadData(guildID, matchsongs, index, inp) {

  let sData = serverData[guildID];
  if(!sData){
    console.log(ERROR.errorcode_1(guildID));
    return;
    }
    
  let data = sData[0];

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

      song.delay = Date.now() - startDelay;
      song.data = buf;
      data.songs.push(song);

      var delay_old = data.delay;
      if(song.delay>data.delay)
      data.delay = song.delay;
      if (data.playing)
        delay_old = 0;

      setTimeout(playStream, delay_old, guildID);
      return;
    });
  } catch (e) {
    console.log("song download failed. moving to next one");
    downloadData(guildID, matchsongs, index+1, inp);
  }
}

