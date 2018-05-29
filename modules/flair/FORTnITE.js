const base = require( './base.js' );

module.exports = Object.assign( {}, base, {
    isDev: function isDev ( user ) {
        if ( !user[ this.type ] ) {
            return false;
        }

        for ( const flairString of this.list ) {
            if ( user[ this.type ].includes( flairString ) ) {
                return true;
            }
        }

        return false;
    },
    list: [
        'epic',
    ],
    type: 'author_flair_css_class',
} );
