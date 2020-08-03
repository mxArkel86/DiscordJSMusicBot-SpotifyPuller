const Discord = require("discord.js");
const http = require('http');
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
  if(!guildData.get(message.guild.id))
  return;
  prefab = guildData.get(message.guild.id);
  var userid = message.userID;
  if(prefab.userID != userid)
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

  var songname = activity.details;
  var artist = activity.state;
  if(prefab.song!==null && songname==prefab.song.title)
    return;
  console.log("Presence updated");
  guildData.set(prefab.guildID, prefab);
  var d = Date.now();
  http.get("http://youtube-scrape.herokuapp.com/api/search?q=" + prefab.query.replace("$title", songname).replace("$artist", artist) +"&page=1", function(res) {
    let data = '',
      json_data;
  
    res.on('data', function(stream) {
      data += stream;
    });
    res.on('end', function() {
      prefab = guildData.get(message.guild.id);
      json_data = JSON.parse(data);
      var video = json_data.results[0].video;
      var duration = video.duration;
      var sec = parseInt(duration.split(':')[0])*60 + parseInt(duration.split(':')[1]) ;
      const song = {
        title: songname,
        artist: artist,
        url: video.url,
        length: sec*1000
      };
      console.log(sec);
      prefab.song = song;
      prefab.delay = Date.now()-d;
      guildData.set(prefab.guildID, prefab);
      console.log("waiting " + prefab.delay + " ms");
      setTimeout(play, 0, prefab)
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
      song: null,
      volume: 5,
      userID: null,
      playing: false,
      delay: 0,
      query:"$title $artist"
    };
    guildData.set(guild.id, guildPrefab);
  }
}

async function play(prefab) {
  var song = prefab.song;
  if (!song) {
    prefab.voiceChannel.leave();
    return;
  }
  
  var start = Date.now();
  var first = true;

  let dispatcher = prefab.connection
    .play(ytdl(song.url, {
      filter: 'audioonly',
      format: 'lowestvideo',
    }))
    .on("speaking", ()=>{
      
      if(first){
        first =false;
      prefab = guildData.get(prefab.guildID);
      console.log("first run");
      prefab.delay += Date.now()-start;
      start = Date.now();
      prefab.playing = true;
      console.log("delay=" +prefab.delay);
      prefab.song.length-=prefab.delay;
      guildData.set(prefab.guildID, prefab);
      }
    })
    .on("finish", () => {
      prefab = guildData.get(prefab.guildID);
      console.log("natural stop");
      prefab.playing = false;
      guildData.set(prefab.guildID, prefab);
    })
    .on("error",  ()=>{
    });
   
  dispatcher.setVolumeLogarithmic();
  dispatcher.setVolumeLogarithmic(prefab.volume / 5);
  prefab.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(token);
