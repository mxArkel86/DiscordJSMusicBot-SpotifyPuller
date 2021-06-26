const scrapeYt = require("scrape-yt");
//#region Imports
var streamBuffers = require("stream-buffers");
const ytdl = require("ytdl-core");
const { setTimeout } = require("timers");
//file imports
const UTIL = require("./util.js");

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
  
    let sData = UTIL.GetData(guildID);
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
          if (UTIL.gconfig.deepDebug) console.log("page " + page + " failed");
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
            if (UTIL.gconfig.deepDebug) console.log("page " + page + " successful but ended");
          } else {
            if (UTIL.gconfig.deepDebug) console.log("page " + page + " does not satisfy");
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
    let sData = UTIL.GetData(guildID);
    if (sData == null) return;
    let settings = sData[1];
    //get input parameters
  
    var songlist = [];
    var unbiasedsonglist = [];
  
    if (videos.length == 0) {
      if (UTIL.gconfig.deepDebug) console.log("zero length data");
      return [2, 0, 0];
    }
  
    for (var i = 0; i < videos.length; i++) {
      //look through every video in request
      if (UTIL.gconfig.deepDebug) console.log("checking video [" + page * 10 + i + "]");
      let video = videos[i];
      var duration = 0;
      if (video != undefined) {
        duration = video.duration;
        var videosong = {
          id: video.id,
          match: Math.abs(songlength - duration) < UTIL.gconfig.songmaxdeviation,
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
  
  function downloadData(unsuccessful, guildID, r, matchsongs, index, start, playStream) {
    let sData = UTIL.GetData(guildID);
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
    if (UTIL.gconfig.deepDebug) {
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
  
          if (UTIL.gconfig.deepDebug) {
            console.log("song play delay=" + delay + " [" + action + "]");
            console.log("queue adjustment delay=" + delay_now);
          }
          setTimeout(playStream, delay_now, guildID);
        }
        data.stream.put(chunk);
      })
      .on("progress", (chunksize, val, total) => {
        if (UTIL.gconfig.downloadUpdateInterval != 0 && UTIL.gconfig.deepDebug) {
          var percent = Math.floor((val * 100) / total);
          var percent_2 = Math.floor(percent / UTIL.gconfig.downloadUpdateInterval);
          if (percent_2 != unique) {
            unique = percent_2;
            console.log(
              "downloading [" + val + "/" + total + "]  " + percent + "%"
            ); //show download progress
          }
        }
      })
      .on("error", (e) => {
        if (UTIL.gconfig.deepDebug) {
          console.log("song download failed. moving to next one [" + index + "]");
          console.error("error=" + e);
        }
        downloadData(unsuccessful, guildID, r, matchsongs, index + 1, start);
      });
  }

  module.exports = {
    searchPage, downloadData
}