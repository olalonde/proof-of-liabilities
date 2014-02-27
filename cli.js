#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  Tree = require('./lib/tree'),
  bsolp = require('./lib/bsolp');

function format (node) {
  var data = node.data;
  // leaf nodes
  if (data.nonce) {
    return data.value + ', ' + data.user + ', ' + data.nonce + ', ' + data.hash;
  }
  else {
    return data.value + ', ' + data.hash;
  }
}

program
  .version('0.0.1')
  .usage('<action>')
  .option('-f, --file <file>', 'Which file to use.')
  .option('-h, --human', 'Print in human readable format instead of serializing.');

program
  .command('privatetree')
  .description('Generates private tree. Must specify accounts file. See test/accounts.json for format.')
  .action(function () {
    if (!program.file) program.help();

    var accounts = JSON.parse(fs.readFileSync(program.file));
    var private_tree = bsolp.generatePrivateTree(accounts);

    if (program.human) {
      private_tree.prettyPrint(format);
    }
    else {
      console.log(private_tree.serialize());
    }
  });

program
  .command('publictree <user>')
  .description('Extracts public tree for a given user. Must specify private tree file.')
  .action(function (user) {
    if (!program.file) program.help();
    if (!user) program.help();

    var private_tree = Tree.deserialize(fs.readFileSync(program.file));
    var public_tree = bsolp.extractPublicTree(private_tree, user);

    if (program.human) {
      public_tree.prettyPrint(format);
    }
    else {
      console.log(public_tree.serialize());
    }
  });

program
  .command('root')
  .description('Extracts root node from private tree. Must specify private tree file.')
  .action(function () {
    if (!program.file) program.help();

    var private_tree = Tree.deserialize(fs.readFileSync(program.file));
    var root = private_tree.root();

    if (program.human) {
      console.log('Root hash: ' + root.data.hash);
      console.log('Root value: ' + root.data.value);
    }
    else {
      console.log(JSON.stringify(root.data));
    }
  });

program
  .command('verify')
  .description('Verify a public tree. Must specify root hash + value and public tree file.')
  .option('--hash <hash>', 'Hash of root node')
  .option('--value <value>', 'Value of root node', parseFloat)
  .action(function (action) {
    if (!program.file) program.help();

    var tree = Tree.deserialize(fs.readFileSync(program.file));
    var root = tree.root();

    var expected_root_data = {
      value: action.value,
      hash: action.hash
    };

    // @TODO refactor all following verification code to a library function

    // Make sure root matches
    if (root.data.value !== expected_root_data.value || root.data.hash !== expected_root_data.hash) {
      console.error('Root mismatch!');
      console.error('Expected:');
      console.error(expected_root_data);
      console.error('Got:');
      console.error(root.data);
      process.exit();
    }

    var success = bsolp.verifyTree(tree);

    if (success) {
      console.log('Public tree verified successfuly!');
    }
    else {
      console.log('INVALID public tree!');
      process.exit(-1);
    }
  });

program.parse(process.argv);
