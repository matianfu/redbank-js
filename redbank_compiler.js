'use strict';

var Format = require('./redbank_format.js');

var USE_RB_TEST = true;

var estraverse = require('estraverse');
var esutils = require('esutils');

var silent = true;

var AstCompiler = {};

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
};

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
};

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
    if (expr === parent.left)
      return false;
    else if (expr === parent.right)
      return true;
    else
      throw "Unknown role for " + pt;

  } else if (pt === "MemberExpression") {
    if (expr === parent.object)
      return true;
    else if (expr === parent.property)
      return false;
    else
      throw "Unknown role for " + pt;

  } else if (pt === "BinaryExpression") {
    return true;

  } else if (pt === "VariableDeclarator") {
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
  } else if (pt === "CallExpression") {
    return true; // TODO need check error
  } else if (pt === "ReturnStatement") {
    if (expr === parent.argument)
      return true;
    else
      throw "error";

  } else
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

  if (pre)
    pre(fnode);

  for (var i = 0; i < fnode.children.length; i++) {
    fnode_visit(fnode.children[i], pre, post);
  }

  if (post)
    post(fnode);
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

  function visit(node, parent, prop, idx) {

    if (!node || typeof node.type !== "string") {
      return;
    }

    for ( var prop in node) {
      var child = node[prop];

      if (Array.isArray(child)) {
        for (var i = 0; i < child.length; i++) {
          visit(child[i], node, prop, i);
        }
      } else {
        visit(child, node, prop);
      }
    }

    // must be post
    node.__parent__ = parent;
  }

  visit(astroot, null);
};

function emitcode(f, o, a1, a2, a3) {
  f.emit({
    op : o,
    arg1 : a1,
    arg2 : a2,
    arg3 : a3,
  })
};

function Identifier(name, parent_type) {
  this.name = name;
  this.parent_type = parent_type;
  this.prop_name = undefined;
  this.prop_index = undefined;
}

function Lexical(name, from, slot) {
  this.name = name;
  this.from = from;
  this.slot = slot;
}

function FunctionNode(uid, astnode, parent) {

  this.uid = uid;
  this.astnode = astnode;
  this.parent = parent;
  this.children = [];

  this.locals = [];
  this.parameters = [];
  this.freevars = [];

  this.identifiers = [];
  this.arguments = [];
  this.localvars = [];
  this.lexicals = [];
  this.unresolved = [];

  this.code = [];
  this.emit = emitc;

  function emitc(instruction) {
    this.code.push(instruction);

    if (silent !== true) {
      console.log(Format.dotline + instruction.op + ' '
          + ((instruction.arg1 === undefined) ? '' : instruction.arg1) + ' '
          + ((instruction.arg2 === undefined) ? '' : instruction.arg2) + ' '
          + ((instruction.arg3 === undefined) ? '' : instruction.arg3));
    }
  }
}

/**
 * fill argument
 */
FunctionNode.prototype.fillArguments = function() {

  if (this.astnode.type === "Program") {
    // do nothing
  } else if (this.astnode.type === "FunctionDeclaration") {
    for (var i = 0; i < astnode.arguments.length; i++) {
      this.arguments.push({
        name : astnode.params[i].name,
      });
    }
  } else if (this.astnode.type === "FunctionExpression") {
    for (var i = 0; i < astnode.arguments.length; i++) {
      this.arguments.push({
        name : astnode.params[i].name
      });
    }
  } else {
    throw "error";
  }
}

FunctionNode.prototype.findNameInArguments = function(name) {

  if (this.arguments.length === 0)
    return;

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
    if (this.arguments[i].name === name)
      return i;
  }

  // return undefined
}

FunctionNode.prototype.findNameInLocals = function(name) {

  if (this.localvars.length === 0)
    return;

  for (var i = 0; i < this.localvars.length; i++) {
    if (this.localvars[i].name === name)
      return i;
  }
}

FunctionNode.prototype.fillLocals = function() {

  if (this.argumentsFilled !== true || this.identifiersFilled !== true)
    throw "error";

  for (var i = 0; i < this.identifiers.length; i++) {

    var id = this.identifiers[i];

    if (id.parent_type == "VariableDeclarator"
        || id.parent_type == "FunctionDeclaration") {

      // bypass same name in arguments
      if (this.findNameInArguments(id.name) !== undefined)
        continue;

      if (this.findNameInLocals(id.name) !== undefined)
        continue;

      this.localvars.push({
        name : id.name
      });
    }
  }
}

FunctionNode.prototype.findNameInLexicals = function(name) {

  if (this.lexicals.length === 0)
    return;

  for (var i = 0; i < this.lexicals.length; i++) {
    if (this.lexicals[i].name === name)
      return i;
  }
}

FunctionNode.prototype.findNameInUnresolved = function(name) {

  if (this.unresolved.length === 0)
    return;

  for (var i = 0; i < this.unresolved.length; i++) {
    if (this.unresolved[i].name === name)
      return i;
  }
}

FunctionNode.prototype.fillLexicals = function() {

  for (var fnode = this.parent; fnode !== undefined; fnode = fnode.parent) {
    if (fnode.lexicalsFilled !== true) {
      throw "not all ancestors' lexicals filled.";
    }
  }

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
    this.findNameInUnresolved(id.name) !== undefined)
      continue;

    var from, slot, stack = [];
    for (var fnode = this; fnode.parent !== undefined; fnode = fnode.parent) {

      if ((slot = fnode.parent.findNameInArguments(id.name)) !== undefined) {
        from = "argument";
      } else if ((slot = fnode.parent.findNameInLocals(id.name)) !== undefined) {
        from = "local";
      } else if ((slot = fnode.parent.findNameInLexicals(id.name)) !== undefined) {
        from = "lexical";
      } else {
        stack.push(fnode);
        continue;
      }
      break;
    }

    if (from !== undefined) { // id.name found in fnode's from/slot 
      
      fnode.lexicals.push(new Lexical(id.name, from, slot));
      
      from = "lexical";
      slot = fnode.lexicals.length - 1;
      while (stack.length > 0) {
        var fn = stack.pop();
        fn.lexicals.push(new Lexical(id.name, from, slot));
        slot = fn.lexicals.length - 1;
      }
      
    } else { // push id.name into unresolved

      this.unresolved.push({
        name : id.name
      });
    }
  }
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
    if (!astnode || typeof astnode.type !== "string")
      return;

    if (astnode.type == "Program") {

      fnode = new FunctionNode(funcnode_uid++, astnode, undefined);

      // reverse annotation for debug
      astnode.fnode = fnode;
      rootnode = fnode;
      currentFuncNode = fnode;
    } else if (astnode.type == "FunctionDeclaration"
        || astnode.type == "FunctionExpression") {

      fnode = new FunctionNode(funcnode_uid++, astnode, currentFuncNode);

      // reverse annotation for debug
      astnode.fnode = fnode;
      currentFuncNode.children.push(fnode);
      currentFuncNode = fnode;
    }

    for ( var prop in astnode) {

      // bypass parent link
      if (prop === "__parent__")
        continue;

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

FunctionNode.prototype.fillIdentifiers = function() {

  var fnode = this;

  function printIdentifier(identifier) {

    var indexString = identifier.prop_index === undefined ? "" : "["
        + identifier.prop_index + "]";

    console.log("Identifier: " + identifier.name + " in "
        + identifier.parent_type + " as " + identifier.prop_name + indexString);
  }

  function visit(astnode) {

    if (astnode.type == "Identifier") {

      var parent = astnode.__parent__;
      if (parent === undefined)
        throw "error";

      var identifier = new Identifier(astnode.name, parent.type);

      for ( var name in parent) {

        if (name === "__parent__")
          continue;

        if (name === "fnode")
          continue;

        var prop = parent[name];

        if (prop && typeof prop === 'object') {
          // is array
          // if (typeof prop.length === 'number' && prop.splice) {
          if (Array.isArray(prop) === true) {
            for (var i = 0; i < prop.length; i++) {
              if (prop[i] === astnode) {
                identifier.prop_name = name;
                identifier.prop_index = i;
              }
            }
          } else {
            if (prop === astnode) {
              identifier.prop_name = name;
            }
          }
        }
      }

      if (identifier.prop_name === undefined)
        throw "error";

      printIdentifier(identifier);
      fnode.identifiers.push(identifier);
      return;

    } else if (astnode.type === "FunctionDeclaration") {

      var identifier = new Identifier(astnode.id.name, astnode.type);
      identifier.prop_name = "id";

      printIdentifier(identifier);
      fnode.identifiers.push(identifier);
      return;

    } else if (astnode.type === "FunctionExpression") {
      return;
    }

    for ( var name in astnode) {

      if (name === "__parent__")
        continue;

      if (name === "fnode")
        continue;

      var prop = astnode[name];
      if (prop && typeof prop == 'object') {
        if (typeof prop.length == 'number' && prop.splice) {
          // Prop is an array.
          for (var i = 0; i < prop.length; i++) {
            visit(prop[i]);
          }
        } else {
          visit(prop);
        }
      }
    }
  }

  visit(this.astnode);
}

/**
 * 
 * Annotate function node
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

    function recurse(child) {
      fill_locals(child);
    }

    for ( var name in astnode) {

      if (name === "__parent__")
        continue;

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

      if (USE_RB_TEST === true && astnode.name === "rb_test"
          && astnode.__parent__.type === "CallExpression") {
        // bypass this identifier
      } else if (ast_stack.length > 0
          && ast_stack[0].type === "MemberExpression"
          && astnode === ast_stack[0].property) {
        // bypass property identifier but not object
      } else {
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
        // console.log('id: ' + name + ' found in locals');
      } else if (find_name_in_parameters(name)) {
        // console.log('id: ' + name + ' found in parameters');
      } else if (find_name_in_freevars(name)) {
        // console.log('id: ' + name + ' found in freevars');
      } else {
        fnode.freevars.push({
          name : name,
        });
        // console.log('id: ' + name + ' set as new freevar');
      }
    }

    function recurse(child) {
      ast_stack.unshift(astnode);
      fill_ids(child);
      ast_stack.shift(astnode);
    }

    for ( var name in astnode) {
      if (name === "__parent__")
        continue;

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

  // console.log("fnode : " + fnode.uid);
  // console.log(" parameters: " + JSON.stringify(fnode.parameters));
  // console.log(" locals: " + JSON.stringify(fnode.locals));
  // console.log(" freevars: " + JSON.stringify(fnode.freevars));
};

function find_name_in_params(fn, name) {
  for (var i = 0; i < fn.parameters.length; i++) {
    if (fn.parameters[i].name === name) {
      return i;
    }
  }
}

function find_name_in_locals(fn, name) {
  for (var i = 0; i < fn.locals.length; i++) {
    if (fn.locals[i].name === name) {
      return i;
    }
  }
}

function find_name_in_freevars(fn, name) {
  for (var i = 0; i < fn.freevars.length; i++) {
    if (fn.freevars[i].name === name) {
      return i;
    }
  }
}

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

function prepare(astroot, opt_logftree) {

  populate_parent(astroot);

  var fnroot = build_function_tree(astroot);

  if (opt_logftree === true) {
    // output ftree after build
    console.log(JSON.stringify(fnroot, function(key, value) {
      if (key === "parent") { // suppress circular reference
        return (value === undefined) ? undefined : value.uid;
      } else if (key === "astnode") { // supress ast node
        return undefined;
      } else
        return value;
    }, 2));
  }

  fnode_visit(fnroot, function(fn) {
    // populate_identifiers(fn);
    fn.fillIdentifiers();
  });

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

    // console.log(fn.uid + ' freevars : ' + fn.freevars.length);
    for (var i = 0; i < fn.freevars.length; i++) {
      var v = fn.freevars[i];
      // console.log(' name: ' + v.name + ', from: ' + v.from + ', slot: '
      // + v.slot);
    }
  });

  return fnroot;
}

// /////////////////////////////////////////////////////////////////////////////

var _code_label = 1;

function newLabel() {
  return _code_label++;
}

function emitLabel(fn, label) {

  fn.emit({
    op : "LABEL",
    arg1 : label
  });
}

function emitJUMP(fn, to) {

  fn.emit({
    op : "JUMP",
    arg1 : to
  })
}

function emitJUMPC(fn, t, f) {
  fn.emit({
    op : "JUMPC",
    arg1 : t,
    arg2 : f
  });
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
  fn.emit({
    op : '=',
  });
}

// dispatcher
function compileAST(fn, ast, silent) {

  var expect;

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
    fn.emit({
      op : '+'
    });
    break;

  case '*':
    fn.emit({
      op : '*'
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

    if (ast.arguments.length !== 1 || ast.arguments[0].type !== "Literal")
      throw "Incorrect rb_test usage";

    emitcode(fn, "TEST", ast.arguments[0].value);
    emitcode(fn, "LITN", 1);
    return;
  }

  // put arguments
  for (var i = 0; i < ast.arguments.length; i++) {
    compileAST(fn, ast.arguments[i]);
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
  compileAST(fn, ast.callee);

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
  throw "error";
}

function compileExpressionStatement(fn, ast) {
  // interface ExpressionStatement <: Statement {
  // type: "ExpressionStatement";
  // expression: Expression;
  // }

  compileAST(fn, ast.expression);
  fn.emit({
    op : "DROP",
  })
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

  var i;
  if (ast.__parent__.type === "MemberExpression") {
    if (ast === ast.__parent__.object) {
      // find identifier in scope
    } else if (ast === ast.__parent__.property) {
      // treat identifier as operator
      emitcode(fn, "LITA", "PROP", ast.name);
      return;
    }
  }

  var index = find_name_in_params(fn, ast.name);
  if (index !== undefined) {
    fn.emit({
      op : 'LITA',
      arg1 : 'PARAM',
      arg2 : index
    });
  } else {
    index = find_name_in_locals(fn, ast.name);
    if (index !== undefined) {
      fn.emit({
        op : 'LITA',
        arg1 : 'LOCAL',
        arg2 : index
      });
    } else {
      index = find_name_in_freevars(fn, ast.name);
      if (index !== undefined) {
        fn.emit({
          op : 'LITA',
          arg1 : 'FRVAR',
          arg2 : index
        });
      } else
        throw "Identifier: " + ast.name + " not found";
    }
  }

  if (exprAsVal(ast)) {
    emitcode(fn, "FETCH");
  }
}

// interface IfStatement <: Statement {
// type: "IfStatement";
// test: Expression;
// consequent: Statement;
// alternate: Statement | null;
// }
function compileIfStatement(fn, ast) {

  var begin = newLabel();
  var after = newLabel();
  var t = newLabel();
  var f = newLabel();

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
  fn.emit({
    op : "LITC",
    arg1 : ast.value
  });
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
    emitcode(fn, "FETCH");
  }
}

// interface ObjectExpression <: Expression {
// type: "ObjectExpression";
// properties: [ Property ];
// }
function compileObjectExpression(fn, ast) {
  emitcode(fn, "LITO");
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
  if (ast.argument == null) {
    fn.emit({
      op : "RET",
    });
  } else {
    compileAST(fn, ast.argument);
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

/**
 * 
 * @param fn
 *          function node
 * @param ast
 *          ast node
 */
function compileVariableDeclarator(fn, ast) {
  // interface VariableDeclarator <: Node {
  // type: "VariableDeclarator";
  // id: Pattern;
  // init: Expression | null;
  // }
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

    compileAST(fn, ast.init);

    fn.emit({
      op : "STORE",
    })
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

  fn.emit({
    op : "LITN",
    arg1 : fn.locals.length
  });

  if (fn.astnode.type === "Program") {
    compileAST(fn, fn.astnode, silent);
  } else if (fn.astnode.type === "FunctionDeclaration"
      || fn.astnode.type === "FunctionExpression") {
    compileAST(fn, fn.astnode.body, silent);
  } else {
    throw "Unexpected fnode ast type";
  }

  if (fn.code.length > 0 && fn.code[fn.code.length - 1].op === "RET")
    return;

  fn.emit({
    op : "RET"
  });
}

function compile(node, silent) {

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
