const Discord = require("discord.js");
const http = require('http');
const { prefix, token } = require("./config.json");
const ytdl = require("ytdl-core");
const { Console } = require("console");

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
  prefab.textChannel = message.textChannel;

  if(message.content==`${prefix}link`){
    prefab.userID = message.author.id;
    prefab.song = null;

    try {
      var connection = await voiceChannel.join();
      prefab.connection = connection;
      return;
    } catch (err) {
      console.log(err);
      guildData.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, prefab);
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
  if(!guildData.get(message.guild.id))return;
  prefab = guildData.get(message.guild.id);
  var userid = message.userID;
  if(prefab.userID != userid)
  return;
  prefab.textChannel.send("Presence updated");
  var activities = user.presence.activities;

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
  
  console.log(activity);

  var songname = activity.details;
  var artist = activity.state;
  guildData.set(prefab.guildID, prefab);
  http.get("http://youtube-scrape.herokuapp.com/api/search?q=" + songname + " by " + artist +"&page=1", function(res) {
    let data = '',
      json_data;
  
    res.on('data', function(stream) {
      data += stream;
    });
    res.on('end', function() {
      prefab = guildData.get(message.guild.id);
      json_data = JSON.parse(data);
      var video = json_data.results[0].video;
      const song = {
        title: songname,
        artist: artist,
        url: video.url,
      };
      prefab.song = song;
      guildData.set(prefab.guildID, prefab);
      play(prefab);
    });
  });
  return "0";
});

async function stop(prefab, channel) {
  prefab.song = null;
  if(prefab.connection.dispatcher!==null)
  prefab.connection.dispatcher.end();
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
      userID: null
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

  const dispatcher = prefab.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      //play(prefab);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(prefab.volume / 5);
  prefab.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(token);
