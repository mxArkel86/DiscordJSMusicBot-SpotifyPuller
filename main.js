//#region Imports
const Discord = require("discord.js");
const http = require('http');
const fs = require('fs')
var streamBuffers = require('stream-buffers');
const ytdl = require("ytdl-core");
const { Console } = require("console");
const { filterFormats } = require("ytdl-core");
const { formatWithOptions } = require("util");
const { format } = require("path");
const { exit } = require("process");
////#endregion

var _prefix='!';
var _token=null;
//load config file
var f_ = -1;
if(fs.existsSync('./configOverride.json')){
var { prefix, token } = require("./configOverride.json");
_prefix = prefix;
_token = token;
f_ = 1;
}
else{
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
  console.log("Ready!");
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


  if(message.content==`${_prefix}link`){
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

client.on("voiceStateUpdate", async (oldMember, newMember)=>{
  //get channel data
  let oldUserChannel = oldMember.channel;
	let newUserChannel = newMember.channel;
 
  const guildID = oldMember.guild.id;
  var prefab = dPull(guildID);
  
  var userid = newMember.member.id;
  var type = 0;
  if(newUserChannel===null)//user left
    type = -1;
  else if(oldUserChannel===null)//user joined
    type = 1;
  

  if(userid == prefab.userID){
  if(type==-1){//user left the channel
    stop(prefab);//stop voice interaction
    prefab.userID = null;//disconnect user link

    //if users in channel is 1 or 0
    if(oldUserChannel.members.size<2)
    oldUserChannel.leave();

    //remove guild data
    dSet(guildID, prefab);
    guildData.delete(prefab);
  }
  }
});

client.on("presenceUpdate", async data => {

  if(data===undefined)
  return;
  const guildID = data.guild.id;
  var prefab;
  if(!(prefab = dPull(guildID)))//data created previously from commmand
  return;
  var userid = data.userID;
  if(prefab.userID != userid)//user matches
  return;
  
  var activities = data.user.presence.activities;

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

  //spotify is an activity of the user
  var songname = activity.details;
  var artist = activity.state;
  
  console.log("user presence updated");
  
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

async function stop(prefab) {
  prefab.songs = [];
  if(prefab.connection.dispatcher!==null)
  prefab.connection.disconnect();
}

function checkData(guildID){
  if(!dPull(guildID)){
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
      query:"$title $artist"
    };
    dSet(guildID, guildPrefab);
  }
}
function dPull(guildID){
  return guildData.get(guildID);
}
function dSet(guildID, guildPrefab){
  return guildData.set(guildID, guildPrefab);
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
    if(song.delay>prefab.delay)
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

client.login(_token);
