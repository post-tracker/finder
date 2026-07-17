const net = require( 'net' );

// Minimal dependency-free Redis client — just the GET / SETEX this cache needs,
// spoken as raw RESP over a socket. Adding ioredis would mean a new production
// dependency + lockfile churn for two commands, so we talk the protocol directly
// (the rest of the stack's Redis is the same server; keys are namespaced to avoid
// collisions). Every op opens a short-lived connection and resolves gracefully to
// a miss/no-op on ANY error, so Redis being briefly unreachable NEVER breaks a
// finder run — it just falls back to a live profile fetch, exactly as before.
const DEFAULT_URL = 'redis://redis:6379';
const CONNECT_TIMEOUT_MS = 2000;

const parseRedisUrl = function parseRedisUrl ( rawUrl ) {
    try {
        const parsed = new URL( rawUrl || DEFAULT_URL );

        return {
            host: parsed.hostname || 'redis',
            port: Number( parsed.port ) || 6379,
        };
    } catch ( parseError ) {
        return {
            host: 'redis',
            port: 6379,
        };
    }
};

// Encode a command as a RESP array of bulk strings. Byte-length matters, so use
// Buffer.byteLength for the length prefixes (identifiers can carry non-ASCII).
const encodeCommand = function encodeCommand ( args ) {
    let out = `*${ args.length }\r\n`;

    for ( let i = 0; i < args.length; i = i + 1 ) {
        const value = String( args[ i ] );

        out = `${ out }$${ Buffer.byteLength( value ) }\r\n${ value }\r\n`;
    }

    return out;
};

// Read one RESP reply well enough for GET/SETEX: simple strings (+OK), errors
// (-ERR ...), integers (:1), bulk strings ($5\r\nhello) and null bulk ($-1).
// Operates on a Buffer because RESP length prefixes are BYTE counts — slicing a
// decoded string by those counts corrupts any multibyte value (e.g. a persona
// name with non-ASCII characters).
const parseReply = function parseReply ( buffer ) {
    if ( !buffer || buffer.length === 0 ) {
        return null;
    }

    const type = String.fromCharCode( buffer[ 0 ] );
    const firstLineEnd = buffer.indexOf( '\r\n' );
    const firstLine = buffer.slice( 1, firstLineEnd ).toString( 'utf8' );

    if ( type === '+' || type === ':' ) {
        return firstLine;
    }

    if ( type === '-' ) {
        return null;
    }

    if ( type === '$' ) {
        const length = Number( firstLine );

        if ( length < 0 ) {
            return null;
        }

        const start = firstLineEnd + 2;

        return buffer.slice( start, start + length ).toString( 'utf8' );
    }

    return null;
};

const runCommand = function runCommand ( args ) {
    return new Promise( ( resolve ) => {
        const { host, port } = parseRedisUrl( process.env.REDIS_URL );
        const socket = net.createConnection( { host: host, port: port } );
        let raw = Buffer.alloc( 0 );
        let settled = false;

        const finish = function finish ( value ) {
            if ( settled ) {
                return;
            }

            settled = true;
            socket.destroy();
            resolve( value );
        };

        socket.setTimeout( CONNECT_TIMEOUT_MS );
        socket.on( 'timeout', () => finish( null ) );
        socket.on( 'error', () => finish( null ) );

        socket.on( 'connect', () => {
            socket.write( encodeCommand( args ) );
        } );

        socket.on( 'data', ( chunk ) => {
            raw = Buffer.concat( [ raw, chunk ] );

            // Every reply we issue is single-line-terminated or a single bulk
            // string; once we have a CRLF we can parse. For a bulk string we
            // also need its full payload (byte count), so wait until the
            // declared length has arrived before resolving.
            const firstLineEnd = raw.indexOf( '\r\n' );

            if ( firstLineEnd === -1 ) {
                return;
            }

            if ( String.fromCharCode( raw[ 0 ] ) === '$' ) {
                const declaredLength = Number( raw.slice( 1, firstLineEnd ).toString( 'utf8' ) );

                if ( declaredLength >= 0 && raw.length < firstLineEnd + 2 + declaredLength + 2 ) {
                    return;
                }
            }

            finish( parseReply( raw ) );
        } );
    } );
};

module.exports = {
    // Returns the cached string, or false on a miss / any error.
    async get ( key ) {
        try {
            const value = await runCommand( [ 'GET', key ] );

            return value === null ? false : value;
        } catch ( getError ) {
            return false;
        }
    },

    // Store with a TTL (seconds). Best-effort: never throws, never blocks a run.
    async setex ( key, ttlSeconds, value ) {
        try {
            await runCommand( [ 'SETEX', key, String( ttlSeconds ), value ] );
        } catch ( setError ) {
            // Swallow — a failed cache write just means the next run refetches.
        }

        return true;
    },
};
