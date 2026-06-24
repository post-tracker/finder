const { https } = require( 'follow-redirects' );

const redditAuth = require( './reddit-auth.js' );

const API_HOSTNAME = 'oauth.reddit.com';
const OK_STATUS_CODE = 200;
const UNAUTHORIZED_STATUS_CODE = 401;

// Reddit's OAuth API allows ~100 requests/minute. The finder fans requests out
// aggressively — parallel subreddits, plus ~25 concurrent comment fetches per
// page — so it hits Reddit in bursts that blow past that limit and get us
// rate-limited partway through a run. Funnel every request through a single gate
// that spaces them at least REDDIT_REQUEST_INTERVAL apart (default 1000ms ≈ 60
// req/min, comfortably under the limit). The run then trickles instead of
// bursting, so it takes longer but covers far more before hitting any limit.
const DEFAULT_REQUEST_INTERVAL = 1000;
const MIN_REQUEST_INTERVAL = Number( process.env.REDDIT_REQUEST_INTERVAL ) || DEFAULT_REQUEST_INTERVAL;

let nextRequestTime = 0;

const throttle = function throttle () {
    const now = Date.now();
    const wait = Math.max( 0, nextRequestTime - now );

    // Reserve this slot synchronously so concurrent callers each get their own
    // spaced-out turn instead of all reading the same `now`.
    nextRequestTime = Math.max( now, nextRequestTime ) + MIN_REQUEST_INTERVAL;

    return new Promise( ( resolve ) => {
        setTimeout( resolve, wait );
    } );
};

const requestWithToken = function requestWithToken ( path, token ) {
    return new Promise( ( resolve, reject ) => {
        const options = {
            headers: {
                authorization: `bearer ${ token }`,
                'user-agent': redditAuth.userAgent(),
            },
            hostname: API_HOSTNAME,
            method: 'GET',
            path: encodeURI( path ),
        };

        const request = https.request( options, ( response ) => {
            let body = '';

            response.setEncoding( 'utf8' );
            response.on( 'data', ( chunk ) => {
                body = `${ body }${ chunk }`;
            } );

            response.on( 'end', () => {
                if ( response.statusCode !== OK_STATUS_CODE ) {
                    const message = `https://${ API_HOSTNAME }${ path } returned status code ${ response.statusCode }`;
                    const error = new Error( message );

                    error.statusCode = response.statusCode;
                    reject( error );

                    return;
                }

                resolve( body );
            } );
        } );

        request.on( 'error', ( error ) => {
            reject( error );
        } );

        request.end();
    } );
};

// GETs a path on the Reddit OAuth API and resolves with the raw response body
// (callers JSON.parse it). On a 401 the cached token is dropped and the request
// retried once with a fresh one.
module.exports = async function redditFetch ( path ) {
    const token = await redditAuth.getToken();

    await throttle();

    try {
        return await requestWithToken( path, token );
    } catch ( requestError ) {
        if ( requestError.statusCode === UNAUTHORIZED_STATUS_CODE ) {
            redditAuth.invalidateToken();

            const freshToken = await redditAuth.getToken();

            await throttle();

            return requestWithToken( path, freshToken );
        }

        throw requestError;
    }
};
