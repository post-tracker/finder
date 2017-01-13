const fs = require( 'fs' );
const path = require( 'path' );
const https = require( 'https' );

const chalk = require( 'chalk' );

const flairs = require( './modules/flair.js' );
const loadPage = require( './modules/load.js' );
const steam = require( './modules/steam.js' );
const reddit = require( './modules/reddit.js' );

const STEAM_PAGES = 5;
const REDDIT_PAGES = 5;

const GAME_LIST = [
    'ark',
    'battlefield1',
    'csgo',
    'elite',
    'rainbow6',
    'rimworld'
];

const getGameData = function getGameData ( game, onDone ) {
    const options = {
        hostname: 'raw.githubusercontent.com',
        method: 'GET',
        path: `/kokarn/dev-tracker/master/games/${ game }/data.json`,
    };

    const request = https.request( options, ( response ) => {
        let body = '';

        response.setEncoding( 'utf8' );

        if( response.statusCode === 404 ){
            onDone( {} );

            return false;
        }

        response.on( 'data', ( chunk ) => {
            body = body + chunk;
        } );

        response.on( 'end', () => {
            onDone( JSON.parse( body ) );
        } );
    } );

    request.on( 'error', ( requestError ) => {
        // eslint-disable-next-line no-console
        console.log( chalk.red( `problem with request: ${ requestError.message }` ) );
    } );

    request.end();
}

const getAccounts = function getAccounts ( developers, service, game ) {
    const activeAccounts = [];

    for( let i = 0; i < developers.length; i = i + 1 ) {
        if ( developers[ i ].accounts[ service ] ) {
            activeAccounts.push( developers[ i ].accounts[ service ] );
        }
    }

    console.log( `Loaded ${ activeAccounts.length } developers for ${ game } on ${ service }` );
    return activeAccounts;
};

const findDevelopers = function findDevelopers ( game, gameIndex ) {
    getGameData( game, ( gameData ) => {
        let developers = gameData.developers;

        if ( gameData.config && gameData.config.Steam && gameData.config.Steam.matchOnly ) {
            setTimeout( () => {
                let steamDevelopers = getAccounts( developers, 'Steam', game );

                steam.get( gameData.config.Steam.matchOnly, STEAM_PAGES )
                .then( ( users ) => {
                    let filteredUsers = steam.filter( users, game, steamDevelopers );

                    console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Steam for ${ game }`) );

                    if( filteredUsers.length > 0 ) {
                        console.log( chalk.green( JSON.stringify( filteredUsers, null, 4 ) ) );
                        notifyUsers( game, 'steam', users[ i ] );
                    }
                } )
                .catch( ( error ) => {
                    console.log( error );
                } );
            }, gameIndex * 10000 );
        }

        if ( gameData.config && gameData.config.Reddit && ( gameData.config.Reddit.index || gameData.config.Reddit.matchOnly ) ) {
            let redditDevelopers = getAccounts( developers, 'Reddit', game );
            let subreddit = gameData.config.Reddit.index || gameData.config.Reddit.matchOnly;

            console.log( `Starting with r/${ subreddit }` );
            reddit.get( subreddit, REDDIT_PAGES )
            .then( ( topUsers ) => {
                reddit.get( `${ subreddit }/new`, REDDIT_PAGES )
                .then( ( newUsers ) => {
                    let users = reddit.filter( topUsers.concat( newUsers ), game, redditDevelopers );

                    console.log( chalk.green( `Found ${ users.length } new developers on Reddit for ${ game }` ) );

                    if( users.length > 0 ) {
                        console.log( chalk.green( JSON.stringify( users, null, 4 ) ) );

                        for ( let i = 0; i < users.length; i = i + 1 ) {
                            notifyUsers( game, 'reddit', users[ i ] );
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
    } );
};

const notifyUsers = function notifyUsers( game, service, foundUser ){
    if ( !process.env.users ) {
        return false;
    }

    const redditUserURL = 'https://www.reddit.com/user/{{identifier}}';
    const steamNumericURL = 'http://steamcommunity.com/profiles/{{identifier}}/posthistory/';
    const steamNameURL = 'http://steamcommunity.com/id/{{identifier}}/posthistory/';
    const users = process.env.users.split( ' ' );
    const options = {
        hostname: 'notifyy-mcnotifyface.herokuapp.com',
        method: 'GET',
        path: `/out`,
    };

    let message = '';

    options.path = `${ options.path }?title=${ encodeURIComponent( 'Found a new developer for ' + game + ', ' + foundUser.username ) }`;

    for ( let i = 0; i < users.length; i = i + 1 ){
        options.path = `${ options.path }&users=${ users[ i ] }`;
    }

    if ( service === 'reddit' ) {
        options.path = `${ options.path }&url=${ encodeURIComponent( redditUserURL.replace( '{{identifier}}', foundUser.username ) ) }`;
    } else if ( service === 'steam' ) {
        if ( Number.isInteger( foundUser.username ) ) {
            options.path = `${ options.path }&url=${ encodeURIComponent( steamNumericURL.replace( '{{identifier}}', foundUser.username ) ) }`;
        } else {
            options.path = `${ options.path }&url=${ encodeURIComponent( steamNameURL.replace( '{{identifier}}', foundUser.username ) ) }`;
        }
    }

    for ( let property in foundUser ) {
        message = `${ message }%0A${ encodeURIComponent( property.replace( /_/g, '\\_' ) ) }:%20${ encodeURIComponent( foundUser[ property ].replace( /_/g, '\\_' ) ) }`;
    }

    options.path = `${ options.path }&message=${ message }`;

    const request = https.request( options, ( response ) => {
        response.setEncoding( 'utf8' );

        if ( response.statusCode === 400 ) {
            console.error( 'Invalid user specified' );

            return false;
        }

        if ( response.statusCode === 204 ) {
            console.log( 'Message delivered!' );

            return true;
        }
    } );

    request.on( 'error', ( requestError ) => {
        // eslint-disable-next-line no-console
        console.log( chalk.red( `problem with request: ${ requestError.message }` ) );
    } );

    request.end();

    return true;
}

for( let i = 0; i < GAME_LIST.length; i = i + 1 ) {
    findDevelopers( GAME_LIST[ i ], i );
}
