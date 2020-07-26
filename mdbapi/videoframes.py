# MusicDB,  a music manager with web-bases UI that focus on music.
# Copyright (C) 2020  Ralf Stemmer <ralf.stemmer@gmx.net>
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
"""
This module handles the thumbnails (frames) and previews (git-animation) of videos.
Its main task is to cache, scale and provide them to the GUI.

.. attention::

    Frame and preview scaling has not been implemented yet.

Definitions
-----------

frame:
    One frame extracted from a music video stored as a picture.

thumbnail:
    One video frame that is used as image to represent the video in the UI.
    File format is JPEG.

preview:
    A short WebP-animation consisting of several frames of the video.
    This animation will can be played when the cursor hovers above the video.


Database
--------

The thumbnail and preview data is part of the video entry in the MusicDB Database.
The thumbnail and preview part consists of the following entries:

    +------------+
    | framespath |
    +------------+

framespath:
    The path to a frame relative to the thumbnails root directory set in the MusicDB Configuration.
    To access a scaled version of the artwork, the scale as prefix can be used.

    For example, to access a thumbnail, the absolute path would be ``/$THUMBNAILCACHE/$THUMBNAILPATH``.


Path structure
--------------

The video frames root directory can be configured in the MusicDB Configuration file.
Everything related to video frames takes place in this directory.
To use the artwork inside a web frontend, the HTTPS server needs access to this directory.

Relative to the frames root directory are the frames paths stored in the database.
For each video a sub directory exists.
Source-frames and all scaled frames as well as WebP animations are stored in this sub directory.

The name of the frames directory for a video, consists of the artist name and video name:
``$Artistname/$Videoname``.
This guarantees unique file names that are human readable at the same time.

Inside this sub directory the following files exists:

frame-$i.jpg:
    The source video frames.
    ``$i`` is a continuing number with two digits starting by 1.
    For one video, multiple frames will be extracted.
    The exact number of frames can be defined in the configuration file.
    The file format is JPEG.
    The samples are collected uniform distributed over the video length.

frame-$i ($s×$s).jpg:
    A scaled version of *frame-$i*.
    ``$s`` represents the scaled size that can be configured in the configuration file.
    The separator is a multiplication sign × (U+00D7) to make the name more human readable.
    Multiple scales are possible.
    For example, the name of the 5th frame scaled down to a size of max 100px would be ``frame-5 (100×100).jpg``

preview.webp:
    A preview of the video as animation.
    All source frames available as JPEG are combined to the GIF animation.
    The amount of frames can be configured, as well as the animation length.
    The frames are uniform distributed over the animation length.

preview-$i ($s×$s).webp:
    A scaled version of the preview animation.

The sub directory name for each video gets created by
the method :meth:`~mdbapi.videoframes.VideoFrames.CreateFramesDirectoryName`.
This method replaces "/" by an Unicode division slash (U+2215) to avoid problems with the filesystem.

All new creates files and directories were set to the ownership ``[music]->owner:[music]->group``
and gets the permission ``rw-rw-r--`` (``+x`` for directories)


HTTPS Server
------------

Web browsers has to prefix the path with ``videoframes/``.
So, the server must be configured.


Scaling
--------

Scales that shall be provides are set in the MusicDB Configuration as list of edge-lengths.
For example, to generate 50x50, 100x100 and 500x500 versions of a frame,
the configuration would look like this: ``scales=50, 100, 500``
The scaled frames get stored as progressive JPEGs to get a better responsiveness for the WebUI.

Usually videos do not have a ration of 1:1.
The scale value is interpreted as the width of the video in pixels.
The height follows the original ration.


Configuration
-------------

An example configuration can look like the following one:

.. code-block:: ini

    [videoframes]
    path=/data/musicdb/videoframes  ; Path to the sub directories for videos
    frames=5                        ; Grab 5 frames from the video
    scales=50, 150                  ; Provide scales of 50px and 150px
    previewlength=3                 ; Create GIF-Animations with 3 second loop length

Under these conditions, a 150×150 pixels preview animation of a video "Sonne" from "Rammstein"
would have the following absolute path:
``/data/musicdb/videoframes/Rammstein/Sonne/preview (150×150).webp``.
Inside the database, this path is stored as ``Ramstein - Sonne``.
Inside the HTML code of the WebUI the following path would be used: ``Rammstein/Sonne/preview (150×150).webp``.


Algorithm
---------

To update the frames cache the following steps are done:

    #. Create a sun directory for the frames via :meth:`~mdbapi.videoframes.VideoFrames.CreateFramesDirectory`
    #. Generate the frames from a video with :meth:`~mdbapi.videoframes.VideoFrames.GenerateFrames`
    #. Generate the previews from the frames with :meth:`~mdbapi.videoframes.VideoFrames.GeneratePreviews`
    #. Update database entry with the directory name in the database via :meth:`~mdbapi.videoframes.VideoFrames.SetVideoFrames`
"""

import os
import stat
from lib.filesystem     import Filesystem
from lib.metatags       import MetaTags
from lib.cfg.musicdb    import MusicDBConfig
from lib.db.musicdb     import *
from PIL                import Image

class VideoFrames(object):
    """
    This class implements the concept described above.
    The most important method is :meth:`~UpdateVideoFrames` that generates all frames and previews for a given video.

    Args:
        config: MusicDB configuration object
        database: MusicDB database

    Raises:
        TypeError: if config or database are not of the correct type
        ValueError: If one of the working-paths set in the config file does not exist
    """
    def __init__(self, config, database):

        if type(config) != MusicDBConfig:
            raise TypeError("Config-class of unknown type")
        if type(database) != MusicDatabase:
            raise TypeError("Database-class of unknown type")

        self.db     = database
        self.cfg    = config
        self.fs     = Filesystem()
        self.musicroot  = Filesystem(self.cfg.music.path)
        self.framesroot = Filesystem(self.cfg.videoframes.path)
        self.metadata   = MetaTags(self.cfg.music.path)
        self.maxframes  = self.cfg.videoframes.frames
        self.previewlength = self.cfg.videoframes.previewlength

        # Check if all paths exist that have to exist
        pathlist = []
        pathlist.append(self.cfg.music.path)
        pathlist.append(self.cfg.videoframes.path)

        for path in pathlist:
            if not self.fs.Exists(path):
                raise ValueError("Path \""+ path +"\" does not exist.")



    def CreateFramesDirectoryName(self, artistname, videoname):
        """
        This method creates the name for a frames directory regarding the following schema:
        ``$Artistname/$Videoname``.
        If there is a ``/`` in the name, it gets replaced by ``∕`` (U+2215, DIVISION SLASH)

        Args:
            artistname (str): Name of an artist
            videoname (str): Name of a video

        Returns:
            valid frames sub directory name for a video
        """
        artistname = artistname.replace("/", "∕")
        videoname  = videoname.replace( "/", "∕")
        dirname    = artistname + "/" + videoname
        return dirname



    def CreateFramesDirectory(self, artistname, videoname):
        """
        This method creates the directory that contains all frames and previews for a video.
        The ownership of the created directory will be the music user and music group set in the configuration file.
        The permissions will be set to ``rwxrwxr-x``.

        Args:
            artistname (str): Name of an artist
            videoname (str): Name of a video

        Returns:
            The name of the directory.
        """
        # Determine directory name
        dirname = self.CreateFramesDirectoryName(artistname, videoname)

        # Create directory
        self.framesroot.CreateSubdirectory(dirname)

        # Set permissions to -rwxrwxr-x
        try:
            self.framesroot.SetAttributes(dirname,
                    self.cfg.music.owner, self.cfg.music.group,
                    stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR |
                    stat.S_IRGRP | stat.S_IWGRP | stat.S_IXGRP |
                    stat.S_IROTH |                stat.S_IXOTH )
        except Exception as e:
            logging.warning("Setting frames sub directory attributes failed with error %s. \033[1;30m(Leaving them as they are)", str(e))

        return dirname



    def GenerateFrames(self, dirname, videopath):
        """
        This method creates all frame files, including scaled frames, from a video.
        After generating the frames, animations can be generated via :meth:`~GeneratePreviews`.

        To generate the frames, ``ffmpeg`` is used in the following way:

        .. code-block:: bash

            ffmpeg -ss $time -i $videopath -vf scale=iw*sar:ih -vframes 1 $videoframes/$dirname/frame-xx.jpg

        ``videopath`` and ``dirname`` are the parameters of this method.
        ``videoframes`` is the root directory for the video frames as configured in the MusicDB Configuration file.
        ``time`` is a moment in time in the video at which the frame gets selected.
        This value gets calculated depending of the videos length and amount of frames that shall be generated.
        The file name of the frames will be ``frame-xx.jpg`` where ``xx`` represents the frame number.
        The number is decimal, has two digits and starts with 01.

        The scale solves the differences between the Display Aspect Ratio (DAR) and the Sample Aspect Ratio (SAR).
        By using a scale of image width multiplied by the SAR, the resulting frame has the same ratio as the video in the video player.

        The total length of the video gets determined by :meth:`~lib.metatags.MetaTags.GetPlaytime`

        Args:
            dirname (str): Name/Path of the directory to store the generated frames
            videopath (str): Path to the video that gets processed

        Returns:
            ``True`` on success, otherwise ``False``
        """
        
        # Determine length of the video in seconds
        try:
            self.metadata.Load(videopath)
            videolength = self.metadata.GetPlaytime()
        except Exception as e:
            logging.exception("Generating frames for video \"%s\" failed with error: %s", videopath, str(e))
            return False

        slicelength = videolength / (self.maxframes+1)
        sliceoffset = slicelength / 2

        for framenumber in range(self.maxframes):
            # Calculate time point of the frame in seconds
            #moment = (videolength / self.maxframes) * framenumber
            moment = sliceoffset + slicelength * framenumber

            # Define destination path
            framename = "frame-%02d.jpg"%(framenumber+1)
            framepath = dirname + "/" + framename

            # Run ffmpeg - use absolute paths
            absframepath = self.framesroot.AbsolutePath(framepath)
            absvideopath = self.musicroot.AbsolutePath(videopath)
            process = ["ffmpeg",
                    "-ss", str(moment),
                    "-i", absvideopath,
                    "-vf", "scale=iw*sar:ih",   # Make sure the aspect ration is correct
                    "-vframes", "1",
                    absframepath]
            logging.debug("Getting frame via %s", str(process))
            try:
                self.fs.Execute(process)
            except Exception as e:
                logging.exception("Generating frame for video \"%s\" failed with error: %s", videopath, str(e))
                return False

            # TODO: Scale down the frame
            logging.warning("TODO: Scaling not yet implemented")

        return True



    def GeneratePreviews(self, dirname):
        """
        This method creates all preview animations (.webp), including scaled versions, from frames.
        The frames can be generated via :meth:`~GenerateFrames`.

        Args:
            dirname (str): Name/Path of the directory to store the generated frames

        Returns:
            ``True`` on success, otherwise ``False``
        """

        # Load all frames
        frames = []
        for framenumber in range(self.maxframes):
            # Create absolute frame file path
            framename    = "frame-%02d.jpg"%(framenumber+1)
            relframepath = dirname + "/" + framename
            absframepath = self.framesroot.AbsolutePath(relframepath)

            # Open image
            try:
                frame = Image.open(absframepath)
            except FileNotFoundError as e:
                logging.warning("Unable to load frame \"$s\": %s \033[1;30m(Frame will be ignored)", absframepath, str(e))
                continue

            frames.append(frame)

        # Check if enough frames for a preview have been loaded
        if len(frames) < 2:
            logging.error("Not enough frames were loaded. Cannot create a preview animation. \033[1;30m(%d < 2)", len(frames))
            return False

        # Create absolute animation file path
        relpreviewpath = dirname + "/preview.webp"
        abspreviewpath = self.framesroot.AbsolutePath(relpreviewpath)

        # Calculate time for each frame in ms being visible
        duration = int((self.previewlength * 1000) / self.maxframes)

        # Store as WebP animation
        preview = frames[0]                 # Start with frame 0
        preview.save(abspreviewpath, 
                save_all=True,              # Save all frames
                append_images=frames[1:],   # Save these frames
                duration=duration,          # Display time for each frame
                loop=0,                     # Show in infinite loop
                method=6)                   # Slower but better method [1]

        # [1] https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#webp

        return True



    def GetScaledFrame(self, framesdir, resolution):
        pass
    def GetScaledPreview(self, framesdir, resolution):
        pass


    def SetVideoFrames(self, videoid, framesdir, thumbnailfile=None, previewfile=None):
        """
        Set Database entry for the video with video ID ``videoid``.
        Using this method defines the frames directory to which all further paths are relative to.
        The thumbnail file addresses a static source frame (like ``frame-01.jpg``),
        the preview file addresses the preview animation (usually ``preview.webp``).

        If ``thumbnailfile`` or ``previewfile`` is ``None``, it will not be changed in the database.

        This method checks if the files exists.
        If not, ``False`` gets returned an *no* changes will be done in the database.

        Example:

            .. code-block:: python

                retval = vf.SetVideoFrames(1000, "Fleshgod Apocalypse/Monnalisa", "frame-02.jpg", "preview.webp")
                if retval == False:
                    print("Updating video entry failed.")

        Args:
            videoid (int): ID of the video that database entry shall be updated
            framesdir (str): Path of the video specific sub directory containing all frames/preview files. Relative to the video frames root directory
            thumbnailfile (str, NoneType): File name of the frame that shall be used as thumbnail, relative to ``framesdir``
            previewfile (str, NoneType): File name of the preview animation, relative to ``framesdir``

        Returns:
            ``True`` on success, otherwise ``False``
        """
        # Check if all files are valid
        if not self.framesroot.IsDirectory(framesdir):
            logging.error("The frames directory \"%s\" does not exist in the video frames root directory.", framesdir)
            return False

        if thumbnailfile and not self.framesroot.IsFile(framesdir + "/" + thumbnailfile):
            logging.error("The thumbnail file \"%s\" does not exits in the frames directory \"%s\".", thumbnailfile, framesdir)
            return False

        if previewfile and not self.framesroot.IsFile(framesdir + "/" + previewfile):
            logging.error("The preview file \"%s\" does not exits in the frames directory \"%s\".", previewfile, framesdir)
            return False

        # Change paths in the database
        retval = self.db.SetVideoFrames(videoid, framesdir, thumbnailfile, previewfile)

        return retval



    def UpdateVideoFrames(self, video):
        """
        #. Create frames directory (:meth:`~CreateFramesDirectory`)
        #. Generate frames (:meth:`~GenerateFrames`)
        #. Generate previews (:meth:`~GeneratePreviews`)

        Args:
            video: Database entry for the video for that the frames and preview animation shall be updated

        Returns:
            ``True`` on success, otherwise ``False``
        """
        logging.info("Updating frames and previews for %s", video["path"])

        artist     = self.db.GetArtistById(video["artistid"])
        artistname = artist["name"]
        videopath  = video["path"]
        videoname  = video["name"]
        videoid    = video["id"]

        # Prepare everything to start generating frames and previews
        framesdir  = self.CreateFramesDirectory(artistname, videoname)

        # Generate Frames
        retval = self.GenerateFrames(framesdir, videopath)
        if retval == False:
            return False

        # Generate Preview
        retval = self.GeneratePreviews(framesdir)
        if retval == False:
            return False

        # Update database
        retval = self.SetVideoFrames(videoid, framesdir, "frame-01.jpg", "preview.webp")
        return retval


# vim: tabstop=4 expandtab shiftwidth=4 softtabstop=4

