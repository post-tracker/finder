const https = require( 'https' );

const NTFY_TOPIC = 'post-tracker';
const SUCCESS_STATUS_CODE = 200;
const ADMIN_HOST = 'https://post-admin.kokarn.com';
const REDDIT_USER_URL = 'https://www.reddit.com/user/{{identifier}}';

// Maps the finder's service label to the value stored in the accounts table.
const FINDER_TO_DB_SERVICE = {
    'Bungie.net': 'Bungie.net',
    Discourse: 'Discourse',
    MiggyRSS: 'MiggyRSS',
    RSI: 'rsi',
    SteamFeed: 'Steam',
    XenForo: 'XenForo',
    reddit: 'Reddit',
    steam: 'Steam',
};

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

const buildAdminUrl = function buildAdminUrl ( game, service, user ) {
    const dbService = FINDER_TO_DB_SERVICE[ service ];

    if ( !dbService || !user.identifier ) {
        return false;
    }

    const params = new URLSearchParams( {
        action: 'add-dev',
        game: game,
        identifier: user.identifier,
        name: user.name || user.identifier,
        service: dbService,
    } );

    return `${ ADMIN_HOST }/?${ params.toString() }`;
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
    const adminUrl = buildAdminUrl( game, service, user );

    // Fall back to the identifier when a source yields no usable name, so the
    // title never reads "undefined" or trails off after the comma. If neither
    // is present, drop the name fragment entirely.
    const displayName = user.name || user.identifier;
    const payload = {
        message: buildBody( foundUser ),
        title: displayName
            ? `Found a new developer for ${ game }, ${ displayName }`
            : `Found a new developer for ${ game }`,
        topic: NTFY_TOPIC,
    };

    if ( adminUrl ) {
        payload.click = adminUrl;
    } else if ( user.url ) {
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

    // Opt-in connection tracing (set NTFY_DEBUG=1). Logs the IP/family DNS
    // resolved for ntfy.sh and the socket it connected to — the quickest way to
    // confirm an IPv6-vs-IPv4 routing or egress problem on a host where ntfy
    // POSTs fail. Silent unless enabled so normal runs stay quiet.
    if ( process.env.NTFY_DEBUG ) {
        request.on( 'socket', ( socket ) => {
            socket.on( 'lookup', ( lookupError, address, family ) => {
                console.error( `[ntfy] dns ntfy.sh -> ${ address } (IPv${ family })${ lookupError ? ` lookupError=${ lookupError.message }` : '' }` );
            } );
            socket.on( 'connect', () => {
                console.error( `[ntfy] connected ${ socket.remoteAddress }:${ socket.remotePort }` );
            } );
        } );
    }

    request.on( 'error', ( requestError ) => {
        // The bare .message has been coming through empty on the VPS, hiding the
        // real cause. Log the low-level connection fields too: code/errno/syscall
        // identify the failure class (DNS vs connect vs reset), and address/port
        // reveal which resolved IP it actually tried — e.g. an unroutable IPv6
        // address would point at a missing-IPv6-egress problem on the host.
        const details = [
            requestError.code && `code=${ requestError.code }`,
            requestError.errno && `errno=${ requestError.errno }`,
            requestError.syscall && `syscall=${ requestError.syscall }`,
            requestError.address && `address=${ requestError.address }`,
            requestError.port && `port=${ requestError.port }`,
        ].filter( Boolean ).join( ' ' );

        console.error( `[ntfy] request error for "${ payload.title }": ${ requestError.message || '(empty message)' }${ details ? ` [${ details }]` : '' }` );
    } );

    request.end( body );

    return true;
};
