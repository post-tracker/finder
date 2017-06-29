const FeedMe = require( 'feedme' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

class MiggyRSS {
    constructor ( game, sections, accounts ) {
        this.sections = sections;
        this.accounts = accounts || [];
        this.game = game;
    }

    run () {
        const users = [];

        console.log( `Loading ${ this.sections[ 0 ] }` );
        loadPage( this.sections[ 0 ] )
            .then( ( posts ) => {
                const parser = new FeedMe();

                parser.on( 'item', ( item ) => {
                    const [ , username, topicTitle ] = item.title.match( /^(.+?) - (.*)/ );

                    users.push( username );
                } );

                parser.write( posts );

                const filteredUsers = this.filter( [ ...new Set( users ) ] );

                console.log( chalk.green( `Found ${ filteredUsers.length } new developers in the MiggyRSS for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'MiggyRSS', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.log( error.message );
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

module.exports = MiggyRSS;
