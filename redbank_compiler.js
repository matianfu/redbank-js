'use strict';

/******************************************************************************
11 Expressions
11.1 Primary Expressions
11.1.1 The this Keyword
11.1.2 Identifier Reference
11.1.3 Literal Reference
11.1.4 Array Initialiser
11.1.5 Object Initialiser
11.1.6 The Grouping Operator
11.2 Left-Hand-Side Expressions
11.2.1 Property Accessors
11.2.2 The new Operator
11.2.3 Function Calls
11.2.4 Argument Lists
11.2.5 Function Expressions
11.3 Postfix Expressions
11.3.1 Postfix Increment Operator
11.3.2 Postfix Decrement Operator
11.4 Unary Operators
11.4.1 The delete Operator
11.4.2 The void Operator
11.4.3 The typeof Operator
11.4.4 Prefix Increment Operator
11.4.5 Prefix Decrement Operator
11.4.6 Unary + Operator
11.4.7 Unary - Operator
11.4.8 Bitwise NOT Operator ( ~ )
11.4.9 Logical NOT Operator ( ! )
11.5 Multiplicative Operators
11.5.1 Applying the * Operator
11.5.2 Applying the / Operator
11.5.3 Applying the % Operator
11.6 Additive Operators
11.6.1 The Addition operator ( + )
11.6.2 The Subtraction Operator ( - )
11.6.3 Applying the Additive Operators to Numbers
11.7 Bitwise Shift Operators
11.7.1 The Left Shift Operator ( << )
11.7.2 The Signed Right Shift Operator ( >> )
11.7.3 The Unsigned Right Shift Operator ( >>> )
11.8 Relational Operators
11.8.1 The Less-than Operator ( < )
11.8.2 The Greater-than Operator ( > )
11.8.3 The Less-than-or-equal Operator ( <= )
11.8.4 The Greater-than-or-equal Operator ( >= )
11.8.5 The Abstract Relational Comparison Algorithm
11.8.6 The instanceof operator
11.8.7 The in operator
11.9 Equality Operators
11.9.1 The Equals Operator ( == )
11.9.2 The Does-not-equals Operator ( != )
11.9.3 The Abstract Equality Comparison Algorithm
11.9.4 The Strict Equals Operator ( === )
11.9.5 The Strict Does-not-equal Operator ( !== )
11.9.6 The Strict Equality Comparison Algorithm
11.10 Binary Bitwise Operators
11.11 Binary Logical Operators
11.12 Conditional Operator ( ? : )
11.13 Assignment Operators
11.13.1 Simple Assignment ( = )
11.13.2 Compound Assignment ( op= )
11.14 Comma Operator ( , )
12 Statements
12.1 Block
12.2 Variable Statement
12.2.1 Strict Mode Restrictions
12.3 Empty Statement
12.4 Expression Statement
12.5 The if Statement
12.6 Iteration Statements
12.6.1 The do-while Statement
12.6.2 The while Statement
12.6.3 The for Statement
12.6.4 The for-in Statement
12.7 The continue Statement
12.8 The break Statement
12.9 The return Statement
12.10 The with Statement
12.10.1 Strict Mode Restrictions
12.11 The switch Statement
12.12 Labelled Statements
12.13 The throw Statement
12.14 The try Statement
12.14.1 Strict Mode Restrictions
12.15 The debugger statement
13 Function Definition
13.1 Strict Mode Restrictions
13.2 Creating Function Objects
13.2.1 [[Call]]
13.2.2 [[Construct]]
13.2.3 The [[ThrowTypeError]] Function Object
14 Program
14.1 Directive Prologues and the Use Strict Directive
15 Standard Built-in ECMAScript Objects
15.1 The Global Object
15.1.1 Value Properties of the Global Object
15.1.2 Function Properties of the Global Object
15.1.3 URI Handling Function Properties
15.1.4 Constructor Properties of the Global Object
15.1.5 Other Properties of the Global Object
15.2 Object Objects
15.2.1 The Object Constructor Called as a Function
15.2.2 The Object Constructor
15.2.3 Properties of the Object Constructor
15.2.4 Properties of the Object Prototype Object
15.2.5 Properties of Object Instances
15.3 Function Objects
15.3.1 The Function Constructor Called as a Function
15.3.2 The Function Constructor
15.3.3 Properties of the Function Constructor
15.3.4 Properties of the Function Prototype Object
15.3.5 Properties of Function Instances
15.4 Array Objects
15.4.1 The Array Constructor Called as a Function
15.4.2 The Array Constructor
15.4.3 Properties of the Array Constructor
15.4.4 Properties of the Array Prototype Object
15.4.5 Properties of Array Instances
15.5 String Objects
15.5.1 The String Constructor Called as a Function
15.5.2 The String Constructor
15.5.3 Properties of the String Constructor
15.5.4 Properties of the String Prototype Object
15.5.5 Properties of String Instances
15.6 Boolean Objects
15.6.1 The Boolean Constructor Called as a Function
15.6.2 The Boolean Constructor
15.6.3 Properties of the Boolean Constructor
15.6.4 Properties of the Boolean Prototype Object
15.6.5 Properties of Boolean Instances
15.7 Number Objects
15.7.1 The Number Constructor Called as a Function
15.7.2 The Number Constructor
15.7.3 Properties of the Number Constructor
15.7.4 Properties of the Number Prototype Object
15.7.5 Properties of Number Instances
15.8 The Math Object
15.8.1 Value Properties of the Math Object
15.8.2 Function Properties of the Math Object
15.9 Date Objects
15.9.1 Overview of Date Objects and Definitions of Abstract Operators
15.9.2 The Date Constructor Called as a Function
15.9.3 The Date Constructor
15.9.4 Properties of the Date Constructor
15.9.5 Properties of the Date Prototype Object
15.9.6 Properties of Date Instances
15.10 RegExp (Regular Expression) Objects
15.10.1 Patterns
15.10.2 Pattern Semantics
15.10.3 The RegExp Constructor Called as a Function
15.10.4 The RegExp Constructor
15.10.5 Properties of the RegExp Constructor
15.10.6 Properties of the RegExp Prototype Object
15.10.7 Properties of RegExp Instances
15.11 Error Objects
15.11.1 The Error Constructor Called as a Function
15.11.2 The Error Constructor
15.11.3 Properties of the Error Constructor
15.11.4 Properties of the Error Prototype Object
15.11.5 Properties of Error Instances
15.11.6 Native Error Types Used in This Standard
15.11.7 NativeError Object Structure
15.12 The JSON Object
15.12.1 The JSON Grammar
15.12.2 parse ( text [ , reviver ] )
15.12.3 stringify ( value [ , replacer [ , space ] ] )
 */

var Common = require('./common.js');

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
    if (expr === parent.object) {
      return true;
    }
    else if (expr === parent.property) {
      return false;
    }
    else {
      throw "Unknown role for " + pt;
    }
  }
  else if (pt === "BinaryExpression") {
    return true;
  }
  else if (pt === "VariableDeclarator") {
    if (expr === parent.id) {
      return false;
    }
    else if (expr === parent.init) {
      return true;
    }
    else {
      throw "error";
    }
  }
  else if (pt === "CallExpression") {
    return true; // TODO need check error
  }
  else if (pt === "ReturnStatement") {
    if (expr === parent.argument) {
      return true;
    }
    else {
      throw "error";
    }

  }
  else if (pt === "Property") {

  }
  else if (pt === "NewExpression") {
    
  }
  else {
    console.log("exprAsVal: " + pt + " not supported yet");
    throw "error";
  }
}

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

        // skip cyclic reference
        // at least for try-statement
        if (prop === '__parent__') {
          continue;
        }

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
    console.log(Common.Format.dotline + bytecode.op + ' '
        + ((bytecode.arg1 === undefined) ? '' : bytecode.arg1) + ' '
        + ((bytecode.arg2 === undefined) ? '' : bytecode.arg2) + ' '
        + ((bytecode.arg3 === undefined) ? '' : bytecode.arg3));
  }
};

FunctionNode.prototype.emit = function(op, arg1, arg2, arg3) {
  this.emitBytecode(new Bytecode(op, arg1, arg2, arg3));
};

/*
 * unconditional jump
 */
FunctionNode.prototype.emitJUMP = function(to) {
  this.emit("JUMP", to);
};

/**
 * conditional jump
 * 
 * @param f
 *          label for false block
 */
FunctionNode.prototype.emitJUMPC = function(f) {
  this.emit("JUMPC", f);
};

FunctionNode.prototype.emitLabel = function(label) {
  this.emit("LABEL", label);
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
    var name, prop, i;

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

          prop = parent[name];
          if (prop && typeof prop === 'object') {
            if (Array.isArray(prop) === true) {
              for (i = 0; i < prop.length; i++) {
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
      if (astnode.hasOwnProperty(name)) {

        if (name === "__parent__" || name === "fnode") {
          continue;
        }

        // bypass spider-monkey specific try/catch handlers
        if (astnode.type === "TryStatement") {
          if (name === "handlers" || name === "guardedHandlers") {
            continue;
          }
        }

        prop = astnode[name];
        if (prop && typeof prop === 'object') {
          if (typeof prop.length === 'number' && prop.splice) {
            // Prop is an array.
            for (i = 0; i < prop.length; i++) {
              visit(prop[i]);
            }
          }
          else {
            visit(prop);
          }
        }
      }
    }
  } // End of function Visit

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
 * This function can only be used in pre-order visitor
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

// interface ArrayExpression <: Expression {
// type: "ArrayExpression";
// elements: [ Expression | null ];
// }
FunctionNode.prototype.compileArrayExpression = function(ast) {
  this.emit("ARRAY");
};

// interface AssignmentExpression <: Expression {
// type: "AssignmentExpression";
// operator: AssignmentOperator;
// left: Pattern;
// right: Expression;
// }
FunctionNode.prototype.compileAssignmentExpression = function(ast) {
  this.compileAST(ast.left);
  this.compileAST(ast.right);
  this.emit("GETVAL");
  this.emit('=');
};

FunctionNode.prototype.compileAST = function(ast, silent) {

  indent_incr();

  switch (ast.type) {
  case "ArrayExpression":
    this.compileArrayExpression(ast);
    break;

  case "AssignmentExpression":
    this.compileAssignmentExpression(ast);
    break;

  case "BinaryExpression":
    this.compileBinaryExpression(ast);
    break;

  case "BlockStatement":
    this.compileBlockStatement(ast);
    break;

  case "CallExpression":
    this.compileCallExpression(ast);
    break;

  case "CatchClause":
    this.compileCatchClause(ast);
    break;

  case "ExpressionStatement":
    this.compileExpressionStatement(ast);
    break;
    
  case "ForStatement":
    this.compileForStatement(ast);
    break;

  case "FunctionExpression":
    this.compileFunctionExpression(ast);
    break;

  case "Identifier":
    this.compileIdentifier(ast);
    break;

  case "IfStatement":
    this.compileIfStatement(ast);
    break;

  case "Literal":
    this.compileLiteral(ast);
    break;

  case "MemberExpression":
    this.compileMemberExpression(ast);
    break;
    
  case "NewExpression":
    this.compileNewExpression(ast);
    break;

  case "ObjectExpression":
    this.compileObjectExpression(ast);
    break;

  case "Program":
    this.compileProgram(ast);
    break;

  case "Property":
    this.compileProperty(ast);
    break;

  case "ReturnStatement":
    this.compileReturnStatement(ast);
    break;

  case "ThisExpression":
    this.compileThisExpression(ast);
    break;

  case "ThrowStatement":
    this.compileThrowStatement(ast);
    break;

  case "TryStatement":
    this.compileTryStatement(ast);
    break;
    
  case "UnaryExpression":
    this.compileUnaryExpression(ast);
    break;
    
  case "UpdateExpression":
    this.compileUpdateExpression(ast);
    break;

  case "VariableDeclaration":
    this.compileVariableDeclaration(ast);
    break;

  case "VariableDeclarator":
    this.compileVariableDeclarator(ast);
    break;

  default:
    throw "compileAST : " + ast.type + " not dispatched";
  }

  // TODO
  astlog("}");
  indent_decr();
};

// interface BinaryExpression <: Expression {
// type: "BinaryExpression";
// operator: BinaryOperator;
// left: Expression;
// right: Expression;
// }
FunctionNode.prototype.compileBinaryExpression = function(ast) {

  this.compileAST(ast.left);
  this.emit("GETVAL");
  this.compileAST(ast.right);
  this.emit("GETVAL");
  this.emit("BINOP", ast.operator);
  return;
};

// interface BlockStatement <: Statement {
// type: "BlockStatement";
// body: [ Statement ];
// }
FunctionNode.prototype.compileBlockStatement = function(ast) {
  for (var i = 0; i < ast.body.length; i++) {
    this.compileAST(ast.body[i]);
  }
};

// interface CallExpression <: Expression {
// type: "CallExpression";
// callee: Expression;
// arguments: [ Expression ];
// }
FunctionNode.prototype.compileCallExpression = function(ast) {

  if (USE_RB_TEST && ast.callee.type === "Identifier"
      && ast.callee.name === "rb_test") {

    if (ast.arguments.length !== 1 || ast.arguments[0].type !== "Literal") {
      throw "Incorrect rb_test usage";
    }

    this.emit("TEST", ast.arguments[0].value);
    this.emit("LITN", 1);
    return;
  }

  /**
   * 11.2.3 callee is left-hand-side
   */
  this.compileAST(ast.callee);
  this.emit("CALLEXP");

  // put arguments
  for (var i = 0; i < ast.arguments.length; i++) {
    this.compileAST(ast.arguments[i]);
    this.emit("GETVAL");
  }

  // put argc
  this.emit("LITC", ast.arguments.length);

  // do call
  this.emit("CALL");
};

// interface CatchClause <: Node {
// type: "CatchClause";
// param: Pattern;
// guard: Expression | null;
// body: BlockStatement;
// }
FunctionNode.prototype.compileCatchClause = function(ast) {
  this.compileAST(ast.body);
};

// interface ConditionalExpression <: Expression {
// type: "ConditionalExpression";
// test: Expression;
// alternate: Expression;
// consequent: Expression;
// }
FunctionNode.prototype.compileConditionalExpression = function(ast) {
  throw "error";
};

// interface ForStatement <: Statement {
// type: "ForStatement";
// init: VariableDeclaration | Expression | null;
// test: Expression | null;
// update: Expression | null;
// body: Statement;
// }
FunctionNode.prototype.compileForStatement = function(ast) {

  var test = this.compiler.newLabel();
  var after = this.compiler.newLabel();
  // var t = this.compiler.newLabel();
  var cont = this.compiler.newLabel();

  // do init first
  this.compileAST(ast.init);

  // do test, quit if fail
  this.emitLabel(test);
  this.compileAST(ast.test);
  this.emitJUMPC(after);

  // do body
  this.compileAST(ast.body);

  // do update
  this.emitLabel(cont);
  this.compileAST(ast.update);
  // goto test
  this.emitJUMP(test);
  this.emitLabel(after);
};

// interface ExpressionStatement <: Statement {
// type: "ExpressionStatement";
// expression: Expression;
// }
FunctionNode.prototype.compileExpressionStatement = function(ast) {
  this.compileAST(ast.expression);
  this.emit("DROP");
};

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
FunctionNode.prototype.compileFunctionDeclaration = function(ast) {
  throw "error";
};

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
FunctionNode.prototype.compileFunctionExpression = function(ast) {

  var fn = ast.fnode;
  var lexnum = fn.lexicals.length;

  // replace with offset in backpatching
  this.emit('FUNC', fn, lexnum, ast.params.length);

  for (var i = 0; i < lexnum; i++) {
    this.emit("CAPTURE", fn.lexicals[i].from, fn.lexicals[i].slot, i);
  }
};

// interface Identifier <: Node, Expression, Pattern {
// type: "Identifier";
// name: string;
// }
FunctionNode.prototype.compileIdentifier = function(ast) {

  var i;

  if (ast.__parent__.type === "Property" && ast === ast.__parent__.key) {
    // treat identifier of Property's key as literal
    this.emit("LITA", "PROP", ast.name);
    return;
  }

  if (ast.__parent__.type === "MemberExpression") {
    if (ast === ast.__parent__.property) {
      // treat identifier as operator
      this.emit("LITA", "PROP", ast.name);
      return;
    }
  }

  /**
   * if this is a CatchClause param, such as catch (e)
   */
  var depth = 0;
  for (var x = ast; x.__parent__ !== null
      && x.__parent__.type !== 'FunctionDeclaration'
      && x.__parent__.type !== 'FunctionExpression'; x = x.__parent__) {

    if (x.__parent__.type === 'CatchClause') {
      if (ast.name === x.__parent__.param.name) {

        this.emit('LITA', 'CATCH', depth);

//        if (exprAsVal(ast)) {
//          this.emit('FETCHA');
//        }
        return;
      }
      depth++;
    }
  }

  /**
   * normal lookup
   */
  var index = this.findNameInArguments(ast.name);
  if (index !== undefined) {
    this.emit('LITA', 'PARAM', index);
  }
  else {

    index = this.findNameInLocals(ast.name);
    if (index !== undefined) {
      this.emit('LITA', 'LOCAL', index);
    }
    else {

      index = this.findNameInLexicals(ast.name);
      if (index !== undefined) {
        this.emit('LITA', 'LEXICAL', index);
      }
      else {
        this.emit('LITA', 'GLOBAL', ast.name);

        if (exprAsVal(ast)) {
          this.emit("FETCHO");
        }
        return;
      }
    }
  }

//  if (exprAsVal(ast)) {
//    this.emit("FETCHA");
//  }
};

// interface IfStatement <: Statement {
// type: "IfStatement";
// test: Expression;
// consequent: Statement;
// alternate: Statement | null;
// }
FunctionNode.prototype.compileIfStatement = function(ast) {

  var after = this.compiler.newLabel();
  var f = this.compiler.newLabel();

  // do test, jump to false block if false
  this.compileAST(ast.test);
  this.emitJUMPC(f);

  // fall-through true block and bypass false block
  this.compileAST(ast.consequent);
  this.emitJUMP(after);

  // false block, may be empty
  this.emitLabel(f);
  if (ast.alternate !== null) {
    this.compileAST(ast.alternate);
  }
  this.emitLabel(after);
};

// interface Literal <: Node, Expression {
// type: "Literal";
// value: string | boolean | null | number | RegExp;
// }
FunctionNode.prototype.compileLiteral = function(ast) {
  this.emit("LITC", ast.value);
};

// interface MemberExpression <: Expression {
// type: "MemberExpression";
// object: Expression;
// property: Identifier | Expression;
// computed: boolean;
// }
FunctionNode.prototype.compileMemberExpression = function(ast) {

  this.compileAST(ast.object);
  this.emit("GETVAL");
  this.compileAST(ast.property);
  this.emit("GETVAL");
  this.emit("MEMEXP");
};

// interface NewExpression <: Expression {
// type: "NewExpression";
// callee: Expression;
// arguments: [ Expression ];
// }
FunctionNode.prototype.compileNewExpression = function(ast) {
  
  this.compileAST(ast.callee);
  this.emit("GETVAL");
  this.emit("LITN", 1);
  for (var i = 0; i < ast.arguments.length; i++) {
    this.compileAST(ast.arguments[i]);
  }
  this.emit("LITC", ast.arguments.length);
  this.emit("NEWEXP");
};

// interface ObjectExpression <: Expression {
// type: "ObjectExpression";
// properties: [ Property ];
// }
FunctionNode.prototype.compileObjectExpression = function(ast) {

  // place an empty object on stack
  this.emit("LITO");

  for (var i = 0; i < ast.properties.length; i++) {
    this.compileAST(ast.properties[i]);
  }
};

// interface Program <: Node {
// type: "Program";
// body: [ Statement ];
// }
FunctionNode.prototype.compileProgram = function(ast) {
  for (var i = 0; i < ast.body.length; i++) {
    this.compileAST(ast.body[i]);
  }
};

/**
 * Property interface only occurs in 'ObjectExpression' as 'properties'
 * 
 * interface Property <: Node { type: "Property"; key: Literal | Identifier;
 * value: Expression; kind: "init" | "get" | "set"; }
 * 
 * @param ast
 */
FunctionNode.prototype.compileProperty = function(ast) {

  if (ast.kind === "init") {
    this.compileAST(ast.key);
    this.compileAST(ast.value);
    this.emit("STOREP");
  }
  else if (ast.kind === 'get') {
    // this.compileAST(ast.key);
    throw "unknown kind";
  }
  else if (ast.kind === 'set') {
    throw "unknown kind";
  }
  else {
    throw "unknown kind";
  }
};

// interface ReturnStatement <: Statement {
// type: "ReturnStatement";
// argument: Expression | null;
// }
FunctionNode.prototype.compileReturnStatement = function(ast) {
  if (ast.argument === null) {
    this.emit("RET");
  }
  else {
    this.compileAST(ast.argument);
    this.emit("GETVAL");
    this.emit("RET", "RESULT");
  }
};

// interface ThisExpression <: Expression {
// type: "ThisExpression";
// }
FunctionNode.prototype.compileThisExpression = function(ast) {
  this.emit("THIS");
};

// interface ThrowStatement <: Statement {
// type: "ThrowStatement";
// argument: Expression;
// }
FunctionNode.prototype.compileThrowStatement = function(ast) {

  this.compileAST(ast.argument);
  this.emit("THROW");
};

// interface TryStatement <: Statement {
// type: "TryStatement";
// block: BlockStatement;
// handler: CatchClause | null;
// guardedHandlers: [ CatchClause ];
// finalizer: BlockStatement | null;
// }

FunctionNode.prototype.compileTryStatement = function(ast) {

  var trap_begin = this.compiler.newLabel();
  var trap_after = this.compiler.newLabel();
  var trap_catch = (ast.handler === null) ? 0 : this.compiler.newLabel();
  var trap_final = (ast.finalizer === null) ? 0 : this.compiler.newLabel();

  this.emitLabel(trap_begin); // not necessary
  this.emit("TRAP", trap_catch, trap_final);

  this.compileAST(ast.block);
  this.emit("UNTRAP");

  if (ast.handler !== null) {
    this.emitLabel(trap_catch);
    this.compileAST(ast.handler);
    this.emit("UNTRAP");
  }

  if (ast.finalizer !== null) {
    this.emitLabel(trap_final);
    this.compileAST(ast.finalizer);
  }
};

// interface UnaryExpression <: Expression {
// type: "UnaryExpression";
// operator: UnaryOperator;
// prefix: boolean;
// argument: Expression;
// }
FunctionNode.prototype.compileUnaryExpression = function(ast) {
  
  this.compileAST(ast.argument);
  if (ast.operator === "typeof") {
    this.emit("TYPEOF");
  }
  else if (ast.operator === '!') {
    this.emit("UNAOP", ast.operator);
  }
  else {
    throw "not supported yet";
  }
};

// interface UpdateExpression <: Expression {
// type: "UpdateExpression";
// operator: UpdateOperator;
// argument: Expression;
// prefix: boolean;
// }
FunctionNode.prototype.compileUpdateExpression = function(ast) {
  /**
   * expression must be left hand side
   */
  this.compileAST(ast.argument);
  this.emit("UPDATE", ast.operator, ast.prefix);
};

// interface VariableDeclaration <: Declaration {
// type: "VariableDeclaration";
// declarations: [ VariableDeclarator ];
// kind: "var" | "let" | "const";
// }
FunctionNode.prototype.compileVariableDeclaration = function(ast) {
  for (var i = 0; i < ast.declarations.length; i++) {
    this.compileAST(ast.declarations[i]);
  }
};

// interface VariableDeclarator <: Node {
// type: "VariableDeclarator";
// id: Pattern;
// init: Expression | null;
// }
FunctionNode.prototype.compileVariableDeclarator = function(ast) {

  if (ast.init !== null) {
    var i;
    var found = false;

    for (i = 0; i < this.localvars.length; ++i) {
      if (this.localvars[i].name === ast.id.name) {
        found = true;
        break;
      }
    }

    if (found === false) {
      throw "var name " + ast.id.name + " not found!";
    }

    this.emit('LITA', 'LOCAL', i);
    this.compileAST(ast.init);
    this.emit("GETVAL");
    this.emit("STORE");
  }
};

// interface WhileStatement <: Statement {
// type: "WhileStatement";
// test: Expression;
// body: Statement;
// }
FunctionNode.prototype.compileWhileStatement = function(ast) {

  var begin = this.compiler.newLabel();
  var after = this.compiler.newLabel();
  var t = this.compiler.newLabel();
  var f = this.compiler.newLabel();

  this.emitLabel(begin);
  this.compileAST(ast.test);
  this.emitJUMPC(after);

  this.emitLabel(t);
  this.compileAST(ast.body);
  this.emitJUMP(begin);
  this.emitLabel(after);
};

/**
 * compile a function node
 * 
 * @param fn
 */
FunctionNode.prototype.compileFN = function(silent) {

  if (silent === false) {
    console.log("compileFN : " + this.uid);
  }

  this.emit("LITN", this.localvars.length);

  if (this.astnode.type === "Program") {
    this.compileAST(this.astnode, silent);
  }
  else if (this.astnode.type === "FunctionDeclaration"
      || this.astnode.type === "FunctionExpression") {
    this.compileAST(this.astnode.body, silent);
  }
  else {
    throw "Unexpected fnode ast type";
  }

  if (this.code.length > 0 && this.code[this.code.length - 1].op === "RET") {
    return;
  }

  this.emit("RET");
};

function Compiler() {
  this.label = 0;
}

Compiler.prototype.newLabel = function() {
  return this.label++;
};

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

  function visit(astnode, parent) {

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

      fnode = new FunctionNode(Compiler, funcnode_uid++, astnode,
          currentFuncNode);

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
            visit(child[i], astnode);
          }
        }
        else {
          visit(child, astnode);
        }
      }
    }

    if (astnode.type === "FunctionDeclaration"
        || astnode.type === "FunctionExpression") {

      currentFuncNode = currentFuncNode.parent;
    }
  } // End of visit

  visit(node);

  return rootnode;
}

/**
 * 
 * @param astroot
 * @param opt_logftree
 * @returns
 */
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
    fn.compileFN();
  });

  return merge(fnroot);
}

exports.compile = compile;
