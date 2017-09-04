const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const flair = require( '../flair.js' );
const notifyy = require( '../notifyy.js' );

const POSTS_PER_PAGE = 25;
const JSON_INDENT = 4;
const REDDIT_PAGES = 1;
const NOTIFYY_DELAY = 1500;

class Reddit {
    constructor ( game, sections, accounts ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;
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
            let url = `https://www.reddit.com/r/${ id }.json`;
            let users = [];

            if ( after ) {
                url = `${ url }?count=${ POSTS_PER_PAGE * page }&after=${ after }`;
            }

            console.log( `Getting reddit page ${ page + 1 } for r/${ id }` );
            loadPage( url )
                .then( ( topicBody ) => {
                    const posts = JSON.parse( topicBody );
                    const xhrList = [];

                    for ( let i = 0; i < posts.data.children.length; i = i + 1 ) {
                        const user = {
                            username: posts.data.children[ i ].data.author,
                        };

                        /* eslint-disable camelcase */
                        if ( posts.data.author_flair_css_class ) {
                            user.author_flair_css_class = String( posts.data.author_flair_css_class ).trim();
                        }

                        if ( posts.data.children[ i ].data.author_flair_text ) {
                            user.author_flair_text = String( posts.data.children[ i ].data.author_flair_text ).trim();
                        }

                        /* eslint-enable camelcase */

                        users.push( user );

                        const xhr = loadPage( `https://www.reddit.com${ posts.data.children[ i ].data.permalink }.json` )
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
                        } );
                } )
                .catch( ( error ) => {
                    console.log( error.message );
                } );
        } );
    }

    filter ( users ) {
        const accountCache = [];
        let flairs = flair[ this.game ].getFlairs();

        flairs = flairs.map( ( value ) => {
            return value.toLowerCase();
        } );

        return users.filter( ( user ) => {
            if ( accountCache.indexOf( user.username ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.username ) > -1 ) {
                return false;
            }

            if ( flairs ) {
                if ( !user[ flairs.type ] ) {
                    return false;
                }

                // Skip everything with a flair we've setup to skip
                if ( flairs && flairs.indexOf( user[ flairs.type ].toLowerCase() ) > -1 ) {
                    return false;
                }
            }

            accountCache.push( user.username );

            return true;
        } );
    }

    get ( subreddit, pages ) {
        let page = 0;
        let allUsers = [];
        // eslint-disable-next-line consistent-this
        const that = this;

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
        for ( let subredditIndex = 0; subredditIndex < this.sections.length; subredditIndex = subredditIndex + 1 ) {
            const subreddit = this.sections[ subredditIndex ];

            console.log( `Starting with r/${ subreddit }` );
            this.get( subreddit, REDDIT_PAGES )
                .then( ( topUsers ) => {
                    this.get( `${ subreddit }/new`, REDDIT_PAGES )
                        .then( ( newUsers ) => {
                            const filteredUsers = this.filter( topUsers.concat( newUsers ) );

                            console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Reddit for ${ this.game }` ) );

                            if ( filteredUsers.length > 0 ) {
                                console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                                for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                                    setTimeout( notifyy.bind( this, this.game, 'reddit', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
                                }
                            }
                        } )
                        .catch( ( error ) => {
                            console.log( error );
                        } );
                } )
                .catch( ( error ) => {
                    console.log( error );
                } );
        }
    }
}

module.exports = Reddit;
