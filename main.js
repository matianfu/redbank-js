/**
 * New node file
 */

var JSInterpreter = require("./interpreter.js");

var hello = 'print("Hello World")';
var simple_function = 
  'var a = function() {    ' +
  '  print("hello world"); ' +
  '};                      ' +
  'a();'

var interpreter = JSInterpreter.BuildInterpreter(simple_function);

interpreter.run();
		
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
		
		
		