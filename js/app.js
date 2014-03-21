var complete_tree;
var partial_trees = {};

// dirty hack to prepopulate verify tab
var n = 0;
function twice(fn) {
  if (n === 2) return;
  n++;
  fn();
}

function error (e, tab) {
  $('#' + tab + '_results').hide(); 
  $('#' + tab + ' .flash h4').html(e.name || 'Error');
  $('#' + tab + ' .flash p').html(e.message || e);
  $('#' + tab + ' .flash').show(); 
}

function serialize (obj) {
  return JSON.stringify(obj, undefined, 2);
}

function format (obj) {
  data = obj.data;
  if (!data) return '';

  var res = '';
  var sep = '';
  ['user', 'nonce', 'sum', 'hash'].forEach(function (prop) {
    if (prop in data) {
      res += sep;
      if (prop === 'user') {
        res += '<span class="label label-primary">' + data[prop] + '</span>';
      }
      else if (prop === 'nonce') {
        res += '<span class="label label-default">' + data[prop] + '</span>';
      }
      else {
        res += data[prop];
      }
      sep = ', ';
    }
  });
  return res;
}

var route = (function () {
  function parse_hash (hash) {
    var action = 'generate', params = {};
    var parts = hash.substr(1).split('?');

    action = parts[0] || action;

    parts = parts[1] ? parts[1].split('&') : [];
    parts.forEach(function (keyval) {
      keyval = keyval.split('=');
      keyval = keyval.map(function (val) { return decodeURIComponent(val); });

      params[keyval[0]] = keyval[1];
    });

    return {
      hash: hash,
      action: action,
      params: params
    };
  }

  function route (hash) {
    console.log('routing ' + hash);
    var req = parse_hash(hash);

    // scroll to top if action changed
    //if (!window.lastReq || window.lastReq.action !== req.action) {
    var scrollmem = $('body').scrollTop();
    $('html,body').scrollTop(scrollmem);
    //}

    // Activate nav link
    //$('.navbar-nav li').removeClass('active');
    $('.navbar-nav li a[href="#' + req.action +'"]').tab('show'); //.parent().addClass('active');

    // set form inputs
    for (var key in req.params) {
      $('#' + key).val(req.params[key]);
      //console.log('$("#' + key + '").trigger("change")');
      $('#' + key).trigger('change');
    }

    // automatically "click" verify button if "shared link"
    if (req.action === 'verify' && req.params.partial_tree && req.params.expected_root) {
      $('#btn_verify').trigger('click');
    }

    history.pushState(null, null, req.hash);
    window.lastReq = req;
  }

  return route;
})();

function reqToURL (req) {
  var url = '#' + req.action;

  var qstrings = [];
  for (var key in req.params) {
    var val = req.params[key];
    qstrings.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
  }
  console.log(qstrings);

  url = (qstrings) ? url + '?' + qstrings.join('&') : url;

  return url;
}

// Update "share" links
$(function () {
  $('#generate-share').on('click', function (e) {
    e.preventDefault();
    window.location.hash = reqToURL({
      action: 'generate',
      params: { accounts: $('#accounts').val() }
    });
  });
  $('#verify-share').on('click', function (e) {
    e.preventDefault();
    window.location.hash = reqToURL({
      action: 'verify',
      params: {
        partial_tree: $('#partial_tree').val(),
        expected_root: $('#expected_root').val()
      }
    });
  });

  //$('#accounts').on('change', function () {
    //$('#generate-share').attr('href', reqToURL({
      //action: 'generate',
      //params: { accounts: $(this).val() }
    //}));
  //});

  //$('#partial_tree, #expected_root').on('change', function () {
    //$('#verify-share').attr('href', reqToURL({
      //action: 'verify',
      //params: {
        //partial_tree: $('#partial_tree').val(),
        //expected_root: $('#expected_root').val()
      //}
    //}));
  //});

});

// Generate
$(function () {
  $('input[name="format"]').on('change', function () {
    var format = this.value;
    $('.pretty').toggle();
    $('.json').toggle();
  });

  $('.json').toggle();

  $('#btn_generate').on('click', function (e) {
    e.preventDefault();
    $('#generate .flash').hide();

    complete_tree = null;
    partial_trees = {};

    var accounts;

    try {
      accounts = JSON.parse($('#accounts').val());
    }
    catch (err) {
      error(err, 'generate');
    }

    complete_tree = blproof.generateCompleteTree(accounts);

    var root = complete_tree.root();

    //@hack
    twice(function () {
      $('#expected_root').html(blproof.serializeRoot(complete_tree));
    });

    $('#complete_tree').html(serialize(complete_tree));
    $('#complete_tree_pretty').html(complete_tree.prettyPrintStr(format));
    $('#root').html(blproof.serializeRoot(complete_tree));

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
    $('#partial_tree_for_pretty').html(partial_tree.prettyPrintStr(format));
    //@hack
    twice(function () {
      $('#partial_tree').html(serialize(serialized));
    });
  });
});

// Verify
$(function () {
  $('#btn_verify').on('click', function (e) {
    e.preventDefault();
    $('#verify .flash').hide();

    var res;
    var html = '';

    try {
      var partial_tree = blproof.deserializePartialTree($('#partial_tree').val());
      var expected_root = blproof.deserializeRoot($('#expected_root').val());

      res = blproof.verifyTree(partial_tree, expected_root);
    }
    catch (err) {
      html += '<h4>Verification failed!</h4>';
      html += err.message;

      $('#verification').removeClass('alert-success').addClass('alert-danger').html(html);
      $('#verify_results').show();
      return;
    }

    html += '<h4>Verification successful!</h4>';
    html += 'User: ' + res.user;
    html += '<br>';
    html += 'Balance: ' + res.sum;

    $('#verification').removeClass('alert-danger').addClass('alert-success').html(html);
    $('#verify_results').show();
  });
});

// Prettify
$(function () {
  $('#btn_prettify').on('click', function (e) {
    e.preventDefault();
    $('#prettify .flash').hide();

    var ugly_json = $('#ugly_json').val();

    var partial_tree, pretty_json;

    try {
      pretty_json = JSON.stringify(JSON.parse(ugly_json), null, 2);
      $('#pretty_json').html(pretty_json);
    }
    catch (err) {
      $('#pretty_json').html('');
      error(err, 'prettify');
    }

    try {
      partial_tree = blproof.deserializePartialTree($('#ugly_json').val());
      $('#pretty_tree').html(partial_tree.prettyPrintStr(format));
      $('#pretty_tree').show();
    }
    catch (err) {
      $('#pretty_tree').hide();
    }
  });
});

// Hash changes + navigation
$(function() {
  $('.navbar-nav a[href^="#"]').on('click', function (e) {
    e.preventDefault();
    route($(this).attr('href'));
    return false;
  });

  $(window).on('hashchange', function (e) {
    e.preventDefault();
    route(window.location.hash);
    return false;
  });

  route(window.location.hash);
});

$(function () {
  if ($('#accounts').val().trim() === '') {
    $.get('accounts.json', function (data) {
      $('#accounts').html(data);

      $('#btn_generate').trigger('click');
    }, 'text');
  }
  else {
    $('#btn_generate').trigger('click');
  }
});
