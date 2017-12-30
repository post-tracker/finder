const finders = require( './modules/finders/' );
const api = require( './modules/api.js' );

const getAccounts = function getAccounts ( game ) {
    return api.load( `/${ game }/accounts` );
};

const getGames = function getGames () {
    return api.load( '/games' );
};

const findDevelopers = function findDevelopers ( gameData ) {
    const services = {};

    if ( !gameData.config ) {
        return false;
    }

    if ( !gameData.config.sources ) {
        return false;
    }

    for ( const service in gameData.config.sources ) {
        if ( gameData.config.sources[ service ].allowedSections ) {
            services[ service ] = gameData.config.sources[ service ].allowedSections;
        }
    }

    getAccounts( gameData.identifier )
        .then( ( accounts ) => {
            const accountList = {};

            for ( let i = 0; i < accounts.length; i = i + 1 ) {
                if ( typeof accountList[ accounts[ i ].service ] === 'undefined' ) {
                    accountList[ accounts[ i ].service ] = [];
                }

                accountList[ accounts[ i ].service ].push( accounts[ i ].identifier );
            }

            for ( const service in services ) {
                if ( !finders[ service ] ) {
                    continue;
                }

                const indexer = new finders[ service ]( gameData.identifier, services[ service ], accountList[ service ] );

                indexer.run();
            }
        } )
        .catch( ( getErrors ) => {
            console.error( getErrors );
        } );
};

getGames()
    .then( ( games ) => {
        games.forEach( ( game ) => {
            findDevelopers( game );
        } );
    } )
    .catch( ( getError ) => {
        console.error( getError );
    } );
