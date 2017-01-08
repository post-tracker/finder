const loadPage = require( './load.js' );
const flair = require( './flair.js' );

const POSTS_PER_PAGE = 25;

const getUsersInPost = function getUsersInPost( post ){
    let users = [];

    if( typeof post === 'string' || typeof post === 'undefined' ){
        return users;
    }

    if( post.kind === 'more' ) {
        for( let i = 0; i < post.data.count; i = i + 1 ){
            users = users.concat( getUsersInPost( post.data.children[ i ] ) );
        }

        return users;
    }

    users.push( {
        author_flair_text: post.data.author_flair_text,
        author_flair_css_class: post.data.author_flair_css_class,
        username: post.data.author,
    } );

    if( post.data.replies && post.data.replies.kind && post.data.replies.kind === 'Listing' ){
        for( let i = 0; i < post.data.replies.data.children.length; i = i + 1 ){
            users = users.concat( getUsersInPost( post.data.replies.data.children[ i ] ) );
        }
    }

    return users;
};

const loadRedditPage = function loadRedditPage ( id, after, page ) {
    return new Promise( ( resolve, reject ) => {
        let url = `https://www.reddit.com/r/${ id }.json`;
        let users = [];

        if ( after ) {
            url = `${ url }?count=${ POSTS_PER_PAGE * page }&after=${ after }`;
        }

        console.log( `Getting reddit page ${ page + 1 } for r/${ id }` );
        loadPage( url )
            .then( ( topicBody ) => {
                const posts = JSON.parse( topicBody );
                const xhrList = [];

                for ( let i = 0; i < posts.data.children.length; i = i + 1 ) {
                    users.push( {
                        author_flair_text: posts.data.children[ i ].data.author_flair_text,
                        author_flair_css_class: posts.data.author_flair_css_class,
                        username: posts.data.children[ i ].data.author,
                    } );

                    let xhr = loadPage( `https://www.reddit.com${ posts.data.children[ i ].data.permalink }.json` )
                        .then( ( commentsBody ) => {
                            const replies = JSON.parse( commentsBody );

                            for ( const replyIndex in replies[ 1 ].data.children ) {
                                users = users.concat( getUsersInPost( replies[ 1 ].data.children[ replyIndex ] ) );
                            }
                        } )
                        .catch( ( error ) => {
                            console.log( error.message );
                        } );

                    xhrList.push( xhr );
                }

                Promise.all( xhrList )
                    .then( () => {
                        resolve( {
                            users: users,
                            after: posts.data.after,
                        } );
                    } )
                    .catch( ( error ) => {
                        console.log( error.message );
                    } );
            } )
            .catch( ( error ) => {
                console.log( error.message );
            } );
    } );
};

const filter = function filter ( users, game, developers ){
    let accountCache = [];
    let flairs = flair[ game ];

    return users.filter( ( user ) => {
        if( accountCache.indexOf( user.username ) > -1 ){

            return false;
        }

        if( developers.indexOf( user.username ) > -1 ){

            return false;
        }

        if( flairs ){
            if ( !user[ flairs.type ] ) {

                return false;
            }

            // Skip everything with a flair we've setup to skip
            if ( flairs.list && flairs.list.indexOf( user[ flairs.type ].toLowerCase() ) > -1 ) {

                return false;
            }
        }

        accountCache.push( user.username );

        return true;
    } );
};

const getReddit = function getReddit( subreddit, pages ){
    let page = 0;
    let allUsers = [];

    const getUsers = function getUsers ( subreddit, next, currentPage ){
        return new Promise( ( loadResolve, loadReject ) => {
            loadRedditPage( subreddit, next, currentPage )
                .then( ( response ) => {
                    page = page + 1;
                    allUsers = allUsers.concat( response.users );

                    if ( page < pages ){
                        getUsers( subreddit, response.after, page )
                            .then( ( allUsers ) => {
                                loadResolve( allUsers );
                            } )
                            .catch( ( error ) => {
                                console.log( error.message );
                            } );
                    } else {
                        loadResolve( allUsers );
                    }
                } )
                .catch( ( error ) => {
                    console.log( error.message );
                } );
        } );
    };

    return new Promise( ( resolve, reject ) => {
        getUsers( subreddit, false, 0 )
            .then( ( users  ) => {
                resolve( users );
            } )
            .catch( ( error ) => {
                console.log( error.message );
            } );
    } );
};

module.exports = {
    filter: filter,
    get: getReddit,
};
