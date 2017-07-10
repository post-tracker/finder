const https = require( 'https' );

const chalk = require( 'chalk' );

const NOTIFYY_SUCCESS_CODE = 204;
const NOTIFYY_ERROR_CODE = 400;

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
        case 'Bungie.net':
            normalisedUser = {
                identifier: foundUser.membershipId,
                name: foundUser.displayName,
                url: `https://www.bungie.net/en/Profile/254/${ foundUser.membershipId }`,
            };
            break;
        default:
            normalisedUser = {
                identifier: foundUser,
                name: foundUser,
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

    if ( normalisedUser.url ) {
        options.path = `${ options.path }&url=${ encodeURIComponent( normalisedUser.url ) }`;
    }

    if ( typeof foundUser === 'object' ) {
        for ( const property in foundUser ) {
            message = `${ message }%0A${ encodeURIComponent( property.replace( /_/g, '\\_' ) ) }:%20${ encodeURIComponent( String( foundUser[ property ] ).replace( /_/g, '\\_' ) ) }`;
        }
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

module.exports = notifyUsers;
