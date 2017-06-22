const cheerio = require( 'cheerio' );

const loadPage = require( './load.js' );

const PAGE_LOAD_DELAY = 10000;

const loadSteamPage = function loadSteamPage ( id, page ) {
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
};

const getSteam = function getSteam ( id, pages ) {
    return new Promise( ( resolve ) => {
        let allUsers = [];
        let resolvedCount = 0;

        for ( let i = 0; i < pages; i = i + 1 ) {
            // eslint-disable-next-line no-loop-func
            setTimeout( () => {
                loadSteamPage( id, i )
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
};

const filter = function filter ( newUsers, currentAccounts ) {
    const accountCache = [];
    const currentDevelopers = currentAccounts || [];

    return newUsers.filter( ( user ) => {
        if ( accountCache.indexOf( user.account ) > -1 ) {
            return false;
        }

        if ( currentDevelopers.indexOf( user.account ) > -1 ) {
            return false;
        }

        accountCache.push( user.account );

        return true;
    } );
};

module.exports = {
    filter: filter,
    get: getSteam,
};
