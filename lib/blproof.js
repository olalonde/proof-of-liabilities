var Tree = require('./tree'),
  crypto = require('crypto');

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

function nonce () {
  return Math.random();
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
  n.value = left_node.value + right_node.value;
  n.hash = sha256((left_node.value + right_node.value) +
                  '' + left_node.hash + '' + right_node.hash);
  return n;
}

// @todo: since all nodes are at same tree level, this might
// leak information about number of users. randomize tree structure!?
// add fake nodes with 0 balance? maybe all right leaf node should be a dummy user?
function generate_complete_tree (accounts) {
  // Make sure number of nodes is odd so we don't have a lonely leaf
  // simplifies some functions
  if (accounts.length % 2 === 0) accounts.push({ user: 'dummy', balance: 0 });

  // @TODO Refactor to use generate_internal_nodes function

  // Generate initial hash / value for leaf nodes
  accounts.forEach(function (account) {
    account.user = account.user;
    account.value = account.balance;
    account.nonce = nonce();
    account.hash = sha256(account.user + '|' + account.balance + '|' + account.nonce);
    delete account.balance;
  });

  // Accounts must be on the leaf nodes of the tree
  // so we need to find out how many interior nodes we should generate.
  //
  // The number of nodes n in a perfect binary tree can be found using this formula:
  // n = 2l-1 where l is the number of leaf nodes in the tree.

  var l = accounts.length; // number of leafs
  var n = 2 * l - 1; // number of nodes
  var i = n - l; // number of interior nodes

  // Fill beginning of the array with "interior nodes"
  var arr = (new Array(i)).concat(accounts);

  var tree = Tree.fromArray(arr);
  //console.log(tree);

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

  //console.log(path);
  // we have the path from the node to the root
  // now we need to make sure the sibling of each node
  // is selected as well
  path.forEach(function (node) {
    // We don't need to save the node's data
    // along the root path since it can and should be computed 
    // when doing the verification.
    //
    // @see https://github.com/olalonde/blind-liability-proof/issues/12
    if (node.data.user === user) {
      delete node.data.hash; //this should be computed at verification
    }
    else {
      delete node.data;
    }
    var sibling = partial_tree.sibling(node);
    if (sibling) {
      selected_nodes.push(partial_tree.sibling(node));
    }
  });

  // We have now selected all relevant nodes, we can delete
  // the irrelevant nodes
  partial_tree.slice(selected_nodes);

  // Make sure we hide all other leaf node's private data
  partial_tree.traverse(function (n) {
    // every node except user's node
    if (n === node) return;
    if (!n.data) return;

    // replace node by a copy
    // so we don't modify the node in other trees.. ugly hack, I know
    partial_tree.insert({
      value: n.data.value,
      hash: n.data.hash
    }, n.index);
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
      node.data.hash = sha256(node.data.user + '|' + node.data.value + '|' + node.data.nonce);
    }
  });
}

function verify_tree (tree, expected_root_data) {
  if (!tree)
    throw new Error('You must provide the partial tree as a first argument.');

  if (!expected_root_data)
    throw new Error('You must provide expected root data hash as a second argument.');

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
  if (!(root_data.value === expected_root_data.value && root_data.hash === expected_root_data.hash)) {
    throw new Error('Root mismatch. Expected ' + 
                    JSON.stringify(expected_root_data) + 
                    ', got ' + JSON.stringify(root_data.hash));
  }

  // Verify that there are no negative balances
  tree.reverseLevelTraverse(function (node) {
    // There is a negative balance!
    if (node.data.value < 0) {
      throw new Error('Negative balance detected!');
    }
  });

  return user_node.data;
}

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

module.exports.Tree = Tree;
module.exports.generateCompleteTree = generate_complete_tree;
module.exports.extractPartialTree = extract_partial_tree;
module.exports.serializePartialTree = serialize_partial_tree;
module.exports.deserializePartialTree = deserialize_partial_tree;
module.exports.verifyTree = verify_tree;
