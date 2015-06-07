/**
 * Modules
 */

var JSInterpreter = require("./interpreter.js");
var Esprima_Main = require("./esprima.js");
var ESCodegen_Main = require("./escodegen.js");
var Compiler = require("./redbank_compiler.js");
var RedbankVM = require("./redbank_vm.js");
var Format = require("./redbank_format.js");
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
// // output ast in JSON format
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
function doNothing() {
}

function breakpoint() {
  doNothing();
}

/**
 * test assert
 * 
 * @param expr
 */
function assert(expr) {
  if (expr !== true) {
    breakpoint();
    throw "ASSERT_TRUE_FAIL";
  }
};

/**
 * Assert the (absolutely) indexed stack slot holds an number object (var), and
 * it's value equals to given value.
 * 
 * @param vm
 * @param index
 *          slot index, absolute value
 * @param val
 *          given value
 */
function assert_stack_slot_number_value(vm, index, val) {

  assert(vm.Stack.length > index);
  assert(vm.Stack[index].type === "Object");

  var objIndex = vm.Stack[index].index;

  assert(vm.Objects[objIndex].type === "number");
  assert(vm.Objects[objIndex].value === val);
}

/**
 * Assert the (absolutely) indexed stack slot holds an boolean object (var), and
 * it's value equals to given value (true of false)
 * 
 * @param vm
 * @param index
 * @param val
 */
function assert_stack_slot_boolean_value(vm, index, val) {

  if (typeof val !== 'boolean')
    throw "boolean value required";

  assert(vm.Stack.length > index);
  assert(vm.Stack[index].type === "Object");

  var objIndex = vm.Stack[index].index;

  assert(vm.Objects[objIndex].type === "boolean");
  assert(vm.Objects[objIndex].value === val);
}

/**
 * Assert the (absolutely) indexed stack slot holds an function object (var)
 * 
 * @param vm
 * @param index
 *          slot index, absolute value
 */
function assert_stack_slot_function(vm, index) {

  assert(vm.Stack.length > 0);
  assert(vm.Stack[index].type === "Object");

  var objIndex = vm.Stack[index].index;

  assert(vm.Objects[objIndex].type === "function");
}

function assert_stack_slot_object(vm, index) {

  assert(vm.Stack.length > 0);
  assert(vm.Stack[index].type === "Object");

  var objIndex = vm.Stack[index].index;

  assert(vm.Objects[objIndex].type === "object");
}

function assert_object_property_number_value(vm, objIndex, prop, val) {

  var obj = vm.Objects[objIndex];
  assert(obj.type === "object");

  var propIndex = obj.find_prop(prop);
  assert(propIndex !== undefined);

  var propObjIndex = obj.properties[propIndex].index;
  assert(vm.Objects[propObjIndex].type === "number");
  assert(vm.Objects[propObjIndex].value === val);
}

/**
 * Assert the (absolutely) indexed stack slot holds an undefined object (var)
 * 
 * @param vm
 * @param index
 */
function assert_stack_slot_undefined(vm, index) {

  assert(vm.Stack.length > index);
  assert(vm.Stack[index].type === "Object"); // TODO move type define into vm

  var objIndex = vm.Stack[index].index;

  assert(objIndex === 0);
};

function generate_testcase_name(testsuite) {
  for ( var group in testsuite) {
    for ( var testcase in testsuite[group]) {
      testsuite[group][testcase].group = group;
      testsuite[group][testcase].name = testcase;
    }
  }
}

function run_case(testcase, opt_logast, opt_logsrc) {

  // header
  console.log(Format.hline);
  console.log(Format.hline);
  console
      .log("TEST GROUP: " + testcase.group + ", TEST CASE: " + testcase.name);
  console.log(Format.hline);
  console.log(Format.hline);

  // parse ast
  var ast = Esprima_Main.parse(testcase.source);

  if (opt_logast === true) {
    var ast_json = JSON.stringify(ast, null, 2);
    console.log(ast_json);
  }

  // compile into bytecodes with redbank compiler
  var bytecodes = Compiler.compile(ast);

  if (opt_logsrc === true) {
    console.log(Format.hline);
    console.log(testcase.source);
    console.log(Format.hline);
  }

  // run bytecodes with redbank vm
  var vm = new RedbankVM();
  vm.run(bytecodes, testcase);

  // footer
  console.log(Format.hline);
  console.log(Format.blank);
  console.log(Format.blank);
  console.log(Format.blank);
}

function emit_bytecode_to_c(bytecodes) {

  var length = bytecodes.length;
  for (var i = 0; i < length; i++) {
    var instruction = bytecodes[i];
    console.log(instruction.op + ' '
        + ((instruction.arg1 === undefined) ? '' : instruction.arg1) + ' '
        + ((instruction.arg2 === undefined) ? '' : instruction.arg2) + ' '
        + ((instruction.arg3 === undefined) ? '' : instruction.arg3));
  }
}

function emit_bytecode_to_socket(sock, bytecodes) {
  var length = bytecodes.length;
  for (var i = 0; i < length; i++) {
    var instruction = bytecodes[i];
    sock.write(instruction.op + ' '
        + ((instruction.arg1 === undefined) ? '' : instruction.arg1) + ' '
        + ((instruction.arg2 === undefined) ? '' : instruction.arg2) + ' '
        + ((instruction.arg3 === undefined) ? '' : instruction.arg3) + '\n');
  }
}

function bytecode_to_string(bytecodes) {
  var string = new String();
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

function emit_case(testcase) {
  var ast = Esprima_Main.parse(testcase.source);
  var bytecodes = Compiler.compile(ast, false);
  emit_bytecode_to_c(bytecodes);
}

function emit_case_to_socket(sock, testcase) {
  var ast = Esprima_Main.parse(testcase.source);
  var bytecodes = Compiler.compile(ast, false);
  emit_bytecode_to_socket(sock, bytecodes);
}

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
    group_count++;
    for ( var testcase in testsuite[group]) {
      testcase_count++;
      run_case(TESTS[group][testcase], false, true);
    }
  }

  console.log("TEST REPORT : " + testcase_count + " test cases in "
      + group_count + " group(s) passed.");
  console.log(Format.hline);
}

function run_single_in_suite(testsuite, group_name, testcase_name) {

  generate_testcase_name(testsuite);

  for ( var group in testsuite) {
    if (group === group_name) {
      for ( var testcase in testsuite[group]) {
        if (testcase === testcase_name) {
          run_case(TESTS[group][testcase], false, true);
          break;
        }
      }
      break;
    }
  }
}

function emit_single_in_suite(testsuite, group_name, testcase_name) {

  generate_testcase_name(testsuite);

  for ( var group in testsuite) {
    if (group === group_name) {
      for ( var testcase in testsuite[group]) {
        if (testcase === testcase_name) {
          emit_case(TESTS[group][testcase]);
          break;
        }
      }
      break;
    }
  }
}

function emit_single_in_suite_to_socket(sock, testsuite, group_name,
    testcase_name) {

  generate_testcase_name(testsuite);

  for ( var group in testsuite) {
    if (group === group_name) {
      for ( var testcase in testsuite[group]) {
        if (testcase === testcase_name) {
          emit_case_to_socket(sock, TESTS[group][testcase]);
          break;
        }
      }
      break;
    }
  }
}

function RemoteTest() {
  this.textArray = [];
  return this;
}

RemoteTest.prototype.reset = function() {
  this.textArray = [];
}

RemoteTest.prototype.toLines = function() {
  
  var text = "";
  
  for (var i = 0; i < this.textArray.length; i++) {
    text += this.textArray[i] + "\n";
  }
  
  text += "\n";
  
  return text;
}

RemoteTest.prototype.assertStackLengthEqual = function(len) {
  this.textArray.push("StackLengthEqual " + len);
}

RemoteTest.prototype.assertStackSlotUndefined = function(slot) {
  this.textArray.push("StackSlotUndefined " + slot);
}

RemoteTest.prototype.expectStackSize = function(size) {
  this.text += "StackSize " + size + "\n";
}

RemoteTest.prototype.expectStackSlotUndefined = function(slot) {
  this.text += "StackSlotUndefined " + slot + "\n";
}

RemoteTest.prototype.expectStackSlotNumberValue = function(slot, value) {
  this.text += "StackSlotNumberValue " + slot + " " + value + "\n";
}

RemoteTest.prototype.toString = function() {
  return this.text + '\n';
}

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
    remote_test : function() {
      var test = new RemoteTest();
      test.expectStackSize(2);
      test.expectStackSlotUndefined(0);
      test.expectStackSlotUndefined(1);
      return test.toString();
    }
  },

  var_declare_init_literal : {
    source : 'var a = 1000; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 1000);
    },
    remote_test : function() {
      var test = new RemoteTest();
      test.expectStackSlotNumberValue(0, 1000);
      return test.toString();
    }
  },

  var_declare_init_expr_add : {
    source : 'var a = 20 + 3; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 23);
    }
  },

  var_declare_init_by_var : {
    source : 'var a = 10; var b = a; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 10);
      assert_stack_slot_number_value(vm, 1, 10);
    }
  },

  var_assign_literal : {
    source : 'var a; a = 27; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 27);
    }
  },

  var_assign_literal_dual : {
    source : 'var a; var b; a = 1920; b = 11; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 1920);
      assert_stack_slot_number_value(vm, 1, 11);
    }
  },

  var_assign_var : {
    source : 'var a = 192; var b = a; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 192);
      assert_stack_slot_number_value(vm, 1, 192);
    }
  },

  var_assign_var_add_literal : {
    source : 'var a = 10; var b = a + 3; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 10);
      assert_stack_slot_number_value(vm, 1, 13);
    }
  },

  var_assign_self_add_literal : {
    source : 'var a = 10; a = a + 37; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 47);
    }
  },

  expr_literal_add : {
    source : 'var a = 32 + 3; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 35);
    }
  },

  expr_literal_add_mul : {
    source : 'var a = 2 + 3 * 5; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 17);
    }
  },

  expr_literal_complex_add_mul : {
    source : 'var a = ((2 + 3) * 5 + 5 * (7 + 2)) * 3; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 210);
    }
  },
};

var testcase_func = {
  func_declare_init : {
    source : 'var a = function(){}; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_function(vm, 0);
    }
  },

  func_invoke : { // important !!!
    source : 'var a; a = function(){ rb_test("test"); }; a(); ',
    test : function(vm) {
      assert(vm.FP > 0);
      assert(vm.FPStack.length === 1);
      assert_stack_slot_function(vm, vm.FP - 1);
    }
  },

  func_return_undefined : {
    source : 'var a; a = function(){}; a = a(); rb_test("test");',
    test : function(vm) {
      assert_stack_slot_undefined(vm, 0);
    }
  },

  func_pass_value : {
    source : 'var a; a = function(x){ var b = x; rb_test("test"); }; a(119);',
    test : function(vm) {
      assert_stack_slot_number_value(vm, vm.FP, 119);
    }
  },

  func_return_passed_value : {
    source : 'var a; var b = function(x) { var c = x; return c; };'
        + 'a = b(278); rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 278);
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
      assert_stack_slot_number_value(vm, 0, 27);
    },

    test2 : function(vm) {
      assert_stack_slot_number_value(vm, 0, 54);
    },

    test3 : function(vm) {
      assert_stack_slot_number_value(vm, 0, 81);
    },

    test4 : function(vm) {
      assert_stack_slot_number_value(vm, 0, 108);
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
}

var testcase_boolean = {

  triple_equal_literal_true : {
    source : 'var a = 1 === 1; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_boolean_value(vm, 0, true);
    }
  },

  triple_equal_literal_false : {
    source : 'var a = 2 === 1; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_boolean_value(vm, 0, false);
    }
  }
}

var testcase_control = {

  if_statement_no_alternative : {
    source : 'var a = 0; var b = 7; if (b === 7) a = 19; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 19);
    }
  },
}

var testcase_object = {
  object_assign_empty : {
    source : 'var a; a = {}; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_object(vm, 0);
    }
  },
  object_init_empty : {
    source : 'var a = {}; rb_test("test")',
    test : function(vm) {
      assert_stack_slot_object(vm, 0);
    }
  },
  object_member_expr_assign : {
    source : 'var a; a = {}; a.x = 19; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_object(vm, 0);
      var objIndex = vm.Stack[0].index;
      assert_object_property_number_value(vm, objIndex, "x", 19);
    }
  },
  object_member_expr_fetch : {
    source : 'var a; var b = {}; b.x = 138; a = b.x; rb_test("test");',
    test : function(vm) {
      assert_stack_slot_number_value(vm, 0, 138);
    }
  }
}

/**
 * these group holds test cases planned to be used in future.
 */
var testcase_future = {
  object_object_expr : {
    source : 'var a; a = { x: 1 };',
  },

  factorial_y_combinator : {},

};

var TESTS = {
  basic : testcase_basic,
  func : testcase_func,
  boolean : testcase_boolean,
  control : testcase_control,
  object : testcase_object,
};

// run_testsuite(TESTS);
// run_single_in_suite(TESTS, "func", "closure");

// run_testsuite(TESTS);
// emit_single_in_suite(TESTS, "basic", "var_declare");

function emit_as_tcp_client(testcase) {

  var net = require('net');
  var rl = require("readline");

  var client = new net.Socket();
  client.connect(7979, '127.0.0.1', function() {

    console.log('Connected');

    // prepare readline interface
    var i = rl.createInterface(client, client);
    var testname = undefined;
    var remote = new RemoteTest();
    
    // register event handler
    i.on('line', function(line) {

      // NOT SAFE TODO
      var message = JSON.parse(line.toString());
      
      if (message.command == "READY") {
        console.log("READY");
        console.log("> send bytecode")
        var string = compile_to_string(testcase);
        console.log(string);
        client.write(string);
        client.write("\n");
      } else if (message.command == "TEST") {

        testname = message.argument;

        if (testname in testcase) {
          
          console.log("TEST " + message.argument);
          console.log("> send test case");
          
          remote.reset();
          testcase[testname](remote);
          client.write(remote.toLines());

        } else {
          
          console.log("property not found in testcase : " + testname);
          client.write("ABORT\n");
          client.destroy();
        }

      } else if (message.command == "TESTFAIL") {
        
        console.log("TESTFAIL : " + testname + " @ " + message.argument);
        client.destroy();

      } else if (message.command == "FINISH") {
        console.log("Finish " + message.argument);
        client.destroy(); // kill client
      }
    });
  });

  client.on('close', function() {
    console.log('Connection closed');
  });
}

run_testsuite(TESTS);
emit_as_tcp_client(TESTS["basic"]["var_declare"]);
