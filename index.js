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
        if ( gameData.config.sources[ service ].findSections ) {
            services[ service ] = gameData.config.sources[ service ].findSections;
        } else if ( gameData.config.sources[ service ].allowedSections ) {
            services[ service ] = gameData.config.sources[ service ].allowedSections;
        }
    }

    return getAccounts( gameData.identifier )
        .then( ( accounts ) => {
            const accountList = {};

            for ( let i = 0; i < accounts.length; i = i + 1 ) {
                if ( typeof accountList[ accounts[ i ].service ] === 'undefined' ) {
                    accountList[ accounts[ i ].service ] = [];
                }

                accountList[ accounts[ i ].service ].push( accounts[ i ].identifier );
            }

            const checkServices = [ ...new Set( Object.keys( accountList ).concat( Object.keys( services ) ) ) ];

            const servicePromises = [];

            checkServices.forEach( ( service ) => {
                if ( !finders[ service ] ) {
                    return true;
                }

                const indexer = new finders[ service ]( gameData.identifier, services[ service ], accountList[ service ] );

                servicePromises.push( indexer.run() );

                return true;
            } );

            return Promise.all( servicePromises );
        } )
        .catch( ( getErrors ) => {
            console.error( getErrors );
        } );
};

getGames()
    .then( async ( games ) => {
        for ( let i = 0; i < games.length; i = i + 1 ) {
            await findDevelopers( games[ i ] );
        }
    } )
    .catch( ( getError ) => {
        console.error( getError );
    } );
