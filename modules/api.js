const https = require( 'https' );

const API_HOST = 'api.kokarn.com';
const API_PORT = 443;

const SUCESS_STATUS_CODE = 200;

// eslint-disable-next-line no-process-env
const API_TOKEN = process.env.apiToken;

if ( !API_TOKEN ) {
    throw new Error( 'Unable to load API token' );
}

const loadPath = function loadPath ( requestPath, onDone ) {
    const options = {
        headers: {
            Authorization: `Bearer ${ API_TOKEN }`,
        },
        hostname: API_HOST,
        method: 'GET',
        path: requestPath,
        port: API_PORT,
    };

    const request = https.request( options, ( response ) => {
        let body = '';

        response.setEncoding( 'utf8' );

        if ( response.statusCode !== SUCESS_STATUS_CODE ) {
            console.log( `${ API_HOST }${ requestPath } returned ${ response.statusCode }` );
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
        console.log( `Problem with request: ${ requestError.message }` );
    } );

    request.end();
};

module.exports = {
    load: loadPath,
};
