// slightly modified version of https://github.com/MikeMcl/big.js/blob/master/big.js#L834
module.exports.bigToString = function  () {
  var x = this,
  e = x['e'],
  str = x['c'].join(''),
  strL = str.length;

  // Negative exponent?
  if ( e < 0 ) {
    // Prepend zeros.
    for ( ; ++e; str = '0' + str ) {
    }
    str = '0.' + str;

    // Positive exponent?
  } else if ( e > 0 ) {

    if ( ++e > strL ) {

      // Append zeros.
      for ( e -= strL; e-- ; str += '0' ) {
      }
    } else if ( e < strL ) {
      str = str.slice( 0, e ) + '.' + str.slice(e);
    }

    // Exponent zero.
  } else if ( strL > 1 ) {
    str = str.charAt(0) + '.' + str.slice(1);
  }

  // Avoid '-0'
  return x['s'] < 0 && x['c'][0] ? '-' + str : str;
};
