var accounts = require('./accounts.json'),
  crypto = require('crypto'),
  util = require('util');

//console.log(accounts);

// make root of tree a dummy account to simplify things
accounts.push({ user: 'dummy', balance: 0 });

var total = 0;
accounts.forEach(function (account) {
  total += account.balance;
});

console.log('Total balance: ' + total);

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

function build_tree (accounts) {
  if (!accounts.length) {
    return;
  }

  var tree = accounts.pop();
  var middle = Math.ceil(accounts.length / 2);
  var left_arr = accounts.slice(0, middle);
  var right_arr = accounts.slice(middle, accounts.length);

  tree.left = build_tree(left_arr, tree);
  tree.right = build_tree(right_arr, tree);

  // make sure the last level is full. no lonely leafs
  if (tree.left && !tree.right) {
    // security: can be used to determine your are a leaf node?? maybe would be better
    // to fill up the leaves from left to right so that there only needs to be one placeholder node
    tree.right = { user: 'dummy', balance: 0 };
  }

  if (tree.left) {
    tree.left.parent = tree;
    tree.right.parent = tree;
  }

  return tree;
}

function node_combiner ( node, left_node, right_node ) {
  node.value = left_node.value + right_node.value;
  node.hash = sha256(left_node.value + right_node.value + '' + left_node.hash + '' + right_node.hash);
}

function generate_hashes (tree) {
  // leaf nodes
  if (!tree.left) {
    tree.value = tree.balance;
    tree.hash = sha256(tree.user);
    return;
  }

  if (!tree.left.hash) {
    generate_hashes(tree.left);
  }

  if (tree.right && !tree.right.hash) {
    generate_hashes(tree.right);
  }

  node_combiner(tree, tree.left, tree.right);
}

// let's make root should a dummy account since a normal user
//accounts.shift();

var tree = build_tree(accounts);

//console.log(util.inspect(tree, { depth: null }));

generate_hashes(tree);

console.log(util.inspect(tree, { depth: null }));


var some_user = tree.left.left;

console.log('---');

console.log('User: ' + some_user.user);
console.log('Balance: ' + some_user.balance);
console.log('User hash: ' + some_user.hash);
console.log('Root hash: ' + tree.hash);
console.log('Root value: ' + tree.value);

console.log('---');

console.log('Verification tree: ');

function generate_verification_tree (node) {
  var format = function (node) {
    return {
      value: node.value,
      hash: node.hash
    };
  };

  // at root
  if (!node.parent) {
    return format(node);
  }

  var left = node.parent.left;
  var right = node.parent.right;

  var n = {
    parent: generate_verification_tree(node.parent),
    left: format(left),
    right: format(right)
  };
  n.parent.value = node.parent.value;
  n.parent.hash = node.parent.hash;

  return n;
}

function verify_tree (veriftree) {
  if (!veriftree.parent) {
    return true;
  }

  var parent = veriftree.parent;
  var expected_parent = {};
  node_combiner(expected_parent, veriftree.left, veriftree.right);

  if (parent.value === expected_parent.value && parent.hash === expected_parent.hash) {
    return verify_tree(veriftree.parent);
  }
  else {
    console.log('expected parent:');
    console.log(expected_parent.value);
    console.log(expected_parent.hash);
    console.log('got parent:');
    console.log(parent.value);
    console.log(parent.hash);
    return false;
  }
}

var veriftree = generate_verification_tree(some_user);

console.log(util.inspect(veriftree, { depth: null }));

console.log('Verifiying tree...');
if (verify_tree(veriftree)) {
  console.log('Tree is valid');
}
else {
  console.log('Tree is invalid');
}
