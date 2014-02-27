../cli.js completetree -f accounts.json --human;
../cli.js completetree -f accounts.json > complete.out.json;
../cli.js partialtree mark -f complete.out.json --human;
../cli.js partialtree mark -f complete.out.json > mark.out.json;
../cli.js root -f complete.out.json --human;
../cli.js verify --hash "9zP/CEGEgrLtsU8DRW25SwAO9bOaPm03RTlarjzhDPs=" --value 37618 -f mark.out.json;
