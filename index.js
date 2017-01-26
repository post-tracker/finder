const https = require( 'https' );

const chalk = require( 'chalk' );

const steam = require( './modules/steam.js' );
const reddit = require( './modules/reddit.js' );

const ERROR_REQUEST_CODE = 404;
const NOTIFYY_SUCCESS_CODE = 204;
const NOTIFYY_ERROR_CODE = 400;
const STEAM_INDEX_DELAY = 10000;
const NOTIFYY_DELAY = 1500;
const JSON_INDENT = 4;

const STEAM_PAGES = 3;
const REDDIT_PAGES = 3;

const GAME_LIST = [
    'ark',
    'battlefield1',
    'csgo',
    'elite',
    // 'rainbow6',
    'rimworld',
];

const notifyUsers = function notifyUsers ( game, service, foundUser ) {
    // eslint-disable-next-line no-process-env
    if ( !process.env.users ) {
        return false;
    }

    const redditUserURL = 'https://www.reddit.com/user/{{identifier}}';
    const steamNumericURL = 'http://steamcommunity.com/profiles/{{identifier}}/posthistory/';
    const steamNameURL = 'http://steamcommunity.com/id/{{identifier}}/posthistory/';
    // eslint-disable-next-line no-process-env
    const users = process.env.users.split( ' ' );
    const options = {
        hostname: 'notifyy-mcnotifyface.herokuapp.com',
        method: 'GET',
        path: '/out',
    };

    let message = '';

    // eslint-disable-next-line no-useless-escape
    options.path = `${ options.path }?title=${ encodeURIComponent( 'Found a new developer for ' + game + ', ' + foundUser.username.replace( /_/g, '\_' ) ) }`;

    for ( let i = 0; i < users.length; i = i + 1 ) {
        options.path = `${ options.path }&users=${ users[ i ] }`;
    }

    if ( service === 'reddit' ) {
        options.path = `${ options.path }&url=${ encodeURIComponent( redditUserURL.replace( '{{identifier}}', foundUser.username.replace( /_/g, '\\_' ) ) ) }`;
    } else if ( service === 'steam' ) {
        if ( Number.isInteger( foundUser.username ) ) {
            options.path = `${ options.path }&url=${ encodeURIComponent( steamNumericURL.replace( '{{identifier}}', foundUser.username.replace( /_/g, '\\_' ) ) ) }`;
        } else {
            options.path = `${ options.path }&url=${ encodeURIComponent( steamNameURL.replace( '{{identifier}}', foundUser.username.replace( /_/g, '\\_' ) ) ) }`;
        }
    }

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

const getGameData = function getGameData ( game, onDone ) {
    const options = {
        hostname: 'raw.githubusercontent.com',
        method: 'GET',
        path: `/kokarn/dev-tracker/master/games/${ game }/data.json`,
    };

    const request = https.request( options, ( response ) => {
        let body = '';

        response.setEncoding( 'utf8' );

        if ( response.statusCode === ERROR_REQUEST_CODE ) {
            onDone( {} );

            return false;
        }

        response.on( 'data', ( chunk ) => {
            body = body + chunk;
        } );

        response.on( 'end', () => {
            onDone( JSON.parse( body ) );
        } );

        return true;
    } );

    request.on( 'error', ( requestError ) => {
        // eslint-disable-next-line no-console
        console.log( chalk.red( `problem with request: ${ requestError.message }` ) );
    } );

    request.end();
};

const getAccounts = function getAccounts ( developers, service, game ) {
    const activeAccounts = [];

    for ( let i = 0; i < developers.length; i = i + 1 ) {
        if ( developers[ i ].accounts[ service ] ) {
            activeAccounts.push( developers[ i ].accounts[ service ] );
        }
    }

    console.log( `Loaded ${ activeAccounts.length } developers for ${ game } on ${ service }` );

    return activeAccounts;
};

const findDevelopers = function findDevelopers ( game, gameIndex ) {
    getGameData( game, ( gameData ) => {
        const developers = gameData.developers;

        if ( gameData.config && gameData.config.Steam && gameData.config.Steam.matchOnly ) {
            setTimeout( () => {
                const steamDevelopers = getAccounts( developers, 'Steam', game );

                steam.get( gameData.config.Steam.matchOnly, STEAM_PAGES )
                    .then( ( users ) => {
                        const filteredUsers = steam.filter( users, game, steamDevelopers );

                        console.log( chalk.green( `Found ${ filteredUsers.length } new developers on Steam for ${ game }` ) );

                        if ( filteredUsers.length > 0 ) {
                            console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                            for ( let i = 0; i < users.length; i = i + 1 ) {
                                setTimeout( notifyUsers.bind( this, game, 'steam', users[ i ] ), i * NOTIFYY_DELAY );
                            }
                        }
                    } )
                    .catch( ( error ) => {
                        console.log( error );
                    } );
            }, gameIndex * STEAM_INDEX_DELAY );
        }

        if ( gameData.config && gameData.config.Reddit && ( gameData.config.Reddit.index || gameData.config.Reddit.matchOnly ) ) {
            const redditDevelopers = getAccounts( developers, 'Reddit', game );
            const subreddit = gameData.config.Reddit.index || gameData.config.Reddit.matchOnly;

            console.log( `Starting with r/${ subreddit }` );
            reddit.get( subreddit, REDDIT_PAGES )
                .then( ( topUsers ) => {
                    reddit.get( `${ subreddit }/new`, REDDIT_PAGES )
                        .then( ( newUsers ) => {
                            const users = reddit.filter( topUsers.concat( newUsers ), game, redditDevelopers );

                            console.log( chalk.green( `Found ${ users.length } new developers on Reddit for ${ game }` ) );

                            if ( users.length > 0 ) {
                                console.log( chalk.green( JSON.stringify( users, null, JSON_INDENT ) ) );

                                for ( let i = 0; i < users.length; i = i + 1 ) {
                                    setTimeout( notifyUsers.bind( this, game, 'reddit', users[ i ] ), i * NOTIFYY_DELAY );
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

for ( let i = 0; i < GAME_LIST.length; i = i + 1 ) {
    findDevelopers( GAME_LIST[ i ], i );
}
