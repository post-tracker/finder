const { https } = require( 'follow-redirects' );

const redditAuth = require( './reddit-auth.js' );

const API_HOSTNAME = 'oauth.reddit.com';
const OK_STATUS_CODE = 200;
const UNAUTHORIZED_STATUS_CODE = 401;

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

    try {
        return await requestWithToken( path, token );
    } catch ( requestError ) {
        if ( requestError.statusCode === UNAUTHORIZED_STATUS_CODE ) {
            redditAuth.invalidateToken();

            const freshToken = await redditAuth.getToken();

            return requestWithToken( path, freshToken );
        }

        throw requestError;
    }
};
