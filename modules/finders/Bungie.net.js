const https = require( 'https' );
const url = require( 'url' );

const cheerio = require( 'cheerio' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

// eslint-disable-next-line no-process-env
const API_KEY = process.env.bungieKey;

class BungieNet {
    constructor ( game, sections, accounts ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;

        this.threadURL = 'https://www.bungie.net/platform/forum/GetPostsThreadedPaged/{threadId}/{page}/10/0/1/0/0/';
    }

    loadUrl ( pageUrl ) {
        return new Promise( ( resolve, reject ) => {
            const parsedUrl = url.parse( pageUrl );
            const options = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36',
                    'X-API-Key': API_KEY,
                },
                hostname: parsedUrl.hostname,
                path: encodeURI( parsedUrl.path ),
                protocol: parsedUrl.protocol,
            };

            const request = https.get( options, ( response ) => {
                let body = '';

                response.setEncoding( 'utf8' );

                response.on( 'data', ( chunk ) => {
                    body = `${ body }${ chunk }`;
                } );

                response.on( 'end', () => {
                    resolve( JSON.parse( body ) );
                } );

                return true;
            } );

            request.on( 'error', ( error ) => {
                reject( error );
            } );
        } );
    }

    loadTopic ( id, page ) {
        const topicUrl = this.threadURL.replace( '{threadId}', id ).replace( '{page}', page );

        return this.loadUrl( topicUrl );
    }

    userIsEmployee ( user ) {
        if ( user.profilePicturePath.indexOf( 'profile/avatars/admin' ) > -1 ) {
            return true;
        }

        if ( user.profilePicturePath.indexOf( 'staffonly_' ) > -1 ) {
            return true;
        }

        if ( user.profilePicturePath.indexOf( 'employee_' ) > -1 ) {
            return true;
        }

        return false;
    }

    async findEmployeeInTopic ( threadId, pageIndex ) {
        if ( typeof pageIndex === 'undefined' ) {
            // eslint-disable-next-line no-param-reassign
            pageIndex = 0;
        }

        const threadData = await this.loadTopic( threadId, pageIndex );

        if ( !threadData ) {
            console.log( `Unable to load thread ${ threadId }` );

            return false;
        }

        for ( let i = 0; i < threadData.Response.authors.length; i = i + 1 ) {
            if ( this.userIsEmployee( threadData.Response.authors[ i ] ) ) {
                return threadData.Response.authors[ i ];
            }
        }

        if ( threadData.Response.authors.length > 0 ) {
            return await this.findEmployeeInTopic( threadId, pageIndex + 1 );
        }

        return false;
    }

    loadEndpoint () {
        return new Promise( ( resolve, reject ) => {
            console.log( `Loading ${ this.sections[ 0 ] }` );
            loadPage( this.sections[ 0 ] )
                .then( ( pageBody ) => {
                    const $ = cheerio.load( pageBody );
                    const threadPromises = [];
                    const users = [];

                    $( 'li.employee' ).each( ( index, element ) => {
                        threadPromises.push( new Promise( async ( threadResolve ) => {
                            const threadId = $( element ).attr( 'data-postid' );
                            const employee = await this.findEmployeeInTopic( threadId );

                            users.push( employee );

                            threadResolve();
                        } ) );
                    } );

                    Promise.all( threadPromises )
                        .then( () => {
                            resolve( users );
                        } )
                        .catch( ( threadError ) => {
                            reject( threadError );
                        } );

                    return true;
                } )
                .catch( ( loadPageError ) => {
                    reject( loadPageError );

                    return false;
                } );
        } );
    }

    filter ( newUsers ) {
        const accountCache = [];

        return newUsers.filter( ( user ) => {
            if ( accountCache.indexOf( user.membershipId ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.membershipId ) > -1 ) {
                return false;
            }

            accountCache.push( user.account );

            return true;
        } );
    }

    run () {
        return this.loadEndpoint()
            .then( ( users ) => {
                const filteredUsers = this.filter( users );

                console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Bungie.net for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'Bungie.net', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.log( error );
            } );
    }
}

module.exports = BungieNet;
