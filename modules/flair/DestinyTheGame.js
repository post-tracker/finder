module.exports = {
    getFlairs: function getFlairs () {
        const flairList = [];
        const sIndexLimit = 7;
        const primaryLimit = 7;
        const secodaryLimit = 7;

        for ( let flairIndex = 0; flairIndex < this.list.length; flairIndex = flairIndex + 1 ) {
            flairList.push( this.list[ flairIndex ] );

            for ( let sIndex = 0; sIndex <= sIndexLimit; sIndex = sIndex + 1 ) {
                for ( let primaryIndex = 0; primaryIndex <= primaryLimit; primaryIndex = primaryIndex + 1 ) {
                    for ( let secondaryIndex = 0; secondaryIndex <= secodaryLimit; secondaryIndex = secondaryIndex + 1 ) {
                        flairList.push( `SS${ sIndex } ${ primaryIndex }-${ secondaryIndex } ${ this.list[ flairIndex ] }` );
                    }
                }
            }
        }

        return flairList;
    },
    list: [
        '3oclego',
        '77adinfinitum',
        '8bithunter',
        '8bittitan',
        '8bitwarlock',
        'abaeterno',
        'abraxas',
        'abraxasii',
        'agentofthenine',
        'aksor',
        'alchemistcast',
        'anchorsend',
        'arc',
        'archershope',
        'archivistsseal',
        'array',
        'ascendantraisins',
        'aspectofblood',
        'aspectofdust',
        'aspectofshadow',
        'atheon',
        'babyghaul',
        'badgeofthemonarchy',
        'badgeofthemonarchyii',
        'badgeofthepatron',
        'badgeofthepatronii',
        'banner1',
        'banner2',
        'banner3',
        'banner4',
        'banner5',
        'bdayboy',
        'beachdreg',
        'bindingfocus',
        'blacktiger',
        'bladedancer',
        'bladeofcrota',
        'blessingofiv',
        'blessingoftheancients',
        'blessingofthegifted',
        'blessingofthejoined',
        'blessingoftheknight',
        'blessingofthesentinel',
        'blessingoftheskeptic',
        'blessingofthespeaker',
        'blessingoftheunmade',
        'blessingoftheunmadealt',
        'blessingofthewatcher',
        'blessingofthezealot',
        'blessingofworlds',
        'bombsquad',
        'bombsquadalt',
        'bombsquadii',
        'bombsquadiialt',
        'bornoffire',
        'bountytracker',
        'bungieday01',
        'bungieday02',
        'bungieday03',
        'bungieday04',
        'bungieday05',
        'bungieday06',
        'bungieday07',
        'bungieday08',
        'bungieday09',
        'bungieday10',
        'bungieday11',
        'bungieday12',
        'bungieday13',
        'bungieday14',
        'bungieday15',
        'bungieday16',
        'bungieday17',
        'bungieday18',
        'bungieday19',
        'bungieday20',
        'bungieday21',
        'bungieday22',
        'bungieday23',
        'bungieday24',
        'bungieday25',
        'bungieday26',
        'bungieday27',
        'bungieday28',
        'bungieday29',
        'bungieday30',
        'bungieday31',
        'bungieday32',
        'caballogo',
        'caluscheese',
        'calusrobot',
        'carnagezone',
        'cassoid',
        'cassoidalt',
        'cityforce',
        'command',
        'commandercrest',
        'commandii',
        'concordat',
        'crestofthegravesinger',
        'crota',
        'crotacheese',
        'crotasend',
        'crotaseye',
        'crotashand',
        'crotasheart',
        'crotasmight',
        'crownofthenewmonarchy',
        'crownofthesovereign',
        'crucible',
        'cruciblehandler',
        'cruciblequartermaster',
        'cruxlomar',
        'cryptarch',
        'cryptoshift',
        'cryptoshiftii',
        'cyclopsmind',
        'cyclopsmindii',
        'daito',
        'dancingguardian',
        'darkharvest',
        'dawnofdestiny',
        'dcflair',
        'deadorbit',
        'deadorbitv',
        'deadzonememento',
        'defender',
        'destiny01',
        'destiny02',
        'destiny03',
        'destiny04',
        'destiny05',
        'destiny06',
        'destiny07',
        'destiny08',
        'destiny09',
        'destiny10',
        'destiny11',
        'destiny12',
        'destiny13',
        'destiny14',
        'destiny15',
        'destiny16',
        'destiny17',
        'destiny18',
        'destiny19',
        'destiny20',
        'destiny21',
        'destiny22',
        'destiny23',
        'destiny24',
        'destiny25',
        'destiny26',
        'destiny27',
        'destiny28',
        'destiny29',
        'destiny30',
        'dinklebotgif',
        'doug',
        'dragoon',
        'draksis',
        'e347',
        'eaglematt',
        'earthborn',
        'ebj',
        'echoofshatteredsuns',
        'echoofshatteredsunsalt',
        'edb',
        'efaof',
        'eflow',
        'egh',
        'ehl',
        'ehm',
        'eib',
        'einv',
        'elementofthedeadsun',
        'elementoftheshifter',
        'elow',
        'emc',
        'emeraldrook',
        'emida',
        'emperorsigil',
        'enc',
        'engram',
        'enlb',
        'epat',
        'epi',
        'eplanc',
        'eplanc',
        'erd',
        'eris',
        'erismorn',
        'es99',
        'esga',
        'esr',
        'et',
        'et4th',
        'etl',
        'etlw',
        'etruth',
        'eur',
        'everversegiving',
        'evm',
        'executorsredmark',
        'exostranger',
        'eyeofeternity',
        'eyeofosiris',
        'fallenlogo',
        'fieldoflight',
        'firenfeathers',
        'flamesofforgottentruth',
        'forsaken',
        'foundersseal',
        'fromherethestars',
        'futurewarcultv',
        'fuzzle',
        'fwc',
        'gatheryourfireteam',
        'gengolgotha',
        'gengolgothaalt',
        'gengolgothaii',
        'gengolgothaiialt',
        'gorgon',
        'grimoirewriter',
        'guardianlord',
        'guardianoutfitter',
        'gunslinger',
        'gunsmith',
        'heartofthefoundation',
        'hexacon4',
        'hivelogo',
        'holidaycryptarch',
        'honeybeeiv',
        'honorofblades',
        'hu00e4kke',
        'hunger',
        'hunterclapping',
        'hunterlogo',
        'huntervanguard',
        'illusionoflight',
        'iryut',
        'jaderabbitinsignia',
        'limacat',
        'lonefocusjaggededge',
        'lordsaladin',
        'mammoth',
        'mammothii',
        'mentorsbadge',
        'mgs',
        'moonofosiris',
        'mormu',
        'mspaintoryx',
        'mspaintsekrion',
        'nadir',
        'newmonarchy',
        'ninja',
        'norsebdaywolf',
        'norseflair',
        'noteofconquest',
        'officercrest',
        'ogreraisins',
        'omenofchaos',
        'omenofchaosii',
        'omenofthedead',
        'omenofthedeadii',
        'omenofthedecayer',
        'omenoftheexodus',
        'omnigal',
        'omolon',
        'osiris',
        'owlsector',
        'pathfindersign',
        'phogoth',
        'postmaster',
        'princesigil',
        'prohibitive',
        'psionflayers',
        'purpleboom',
        'queen',
        'queensbro',
        'queensemissary',
        'queensguardcrest',
        'regal',
        'resurrectionist',
        'revolver',
        'riksis',
        'risinglight',
        'rose',
        'runeoftheadept',
        'runeofthedisciple',
        'runeofthemachine',
        'runeofthemachinealt',
        'runeoftheoracle',
        'saint14ship',
        'salt',
        'sardok',
        'sardon',
        'scarofradegast',
        'scholarsquest',
        'sekrion',
        'septiks',
        'sevenseraphs',
        'seventhcolumn',
        'seventhcolumn7',
        'seventhcolumnred',
        'sgtwarchicken',
        'shaaull',
        'shelteredtruthalt',
        'shelteredtruthii',
        'shelteredtruthiialt',
        'sherpa',
        'shield1',
        'shield2',
        'shieldofheroes',
        'shieldoflegends',
        'shieldofmythics',
        'shieldoftheknight',
        'shieldofthewarlord',
        'shipwright',
        'sigilofdeviance',
        'sigilofnight',
        'sigilofseven',
        'sigilofsevenalt',
        'sigiloftheburningdawn',
        'sigilofthecomingwar',
        'sigiloftheeternalnight',
        'sigiloftheironlords',
        'sigilofthewarcultii',
        'signofcontainment',
        'signofduality',
        'signoftheancients',
        'signofthebattleborn',
        'signoftheelders',
        'signofthefinite',
        'signofthefounders',
        'signoftheprotectorate',
        'signofunity',
        'simiks',
        'skynet',
        'sleeper',
        'smikis',
        'snackdad',
        'snoo1',
        'soffish',
        'solar',
        'solprogeny',
        'songofthespheres',
        'spacesquirrel',
        'specialorders',
        'spookypumpkin',
        'sq',
        'starantigen',
        'starofmoderation',
        'starwolf',
        'stormcaller',
        'story',
        'strike',
        'striker',
        'sunbreaker',
        'sunofosiris',
        'sunsinger',
        'suros',
        'swarmprince',
        'sweeperbotpin',
        'symbolofthemagister',
        'symbolofthesorcerer',
        'symbolofthewolf',
        'taaruc',
        'taaurc',
        'telthor',
        'texmechanica',
        'thaaurn',
        'theconvergence',
        'theinnerchamber',
        'theinnercircle',
        'theobelisk',
        'theobeliskii',
        'thereflectiveproof',
        'therising',
        'therisingnight',
        'thespeaker',
        'theundyinglight',
        'theunimaginedplane',
        'thewindingpath',
        'thoriumleaf',
        'tigerman',
        'tipofthespear',
        'titanlogo',
        'titanvanguard',
        'transcendence',
        'undyingmind',
        'unionoflight',
        'urzok',
        'userresearch',
        'valorindarkness',
        'vanguardhonor',
        'vanguardhonoralt',
        'vanguardinsignia',
        'vanguardquartermaster',
        'veterancrest',
        'vexlogo',
        'vextemplar',
        'victoryeagleii',
        'void',
        'voidstalker',
        'voidwalker',
        'warlocklogo',
        'warlocksunsinger',
        'warlockvanguard',
        'winterbornmark',
        'wolfsgrin',
        'woodhouse',
        'worlddomination',
        'zarafwc',
        'zydron',
    ],
    type: 'author_flair_css_class',
};
