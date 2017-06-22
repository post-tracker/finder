const https = require( 'https' );
const fs = require( 'fs' );
const path = require( 'path' );

const chalk = require( 'chalk' );

const steam = require( './modules/steam.js' );
const reddit = require( './modules/reddit.js' );
const api = require( './modules/api.js' );

const games = require( './config/games.json' );

const NOTIFYY_SUCCESS_CODE = 204;
const NOTIFYY_ERROR_CODE = 400;
const NOTIFYY_DELAY = 1500;
const JSON_INDENT = 4;

const STEAM_PAGES = 1;
const REDDIT_PAGES = 1;

const notifyUsers = function notifyUsers ( game, service, foundUser ) {
    // eslint-disable-next-line no-process-env
    if ( !process.env.users ) {
        return false;
    }

    const redditUserURL = 'https://www.reddit.com/user/{{identifier}}';
    let normalisedUser;

    switch ( service ) {
        case 'reddit':
            normalisedUser = {
                identifier: foundUser.username,
                name: foundUser.username,
                url: redditUserURL.replace( '{{identifier}}', foundUser.username.replace( /_/g, '\\_' ) ),
            };
            break;
        case 'steam':
            normalisedUser = {
                identifier: foundUser.account,
                name: foundUser.name,
                url: foundUser.accountLink,
            };
            break;
    }

    // eslint-disable-next-line no-process-env
    const users = process.env.users.split( ' ' );
    const options = {
        hostname: 'notifyy-mcnotifyface.herokuapp.com',
        method: 'GET',
        path: '/out',
    };

    let message = '';

    // eslint-disable-next-line no-useless-escape
    options.path = `${ options.path }?title=${ encodeURIComponent( 'Found a new developer for ' + game + ', ' + normalisedUser.name.replace( /_/g, '\_' ) ) }`;

    for ( let i = 0; i < users.length; i = i + 1 ) {
        options.path = `${ options.path }&users=${ users[ i ] }`;
    }

    options.path = `${ options.path }&url=${ encodeURIComponent( normalisedUser.url ) }`;

    for ( const property in foundUser ) {
        message = `${ message }%0A${ encodeURIComponent( property.replace( /_/g, '\\_' ) ) }:%20${ encodeURIComponent( String( foundUser[ property ] ).replace( /_/g, '\\_' ) ) }`;
    }

    options.path = `${ options.path }&message=${ message }`;

    const request = https.request( options, ( response ) => {
        response.setEncoding( 'utf8' );

        if ( response.statusCode === NOTIFYY_ERROR_CODE ) {
            console.error( 'Invalid user specified' );

            return false;
        }

        if ( response.statusCode === NOTIFYY_SUCCESS_CODE ) {
            console.log( 'Message delivered!' );
        }

        return true;
    } );

    request.on( 'error', ( requestError ) => {
        // eslint-disable-next-line no-console
        console.log( chalk.red( `problem with request: ${ requestError.message }` ) );
    } );

    request.end();

    return true;
};

const getAccounts = function getAccounts ( game, onDone ) {
    api.load( `/${ game.identifier }/accounts`, onDone );
};

const findDevelopers = function findDevelopers ( game ) {
    getAccounts( game, ( accounts ) => {
        const accountList = {};

        for ( let i = 0; i < accounts.data.length; i = i + 1 ) {
            if ( typeof accountList[ accounts.data[ i ].service ] === 'undefined' ) {
                accountList[ accounts.data[ i ].service ] = [];
            }

            accountList[ accounts.data[ i ].service ].push( accounts.data[ i ].identifier );
        }

        if ( game.Steam ) {
            steam.get( game.Steam[ 0 ], STEAM_PAGES )
                .then( ( users ) => {
                    const filteredUsers = steam.filter( users, accountList.Steam );

                    console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Steam for ${ game.identifier }` ) );

                    if ( filteredUsers.length > 0 ) {
                        console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                        for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                            setTimeout( notifyUsers.bind( this, game.identifier, 'steam', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
                        }
                    }
                } )
                .catch( ( error ) => {
                    console.log( error );
                } );
        }

        if ( game.Reddit ) {
            if ( typeof game.Reddit === 'string' ) {
                game.Reddit = [ game.Reddit ];
            }

            for ( let subredditIndex = 0; subredditIndex < game.Reddit.length; subredditIndex = subredditIndex + 1 ) {
                const subreddit = game.Reddit[ subredditIndex ];

                console.log( `Starting with r/${ subreddit }` );
                reddit.get( subreddit, REDDIT_PAGES )
                    .then( ( topUsers ) => {
                        reddit.get( `${ subreddit }/new`, REDDIT_PAGES )
                            .then( ( newUsers ) => {
                                const filteredUsers = reddit.filter( topUsers.concat( newUsers ), game.identifier, accountList.Reddit );

                                console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Reddit for ${ game.identifier }` ) );

                                if ( filteredUsers.length > 0 ) {
                                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                                        setTimeout( notifyUsers.bind( this, game.identifier, 'reddit', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
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
    } );
};

Object.keys( games ).forEach( ( game ) => {
    findDevelopers(
        Object.assign(
            {},
            games[ game ],
            {
                identifier: game,
            }
        )
    );
} );
