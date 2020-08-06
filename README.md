# DiscordMusicBot

**A discord music bot that plays the song you are currently listening to on spotify (no login needed)**

---------------------------------------------------
The bot is a work in progress project built for 
nodejs with the discord.js library to allow access 
to the discord api


The bot is made to expect some lag between a song being switched to by the spotify user and it being played by the bot. The amount of delay is naturally determined by the internet speed of the host. Delay is overlapped so a song with high delay will have its delay amount used for the proceeding tracks in order to have the whole song play through. Delay is reset by a song being played out of order. Thats pretty much all that is to be said.*


*Please report bug fixes in order to improve the experience of others. Credit is not needed though copying source code to claim as their own in a duplicate repository is prohibited.*

**Config File** *<config.json>* *(please use the included config file which is without comments)* <br>

__{__ <br>
    "token":"", <br>
    "formats": <br>
    [ <br>
      __{__ <br>
            "prefix":"!", <br>
            "max_backup_searches": 2, <br>
            "volume": 2, <br>
            "query": "$title" <br>
      __},__ <br>
      __{__ <br>
            "prefix":"-", <br>
            "max_backup_searches": 5, <br>
            "volume": 5, <br>
            "query": "$title by $artist" <br>
      __}__ <br>
    ], <br>
    "servers": [ <br>
      __{__ <br>
            "id":"654776754", <br>
            "format":0 <br>
      __},__ <br>
      __{__ <br>
            "id":"56567845464323", <br>
            "format":1 <br>
      __} <br>
    ] <br>
__}__ <br>
