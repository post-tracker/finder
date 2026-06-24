const cron = require( 'node-cron' );

const finders = require( './modules/finders/' );
const api = require( './modules/api.js' );

const SCHEDULE = process.env.RUN_SCHEDULE || '0 */3 * * *';

// Normalise a service/type/source name to a single canonical key, the same way
// queue-users/grunt route services. The finder used to match the DB
// `account.service`, the config source key and the finder registry name by
// exact spelling; any casing drift silently emptied the known-accounts list and
// re-notified every tracked developer on each run (see the RSI/Steam fixes).
const normalizeService = function normalizeService ( service ) {
    const lower = String( service ).toLowerCase();

    return lower.replace( /[\s.]/g, '-' );
};

// Finder registry keyed by normalised name, resolved once from the (mixed-case)
// module names so the lookup is case-insensitive too.
const findersByKey = {};

Object.keys( finders ).forEach( ( finderName ) => {
    findersByKey[ normalizeService( finderName ) ] = finders[ finderName ];
} );

// Finders whose second constructor argument is the source `endpoint` (a URL):
// RSS-style readers and forum scrapers. Every other finder takes the list of
// sections to search (findSections / allowedSections). A source can carry both
// an endpoint (for the indexer) and allowedSections, so the argument has to be
// chosen by finder type, not by whichever field happens to be present.
const ENDPOINT_FINDERS = new Set( [
    'discourse',
    'miggyrss',
    'xenforo',
] );

const getAccounts = function getAccounts ( game ) {
    return api.load( `/${ game }/accounts` );
};

const getGames = function getGames () {
    return api.load( '/games' );
};

// The API returns games in a stable order, and a finder run walks them
// sequentially. If an upstream platform (e.g. Reddit) rate-limits us partway
// through, the games at the tail of the list are always the ones that get
// skipped — so the same games can go run after run without ever being indexed.
// Shuffle each run (Fisher-Yates) so the rate-limit casualties rotate instead.
const shuffle = function shuffle ( list ) {
    const shuffled = list.slice();

    for ( let i = shuffled.length - 1; i > 0; i = i - 1 ) {
        const j = Math.floor( Math.random() * ( i + 1 ) );

        [ shuffled[ i ], shuffled[ j ] ] = [ shuffled[ j ], shuffled[ i ] ];
    }

    return shuffled;
};

const findDevelopers = function findDevelopers ( gameData ) {
    const sourceSections = {};
    const sourceEndpoints = {};
    const sourceFlairs = {};
    const serviceTypes = {};

    if ( !gameData.config ) {
        return false;
    }

    if ( !gameData.config.sources ) {
        return false;
    }

    // Disabled game (config.live falsy) — don't discover/index its devs.
    if ( gameData.config.live === 0 || gameData.config.live === false ) {
        return false;
    }

    for ( const service in gameData.config.sources ) {
        if ( !Reflect.apply( {}.hasOwnProperty, gameData.config.sources, [ service ] ) ) {
            continue;
        }

        const source = gameData.config.sources[ service ];
        const key = normalizeService( service );

        if ( source.findSections ) {
            sourceSections[ key ] = source.findSections;
        } else if ( source.allowedSections ) {
            sourceSections[ key ] = source.allowedSections;
        }

        if ( source.endpoint ) {
            sourceEndpoints[ key ] = source.endpoint;
        }

        // Per-subreddit flair config now lives in the DB (managed from admin)
        // rather than finder/modules/flair/*.js. Reddit is the only finder that
        // uses it; other finders ignore the extra constructor argument.
        if ( source.flair ) {
            sourceFlairs[ key ] = source.flair;
        }

        serviceTypes[ key ] = normalizeService( source.type || service );
    }

    return getAccounts( gameData.identifier )
        .then( ( accounts ) => {
            const accountList = {};

            for ( let i = 0; i < accounts.length; i = i + 1 ) {
                const key = normalizeService( accounts[ i ].service );

                if ( typeof accountList[ key ] === 'undefined' ) {
                    accountList[ key ] = [];
                }

                accountList[ key ].push( accounts[ i ].identifier );
            }

            const checkServices = [ ...new Set(
                Object.keys( accountList ).concat( Object.keys( sourceSections ), Object.keys( sourceEndpoints ) )
            ) ];

            const servicePromises = [];

            checkServices.forEach( ( service ) => {
                const Finder = findersByKey[ serviceTypes[ service ] ];

                if ( !Finder ) {
                    return true;
                }

                const finderArg = ENDPOINT_FINDERS.has( serviceTypes[ service ] )
                    ? sourceEndpoints[ service ]
                    : sourceSections[ service ];

                const indexer = new Finder( gameData.identifier, finderArg, accountList[ service ], sourceFlairs[ service ] );

                servicePromises.push( indexer.run() );

                return true;
            } );

            return Promise.all( servicePromises );
        } )
        .catch( ( getErrors ) => {
            console.error( getErrors );
        } );
};

let running = false;

const tick = async function tick () {
    if ( running ) {
        console.log( 'Previous finder run still in progress, skipping tick' );

        return;
    }

    running = true;

    console.log( `[${ new Date().toISOString() }] Finder run starting` );

    try {
        let games = shuffle( await getGames() );

        // GAME_LIMIT caps how many games a run processes — a local testing aid
        // (like the indexer's LIMIT_SERVICE) so a run can be exercised quickly
        // without walking the whole catalogue. Unset/0 means no limit.
        const gameLimit = Number( process.env.GAME_LIMIT ) || 0;

        if ( gameLimit > 0 ) {
            console.log( `GAME_LIMIT set, processing only ${ gameLimit } game(s) this run` );
            games = games.slice( 0, gameLimit );
        }

        for ( let i = 0; i < games.length; i = i + 1 ) {
            await findDevelopers( games[ i ] );
        }

        console.log( `[${ new Date().toISOString() }] Finder run complete` );
    } catch ( runError ) {
        console.error( runError );
    } finally {
        running = false;
    }
};

const shutdown = function shutdown () {
    process.exit( 0 );
};

process.on( 'SIGTERM', shutdown );
process.on( 'SIGINT', shutdown );

cron.schedule( SCHEDULE, tick );

tick();
