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

class SongRelationsView
{
    constructor()
    {
        this.element = document.createElement("div");
        this.element.classList.add("flex-column");
        this.element.id = "SongRelationsView";

        this.headline = new MainViewHeadline(null);

        this.headlinebox = document.createElement("div");
        this.songsbox    = document.createElement("div");
        this.songsbox.classList.add("songsbox");

        this.headlinebox.appendChild(this.headline.GetHTMLElement());
        this.songsbox.classList.add("flex-column");

        this.element.appendChild(this.headlinebox);
        this.element.appendChild(this.songsbox);
    }



    GetHTMLElement()
    {
        return this.element;
    }



    Update(MDBSong, MDBAlbum, MDBArtist, songentries)
    {
        this.songsbox.innerHTML = "";
        this.headline.UpdateRawInformation(MDBSong.name, MDBArtist.name, MDBAlbum.name, MDBSong.name);

        let currentartistid = -1;
        for(let entry of songentries)
        {
            let song     = entry.song;
            let album    = entry.album;
            let artist   = entry.artist;

            // Create new Artist Headline
            if(artist.id != currentartistid)
            {
                this.AddArtistHeadline(artist);
                currentartistid = artist.id;
            }

            // Create Song tile
            let songtile = new SongTile(song, album, artist);
            this.songsbox.appendChild(songtile.GetHTMLElement());
        }
        return;
    }



    AddArtistHeadline(MDBArtist)
    {
        let artistheadline = document.createElement("span");

        artistheadline.innerText = MDBArtist.name;
        artistheadline.onclick   = ()=>{artistsview.ScrollToArtist(MDBArtist.id);};

        this.songsbox.appendChild(artistheadline);
        return;
    }



    onMusicDBMessage(fnc, sig, args, pass)
    {
        if(fnc == "GetSongRelationship")
        {
            if(sig == "ShowSongRelationship")
            {
                this.Update(args.song, args.album, args.artist, args.songs);
            }
        }
        return;
    }
}



// vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

