/**
 * New node file
 */


function vm() {
  this.a = 10;
}

vm.prototype.hello = function() {
  console.log("world");
  console.log(this.a);
}

var b = new vm();

b.hello();

function vm2() {
  
  var a = 10;
  var b = 20;
  
  var c = function () {}; 
}