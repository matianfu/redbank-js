/**
 * New node file
 */
'use strict';

var Syntax,
    Precedence,
    BinaryPrecedence,
    SourceNode,
    estraverse,
    esutils,
    isArray,
    base,
    indent,
    json,
    renumber,
    hexadecimal,
    quotes,
    escapeless,
    newline,
    space,
    parentheses,
    semicolons,
    safeConcatenation,
    directive,
    extra,
    parse,
    sourceMap,
    sourceCode,
    preserveBlankLines,
    FORMAT_MINIFY,
    FORMAT_DEFAULTS;

estraverse = require('estraverse');
esutils = require('esutils');

Syntax = estraverse.Syntax;

Precedence = {
    Sequence: 0,
    Yield: 1,
    Await: 1,
    Assignment: 1,
    Conditional: 2,
    ArrowFunction: 2,
    LogicalOR: 3,
    LogicalAND: 4,
    BitwiseOR: 5,
    BitwiseXOR: 6,
    BitwiseAND: 7,
    Equality: 8,
    Relational: 9,
    BitwiseSHIFT: 10,
    Additive: 11,
    Multiplicative: 12,
    Unary: 13,
    Postfix: 14,
    Call: 15,
    New: 16,
    TaggedTemplate: 17,
    Member: 18,
    Primary: 19
};

BinaryPrecedence = {
    '||': Precedence.LogicalOR,
    '&&': Precedence.LogicalAND,
    '|': Precedence.BitwiseOR,
    '^': Precedence.BitwiseXOR,
    '&': Precedence.BitwiseAND,
    '==': Precedence.Equality,
    '!=': Precedence.Equality,
    '===': Precedence.Equality,
    '!==': Precedence.Equality,
    'is': Precedence.Equality,
    'isnt': Precedence.Equality,
    '<': Precedence.Relational,
    '>': Precedence.Relational,
    '<=': Precedence.Relational,
    '>=': Precedence.Relational,
    'in': Precedence.Relational,
    'instanceof': Precedence.Relational,
    '<<': Precedence.BitwiseSHIFT,
    '>>': Precedence.BitwiseSHIFT,
    '>>>': Precedence.BitwiseSHIFT,
    '+': Precedence.Additive,
    '-': Precedence.Additive,
    '*': Precedence.Multiplicative,
    '%': Precedence.Multiplicative,
    '/': Precedence.Multiplicative
};

//Flags
var F_ALLOW_IN = 1,
    F_ALLOW_CALL = 1 << 1,
    F_ALLOW_UNPARATH_NEW = 1 << 2,
    F_FUNC_BODY = 1 << 3,
    F_DIRECTIVE_CTX = 1 << 4,
    F_SEMICOLON_OPT = 1 << 5;

//Expression flag sets
//NOTE: Flag order:
// F_ALLOW_IN
// F_ALLOW_CALL
// F_ALLOW_UNPARATH_NEW
var E_FTT = F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW,
    E_TTF = F_ALLOW_IN | F_ALLOW_CALL,
    E_TTT = F_ALLOW_IN | F_ALLOW_CALL | F_ALLOW_UNPARATH_NEW,
    E_TFF = F_ALLOW_IN,
    E_FFT = F_ALLOW_UNPARATH_NEW,
    E_TFT = F_ALLOW_IN | F_ALLOW_UNPARATH_NEW;

//Statement flag sets
//NOTE: Flag order:
// F_ALLOW_IN
// F_FUNC_BODY
// F_DIRECTIVE_CTX
// F_SEMICOLON_OPT
var S_TFFF = F_ALLOW_IN,
    S_TFFT = F_ALLOW_IN | F_SEMICOLON_OPT,
    S_FFFF = 0x00,
    S_TFTF = F_ALLOW_IN | F_DIRECTIVE_CTX,
    S_TTFF = F_ALLOW_IN | F_FUNC_BODY;

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

////////////////////////////////////////////////////////////////

var line_number = 0;

// Generation is done by generateExpression.
function isExpression(node) {
    return AstCompiler.Expression.hasOwnProperty(node.type);
}

// Generation is done by generateStatement.
function isStatement(node) {
    return AstCompiler.Statement.hasOwnProperty(node.type);
}

function AstCompiler() {}

AstCompiler.prototype.generateStatement = function (stmt, flags) {
  var result,
      fragment;

//  result = this[stmt.type](stmt, flags);
//
//  // Attach comments
//
//
//
//  fragment = toSourceNodeWhenNeeded(result).toString();
//  if (stmt.type === Syntax.Program && !safeConcatenation && 
//  newline === '' &&  fragment.charAt(fragment.length - 1) === '\n') {
//      result = sourceMap ? 
//  toSourceNodeWhenNeeded(result).replaceRight(/\s+$/, '') : fragment.replace(/\s+$/, '');
//  }
//
//  return toSourceNodeWhenNeeded(result, stmt);
};

AstCompiler.prototype.generateExpression = function (expr, precedence, flags) {
  var result, type;

//  type = expr.type || Syntax.Property;
//
//  if (extra.verbatim && expr.hasOwnProperty(extra.verbatim)) {
//      return generateVerbatim(expr, precedence);
//  }
//
//  result = this[type](expr, precedence, flags);
//
//
//  if (extra.comment) {
//      result = addComments(expr, result);
//  }
//  return toSourceNodeWhenNeeded(result, expr);
};

// statement

AstCompiler.Statement = {
    BlockStatement: undefined,
    BreakStatement: undefined,
    ContinueStatement: undefined,
    ClassBody: undefined,
    ClassDeclaration: undefined,
    DirectiveStatement: undefined,
    DoWhileStatement: undefined,
    CatchClause: undefined,
    DebuggerStatement: undefined,
    EmptyStatement: undefined,
    ExportDeclaration: undefined,
    
    ExpressionStatement: function(node) {
//  interface ExpressionStatement <: Statement {
//    type: "ExpressionStatement";
//    expression: Expression;
//  }
//  
      this[node.expression.type](node.expression);
      
    },
      
    ImportDeclaration: undefined,
    VariableDeclarator: undefined,
    VariableDeclaration: undefined,
    ThrowStatement: undefined,
    TryStatement: undefined,
    SwitchStatement: undefined,
    SwitchCase: undefined,
    IfStatement: undefined,
    ForStatement: undefined,
    ForInStatement: undefined,
    ForOfStatement: undefined,
    LabeledStatement: undefined,
    
    Program: function(stmt, flags)
    {
      
//    interface Program <: Node {
//        type: "Program";
//        body: [ Statement ];
//    }
      
      emit("program");
      emit("create global scope, how?");

      var result, fragment, i, iz, bodyFlags;
      iz = stmt.body.length;
      
      for (i = 0; i < iz; ++i)
      {
        if (isStatement(stmt.body[i]))
          this.generateStatement(stmt.body[i]);
        else if (isExpression(stmt.body[i]))
          this.generateExpression(stmt.body[i]);
      }
      
      return undefined;
    },
    
    FunctionDeclaration: undefined,
    ReturnStatement: undefined,
    WhileStatement: undefined,
    WithStatement: undefined,
    
}

merge(AstCompiler.prototype, AstCompiler.Statement);

AstCompiler.Expression = {
    SequenceExpression: undefined,
    AssignmentExpression: undefined,
    ArrowFunctionExpression: undefined,
    ConditionalExpression: undefined,
    LogicalExpression: undefined,
    
    BinaryExpression: function(node)
    {
//    interface BinaryExpression <: Expression {
//        type: "BinaryExpression";
//        operator: BinaryOperator;
//        left: Expression;
//        right: Expression;
//    }
      this[node.left.type](node.left);
      this[node.right.type](node.right);
      switch (node.operator)
      {
      case '+': emit('OP_ADD'); break;
      case '*': emit('OP_MUL'); break;
      default:
      }
    },
    
    CallExpression: undefined,
    NewExpression: undefined,
    MemberExpression: undefined,
    UnaryExpression: undefined,
    YieldExpression: undefined,
    AwaitExpression: undefined,
    UpdateExpression: undefined,
    FunctionExpression: undefined,
    ExportBatchSpecifier: undefined,
    ArrayPattern: undefined,
    ArrayExpression: undefined,
    ClassExpression: undefined,
    MethodDefinition: undefined,
    Property: undefined,
    ObjectExpression: undefined,
    ObjectPattern: undefined,
    ThisExpression: undefined,
    Identifier: undefined,
    ImportDefaultSpecifier: undefined,
    ImportNamespaceSpecifier: undefined,
    ImportSpecifier: undefined,
    ExportSpecifier: undefined,

    Literal: function(node) {
//interface Literal <: Node, Expression {
//  type: "Literal";
//  value: string | boolean | null | number | RegExp;
//}   
      emit('PUSH ' + node.value);
    },

    GeneratorExpression: undefined,
    ComprehensionExpression: undefined,
    ComprehensionBlock: undefined,
    SpreadElement: undefined,
    TaggedTemplateExpression: undefined,
    TemplateElement: undefined,
    TemplateLiteral: undefined,
    ModuleSpecifier: undefined,
}

merge(AstCompiler.prototype, AstCompiler.Expression);



AstCompiler.prototype.generateStatement = function (stmt, flags) {
  var result,
      fragment;

    result = this[stmt.type](stmt, flags);
//
//  // Attach comments
//
//  if (extra.comment) {
//      result = addComments(stmt, result);
//  }
//
//  fragment = toSourceNodeWhenNeeded(result).toString();
//  if (stmt.type === Syntax.Program && !safeConcatenation && newline === 
//    '' &&  fragment.charAt(fragment.length - 1) === '\n') {
//      result = sourceMap ? toSourceNodeWhenNeeded(result).replaceRight(/\s+$/, '') : 
//    fragment.replace(/\s+$/, '');
//  }
//
//  return toSourceNodeWhenNeeded(result, stmt);
};

/**
 * build the function node tree
 * @param node must be the root node of ast
 * @returns root node of function node tree
 */
function build_function_tree(node) {

  var rootnode; // the root node of tree
  var funcnode_uid = 0; // unique id
  var currentFuncNode;  // iterator

  function visit(ast_node, parent, prop, idx) {

    var fnode;

    // every ast node has a type property
    if (!ast_node || typeof ast_node.type !== "string") {
      return;
    }

    console.log('visit: ' + ast_node.type);

    if (ast_node.type == "Program") {
      fnode = {
        uid : funcnode_uid++,
        astnode : ast_node,
        parent : null,
        children : [],
        parameters : [],
        locals : [],
        freevars : [],
      };
      
      // reverse annotation for debug
      ast_node.function_uid = fnode.uid;
      
      rootnode = fnode;
      currentFuncNode = fnode;
    }

    if (ast_node.type == "FunctionDeclaration" || ast_node.type == "FunctionExpression") {
      fnode = {
        uid : funcnode_uid++,
        astnode : ast_node,
        parent : currentFuncNode,
        children : [],
        parameters : [],
        locals : [],
        freevars : [],
      };
      
      // reverse annotation for debug
      ast_node.function_uid = fnode.uid;

      currentFuncNode.children.push(fnode);
      currentFuncNode = fnode;
    }

    for ( var prop in ast_node) {
      var child = ast_node[prop];

      if (Array.isArray(child)) {
        for (var i = 0; i < child.length; i++) {
          visit(child[i], ast_node, prop, i);
        }
      } else {
        visit(child, ast_node, prop);
      }
    }

    if (ast_node.type == "FunctionDeclaration" || ast_node.type == "FunctionExpression") {

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
  
  function find_name_in_locals(name)
  {
    var i;
    if (fnode.locals.length === 0)
      return false;
    
    for (i = 0; i < fnode.locals.length; i++) {
      if (fnode.locals[i].name === name)
        return true;
    }
    
    return false;
  }
  
  function find_name_in_parameters(name)
  {
    var i;
    if (fnode.parameters.length === 0)
      return false;
    
    for (i = 0; i < fnode.parameters.length; i++) {
      if (fnode.parameters[i].name === name)
        return true;
    }
    
    return false;
  }
  
  function find_name_in_freevars(name)
  {
    var i;
    if (fnode.freevars.length === 0)
      return false;
    
    for (i = 0; i < fnode.freevars.length; i++) {
      if (fnode.freevars[i].name === name)
        return true;
    }
    
    return false;
  }

  function fill_parameters(astnode) {
    var i;
    if (astnode.type === "Program")
      return;
    
    if (astnode.type === "FunctionDeclaration") {
      for (i = 0; i < astnode.params.length; i++) {
        fnode.parameters.push({
          name: astnode.params[i].name,
        });
      }
    }
    
    if (astnode.type === "FunctionExpression") {
      for (i = 0; i < astnode.params.length; i++) {
        fnode.parameters.push({
          name: astnode.params[i].name
        });
      }
    }
  }
  
  function fill_locals(astnode) {
  
    var firstEntry = true;
    
    if (astnode.type == 'VariableDeclaration') {
      for (var i = 0; i < astnode.declarations.length; i++) {
        // this.setProperty(scope, astnode.declarations[i].id.name,
        // this.UNDEFINED);
        console.log("var: " + astnode.declarations[i].id.name);
        fnode.locals.push({
          name : astnode.declarations[i].id.name,
        });
      }
    } else if (astnode.type == 'FunctionDeclaration') {
      // this.setProperty(scope, astnode.id.name, this.createFunction(astnode,
      // scope));
      console.log("fdecl: " + astnode.id.name);
      fnode.locals.push({
        name: astnode.id.name,
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
  
  function fill_ids(astnode) {
    if (astnode.type == 'Identifier') {
      if (find_name_in_locals(astnode.name)) {
        console.log('id: ' + astnode.name + ' found in locals');
      }
      else if (find_name_in_parameters(astnode.name)) {
        console.log('id: ' + astnode.name + ' found in parameters');
      }
      else if (find_name_in_freevars(astnode.name)) {
        console.log('id: ' + astnode.name + ' found in freevars');
      }
      else {
        fnode.freevars.push({
          name: astnode.name,
        });
        console.log('id: ' + astnode.name + ' set as new freevar');
      }
      
    } else if (astnode.type == 'FunctionDeclaration') {
      // this.setProperty(scope, astnode.id.name, this.createFunction(astnode,
      // scope));
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
  
  if (astnode.type === "Program") {
    fill_locals(astnode);
  }
  else {
    fill_locals(astnode.body);
  }
  
  if (astnode.type === "Program") {
    fill_ids(astnode);
  }
  else {
    fill_ids(astnode.body);
  }
  
  console.log(fnode.parameters);
  console.log(fnode.locals);
  console.log(fnode.freevars);
};

function compile(node)
{
  console.log("boiler plate");
  
  var fnode = build_function_tree(node);
  
  console.log(JSON.stringify(fnode, function(key, value) {

    if (key === "parent") { // suppress circular reference
      return (value === null) ? undefined : value.uid;
    } 
    else if (key === "astnode") { // supress ast node
      return undefined;
    }
    else
      return value;
  }, 2));
  
  console.log(JSON.stringify(node, null, 2));
  
  annotate(fnode.children[1]);
// var compiler;
//
// compiler = new AstCompiler();
//  if (isStatement(node)) {
//      return compiler.generateStatement(node, S_TFFF);
//  }
//
//  if (isExpression(node)) {
//      return compiler.generateExpression(node, Precedence.Sequence, E_TTT);
//  }
//
//  throw new Error('Unknown node type: ' + node.type);  
  
  return undefined;
}



exports.compile = compile;