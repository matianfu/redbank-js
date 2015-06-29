/**
 * New node file
 */

var a = function() {
  console.log(arguments.length);
  console.log(arguments[0]);
  console.log(arguments[1]);
  console.log(arguments[2]);
  arguments[3] = 10;
  console.log(arguments[3]);
};

a(1, 2, 3);
