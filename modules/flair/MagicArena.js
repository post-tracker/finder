const base = require( './base.js' );

module.exports = Object.assign( {}, base, {
    isDev: function isDev ( user ) {
        if ( !user[ this.type ] ) {
            return false;
        }

        if ( this.list.includes( user[ this.type ].toLowerCase() ) ) {
            return true;
        }

        return false;
    },
    list: [
        'wotcanimated',
    ],
    type: 'author_flair_css_class',
} );
