// Blind solvency prover

var bsolp = require('../lib/bsolp'),
  accounts = require('./accounts.json');

var private_tree = bsolp.generatePrivateTree(accounts);

function format (node) {
  var data = node.data;
  //return 'value: ' + data.value + ', hash: ' + data.hash;
  return data.value + ', ' + data.hash;
}

console.log('Private tree: ');
private_tree.prettyPrint(format);

console.log('Root hash: ' + private_tree.root().data.hash);
console.log('Root value: ' + private_tree.root().data.value);

console.log('Extracting tree for mark: ');

var public_tree = bsolp.extractPublicTree(private_tree, 'mark');

public_tree.prettyPrint(format);
