const chalk = require( 'chalk' );
const url = require( 'url' );

const loadPage = require( '../load.js' );
const notifyy = require( '../notifyy.js' );

const JSON_INDENT = 4;
const NOTIFYY_DELAY = 1500;

class Discourse {
    constructor ( game, endpoint, accounts ) {
        this.endpoint = endpoint;
        this.accounts = accounts || [];
        this.game = game;
    }

    run () {
        let users = [];
        const membersUrl = `${ this.endpoint }/members.json?limit=50`;
        const urlParts = url.parse( membersUrl );

        console.log( `Loading ${ membersUrl }` );

        return loadPage( membersUrl )
            .then( ( membersResponse ) => {
                const membersData = JSON.parse( membersResponse );

                for ( const member of membersData.members ) {
                    users.push( {
                        identifier: member.username,
                        name: member.username,
                        title: member.title,
                        url: `${ urlParts.protocol }//${ urlParts.hostname }/u/${ member.username }`,
                    } );
                }

                const allUsers = users.filter( ( obj, pos, arr ) => {
                    return arr.map( ( mapObj ) => {
                        return mapObj.identifier;
                    } ).indexOf( obj.identifier ) === pos;
                } );
                const filteredUsers = this.filter( allUsers );

                console.log( chalk.green( `Found ${ filteredUsers.length }/${ allUsers.length } new developers on Discourse for ${ this.game }` ) );

                if ( filteredUsers.length > 0 ) {
                    console.log( chalk.green( JSON.stringify( filteredUsers, null, JSON_INDENT ) ) );

                    for ( let i = 0; i < filteredUsers.length; i = i + 1 ) {
                        setTimeout( notifyy.bind( this, this.game, 'Discourse', filteredUsers[ i ] ), i * NOTIFYY_DELAY );
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
            if ( accountCache.indexOf( user.identifier ) > -1 ) {
                return false;
            }

            if ( this.accounts.indexOf( user.identifier ) > -1 ) {
                return false;
            }

            accountCache.push( user );

            return true;
        } );
    }
}

module.exports = Discourse;
