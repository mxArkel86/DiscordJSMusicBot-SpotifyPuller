# DiscordMusicBot

**A discord music bot that plays the song you are currently listening to on spotify (no login needed)**

---------------------------------------------------
The bot is a work in progress project built for 
nodejs with the discord.js library to allow access 
to the discord api


The bot is made to expect some lag between a song being switched to by the spotify user and it being played by the bot. The amount of delay is naturally determined by the internet speed of the host. Delay is overlapped so a song with high delay will have its delay amount used for the proceeding tracks in order to have the whole song play through. Delay is reset by a song being played out of order. Thats pretty much all that is to be said.*


*Please report bug fixes in order to improve the experience of others. Credit is not needed though copying source code to claim as their own in a duplicate repository is prohibited.*

**Config File** *(please use the included config file which is without comments)*<br>
*<config.json>*<br>
__{__<br>
__"prefix": "",__  #the prefix that is expected before a command is typed  (ex. !, -, +, *)<br>
__"token": "",__ #the token of the discord bot. To set one up, go to  [https://discord.com/developers/applications](https://discord.com/developers/applications "https://discord.com/developers/applications")<br>
__"max_backup_searches":__ 2 #the maximum amount of backup searches to have without including the first one. A lower value is faster but may allow for errors to appear in some circumstances <br>
__}__
