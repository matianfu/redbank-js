'use strict';

var estraverse = require('estraverse');
var esutils = require('esutils');

var Syntax = estraverse.Syntax;

var Precedence = {
  Sequence : 0,
  Yield : 1,
  Await : 1,
  Assignment : 1,
  Conditional : 2,
  ArrowFunction : 2,
  LogicalOR : 3,
  LogicalAND : 4,
  BitwiseOR : 5,
  BitwiseXOR : 6,
  BitwiseAND : 7,
  Equality : 8,
  Relational : 9,
  BitwiseSHIFT : 10,
  Additive : 11,
  Multiplicative : 12,
  Unary : 13,
  Postfix : 14,
  Call : 15,
  New : 16,
  TaggedTemplate : 17,
  Member : 18,
  Primary : 19
};

var BinaryPrecedence = {
  '||' : Precedence.LogicalOR,
  '&&' : Precedence.LogicalAND,
  '|' : Precedence.BitwiseOR,
  '^' : Precedence.BitwiseXOR,
  '&' : Precedence.BitwiseAND,
  '==' : Precedence.Equality,
  '!=' : Precedence.Equality,
  '===' : Precedence.Equality,
  '!==' : Precedence.Equality,
  'is' : Precedence.Equality,
  'isnt' : Precedence.Equality,
  '<' : Precedence.Relational,
  '>' : Precedence.Relational,
  '<=' : Precedence.Relational,
  '>=' : Precedence.Relational,
  'in' : Precedence.Relational,
  'instanceof' : Precedence.Relational,
  '<<' : Precedence.BitwiseSHIFT,
  '>>' : Precedence.BitwiseSHIFT,
  '>>>' : Precedence.BitwiseSHIFT,
  '+' : Precedence.Additive,
  '-' : Precedence.Additive,
  '*' : Precedence.Multiplicative,
  '%' : Precedence.Multiplicative,
  '/' : Precedence.Multiplicative
};

function merge(target, override) {
  var key;
  for (key in override) {
    if (override.hasOwnProperty(key)) {
      target[key] = override[key];
    }
  }
  return target;
}

function emit(x) {
  console.log(line_number++ + ' : ' + x);
}

var line_number = 0;

// Generation is done by generateExpression.
function isExpression(node) {
  return AstCompiler.Expression.hasOwnProperty(node.type);
}

// Generation is done by generateStatement.
function isStatement(node) {
  return AstCompiler.Statement.hasOwnProperty(node.type);
}

function AstCompiler() {
}

// statement

AstCompiler.Statement = {
  BlockStatement : undefined,
  BreakStatement : undefined,
  ContinueStatement : undefined,
  ClassBody : undefined,
  ClassDeclaration : undefined,
  DirectiveStatement : undefined,
  DoWhileStatement : undefined,
  CatchClause : undefined,
  DebuggerStatement : undefined,
  EmptyStatement : undefined,
  ExportDeclaration : undefined,
  ImportDeclaration : undefined,
  VariableDeclarator : undefined,
  VariableDeclaration : undefined,
  ThrowStatement : undefined,
  TryStatement : undefined,
  SwitchStatement : undefined,
  SwitchCase : undefined,
  IfStatement : undefined,
  ForStatement : undefined,
  ForInStatement : undefined,
  ForOfStatement : undefined,
  LabeledStatement : undefined,
  FunctionDeclaration : undefined,
  ReturnStatement : undefined,
  WhileStatement : undefined,
  WithStatement : undefined,
}

merge(AstCompiler.prototype, AstCompiler.Statement);

AstCompiler.Expression = {
  SequenceExpression : undefined,
  AssignmentExpression : undefined,
  ArrowFunctionExpression : undefined,
  ConditionalExpression : undefined,
  LogicalExpression : undefined,
  CallExpression : undefined,
  NewExpression : undefined,
  MemberExpression : undefined,
  UnaryExpression : undefined,
  YieldExpression : undefined,
  AwaitExpression : undefined,
  UpdateExpression : undefined,
  FunctionExpression : undefined,
  ExportBatchSpecifier : undefined,
  ArrayPattern : undefined,
  ArrayExpression : undefined,
  ClassExpression : undefined,
  MethodDefinition : undefined,
  Property : undefined,
  ObjectExpression : undefined,
  ObjectPattern : undefined,
  ThisExpression : undefined,
  Identifier : undefined,
  ImportDefaultSpecifier : undefined,
  ImportNamespaceSpecifier : undefined,
  ImportSpecifier : undefined,
  ExportSpecifier : undefined,
  GeneratorExpression : undefined,
  ComprehensionExpression : undefined,
  ComprehensionBlock : undefined,
  SpreadElement : undefined,
  TaggedTemplateExpression : undefined,
  TemplateElement : undefined,
  TemplateLiteral : undefined,
  ModuleSpecifier : undefined,
}

merge(AstCompiler.prototype, AstCompiler.Expression);

AstCompiler.prototype.generateStatement = function(stmt, flags) {
  var result, fragment;

  result = this[stmt.type](stmt, flags);
  //
  // // Attach comments
  //
  // if (extra.comment) {
  // result = addComments(stmt, result);
  // }
  //
  // fragment = toSourceNodeWhenNeeded(result).toString();
  // if (stmt.type === Syntax.Program && !safeConcatenation && newline ===
  // '' && fragment.charAt(fragment.length - 1) === '\n') {
  // result = sourceMap ? toSourceNodeWhenNeeded(result).replaceRight(/\s+$/,
  // '') :
  // fragment.replace(/\s+$/, '');
  // }
  //
  // return toSourceNodeWhenNeeded(result, stmt);
};

function fnode_visit(fnode, pre, post) {

  if (pre)
    pre(fnode);

  for (var i = 0; i < fnode.children.length; i++) {
    fnode_visit(fnode.children[i], pre, post);
  }

  if (post)
    post(fnode);
}

var indent = "";
var indent_size = 0;

function indent_incr() {
  indent = "";
  indent_size += 2;

  for (var i = 0; i < indent_size; i++) {
    indent += ' ';
  }
}

function indent_decr() {
  indent = "";
  indent_size -= 2;

  for (var i = 0; i < indent_size; i++) {
    indent += ' ';
  }
}

function astlog(x) {
  console.log(indent + x);
}

var lr_stack = [];

function expect_l(ast) {
  lr_stack.unshift({
    val : "left",
    node : ast
  });
}

function unexpect_l(ast) {

  var lr = lr_stack.shift();

  if (lr.val !== "left" || lr.node !== ast)
    throw "unexpect left not match";
}

function expect_r(ast) {
  lr_stack.unshift({
    val : "right",
    node : ast
  })
}

function unexpect_r(ast) {

  var lr = lr_stack.shift();
  if (lr.val !== "right" || lr.node !== ast)
    throw "unexpect right not match";
}

function expecting_l() {
  if (lr_stack.length === 0)
    return false;

  if (lr_stack[0].val === "left")
    return true;
  return false;
}

function expecting_r() {
  if (lr_stack.length === 0)
    return false;

  if (lr_stack[0].val === "right")
    return true;
  return false;
}

function assert_expecting_l() {
  if (lr_stack.length === 0 || lr_stack[0].val !== "left")
    throw "assert expecting left fail";
}

function assert_expecting_r() {
  if (lr_stack.length === 0 || lr_stack[0].val !== "right")
    throw "assert expecting right fail";

}

/**
 * expecting either l or r but not none.
 */
function assert_expecting_anything() {
  if (lr_stack.length === 0)
    throw "assert expecting anything fail";
}

/**
 * expecting nothing, aka, statement
 */
function assert_expecting_nothing() {
  if (lr_stack.length !== 0)
    throw "assert expect nothing fail";
}

/**
 * build the function node tree
 * 
 * @param node
 *          must be the root node of ast
 * @returns root node of function node tree
 */
function build_function_tree(node) {

  var rootnode; // the root node of tree
  var funcnode_uid = 0; // unique id
  var currentFuncNode; // iterator

  function visit(astnode, parent, prop, idx) {

    var fnode;

    // every ast node has a type property
    if (!astnode || typeof astnode.type !== "string") {
      return;
    }

    // console.log('visit: ' + astnode.type);

    function emitcode(instruction) {
      this.code.push(instruction);

      console.log('                                ..........' + instruction.op
          + ' ' + ((instruction.arg1 === undefined) ? '' : instruction.arg1)
          + ' ' + ((instruction.arg2 === undefined) ? '' : instruction.arg2)
          + ' ' + ((instruction.arg3 === undefined) ? '' : instruction.arg3));
    }

    if (astnode.type == "Program") {
      fnode = {
        uid : funcnode_uid++,
        astnode : astnode,
        parent : undefined,
        children : [],
        parameters : [],
        locals : [],
        freevars : [],
        code : [],
        emit : emitcode,
      };

      // reverse annotation for debug
      astnode.fnode = fnode;

      rootnode = fnode;
      currentFuncNode = fnode;
    }

    if (astnode.type == "FunctionDeclaration"
        || astnode.type == "FunctionExpression") {
      fnode = {
        uid : funcnode_uid++,
        astnode : astnode,
        parent : currentFuncNode,
        children : [],
        parameters : [],
        locals : [],
        freevars : [],
        code : [],
        emit : emitcode,
      };

      // reverse annotation for debug
      astnode.fnode = fnode;

      currentFuncNode.children.push(fnode);
      currentFuncNode = fnode;
    }

    for ( var prop in astnode) {
      var child = astnode[prop];

      if (Array.isArray(child)) {
        for (var i = 0; i < child.length; i++) {
          visit(child[i], astnode, prop, i);
        }
      } else {
        visit(child, astnode, prop);
      }
    }

    if (astnode.type == "FunctionDeclaration"
        || astnode.type == "FunctionExpression") {

      currentFuncNode = currentFuncNode.parent;
    }
  }

  visit(node);

  return rootnode;
}

/**
 * 
 * @param astnode
 */
function annotate(fnode) {

  var astnode = fnode.astnode;

  /**
   * check if Identifier already in local table
   */
  function find_name_in_locals(name) {
    var i;
    if (fnode.locals.length === 0)
      return false;

    for (i = 0; i < fnode.locals.length; i++) {
      if (fnode.locals[i].name === name)
        return true;
    }

    return false;
  }

  /**
   * check if Identifier already in parameter table
   */
  function find_name_in_parameters(name) {
    var i;
    if (fnode.parameters.length === 0)
      return false;

    for (i = 0; i < fnode.parameters.length; i++) {
      if (fnode.parameters[i].name === name)
        return true;
    }

    return false;
  }

  /**
   * check if Identifier already in freevar table
   */
  function find_name_in_freevars(name) {
    var i;
    if (fnode.freevars.length === 0)
      return false;

    for (i = 0; i < fnode.freevars.length; i++) {
      if (fnode.freevars[i].name === name)
        return true;
    }

    return false;
  }

  /**
   * fill fnode's parameter table
   */
  function fill_parameters(astnode) {
    var i;
    if (astnode.type === "Program")
      return;

    if (astnode.type === "FunctionDeclaration") {
      for (i = 0; i < astnode.params.length; i++) {
        fnode.parameters.push({
          name : astnode.params[i].name,
        });
      }
    }

    if (astnode.type === "FunctionExpression") {
      for (i = 0; i < astnode.params.length; i++) {
        fnode.parameters.push({
          name : astnode.params[i].name
        });
      }
    }
  }

  /**
   * fill fnode's local table
   */
  function fill_locals(astnode) {

    var firstEntry = true;

    if (astnode.type == 'VariableDeclaration') {
      for (var i = 0; i < astnode.declarations.length; i++) {
        fnode.locals.push({
          name : astnode.declarations[i].id.name,
        });
      }
    } else if (astnode.type == 'FunctionDeclaration') {
      fnode.locals.push({
        name : astnode.id.name,
      })
      return; // Do not recurse into function.
    } else if (astnode.type == 'FunctionExpression') {
      return; // Do not recurse into function.
    }
    // var thisIterpreter = this;
    function recurse(child) {
      // this test assures the node has the same constructor with the ast (acorn
      // / esprima)
      // but don't know it's reasoin
      // if (child.constructor == thisIterpreter.ast.constructor) {
      // thisIterpreter.populateScope_(child, scope);
      fill_locals(child);
      // }
    }

    for ( var name in astnode) {
      var prop = astnode[name];
      if (prop && typeof prop == 'object') {
        if (typeof prop.length == 'number' && prop.splice) {
          // Prop is an array.
          for (var i = 0; i < prop.length; i++) {
            recurse(prop[i]);
          }
        } else {
          recurse(prop);
        }
      }
    }
  }
  
  /**
   * this stack is used to check parent node type
   */
  var ast_stack = [];

  /**
   * fill fnode's freevar table
   */
  function fill_ids(astnode) {

    var name = undefined;

    if (astnode.type === "Identifier") {
      if (ast_stack.length > 0 && ast_stack[0].type === "MemberExpression" && astnode === ast_stack[0].property) {
        // bypass property identifier but not object 
      }
      else {
        name = astnode.name;
      }
    } else if (astnode.type == 'FunctionDeclaration') {
      return; // Do not recurse into function.
    } else if (astnode.type == 'FunctionExpression') {
      return; // Do not recurse into function.
    }

    // white list policy
    if (name) {
      if (find_name_in_locals(name)) {
        console.log('id: ' + name + ' found in locals');
      } else if (find_name_in_parameters(name)) {
        console.log('id: ' + name + ' found in parameters');
      } else if (find_name_in_freevars(name)) {
        console.log('id: ' + name + ' found in freevars');
      } else {
        fnode.freevars.push({
          name : name,
        });
        console.log('id: ' + name + ' set as new freevar');
      }
    }

    function recurse(child) {
      ast_stack.unshift(astnode);
      fill_ids(child);
      ast_stack.shift(astnode);
    }

    for ( var name in astnode) {
      var prop = astnode[name];
      if (prop && typeof prop == 'object') {
        if (typeof prop.length == 'number' && prop.splice) {
          // Prop is an array.
          for (var i = 0; i < prop.length; i++) {
            recurse(prop[i]);
          }
        } else {
          recurse(prop);
        }
      }
    }
  }

  fill_parameters(astnode);
  fill_locals(astnode.body);
  fill_ids(astnode.body);

  console.log("fnode : " + fnode.uid);
  console.log("  parameters: " + JSON.stringify(fnode.parameters));
  console.log("  locals: " + JSON.stringify(fnode.locals));
  console.log("  freevars: " + JSON.stringify(fnode.freevars));
};

function resolve_freevar(parent, freevar) {

  var i;

  if (parent === undefined)
    throw "Cannot resolve freevar for root node.";

  // find in parameter
  for (i = 0; i < parent.parameters.length; i++) {
    if (parent.parameters[i].name === freevar.name) {
      freevar.from = "parameters";
      freevar.slot = i;
      return true;
    }
  }

  for (i = 0; i < parent.locals.length; i++) {
    if (parent.locals[i].name === freevar.name) {
      freevar.from = "locals";
      freevar.slot = i;
      return true;
    }
  }

  for (i = 0; i < parent.freevars.length; i++) {
    if (parent.freevars[i].name === freevar.name) {
      freevar.from = "freevars";
      freevar.slot = i;
      return true;
    }
  }

  freevar.from = "freevars";
  freevars.slot = parent.freevars.length;
  parent.freevars.push({
    name : freevar.name
  });

  return resolve(parent.parent, parent.freevars[parent.freevars.length - 1]);
}

function prepare(astroot) {

  console.log("----------- prepare ------------- begin");

  // output ast
  console.log(JSON.stringify(astroot, null, 2));

  var fnroot = build_function_tree(astroot);

  // output ftree after build
  console.log(JSON.stringify(fnroot, function(key, value) {
    if (key === "parent") { // suppress circular reference
      return (value === undefined) ? undefined : value.uid;
    } else if (key === "astnode") { // supress ast node
      return undefined;
    } else
      return value;
  }, 2));

  // annotate
  fnode_visit(fnroot, function(fn) {
    annotate(fn);
  });

  // resolve free vars
  fnode_visit(fnroot, function(fn) {
    var i, found;
    if (fn.parent === undefined) {
      if (fn.parameters.length !== 0 || fn.freevars.length !== 0)
        throw "root node should NOT has parameters or freevars";
    }

    for (i = 0; i < fn.freevars.length; i++) {
      resolve_freevar(fn.parent, fn.freevars[i]);
    }
  });

  // log resolved freevars
  fnode_visit(fnroot, function(fn) {

    console.log(fn.uid + ' freevars : ' + fn.freevars.length);
    for (var i = 0; i < fn.freevars.length; i++) {
      var v = fn.freevars[i];
      console.log('  name: ' + v.name + ', from: ' + v.from + ', slot: '
          + v.slot);
    }
  });

  return fnroot;
}

// /////////////////////////////////////////////////////////////////////////////

// interface AssignmentExpression <: Expression {
// type: "AssignmentExpression";
// operator: AssignmentOperator;
// left: Pattern;
// right: Expression;
// }
function compileAssignmentExpression(fn, ast) {

  assert_expecting_r();

  expect_l(ast);
  compileAST(fn, ast.left);
  unexpect_l(ast);

  expect_r(ast);
  compileAST(fn, ast.right);
  unexpect_r(ast);

  fn.emit({
    op : '=',
  });
}

// dispatcher
function compileAST(fn, ast) {

  var expect;

  indent_incr();

  if (lr_stack.length === 0)
    expect = " expecting none";
  else
    expect = " expecting " + lr_stack[0].val;

  astlog(ast.type + " { //" + expect);

  switch (ast.type) {
  case "AssignmentExpression":
    compileAssignmentExpression(fn, ast);
    break;

  case "BinaryExpression":
    compileBinaryExpression(fn, ast);
    break;

  case "BlockStatement":
    compileBlockStatement(fn, ast);
    break;

  case "CallExpression":
    compileCallExpression(fn, ast);
    break;

  case "ExpressionStatement":
    compileExpressionStatement(fn, ast);
    break;

  case "FunctionExpression":
    compileFunctionExpression(fn, ast);
    break;

  case "Identifier":
    compileIdentifier(fn, ast);
    break;

  case "Literal":
    compileLiteral(fn, ast);
    break;

  case "Program":
    compileProgram(fn, ast);
    break;

  case "ReturnStatement":
    compileReturnStatement(fn, ast);
    break;

  case "VariableDeclaration":
    compileVariableDeclaration(fn, ast);
    break;

  case "VariableDeclarator":
    compileVariableDeclarator(fn, ast);
    break;

  default:
    console.log("Compile : " + ast.type + " not dispatched.");
  }

  astlog("}");
  indent_decr();
}

// interface BinaryExpression <: Expression {
// type: "BinaryExpression";
// operator: BinaryOperator;
// left: Expression;
// right: Expression;
// }
function compileBinaryExpression(fn, ast) {

  // this function returns r only
  assert_expecting_r();

  // this expression expect r operand
  expect_r();

  compileAST(fn, ast.left);
  compileAST(fn, ast.right);

  switch (ast.operator) {
  case '+':
    fn.emit({
      op : 'ADD'
    });
    break;

  case '*':
    fn.emit({
      op : 'MUL'
    });
    break;
    
  case "===":
    fn.emit({
      op : '==='
    });
    break;
    
  default:
    throw "unsupported binary operator";
  }

  unexpect_r();
}

// interface BlockStatement <: Statement {
// type: "BlockStatement";
// body: [ Statement ];
// }
function compileBlockStatement(fn, ast) {

  for (var i = 0; i < ast.body.length; i++) {
    compileAST(fn, ast.body[i]);
  }

}

// interface CallExpression <: Expression {
// type: "CallExpression";
// callee: Expression;
// arguments: [ Expression ];
// }
function compileCallExpression(fn, ast) {

  assert_expecting_r();

  // put parameters
  for (var i = 0; i < ast.arguments.length; i++) {
    expect_r(ast);
    compileAST(fn, ast.arguments[i]);
    unexpect_r(ast);
  }

  // put argc
  fn.emit({
    op : "LITC",
    arg1 : ast.arguments.length
  });

  // put this
  // TODO pretend undefined now
  fn.emit({
    op : "LITN",
    arg1 : 1
  });

  // put callee, may evaluate to lvalue
  expect_r(ast);
  compileAST(fn, ast.callee);
  unexpect_r(ast);

  // do call
  fn.emit({
    op : "CALL"
  });
}

// interface ConditionalExpression <: Expression {
// type: "ConditionalExpression";
// test: Expression;
// alternate: Expression;
// consequent: Expression;
// }
function compileConditionalExpression(fn, ast) {
  
}


// interface FunctionDeclaration <: Function, Declaration {
// type: "FunctionDeclaration";
// id: Identifier;
// params: [ Pattern ];
// defaults: [ Expression ];
// rest: Identifier | null;
// body: BlockStatement | Expression;
// generator: boolean;
// expression: boolean;
// }
function compileFunctionDeclaration(fn, ast) {

}

// interface FunctionExpression <: Function, Expression {
// type: "FunctionExpression";
// id: Identifier | null;
// params: [ Pattern ];
// defaults: [ Expression ];
// rest: Identifier | null;
// body: BlockStatement | Expression;
// generator: boolean;
// expression: boolean;
// }
function compileFunctionExpression(fn, ast) {

  var sub_fn = ast.fnode;
  var l = sub_fn.freevars.length;
  // construct function object
  fn.emit({
    op : 'FUNC',
    arg1 : sub_fn, // replace with offset in backpatching
    arg2 : l
  });

  for (var i = 0; i < l; i++) {
    fn.emit({
      op : "CAPTURE",
      arg1 : sub_fn.freevars[i].from,
      arg2 : sub_fn.freevars[i].slot
    })
  }
}

// interface Identifier <: Node, Expression, Pattern {
// type: "Identifier";
// name: string;
// }
function compileIdentifier(fn, ast) {

  assert_expecting_anything();

  var i;
  var found = false;

  if (!found) {
    for (i = 0; i < fn.parameters.length; i++) {
      if (fn.parameters[i].name === ast.name) {
        fn.emit({
          op : 'LITA',
          arg1 : 'PARAM',
          arg2 : i
        });

        if (expecting_r()) {
          fn.emit({
            op : 'FETCH'
          })
        }
        found = true;
        break;
      }
    }
  }

  if (!found) {
    for (i = 0; i < fn.locals.length; i++) {
      if (fn.locals[i].name === ast.name) {
        fn.emit({
          op : 'LITA',
          arg1 : 'LOCAL',
          arg2 : i
        });

        if (expecting_r()) {
          fn.emit({
            op : 'FETCH'
          });
        }
        found = true;
        break;
      }
    }
  }

  if (!found) {
    for (i = 0; i < fn.freevars.length; i++) {
      if (fn.freevars[i].name === ast.name) {
        fn.emit({
          op : 'LITA',
          arg1 : 'FRVAR',
          arg2 : i
        });

        if (expecting_r()) {
          fn.emit({
            op : 'FETCH'
          });
        }
        found = true;
        break;
      }
    }
  }

  if (!found) {
    throw "Identifier: " + ast.name + " not found";
  }

}

// interface Literal <: Node, Expression {
// type: "Literal";
// value: string | boolean | null | number | RegExp;
// }
function compileLiteral(fn, ast) {

  assert_expecting_r();

  fn.emit({
    op : "LITC",
    arg1 : ast.value
  });
}

// interface ExpressionStatement <: Statement {
// type: "ExpressionStatement";
// expression: Expression;
// }
function compileExpressionStatement(fn, ast) {

  expect_r(ast);

  compileAST(fn, ast.expression);
  fn.emit({
    op : "DROP",
  });

  unexpect_r(ast);
}

// interface Program <: Node {
// type: "Program";
// body: [ Statement ];
// }
function compileProgram(fn, ast) {

  assert_expecting_nothing();

  for (var i = 0; i < ast.body.length; i++) {
    compileAST(fn, ast.body[i]);
  }

}

// interface ReturnStatement <: Statement {
// type: "ReturnStatement";
// argument: Expression | null;
// }
function compileReturnStatement(fn, ast) {

  assert_expecting_nothing();

  if (ast.argument == null) {
    fn.emit({
      op : "RET",
    });
  } else {
    expect_r(ast);
    compileAST(fn, ast.argument);
    unexpect_r(ast);

    fn.emit({
      op : "RET",
      arg1 : "RESULT"
    })
  }
}

// interface VariableDeclaration <: Declaration {
// type: "VariableDeclaration";
// declarations: [ VariableDeclarator ];
// kind: "var" | "let" | "const";
// }
function compileVariableDeclaration(fn, ast) {

  for (var i = 0; i < ast.declarations.length; i++) {
    compileAST(fn, ast.declarations[i]);
  }

}

// interface VariableDeclarator <: Node {
// type: "VariableDeclarator";
// id: Pattern;
// init: Expression | null;
// }
function compileVariableDeclarator(fn, ast) {

  assert_expecting_nothing(); // supposed to be

  if (ast.init !== null) {
    var i;
    var found = false;

    for (i = 0; i < fn.locals.length; ++i) {
      if (fn.locals[i].name === ast.id.name) {
        found = true;
        break;
      }
    }

    if (found === false)
      throw "var name " + ast.id.name + " not found!";

    fn.emit({
      op : 'LITA',
      arg1 : 'LOCAL',
      arg2 : i
    });

    expect_r(ast);
    compileAST(fn, ast.init);
    unexpect_r(ast);

    fn.emit({
      op : "STORE",
    })
  }

}

/**
 * compile a function node
 * @param fn
 */
function compileFN(fn) {

  console.log("compileFN : " + fn.uid);

  fn.emit({
    op : "LITN",
    arg1 : fn.locals.length
  });

  if (fn.astnode.type === "Program") {
    compileAST(fn, fn.astnode);
  } else if (fn.astnode.type === "FunctionDeclaration"
      || fn.astnode.type === "FunctionExpression") {
    compileAST(fn, fn.astnode.body);
  } else {
    throw "Unexpected fnode ast type";
  }

  if (fn.code.length > 0 && fn.code[fn.code.length - 1].op === "RET")
    return;

  fn.emit({
    op : "RET"
  });
}

function compile(node) {

  var i;

  var fnroot = prepare(node);

  fnode_visit(fnroot, function(fn) {
    compileFN(fn);
  });

  var array = [];

  fnode_visit(fnroot, function(fn) {
    array.push(fn);
  });

  if (array.length > 0) {
    array.sort(function compare(a, b) {
      return a.uid - b.uid;
    });
  }

  var offset = 0;
  for (i = 0; i < array.length; i++) {
    array[i].offset = offset;
    offset += array[i].code.length;
  }

  var merge = [];
  for (i = 0; i < array.length; i++) {
    merge = merge.concat(array[i].code);
  }

  // back patching func address
  for (i = 0; i < merge.length; i++) {
    if (merge[i].op === "FUNC") {
      merge[i].arg1 = merge[i].arg1.offset;
    }
  }

  return merge;
}

exports.compile = compile;
