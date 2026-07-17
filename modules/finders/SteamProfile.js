const loadPage = require( '../load.js' );
const redisCache = require( '../redis-cache.js' );

// A Steam account's persona name and SteamID64 for a given identifier are
// effectively immutable, so cache resolved values in Redis (shared with the
// rest of the stack, survives finder restarts/redeploys) to stop re-fetching
// all ~300 tracked accounts' profile XML every run — that repeated fetching is
// what trips Steam's 429/403 datacenter-IP rate limiting. A HIT means zero HTTP.
// Positive results live a long time; a MISS (unresolvable vanity, or a transient
// 429/403) is cached briefly so we retry soon instead of hammering on every run.
const POSITIVE_TTL_SECONDS = 30 * 24 * 60 * 60;
const NEGATIVE_TTL_SECONDS = 6 * 60 * 60;

// Sentinel stored for a resolved-to-nothing lookup, so a cached miss is
// distinguishable from a cache miss (never fetched). Kept short + unlikely.
const MISS_SENTINEL = '\u0000__MISS__';

// Resolve a Steam account identifier (SteamID64 or vanity) to its current
// persona name and/or SteamID64 via the profile XML, so feed authors (display
// names) and forum posters (SteamID64s) can be matched against tracked
// accounts. Ported from the indexer's SteamFeed so the finder is the single
// Steam discovery service. Profile-XML lookups are rate-limited (429/403) from
// a datacenter IP, so results are cached (see redis-cache) and callers should
// still only resolve the CURRENT game's few accounts, never a large list.
class SteamProfile {
    // Wrap a resolver in the Redis cache: return the cached value on a hit
    // (including a cached miss → false), otherwise resolve live and store the
    // result with the appropriate TTL. Any cache error falls through to a live
    // fetch, so Redis being down never breaks resolution — just loses the speedup.
    static async cached ( cacheKey, resolver ) {
        const hit = await redisCache.get( cacheKey );

        if ( hit === MISS_SENTINEL ) {
            return false;
        }

        if ( hit !== false ) {
            return hit;
        }

        const value = await resolver();

        if ( value ) {
            await redisCache.setex( cacheKey, POSITIVE_TTL_SECONDS, value );

            return value;
        }

        await redisCache.setex( cacheKey, NEGATIVE_TTL_SECONDS, MISS_SENTINEL );

        return false;
    }

    // Persona display name (matches announcement RSS authors).
    static async resolvePersonaName ( userIdentifier ) {
        return SteamProfile.cached( `finder:steam:persona:${ userIdentifier }`, async () => {
            const profileUrl = ( /^\d+$/ ).test( userIdentifier )
                ? `https://steamcommunity.com/profiles/${ userIdentifier }/?xml=1`
                : `https://steamcommunity.com/id/${ userIdentifier }/?xml=1`;

            let profileXml = false;

            try {
                profileXml = await loadPage( profileUrl );
            } catch ( profileLoadError ) {
                console.log( `[SteamProfile] failed to load profile ${ profileUrl }: ${ profileLoadError.message }` );
            }

            if ( !profileXml ) {
                return false;
            }

            const match = profileXml.match( /<steamID>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/steamID>/ );

            return match ? match[ 1 ].trim() : false;
        } );
    }

    // SteamID64 (matches forum posters derived from data-miniprofile). Numeric
    // identifiers already ARE SteamID64s; vanity names resolve via the XML.
    static async resolveSteamId64 ( userIdentifier ) {
        if ( ( /^\d+$/ ).test( userIdentifier ) ) {
            return userIdentifier;
        }

        return SteamProfile.cached( `finder:steam:steamid64:${ userIdentifier }`, async () => {
            let profileXml = false;

            try {
                profileXml = await loadPage( `https://steamcommunity.com/id/${ userIdentifier }/?xml=1` );
            } catch ( profileLoadError ) {
                console.log( `[SteamProfile] failed to load profile for ${ userIdentifier }: ${ profileLoadError.message }` );
            }

            if ( !profileXml ) {
                return false;
            }

            const match = profileXml.match( /<steamID64>([0-9]+)<\/steamID64>/ );

            return match ? match[ 1 ] : false;
        } );
    }
}

module.exports = SteamProfile;
