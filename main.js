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
  'var a = 1000;  '

// var interpreter = JSInterpreter.BuildInterpreter(simple_function);
// interpreter.run();

//stepArrayExpression
//stepAssignmentExpression
//stepBinaryExpression
//stepBreakStatement
//stepBlockStatement
//stepCallExpression
//stepConditionalExpression
//stepContinueStatement
//stepDoWhileStatement
//stepEmptyStatement
//stepEval_
//stepExpressionStatement
//stepForInStatement
//stepForStatement
//stepFunctionDeclaration
//stepFunctionExpression
//stepIdentifier
//stepIfStatement
//stepLabeledStatement
//stepLiteral
//stepLogicalExpression
//stepMemberExpression
//stepNewExpression
//stepObjectExpression
//stepProgram
//stepReturnStatement
//stepSequenceExpression
//stepSwitchStatement
//stepThisExpression
//stepThrowStatement
//stepUnaryExpression
//stepUpdateExpression
//stepVariableDeclaration
//stepVariableDeclarator
//stepWhileStatement

var Esprima_Main = require("./esprima.js");
var ESCodegen_Main = require("./escodegen.js");

var ast = Esprima_Main.parse(source);
var ast_json = JSON.stringify(ast, null, 2);
console.log(ast_json);

var generated = ESCodegen_Main.generate(ast, undefined);

console.log(generated);





		