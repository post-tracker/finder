const finders = require( './modules/finders/' );
const api = require( './modules/api.js' );

const games = require( './config/games.json' );

const getAccounts = function getAccounts ( game, onDone ) {
    api.load( `/${ game }/accounts`, onDone );
};

const findDevelopers = function findDevelopers ( services, gameIdentifier ) {
    getAccounts( gameIdentifier, ( accounts ) => {
        const accountList = {};

        for ( let i = 0; i < accounts.data.length; i = i + 1 ) {
            if ( typeof accountList[ accounts.data[ i ].service ] === 'undefined' ) {
                accountList[ accounts.data[ i ].service ] = [];
            }

            accountList[ accounts.data[ i ].service ].push( accounts.data[ i ].identifier );
        }

        for ( const service in services ) {
            if ( !finders[ service ] ) {
                continue;
            }

            const indexer = new finders[ service ]( gameIdentifier, services[ service ], accountList[ service ] );

            indexer.run();
        }
    } );
};

Object.keys( games ).forEach( ( game ) => {
    findDevelopers( games[ game ], game );
} );
