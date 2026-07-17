const cheerio = require( 'cheerio' );
const chalk = require( 'chalk' );
const FeedMe = require( 'feedme' );

const loadPage = require( '../load.js' );
const ntfy = require( '../ntfy.js' );
const SteamDiscussions = require( './SteamDiscussions.js' );
const SteamProfile = require( './SteamProfile.js' );

const JSON_INDENT = 4;
const NTFY_DELAY = 1500;

// Only surface a dev whose most recent activity is within this window, so a
// long-dead poster who happens to still sit on page 1 / in the feed isn't
// re-flagged forever. Matches the indexer's old attribution window.
const ATTRIBUTION_WINDOW_SECONDS = 30 * 24 * 60 * 60;

// The single Steam discovery finder. Consolidates what used to be split across
// finder/SteamFeed.js (announcement authors) + finder/Steam.js (crude
// workshop-badge forum scrape) AND the indexer's afterIndex discovery
// (announcers with persona resolution + accurate developer-badge forum crawl).
// Two complementary signals, one place, one exclusion list:
//   1. Announcement RSS authors  -> match against tracked personas.
//   2. Forum posts with Steam's developer badge -> match against SteamID64s.
// Exclusion is split by cost: the CURRENT game's accounts get resolved via
// profile XML (persona + SteamID64) so real matches are exact, while the
// cross-game global list (hundreds of accounts, would 409 on add) is matched
// cheaply by raw identifier string — the same split the indexer used, because
// profile-XML lookups are rate-limited from a datacenter IP.
class Steam {
    // sections = allowedSections (the RSS/community feed id lives at [0]).
    // accounts = merged per-game + global exclusion list (raw identifier strings).
    // options.appId = explicit numeric appId for vanity-community-URL games.
    // options.perGameAccounts = ONLY this game's accounts (safe to resolve).
    constructor ( game, sections, accounts, flair, serviceLabel, options = {} ) {
        this.game = game;
        this.sections = sections || [];
        this.accounts = accounts || [];
        this.perGameAccounts = options.perGameAccounts || [];
        this.feedId = this.sections[ 0 ];
        this.appId = options.appId || this.sections[ 0 ];
    }

    // Lowercased set of every account identifier tracked anywhere (raw string).
    // Cheap cross-game exclusion — an announcer/forum author already tracked as
    // a Steam account for ANY game would 409 on add, so it's pure noise here.
    globalExclusionSet () {
        return new Set( this.accounts.map( ( account ) => String( account ).trim().toLowerCase() ) );
    }

    // Announcement RSS authors with no matching tracked persona. Resolves the
    // current game's accounts to their persona names (and matches the bare
    // identifier too, for group/store-attributed posts whose identifier IS the
    // persona) so an already-tracked announcer is never re-flagged.
    async findUntrackedAnnouncers () {
        if ( !this.feedId ) {
            return;
        }

        const endpoint = `https://steamcommunity.com/games/${ this.feedId }/rss/`;
        let feedBody = false;

        console.log( `Loading ${ endpoint }` );

        try {
            feedBody = await loadPage( endpoint );
        } catch ( feedError ) {
            console.log( feedError.message );

            return;
        }

        const cutoff = Math.floor( Date.now() / 1000 ) - ATTRIBUTION_WINDOW_SECONDS;
        const recentAnnouncers = new Map();
        const parser = new FeedMe();

        parser.on( 'item', ( item ) => {
            if ( !item.author ) {
                return;
            }

            const timestamp = item.pubdate ? Math.floor( new Date( item.pubdate ).getTime() / 1000 ) : false;

            if ( timestamp && timestamp < cutoff ) {
                return;
            }

            const author = String( item.author ).trim();

            if ( !recentAnnouncers.has( author ) ) {
                recentAnnouncers.set( author, item.link );
            }
        } );

        parser.write( feedBody );

        if ( recentAnnouncers.size === 0 ) {
            return;
        }

        const trackedPersonas = this.globalExclusionSet();

        await Promise.all( this.perGameAccounts.map( async ( identifier ) => {
            trackedPersonas.add( String( identifier ).trim().toLowerCase() );

            const persona = await SteamProfile.resolvePersonaName( identifier );

            if ( persona ) {
                trackedPersonas.add( persona.toLowerCase() );
            }
        } ) );

        const found = [];

        for ( const [ author, link ] of recentAnnouncers ) {
            if ( trackedPersonas.has( author.toLowerCase() ) ) {
                continue;
            }

            found.push( { author: author, link: link } );
        }

        console.log( chalk.green( `Found ${ found.length }/${ recentAnnouncers.size } new developers in the Steam new feed for ${ this.game }` ) );

        if ( found.length === 0 ) {
            return;
        }

        console.log( chalk.green( JSON.stringify( found.map( ( entry ) => entry.author ), null, JSON_INDENT ) ) );

        for ( let i = 0; i < found.length; i = i + 1 ) {
            const entry = found[ i ];

            setTimeout( () => {
                // The announcement RSS only gives a display name; use it as the
                // identifier (the indexer's SteamFeed matches feed authors
                // against the identifier directly, so a bare persona is exactly
                // one-click-addable), with the announcement link as the tap URL.
                ntfy( this.game, 'SteamFeed', {
                    identifier: entry.author,
                    name: entry.author,
                    url: entry.link,
                } );
            }, i * NTFY_DELAY );
        }
    }

    // Forum posts carrying Steam's developer badge whose SteamID64 isn't tracked.
    async findUntrackedForumDevs () {
        if ( !this.appId ) {
            return;
        }

        let devPosts = [];

        try {
            devPosts = await SteamDiscussions.extractDevPosts( this.appId );
        } catch ( crawlError ) {
            console.log( crawlError.message );

            return;
        }

        if ( devPosts.length === 0 ) {
            return;
        }

        const cutoff = Math.floor( Date.now() / 1000 ) - ATTRIBUTION_WINDOW_SECONDS;
        const recentDevs = new Map();

        for ( let i = 0; i < devPosts.length; i = i + 1 ) {
            if ( devPosts[ i ].timestamp >= cutoff ) {
                recentDevs.set( devPosts[ i ].steamId64, devPosts[ i ] );
            }
        }

        if ( recentDevs.size === 0 ) {
            return;
        }

        const trackedSteamIds = new Set();

        await Promise.all( this.perGameAccounts.map( async ( identifier ) => {
            const steamId64 = await SteamProfile.resolveSteamId64( identifier );

            if ( steamId64 ) {
                trackedSteamIds.add( steamId64 );
            }
        } ) );

        const globalSet = this.globalExclusionSet();
        const found = [];

        for ( const [ steamId64, post ] of recentDevs ) {
            if ( trackedSteamIds.has( steamId64 ) ) {
                continue;
            }

            // Cross-game exclusion by raw string: accounts are commonly stored
            // by the bare SteamID64 or the author display name, so skip either.
            if ( globalSet.has( String( steamId64 ).toLowerCase() )
                || globalSet.has( String( post.author ).trim().toLowerCase() ) ) {
                continue;
            }

            found.push( post );
        }

        console.log( chalk.green( `Found ${ found.length }/${ recentDevs.size } new developers on Steam for ${ this.game }` ) );

        if ( found.length === 0 ) {
            return;
        }

        console.log( chalk.green( JSON.stringify( found.map( ( post ) => post.author ), null, JSON_INDENT ) ) );

        for ( let i = 0; i < found.length; i = i + 1 ) {
            const post = found[ i ];

            setTimeout( () => {
                // Forum devs carry a resolvable SteamID64, so hand that back as
                // the add-dev identifier (the profile URL is the tap action).
                ntfy( this.game, 'steam', {
                    account: post.steamId64,
                    accountLink: `https://steamcommunity.com/profiles/${ post.steamId64 }`,
                    name: post.author,
                } );
            }, i * NTFY_DELAY );
        }
    }

    async run () {
        // Complementary sources; a failure in one must not drop the other.
        await this.findUntrackedAnnouncers()
            .catch( ( announcerError ) => {
                console.log( announcerError.message || announcerError );
            } );

        await this.findUntrackedForumDevs()
            .catch( ( forumError ) => {
                console.log( forumError.message || forumError );
            } );
    }
}

module.exports = Steam;
