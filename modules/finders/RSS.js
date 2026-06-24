const FeedMe = require( 'feedme' );
const chalk = require( 'chalk' );

const loadPage = require( '../load.js' );
const ntfy = require( '../ntfy.js' );

const JSON_INDENT = 4;
const NTFY_DELAY = 1500;

// Generic RSS author finder: surfaces the people writing a dev blog so they can
// be added as developers. It pairs with grunt's RSS reader, which attributes a
// post to the account whose identifier matches the item's <dc:creator>; this
// finder discovers those creator names. First uses: Axie Infinity's "The
// Lunacian" (a single anonymous feed — no creators, so this finds nothing) and
// Project Zomboid's "Thursdoid" (a multi-author blog — AmazingSully, kirrus, …).
//
// Unlike MiggyRSS (which parses authorship out of the item *title*), this reads
// the standard <dc:creator>/<author> element, matching how grunt attributes.
class RSS {
    // Shared finder signature (game, endpoint, accounts) plus the unused flair
    // slot (Reddit-only) and the trailing serviceLabel.
    // eslint-disable-next-line max-params
    constructor ( game, endpoint, accounts, flair, serviceLabel ) {
        // Trim the endpoint defensively: a stray trailing space (easy to paste
        // into the admin config) makes the request fetch a malformed URL — the
        // same guard grunt's reader applies. `flair` is unused here (only Reddit
        // reads it); it's kept as a positional arg so the shared finder
        // constructor signature lines up.
        this.endpoint = String( endpoint || '' ).trim();
        this.accounts = accounts || [];
        this.game = game;

        // The DB `service` an added account should carry — the source's label
        // (or its config key when unlabelled), passed through to the add-dev
        // notification so the prefilled account resolves back to this source.
        this.service = serviceLabel;
    }

    run () {
        const userData = {};
        const users = [];

        // A `*` catch-all account already ingests the whole feed (creatorless
        // feeds like The Lunacian are set up this way), so the individual authors
        // aren't "missing" developers — surfacing them would just be noise.
        if ( this.accounts.indexOf( '*' ) > -1 ) {
            console.log( `${ this.game } RSS feed is covered by a catch-all (*) account, skipping discovery` );

            return Promise.resolve();
        }

        console.log( `Loading ${ this.endpoint }` );

        return loadPage( this.endpoint )
            .then( ( posts ) => {
                const parser = new FeedMe();

                parser.on( 'item', ( item ) => {
                    // rss-parser-style feeds expose the author as <dc:creator>;
                    // some use <author> instead. Items with neither are anonymous
                    // and only a catch-all account would collect them, so they're
                    // not discoverable individuals — skip.
                    const creator = String( item[ 'dc:creator' ] || item.author || '' ).trim();

                    if ( !creator ) {
                        return;
                    }

                    if ( !userData[ creator ] ) {
                        userData[ creator ] = {
                            identifier: creator,
                            name: creator,
                            url: item.link,
                        };

                        users.push( creator );
                    }
                } );

                parser.write( posts );

                const filteredUsers = this.filter( users );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ users.length } new developers in the RSS feed for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( ntfy.bind( this, this.game, this.service, userData[ filteredUsers[ i ] ] ), i * NTFY_DELAY );
                    }
                }
            } )
            .catch( ( error ) => {
                console.error( error );
            } );
    }

    filter ( newUsers ) {
        const accountCache = [];

        // grunt matches a feed creator against the account identifier
        // case-insensitively, so an author already tracked as "kirrus" is fed by
        // a <dc:creator> of "Kirrus". Match the same way here, or a case
        // difference would re-notify an already-known developer every run.
        const knownAccounts = this.accounts.map( ( account ) => {
            return account.toLowerCase();
        } );

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

module.exports = RSS;
