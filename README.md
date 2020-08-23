# DiscordMusicBot

**A discord music bot that plays the song you are currently listening to on spotify (no login needed)**

---------------------------------------------------
The bot is a work in progress project built for 
nodejs with the discord.js library to allow access 
to the discord api

**Initial setup:**<br>
go into the config.json file and add your server id to "<server id placeholder>", and your selected prefix into <prefix placeholder>. If you do not know your server id, type in @serverid and your id will be given


The bot is made to expect some lag between a song being switched to by the spotify user and it being played by the bot. The amount of delay is naturally determined by the internet speed of the host. Delay is overlapped so a song with high delay will have its delay amount used for the proceeding tracks in order to have the whole song play through. Delay is reset by a song being played out of order. Thats pretty much all that is to be said.*


*Please report bug fixes in order to improve the experience of others*

**Config File** *(please use the included config file which is without comments)* <br>
*<config.json>* <br>
<pre>
{  <br>
    "token":"",  #the token of the discord bot <br>
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
