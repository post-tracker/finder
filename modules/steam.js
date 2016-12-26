const cheerio = require( 'cheerio' );
const Promise = require( 'promise' );

const loadPage = require( './load.js' );

const loadSteamPage = function loadSteamPage( id, page ) {
    return new Promise( ( resolve, reject ) => {
        let url = `https://steamcommunity.com/app/${ id }/discussions/?fp=${ page }`;
        let users = [];

        console.log( `Getting steam page ${ page + 1 } for ${ id }` );
        loadPage( url )
            .then( ( pageBody ) => {
                const $ = cheerio.load( pageBody );
                let xhrList = [];

                $( '.forum_topic' ).each( ( index, element ) => {
                    let url = $( element ).find( '.forum_topic_overlay' ).attr( 'href' );
                    let xhr = loadPage( url );

                    xhr.then( ( topicBody ) => {
                        const $topic = cheerio.load( topicBody );
                        const $replies = $topic( '.commentthread_comment' );

                        $replies.each( ( replyIndex, replyElement ) => {
                            let $reply = $topic( replyElement );
                            let badge = $reply.find( '.commentthread_workshop_authorbadge' ).text().trim();

                            if( badge ){
                                let $author = $reply.find( '.commentthread_author_link' );
                                let user = {
                                    account: $author.attr( 'href' ).trim().replace( 'https://steamcommunity.com/profiles/', '' ).replace( 'https://steamcommunity.com/id/', '' ),
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

                    xhrList.push( xhr );
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

const getSteam = function getSteam( id, pages ){
    return new Promise( ( resolve, reject ) => {
        let xhrList = [];

        for( let i = 0; i < pages; i = i + 1 ){
            xhrList.push( loadSteamPage( id, i ) );
        }

        Promise.all( xhrList )
            .then( ( data ) => {
                let allUsers = [];

                for( let i = 0; i < data.length; i = i + 1 ){
                    allUsers = allUsers.concat( data[ i ] );
                }

                resolve( allUsers );
            } )
            .catch( ( error ) => {
                console.log( error.message );
            } );
    } );
};

const filter = function filter ( users, game, developers ){
    let accountCache = [];

    return users.filter( ( user ) => {
        if( accountCache.indexOf( user.account ) > -1 ){
            return false;
        }

        if( developers.indexOf( user.account ) > -1 ){
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
