import Thumbnail from "./Thumbnail";
import Video from "./Video";
import Channel from "./Channel";
import Util from "../Util";
const BASE_API = "https://www.youtube.com/youtubei/v1/browse?key=";

class Playlist {
    id?: string;
    title?: string;
    videoCount: number;
    lastUpdate?: string;
    views?: number;
    url?: string;
    link?: string;
    channel?: Channel;
    thumbnail?: Thumbnail;
    videos: Video[];
    private _continuation: { api?: string; token?: string; clientVersion?: string } = {};

    constructor(data = {}, searchResult = false) {
        if (!data) throw new Error(`Cannot instantiate the ${this.constructor.name} class without data!`);
        Object.defineProperty(this, "_continuation", { enumerable: false, configurable: true, writable: true });
        if (!!searchResult) this._patchSearch(data);
        else this._patch(data);
    }

    private _patch(data: any) {
        this.id = data.id || null;
        this.title = data.title || null;
        this.videoCount = data.videoCount || 0;
        this.lastUpdate = data.lastUpdate || null;
        this.views = data.views || 0;
        this.url = data.url || null;
        this.link = data.link || null;
        this.channel = data.author || null;
        this.thumbnail = data.thumbnail || null;
        this.videos = data.videos || [];
        this._continuation.api = data.continuation?.api ?? null;
        this._continuation.token = data.continuation?.token ?? null;
        this._continuation.clientVersion = data.continuation?.clientVersion ?? "<important data>";
    }

    private _patchSearch(data: any) {
        this.id = data.id || null;
        this.title = data.title || null;
        this.thumbnail = data.thumbnail || null;
        this.channel = data.channel || null;
        this.videos = [];
        this.videoCount = data.videos || 0;
        this.url = this.id ? `https://www.youtube.com/playlist?list=${this.id}` : null;
        this.link = null;
        this.lastUpdate = null;
        this.views = 0;
    }

    /**
     * @param limit Max items to parse from current chunk
     */
    async next(limit: number = Infinity): Promise<Video[]> {
        if (!this._continuation || !this._continuation.token) return [];

        const nextPage = await Util.getHTML(`${BASE_API}${this._continuation.api}`, {
            method: "POST",
            body: JSON.stringify({
                continuation: this._continuation.token,
                context: {
                    client: {
                        utcOffsetMinutes: 0,
                        gl: "US",
                        hl: "en",
                        clientName: "WEB",
                        clientVersion: this._continuation.clientVersion
                    },
                    user: {},
                    request: {}
                }
            })
        });

        const contents = Util.json(nextPage)?.onResponseReceivedActions[0]?.appendContinuationItemsAction?.continuationItems;
        if (!contents) return [];
        const partial = Util.getPlaylistVideos(contents, limit);
        this._continuation.token = Util.getContinuationToken(contents);
        this.videos = [...this.videos, ...partial];

        return partial;
    }

    async fetch(max: number = Infinity) {
        const ctn = this._continuation.token;
        if (!ctn) return this;
        if (max < 1) max = Infinity;

        while (typeof this._continuation.token === "string" && this._continuation.token.length) {
            if (this.videos.length >= max) break;
            const res = await this.next();
            if (!res.length) break;
        }

        return this;
    }

    get type(): "playlist" {
        return "playlist";
    }

    *[Symbol.iterator](): IterableIterator<Video> {
        yield* this.videos;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            thumbnail: this.thumbnail.toJSON(),
            channel: {
                name: this.channel.name,
                id: this.channel.id,
                icon: this.channel.iconURL()
            },
            url: this.url,
            videos: this.videos
        };
    }
}

export default Playlist;
