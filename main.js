/*******************************************************************************
 * 
 * Modules
 * 
 ******************************************************************************/

var Esprima_Main = require("esprima");
var readline = require("readline");

var JSInterpreter = require("./interpreter.js");
var ESCodegen_Main = require("escodegen");
var Compiler = require("./redbank_compiler.js");
var RedbankVM = require("./redbank_vm.js");
var Common = require("./common.js");

/**
 * constants
 */

/**
 * options
 */
var output_source = false;
var run_with_jsinterpreter = false;
var output_ast = false;
var generate_source_with_escodegen = false;

/**
 * don't delete these codes
 */
// // run this case with jsinterpreter
// if (run_with_jsinterpreter) {
// var interpreter = JSInterpreter.BuildInterpreter(source);
// interpreter.run();
// }
//
// // parse this case with esprima
// var ast = Esprima_Main.parse(source);
//
// // output ast in JSON Common.Format
// if (output_ast) {
// var ast_json = JSON.stringify(ast, null, 2);
// console.log(ast_json);
// }
//
// // re-generate source code with escodegen
// if (generate_source_with_escodegen) {
// var generated = ESCodegen_Main.generate(ast, undefined);
// console.log(generated);
// }
/**
 * These two nonsense functions are used for breakpoint. In nodeclipse, event
 * handler or callbacks sometimes won't stop at breakpoint.
 */
function doNothing() {
}

function breakpoint() {
  doNothing();
}

/**
 * generate name and group property in each test case
 * 
 * @param testsuite
 */
function generate_testcase_name(testsuite) {
  for ( var group in testsuite) {
    if (testsuite.hasOwnProperty(group)) {
      for ( var testcase in testsuite[group]) {
        if (testsuite[group].hasOwnProperty(testcase)) {
          testsuite[group][testcase].group = group;
          testsuite[group][testcase].name = testcase;
        }
      }
    }
  }
}

function run_case(testcase, opt_logast, opt_logsrc) {

  // header
  console.log(Common.Format.hline);
  console.log(Common.Format.hline);
  console
      .log("TEST GROUP: " + testcase.group + ", TEST CASE: " + testcase.name);
  console.log(Common.Format.hline);
  console.log(Common.Format.hline);

  // parse ast
  var ast = Esprima_Main.parse(testcase.source);

  if (opt_logast === true) {
    var ast_json = JSON.stringify(ast, null, 2);
    console.log(ast_json);
  }

  // compile into bytecodes with redbank compiler
  var bytecodes = Compiler.compile(ast);

  if (opt_logsrc === true) {
    console.log(Common.Format.hline);
    console.log(testcase.source);
    console.log(Common.Format.hline);
  }

  // run bytecodes with redbank vm
  var vm = new RedbankVM();
  vm.run(bytecodes, testcase, testcase.init);

  // footer
  console.log(Common.Format.hline);
  console.log(Common.Format.blank);
  console.log(Common.Format.blank);
  console.log(Common.Format.blank);
}

/**
 * convert bytecodes to line Common.Format
 */
function bytecode_to_string(bytecodes) {
  var string = "";
  var length = bytecodes.length;
  for (var i = 0; i < length; i++) {
    var instruction = bytecodes[i];
    string += instruction.op + ' '
        + ((instruction.arg1 === undefined) ? '' : instruction.arg1) + ' '
        + ((instruction.arg2 === undefined) ? '' : instruction.arg2) + ' '
        + ((instruction.arg3 === undefined) ? '' : instruction.arg3) + '\n';
  }

  return string;
}

/**
 * parse, compile and generate bytecodes in line Common.Format
 * 
 * @param testcase
 * @returns {String}
 */
function compile_to_string(testcase) {
  var ast = Esprima_Main.parse(testcase.source);
  var bytecodes = Compiler.compile(ast, false);
  return bytecode_to_string(bytecodes);
}

function run_testsuite(testsuite) {

  generate_testcase_name(testsuite);
  var group_count = 0;
  var testcase_count = 0;

  for ( var group in testsuite) {
    if (testsuite.hasOwnProperty(group)) {
      group_count++;
      for ( var testcase in testsuite[group]) {
        if (testsuite[group].hasOwnProperty(testcase)) {
          testcase_count++;
          run_case(testsuite[group][testcase], false, true);
        }
      }
    }
  }

  console.log("TEST REPORT : " + testcase_count + " test cases in "
      + group_count + " group(s) passed.");
  console.log(Common.Format.hline);
}

function run_single_in_suite(testsuite, group, testcase) {

  generate_testcase_name(testsuite);
  run_case(testsuite[group][testcase], true);
}

/*******************************************************************************
 * 
 * RemoteTest is the 'pseudo' vm for test cases. It merely generate test
 * commands in line command Common.Format.
 * 
 ******************************************************************************/

/**
 * This is an string array holding test code. Each cell holds one test code
 * string, without new line ending.
 */
function RemoteTest() {
  this.textArray = [];
  return this;
}

/**
 * clear test codes.
 */
RemoteTest.prototype.reset = function() {
  this.textArray = [];
};

/**
 * Merge all test codes into one string. Adding a new line ending to each test
 * code, aka, one assert per line. Adding a blank line at end as EOF
 * 
 * @returns {String}
 */
RemoteTest.prototype.toLines = function() {

  var text = "";

  for (var i = 0; i < this.textArray.length; i++) {
    text += this.textArray[i] + "\n";
  }

  text += "\n";

  return text;
};

RemoteTest.prototype.assertStackLengthEqual = function(len) {
  this.textArray.push("StackLengthEqual " + len);
};

RemoteTest.prototype.assertStackSlotUndefined = function(slot) {
  this.textArray.push("StackSlotUndefined " + slot);
};

RemoteTest.prototype.assertStackSlotNumberValue = function(slot, val) {
  this.textArray.push("StackSlotNumberValue " + slot + " " + val);
};

RemoteTest.prototype.toString = function() {
  return this.text + '\n';
};

function SocketTestRunner(suite, group, name) {

  var i;

  this.testcase = undefined;
  this.testname = undefined;
  this.remote = new RemoteTest();
  this.client = undefined;
  this.all = [];

  if (group === undefined && name === undefined) {
    for (i in suite) {
      if (suite.hasOwnProperty(i)) {
        for ( var j in suite[i]) {
          if (suite[i].hasOwnProperty(j)) {
            this.all.push(suite[i][i]);
          }
        }
      }
    }
  }
  else if (name === undefined) {
    for (i in suite[group]) {
      if (suite[group].hasOwnProperty(i)) {
        this.all.push(suite[group][i]);
      }
    }
  }
  else {
    this.all.push(suite[group][name]);
  }
}

SocketTestRunner.prototype.handleLine = function(line) {

  var message = JSON.parse(line.toString());

  if (message.command === "READY") {

    console.log("READY");

    this.testcase = this.all.shift();
    console.log(Common.Format.hline);
    console.log("Test Group: " + this.testcase.group + " Case: "
        + this.testcase.name);

    console.log("> send bytecode");
    var string = compile_to_string(this.testcase);
    console.log(string);
    this.client.write(string);
    this.client.write("\n");

  }
  else if (message.command === "TEST") {

    this.testname = message.argument;

    if (this.testname in this.testcase) {

      console.log("TEST " + message.argument);
      console.log("> send test case");

      this.remote.reset();
      this.testcase[this.testname](this.remote);
      this.client.write(this.remote.toLines());

    }
    else {

      console.log("property not found in testcase : " + this.testname);
      this.client.write("ABORT\n");
      this.client.destroy();
    }

  }
  else if (message.command === "TESTFAIL") {

    console.log("TESTFAIL : " + this.testname + " @ " + message.argument);
    this.client.destroy();

  }
  else if (message.command === "FINISH") {

    console.log("Finish " + message.argument);

    if (this.all.length === 0) {
      this.client.destroy(); // kill client
    }
    else {
      this.testcase = this.all.shift();
    }
  }
};

SocketTestRunner.prototype.startTcpClient = function() {

  var net = require('net');
  var client = new net.Socket();
  var runner = this;

  client.connect(7979, '127.0.0.1', function() {

    console.log('Connected');

    // prepare readline interface
    var i = readline.createInterface(client, client);

    // register event handler
    i.on('line', function(line) {
      runner.handleLine(line);
    });
  });

  client.on('close', function() {
    console.log('Connection closed');
  });

  this.client = client;
};

/*******************************************************************************
 * 
 * Test Cases
 * 
 ******************************************************************************/

var testcase_basic = {

  var_declare : {
    source : 'var a; rb_test("test");',

    test : function(vm) {
      vm.assertStackLengthEqual(1);
      vm.assertStackSlotUndefined(0);
    },
  },

  var_declare_dual : {
    source : 'var a; var b; rb_test("test");',
    test : function(vm) {
      vm.assertStackLengthEqual(2);
      vm.assertStackSlotUndefined(0);
      vm.assertStackSlotUndefined(1);
    },
  },

  var_declare_init_literal : {
    source : 'var a = 1000; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 1000);
    },
  },

  var_declare_init_expr_add : {
    source : 'var a = 20 + 3; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 23);
    }
  },

  var_declare_init_by_var : {
    source : 'var a = 10; var b = a; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 10);
      vm.assertStackSlotNumberValue(1, 10);
    }
  },

  var_assign_literal : {
    source : 'var a; a = 27; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 27);
    }
  },

  var_assign_literal_dual : {
    source : 'var a; var b; a = 1920; b = 11; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 1920);
      vm.assertStackSlotNumberValue(1, 11);
    }
  },

  var_assign_var : {
    source : 'var a = 192; var b = a; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 192);
      vm.assertStackSlotNumberValue(1, 192);
    }
  },

  var_assign_var_add_literal : {
    source : 'var a = 10; var b = a + 3; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 10);
      vm.assertStackSlotNumberValue(1, 13);
    }
  },

  var_assign_self_add_literal : {
    source : 'var a = 10; a = a + 37; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 47);
    }
  },

  expr_literal_add : {
    source : 'var a = 32 + 3; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 35);
    }
  },

  expr_literal_add_mul : {
    source : 'var a = 2 + 3 * 5; rb_test("test")',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 17);
    }
  },

  expr_literal_complex_add_mul : {
    source : 'var a = ((2 + 3) * 5 + 5 * (7 + 2)) * 3; rb_test("test")',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 210);
    }
  },
};

var testcase_func = {
  func_declare_init : {
    source : 'var a = function(){}; rb_test("test")',
    test : function(vm) {
      vm.assertStackSlotFunction(0);
    }
  },

  func_invoke : { // important !!!
    source : 'var a; a = function(){ rb_test("test"); }; a(); ',
    test : function(vm) {
      // assert(vm.FP > 0);
      // assert(vm.FPStack.length === 1);
      // assert_stack_slot_function(vm, vm.FP - 1);
      vm.assertStackSlotFunction(vm.FP - 1);
    }
  },

  func_return_undefined : {
    source : 'var a; a = function(){}; a = a(); rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotUndefined(0);
    }
  },

  func_pass_value : {
    source : 'var a; a = function(x){ var b = x; rb_test("test"); }; a(119);',
    test : function(vm) {
      // assert_stack_slot_number_value(vm, vm.FP, 119);
      vm.assertStackSlotNumberValue(vm.FP, 119);
    }
  },

  func_return_passed_value : {
    source : 'var a; var b = function(x) { var c = x; return c; };'
        + 'a = b(278); rb_test("test");',
    test : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 278);
      vm.assertStackSlotNumberValue(0, 278);
    }
  },

  closure : {
    source : 'var a;                                               '
        + '   var b = function() {                                 '
        + '     var c = 0;                                         '
        + '     return function() {                                '
        + '       c = c + 27;                                      '
        + '       return c;                                        '
        + '     }                                                  '
        + '   };                                                   '
        + '   var d = b();                                         '
        + '   a = d(); rb_test("test1");                           '
        + '   a = d(); rb_test("test2");                           '
        + '   a = d(); rb_test("test3");                           '
        + '   a = d(); rb_test("test4");                           ',

    test1 : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 27);
      vm.assertStackSlotNumberValue(0, 27);
    },

    test2 : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 54);
      vm.assertStackSlotNumberValue(0, 54);
    },

    test3 : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 81);
      vm.assertStackSlotNumberValue(0, 81);
    },

    test4 : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 108);
      vm.assertStackSlotNumberValue(0, 108);
    },
  },

  y_combinator : {
    source : 'var Y = function(le) {                                          '
        + '     return (function (f) {                                        '
        + '       return f(f);                                                '
        + '     }(function (f) {                                              '
        + '       return le(function (x) {return f(f)(x);});                  '
        + '     }));                                                          '
        + '   };                                                              '
  }
};

var testcase_boolean = {

  triple_equal_literal_true : {
    source : 'var a = 1 === 1; rb_test("test")',
    test : function(vm) {
      // assert_stack_slot_boolean_value(vm, 0, true);
      vm.assertStackSlotBooleanValue(0, true);
    }
  },

  triple_equal_literal_false : {
    source : 'var a = 2 === 1; rb_test("test")',
    test : function(vm) {
      // assert_stack_slot_boolean_value(vm, 0, false);
      vm.assertStackSlotBooleanValue(0, false);
    }
  },

};

var testcase_control = {

  if_statement_no_alternative : {
    source : 'var a = 0; var b = 7; if (b === 7) a = 19; rb_test("test");',
    test : function(vm) {
      // assert_stack_slot_number_value(vm, 0, 19);
      vm.assertStackSlotNumberValue(0, 19);
    }
  },
};

var testcase_object = {

  object_assign_empty : {
    source : 'var a; a = {}; rb_test("test")',
    test : function(vm) {
      vm.assertStackSlotObject(0);
    }
  },
  object_init_empty : {
    source : 'var a = {}; rb_test("test")',
    test : function(vm) {
      vm.assertStackSlotObject(0);
    }
  },
  object_member_expr_assign : {
    source : 'var a; a = {}; a.x = 19; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotObject(0);
      vm.assertStackSlotObjectPropertyNumberValue(0, 'x', 19);
    }
  },
  object_member_expr_fetch : {
    source : 'var a; var b = {}; b.x = 138; a = b.x; rb_test("test");',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 138);
    }
  },
  object_expression : {
    source : 'var a; var b = { x : 123, y: 254};              '
        + 'var a = b.x; rb_test("test1");                     '
        + 'var a = b.y; rb_test("test2");                     ',
    test1 : function(vm) {
      vm.assertStackSlotNumberValue(0, 123);
    },
    test2 : function(vm) {
      vm.assertStackSlotNumberValue(0, 254);
    }
  },
};

var testcase_jsthis = {

  basic : {
    source : 'var a;                                          '
        + 'var b = { x : 1, y : function(z) { this.x = z; } };'
        + 'b.y(123);                                          '
        + 'a = b.x;                                           '
        + 'rb_test("test");                                   ',
    test : function(vm) {
      vm.assertStackSlotNumberValue(0, 123);
    }
  }
};

var testcase_jsnew = {

  basic : {
    source : 'var a; var b = function() {};                   '
        + 'b.prototype = {x : 1};                             '
        + 'var c = new b();'
  },
  confused : {
    source : 'var a = { x : function(){this.y = 1},};'
        + 'var b = new a.x();                          '
  }
};

var testcase_global = {
  global_undefined : {
    source : 'var a = undefined;',
    test : function(vm) {

    }
  }
};

var testcase_internal = {

  internal_one_property : {
    init : Common.InitMode.OBJECT_PROTOTYPE,
    source : 'var a = {}; a.x = 10;',
    test : function(vm) {

    }
  },

  internal_two_properties : {
    init : Common.InitMode.OBJECT_PROTOTYPE,
    source : 'var a = {}; a.x = 10; a.y = 20;',
    test : function(vm) {

    }
  },

  internal_cascade : {
    init : Common.InitMode.OBJECT_PROTOTYPE,
    source : 'var a = {}; a.x = {}; a.x.y = 10;',
  },

  internal_cyclic : { // NOT really a test, just for observation
    init : Common.InitMode.OBJECT_PROTOTYPE,
    source : 'var a = {}; var b = {}; a.x = b; b.y = a;'
  },

  object_proto_dummy : {
    init : Common.InitMode.FULL,
    source : 'var a = {}; a.dummy();'
  },

  new_object : {
    init : Common.InitMode.FULL,
    source : 'var a = Object();'
  },

  // object_expression_getter : {
  // source : 'var a = { get b() { return 1; }};'
  // }

  empty_array : {
    source : 'var a = [];'
  },
  
  try_catch : {
    source : 'var a; try { throw "error" } catch (e) { a = e; }'
  }
};

/**
 * these group holds test cases planned to be used in future.
 */
var testcase_future = {
  object_object_expr : {
    source : 'var a; a = { x: 1 };',
  },

  factorial_y_combinator : {},

};

var testcase_exception = {
    
};

var TESTS = {
  basic : testcase_basic,
  func : testcase_func,
  boolean : testcase_boolean,
  control : testcase_control,
  object : testcase_object,
  global : testcase_global,
//  exception : testcase_exception,
//  internal : testcase_internal,
// jsthis : testcase_jsthis,
// jsnew : testcase_jsnew,
};

// run_testsuite(TESTS);
// run_single_in_suite(TESTS, "func", "closure");

// run_testsuite(TESTS);
// emit_single_in_suite(TESTS, "basic", "var_declare");

function client_connect_callback(client, testcase) {

  console.log('Connected');

  // prepare readline interface
  var i = readline.createInterface(client, client);

  var testname;
  var remote = new RemoteTest();

  // register event handler
  i.on('line', function(line) {

    // TODO safe
    var message = JSON.parse(line.toString());

    if (message.command === "READY") {

      console.log("READY");
      console.log("> send bytecode");
      var string = compile_to_string(testcase);
      console.log(string);
      client.write(string);
      client.write("\n");

    }
    else if (message.command === "TEST") {

      testname = message.argument;

      if (testname in testcase) {

        console.log("TEST " + message.argument);
        console.log("> send test case");

        remote.reset();
        testcase[testname](remote);
        client.write(remote.toLines());

      }
      else {

        console.log("property not found in testcase : " + testname);
        client.write("ABORT\n");
        client.destroy();
      }

    }
    else if (message.command === "TESTFAIL") {

      console.log("TESTFAIL : " + testname + " @ " + message.argument);
      client.destroy();

    }
    else if (message.command === "FINISH") {
      console.log("Finish " + message.argument);
      client.destroy(); // kill client
    }
  });
}

function emit_as_tcp_client(testcase) {

  var net = require('net');
  var client = new net.Socket();

  client.connect(7979, '127.0.0.1', function() {
    client_connect_callback(client, testcase);
  });

  client.on('close', function() {
    console.log('Connection closed');
  });
}

run_testsuite(TESTS);
// run_single_in_suite(TESTS, "internal", "try_catch");

// emit_as_tcp_client(TESTS["basic"]["var_declare_dual"]);

// var runner = new SocketTestRunner(TESTS, "basic");
// runner.startTcpClient();

// var source = "";
// var interpreter = JSInterpreter.BuildInterpreter(source);
// interpreter.run();

