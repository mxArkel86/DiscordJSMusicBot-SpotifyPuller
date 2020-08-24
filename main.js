
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
var downloadUpdateInterval = 1;
var load_delay = 0;

let stream_ = new streamBuffers.ReadableStreamBuffer({
  frequency: 10,      // in milliseconds.
  chunkSize: 2048     // in bytes.
});


const guildDataDef = {
  textChannel: null,
  voiceChannel: null,
  connection: null,
  songqueue: [],
  userID: null,
  playing: false,
  delay: 0,
  stream: stream_,
  broadcast: null
};

function importSettings(file) {
  fs.readFile(file, 'utf8', (err, data) => {
    var tree = JSON.parse(data);

    token = tree.token;
    downloadUpdateInterval = tree.downloadUpdateInterval;

    for (var guild of tree.servers) {
      let guildSettings = tree.formats[guild.format];
      serverData[guild.id] = [guildDataDef, guildSettings];
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

client.on("error", (e) => {
  console.log(e);
});

//#endregion
function init() {
  client.login(token);
}

function writeHelpCommands(channel) {
  fs.readFile("help.txt", { encoding: 'utf8' }, (err, d) => {
    var msg = "";
    for (var line of d.split('\n')) {
      if (line.includes(':'))
        msg += '**' + line.replace(':', ':**');
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
  data.textChannel.send("Spotify of **" + user.displayName + "** linked to **" + voicechannel.name + "**");
}

//on message recieved
client.on("message", async message => {
  //checking if server data does exist
  var currentuser = message.guild.member(message.author.id);

  const guildID = message.guild.id;
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }
  let settings = sData[1];
  let data = sData[0];
  var prefix = settings.prefix;
  //if message is not from a bot
  if (message.author.bot) return;
  //if message is truly a command
  if (message.content == "@serverid") {
    message.channel.send(message.guild.id);
    return;
  }

  if (!message.content.startsWith(prefix)) return;
  //initialize voice channel

  if (message.content.startsWith(`${prefix}link`)) {
    data.textChannel = message.channel;
    var contentleng = message.content.split(' ').length;
    //if message contains a second parameter
    if (contentleng > 1) {
      var username_ = message.content.split(' ')[1].toLowerCase();
      //fetch user in guild by username
      var userlist = await message.guild.members.fetch({});
      for (var uobj of userlist) {
        var u = uobj[1];
        if (u.displayName.toLowerCase() == username_) {
          var voicechann = u.voice.channel;
          if (contentleng > 2) {
            if (message.content.split(' ')[2] == 'here') {
              voicechann = currentuser.voice;
              if (voicechann == null) {
                data.textChannel.send(ERROR.errorcode_3(u.displayName));
                return;
              }
            }
          } else {
            if (voicechann == null) {
              data.textChannel.send(ERROR.errorcode_3(u.displayName));
              return;
            }
          }

          linkUser(data, u, u.voice.channel);
          return;
        }
      }
      data.textChannel.send(ERROR.errorcode_2(username_));
      return;
    } else {
      //link to user and clear song queue
      if (currentuser.voice.channel == null) {
        data.textChannel.send(ERROR.errorcode_4(currentuser.displayName));
        return;
      }
      linkUser(data, currentuser, currentuser.voice.channel);
    }

    return;
  } else if (message.content == `${prefix}stop`) {
    if (currentuser.voice.channel.id != data.voiceChannel.id) {
      message.channel.send(ERROR.errorcode_5(currentuser.displayName));
      return;
    }
    client.voice.connections.get(guildID).disconnect();
    data = guildDataDef;
    message.channel.send('Bot disconnected from voice channel');
    return;
  } if (message.content == `${prefix}help`) {
    writeHelpCommands(channel);
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
  if (!sData) {
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
      data.userID = null;//disconnect user link

      //if users in channel is 1
      if (oldUserChannel.members.size < 2)
        oldUserChannel.leave();
    }
  }
});

client.on("presenceUpdate", async presenceEvtArgs => {
  var dNow = Date.now();
  if (presenceEvtArgs === undefined)
    return;
  const guildID = presenceEvtArgs.guild.id;

  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }
  let data = sData[0];
  let settings = sData[1];

  var userid = presenceEvtArgs.userID;
  if (data.userID != userid)//user matches
    return;

  var activities = presenceEvtArgs.user.presence.activities;//get user activities

  var found = false;
  var activity = null;
  for (a of activities) {
    var name = a.name;
    if (name != "Spotify")//if one of the activities is spotify
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
  //check if song is already playing
  if (data.songqueue.find(s => s.title == songname)!=null)
    return;
  const song = {
    title: songname,
    artist: artist
  };
  //add song to queue
  data.songqueue.push(song);
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
      processVideoList(guildID, data1, [songname, artist, dNow, songlength, songoffset]);//parse videos from search
    });
  });
});

function processVideoList(guildID, data, inp) {
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }
  let settings = sData[1];
  //get input parameters
  songname = inp[0];
  artist = inp[1];
  startDelay = inp[2];
  songlength = inp[3];
  songoffset = inp[4];
  json_data = JSON.parse(data);


  var songlist = [];
  var unbiasedsonglist = [];

  for (var i = 0; i < json_data.results.length; i++) {//look through every video in request
    console.log("checking video [" + i + "]");
    let video = json_data.results[i].video;
    var duration = 0;
    if (video != undefined) {
      let dur = video.duration;
      duration = (parseInt(dur.split(':')[0]) * 60 + parseInt(dur.split(':')[1]));
      var videosong = {
        url: video.url,
        match: Math.abs(songlength - duration) < 2,
        lengthdeviation: Math.abs(songlength - duration)
      }
      if (videosong.match)//if song is close in length, add to "similar" list
        songlist.push(videosong);
      else
        unbiasedsonglist.push(videosong);//if song is not close in length, add to "unbiased" list
      if (songlist.length > settings.max_backup_searches)
        break;
    }
  }
  if (songlist.length > 0) {
    console.log(songlist.length + " matches   maxBackupSearches=[" + settings.max_backup_searches + "]");
    songlist.sort((a, b) => (a.lengthdeviation > b.lengthdeviation) ? 1 : -1);//sort list starting with lowest deviation to highest
  }
  else
    console.log(unbiasedsonglist.length + " unmatched songs found");

    setTimeout(()=>{
      unbiasedsonglist.sort((a, b) => (a.lengthdeviation > b.lengthdeviation) ? 1 : -1);
    }, 0);
  

  downloadData(guildID, songlist, 0, [startDelay, songoffset], function() {//download music and if it does not work try the next one in list
    downloadData(guildID, unbiasedsonglist, 0, [startDelay, songoffset], function() {//try unmatching music
      console.log("unmatched length song found");//no music found
    });
  });
}

function downloadData(guildID, matchsongs, index, inp, unsuccessful) {

  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }

  let data = sData[0];

  startdelay = inp[0];
  songoffset = inp[1];

  if (index == matchsongs.length) {//if there is no song in the index position (out of range exception)
    unsuccessful();//leave with exception
    return;
  }
  var song = matchsongs[index];

  var unique = 0;
  var firstchunk = 1;
  var ready = 0;
  var buff = [];
  data.stream = stream_;
  ytdl(song.url, { filter: 'audioonly' }).on("data", (chunk) => {//download music file
    if(ready==0)
    buff.push(chunk);
    else
    data.stream.put(chunk);
    
    if (firstchunk == 1) {
      firstchunk = 0;
      var delay = Date.now() - startDelay;
      var action = 0;
      var delay_now = data.delay;

      if (delay >= data.delay || !data.playing) {//if new song delay >= old delay
        action = 1;
        data.delay = delay;//next delay is higher
        delay_now = 0;
      } else {//new delay is less than old
        action = -1;
        delay_now = data.delay - delay;//difference between delays
      }
      console.log('song play delay=' + delay + " [" + action + "]");
      console.log("queue adjustment delay=" + delay_now);
      setTimeout(playStream, delay_now, guildID, function(){
        data.stream.put(Buffer.concat(buff));
        ready = 1;
      });
    }
  }).on("progress", (chunksize, val, total) => {
    if (downloadUpdateInterval != 0) {
      var percent = Math.floor(val * 100 / total);
      var percent_2 = Math.floor(percent / downloadUpdateInterval);
      if (percent_2 != unique) {
        unique = percent_2;
        console.log("downloading [" + val + "/" + total + "]  " + percent + "%");//show download progress
      }
    }
  }).on("error", (e) => {
    console.log(e);
    console.log("song download failed. moving to next one [" + index + "+1]");
    downloadData(guildID, matchsongs, index + 1, inp);
  });
}

async function playStream(guildID, ready) {
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }

  let data = sData[0];
  let settings = sData[1];
  if(data.broadcast!=null){
    data.broadcast.end();
  }
  
  
  var song = data.songqueue.shift();
  ready();
  const broadcast = client.voice.createBroadcast();
  broadcast.play(data.stream);
  data.broadcast = broadcast;
// Play "music.mp3" in all voice connections that the client is in
let dispatcher = data.connection//initialize connection
.play(broadcast)
.once("speaking", () => {
  //display information about playing
  data.textChannel.send(`Start playing: **${song.title} by ${song.artist}**`);
  data.playing = true;
})
.on("finish", () => {
  if(data.playing==false){
  console.log("song stopped");
  data.songqueue.unshift(song);
  playStream(guildID);
  }
  data.playing = false;
})
.on("error", (e) => {
  
});
dispatcher.setVolume(settings.volume);
}



