// MusicDB,  a music manager with web-bases UI that focus on music.
// Copyright (C) 2017-2021  Ralf Stemmer <ralf.stemmer@gmx.net>
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
/*
 *
 * This manager handled uploading data.
 *
 * When an upload gets started, an data ID is generated by this script.
 * Together with other meta data, an Upload-Request gets send to the MusicDB Server.
 * The server then requests chunks of the data.
 *
 * After a chunk of data is sent, a notification within a certain time gets expected by this upload manager.
 * This notification contains a state and request of the next chunk.
 *
 */

class UploadManager
{
    constructor()
    {
        this.uploads = new Object;
        this.videouploadstable = new UploadTable();
    }



    GetVideoUploadsTable()
    {
        return this.videouploadstable;
    }



    // initialannotations: an object with initial annotations
    UploadFile(contenttype, filedescription, initialannotations=null)
    {
        let reader = new FileReader();

        reader.onload = (event)=>
            {
                let contents = event.target.result;
                this.StartUpload(contenttype, filedescription, new Uint8Array(contents), initialannotations);
            };
        reader.readAsArrayBuffer(filedescription);
    }



    async StartUpload(contenttype, filedescription, rawdata, initialannotations=null)
    {
        
        // ! SHA-1 is used as ID and object key in the server and client because it is short.
        // Furthermore it is used to check if the upload was successful.
        // It is not, and never should be, used for security relevant tasks
        let checksum  = BufferToHexString(await crypto.subtle.digest("SHA-1", rawdata));
        let task      = new Object();
        task.id       = checksum;
        task.data     = rawdata;
        task.filesize = rawdata.length;
        task.offset   = 0;
        task.contenttype = contenttype;
        task.mimetype = filedescription.type;
        task.checksum = checksum;
        task.filename = filedescription.name
        this.uploads[task.id] = task;
        
        MusicDB_Request("InitiateUpload",
            "UploadingContent",
            {
                taskid:   task.id,
                mimetype: task.mimetype,
                contenttype: task.contenttype,
                filesize: task.filesize,
                checksum: task.checksum,
                filename: task.filename
            },
            {task: task});

        if(typeof initialannotations === "object")
            MusicDB_Call("AnnotateUpload", {taskid: task.id, ...initialannotations});

        window.console && console.log(task);
    }


    UploadNextChunk(state)
    {
        window.console && console.log("UploadNextChunk");
        let taskid    = state.taskid;
        let task      = this.uploads[taskid]
        let rawdata   = task.data.subarray(task["offset"], task["offset"] + state.chunksize)
        //let chunkdata = btoa(rawdata); // FIXME: Does not work. rawdata will be implicit converted to string
        let chunkdata = BufferToHexString(rawdata)
        task.offset  += rawdata.length;

        window.console && console.log(task);
        MusicDB_Call("UploadChunk", {taskid: taskid, chunkdata: chunkdata});
    }



    onMusicDBNotification(fnc, sig, data)
    {
        if(fnc == "MusicDB:Upload")
        {
            window.console && console.info(data);
            let taskid      = data.taskid;
            let uploadtask  = data.uploadtask;
            let state       = data.state;
            let contenttype = uploadtask.contenttype;

            if(sig == "ChunkRequest")
            {
                this.videouploadstable.TryUpdateRow(uploadtask);
                this.UploadNextChunk(data)
            }
            else // "StateUpdate", "InternalError"
            {
                this.videouploadstable.Update(data.uploadslist.videos);
            }

            if(sig == "StateUpdate")
            {
                window.console && console.info(`Stateupdate for ${contenttype} to ${state}`);
                // Import artwork
                if(contenttype == "artwork")
                {
                    if(state == "readyforintegration")
                    {
                        let sourcepath  = uploadtask.preprocessedpath;
                        let targetpath  = uploadtask.annotations.musicpath;
                        let annotations = uploadtask.annotations; // Save annotations
                        MusicDB_Request("InitiateArtworkImport", "ImportingArtwork", 
                            {sourcepath: sourcepath, targetpath: targetpath},
                            {annotations: annotations}
                            );
                    }
                }
            }
        }
    }



    onMusicDBMessage(fnc, sig, args, pass)
    {
        if(fnc == "GetUploads" && sig == "ShowUploads")
        {
            window.console && console.log(args);
            window.console && console.log(pass);
            this.videouploadstable.Update(args.videos);
        }

        return;
    }
}



// vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

