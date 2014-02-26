var Tree = require('../tree'),
  accounts = require('./accounts');

var tree = Tree.fromArray(accounts);

//console.log(tree);
tree.prettyPrint();
