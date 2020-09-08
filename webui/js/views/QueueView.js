// MusicDB,  a music manager with web-bases UI that focus on music.
// Copyright (C) 2017-2020  Ralf Stemmer <ralf.stemmer@gmx.net>
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

"use strict";

class QueueView
{
    constructor()
    {
        this.element = document.createElement("div");
        this.element.classList.add("QueueView");
    }



    GetHTMLElement()
    {
        return this.element;
    }



    // musictype: "audio" or "video"
    Update(musictype, MDBQueue)
    {
        // Reset timer
        if(MDBQueue[0].song !== undefined)
        {
            queuetimemanager.ClearTime("audio");
        }
        else if(MDBQueue[0].video !== undefined)
        {
            queuetimemanager.ClearTime("video");
        }

        this.element.innerHTML = "";
        let queueposition      = 0;
        for(let entry of MDBQueue)
        {
            let entryid     = entry.entryid;
            let MDBAlbum    = entry.album;
            let MDBArtist   = entry.artist;
            let MDBMusic    = null;
            if(musictype == "audio")
                MDBMusic    = entry.song;
            else if(musictype == "video")
                MDBMusic    = entry.video;
            else
                continue;   // No song and no video? Should never happen, but who knows…

            // Update timer
            queuetimemanager.AddTime(musictype, MDBMusic.playtime);
            
            // Create Entry
            let buttonbox   = new ButtonBox_QueueEntryControls(musictype, MDBMusic.id, entryid);
            let dropzone    = new QueueDropZone(entryid);
            let tile        = null;
            if(musictype == "audio")
            {
                tile        = new SongQueueTile(MDBMusic, MDBAlbum, MDBArtist, entryid, queueposition, buttonbox);
            }
            else if(musictype == "video")
            {
                tile        = new VideoQueueTile(MDBMusic, MDBArtist, entryid, queueposition, buttonbox);
            }
            else
                continue;   // No song and no video? Should never happen, but who knows…

            this.element.appendChild(tile.GetHTMLElement());
            this.element.appendChild(dropzone.GetHTMLElement());
            queueposition += 1;
        }
    }



    onMusicDBMessage(fnc, sig, args, pass)
    {
        if(fnc == "GetSongQueue" && sig == "ShowSongQueue")
        {
            let mainviewbox = document.getElementById("RightContentBox"); // \_ HACK
            mainviewbox.innerHTML = "";
            mainviewbox.appendChild(queueview.GetHTMLElement());           // /  This should do a Main View Manager
            this.Update("audio", args);
        }
        else if(fnc == "GetVideoQueue" && sig == "ShowVideoQueue")
        {
            let mainviewbox = document.getElementById("RightContentBox"); // \_ HACK
            mainviewbox.innerHTML = "";
            mainviewbox.appendChild(queueview.GetHTMLElement());           // /  This should do a Main View Manager
            this.Update("video", args);
        }
    }
}





class QueueDropZone extends DropTarget
{
    constructor(entryid)
    {
        super();
        this.element    = document.createElement("div");
        this.element.classList.add("QueueTile");
        this.element.classList.add("QueueDropZone");
        
        this.entryid    = entryid;

        this.BecomeDropTarget();
    }



    GetHTMLElement()
    {
        return this.element;
    }



    onTransfer(draggableid)
    {
        let draggable = document.getElementById(draggableid);
        let entryid   = draggable.dataset.entryid;
        let musictype = draggable.dataset.musictype;
        let musicid   = draggable.dataset.musicid;
        let droptask  = draggable.dataset.droptask;

        switch(droptask)
        {
            case "move":
                if(entryid == this.entryid)
                    break;

                if(musictype == "song")
                    MusicDB_Call("MoveSongInQueue", {entryid:entryid, afterid:this.entryid});
                else if(musictype == "video")
                    MusicDB_Call("MoveVideoInQueue", {entryid:entryid, afterid:this.entryid});
                break;

            case "insert":
                if(musictype == "song")
                {
                    window.console && console.log("MusicDB_Call(\"AddSongToQueue\", {videoid: "+musicid+", position:"+this.entryid+");");
                }
                else if(musictype == "video")
                {
                    window.console && console.log("MusicDB_Call(\"AddVideoToQueue\", {videoid: "+musicid+", position:"+this.entryid+");");
                }
                window.console && console.warn("The back-end does not support this featred yet");
                break;

        }
    }
}



// vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

