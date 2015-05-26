/**
 * Modules
 */
var JSInterpreter = require("./interpreter.js");
var Esprima_Main = require("./esprima.js");
var ESCodegen_Main = require("./escodegen.js");
var Compiler = require("./redbank_compiler.js");
var VM = require("./redbank_vm.js");

/**
 * options
 */
var output_source = false;
var run_with_jsinterpreter = false;
var output_ast = true;
var generate_source_with_escodegen = false;

/**
 * test cases
 */
var test_group_001 = [
    {
      name : "one_line_literal", // 0
      text : '1000;',
    },
    {
      name : "one_line_expr_add", // 1
      text : '2 + 3;',
    },
    {
      name : "one_line_expr_add_and_mul", // 2
      text : '2 + 3 * 5',
    },
    {
      name : "one_line_complex_add_and_mul", // 3
      text : '((2 + 3) * 5 + 5 * (7 + 2)) * 3',
    },
    {
      name : "var_declare", // 4
      text : 'var a;'
    },
    {
      name : "var_declare_and_assign", // 5
      text : 'var a; a = 10;',
    },
    {
      name : "var_assign",
      text : 'var a; var b; a = 10; b = a;' // 6
    },
    {
      name : "var_add_literal",
      text : 'var a; a = 10; var b; b = a + 5;' // 7
    },
    {
      name : "var_add_self",
      text : 'var a; a = 1; a = a + 10;' // 8
    },
    {
      name : "var_declare_and_init_literal", // 9
      text : 'var a = 10;'
    },
    {
      name : "var_declare_and_init_by_var", // 10
      text : "var a = 15; var b = a;"
    },
    {
      name : "var_declare_and_init_by_expr", // 11
      text : "var a = 15; var b = a * 10;"
    },
    {
      name : "empty_func_declaration", // 12
      text : 'var a; a = function(){}; a();'
    },
    {
      name : "empty_func_declaration", // 13
      text : 'var a; a = function(x){ var b = x;}; a(10);'
    },
    {
      name : "empty_func_declaration_ret_value", // 14
      text : 'var a; a = function(x){ var b = x; return b; }; a(10);'
    },
    {
      name : "empty_func_declaration_ret_value", // 15
      text : 'var a; a = function(x){ var b = x; return b; }; a = a(10);'
    },
    {
      name : "simple_closure", // 16
      text : 'var a = function() { var b = 23; '
          + 'return function() { b = b + 987; return b; }};'
          + 'var c = a(); c();'
    },
    {
      name : "test", // 17
      text : 'var Y=function(le) {return (function (f) {return f(f);}(function (f) {return le(function (x) {return f(f)(x);});}));};'
          + 'var factorial = Y(function (fac) { return function (n) { return n <= 2 ? n : n * fac(n - 1); }; });'

    } ]

test_group_002 = [ {
  name : "simple boolean", // 0
  text : '1 === 1'
}, {
  name : "simple if", // 1
  text : 'var a = 0; var b; if (a === 0) b = 1;'
} ]

test_group_003 = [ {
  name : "empty object assignment", // 0
  text : 'var a; a = {}'
}, {
  name : "object property assignment", // 1
  text : 'var a; a = {}; a.x = 1;'
}, {
  name : "",
  text : 'var a; a = { x: 1 };' // 2
} ]

var source = test_group_003[1].text;

if (run_with_jsinterpreter) {
  var interpreter = JSInterpreter.BuildInterpreter(source);
  interpreter.run();
}

var ast = Esprima_Main.parse(source);

if (output_ast) {
  var ast_json = JSON.stringify(ast, null, 2);
  console.log(ast_json);
}

if (generate_source_with_escodegen) {
  var generated = ESCodegen_Main.generate(ast, undefined);
  console.log(generated);
}

var bytecodes = Compiler.compile(ast);

console.log(source);

VM.run(bytecodes);

Y = function(le) {
  return (function(f) {
    return f(f);
  }(function(f) {
    return le(function(x) {
      return f(f)(x);
    });
  }));
}
