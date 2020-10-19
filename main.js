const scrapeYt = require("scrape-yt");
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
const { UV_FS_O_FILEMAP } = require("constants");
////#endregion
const serverData = new Map();
var token;
var downloadUpdateInterval = 1;
var songmaxdeviation=1;
var deepDebug;


const guildDataDef = {
  textChannel: null,
  voiceChannel: null,
  connection: null,
  songqueue: [],
  userID: null,
  playing: false,
  delay: 0,
  songhandler: -1,
  stream: null,
  dispatcher: null
};

function importSettings(file) {
  fs.readFile(file, 'utf8', (err, data) => {
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
  data.voiceChannel = voicechannel;
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

          linkUser(data, u, voicechann);
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
  if (data.songqueue.find(s => s.title == songname) != null)
    return;
  
  var r;
  while((r=Math.round(Math.random()*999))==data.songhandler){

  }
  data.songhandler = r;
  const song = {
    title: songname,
    artist: artist,
    id: r
  };
  //add song to queue
  data.songqueue.push(song);
  var tStart = Date.parse(timestamps.start);
  var tEnd = Date.parse(timestamps.end);
  var songlength = (tEnd - tStart) / 1000;
  var songoffset = (tStart - dNow) / 1000;

  if(deepDebug)
  console.log("user presence updated - [" + songname + "] - " + r);

  
  
  searchPage(0, guildID, songname, artist, songlength, function successful(mainsonglist, backupsonglist){
    
    if(r!=data.songhandler){
      data.songqueue.shift();
      return 1;
    }
    if (mainsonglist.length > 0) {
      if(deepDebug)
      console.log(mainsonglist.length + "close matches");
      mainsonglist.sort((a, b) => (a.lengthdeviation > b.lengthdeviation) ? 1 : -1);//sort list starting with lowest deviation to highest
    }
    else{
      if(deepDebug)
      console.log(backupsonglist.length + " unmatched songs found");
    }
      
  
      backupsonglist.sort((a, b) => (a.lengthdeviation > b.lengthdeviation) ? 1 : -1);
  
    downloadData(() => {
      downloadData(() => {
        console.log("no song able to be played");//no music found
      }, guildID, r, backupsonglist, 0, dNow);
    }, guildID, r, mainsonglist, 0, dNow);
  });
});

function searchPage(page, guildID, songname, artist, songlength, successful){
  var mainsonglist = [];
  var backupsonglist = [];

  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }
  let settings = sData[1];

  

  scrapeYt.search(settings.query.replace("$title", songname).replace("$artist", artist).replace(" ", "%20"), { type: "video", page:page}).then(videos => {
      var data = processVideoList(guildID, page, videos, songlength);//parse videos from search
      var return_ = data[0];
      
      if(return_ == 2){
        if(deepDebug)
        console.log("page " + page + " failed");
        successful([], []);
      }else{
      for(var song of data[1]){
        mainsonglist.push(song);
      }
      for(var song of data[2]){
        backupsonglist.push(song);
      }
      if(return_ == 1){
        successful(mainsonglist, backupsonglist);
        if(deepDebug)
        console.log("page " + page + " successful but ended");
      }
      else{
        if(deepDebug)
        console.log("page " + page +" does not satisfy");
          searchPage(page+1, guildID, songname, artist, songlength, function success(mainsonglist1, backupsonglist1){
            for(var song of mainsonglist1){
              mainsonglist.push(song);
            }
            for(var song of backupsonglist1){
              backupsonglist.push(song);
            }
          successful(mainsonglist, backupsonglist);
        });
      }
    }
    });
  }

function processVideoList(guildID, page, videos, songlength) {
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }
  let settings = sData[1];
  //get input parameters

  var songlist = [];
  var unbiasedsonglist = [];

  if(videos.length==0){
    if(deepDebug)
    console.log("zero length data");
    return [2, 0, 0];
  }

  for (var i = 0; i < videos.length; i++) {//look through every video in request
    if(deepDebug)
    console.log("checking video [" + page*10+ i + "]");
    let video = videos[i];
    var duration = 0;
    if (video != undefined) {
      duration = video.duration;
      var videosong = {
        id: video.id,
        match: Math.abs(songlength - duration) < songmaxdeviation,
        lengthdeviation: Math.abs(songlength - duration)
      }
      if (videosong.match)//if song is close in length, add to "similar" list
        songlist.push(videosong);
      else
        unbiasedsonglist.push(videosong);//if song is not close in length, add to "unbiased" list
      if (songlist.length + unbiasedsonglist.length + page*10 > settings.max_backup_searches)
        return [1, songlist, unbiasedsonglist];
    }
  }
  return [0, songlist, unbiasedsonglist];
}

function downloadData(unsuccessful, guildID, r, matchsongs, index, start) {
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }

  let data = sData[0];

  if (index == matchsongs.length) {//if there is no song in the index position (out of range exception)
    unsuccessful(guildID);//leave with exception
    return;
  }
  var song = matchsongs[index];

  var unique = 0;
  var firstchunk = 1;
  
  ytdl("youtube.com/watch?v=" + song.id, { filter: 'audioonly' }).on("data", (chunk) => {//download music file
    if(r!=data.songhandler){
      data.songqueue.shift();
      return;
    }
    if (firstchunk == 1) {
      if(data.stream!=null)
      data.stream.destroy();
      data.stream = new streamBuffers.ReadableStreamBuffer({
        frequency: 10,      // in milliseconds.
        chunkSize: 2048     // in bytes.
      });
      data.stream.on('end', ()=>{
        data.playing = false;
      });
      firstchunk = 0;
      var delay = Date.now() - start;
      var action = 0;
      var delay_now = data.delay;

      if (delay >= data.delay || data.playing) {//if new song delay >= old delay
        action = 1;
        data.delay = delay;//next delay is higher
        delay_now = 0;
      } else {//new delay is less than old
        action = -1;
        delay_now = data.delay - delay;//difference between delays
      }

      if(deepDebug){
      console.log('song play delay=' + delay + " [" + action + "]");
      console.log("queue adjustment delay=" + delay_now);
      }
      setTimeout(playStream, delay_now, guildID);
    }
    data.stream.put(chunk);
  }).on("progress", (chunksize, val, total) => {
    if (downloadUpdateInterval != 0 && deepDebug) {
      var percent = Math.floor(val * 100 / total);
      var percent_2 = Math.floor(percent / downloadUpdateInterval);
      if (percent_2 != unique) {
        unique = percent_2;
        console.log("downloading [" + val + "/" + total + "]  " + percent + "%");//show download progress
      }
    }
  }).on("error", (e) => {
    if(deepDebug)
    console.log("song download failed. moving to next one [" + index + "+1]");
    downloadData(unsuccessful, guildID, r, matchsongs, index + 1, inp);
  });
}

async function playStream(guildID) {
  if(deepDebug)
  console.log('play stream');
  let sData = serverData[guildID];
  if (!sData) {
    console.log(ERROR.errorcode_1(guildID));
    return;
  }

  let data = sData[0];
  let settings = sData[1];

  var song = data.songqueue.shift();
  if(song==undefined)
  return;
  var dispatcher = data.connection.play(data.stream);
  dispatcher.on('start', ()=>{
    data.textChannel.send(`Started playing: **${song.title} by ${song.artist}**`);
    console.log(`Playing: ${song.title} by ${song.artist}`);
    data.playing = true;
  });
  dispatcher.on('error', (e)=>{
    console.log(e);
  });
  dispatcher.setVolume(settings.volume);
  data.dispatcher = dispatcher;
}



