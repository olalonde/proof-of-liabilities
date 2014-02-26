blind-solvency-proof
====================

My attempt at implementing gmaxwell's "prove-how-(non)-fractional-your-Bitcoin-reserves-are scheme" https://iwilcox.me.uk/v/nofrac. Some discussion here: http://www.reddit.com/r/Bitcoin/comments/1yzil4/i_implemented_gmaxwells/

This is a proof of concept and not recommended for production yet. I
might also rename the project to blind-libability-proof to avoid
confusion as this is what it really does.

## Usage

```
# Create private merkle tree from an accounts file (see
# test/account.json for format)

$ ./cli.js privatetree -f test/accounts.json --human
$ ./cli.js privatetree -f test/accounts.json > private.json

# Extract public tree for user mark.

$ ./cli.js publictree mark -f private.json --human
$ ./cli.js publictree mark -f private.json > mark.json

# Display root node hash and value

$ ./cli.js root -f private.json --human

# Verify public tree

$ ./cli.js verify --hash SLpDal8kYJNdLwczp6wrU68FOFrpoHT3w5nd15HOpwU= --value 37618 -f mark.json
```


## Some sample outputs

```
test$ node ./bsolp.js

Private tree:

37618, SLpDal8kYJNdLwczp6wrU68FOFrpoHT3w5nd15HOpwU=
 |_ 24614, uI5UdCraTo11wXQBED8hLN3VQnAPEZGRxMBC65NHfwU=
 | |_ 21072, jG3EVyBXVbVDWmELKyN6Bhr+tcJg73zkvanchWiWAuc=
 | | |_ 4167, tyHBvBgE8dzl1wZPrhJ7s3xrHE8NqOBHT5Gfyneop4U=
 | | | |_ 122, fBKXXjlikszxj1pP3vKf0BWTj9yeFTs+cuc+TAzqJwo=
 | | | | |_ 39, einstein
 | | | | |_ 83, picasso
 | | | |_ 4045, olalonde
 | | |_ 16905, z0AQfe2Xv+ZmZWaB6Cl4Tn1nixpf4KSnQoadl+KKjj4=
 | |   |_ 6905, gmaxwell
 | |   |_ 10000, satoshi
 | |_ 3542, 3EXM/8Q8JAJihU3nX3AdD1WgkXDrNeQgh0MRBJ6k60k=
 |   |_ 3327, HbDV2lywYbZlXiTmx27PU5YjAHMPAr6rKlIjFfEgxBg=
 |   | |_ 300, luke-jr
 |   | |_ 3027, sipa
 |   |_ 215, TxnypBHTR+aXh6ozKd5pnicdlEcBfVNLuXvuZb8cUhU=
 |     |_ 200, codeshark
 |     |_ 15, gribble
 |_ 13004, iaMffeZYdyGXcP4VKA5NIBWQeAlz8b2am4m7GR4pL8A=
   |_ 9901, GHuVUeCtEsr0o1PzDzEzNds6Qf1B334hKErZI9KybqE=
   | |_ 12, ReggpH0fv+rmTnLX3sfqLx21rEdoLaD5zJqst5C/ncM=
   | | |_ 0, alice
   | | |_ 12, bob
   | |_ 9889, SQswAyEUWZ5VoAwhIirvyE3IKDy+b64pZU9ZBv3sWT4=
   |   |_ 9427, charlie
   |   |_ 462, mark
   |_ 3103, SBk/MZZOWokTzs3K36ncgNoipsfi8Ua/LnPfoUemQts=
     |_ 3032, o+rBE22dMf3jI0SVGajIxt4a6ImyJq9V1cmvk9eSmhI=
     | |_ 12, anax
     | |_ 3020, gavin
     |_ 71, aRFnO4wgjO3q4qgbF3pqvkSlZHKQQAx+UnBviwAo84M=
       |_ 68, stacy
       |_ 3, justin

Root hash: SLpDal8kYJNdLwczp6wrU68FOFrpoHT3w5nd15HOpwU=
Root value: 37618
Extracting tree for mark:

37618, SLpDal8kYJNdLwczp6wrU68FOFrpoHT3w5nd15HOpwU=
 |_ 24614, uI5UdCraTo11wXQBED8hLN3VQnAPEZGRxMBC65NHfwU=
 |_ 13004, iaMffeZYdyGXcP4VKA5NIBWQeAlz8b2am4m7GR4pL8A=
   |_ 9901, GHuVUeCtEsr0o1PzDzEzNds6Qf1B334hKErZI9KybqE=
   | |_ 12, ReggpH0fv+rmTnLX3sfqLx21rEdoLaD5zJqst5C/ncM=
   | |_ 9889, SQswAyEUWZ5VoAwhIirvyE3IKDy+b64pZU9ZBv3sWT4=
   |   |_ 9427, charlie
   |   |_ 462, mark
   |_ 3103, SBk/MZZOWokTzs3K36ncgNoipsfi8Ua/LnPfoUemQts=
```
