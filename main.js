/**
 * New node file
 */

var JSInterpreter = require("./interpreter.js");

var hello = 'print("Hello World")';
var simple_function = 
  'var a = function(x) {   ' +
  '  var b = x;            ' +
  '  var c = function(x) { ' +
  '    return x;     ' +
  '  };                    ' +
  '  c(b);                 ' +
  '};                      ' +
  'a("hello world");'
  
var source = 
  'var a = 1000;  ' +
  'function b(x) {' +
  '  return x;    ' +
  '};' 

var src_one_literal = 
  '1000;'

var src_add_literal = '2 + 3 * 5;'
  
var src_expr_literal_ellipsis = '((2 + 3) * 5 + 5 * (7 + 2)) * 3'

var Y = function(F) {
  return (function(x) {
    return F(function(y) {
      return x(x)(y);
    });
  })(function(x) {
    return F(function(y) {
      return x(x)(y);
    });
  });
};  
  
var src_y_combinator = 
'var Y = function(F) {          ' +
'  return (function(x) {        ' +
'    return F(function(y) {     ' +
'      return x(x)(y);          ' +
'    });                        ' +
'  })(function(x) {             ' +
'    return F(function(y) {     ' +
'      return x(x)(y);          ' +
'    });                        ' +
'  });                          ' +
'};'    

var src_test_identifier = 
'var a = 42, z;                 ' +
'var b = 5;                     ' +
'function addA(d) {             ' +
'    return a + d;              ' +
'}                              ' +
'var c = addA(2) + b;           ' +
'var e = function(x) { return a + x } '

var src_assignment = 'var a; a = 10;' + ' '
//'var b = {x: 10, y: 20 }; ' +
//'b[b.x].m = 30;' 

//var factorial = function(self) {
//  return function(n) {
//    return n === 0 ? 1 : n * self(n - 1);
//  };
//};
//
//var result;
//console.log(result = Y(factorial)(4));  

var src_var_declare = 'var a;'

var src_var_declare_init = 'var a = 20;'

var source = src_one_literal;

var interpreter = JSInterpreter.BuildInterpreter(source);

interpreter.run();

var Esprima_Main = require("./esprima.js");
var ESCodegen_Main = require("./escodegen.js");


var ast = Esprima_Main.parse(source);
var ast_json = JSON.stringify(ast, null, 2);
console.log(ast_json);

var generated = ESCodegen_Main.generate(ast, undefined);

console.log(generated);

var astcompiler = require("./astcompiler.js");

var compiled = astcompiler.compile(ast);




		