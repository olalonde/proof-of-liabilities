var complete_tree;
var partial_trees = {};

function err (e) {
  $('#generate_results').hide(); 
  $('#flash h4').html(e.name || 'Error');
  $('#flash p').html(e.message || e);
  $('#flash').show(); 
}

function serialize (obj) {
  return JSON.stringify(obj, undefined, 2);
}

$(function () {
  $('input[name="format"]').on('change', function () {
    var format = this.value;
    $('.pretty').toggle();
    $('.json').toggle();
  });

  $('#btn_generate').on('click', function (e) {
    e.preventDefault();

    complete_tree = null;
    partial_trees = {};

    var accounts;

    try {
      accounts = JSON.parse($('#accounts').html());
    }
    catch (e) {
      err(e);
    }

    //err('not implemented');
    complete_tree = blproof.generateCompleteTree(accounts);

    var root = complete_tree.root();

    $('#complete_tree').html(serialize(complete_tree));
    $('#complete_tree_pretty').html(complete_tree.prettyPrint());
    $('#root').html(serialize(root.data));
    
    // Populate select
    var html = '';
    accounts.forEach(function (account) {
      html += '<option>';
      html += account.user;
      html += '</option>';
    });
    $('#select_account').html(html);
    $('#select_account').trigger('change');

    $('#generate_results').show();
  });

  $('#select_account').on('change', function () {
    var user = this.value;
    var partial_tree = partial_trees[user];
    if (!partial_tree) {
      partial_tree = blproof.extractPartialTree(complete_tree, user);
      partial_trees[user] = partial_tree;
    }
    var serialized = JSON.parse(blproof.serializePartialTree(partial_tree));
    $('#partial_tree_for').html(serialize(serialized));
    $('#partial_tree_for_pretty').html(partial_tree.prettyPrint());
  });
});

$(function () {
  $.get('accounts.json', function (data) {
    $('#accounts').html(data);
    $('#btn_generate').trigger('click');
  }, 'text');
});

