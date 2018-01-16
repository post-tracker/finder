const fortnite = require( './FORTnITE.js' );
const base = require( './base.js' );

module.exports = Object.assign( {}, base, {
    list: fortnite.list,
    type: 'author_flair_css_class',
} );
