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
  .command('completetree')
  .description('Generates complete proof tree. Must specify accounts file. See test/accounts.json for format.')
  .action(function () {
    if (!program.file) program.help();

    var accounts = JSON.parse(fs.readFileSync(program.file));
    var complete_tree = bsolp.generateCompleteTree(accounts);

    if (program.human) {
      complete_tree.prettyPrint(format);
    }
    else {
      console.log(complete_tree.serialize());
    }
  });

program
  .command('partialtree <user>')
  .description('Extracts the partial proof tree for a given user. Must specify complete proof tree file.')
  .action(function (user) {
    if (!program.file) program.help();
    if (!user) program.help();

    var complete_tree = Tree.deserialize(fs.readFileSync(program.file));
    var partial_tree = bsolp.extractPartialTree(complete_tree, user);

    if (program.human) {
      partial_tree.prettyPrint(format);
    }
    else {
      console.log(partial_tree.serialize());
    }
  });

program
  .command('root')
  .description('Extracts root node from tree. Must specify complete proof tree file.')
  .action(function () {
    if (!program.file) program.help();

    var complete_tree = Tree.deserialize(fs.readFileSync(program.file));
    var root = complete_tree.root();

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
  .description('Verify a partial proof tree. Must specify root hash and value. Must specify the partial proof tree file.')
  .option('--hash <hash>', 'Hash of root node')
  .option('--value <value>', 'Value of root node', parseFloat)
  .action(function (action) {
    if (!program.file) program.help();

    var tree = Tree.deserialize(fs.readFileSync(program.file));

    var root = tree.root();

    var root_data = { value: action.value, hash: action.hash };

    var result = bsolp.verifyTree(tree, root_data);

    if (result.success) {
      console.log('Partial tree verified successfuly!');
      console.log('Your user is ' + result.data.user + 
                  ' and your balance is ' + result.data.value);
      // @TODO: show user and value
    }
    else {
      console.log('INVALID partial tree!');
      if (result.error) {
        console.log(result.error);
      }
      process.exit(-1);
    }
  });

program.parse(process.argv);
