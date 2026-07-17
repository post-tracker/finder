const loadPage = require( '../load.js' );

// Resolve a Steam account identifier (SteamID64 or vanity) to its current
// persona name and/or SteamID64 via the profile XML, so feed authors (display
// names) and forum posters (SteamID64s) can be matched against tracked
// accounts. Ported from the indexer's SteamFeed so the finder is the single
// Steam discovery service. Profile-XML lookups are rate-limited (429/403) from
// a datacenter IP, so callers should only resolve the CURRENT game's few
// accounts, never a large cross-game list.
class SteamProfile {
    // Persona display name (matches announcement RSS authors).
    static async resolvePersonaName ( userIdentifier ) {
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
    }

    // SteamID64 (matches forum posters derived from data-miniprofile). Numeric
    // identifiers already ARE SteamID64s; vanity names resolve via the XML.
    static async resolveSteamId64 ( userIdentifier ) {
        if ( ( /^\d+$/ ).test( userIdentifier ) ) {
            return userIdentifier;
        }

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
    }
}

module.exports = SteamProfile;
