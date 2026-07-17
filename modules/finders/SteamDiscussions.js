const cheerio = require( 'cheerio' );

const loadPage = require( '../load.js' );

// SteamID64 = this base + the 32-bit account id exposed as `data-miniprofile`.
const STEAM_ID64_BASE = 76561197960265728n;

// Parsing every page-1 thread once per game each run is wasteful when several
// checks share an appId, so memoise the parsed dev posts per appId for a short
// window. The finder runs every few hours, so this only dedupes work within a
// single run rather than across runs.
const PARSE_MEMO_TTL = 60000;
const parseMemo = new Map();

// Discovery-only crawler for Steam community discussions: pulls every post
// carrying Steam's own developer badge (`commentthread_author_developer`) off
// page 1 of a game's discussion list, resolving each author to a SteamID64.
// This is the accurate dev signal the indexer used (ported here so the finder
// is the single Steam discovery service); it deliberately does NOT build Post
// objects — the finder only needs enough to decide "is this an untracked dev?".
class SteamDiscussions {
    static miniProfileToSteamId64 ( miniProfile ) {
        try {
            return ( STEAM_ID64_BASE + BigInt( miniProfile ) ).toString();
        } catch ( conversionError ) {
            return false;
        }
    }

    // Page 1 of the discussions list, sorted by last activity. Returns each
    // topic's permalink + title (pinned topics included).
    static async loadThreads ( appId ) {
        const listUrl = `https://steamcommunity.com/app/${ appId }/discussions/`;
        let listHtml = false;

        try {
            listHtml = await loadPage( listUrl );
        } catch ( listError ) {
            console.log( `[SteamDiscussions] failed to load ${ listUrl }: ${ listError.message }` );
        }

        if ( !listHtml ) {
            return [];
        }

        const $ = cheerio.load( listHtml );
        const threads = [];
        const seen = new Set();

        $( '.forum_topic' ).each( ( index, element ) => {
            const $topic = $( element );
            const url = $topic.find( 'a.forum_topic_overlay' ).attr( 'href' );

            if ( !url || seen.has( url ) ) {
                return;
            }

            seen.add( url );

            // Drop the "PINNED:" label span before reading the title text.
            const $name = $topic.find( '.forum_topic_name' ).clone();

            $name.find( '.forum_topic_label' ).remove();

            threads.push( {
                title: $name.text().replace( /\s+/g, ' ' ).trim(),
                url: url,
            } );
        } );

        return threads;
    }

    // Every developer-badged post (OP + replies) across page-1 threads for an
    // appId, author resolved to a SteamID64. Memoised per appId for one run.
    static async extractDevPosts ( appId ) {
        const memo = parseMemo.get( appId );

        if ( memo && memo.expires > Date.now() ) {
            return memo.posts;
        }

        const threads = await SteamDiscussions.loadThreads( appId );
        const devPosts = [];

        for ( let i = 0; i < threads.length; i = i + 1 ) {
            let threadHtml = false;

            try {
                // eslint-disable-next-line no-await-in-loop
                threadHtml = await loadPage( threads[ i ].url );
            } catch ( threadError ) {
                console.log( `[SteamDiscussions] failed to load ${ threads[ i ].url }: ${ threadError.message }` );
            }

            if ( !threadHtml ) {
                continue;
            }

            try {
                SteamDiscussions.parseThread( threadHtml, threads[ i ], appId, devPosts );
            } catch ( parseError ) {
                console.log( `[SteamDiscussions] parse failed for ${ threads[ i ].url }: ${ parseError.message }` );
            }
        }

        parseMemo.set( appId, {
            expires: Date.now() + PARSE_MEMO_TTL,
            posts: devPosts,
        } );

        return devPosts;
    }

    // Pull the OP and every reply authored by a developer (Steam's own
    // `commentthread_author_developer` badge) out of a single thread page.
    static parseThread ( threadHtml, thread, appId, devPosts ) {
        const $ = cheerio.load( threadHtml );

        const pushPost = ( { miniProfile, timestamp, author, url } ) => {
            const steamId64 = SteamDiscussions.miniProfileToSteamId64( miniProfile );

            if ( !steamId64 ) {
                return;
            }

            devPosts.push( {
                author: ( author || '' ).trim(),
                section: appId,
                steamId64: steamId64,
                timestamp: Number( timestamp ),
                topicUrl: thread.url,
                url: url,
            } );
        };

        // Original post
        const $op = $( '.forum_op' ).first();

        if ( $op.length && $op.find( '.forum_op_author' ).hasClass( 'commentthread_author_developer' ) ) {
            pushPost( {
                author: $op.find( '.forum_op_author' ).text(),
                miniProfile: $op.find( '[data-miniprofile]' ).first().attr( 'data-miniprofile' ),
                timestamp: $op.find( '[data-timestamp]' ).first().attr( 'data-timestamp' ),
                url: thread.url,
            } );
        }

        // Replies
        $( '.commentthread_comment' ).each( ( index, element ) => {
            const $comment = $( element );

            if ( !$comment.find( '.commentthread_author_link' ).hasClass( 'commentthread_author_developer' ) ) {
                return;
            }

            const commentId = ( $comment.attr( 'id' ) || '' ).replace( 'comment_', '' );

            pushPost( {
                author: $comment.find( '.commentthread_author_link' ).text(),
                miniProfile: $comment.find( '[data-miniprofile]' ).first().attr( 'data-miniprofile' ),
                timestamp: $comment.find( '[data-timestamp]' ).first().attr( 'data-timestamp' ),
                url: commentId ? `${ thread.url }#c${ commentId }` : thread.url,
            } );
        } );
    }
}

module.exports = SteamDiscussions;
