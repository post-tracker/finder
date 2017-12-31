const fortnite = require( './FORTnITE.js' );

module.exports = {
    getFlairs: function getFlairs () {
        return this.list;
    },
    list: fortnite.list,
    type: 'author_flair_css_class',
};
