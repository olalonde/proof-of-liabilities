var Tree = require('./tree'),
  crypto = require('crypto');

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

function nonce () {
  return Math.random();
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

  // Generate initial hash / value for leaf nodes
  accounts.forEach(function (account) {
    account.value = account.balance;
    account.user = account.user; //sha256(account.user);
    account.nonce = nonce();
    account.hash = sha256(account.user + '' + account.nonce); //sha256(account.user);
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
    return (node.data.user === user);
  });

  if (!node) throw new Error('Could not find node with user: ' + user);

  var path = partial_tree.extractPath(node);
  var selected_nodes = path.slice(0);

  //console.log(path);
  // we have the path from the node to the roor
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

  // Hide neighbooring node's private information (user and nonce)
  var sibling = partial_tree.sibling(node);
  delete sibling.user;
  delete sibling.nonce;

  return partial_tree;
}

// @TODO: regenerate user's hash using supplied user / nonce values
// @TODO: make sure all values are >= 0
function verify_tree (tree, expected_root_data) {

  // @TODO refactor all following verification code to a library function
  if (!tree)
    throw new Error('You must provide the partial tree as a first argument.');

  if (!expected_root_data) 
    throw new Error('You must provide expected root data hash as a second argument.');

  var root = tree.root();
  var data = {};

  // Make sure root matches
  if (root.data.value !== expected_root_data.value || root.data.hash !== expected_root_data.hash) {
    var err = 'Root mismatch!\n';
    err += 'Expected:\n';
    err += JSON.stringify(expected_root_data);
    err += '\n';
    err += 'Got:';
    err += '\n';
    err += JSON.stringify(root.data);
    return { error: err };
  }

  var success = true, error;
  tree.reverseLevelTraverse(function (node) {
    if (!node) return;

    // If this is the user's node, make sure its hash is valid
    if (node.data.user) {
      var expected_hash = sha256(node.data.user + '' + node.data.nonce);
      if (expected_hash !== node.data.hash) {
        success = false;
        error = 'User\'s hash does not match hash(user + nonce).';
        return;
      }
      else {
        data = node.data;
      }
    }

    var left = tree.left(node);
    var right = tree.right(node);
    if (!left) return;

    var combined_node = combine_nodes (left.data, right.data);

    // There is a negative balance!
    if (node.data.value < 0) {
      success = false;
      error = 'Negative balance detected!';
      return;
    }

    // Check that the expected node values match the actual node values 
    if (node.data.value === combined_node.value && 
        node.data.hash === combined_node.hash) {
      // success
    }
    else {
      success = false;
    }
  });

  return { success: success, error: error, data: data };

}

module.exports.generateCompleteTree = generate_complete_tree;
module.exports.extractPartialTree = extract_partial_tree;
module.exports.verifyTree = verify_tree;
