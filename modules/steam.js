const cheerio = require( 'cheerio' );

const loadPage = require( './load.js' );

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
                        const $replies = $topic( '.commentthread_comment' );

                        $replies.each( ( replyIndex, replyElement ) => {
                            const $reply = $topic( replyElement );
                            const badge = $reply
                                .find( '.commentthread_workshop_authorbadge' )
                                .text()
                                .trim();

                            if ( badge ) {
                                const $author = $reply.find( '.commentthread_author_link' );
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
                        console.log( error.message );
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
        const xhrList = [];

        for ( let i = 0; i < pages; i = i + 1 ) {
            xhrList.push( loadSteamPage( id, i ) );
        }

        Promise.all( xhrList )
            .then( ( xhrData ) => {
                let allUsers = [];

                for ( let i = 0; i < xhrData.length; i = i + 1 ) {
                    allUsers = allUsers.concat( xhrData[ i ] );
                }

                resolve( allUsers );
            } )
            .catch( ( error ) => {
                console.log( error.message );
            } );
    } );
};

const filter = function filter ( users, game, developers ) {
    const accountCache = [];

    return users.filter( ( user ) => {
        if ( accountCache.indexOf( user.account ) > -1 ) {
            return false;
        }

        if ( developers.indexOf( user.account ) > -1 ) {
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
