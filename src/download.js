const scrapeYt = require("scrape-yt");
//#region Imports
var streamBuffers = require("stream-buffers");
const ytdl = require("ytdl-core");
const { setTimeout } = require("timers");
//file imports
const UTIL = require("./util.js");
const { DataResolver } = require("discord.js");

function searchPage(page, sData, song, successful, failed) {
  var songlist = [];

  let settings = sData[1];

  scrapeYt
    .search(
      settings.query
        .replace("$title", song.title)
        .replace("$artist", song.artist)
        .replace(" ", "%20"),
      { type: "video", page: page }
    )
    .then((videos) => {
      var data = processVideoList(page, sData, song, videos); //parse videos from search
      var return_ = data[0];


      if (return_ == 2) {//entire processing failed
        if (UTIL.gconfig.deepDebug) console.log("page " + page + " failed");
        failed(2);
        return;
      } else {//song list valid
        //add newly found videos to main list
        for (var songvideo of data[1]) {
          songlist.push(songvideo);
        }

        //look through the max number of pages
        if (songlist.length <= settings.max_song_store && page < settings.max_page_search) {
          searchPage(page + 1, sData, song,
            function successful(song, songlist1) {
              for (var song1 in songlist1) {
                songlist.push(song1);
              }
            }, function failed(code) {

            });
        }

        successful(song, songlist);
      }
    });
}

function processVideoList(page, sData, song, videos) {
  let settings = sData[1];

  //initialize song list of page
  var shortsonglist = [];

  if (videos.length == 0) {
    if (UTIL.gconfig.deepDebug) console.log("zero length data");
    return [1, 0, 0];
  }

  for (var i = 0; i < videos.length; i++) {
    //look through every video in request
    if (UTIL.gconfig.deepDebug) console.log("checking video [" + page + "] [" + (i + 1) + "]");

    //get preliminary video data
    let video = videos[i];
    var duration = 0;
    if (video != undefined) {
      duration = video.duration;
      var videosong = {
        id: video.id,
        timedeviation: Math.abs(song.songlength - duration),
        length: duration,
      };

      //add valid video to list
      shortsonglist.push(videosong);
    }
  }
  return [0, shortsonglist];
}

function downloadData(index, songlist, sData, song, playStream) {
  let data = sData[0];

  //index of song being downloaded is not out of range
  if (index >= songlist.length) {
    return;
  }
  var video = songlist[index];

  //initialize downloader/other
  var unique = 0;
  var firstchunk = 1;
  var url = "https://www.youtube.com/watch?v=" + video.id;
  var urlvalid = ytdl.validateURL(url);
  if (UTIL.gconfig.deepDebug) {
    console.log("url valid=" + urlvalid);
    if (urlvalid == false) {
      console.log("ytdl failed to recognize the video url");
      downloadData(index + 1, songlist, sData, song, playStream);
      return;
    }
  }
  var stream = null;
  //begin ytdl download process
  ytdl(url, { filter: "audioonly" })
    .on("data", (chunk) => {

      //if this is the first chunk of data
      if (firstchunk == 1) {

        //initialize new stream object to bot
        stream = new streamBuffers.ReadableStreamBuffer({
          frequency: 10, // in milliseconds.
          chunkSize: 2048, // in bytes.
        });

        if (data.activestream == 1) {
          if (data.stream != null)
            data.stream.destroy();
          data.stream = stream;
        }
        else {
          if (data.stream2 != null)
            data.stream2.destroy();
          data.stream2 = stream;
        }

        //when progress is made on stream
        stream.on("end", () => {
          //song finished playing
          data.playing = false;
          data.connection.setSpeaking(false);
          stream.destroy();
        });

        //set first chunk false for next runs
        firstchunk = 0;

        //calculate delays
        var delay = Date.now() - song.requesttime;
        var action = 0;

        if (data.playing == true) {//fairly sure song is not played out of order

          //if the new delay is greater than the previous delay (song took longer to process)
          if (delay >= data.delay) {

            action = 1;
            data.delay = delay;//set new delay to this one
          } else {
            //song loaded quicker than previous song
            action = 2;

            //stall until current song
            while (data.playing) {

            }
          }
        }

        if (UTIL.gconfig.deepDebug) {
          console.log("song play delay=" + delay + " [" + action + "]");
        }
        //play stream using new stream object
        setTimeout(playStream, 0, song, sData);
      }
      stream.put(chunk);
    })
    .on("progress", (chunksize, val, total) => {
      //
      if (UTIL.gconfig.downloadUpdateInterval != 0 && UTIL.gconfig.deepDebug) {
        var percent = Math.floor((val * 100) / total);
        var percent_2 = Math.floor(percent / UTIL.gconfig.downloadUpdateInterval);
        if (percent_2 != unique) {
          unique = percent_2;
          console.log(
            "downloading [" + val + "/" + total + "]  " + percent + "%" + "  [" + (data.activestream==1?0:1) + "]"
          ); //show download progress
        }
      }
    })
    .on("error", (e) => {
      if (UTIL.gconfig.deepDebug) {
        console.log("song download failed. moving to next one [" + index + "]");
        console.error("error=" + e);
      }
      downloadData(index + 1, songlist, sData, song, playStream);
    });
}

module.exports = {
  searchPage, downloadData
}