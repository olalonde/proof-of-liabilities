var Tree = require('./tree'),
  crypto = require('crypto'),
  helpers = require('./helpers'),
  Big = require('big.js');

// monkey patch Big to disable exponent notation when calling toSring
// exponent notation is not allowed by specification
Big.prototype.toString = helpers.bigToString;


function big(val) {
  return (val instanceof Big) ? val : new Big(val);
}

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function nonce () {
  // @TODO: 128 bits of randomness!?
  // Javascript floating numbers are represented with 64 bit IIRC
  // The following code will probably make cryptographers want to tear their
  // eyes out.
  var randomness = Math.random() + '' + Math.random();
  var hex = sha256(randomness);
  // 128 bits can be represented with 32 hex characters
  return hex.substr(0, 32);
}

// http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
function clone (obj) {
  if (null === obj || "object" != typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }
  return copy;
}

function combine_nodes (left_node, right_node) {
  var n = {};
  n.sum = big(left_node.sum).plus(right_node.sum);
  n.hash = sha256(n.sum + '' + left_node.hash + '' + right_node.hash);
  return n;
}

function generate_leaf_hash (user, sum, nonce) {
  return sha256(user + '|' + big(sum) + '|' + nonce);
}

// @todo: since all nodes are at same tree level, this might
// leak information about number of users. randomize tree structure!?
// add fake nodes with 0 balance? maybe all right leaf node should be a dummy user?
function generate_complete_tree (accounts) {
  var mode = 'default';

  // first account has nonce set triggers deterministic mode
  if (accounts[0].nonce) {
    mode = 'deterministic';
  }

  // Generate deterministic tree
  if (mode === 'deterministic') {
    // Pad out accounts to get a power of 2 to get a perfect binary tree
    var next_power_of_2 = 0;
    // Find next power of 2
    for (var i = 0; next_power_of_2 < accounts.length; i++) {
      next_power_of_2 = Math.pow(2, i);
    }
    while (accounts.length < next_power_of_2) {
      accounts.push({ user: 'dummy', balance: '0', nonce: '0' });
    }
  }

  // Generate initial hash / sum for leaf nodes
  accounts.forEach(function (account) {
    // switch to test mode if the accounts JSON has a nonce set
    if (account.nonce) mode ='test';

    account.user = account.user;
    account.sum = big(account.balance);
    // make it possible to specify nonce in account.json for testing implementations
    account.nonce = '' + (account.nonce || nonce());
    account.hash = generate_leaf_hash(account.user, account.sum, account.nonce);
    delete account.balance;
  });

  // Accounts must be on the leaf nodes of the tree
  // so we need to find out how many interior nodes we should generate.
  //
  // The number of nodes n in a complete binary tree can be found using this formula:
  // n = 2l-1 where l is the number of leaf nodes in the tree.

  var l = accounts.length; // number of leafs
  var n = 2 * l - 1; // number of nodes
  var i = n - l; // number of interior nodes

  // Fill beginning of the array with "interior nodes"
  var arr = (new Array(i)).concat(accounts);

  var tree = Tree.fromArray(arr);

  tree.reverseLevelTraverse(function (node) {
    if (!node.data) {
      node.data = combine_nodes(tree.left(node).data, tree.right(node).data);
    }
  });

  return tree;
}

function extract_partial_tree (complete_tree, user) {
  // shallow!? clone complete tree and remove irrelevant nodes
  var partial_tree = complete_tree.clone();

  var node = partial_tree.reverseLevelSearch(function (node) {
    if (node.data.user === user) {
      return node;
    }
  });

  if (!node) throw new Error('Could not find node with user: ' + user);

  var path = partial_tree.extractPath(node);
  var selected_nodes = path.slice(0);

  // we have the path from the node to the root
  // now we need to make sure the sibling of each node
  // is selected as well
  path.forEach(function (node) {
    var sibling = partial_tree.sibling(node);
    if (sibling) {
      selected_nodes.push(partial_tree.sibling(node));
    }
  });

  // We have now selected all relevant nodes, we can delete
  // the irrelevant nodes
  partial_tree.slice(selected_nodes);

  // Make sure we remove all unnecessary data
  // @see https://github.com/olalonde/blind-liability-proof/issues/12
  partial_tree.traverse(function (n) {
    // every node except user's node
    var minimal_data;
    // user's node
    if (n === node) {
      minimal_data = {
        user: n.data.user,
        sum: n.data.sum,
        nonce: n.data.nonce
      };
    }
    // interior node
    else if (partial_tree.left(n)) {
      minimal_data = null;
    }
    else {
      minimal_data = {
        sum: n.data.sum,
        hash: n.data.hash
      };
    }

    // replace node by a copy
    // so we don't modify the node in other trees.. ugly hack, I know
    partial_tree.insert(minimal_data, n.index);
  });

  return partial_tree;
}

function generate_internal_nodes (tree) {
  tree.reverseLevelTraverse(function (node) {
    var left = tree.left(node);
    var right = tree.right(node);
    // internal nodes
    if (left && right) {
      node.data = combine_nodes(left.data, right.data);
    }
    // leaf nodes
    else if (!node.data.hash) {
      node.data.hash = generate_leaf_hash(node.data.user, node.data.sum, node.data.nonce);
    }
  });
}

function verify_tree (tree, expected_root_data) {
  if (!tree)
    throw new Error('You must provide the partial tree as a first argument.');

  if (!expected_root_data)
    throw new Error('You must provide expected root data hash as a second argument.');

  tree = tree.clone();

  var user_node = tree.reverseLevelSearch(function (node) {
    if (node.data && node.data.user) {
      return node;
    }
  });

  // Verify that there is a user node
  if (!user_node) {
    throw new Error('Could not find any user node!');
  }

  generate_internal_nodes(tree);

  // Verify that root is correct
  var root_data = tree.root().data;

  if (big(root_data.sum).eq(expected_root_data.sum) && root_data.hash === expected_root_data.hash) {
    // root is correct!
  }
  else {
    throw new Error('Root mismatch. Expected ' +
                    JSON.stringify(expected_root_data) +
                    ', got ' + JSON.stringify(root_data));
  }

  // Verify that there are no negative balances
  tree.reverseLevelTraverse(function (node) {
    // There is a negative balance!
    if (node.data.sum < 0) {
      throw new Error('Negative balance detected!');
    }
  });

  return user_node.data;
}

// @TODO: make sure to use big()'s stringification for numbers
// @TODO: maybe refactor all this to have a consistent .serialize method on tree objects / nodes?
function serialize_partial_tree (ptree, id) {
  var obj = {
    id: id,
    partial_tree: ptree.toObjectGraph()
  };
  return JSON.stringify(obj);
}

function deserialize_partial_tree (str) {
  var tree = new Tree();
  var graph = JSON.parse(str).partial_tree;
  tree.fromObjectGraph(graph);
  return tree;
}

function serialize_root (complete_tree, id) {
  var obj = {
    id: id,
    root: complete_tree.root().data
  };
  return JSON.stringify(obj);
}

function deserialize_root (str) {
  return JSON.parse(str).root;
}

module.exports.Tree = Tree;
module.exports.generateCompleteTree = generate_complete_tree;
module.exports.extractPartialTree = extract_partial_tree;
module.exports.serializePartialTree = serialize_partial_tree;
module.exports.deserializePartialTree = deserialize_partial_tree;
module.exports.serializeRoot = serialize_root;
module.exports.deserializeRoot = deserialize_root;
module.exports.verifyTree = verify_tree;
