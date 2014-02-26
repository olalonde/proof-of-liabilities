#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  Tree = require('./lib/tree'),
  bsolp = require('./lib/bsolp');

function format (node) {
  var data = node.data;
  return data.value + ', ' + data.hash;
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
  .command('publictree <hash>')
  .description('Extracts public tree for a given hash. Must specify private tree file.')
  .action(function (hash) {
    if (!program.file) program.help();
    if (!hash) program.help();

    var private_tree = Tree.deserialize(fs.readFileSync(program.file));
    var public_tree = bsolp.extractPublicTree(private_tree, hash);

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

program.parse(process.argv);
