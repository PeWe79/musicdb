
"use strict";
/*
 * This class provides the mdbstate view consisting of the following components:
 *
 * Requirements:
 *   - JQuery
 *   - mdbstate.css
 * Show:
 *   - ShowMusicDBStateView(parentid)
 *   - SetMusicDBOnlineState(mdbstate, mpdstate)
 *   - SetMusicDBPlayingState(serverstate, clientstate)
 * Functions:
 * Callbacks:
 * Recommended Paths:
 * Trigger: (fnc -> sig)
 *
 * Timer:
 *   When the queue is loaded first clear the timer, then add the playtime of each queue entry
 *   On onTimeChanged-mpd-event set the TimePlayed. This call will also update the view
 */

var MDBMODE = "audio";  // audio/video

function ShowMusicDBStateView(parentID)
{
    var html = "";

    html += "<div id=MDBStateView class=\"hlcolor smallfont\">";

    // Icecast
    html += "<span id=MPDState class=\"onlinestate\" data-online=\"unknown\">";
    html += "Icecast";
    html += "</span><br>";

    // MusicDB
    html += "<span id=MDBReconnectBtn data-online=\"unknown\""; 
    html += " title=\"Reconnect to MusicDB server\"";
    html += " onclick=\"ConnectToMusicDB();\">";
    html += "&#xf021;";
    html += "</span>";
    html += "<span id=MDBState class=\"onlinestate\" data-online=\"unknown\">";
    html += "MusicDB";
    html += "</span><br>";

    // Mode Select
    html += "<span id=MDBModeswitchBtn";
    html += " title=\"Switch between Audio/Video mode\"";
    html += " onClick=\"ToggleMusicDBMode();\"";
    html += ">";
    html += "↹";
    html += "</span>";
    html += "<span id=MDBMode";
    html += " class=\"onlinestate\"";
    html += " data-mode=\"unknown\"";
    html += " onClick=\"ToggleMusicDBMode();\"";
    html += ">";
    html += "Mode";
    html += "</span><br>";

    // Playtime
    html += "<span id=CurrentTime  class=\"timestats\" data-playstate=\"unknown\">";
    html += "00:00:00";
    html += "</span>";
    html += " / ";
    html += "<span id=PlayTime class=\"timestats\" data-playstate=\"unknown\">";
    html += "00:00:00";
    html += "</span>";

    html += "</div>";
    
    // Create Element
    $("#"+parentID).html(html);
}

// Valid states: yes, no, error, unknown, *null* (to change nothing)
function SetMusicDBOnlineState(mdbstate, mpdstate)
{
    var mpdid = "#MPDState";
    var mdbid = "#MDBState";
    var recon = "#MDBReconnectBtn"; // shall have same state as MDBState

    if(mpdstate != null)
    {
        $(mpdid).attr("data-online", mpdstate);
    }
    
    if(mdbstate != null)
    {
        $(mdbid).attr("data-online", mdbstate);
        $(recon).attr("data-online", mdbstate);
    }
}

// Valid states: unknown, playing, paused, *null* (to change nothing)
function SetMusicDBPlayingState(serverstate, clientstate)
{
    var ssid = "#PlayTime";
    var csid = "#CurrentTime";

    if(serverstate != null)
        $(ssid).attr("data-playstate", serverstate);
    if(clientstate != null)
        $(csid).attr("data-playstate", clientstate);
}



var GLOBAL_TotalPlaytime = 0;   // total playtime of all songs in the queue
var GLOBAL_TimePlayed    = 0;   // time the first song in the queue was played

function HMSToString(h,m,s)
{
    // convert to string
    var ss = ("00"+s).substr(-2);
    var ms = ("00"+m).substr(-2);
    var hs = ("00"+h).substr(-2);

    // create timestring
    return hs + ":" + ms + ":" + ss;
}

function AddPlaytime(playtime)
{
    GLOBAL_TotalPlaytime += playtime;
}

function ClearPlaytime()
{
    GLOBAL_TotalPlaytime = 0;
}

function SetTimePlayed(played)
{
    GLOBAL_TimePlayed = played;
    // Ugly but works fine for now.
    // SetTimePlayed gets called by the websocket handler. The server sends every second (depending on its config)
    // the current state of the currently playing song. So this function gets called every second independent if
    // the the song is playing or not.
    UpdateTimeview();
}

function UpdateTimeview()
{
    // Get current time
    var date = new Date();

    var h = date.getHours();
    var m = date.getMinutes();
    var s = date.getSeconds();

    // Calculate estimated end time (hours, minutes and seconds)
    var es = s + GLOBAL_TotalPlaytime - GLOBAL_TimePlayed;
    var em = m + Math.floor(es / 60);
    var es = Math.floor(es % 60);
    var eh = h + Math.floor(em / 60);
    var em = Math.floor(em % 60);
    var eh = Math.floor(eh % 24);

    // convert to string
    var currenttime = HMSToString( h,  m,  s);
    var endtime     = HMSToString(eh, em, es);

    // Display time
    $('#CurrentTime').html(currenttime);
    $('#PlayTime').html(endtime);
}


function ToggleMusicDBMode()
{
    // Switch mode
    if(MDBMODE == "audio")
    {
        MDBMODE = "video";
    }
    else
    {
        MDBMODE = "audio";
    }

    // Reset genre-selection timer
    if(reloadtimeouthandler !== null)
    {
        clearTimeout(reloadtimeouthandler);
        reloadtimeouthandler = null;
    }

    // Get artist list for new mode
    _MDBState_RequrestContentUpdate();
    // The UpdateMDBState signal make other clients to request the data by them self.
    // So there is no need for a Broadcast-Request
    
    // Inform everyone about the mode change
    // The Call will trigger a broadcast of GetMDBState
    // By making a Request and giving a function signature the broadcast
    // gets handled exactly like a GetMDBState request
    MusicDB_Request("SetMDBState", "UpdateMDBState",
        {category:"MusicDB", name:"uimode", value:MDBMODE});
}

function UpdateMusicDBMode(MDBState)
{
    // Check and update UI Mode
    if(MDBMODE != MDBState.MusicDB.uimode)
    {
        MDBMODE = MDBState.MusicDB.uimode;
        _MDBState_RequrestContentUpdate();    // Reload Artist list for new Mode
    }    
    $("#MDBMode").attr("data-mode", MDBMODE);
}

function _MDBState_RequrestContentUpdate()
{
    if(MDBMODE == "audio")
    {
        MusicDB_Request("GetFilteredArtistsWithAlbums", "ShowArtists");
        MusicDB_Request("GetSongQueue",                 "ShowSongQueue");
    }
    else if(MDBMODE == "video")
    {
        MusicDB_Request("GetFilteredArtistsWithVideos", "ShowArtists");
        MusicDB_Request("GetVideoQueue",                "ShowVideoQueue");
    }
}

// vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

