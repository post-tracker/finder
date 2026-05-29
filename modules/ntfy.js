const https = require( 'https' );

const NTFY_TOPIC = 'post-tracker';
const SUCCESS_STATUS_CODE = 200;
const REDDIT_USER_URL = 'https://www.reddit.com/user/{{identifier}}';

const normaliseUser = function normaliseUser ( service, foundUser ) {
    switch ( service ) {
        case 'reddit':
            return {
                identifier: foundUser.username,
                name: foundUser.username,
                url: REDDIT_USER_URL.replace( '{{identifier}}', foundUser.username ),
            };
        case 'steam':
            return {
                identifier: foundUser.account,
                name: foundUser.name,
                url: foundUser.accountLink,
            };
        case 'Bungie.net':
            return {
                identifier: foundUser.membershipId,
                name: foundUser.displayName,
                url: `https://www.bungie.net/en/Profile/254/${ foundUser.membershipId }`,
            };
        default:
            if ( foundUser instanceof Object ) {
                return foundUser;
            }

            return {
                identifier: foundUser,
                name: foundUser,
            };
    }
};

const buildBody = function buildBody ( foundUser ) {
    if ( typeof foundUser !== 'object' || foundUser === null ) {
        return String( foundUser );
    }

    const lines = [];

    for ( const property in foundUser ) {
        lines.push( `${ property }: ${ foundUser[ property ] }` );
    }

    return lines.join( '\n' );
};

module.exports = function ntfy ( game, service, foundUser ) {
    const user = normaliseUser( service, foundUser );
    const payload = {
        message: buildBody( foundUser ),
        title: `Found a new developer for ${ game }, ${ user.name }`,
        topic: NTFY_TOPIC,
    };

    if ( user.url ) {
        payload.click = user.url;
    }

    const body = JSON.stringify( payload );
    const request = https.request( {
        headers: {
            'Content-Length': Buffer.byteLength( body ),
            'Content-Type': 'application/json',
        },
        hostname: 'ntfy.sh',
        method: 'POST',
        path: '/',
    }, ( response ) => {
        if ( response.statusCode !== SUCCESS_STATUS_CODE ) {
            console.error( `[ntfy] ${ payload.title }: status ${ response.statusCode }` );
        }

        response.resume();
    } );

    request.on( 'error', ( requestError ) => {
        console.error( `[ntfy] request error: ${ requestError.message }` );
    } );

    request.end( body );

    return true;
};
