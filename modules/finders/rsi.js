const cheerio = require( 'cheerio' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

class RSI {
    constructor ( game, sections, accounts ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;
    }

    run () {
        let users = [];

        console.log( `Loading ${ this.sections[ 0 ] }` );

        return loadPage( this.sections[ 0 ], {
            date: new Date().toLocaleDateString( 'sv' ),
            page: 1,
            pagesize: 1,
        } )
            .then( ( devTrackerResponse ) => {
                const devTrackerData = JSON.parse( devTrackerResponse );
                const $ = cheerio.load( devTrackerData.data.html );


                $( '.handle' ).each( ( index, element ) => {
                    users.push( $( element ).text() );
                } );

                const allUsers = [ ...new Set( users ) ];
                const filteredUsers = this.filter( allUsers );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ allUsers.length } new developers on RSI for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'RSI', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
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
            if ( accountCache.indexOf( user ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user ) > -1 ) {
                return false;
            }

            accountCache.push( user );

            return true;
        } );
    }
}

module.exports = RSI;
