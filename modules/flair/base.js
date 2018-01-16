module.exports = {
    isDev: function isDev ( user ) {
        if ( !user[ this.type ] ) {
            return false;
        }

        if ( this.list.includes( user[ this.type ] ) ) {
            return false;
        }

        return true;
    },
};
