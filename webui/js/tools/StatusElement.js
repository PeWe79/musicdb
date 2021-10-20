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


class StatusElementBase extends Element
{
    // type: "li", "div"
    // classes: CSS classes list
    constructor(type, classes, text=null, state=null)
    {
        super(type, ["StatusElement", ...classes]);
        if(typeof text === "string")
            this.SetText(text);
        if(typeof state === "string")
            this.SetState(state);
    }


    // state: unknown, good, bad, active, open
    SetState(state)
    {
        this.element.dataset.state = state;
        if(typeof text === "string")
            this.SetText(text);
    }



    SetStatus(state, text=null)
    {
        this.SetState(state);
        if(typeof text === "string")
            this.SetText(text);
    }



    SetText(text)
    {
        this.element.innerText = text;
    }
}



class StatusText extends StatusElementBase
{
    constructor(text=null, state=null)
    {
        super("span", ["flex-row"], text, state);
    }
}

/*

    * Unrelated states
    * Upload related states:
        * ``"preprocessing"``: The file is currently in preprocessing state. For example if an archive gets unpacked.
    * Integration related states:
        * ``"integrating"``: The integration process has started
    * Import related states:
 */


class UploadStatusText extends StatusText
{
    constructor(uploadstatus="")
    {
        // This is a complete list from the MusicDB Task Management Task States
        switch(uploadstatus)
        {
            case "notexisting"          : super("Internal Chaos",           "bad");    break;
            case "waitforchunk"         : super("Uploading …",              "active"); break;
            case "uploadcomplete"       : super("Upload Succeeded",         "good");   break;
            case "uploadfailed"         : super("Upload Failed",            "bad");    break;
            case "preprocessing"        : super("Preprocessing Upload …",   "active"); break;
            case "readyforintegration"  : super("Upload Succeeded",         "good");   break;
            case "integrating"          : super("Integrating …",            "active"); break;
            case "invalidcontent"       : super("Invalid Content",          "bad");    break;
            case "readyforimport"       : super("Integration Succeeded",    "good");   break;
            case "integrationfailed"    : super("Integration Failed",       "bad");    break;
            case "startmusicimport"     : super("Importing Music …",        "active"); break;
            case "importingmusic"       : super("Importing Music …",        "active"); break;
            case "startartworkimport"   : super("Importing Artwork …",      "active"); break;
            case "importingartwork"     : super("Importing Artwork …",      "active"); break;
            case "importfailed"         : super("Import Failed",            "bad");    break;
            case "importcomplete"       : super("Import Succeeded",         "good");   break;
            case "remove"               : super("Removing Upload",          "active"); break;
            default                     : super("No upload processing",     "open");   break;
        }
    }
}



class StatusItem extends StatusElementBase
{
    constructor(text, state=null)
    {
        super("li", ["flex-row"], text, state);
    }



    Show()
    {
        this.element.style.display = "list-item";
    }
    Hide()
    {
        this.element.style.display = "none";
    }
}



class StatusList extends Element
{
    constructor()
    {
        super("ul", ["StatusList", "flex-column"]);
        this.states = new Object();
    }



    AddState(statename, statelabel)
    {
        let item = new StatusItem(statelabel, "unknown");
        this.states[statename] = item;
        this.element.appendChild(item.GetHTMLElement());
        return;
    }



    SetState(statename, state)
    {
        this.states[statename].SetState(state);
    }
}
// vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

