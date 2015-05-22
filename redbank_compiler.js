'use strict';

var Syntax;
var Precedence;
var BinaryPrecedence;
var SourceNode;
var estraverse;
var esutils;
var isArray;
var base;
var indent;
var json;
var renumber;
var hexadecimal;
var quotes;
var escapeless;
var newline;
var space;
var parentheses;
var semicolons;
var safeConcatenation;
var directive;
var extra;
var parse;
var sourceMap;
var sourceCode;
var preserveBlankLines;
var FORMAT_MINIFY;
var FORMAT_DEFAULTS;

estraverse = require('estraverse');
esutils = require('esutils');

Syntax = estraverse.Syntax;

Precedence = {
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

BinaryPrecedence = {
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

// Flags
var F_ALLOW_IN = 1;
var F_ALLOW_CALL = 1 << 1;
var F_ALLOW_UNPARATH_NEW = 1 << 2;
var F_FUNC_BODY = 1 << 3;
var F_DIRECTIVE_CTX = 1 << 4;
var F_SEMICOLON_OPT = 1 << 5;

// Expression flag sets
// NOTE: Flag order:
// F_ALLOW_IN
// F_ALLOW_CALL
// F_ALLOW_UNPARATH_NEW
var E_FTT = F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW;
var E_TTF = F_ALLOW_IN | F_ALLOW_CALL;
var E_TTT = F_ALLOW_IN | F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW;
var E_TFF = F_ALLOW_IN;
var E_FFT = F_ALLOW_UNPARATH_NEW;
var E_TFT = F_ALLOW_IN | F_ALLOW_UNPARATH_NEW;

// Statement flag sets
// NOTE: Flag order:
// F_ALLOW_IN
// F_FUNC_BODY
// F_DIRECTIVE_CTX
// F_SEMICOLON_OPT
var S_TFFF = F_ALLOW_IN;
var S_TFFT = F_ALLOW_IN | F_SEMICOLON_OPT;
var S_FFFF = 0x00;
var S_TFTF = F_ALLOW_IN | F_DIRECTIVE_CTX
var S_TTFF = F_ALLOW_IN | F_FUNC_BODY;

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

// /////////////////////////////////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////////

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

function astlog(x) {
  console.log(x);
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

    console.log('visit: ' + astnode.type);

    function emitcode(instruction) {
      this.code.push(instruction);

      console.log('EMIT : ' + instruction.op + ' '
          + ((instruction.arg1 === undefined) ? '' : instruction.arg1) + ' '
          + ((instruction.arg2 === undefined) ? '' : instruction.arg2) + ' '
          + ((instruction.arg3 === undefined) ? '' : instruction.arg3));
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
   * check if Identifier already in parameter tabel
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
   * fill fnode's freevar table
   */
  function fill_ids(astnode) {

    var name = undefined;

    if (astnode.type === "AssignmentExpression"
        && astnode.left.type === "Identifier") {
      name = astnode.left.name;
    } else if (astnode.type === "MemberExpression"
        && astnode.object.type === "Identifier") {
      name = astnode.object.name;
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
      // this test assures the node has the same constructor with the ast (acorn
      // / esprima)
      // but don't know it's reasoin
      // if (child.constructor == thisIterpreter.ast.constructor) {
      // thisIterpreter.populateScope_(child, scope);
      fill_ids(child);
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

  fill_parameters(astnode);
  fill_locals(astnode.body);
  fill_ids(astnode.body);

  console.log("fnode : " + fnode.uid);
  console.log(fnode.parameters);
  console.log(fnode.locals);
  console.log(fnode.freevars);
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

  astlog("compileAssignmentExpression");

  compileAST(fn, ast.left);
  compileAST(fn, ast.right);

  fn.emit({
    op : '=',
  });
}

// dispatcher
function compileAST(fn, ast) {

  // console.log("Compile : " + ast.type);
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

  case "FunctionExpression":
    compileFunctionExpression(fn, ast);
    break;

  case "Program":
    compileProgram(fn, ast);
    break;

  case "Identifier":
    compileIdentifier(fn, ast);
    break;

  case "Literal":
    compileLiteral(fn, ast);
    break;

  case "ExpressionStatement":
    compileExpressionStatement(fn, ast);
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
}

// interface BinaryExpression <: Expression {
// type: "BinaryExpression";
// operator: BinaryOperator;
// left: Expression;
// right: Expression;
// }
function compileBinaryExpression(fn, ast) {

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
  }
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

  compileAST(fn, ast.callee);
  fn.emit({
    op : "CALL"
  });
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
  // construct function object
  fn.emit({
    op : 'FUNC',
    arg1 : ast.fnode
  // replace with offset in backpatching
  });
}

// interface Identifier <: Node, Expression, Pattern {
// type: "Identifier";
// name: string;
// }
function compileIdentifier(fn, ast) {

  var i;
  var found = false;

  if (!found) {
    for (i = 0; i < fn.parameters.length; i++) {
      if (fn.parameters[i].name === ast.name) {
        fn.emit({
          op : 'REF',
          arg1 : 'PARAM',
          arg2 : i
        });
        return;
      }
    }
  }

  if (!found) {
    for (i = 0; i < fn.locals.length; i++) {
      if (fn.locals[i].name === ast.name) {
        fn.emit({
          op : 'REF',
          arg1 : 'LOCAL',
          arg2 : i
        });
        return;
      }
    }
  }

  if (!found) {
    for (i = 0; i < fn.freevars.length; i++) {
      if (fn.freevars[i].name === ast.name) {
        fn.emit({
          op : 'REF',
          arg1 : 'FRVAR',
          arg2 : i
        });
        return;
      }
    }
  }

  throw "Identifier: " + ast.name + " not found";
}

// interface Literal <: Node, Expression {
// type: "Literal";
// value: string | boolean | null | number | RegExp;
// }
function compileLiteral(fn, ast) {

  fn.emit({
    op : "LIT",
    arg1 : ast.value
  });
}

// interface ExpressionStatement <: Statement {
// type: "ExpressionStatement";
// expression: Expression;
// }
function compileExpressionStatement(fn, ast) {

  compileAST(fn, ast.expression);
  fn.emit({
    op : "POP",
  })
}

// interface Program <: Node {
// type: "Program";
// body: [ Statement ];
// }
function compileProgram(fn, ast) {

  for (var i = 0; i < ast.body.length; i++) {
    compileAST(fn, ast.body[i]);
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

    compileAST(fn, ast.init);

    fn.emit({
      op : "POP",
      arg1 : "LOC",
      arg2 : i,
    })
  }
}

function compileFN(fn) {

  console.log("compileFN : " + fn.uid);

  fn.emit({
    op : "SPAN",
    arg1 : fn.locals.length
  });

  if (fn.astnode.type === "Program") {
    compileAST(fn, fn.astnode);
  } else if (fn.astnode.type === "FunctionDeclaration"
      || fn.astnode.type === "FunctionExpression") {
    compileAST(fn, fn.astnode.body);
  } else {
    throw "Unexpected fnode ast type!";
  }

  if (fn.code.length > 0 && fn.code[fn.code.length - 1].op !== "RET") {
    fn.emit({
      op : "RET",
    })
  }
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

/*******************************************************************************
 * 
 * Virtual Machine
 * 
 ******************************************************************************/

// or may be we should call this primitive object?
function ValueObject(value) {
  this.type = typeof value;
  this.value = value;
  this.ref = 0;
}

function FuncObject(value) {
  this.type = "function";
  this.value = value; // value is the jump position
  this.display = []; // hold freevar
  this.ref = 0;
}

function JSVar(type, index) {
  this.type = type;
  this.index = index;
}

/**
 * var type constant
 */
var VT_OBJ = "Object";
var VT_FRV = "FreeVar";
var VT_STK = "Stack";
var VT_LIT = "Literal";
var VT_NULL = "Null";


function run(code) {

  console.log("-------------------- start running ---------------------");

  var vm = {

    pc : 0,
    fp : 0,

    pc_stack : [],
    fp_stack : [ 0 ],

    // stack store vars
    stack : [], // higher side is the top

    // display store free vars
    display : [ 0 ],
    // objects
    objects : [ 0 ],
    // constants
    literals : [ 0 ],

    assert_no_leak : function() {
      // check objects
      for (var i = 1; i < this.objects.length; i++) {
        if (this.objects[i] !== undefined) {
          console.log("mem leak @ object id: " + i);
        }
      }
      // check display
      // check stack
      if (this.stack.length > 0) {
        console.log("mem leak @ stack.")
      }
    },

    ref_local : function(offset) {
      var fp = this.fp_stack[this.fp_stack.length - 1];
      return fp + offset;
    },

    load_local : function() {
      var v = this.stack.pop();

      if (v.type !== VT_STK)
        throw "unmatched type!";
      
      v = new JSVar(this.stack[this.ref_local(v.index)].type,
          this.stack[this.ref_local(v.index)].index);

      this.stack.push(v);
      if (v.type === VT_OBJ) {
        this.objects[v.index].ref++;
      }
      
      return v;
    },

    // display variable not supported yet
    push : function(v) {
      this.stack.push(v);

      if (v.type === VT_OBJ) {
        this.objects[v.index].ref++;
      }
    },

    // pop any thing, return value
    pop : function() {
      var val, v = this.stack.pop();

      if (v.type === VT_OBJ) {
        val = this.objects[v.index].value;
        this.objects[v.index].ref--;
        if (this.objects[v.index].ref === 0) {
          this.objects[v.index] = undefined;
        }
        return val;
      } else if (v.type === VT_NULL) {
        // do nothing
      }
    },

    // 
    assign : function() {

      var rv, lv, v;
      rv = this.stack.pop();
      lv = this.stack.pop();

      if (lv.type === VT_STK) { // assign to locals

        // free old lv
        v = this.stack[lv.index];
        switch (v.type) {
        case VT_OBJ:
          this.objects[v.index].ref--;
          if (this.objects[v.index].ref === 0) {
            this.objects[v.index] = undefined;
          }
          break;
        }

        if (rv.type === VT_OBJ) { // rvalue
          this.stack[lv.index] = rv;
          switch (rv.type) {
          case VT_OBJ:
            this.objects[rv.index].ref++;
            break;
          }

          // push back, no need to increment ref count
          this.stack.push(rv);
        } else if (rv.type === VT_STK) {
          rv = this.stack[rv.index];
          this.stack[lv.index] = rv;
          switch (rv.type) {
          case VT_OBJ:
            this.objects[rv.index].ref++;
            break;
          }

          // push new, increment ref count
          this.stack.push(rv);
          this.objects[rv.index].ref++;
        }

      } else {
        throw "not supported yet.";
      }
    },

    span : function(x) {
      for (var i = 0; i < x; i++) {
        this.stack.push(new JSVar(VT_NULL, 0));
      }
    },

    printstack : function() {
      if (this.stack.length === 0) {
        console.log("STACK Empty");
      } else {
        console.log("STACK size: " + this.stack.length);
        for (var i = this.stack.length - 1; i >= 0; i--) {
          var v = this.stack[i];
          if (v.type == VT_OBJ) {
            var index = v.index;

            console.log(i + " : " + VT_OBJ + " " + index + ", val: "
                + this.objects[index].value + ", ref: "
                + this.objects[index].ref);
          } else if (v.type === VT_STK) {

            console.log(i + " : " + VT_STK + " " + v.index);
          } else {
            console.log(i + " : " + v.type);
          }
        }
      }

      console.log("----------------------------------");
    }
  }

  function step(vm, bytecode) {

    vm.printstack();
    console.log("OPCODE: " + bytecode.op + ' ' + bytecode.arg1 + ' '
        + bytecode.arg2 + ' ' + bytecode.arg3);

    var v, obj;
    var id, index;
    var val;
    var opd1, opd2;

    switch (bytecode.op) {
    case "ADD":
      // add stack top object and pop
      val = vm.pop();
      val = vm.pop() + val;
      obj = vm.objects.push(new ValueObject(val)) - 1;
      v = new JSVar(VT_OBJ, obj);
      vm.push(v);
      break;

    case "CALL":

      v = vm.stack[vm.stack.length - 1];
      if (v.type === VT_STK) {
        v = vm.load_local();
      }
      
      vm.pc_stack.push(vm.pc);
      vm.pc = vm.objects[v.index].value;
      vm.fp_stack.push(vm.fp);
      vm.fp = vm.stack.length;

      break;

    case "FUNC":
      val = bytecode.arg1;
      obj = vm.objects.push(new FuncObject(val)) - 1;
      v = new JSVar(VT_OBJ, obj);
      vm.push(v);
      break;

    case "LIT":
      // create new value object and push to stack
      val = bytecode.arg1;
      obj = vm.objects.push(new ValueObject(val)) - 1;
      v = new JSVar(VT_OBJ, obj);
      vm.push(v);
      break;

    case "MUL":
      // multiply stack top object and pop
      val = vm.pop();
      val = vm.pop() * val;
      obj = vm.objects.push(new ValueObject(val)) - 1;
      v = new JSVar(VT_OBJ, obj);
      vm.push(v);
      break;

    case "POP":
      // just pop
      if (bytecode.arg1 === undefined) {
        val = vm.pop();
        if (vm.stack.length == 0) { // debug info only
          console.log("The last value in stack is " + val);
        }
      } else if (bytecode.arg1 === "LOC") { // pop to local

        var idx = vm.fp[vm.fp.length - 1];
        idx += bytecode.arg2;

        id = vm.stack[idx];

        if (id !== 0) {
          vm.objects[id].ref--;
        }

        vm.stack[idx] = vm.stack[vm.stack.length - 1];
        vm.stack.pop();
      }
      break;

    case "SPAN":
      vm.span(bytecode.arg1);
      break;

    case "REF":
      if (bytecode.arg1 === "LOCAL") {
        v = new JSVar(VT_STK, vm.ref_local(bytecode.arg2));
        vm.stack.push(v);
      }
      break;

    case "RET":
      if (vm.fp_stack.length === 1 && vm.fp_stack[0] === 0) {
        while (vm.stack.length) {
          vm.pop();
        }
      }
      break;

    case '=':
      vm.assign();
      break;

    default:
      console.log("!!! unknown instruction : " + bytecode.op);
    }
  }

  //  while (code.length > 0)
  //    step(vm, code.shift());

  while (vm.pc < code.length) {
    step(vm, code[vm.pc++]);
  }

  vm.printstack();
  vm.assert_no_leak();
}
