/**
 * Modules
 */
var JSInterpreter = require("./interpreter.js");
var Esprima_Main = require("./esprima.js");
var ESCodegen_Main = require("./escodegen.js");
var Redbank = require("./redbank.js");

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
var test_cases = [ {
  name : "one_line_literal",  //  0
  text : '1000;',
}, {
  name : "one_line_expr_add", //  1
  text : '2 + 3;',
}, {
  name : "one_line_expr_add_and_mul", // 2
  text : '2 + 3 * 5',
}, {
  name : "one_line_complex_add_and_mul",  // 3
  text : '((2 + 3) * 5 + 5 * (7 + 2)) * 3',
}, {
  name : "var_declare",       // 4
  text : 'var a;'
}, {
  name : "var_declare_and_assign", // 5
  text : 'var a; a = 10;',
}, {
  name : "var_assign",
  text : 'var a; var b; a = 10; b = a;'  // 6
}, {
  name : "var_add_literal",
  text : 'var a; a = 10; var b; b = a + 5;'  // 7
}, {
  name : "var_declare_and_init_literal",  // 8
  text : 'var a = 10;'
} ]

var source = test_cases[7].text;

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

Redbank.compile_and_run(ast);
