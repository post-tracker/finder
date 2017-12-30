const path = require( 'path' );
const fs = require( 'fs' );

const flairExport = {};

// eslint-disable-next-line no-sync
fs.readdirSync( __dirname ).forEach( ( file ) => {
    const fileData = path.parse( file );

    if ( fileData.base === path.basename( __filename ) ) {
        return true;
    }

    // eslint-disable-next-line global-require
    flairExport[ fileData.name ] = require( path.join( __dirname, file ) );

    return true;
} );

module.exports = flairExport;
