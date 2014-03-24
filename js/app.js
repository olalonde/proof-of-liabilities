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
function toggle_format(format) {
  format = (this.value) ? this.value : format;
  $('.' + format).show();
  $('.' + format).siblings().hide();
}

$(function () {
  $('input[name="format"]').on('change', toggle_format);

  toggle_format('d3');

  //$('input[name="format"]').trigger('change');

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

    complete_tree = lproof.generateCompleteTree(accounts);

    var root = complete_tree.root();

    //@hack
    twice(function () {
      $('#expected_root').html(lproof.serializeRoot(complete_tree));
    });

    $('#complete_tree').html(serialize(complete_tree));
    $('#complete_tree_pretty').html(complete_tree.prettyPrintStr(format));
    d3ize('#complete_tree_d3', complete_tree);
    $('#root').html(lproof.serializeRoot(complete_tree));

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
      partial_tree = lproof.extractPartialTree(complete_tree, user);
      partial_trees[user] = partial_tree;
    }
    var serialized = JSON.parse(lproof.serializePartialTree(partial_tree));
    $('#partial_tree_for').html(serialize(serialized));
    $('#partial_tree_for_pretty').html(partial_tree.prettyPrintStr(format));
    d3ize('#partial_tree_for_d3', partial_tree);
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
      var partial_tree = lproof.deserializePartialTree($('#partial_tree').val());
      var expected_root = lproof.deserializeRoot($('#expected_root').val());

      res = lproof.verifyTree(partial_tree, expected_root);
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

function d3format (node, tree) {
  var n = {};

  n.name = (node.data) ? node.data.sum : '';
  n.data = node.data;
  n.children = [];

  var left = tree.left(node);
  var right = tree.right(node);

  if (left) n.children.push(d3format(left, tree));
  if (right) n.children.push(d3format(right, tree));

  if (!n.children.length) delete n.children;

  return n;
}

function d3ize (selector, lproof_tree) {
  var width = 920, height = 500;

  // partial tree can have smaller height
  if (!lproof_tree.root().data) {
    height = height / 3;
  }

  $(selector).empty();
  var svg = d3.select(selector)
    .append('svg:svg')
      .attr('width', width)
      .attr('height', height);

  var tree = d3.layout.tree().size([height, width - 220]);

  var node_data = d3format(lproof_tree.root(), lproof_tree);

  var nodes = tree.nodes(node_data);

  //var nodes = tree.nodes({
   //"name": "flare",
   //"children": [
    //{
     //"name": "analytics",
     //"children": [
      //{
       //"name": "cluster",
       //"children": [
        //{"name": "AgglomerativeCluster", "size": 3938},
        //{"name": "CommunityStructure", "size": 3812},
        //{"name": "MergeEdge", "size": 743}
       //]
      //},
      //{
       //"name": "graph",
       //"children": [
        //{"name": "BetweennessCentrality", "size": 3534},
        //{"name": "LinkDistance", "size": 5731}
       //]
      //}
     //]
    //}
   //]
  //});
  var links = tree.links(nodes);

  console.log(nodes);
  console.log(links);

  var diagonal = d3.svg.diagonal().projection(function (d) {
    return [d.y, d.x];
  });

  var link = svg.selectAll('pathlink')
    .data(links)
    .enter()
      .append('svg:path')
        .attr('class', 'link')
        .attr('d', diagonal);

  var node = svg.selectAll('g.node')
    .data(nodes)
    .enter()
      .append('svg:g')
      .attr('transform', function (d) {
        return 'translate(' + d.y + ',' + d.x + ')';
      });

  //node.append('svg:circle')
      //.attr('r', 3.5);

  node.each(function (n) {
    console.log('node');
    console.log(node);
  });

  node.filter(function (d) {
        return d.data;
      })
      .append('svg:text')
      //.attr('text-anchor', 'middle')
      .attr('text-anchor', function(d) {
        // root
        if (!d.parent)
          return 'start';
        // internal
        if (d.children)
          return 'middle';
        // leaf
        return 'start';
      })
      .text(function(d) {
        var str = '';
        if (d.data.user) {
          str += '' + d.data.sum;
          str += ', ';
          str += d.data.user;
          str += ', ';
          str += d.data.nonce.substr(0, 3) + '..' + d.data.nonce.substr(-3);
        }
        else {
          str += '' + d.data.sum;
          str += ', ';
          str += d.data.hash.substr(0, 3) + '..' + d.data.hash.substr(-3);
        }
        return str;
      });

}

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
      partial_tree = lproof.deserializePartialTree($('#ugly_json').val());
    }
    catch (err) {
      $('#pretty_tree').hide();
    }
    finally {
      $('#pretty_tree').html(partial_tree.prettyPrintStr(format));
      $('#pretty_tree').show();
      d3ize('#pretty_d3', partial_tree);
      $('#pretty_d3').show();
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
