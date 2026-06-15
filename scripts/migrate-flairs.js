// One-off migration: copy the hardcoded finder/modules/flair/*.js blocklists into
// each game's DB config at config.sources.<RedditSource>.flair[subreddit], so flair
// can be curated from the admin UI instead of editing JS files.
//
// Idempotent: subreddits that already have a flair entry are left untouched.
//
//   Dry run (default, prints what would change):
//     API_TOKEN=... node scripts/migrate-flairs.js
//   Apply the changes:
//     API_TOKEN=... node scripts/migrate-flairs.js --apply

const https = require( 'https' );

const api = require( '../modules/api.js' );
const flair = require( '../modules/flair/' );

const API_HOST = 'api.developertracker.com';
const API_PORT = 443;
const OK_STATUS = 200;

// eslint-disable-next-line no-process-env
const API_TOKEN = process.env.API_TOKEN;
const APPLY = process.argv.includes( '--apply' );

// Match the service-name normalisation finder/index.js + queue-users use, so we
// find the Reddit source regardless of its casing or `type` override.
const normalizeService = function normalizeService ( service ) {
    return String( service )
        .toLowerCase()
        .replace( /[\s.]/g, '-' );
};

const patchGame = function patchGame ( identifier, config ) {
    return new Promise( ( resolve, reject ) => {
        const body = JSON.stringify( {
            id: identifier,
            properties: {
                config: config,
            },
        } );

        const request = https.request( {
            headers: {
                Authorization: `Bearer ${ API_TOKEN }`,
                'Content-Type': 'application/json',
            },
            hostname: API_HOST,
            method: 'PATCH',
            path: `/games/${ identifier }`,
            port: API_PORT,
        }, ( response ) => {
            response.resume();
            response.on( 'end', () => {
                if ( response.statusCode === OK_STATUS ) {
                    resolve( true );
                } else {
                    reject( new Error( `PATCH /games/${ identifier } returned ${ response.statusCode }` ) );
                }
            } );
        } );

        request.on( 'error', reject );
        request.write( body );
        request.end();
    } );
};

const migrate = async function migrate () {
    if ( !API_TOKEN ) {
        throw new Error( 'API_TOKEN is required' );
    }

    const games = await api.load( '/games' );

    if ( !games ) {
        throw new Error( 'Could not load /games (no full config returned — check token scope)' );
    }

    const mode = APPLY
        ? 'APPLYING'
        : 'DRY RUN';

    console.log( `${ mode } — ${ games.length } games\n` );

    for ( const game of games ) {
        const config = game.config;

        if ( !config || !config.sources ) {
            continue;
        }

        let changed = false;

        for ( const serviceKey in config.sources ) {
            if ( !Reflect.apply( {}.hasOwnProperty, config.sources, [ serviceKey ] ) ) {
                continue;
            }

            const source = config.sources[ serviceKey ];

            if ( normalizeService( source.type || serviceKey ) !== 'reddit' ) {
                continue;
            }

            const subreddits = source.allowedSections || source.findSections || [];

            for ( const subreddit of subreddits ) {
                const legacy = flair[ subreddit ];

                if ( !legacy ) {
                    console.log( `  ${ game.identifier }: r/${ subreddit } — no legacy module, skipping` );

                    continue;
                }

                source.flair = source.flair || {};

                if ( source.flair[ subreddit ] ) {
                    continue;
                }

                source.flair[ subreddit ] = {
                    blocklist: legacy.list.slice(),
                    type: legacy.type,
                };

                changed = true;

                console.log( `  ${ game.identifier }: r/${ subreddit } ← ${ legacy.list.length } blocked` );
            }
        }

        if ( changed && APPLY ) {
            await patchGame( game.identifier, config );
            console.log( `  ${ game.identifier }: saved` );
        }
    }

    const hint = APPLY
        ? ''
        : ' Re-run with --apply to write changes.';

    console.log( `\nDone.${ hint }` );
};

migrate().catch( ( error ) => {
    console.error( error );
    // eslint-disable-next-line no-process-exit
    process.exit( 1 );
} );
