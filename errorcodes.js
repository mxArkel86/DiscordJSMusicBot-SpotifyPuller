const flag = "[ERROR]: ";
var serverblacklst = [];

module.exports = {
  errorcode_1: function (x) {
    if(!serverblacklst.includes(x)){
      serverblacklst.push(x);
      return flag + "A configuration is missing for the discord server " + x + '. If this is your first time running the server, please consider adding the server to the config file as mentioned in ./README.md';
    }
  },
  errorcode_2: function (x) {
    return flag + "A user by the query string \"" + x + "\" could not be found in your channel";
  },
  errorcode_3: function (x) {
    return flag + "The user by the name of \"" + x + "\" is not connected to a voice channel";
  },
  errorcode_4: function (x) {
    return flag + "You are not connected to a voice channel " + x;
  },
  errorcode_5: function (x) {
    return flag + "You are not connected to the same voice channel as the bot " + x;
  },
  errorcode_6: function (x) {
    return flag + "Multiple users were found with the specified query string \"" + x + "\"";
  },
  errorcode_7: function () {
    return flag + "You are not connected to the same channel as the specified user";
  }
}
