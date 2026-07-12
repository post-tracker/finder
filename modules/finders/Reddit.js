const chalk = require( 'chalk' );

const redditFetch = require( '../reddit-fetch.js' );
const flair = require( '../flair/' );
const flairBase = require( '../flair/base.js' );
const ntfy = require( '../ntfy.js' );

const POSTS_PER_PAGE = 25;
const JSON_INDENT = 4;
const REDDIT_PAGES = 1;
const NTFY_DELAY = 1500;
const NEW_FLAIR_PRINT_LIMIT = 3;

class Reddit {
    // Shared finder signature (game, sections, accounts) plus optional flair config.
    // eslint-disable-next-line max-params
    constructor ( game, sections, accounts, flairConfig ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;

        // Per-subreddit flair config from the DB (game.config.sources.Reddit.flair),
        // keyed by subreddit name. Falls back to the legacy flair/*.js modules when
        // a subreddit has no DB config yet (see resolveFlair).
        this.flairConfig = flairConfig || {};

        this.newFlairs = [];
    }

    // Resolve the flair checker for a subreddit: prefer DB config, fall back to the
    // legacy hardcoded module. Both expose isDev()/type/list via flairBase.
    //
    // Two modes (config.mode, default 'block' for back-compat):
    //   block — a user is a dev unless their flair is in `blocklist` (the classic
    //           rule; empty list = every flaired user is a dev).
    //   allow — a user is a dev ONLY if their flair is in `allowlist`. For subs
    //           where everyone wears a flair (rank badges etc.) this is the sane
    //           choice: whitelist the staff/dev flair instead of blocklisting an
    //           ever-growing pile of community flairs.
    // Both match case-insensitively against the exact flair value, like base.js.
    resolveFlair ( subreddit ) {
        const cfg = this.flairConfig[ subreddit ];

        if ( cfg && cfg.type ) {
            if ( cfg.mode === 'allow' ) {
                const allowlist = ( cfg.allowlist || [] ).map( ( value ) => {
                    return String( value ).trim().toLowerCase();
                } );

                return {
                    // Substring match: a user is a dev if their flair CONTAINS any
                    // allowlist entry. Mirrors the legacy game modules (Destiny,
                    // RocketLeague) which use includes() — essential for flairs
                    // that carry a rotating prefix, e.g. Destiny's css class
                    // 'SS6 5-7 Verified-Bungie-Employee' where the season part
                    // (SS6 5-7) changes but 'verified-bungie-employee' persists.
                    isDev: function isDev ( user ) {
                        if ( !user[ this.type ] ) {
                            return false;
                        }

                        const flairValue = user[ this.type ].toLowerCase();

                        return this.list.some( ( entry ) => {
                            return flairValue.includes( entry );
                        } );
                    },
                    list: allowlist,
                    type: cfg.type,
                };
            }

            return Object.assign( {}, flairBase, {
                list: cfg.blocklist || [],
                type: cfg.type,
            } );
        }

        return flair[ subreddit ] || null;
    }

    getUsersInPost ( post ) {
        let users = [];

        if ( typeof post === 'string' || typeof post === 'undefined' ) {
            return users;
        }

        if ( post.kind === 'more' ) {
            for ( let i = 0; i < post.data.count; i = i + 1 ) {
                users = users.concat( this.getUsersInPost( post.data.children[ i ] ) );
            }

            return users;
        }

        const user = {
            username: post.data.author,
        };

        /* eslint-disable camelcase */
        if ( post.data.author_flair_css_class ) {
            user.author_flair_css_class = String( post.data.author_flair_css_class ).trim();
        }

        if ( post.data.author_flair_text ) {
            user.author_flair_text = String( post.data.author_flair_text ).trim();
        }

        /* eslint-enable camelcase */

        users.push( user );

        if ( post.data.replies && post.data.replies.kind && post.data.replies.kind === 'Listing' ) {
            for ( let i = 0; i < post.data.replies.data.children.length; i = i + 1 ) {
                users = users.concat( this.getUsersInPost( post.data.replies.data.children[ i ] ) );
            }
        }

        return users;
    }

    loadRedditPage ( id, after, page ) {
        return new Promise( ( resolve ) => {
            let url = `/r/${ id }`;
            let users = [];

            if ( after ) {
                url = `${ url }?count=${ POSTS_PER_PAGE * page }&after=${ after }`;
            }

            console.log( `Getting reddit page ${ page + 1 } for r/${ id }` );
            redditFetch( url )
                .then( ( topicBody ) => {
                    let posts;

                    try {
                        posts = JSON.parse( topicBody );
                    } catch ( parseError ) {
                        console.log( `[Reddit] ${ id } JSON parse failed: ${ parseError.message }` );
                        resolve( {
                            after: null,
                            users: [],
                        } );

                        return;
                    }

                    const xhrList = [];

                    for ( let i = 0; i < posts.data.children.length; i = i + 1 ) {
                        const user = {
                            username: posts.data.children[ i ].data.author,
                        };

                        /* eslint-disable camelcase */
                        if ( posts.data.children[ i ].data.author_flair_css_class ) {
                            user.author_flair_css_class = String( posts.data.children[ i ].data.author_flair_css_class ).trim();
                        }

                        if ( posts.data.children[ i ].data.author_flair_text ) {
                            user.author_flair_text = String( posts.data.children[ i ].data.author_flair_text ).trim();
                        }

                        /* eslint-enable camelcase */

                        users.push( user );

                        const xhr = redditFetch( posts.data.children[ i ].data.permalink )
                            // eslint-disable-next-line no-loop-func
                            .then( ( commentsBody ) => {
                                const replies = JSON.parse( commentsBody );

                                for ( const replyIndex in replies[ 1 ].data.children ) {
                                    if ( !Reflect.apply( {}.hasOwnProperty, replies[ 1 ].data.children, [ replyIndex ] ) ) {
                                        continue;
                                    }

                                    users = users.concat( this.getUsersInPost( replies[ 1 ].data.children[ replyIndex ] ) );
                                }
                            } )
                            .catch( ( error ) => {
                                console.log( error.message );
                            } );

                        xhrList.push( xhr );
                    }

                    Promise.all( xhrList )
                        .then( () => {
                            resolve( {
                                after: posts.data.after,
                                users: users,
                            } );
                        } )
                        .catch( ( error ) => {
                            console.log( error.message );
                            resolve( {
                                after: null,
                                users: users,
                            } );
                        } );
                } )
                .catch( ( error ) => {
                    console.log( error.message );
                    resolve( {
                        after: null,
                        users: [],
                    } );
                } );
        } );
    }

    filter ( users, flairs ) {
        const accountCache = [];

        return users.filter( ( user ) => {
            if ( accountCache.indexOf( user.username ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.username ) > -1 ) {
                return false;
            }

            if ( !flairs.isDev( user ) ) {
                return false;
            }

            this.newFlairs.push( user[ flairs.type ].toLowerCase() );

            accountCache.push( user.username );

            return true;
        } );
    }

    get ( subreddit, pages ) {
        let page = 0;
        let allUsers = [];
        // eslint-disable-next-line consistent-this
        const that = this;

        if ( page >= pages ) {
            return Promise.resolve( [] );
        }

        const getUsers = function getUsers ( redditPage, next, currentPage ) {
            return new Promise( ( loadResolve ) => {
                that.loadRedditPage( redditPage, next, currentPage )
                    .then( ( response ) => {
                        page = page + 1;
                        allUsers = allUsers.concat( response.users );

                        if ( page < pages ) {
                            getUsers( subreddit, response.after, page )
                                .then( ( newUsers ) => {
                                    loadResolve( newUsers );
                                } )
                                .catch( ( error ) => {
                                    console.log( error.message );
                                } );
                        } else {
                            loadResolve( allUsers );
                        }
                    } )
                    .catch( ( error ) => {
                        console.log( error.message );
                    } );
            } );
        };

        return new Promise( ( resolve ) => {
            getUsers( subreddit, false, 0 )
                .then( ( users  ) => {
                    resolve( users );
                } )
                .catch( ( error ) => {
                    console.log( error.message );
                } );
        } );
    }

    run () {
        const subredditPromises = [];

        for ( let subredditIndex = 0; subredditIndex < this.sections.length; subredditIndex = subredditIndex + 1 ) {
            const subreddit = this.sections[ subredditIndex ];
            const flairChecker = this.resolveFlair( subreddit );

            if ( !flairChecker ) {
                console.log( `Found no flairs for ${ subreddit }, won't check it for new devs` );

                continue;
            }

            console.log( `Starting with r/${ subreddit }` );

            const subredditPromise = Promise.all( [
                this.get( subreddit, REDDIT_PAGES ),
                this.get( `${ subreddit }/new`, REDDIT_PAGES ),
            ] )
                .then( ( [ topUsers, newUsers ] ) => {
                    const allUsers = topUsers.concat( newUsers );
                    const filteredUsers = this.filter( allUsers, flairChecker );

                    console.log( chalk.green( `Found ${ filteredUsers.length }/${ allUsers.length } new developers on /r/${ subreddit } for ${ this.game }` ) );

                    if ( filteredUsers.length > 0 ) {
                        console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );
                        const newFlairs = [ ...new Set( this.newFlairs ) ].sort();

                        if ( newFlairs.length >= NEW_FLAIR_PRINT_LIMIT ) {
                            console.log( JSON.stringify( newFlairs, null, 4 ) );
                        }

                        for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                            setTimeout( ntfy.bind( this, this.game, 'reddit', filteredUsers[ i ] ), i * NTFY_DELAY );
                        }
                    }
                } )
                .catch( ( error ) => {
                    console.log( error );
                } );

            subredditPromises.push( subredditPromise );
        }

        return Promise.all( subredditPromises );
    }
}

module.exports = Reddit;
