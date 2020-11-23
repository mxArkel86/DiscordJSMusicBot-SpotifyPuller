# DiscordMusicBot

<h2>A discord music bot that grabs the spotify status present in discord to play the song you are currently listening to</h2>
<p>Spotify Premium Listen Together Discord Bot Edition (With Delay)</p>
<p>Distributions allowed on the *Open Source Lisence*</p>
---------------------------------------------------
<h4>The bot is a work in progress project built for nodejs with the <i>discord.js library, ytdl library, and youtube scraper library</i></h4>

<br><h2>Initial setup:</h2>
<span>Go into the config.json file and add your server id to 'server id placeholder', and your selected prefix into 'prefix placeholder'. If you do not know your server id, type <b>@serverid</b> in any text channel in your server and your id will be given. Furthermore, when setting up the bot, remember to enable its intents to gather user data and presence data. Both are required and steps are elaborated in the following article.</span>
https://support.discord.com/hc/en-us/articles/360040720412#how-do-i-start-the-process

---------------------------------------------------
<h2>Hint</h2>
<p>The bot is made to expect some lag between a song being switched to by the spotify user and it being played by the bot. The amount of delay is naturally determined by the internet speed of the host. Delay is overlapped so a song with high delay will have its delay amount used for the proceeding tracks in order to have the whole song play through. Delay is reset by a song being played out of order. Thats pretty much all that is to be said.</p>


*Please report bug fixes in order to improve the experience of others*
<br><br>
<h2>Breakdown</h2>
<span>The bot goes through the same process whenever it decides to play a song:<br></span><br>
<p>
    1). waits for the status of a user to change<br>
    2). checks parameters to make sure the user is the right one and no errors may run<br>
    3). grabs a list of songs from youtube using a search query defined by the status of the user and formatted by the config file<br>
    4). attempts to download a song using ytdl-core, and switching to a backup song if an error occurs<br>
    5). plays the song when the first byte is received<br></p>
    <span>By going through this process, song delay between detection and playing is minimized up to the limitations of the user's network capabilities and processing speeds of subpackages like ytdl-core
</span><br><br>

**Here is a breakdown of the config.json file**<br>
**Config File** *(please use the included config file which is without comments)* <br>
*<config.json>* <br>
<pre>
{  <br>
    "token":"",  #the token of the discord bot <br>
    "downloadUpdateInterval": 1, #how often the console will be pinged with download messages (0 = none)
    "songmaxdeviation": 2, #the amount of seconds off a song on youtube must be for it to be considered a good match
    "deepDebug": false, #the debugging level (true=all debug messages / false=surface level debugging)
    "formats": #the different formats that the servers might have decided to go for <br> 
    [  <br>
        {  <br>
            "prefix":"!", #the prefix for all commands being sent through <br>
            "max_backup_searches": 2, #the maximum amount of backup searches in case a search element breaks <br>
            "volume": 2, #the overall volume of the discord bot <br>
            "query": "$title" #the query string used to search for music <br>
        },  <br>
        {  <br>
            "prefix":"-",  <br>
            "max_backup_searches": 5,  <br>
            "volume": 5,  <br>
            "query": "$title by $artist"  <br>
        }  <br>
    ],  <br>
    "servers": [ #the different servers used by the bot <br> 
        {  <br>
            "id":"654776754", #the id of the server <br>
            "format":0 #the format the server adopted <br>
        },  <br>
        {  <br>
            "id":"56567845464323",  <br>
            "format":1  <br>
        }  <br>
    ]  <br>
}  <br>
</pre>
