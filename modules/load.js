const { https } = require( 'follow-redirects' );
const url = require( 'url' );

const DEFAULT_SSL_PORT = 443;
const ACCEPTABLE_RESPONSE_STATUSCODE = 200;

module.exports = function loadPage ( pageUrl, requestBody = false ) {
    return new Promise( ( resolve, reject ) => {
        let payload = false;
        const parsedUrl = url.parse( pageUrl );
        const options = {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36',
            },
            hostname: parsedUrl.hostname,
            path: encodeURI( parsedUrl.path ),
            port: parsedUrl.port || DEFAULT_SSL_PORT,
            protocol: parsedUrl.protocol,
        };

        if ( requestBody ) {
            payload = JSON.stringify( requestBody );

            options.headers = Object.assign(
                {},
                options.headers,
                {
                    'Content-Length': Buffer.byteLength( payload ),
                    'Content-Type': 'application/json',
                }
            );
            options.method = 'POST';
        }

        const request = https.request( options, ( response ) => {
            let body = '';

            if ( response.statusCode !== ACCEPTABLE_RESPONSE_STATUSCODE ) {
                reject( new Error( `${ pageUrl } return status code ${ response.statusCode }` ) );

                return false;
            }

            response.setEncoding( 'utf8' );

            response.on( 'data', ( chunk ) => {
                body = `${ body }${ chunk }`;
            } );

            response.on( 'end', () => {
                resolve( body );
            } );

            return true;
        } );

        request.on( 'error', ( error ) => {
            reject( error );
        } );

        if ( payload ) {
            request.write( payload );
        }

        request.end();
    } );
};
