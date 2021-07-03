# DiscordMusicBot

<h2>A discord music bot that grabs the spotify status present in discord to play the song you are currently listening to</h2>
<p>Spotify Premium Listen Together Discord Bot Edition (With Delay)</p>
<p>Distributions allowed on the *Open Source License*</p>
---------------------------------------------------
<h4>The bot is a work in progress project built for nodejs with the <i>discord.js library, ytdl library, and youtube scraper library</i></h4>

<br><h2>Initial System Setup:</h2>
<span>In order to run the program (main.js), a javascript runtime must be installed to load the file. NodeJS is a particular favorite of mine, and is already set up for in this repo in the executable files <b>start.bat</b> and <b>start.sh</b>. The link to NodeJS is presented below. To run the program, run the previously mentioned executable file (.bat for windows and .sh for linux), or copy the command from within the respective file and run it in a console with its location set to the repository parent directory.</span>
<h2>Server Setup:</h2>
<h3>Steps</h3>
<p>Duplicate config file</p><br>
<p>Create discord bot on discord developer portal (fill config with token/prefix)</p><br>
<p>Fill config with server id from @serverid</p><br>
<p>Install ffmpeg (if necessary)</p><br>
-------------------<br>
<span>First, duplicate the "__configExample.json" file and rename it to config.json, all in the configs directory. Next, you may exit file explorer and now must go on the web to create a discord bot. To do this, go to the "Discord Developer Portal" as represented by the link below. Log in to your discord account, and click on "New Application" on the top right of the webpage. Give your bot a name. Next, navigate on the left side of this new page to the "bot" section. Click on "Add Bot" and confirm your decision. Scroll down to where it says "Privileged Gateway Intents", and turn on both options (Presence Intent and Server Members Intent). Both pieces of information are required. Steps to set up the discord bot and specifics about user data are elaborated in the "Bot Setup" link below. Next, scroll up and click on the "Copy" button below the token, and paste this token in your config file. In the config file, add your server id to 'server id placeholder', and your selected prefix into 'server prefix placeholder'. If you do not know your server id, type <b>@serverid</b> in any text channel in your server (while the bot is running and with the token saved in the file) and your id will be given. Put in the server id into the config file, close the bot, and reopen it. You are done!</span><br>
<span>In the case that the console gives you an error such as the word FFMPEG is mentioned, then install ffmpeg via a package manager or download the ffmpeg compiled executable from the FFMPEG official website listed below. You can either install ffmpeg in a meaningful location on your system and add a PATH entry, or extract the ffmpeg executable in the parent directory of this project.</span>
Discord Developer Portal: https://discord.com/developers/applications <br>
Bot Setup: https://support.discord.com/hc/en-us/articles/360040720412#how-do-i-start-the-process <br>
NodeJS: https://nodejs.org/en/download/
FFMPEG: https://ffmpeg.org/download.html

---------------------------------------------------
<h2>Overview</h2>
<p>The bot is made to expect some lag between a song being switched to by the spotify user and it being played by the bot. The amount of delay is naturally determined by the internet speed of the host. Delay is overlapped so a song with high delay will have its delay amount used for the proceeding tracks in order to have the whole song play through. Delay is reset by a song being played out of order. Thats pretty much all that is to be said.</p>


*Please report bug fixes in order to improve the experience of others*
<br><br>
<h2>Breakdown</h2>
<span>The bot goes through the same process whenever it decides to play a song:<br></span><br>
<p>
    1). waits for the status of a user to change<br>
    2). checks parameters to make sure the user is the right one and no errors may run<br>
    3). grabs a list of songs from youtube using a search query defined by the status of the user and formatted by the config file<br>
    4). attempts to download a song using ytdl-core, and switches to backup songs if an error occurs<br>
    5). plays the song when the first byte is received<br></p>
    <span>By going through this process, song delay between detection and playing is minimized up to the limitations of the user's network capabilities and processing speeds of subpackages like ytdl-core
</span><br><br>

**Here is a breakdown of a standard config file**<br>
**Config File** *(please use the included config file which is without comments)* <br>
*<config.json>* <br>
<pre>
{  <br>
    "token":"",  #the token of the discord bot <br>
    "downloadUpdateInterval": 1, #how often the console will be pinged with download messages (0 = none)
    "deepDebug": false, #the debugging level (true=all debug messages / false=surface level debugging)
    "formats": #the different formats that the servers might have decided to go for <br> 
    {  <br>
        "default":{  #the name of the format<br>
            "prefix":"!", #the prefix for all commands being sent through <br>
            "max_page_search": 2, #the maximum amount of pages for the youtube scraper to look through (10 videos per page) <br>
            "max_page_search": 8, #the maximum amount of videos for the youtube scraper to consider before stopping <br>
            "volume": 2, #the overall volume of the discord bot <br>
            "query": "$title by $artist" #the query string used to search for music <br>
        },  <br>
        "alt":{  <br>
            "prefix":"-",  <br>
            "max_page_search": 2,  <br>
            "max_song_store": 8,  <br>
            "volume": 5,  <br>
            "query": "$title by $artist"  <br>
        }  <br>
    },  <br>
    "servers": [ #the different servers used by the bot <br> 
        {  <br>
            "id":"654776754", #the id of the server <br>
            "format":"default" #the format the server adopted (0 indexing) <br>
        },  <br>
        {  <br>
            "id":"56567845464323",  <br>
            "format":"alt"  <br>
        }  <br>
    ]  <br>
}  <br>
</pre>
