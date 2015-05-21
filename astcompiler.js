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

      console.log('EMIT : ' + instruction.op + ' ' + instruction.arg1 + ' '
          + instruction.arg2 + ' ' + instruction.arg3);
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
      astnode.function_uid = fnode.uid;

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
      astnode.function_uid = fnode.uid;

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
  compileAST(fn, ast.left);
  compileAST(fn, ast.right);
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

  compileAST(fn, fn.astnode);

  if (fn.code.length > 0 && fn.code[fn.code.length - 1].op !== "RET") {
    fn.emit({
      op : "RET",
    })
  }
}

function compile(node) {

  var fnroot = prepare(node);

  fnode_visit(fnroot, function(fn) {
    compileFN(fn);
  });

  var code = fnroot.code;

  run(code);
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

function JSVar(type, index) {
  this.type = type;
  this.index = index;
}

function run(code) {

  console.log("-------------------- start running ---------------------");

  var JS_OBJ = "Object";
  var JS_FRV = "FreeVar";
  var JS_STK = "StackVar";
  var JS_LIT = "Literal";

  var vm = {

    // higher side is the top
    fp : [ 0 ],

    // stack store vars
    stack : [], // higher side is the top

    // display store free vars
    display : [ 0 ],
    // objects
    objects : [ 0 ],
    // constants
    literals : [ 0 ],

    assert_no_leak : function() {
      for (var i = 1; i < this.objects.length; i++) {
        if (this.objects[i] !== undefined) {
          console.log("mem leak @ object id: " + i);
        }
      }
    },

    // display variable not supported yet
    push : function(v) {
      this.stack.push(v);

      if (v.type === JS_OBJ) {
        this.objects[v.index].ref++;
      }
    },

    // suspicious
    pushVal : function(val) {
      var obj = this.objects.push(new ValueObject(val)) - 1;
      var v = obj2var(obj);
      this.push(v);
    },

    // pop any thing
    pop : function() {
      var v = vm.stack.pop();
      if (v.type === JS_OBJ) {
        vm.objects[v.index].ref--;
        if (vm.objects[v.index].ref === 0) {
          vm.objects[v.index] = undefined;
        }
      }
    },

    popVal : function() {
      var id = vm.stack.pop();
      var val = vm.objects[id].value;
      vm.objects[id].ref--;
      return val;
    },

    span : function(x) {
      for (var i = 0; i < x; i++) {
        this.stack.push(0);
      }
    },

    printstack : function() {
      if (this.stack.length === 0) {
        console.log("STACK Empty");
      } else {
        console.log("STACK size: " + this.stack.length + ", obj id: "
            + this.stack[this.stack.length - 1]);
      }
    }
  };

  function step(vm, bytecode) {

    vm.printstack();
    console.log("OPCODE: " + bytecode.op + ' ' + bytecode.arg1 + ' '
        + bytecode.arg2 + ' ' + bytecode.arg3);

    var v, obj;
    var id;
    var val;

    switch (bytecode.op) {
    case "ADD":
      // add stack top object and pop
      val = vm.popVal() + vm.popVal();
      vm.pushVal(val);
      break;

    case "LIT":
      // create new value object and push to stack
      val = bytecode.arg1;
      obj = vm.objects.push(new ValueObject(val)) - 1;
      v = new JSVar(JS_OBJ, obj);
      vm.push(v);
      break;

    case "MUL":
      // multiply stack top object and pop
      val = vm.popVal() * vm.popVal();
      vm.pushVal(val);
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
        vm.stack.push();
      }
      break;

    case "RET":
      // vm.pop();
      break;

    default:
      console.log("!!! unknown instruction : " + bytecode.op);
    }
  }

  while (code.length > 0)
    step(vm, code.shift());

  vm.printstack();
  vm.assert_no_leak();
}
