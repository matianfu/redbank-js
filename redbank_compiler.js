'use strict';

var Format = require('./redbank_format.js');

var USE_RB_TEST = true;

var estraverse = require('estraverse');
var esutils = require('esutils');

var silent = true;

var expectRValue = [ {
  parent : "AssignmentExpression",
  prop : "right"
}, {
  parent : "BinaryExpression"
}, {
  parent : "CallExpression",
}, {
  parent : "MemberExpression",
  prop : "object"
}, {
  parent : "ReturnStatement",
  prop : "argument"
}, {
  parent : "VariableDeclarator",
  prop : "init"
} ];

/**
 * This function tells if current expr should be evaluated as address or value
 * 
 * @param expr
 *          an expression ast node
 * @returns {Boolean} true if expr should be evaluated as value.
 */
function exprAsVal(expr) {

  var parent = expr.__parent__;
  var pt = parent.type;

  if (pt === "AssignmentExpression") {
    if (expr === parent.left) {
      return false;
    }
    else if (expr === parent.right) {
      return true;
    }
    else {
      throw "Unknown role for " + pt;
    }

  }
  else if (pt === "MemberExpression") {
    if (expr === parent.object)
      return true;
    else if (expr === parent.property)
      return false;
    else
      throw "Unknown role for " + pt;
  }
  else if (pt === "BinaryExpression") {
    return true;

  }
  else if (pt === "VariableDeclarator") {
    if (expr === parent.id)
      return false;
    else if (expr === parent.init)
      return true;
    else
      throw "error";

    // interface CallExpression <: Expression {
    // type: "CallExpression";
    // callee: Expression;
    // arguments: [ Expression ];
    // }
  }
  else if (pt === "CallExpression") {
    return true; // TODO need check error
  }
  else if (pt === "ReturnStatement") {
    if (expr === parent.argument)
      return true;
    else
      throw "error";

  }
  else
    throw "exprAsVal: " + pt + " not supported yet";
};

/**
 * Visit function node, apply pre or post on node
 * 
 * @param fnode
 * @param pre
 *          pre-operation
 * @param post
 *          post-operation
 */
function fnode_visit(fnode, pre, post) {

  if (pre) {
    pre(fnode);
  }
  for (var i = 0; i < fnode.children.length; i++) {
    fnode_visit(fnode.children[i], pre, post);
  }
  if (post) {
    post(fnode);
  }
}

/**
 * for print
 */
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
  if (silent !== true) {
    console.log(indent + x);
  }
}

/**
 * This function generate a __parent__ property in each ast node, pointing to
 * it's parent
 * 
 * @param astroot
 */
function populate_parent(astroot) {

  function visit(node, parent) {
    if (!node || typeof node.type !== "string") {
      return;
    }

    for ( var prop in node) {
      if (node.hasOwnProperty(prop)) {
        var child = node[prop];
        if (Array.isArray(child)) {
          for (var i = 0; i < child.length; i++) {
            visit(child[i], node);
          }
        }
        else {
          visit(child, node);
        }
      }
    }

    // must be post
    node.__parent__ = parent;
  }
  visit(astroot, null);
}

function Bytecode(op, arg1, arg2, arg3) {
  this.op = op;
  this.arg1 = arg1;
  this.arg2 = arg2;
  this.arg3 = arg3;
}

/**
 * Identifier is the element in FunctionNode's identifiers array
 */
function Identifier(name, parent_type) {
  this.name = name;
  this.parent_type = parent_type;
  this.prop_name = undefined;
  this.prop_index = undefined;
}

/**
 * Lexical is the element in FunctionNode's lexicals array
 */
function Lexical(name, from, slot) {
  this.name = name;
  this.from = from;
  this.slot = slot;
}

function FunctionNode(compiler, uid, astnode, parent) {

  this.compiler = compiler;
  this.uid = uid;
  this.astnode = astnode;
  this.parent = parent;
  this.children = [];

  this.identifiers = [];
  this.arguments = [];
  this.localvars = [];
  this.lexicals = [];
  this.unresolved = [];

  this.code = [];
}

FunctionNode.prototype.emitBytecode = function(bytecode) {
  this.code.push(bytecode);
  if (silent !== true) {
    console.log(Format.dotline + bytecode.op + ' '
        + ((bytecode.arg1 === undefined) ? '' : bytecode.arg1) + ' '
        + ((bytecode.arg2 === undefined) ? '' : bytecode.arg2) + ' '
        + ((bytecode.arg3 === undefined) ? '' : bytecode.arg3));
  }
};

FunctionNode.prototype.emit = function(op, arg1, arg2, arg3) {
  this.emitBytecode(new Bytecode(op, arg1, arg2, arg3));
};

FunctionNode.prototype.fillArguments = function() {

  var i;

  if (this.astnode.type === "Program") {
    return;
  }
  else if (this.astnode.type === "FunctionDeclaration") {
    for (i = 0; i < this.astnode.params.length; i++) {
      this.arguments.push({
        name : this.astnode.params[i].name,
      });
    }
  }
  else if (this.astnode.type === "FunctionExpression") {
    for (i = 0; i < this.astnode.params.length; i++) {
      this.arguments.push({
        name : this.astnode.params[i].name
      });
    }
  }
  else {
    throw "error";
  }
};

FunctionNode.prototype.fillIdentifiers = function() {

  var fnode = this;

  function visit(astnode) {

    var identifier;
    var name;

    if (astnode.type === "Identifier") {

      var parent = astnode.__parent__;
      if (parent === undefined) {
        throw "error";
      }

      identifier = new Identifier(astnode.name, parent.type);

      for (name in parent) {
        if (parent.hasOwnProperty(name)) {
          if (name === "__parent__" || name === "fnode") {
            continue;
          }

          var prop = parent[name];
          if (prop && typeof prop === 'object') {
            if (Array.isArray(prop) === true) {
              for (var i = 0; i < prop.length; i++) {
                if (prop[i] === astnode) {
                  identifier.prop_name = name;
                  identifier.prop_index = i;
                }
              }
            }
            else {
              if (prop === astnode) {
                identifier.prop_name = name;
              }
            }
          }
        }
      }

      if (identifier.prop_name === undefined) {
        throw "error";
      }

      fnode.identifiers.push(identifier);
      return;

    }
    else if (astnode.type === "FunctionDeclaration") {

      identifier = new Identifier(astnode.id.name, astnode.type);
      identifier.prop_name = "id";

      fnode.identifiers.push(identifier);
      return;

    }
    else if (astnode.type === "FunctionExpression") {
      return;
    }

    // recursive
    for (name in astnode) {

      if (name === "__parent__" || name === "fnode") {
        continue;
      }

      var prop = astnode[name];
      if (prop && typeof prop === 'object') {
        if (typeof prop.length === 'number' && prop.splice) {
          // Prop is an array.
          for (var i = 0; i < prop.length; i++) {
            visit(prop[i]);
          }
        }
        else {
          visit(prop);
        }
      }
    }
  }

  if (this.astnode.type === "Program") {
    visit(this.astnode);
  }
  else if (this.astnode.type === "FunctionExpression"
      || this.astnode.type === "FunctionDeclaration") {
    visit(this.astnode.body);
  }
  else {
    throw "error";
  }
};

/**
 * This function can only be used in pre-visitor
 * 
 * It requires all ancestors have proccessed lexicals already
 */
FunctionNode.prototype.fillLexicals = function() {

  for (var i = 0; i < this.identifiers.length; i++) {

    var id = this.identifiers[i];

    // is Property's key
    if ((id.parent_type === "Property" && id.prop_name === "key") ||
    // is MemberExpression's property
    (id.parent_type === "MemberExpression" && id.prop_name === "property") ||
    // in arguments
    this.findNameInArguments(id.name) !== undefined ||
    // in locals
    this.findNameInLocals(id.name) !== undefined ||
    // in lexicals
    this.findNameInLexicals(id.name) !== undefined ||
    // failed to resolve previously
    this.findNameInUnresolved(id.name) !== undefined) {
      continue;
    }

    // In ancestry chain, find the given id.name
    // if found, record the 'from' type and 'slot' position
    // push function node into back trace stack
    var from, slot, stack = [];
    for (var fnode = this; fnode.parent !== undefined; fnode = fnode.parent) {

      if ((slot = fnode.parent.findNameInArguments(id.name)) !== undefined) {
        from = "argument";
      }
      else if ((slot = fnode.parent.findNameInLocals(id.name)) !== undefined) {
        from = "local";
      }
      else if ((slot = fnode.parent.findNameInLexicals(id.name)) !== undefined) {
        from = "lexical";
      }
      else {
        stack.push(fnode);
        continue;
      }
      break;
    }

    // id.name found in fnode's from/slot
    if (from !== undefined) {

      // create a lexical point to 'from' and 'slot'
      fnode.lexicals.push(new Lexical(id.name, from, slot));

      // create lexicals along ancestry chain, all point to 'lexical'
      // and the last 'slot'
      from = "lexical";
      slot = fnode.lexicals.length - 1;
      while (stack.length > 0) {
        var fn = stack.pop();
        fn.lexicals.push(new Lexical(id.name, from, slot));
        slot = fn.lexicals.length - 1;
      }
    }
    else { // push id.name into unresolved
      this.unresolved.push({
        name : id.name
      });
    }
  }
};

FunctionNode.prototype.fillLocals = function() {

  for (var i = 0; i < this.identifiers.length; i++) {

    var id = this.identifiers[i];

    if ((id.parent_type === "VariableDeclarator" && id.prop_name === "id")
        || (id.parent_type === "FunctionDeclaration" && id.prop_name === "id")) {

      // bypass same name in arguments
      if (this.findNameInArguments(id.name) !== undefined) {
        continue;
      }

      if (this.findNameInLocals(id.name) !== undefined) {
        continue;
      }

      this.localvars.push({
        name : id.name
      });
    }
  }
};

FunctionNode.prototype.findNameInArguments = function(name) {

  if (this.arguments.length === 0) {
    return;
  }

  /**
   * Searching in reverse order is important!
   * 
   * In javascript, something like this:
   * 
   * function(x, x, x) { ... }
   * 
   * is valid. The last one rules.
   */
  for (var i = this.arguments.length - 1; i >= 0; i--) {
    if (this.arguments[i].name === name) {
      return i;
    }
  }
};

FunctionNode.prototype.findNameInLocals = function(name) {

  if (this.localvars.length === 0) {
    return;
  }

  for (var i = 0; i < this.localvars.length; i++) {
    if (this.localvars[i].name === name) {
      return i;
    }
  }
};

FunctionNode.prototype.findNameInLexicals = function(name) {

  if (this.lexicals.length === 0) {
    return;
  }

  for (var i = 0; i < this.lexicals.length; i++) {
    if (this.lexicals[i].name === name) {
      return i;
    }
  }
};

FunctionNode.prototype.findNameInUnresolved = function(name) {

  if (this.unresolved.length === 0) {
    return;
  }

  for (var i = 0; i < this.unresolved.length; i++) {
    if (this.unresolved[i].name === name) {
      return i;
    }
  }
};



FunctionNode.prototype.printIdentifier = function(identifier) {

  var indexString = identifier.prop_index === undefined ? "" : "["
      + identifier.prop_index + "]";

  console.log(" :: " + identifier.name + " in " + identifier.parent_type
      + " as " + identifier.prop_name + indexString);
};

FunctionNode.prototype.printAll = function() {
  this.printAllIdentifiers();
  this.printAllArguments();
  this.printAllLocals();
  this.printAllLexicals();
  this.printAllUnresolved();
};

FunctionNode.prototype.printAllArguments = function() {

  var len = this.arguments.length;

  if (len === 0) {
    console.log("Function Node " + this.uid + " does NOT have any arguments");
    return;
  }

  console.log("Function Node " + this.uid + " has " + len + " arguments");
  for (var i = 0; i < len; i++) {
    console.log(this.arguments[i].name);
  }
};

FunctionNode.prototype.printAllIdentifiers = function() {

  var len = this.identifiers.length;

  if (len === 0) {
    console.log("Function Node " + this.uid + " does NOT have any identifiers");
    return;
  }

  console.log("Function Node " + this.uid + " has " + len + " identifier(s)");
  for (var i = 0; i < len; i++) {
    this.printIdentifier(this.identifiers[i]);
  }
};

FunctionNode.prototype.printAllLocals = function() {

  var len = this.localvars.length;
  if (len === 0) {
    console.log("Function Node " + this.uid + " does NOT have any locals");
    return;
  }

  console.log("Function Node " + this.uid + " has " + len + " local(s)");
  for (var i = 0; i < len; i++) {
    console.log(this.localvars[i].name);
  }
};

FunctionNode.prototype.printAllLexicals = function() {

  var len = this.lexicals.length;
  if (len === 0) {
    console.log("Function Node " + this.uid + " does Not have any lexicals");
    return;
  }

  console.log("Function Node " + this.uid + " has " + len + " lexical(s)");
  for (var i = 0; i < len; i++) {
    var lex = this.lexicals[i];
    console.log(lex.name + " from parent's " + lex.from + " slot " + lex.slot);
  }
};

FunctionNode.prototype.printAllUnresolved = function() {

  var len = this.unresolved.length;
  if (len === 0) {
    console.log("Function Node " + this.uid + " does Not have any unresolved");
    return;
  }

  console.log("Function Node " + this.uid + " has " + len + " unresolved");
  for (var i = 0; i < len; i++) {
    console.log(this.unresolved[i].name);
  }
};



// /////////////////////////////////////////////////////////////////////////////

var _code_label = 1;

function newLabel() {
  return _code_label++;
}

function emitLabel(fn, label) {
  fn.emit("LABEL", label);
}

function emitJUMP(fn, to) {
  fn.emit("JUMP", to);
}

function emitJUMPC(fn, t, f) {
  fn.emit("JUMPC", t, f);
}

// interface AssignmentExpression <: Expression {
// type: "AssignmentExpression";
// operator: AssignmentOperator;
// left: Pattern;
// right: Expression;
// }
function compileAssignmentExpression(fn, ast) {
  compileAST(fn, ast.left);
  compileAST(fn, ast.right);
  fn.emit('=');
}

function compileAST(fn, ast, silent) {

  indent_incr();

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

  case "IfStatement":
    compileIfStatement(fn, ast);
    break;

  case "Literal":
    compileLiteral(fn, ast);
    break;

  case "MemberExpression":
    compileMemberExpression(fn, ast);
    break;

  case "ObjectExpression":
    compileObjectExpression(fn, ast);
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
    throw "compileAST : " + ast.type + " not dispatched";
  }

  // TODO
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

  compileAST(fn, ast.left);
  compileAST(fn, ast.right);

  switch (ast.operator) {
  case '+':
    fn.emit('+');
    break;

  case '*':
    fn.emit('*');
    break;

  case "===":
    fn.emit('===');
    break;

  default:
    throw "unsupported binary operator";
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

  if (USE_RB_TEST && ast.callee.type === "Identifier"
      && ast.callee.name === "rb_test") {

    if (ast.arguments.length !== 1 || ast.arguments[0].type !== "Literal") {
      throw "Incorrect rb_test usage";
    }

    fn.emit("TEST", ast.arguments[0].value);
    fn.emit("LITN", 1);
    return;
  }

  // put arguments
  for (var i = 0; i < ast.arguments.length; i++) {
    compileAST(fn, ast.arguments[i]);
  }

  // put argc
  fn.emit("LITC", ast.arguments.length);

  // put this
  // TODO pretend undefined now
  fn.emit("LITN", 1);

  // put callee, may evaluate to lvalue
  compileAST(fn, ast.callee);

  // do call
  fn.emit("CALL");
}

// interface ConditionalExpression <: Expression {
// type: "ConditionalExpression";
// test: Expression;
// alternate: Expression;
// consequent: Expression;
// }
function compileConditionalExpression(fn, ast) {
  throw "error";
}

function compileExpressionStatement(fn, ast) {
  // interface ExpressionStatement <: Statement {
  // type: "ExpressionStatement";
  // expression: Expression;
  // }

  compileAST(fn, ast.expression);
  fn.emit("DROP");
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
  throw "error"
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
  var l = sub_fn.lexicals.length;

  // replace with offset in backpatching
  fn.emit('FUNC', sub_fn, l);

  for (var i = 0; i < l; i++) {
    fn.emit("CAPTURE", sub_fn.lexicals[i].from, sub_fn.lexicals[i].slot);
  }
}

// interface Identifier <: Node, Expression, Pattern {
// type: "Identifier";
// name: string;
// }
function compileIdentifier(fn, ast) {

  var i;
  if (ast.__parent__.type === "MemberExpression") {
    if (ast === ast.__parent__.object) {
      // find identifier in scope
    }
    else if (ast === ast.__parent__.property) {
      // treat identifier as operator
      fn.emit("LITA", "PROP", ast.name);
      return;
    }
  }

  // var index = find_name_in_params(fn, ast.name);
  var index = fn.findNameInArguments(ast.name);
  if (index !== undefined) {
    fn.emit('LITA', 'PARAM', index);
  }
  else {
    // index = find_name_in_locals(fn, ast.name);
    index = fn.findNameInLocals(ast.name);
    if (index !== undefined) {
      fn.emit('LITA', 'LOCAL', index);
    }
    else {
      // index = find_name_in_freevars(fn, ast.name);
      index = fn.findNameInLexicals(ast.name);
      if (index !== undefined) {
        fn.emit('LITA', 'FRVAR', index);
      }
      else {
        console.log("error: identifier: " + ast.name + " not found");
        throw "error";
      }
    }
  }

  if (exprAsVal(ast)) {
    fn.emit("FETCH");
  }
}

// interface IfStatement <: Statement {
// type: "IfStatement";
// test: Expression;
// consequent: Statement;
// alternate: Statement | null;
// }
function compileIfStatement(fn, ast) {

//  var begin = newLabel();
//  var after = newLabel();
//  var t = newLabel();
//  var f = newLabel();
  var begin = fn.compiler.newLabel();
  var after = fn.compiler.newLabel();
  var t = fn.compiler.newLabel();
  var f = fn.compiler.newLabel();

  emitLabel(fn, begin);
  compileAST(fn, ast.test);
  emitJUMPC(fn, t, f);

  emitLabel(fn, t);
  compileAST(fn, ast.consequent);
  emitJUMP(fn, after);

  emitLabel(fn, f);
  if (ast.alternate !== null) {
    compileAST(fn, ast.alternate);
  }
  emitJUMP(fn, after);
  emitLabel(fn, after);
}

// interface Literal <: Node, Expression {
// type: "Literal";
// value: string | boolean | null | number | RegExp;
// }
function compileLiteral(fn, ast) {
  fn.emit("LITC", ast.value);
}

// interface MemberExpression <: Expression {
// type: "MemberExpression";
// object: Expression;
// property: Identifier | Expression;
// computed: boolean;
// }
function compileMemberExpression(fn, ast) {
  compileAST(fn, ast.object);
  compileAST(fn, ast.property);
  if (exprAsVal(ast)) {
    fn.emit("FETCH");
  }
}

// interface ObjectExpression <: Expression {
// type: "ObjectExpression";
// properties: [ Property ];
// }
function compileObjectExpression(fn, ast) {
  fn.emit("LITO");
}

function compileProgram(fn, ast) {
  // interface Program <: Node {
  // type: "Program";
  // body: [ Statement ];
  // }
  for (var i = 0; i < ast.body.length; i++) {
    compileAST(fn, ast.body[i]);
  }
}

function compileReturnStatement(fn, ast) {
  // interface ReturnStatement <: Statement {
  // type: "ReturnStatement";
  // argument: Expression | null;
  // }
  if (ast.argument === null) {
    fn.emit("RET");
  }
  else {
    compileAST(fn, ast.argument);
    fn.emit("RET", "RESULT");
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

function compileVariableDeclarator(fn, ast) {

  // interface VariableDeclarator <: Node {
  // type: "VariableDeclarator";
  // id: Pattern;
  // init: Expression | null;
  // }

  if (ast.init !== null) {
    var i;
    var found = false;

    for (i = 0; i < fn.localvars.length; ++i) {
      if (fn.localvars[i].name === ast.id.name) {
        found = true;
        break;
      }
    }

    if (found === false) {
      throw "var name " + ast.id.name + " not found!";
    }

    fn.emit('LITA', 'LOCAL', i);
    compileAST(fn, ast.init);
    fn.emit("STORE");
  }
}

/**
 * compile a function node
 * 
 * @param fn
 */
function compileFN(fn, silent) {

  if (silent === false) {
    console.log("compileFN : " + fn.uid);
  }

  fn.emit("LITN", fn.localvars.length);

  if (fn.astnode.type === "Program") {
    compileAST(fn, fn.astnode, silent);
  }
  else if (fn.astnode.type === "FunctionDeclaration"
      || fn.astnode.type === "FunctionExpression") {
    compileAST(fn, fn.astnode.body, silent);
  }
  else {
    throw "Unexpected fnode ast type";
  }

  if (fn.code.length > 0 && fn.code[fn.code.length - 1].op === "RET") {
    return;
  }

  fn.emit("RET");
}

function Compiler() {
  this.label = 0;
}

Compiler.prototype.newLabel = function() {
  return this.label++;
}

var Compiler = new Compiler(); 

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

    if (astnode.type === "Program") {

      fnode = new FunctionNode(Compiler, funcnode_uid++, astnode, undefined);

      // reverse annotation for debug
      astnode.fnode = fnode;
      rootnode = fnode;
      currentFuncNode = fnode;
    }
    else if (astnode.type === "FunctionDeclaration"
        || astnode.type === "FunctionExpression") {

      fnode = new FunctionNode(Compiler, funcnode_uid++, astnode, currentFuncNode);

      // reverse annotation for debug
      astnode.fnode = fnode;
      currentFuncNode.children.push(fnode);
      currentFuncNode = fnode;
    }

    for ( var prop in astnode) {
      if (astnode.hasOwnProperty(prop)) {
        if (prop === "__parent__") {
          continue;
        }

        var child = astnode[prop];
        if (Array.isArray(child)) {
          for (var i = 0; i < child.length; i++) {
            visit(child[i], astnode, prop, i);
          }
        }
        else {
          visit(child, astnode, prop);
        }
      }
    }

    if (astnode.type === "FunctionDeclaration"
        || astnode.type === "FunctionExpression") {

      currentFuncNode = currentFuncNode.parent;
    }
  }

  visit(node);

  return rootnode;
}

function prepare(astroot, opt_logftree) {

  populate_parent(astroot);

  var fnroot = build_function_tree(astroot);

  if (opt_logftree === true) {
    // output ftree after build
    console.log(JSON.stringify(fnroot, function(key, value) {
      if (key === "parent") { // suppress circular reference
        return (value === undefined) ? undefined : value.uid;
      }
      else if (key === "astnode") { // supress ast node
        return undefined;
      }
      else {
        return value;
      }
    }, 2));
  }

  fnode_visit(fnroot, function(fn) {
    fn.fillIdentifiers();
    fn.fillArguments();
    fn.fillLocals();
    fn.fillLexicals();
    fn.printAll();
  });

  return fnroot;
}

function merge(fnroot) {
  
  var i;
  var array = [];

  // push all function node into array
  fnode_visit(fnroot, function(fn) {
    array.push(fn);
  });

  // sort function node array by uid
  if (array.length > 0) {
    array.sort(function compare(a, b) {
      return a.uid - b.uid;
    });
  }

  // calculate and set code offset to function node
  var offset = 0;
  for (i = 0; i < array.length; i++) {
    array[i].offset = offset;
    offset += array[i].code.length;
  }

  // merge all function node code into one array
  var merged = [];
  for (i = 0; i < array.length; i++) {
    merged = merged.concat(array[i].code);
  }

  // back patching func address
  for (i = 0; i < merged.length; i++) {
    if (merged[i].op === "FUNC") {
      merged[i].arg1 = merged[i].arg1.offset;
    }
  }
  
  return merged;
}



function compile(node, silent) {

  var i;
  var fnroot;
  
  // stage 1: do annotation
  fnroot = prepare(node);

  // stage 2: compile all function node
  fnode_visit(fnroot, function(fn) {
    compileFN(fn);
  });

  return merge(fnroot);
}

exports.compile = compile;
