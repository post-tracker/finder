const FeedMe = require( 'feedme' );
const cheerio = require( 'cheerio' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

// Maybe add something like this?
// https://store.steampowered.com/feeds/news/app/359320/

class SteamFeed {
    constructor ( game, endpoint, accounts ) {
        this.endpoint = `https://steamcommunity.com/games/${ endpoint }/rss/`;
        this.accounts = accounts || [];
        this.game = game;
    }

    run () {
        const pageLookups = {};
        const users = [];
        const userData = {};

        console.log( `Loading ${ this.endpoint }` );

        return loadPage( this.endpoint )
            .then( async ( posts ) => {
                const parser = new FeedMe();

                parser.on( 'item', async ( item ) => {
                    if ( !pageLookups[ item.author ] ) {
                        pageLookups[ item.author ] = item.link;
                    }
                } );

                parser.write( posts );

                for ( const user in pageLookups ) {
                    const page = await loadPage( pageLookups[ user ] );

                    console.log(pageLookups[ user ]);

                    const $ = cheerio.load( page );
                    const href = $( '.announcement_byline .whiteLink' ).attr( 'href' );
                    if(!href){
                        continue;
                    }
                    const [ , , identifier] = href.match( /(id|profiles)\/(.+?)\/?$/ );

                    userData[ identifier ] = {
                        identifier: identifier,
                        name: user,
                        url: href,
                    };

                    users.push( identifier );
                }

                const filteredUsers = this.filter( [ ...new Set( users ) ] );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ users.length } new developers in the Steam new feed for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'SteamFeed', userData[ filteredUsers[ i ] ] ), i * NOTIFYY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.error(error);
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

module.exports = SteamFeed;
