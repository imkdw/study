import Song from "./song.js";

export default class Playlist {
  private tracks: Song[] = [];

  append(song: Song) {
    this.tracks.push(song);
  }

  getTracks(): Song[] {
    return this.tracks;
  }
}
