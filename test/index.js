var should = require('should'),
  fs = require('fs'),
  blproof = require('../'),
  Tree = blproof.Tree,
  crypto = require('crypto');

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

function parseConfig(name){
    var data = fs.readFileSync( __dirname  + "/data/" + name);
    return JSON.parse(data);
}

function verifyTreeForUser(accounts, user){
    console.log("accounts: ", JSON.stringify(accounts));
    var complete_tree = blproof.generateCompleteTree(accounts);
    var root = complete_tree.root()
    console.log("root: ", root.data);
    var partialTree = blproof.extractPartialTree(complete_tree, user);
    console.log("partial_tree:", partialTree.serialize());
    var response = {"id":"EmptyGox BTC liabilities", "partial_tree": JSON.parse(partialTree.serialize())}
    
    should.ok(root.data.value);
    // TODO try ptree.fromObjectGraph
    //var Tree = blproof.Tree;
    //var ptree = new Tree();
    //ptree.fromObjectGraph(partialTree);
    var ptree = blproof.deserializePartialTree(JSON.stringify(response));
    
    should.ok(blproof.verifyTree(ptree, root.data));
}
// Regression tests
//
// @TODO: unit tests, cli tests, etc.


describe('Generating complete tree', function () {
  var accounts = parseConfig('accounts.json');
  describe ('building a complete tree from data/accounts.json file', function () {
    var complete_tree = blproof.generateCompleteTree(accounts);
    console.log("root: ", complete_tree.root().data);
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
    complete_tree = Tree.deserializeFromArray(complete_tree);

    it('complete tree should deserialize', function () {
      should.ok(complete_tree instanceof Tree);
    });

    it('should have 33 nodes', function () {
      should.equal(complete_tree.nodeCount(), 33);
    });

    accounts.forEach(function (account) {
      describe('extracting partial tree for ' + account.user, function () {
        var partial_tree, user_node;
        it('should return a tree', function () {
          partial_tree = blproof.extractPartialTree(complete_tree, account.user);
          should.ok(partial_tree instanceof Tree);
        });

        it('its root node should not contain data', function () {
          should.equal(partial_tree.root().data, undefined);
        });

        it('its interior nodes should have no data', function () {
          partial_tree.traverse(function (node) {
            var left = partial_tree.left(node);
            if (left) {
              should.equal(node.data, undefined);
            }
          });
        });

        it('there should be only one node with user/nonce data', function () {
          var nodes = [];
          partial_tree.traverse(function (node) {
            if (node.data && node.data.user) {
              nodes.push(node);
            }
          });
          should.equal(nodes.length, 1);
          user_node = nodes[0];
        });

        it('the user node should be a leaf node', function () {
          should.equal(partial_tree.left(user_node), undefined);
          should.equal(partial_tree.right(user_node), undefined);
        });

        it('the user node should have a sibling', function () {
          var sibling = partial_tree.sibling(user_node);
          should.ok(sibling);
          should.notEqual(sibling.data.value, undefined);
          should.notEqual(sibling.data.hash, undefined);
        });

        describe('verification', function () {
          var root_data, user_data;

          it('succeeds', function () {
            root_data = complete_tree.root().data;
            user_data = blproof.verifyTree(partial_tree, root_data);
            should.ok(user_data);
          });

          it('should not mutate partial tree', function () {
            should.equal(partial_tree.root().data, undefined);
          });

          it('throws with incorrect root', function () {
            should.throws(function () {
              blproof.verifyTree(partial_tree, {});
            }, /mismatch/);
          });

          it('returns expected data', function () {
            should.equal(user_data.user, account.user);
            should.equal(user_data.value, account.value);
          });
        });

        describe('serialization', function () {
          var serialized, deserialized, obj;

          it('should return a string', function () {
            serialized = blproof.serializePartialTree(partial_tree);
            should.equal(typeof serialized, 'string');
          });

          it('should parse as valid JSON', function () {
            obj = JSON.parse(serialized);
          });

          it('should have a valid structure', function () {
            var root = obj.partial_tree;
            should.equal(typeof obj, 'object');
            should.equal(typeof root, 'object');
            should.equal(typeof root.right, 'object');
            should.equal(typeof root.left, 'object');
            should.equal(typeof root.data, 'undefined');
          });

          it('should deserialized correctly', function () {
            deserialized = blproof.deserializePartialTree(serialized);
            should.ok(deserialized instanceof Tree);
          });

          it('should verify', function () {
            root_data = complete_tree.root().data;
            user_data = blproof.verifyTree(deserialized, root_data);
          });
        });
      });
    });
    //var partial_tree = blproof.extractPartialTree(complete_tree, user);
    //console.log(blproof.serializePartialTree(partial_tree, program.id));

  });
});

describe('NonRegression', function () {
    describe ('add new tests based on new issue', function () {
        it('VerifyAccountsOk', function () {
            var accounts = parseConfig('accounts.json');
            var user = "mark";
            verifyTreeForUser(accounts, user);
        });
        it('VerifyAccounts2Ok', function () {
            var accounts = parseConfig('accounts_2.json');
            var user = "alice@nomail.com"
                verifyTreeForUser(accounts, user)
        });

        it('Idempotent', function () {
            var accounts = parseConfig('accounts.json');
            var complete_tree1 = blproof.generateCompleteTree(accounts);
            console.log("Root1: ", complete_tree1.root().data);
            var complete_tree2 = blproof.generateCompleteTree(accounts);
            console.log("Root2: ", complete_tree2.root().data);
            //TODO should be equal ?
        });
    })
})