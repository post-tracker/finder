const https = require( 'follow-redirects' ).https;
const url = require( 'url' );

const Promise = require( 'promise' );

module.exports = function loadPage ( pageUrl ) {
    return new Promise( ( resolve, reject ) => {
        let parsedUrl = url.parse( pageUrl );
        let options = {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36',
            },
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            port: parsedUrl.port || 443,
            protocol: parsedUrl.protocol,
        };

        const request = https.get( options, ( response ) => {
            let body = '';

            if( response.statusCode !== 200 ){
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
        } );

        request.on( 'error', ( error ) => {
            reject( error );
        } );
    } );
};
