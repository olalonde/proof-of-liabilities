//var util = require('util');

// Simple perfect binary tree implementation

var Node = function (options) {
  this.index = options.index || 0;
  this.data = options.data || null;
  //this.parent = options.parent || null;
  //this.left = null;
  //this.right = null;
};

var Tree = function () {
  this.arr = [];
};

Tree.fromArray = function (arr) {
  var tree = new Tree();
  if (Array.isArray(arr)) {
    for (var i = 0; i < arr.length; i++) {
      tree.insert(arr[i]);
    }
  }
  return tree;
};

Tree.prototype.insert = function (element, index) {
  var node;
  if (typeof index === 'number') {
    node = new Node({
      data: element,
      index: index
    });

    // expand array
    if (index >= this.arr.length) {
      this.arr.concat(new Array(index - this.arr.length + 1));
    }
    this.arr[index] = node;
  }
  else {
    node = new Node({
      data: element,
      index: this.arr.length
    });

    this.arr.push(node);
  }
};

Tree.prototype.root = function () {
  return this.arr[0];
};

Tree.prototype.getDepth = function (node) {
  var n = this.arr.length;
  if (node) {
    n = node.index + 1;
  }

  //http://stackoverflow.com/questions/3019278/any-way-to-specify-the-base-of-math-log-in-javascript
  return Math.ceil((Math.log(n + 1) / Math.log(2) - 1));
};

Tree.prototype.left = function (node) {
  return this.arr[2 * node.index + 1];
};
Tree.prototype.right = function (node) {
  return this.arr[2 * node.index + 2];
};
Tree.prototype.parent = function (node) {
  return this.arr[Math.floor((node.index - 1) / 2)];
};
Tree.prototype.sibling = function (node) {
  if (node.index % 2 === 0) {
    return this.arr[node.index - 1];
  }
  else {
    return this.arr[node.index + 1];
  }
};

function repeat(str, depth) {
  var spacing = '';
  for (var i = 0; i < depth; i++) {
    spacing += str;
  }
  return spacing;
}

Tree.prototype.prettyPrint = function (cb) {
  console.log(this.prettyPrintStr(cb));
};

Tree.prototype.prettyPrintStr = function (cb, node, spacing) {
  if (typeof cb !== 'function') {
    cb = function (node) {
      return JSON.stringify(node.data);
    };
  }
  if (!node) {
    node = this.root();
  }

  spacing = spacing || '';

  var str = '',
    depth = this.getDepth(node);

  spacing += ' ';
  //str += 'depth: ' + this.getDepth(node) + ' ';

  str += cb(node);
  if (this.left(node) || this.left(node)) {
    str += '\n';
    str += spacing + '|_ ';
    str += this.prettyPrintStr(cb, this.left(node), spacing + '|');
  }
  if (this.right(node)) {
    str += '\n';
    str += spacing + '|_ ';
    str += this.prettyPrintStr(cb, this.right(node), spacing + ' ');
  }

  return str;
};

// shallow copy
Tree.prototype.clone = function () {
  var clone = new Tree();
  clone.arr = this.arr.slice(0);
  return clone;
};

// Traverse depth first starting from root
Tree.prototype.traverse = function (cb, node) {
  node = node || this.root();

  cb(node);

  var left = this.left(node);
  var right = this.right(node);

  if (left) 
    this.traverse(cb, left);
  if (right)
    this.traverse(cb, right);
};

// Traverse nodes level by level, starting from the bottom
// Stop traversing when a callback returns false
Tree.prototype.reverseLevelTraverse = function (cb) {
  for (var i = this.arr.length - 1; i >= 0; i--) {
    if (cb(this.arr[i]) === false) {
      return false;
    }
  }
};

Tree.prototype.reverseLevelSearch = function (predicate) {
  for (var i = this.arr.length - 1; i >= 0; i--) {
    if (predicate(this.arr[i])) {
      return this.arr[i];
    }
  }
  return false;
};

// Extract the path of a node from node to end (or root)
// @return array of nodes
Tree.prototype.extractPath = function (start, end) {
  if (!end) end = this.root();

  var node = start;
  var path = [ node ];

  while (node !== end && node !== this.root()) {
    node = this.parent(node);
    path.push(node);
  }

  return path;
};

// deletes every node from tree except the nodes passed as argument
Tree.prototype.slice = function (selected_nodes) {
  var new_arr = new Array(this.arr.length);
  var max_index = 0;
  for (var i = 0; i < selected_nodes.length; i++) {
    var node = selected_nodes[i];
    if (node.index > max_index) max_index = node.index;
    new_arr[node.index] = node;
  }
  // cut out end of array
  new_arr = new_arr.slice(0, max_index + 1);
  this.arr = new_arr;
  return this;
};

// See https://github.com/olalonde/blind-solvency-proof#partial-trees
Tree.prototype.serialize = function (node) {
  var n = this.toObjectGraph();
  //console.log(util.inspect(n, {depth: null}));
  return JSON.stringify(n);
};

Tree.deserialize = function (str) {
  var tree = new Tree();
  // @TODO: browser bug when $.ajax already parses response
  var graph = JSON.parse(str);
  tree.fromObjectGraph(graph);
  return tree;
};

// internally we represent trees as an array, not as an
// object graph so we need to convert
Tree.prototype.fromObjectGraph = function (n, index) {
  index = index || 0;
  this.insert(n.data, index);
  if (n.left) {
    this.fromObjectGraph(n.left, 2 * index + 1);
  }
  if (n.right) {
    this.fromObjectGraph(n.right, 2 * index + 2);
  }
  return this;
};

Tree.prototype.toObjectGraph = function (node) {
  if (!node) node = this.root();
  var n = {};

  n.data = node.data;

  var left = this.left(node);
  var right = this.right(node);

  if (left) {
    n.left = this.toObjectGraph(left);
  }
  if (right) {
    n.right = this.toObjectGraph(right);
  }
  return n;
};

Tree.prototype.serializeToArray = function () {
  return JSON.stringify(this.arr);
};

Tree.deserializeFromArray = function (str) {
  var tree = new Tree();
  tree.arr = JSON.parse(str);
  return tree;
};

module.exports = Tree;
