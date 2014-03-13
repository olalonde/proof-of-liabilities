var should = require('should'),
  fs = require('fs'),
  blproof = require('../'),
  Tree = blproof.Tree,
  crypto = require('crypto');

var accounts = require('./data/accounts.json');

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

// Regression tests
//
// @TODO: unit tests, cli tests, etc.

describe('Generating complete tree', function () {
  describe ('building a complete tree from data/accounts.json file', function () {
    var complete_tree = blproof.generateCompleteTree(accounts);

    it('returns an instance of Tree', function () {
      should.ok(complete_tree instanceof Tree);
    });

    it('should have 33 nodes', function () {
      should.equal(complete_tree.nodeCount(), 33);
    });

    it('should have a unique hash for each node', function () {
      var dups = {};
      complete_tree.traverse(function (node) {
        should.equal(dups[node.data.hash], undefined);
        dups[node.data.hash] = node;
      });
    });

    describe('when retrieving the root node', function () {
      var root = complete_tree.root();
      it('should exist', function () {
        should.ok(root);
      });
      it('should have index 0', function () {
        should.equal(root.index, 0);
      });
      it('should have a hash', function () {
        should.ok(root.data.hash);
      });
      it('should have a value', function () {
        should.ok(root.data.value);
      });
      it('its value should equal 37618', function () {
        should.equal(root.data.value, 37618);
      });
    });

    describe('when retrieving mark\'s node', function () {
      var mark_node = complete_tree.reverseLevelSearch(function (node) {
        if (node.data && node.data.user === 'mark') {
          return node;
        }
      });

      it('should exist', function () {
        should.ok(mark_node);
      });

      it('should have the correct value/username', function () {
        should.equal(mark_node.data.user, 'mark');
        should.equal(mark_node.data.value, 462);
      });

      it('should have a nonce', function () {
        should.ok(mark_node.data.nonce);
      });

      it('should have a hash', function () {
        should.ok(mark_node.data.hash);
      });

      it('its hash should equal sha256(user + \'|\' + value + \'|\' + nonce)', function () {
        var data = mark_node.data;
        var expected_hash = sha256(data.user + '|' + data.value + '|' + data.nonce);
        should.equal(mark_node.data.hash, expected_hash);
      });
    });
  });

  describe('Extracting partial trees from data/complete_tree.json', function () {
    var complete_tree = fs.readFileSync(__dirname + '/data/complete_tree.json', 'utf8');
    
    it('complete tree should deserialize', function () {
      complete_tree = Tree.deserializeFromArray(complete_tree);
      should.ok(complete_tree instanceof Tree);
    });

    it('should have 33 nodes', function () {
      should.equal(complete_tree.nodeCount(), 33);
    });

    accounts.forEach(function (account) {
      describe('extracting partial tree for ' + account.user, function () {
        var partial_tree;
        it('should return a tree', function () {
          partial_tree = blproof.extractPartialTree(complete_tree, account.user);
          should.ok(partial_tree instanceof Tree);
        });
      });
    });
    //var partial_tree = blproof.extractPartialTree(complete_tree, user);
    //console.log(blproof.serializePartialTree(partial_tree, program.id));

  });
});
