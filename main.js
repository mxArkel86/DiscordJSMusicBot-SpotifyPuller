const Discord = require("discord.js");
const http = require('http');
var streamBuffers = require('stream-buffers');
const Stream = require('stream')
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");
const { Console } = require("console");
const { filterFormats } = require("ytdl-core");
const { formatWithOptions } = require("util");
const { format } = require("path");
const { exit } = require("process");

const client = new Discord.Client();

const guildData = new Map();

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting...");
});


client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async message => {
  checkData(message.guild);
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
    const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }
  

  const prefab = guildData.get(message.guild.id);
  prefab.voiceChannel = voiceChannel;
  prefab.textChannel = message.channel;

  if(message.content==`${prefix}link`){
    

    try {
      prefab.userID = message.author.id;
      prefab.song = null;
      var connection = await voiceChannel.join();
      prefab.connection = connection;
      prefab.textChannel.send("User *" + message.author.username + "* linked");
      return;
    } catch (err) {
      console.log(err);
      guildData.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, prefab);
    return;
  } else if (message.content.startsWith(`${prefix}query `)) {
    prefab.query = message.content.substr(`${prefix}query`.length + 1)
    message.channel.send("set query");
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
  guildData.set(prefab.guildID, prefab);
});

client.on("voiceStateUpdate", async (oldMember, newMember)=>{
  let oldUserChannel = oldMember.channel;
	let newUserChannel = newMember.channel;
  checkData(oldMember.guild);
  const guildID = oldMember.guild.id;
  var prefab = guildData.get(oldMember.guild.id);
  
  var userid = newMember.member.id;
  var type = 0;
  if(newUserChannel===null)//user left
    type = -1;
  else if(oldUserChannel===null)//user joined
    type = 1;
  

  if(userid == prefab.userID){
  if(type==-1){//user left the channel
    stop(prefab, oldMember.channel);
    prefab.userID = null;
    if(oldUserChannel.members.size<2)
    oldUserChannel.leave();
  }
  }
  guildData.set(prefab.guildID, prefab);
});

client.on("presenceUpdate", async message => {

  if(message===undefined)
  return;
  const guildID = message.guild.id;
  var prefab;
  if(!(prefab = guildData.get(guildID)))
  return;
  var userid = message.userID;
  if(prefab.userID != userid)//user matches
  return;
  
  var activities = message.user.presence.activities;

  var found = false;
  var activity = null;
  for(a of activities){
    var name = a.name;
    if(name!="Spotify")
    continue;

    found = true;
    activity = a;
    break;
  }
  if(!found)
  return "Spotify is not the current status";
  //spotify is an activity
  var songname = activity.details;
  var artist = activity.state;
  
  console.log("Presence updated");
  
  var d = Date.now();
  http.get("http://youtube-scrape.herokuapp.com/api/search?q=" + prefab.query.replace("$title", songname).replace("$artist", artist) +"&page=1", function(res) {
    let data = '',
      json_data;
  
    res.on('data', function(stream) {
      data += stream;
    });
    res.on('end', function() {
      var prefab = guildData.get(guildID);
      json_data = JSON.parse(data);
      var video = json_data.results[0].video;
      var duration = video.duration;
      var sec = parseInt(duration.split(':')[0])*60 + parseInt(duration.split(':')[1]) ;
      const song = {
        title: songname,
        artist: artist,
        url: video.url,
        data: null,
        delay: 0
      };
      song.delay = Date.now() - d;
      guildData.set(guildID, prefab);
      process(guildID, song);
      
    });
  });
  return "0";
});

async function stop(prefab, channel) {
  prefab.song = null;
  if(prefab.connection.dispatcher!==null)
  prefab.connection.disconnect();
}

function checkData(guild){
  if(!guildData.get(guild.id)){
    console.log("creating guild prefab");
    const guildPrefab = {
      guildID: guild.id,
      textChannel: null,
      voiceChannel: null,
      connection: null,
      songs: [],
      volume: 5,
      userID: null,
      playing: false,
      delay: 0,
      query:"$title $artist"
    };
    guildData.set(guild.id, guildPrefab);
  }
}

async function playStream(guildID){
  prefab = guildData.get(guildID);
  var song = prefab.songs.shift();
  console.log('begin');
  console.log(song.data.length);
  var d = Date.now();
  var myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 10,      // in milliseconds.
    chunkSize: 2048     // in bytes.
  }); 
  
  // With a buffer
  myReadableStreamBuffer.put(song.data);
  
  let dispatcher = prefab.connection
  .play(myReadableStreamBuffer)
  .once("speaking", ()=>{
    prefab = guildData.get(prefab.guildID);
    console.log("speaking");
    prefab.textChannel.send(`Start playing: **${song.title}**`);
    song.delay += Date.now()-d;
    console.log("delay=" +song.delay);
    prefab.delay = song.delay+500;
    prefab.playing = true;
    guildData.set(prefab.guildID, prefab);
  })
  .on("finish", () => {
    prefab = guildData.get(prefab.guildID);
    console.log("natural stop");
    prefab.playing = false;
    guildData.set(prefab.guildID, prefab);
  })
  .on("error",  (e)=>{
    console.log(e);
  });
 
dispatcher.setVolumeLogarithmic();
dispatcher.setVolumeLogarithmic(prefab.volume / 5);
}

async function process(guildID, song) {
  console.log("initializing stream");
  var start = Date.now();
  
  var bufs = [];
  
  ytdl(song.url, { filter : 'audioonly' }).on("data", (chunk)=>{
    bufs.push(chunk);
  }).on("end",()=>{
    var buf = Buffer.concat(bufs);
    var prefab = guildData.get(guildID);
    song.delay += Date.now()-start;
    console.log("song saved");
    song.data = buf;
    prefab.songs.push(song);
    if(prefab.playing)
      prefab.delay = 0;
    setTimeout(playStream, prefab.delay, guildID);

    guildData.set(guildID, prefab);
  });
  
  
}

client.login(token);
