const FeedMe = require( 'feedme' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const ntfy = require( '../ntfy.js' );

const JSON_INDENT = 4;
const NTFY_DELAY = 1500;

// Maybe add something like this?
// https://store.steampowered.com/feeds/news/app/359320/

// The API seems like the best place
// https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=359320&count=10&maxlength=300&format=json

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

                parser.on( 'item', ( item ) => {
                    if ( item.author && !pageLookups[ item.author ] ) {
                        pageLookups[ item.author ] = item.link;
                    }
                } );

                parser.write( posts );

                // Game announcement feeds only expose the poster's display
                // name (e.g. "Mal"), and the linked announcement page is
                // JS-rendered with no profile link to scrape. Use the display
                // name itself as the Steam identifier — the indexer's SteamFeed
                // matches feed authors against the account identifier directly,
                // so a bare persona is exactly what we want. This keeps the
                // notification one-click-addable like every other finder.
                Object.keys( pageLookups ).forEach( ( author ) => {
                    userData[ author ] = {
                        identifier: author,
                        name: author,
                        url: pageLookups[ author ],
                    };

                    users.push( author );
                } );

                const filteredUsers = this.filter( [ ...new Set( users ) ] );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ users.length } new developers in the Steam new feed for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( ntfy.bind( this, this.game, 'SteamFeed', userData[ filteredUsers[ i ] ] ), i * NTFY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.error( error );
            } );
    }

    filter ( newUsers ) {
        const accountCache = [];

        // The indexer's SteamFeed matches feed authors against account
        // identifiers case-insensitively, so an account already tracked as
        // "mal" is fed by an announcement author of "Mal". Match the same way
        // here, otherwise a case difference makes the finder re-notify an
        // already-known developer on every run.
        const knownAccounts = this.accounts.map( ( account ) => account.toLowerCase() );

        return newUsers.filter( ( user ) => {
            const normalized = user.toLowerCase();

            if ( accountCache.indexOf( normalized ) > -1 ) {
                return false;
            }

            if ( knownAccounts.indexOf( normalized ) > -1 ) {
                return false;
            }

            accountCache.push( normalized );

            return true;
        } );
    }
}

module.exports = SteamFeed;
