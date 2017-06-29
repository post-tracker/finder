const cheerio = require( 'cheerio' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const PAGE_LOAD_DELAY = 10000;
const STEAM_PAGES = 1;
const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

class Steam {
    constructor ( game, sections, accounts ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;
    }

    loadSteamPage ( id, page ) {
        return new Promise( ( resolve ) => {
            const url = `https://steamcommunity.com/app/${ id }/discussions/?fp=${ page }`;
            const users = [];

            console.log( `Getting steam page ${ page + 1 } for ${ id }` );
            loadPage( url )
                .then( ( pageBody ) => {
                    const $ = cheerio.load( pageBody );
                    const xhrList = [];

                    $( '.forum_topic' ).each( ( index, element ) => {
                        const topicUrl = $( element )
                            .find( '.forum_topic_overlay' )
                            .attr( 'href' );

                        const topicXhr = loadPage( topicUrl );

                        topicXhr.then( ( topicBody ) => {
                            const $topic = cheerio.load( topicBody );
                            const $op = $topic( '.forum_op' );
                            const $replies = $topic( '.commentthread_comment' );

                            const $posts = $op.add( $replies );

                            $posts.each( ( replyIndex, replyElement ) => {
                                const $reply = $topic( replyElement );
                                const badge = $reply
                                    .find( '.commentthread_workshop_authorbadge' )
                                    .text()
                                    .trim();

                                if ( badge ) {
                                    let $author = $reply.find( '.commentthread_author_link' );

                                    if ( $author.length <= 0 ) {
                                        $author = $reply.find( '.forum_op_author' );
                                    }

                                    const user = {
                                        account: $author
                                            .attr( 'href' )
                                            .trim()
                                            .replace( 'https://steamcommunity.com/profiles/', '' )
                                            .replace( 'https://steamcommunity.com/id/', '' ),
                                        accountLink: $author.attr( 'href' ).trim(),
                                        badge: badge,
                                        name: $author.text().trim(),
                                    };

                                    users.push( user );
                                }
                            } );
                        } )
                        .catch( ( error ) => {
                            console.log( error );
                        } );

                        xhrList.push( topicXhr );
                    } );

                    Promise.all( xhrList )
                        .then( () => {
                            resolve( users );
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

    get ( id, pages ) {
        return new Promise( ( resolve ) => {
            let allUsers = [];
            let resolvedCount = 0;

            for ( let i = 0; i < pages; i = i + 1 ) {
                // eslint-disable-next-line no-loop-func
                setTimeout( () => {
                    this.loadSteamPage( id, i )
                        .then( ( users ) => {
                            allUsers = allUsers.concat( users );

                            resolvedCount = resolvedCount + 1;

                            if ( resolvedCount === pages ) {
                                resolve( allUsers );
                            }
                        } )
                        .catch( ( error ) => {
                            throw error;
                        } );
                }, i * PAGE_LOAD_DELAY );
            }
        } );
    }

    filter ( newUsers ) {
        const accountCache = [];

        return newUsers.filter( ( user ) => {
            if ( accountCache.indexOf( user.account ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.account ) > -1 ) {
                return false;
            }

            accountCache.push( user.account );

            return true;
        } );
    }

    run () {
        return this.get( this.sections[ 0 ], STEAM_PAGES )
            .then( ( users ) => {
                const filteredUsers = this.filter( users );

                console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Steam for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'steam', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.log( error );
            } );
    }
}

module.exports = Steam;
