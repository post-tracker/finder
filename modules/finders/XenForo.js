const chalk = require( 'chalk' );
const url = require( 'url' );

const loadPage = require( '../load.js' );
const ntfy = require( '../ntfy.js' );

const JSON_INDENT = 4;
const NTFY_DELAY = 1500;

// Discovers candidate developer accounts on a XenForo (XF2) forum by scraping
// member profile links off the forum's landing page. Every thread/post row in
// XF2's default templates links posters as `/members/<slug>.<id>/`, so one
// fetch of the base URL surfaces the people currently active there. New ones
// (not already tracked) are pushed to ntfy with a prefilled admin "add dev"
// link, exactly like the Discourse finder.
//
// `endpoint` is the forum base (incl. any mount path), passed through from
// config.sources.XenForo.endpoint. Like the Discourse finder, discovery uses
// the endpoint only — set allowedSections for the indexer, not for finding.
//
// The stored identifier is `<slug>.<id>`; grunt's xenforo indexer strips it to
// the numeric id for /search/member?user_id=.
class XenForo {
    constructor ( game, endpoint, accounts ) {
        this.endpoint = endpoint;
        this.accounts = accounts || [];
        this.game = game;
    }

    run () {
        if ( !this.endpoint ) {
            console.log( chalk.red( `No XenForo endpoint configured for ${ this.game }` ) );

            return Promise.resolve();
        }

        const urlParts = url.parse( this.endpoint );

        console.log( `Loading ${ this.endpoint }` );

        return loadPage( this.endpoint )
            .then( ( pageBody ) => {
                const users = [];
                // /members/<slug>.<id>/ — capture the slug.id and the link text.
                const memberPattern = /href="([^"]*\/members\/([^/"]+\.\d+)\/?)"[^>]*>([^<]+)</gi;
                let match = memberPattern.exec( pageBody );

                while ( match !== null ) {
                    const identifier = match[ 2 ];
                    const name = match[ 3 ].trim();

                    // Skip the "view all members" style links with no name text.
                    if ( name ) {
                        users.push( {
                            identifier: identifier,
                            name: name,
                            url: `${ urlParts.protocol }//${ urlParts.host }/members/${ identifier }/`,
                        } );
                    }

                    match = memberPattern.exec( pageBody );
                }

                const allUsers = users.filter( ( obj, pos, arr ) => {
                    return arr.map( ( mapObj ) => {
                        return mapObj.identifier;
                    } ).indexOf( obj.identifier ) === pos;
                } );
                const filteredUsers = this.filter( allUsers );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ allUsers.length } new developers on XenForo for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( ntfy.bind( this, this.game, 'XenForo', filteredUsers[ i ] ), i * NTFY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.log( error );
            } );
    }

    filter ( newUsers ) {
        const accountCache = [];

        return newUsers.filter( ( user ) => {
            if ( accountCache.indexOf( user.identifier ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.identifier ) > -1 ) {
                return false;
            }

            accountCache.push( user.identifier );

            return true;
        } );
    }
}

module.exports = XenForo;
