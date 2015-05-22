/*******************************************************************************
 * 
 * Virtual Machine
 * 
 ******************************************************************************/
/**
 * var type constant
 */
var VT_OBJ = "Object";
var VT_FRV = "FreeVar";
var VT_STK = "Stack";
var VT_LIT = "Literal";
var VT_NULL = "Null";

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

var PC = 0;
var FP = 0;

var pc_stack = [];
var fp_stack = [];

var stack = [];
var display = [];
var objects = [];
var literals = [];

function assert_no_leak() {
  // check objects
  for (var i = 1; i < objects.length; i++) {
    if (objects[i] !== undefined) {
      console.log("mem leak @ object id: " + i);
    }
  }
  // check display
  // check stack
  if (stack.length > 0) {
    console.log("mem leak @ stack.")
  }
}

function ref_local(offset) {
  var fp = fp_stack[fp_stack.length - 1];
  return fp + offset;
}

function load_local() {
  var v = stack.pop();

  if (v.type !== VT_STK)
    throw "unmatched type!";

  v = new JSVar(stack[ref_local(v.index)].type, stack[ref_local(v.index)].index);

  stack.push(v);
  if (v.type === VT_OBJ) {
    objects[v.index].ref++;
  }

  return v;
};

// display variable not supported yet
function push(v) {
  stack.push(v);

  if (v.type === VT_OBJ) {
    objects[v.index].ref++;
  }
}

// pop any thing, return value
function pop() {
  var val, v = stack.pop();

  if (v.type === VT_OBJ) {
    val = objects[v.index].value;
    objects[v.index].ref--;
    if (objects[v.index].ref === 0) {
      objects[v.index] = undefined;
    }
    return val;
  } else if (v.type === VT_NULL) {
    // do nothing
  }
}

// 
function assign() {

  var rv, lv, v;
  rv = stack.pop();
  lv = stack.pop();

  if (lv.type === VT_STK) { // assign to locals

    // free old lv
    v = stack[lv.index];
    switch (v.type) {
    case VT_OBJ:
      objects[v.index].ref--;
      if (objects[v.index].ref === 0) {
        objects[v.index] = undefined;
      }
      break;
    }

    if (rv.type === VT_OBJ) { // rvalue
      stack[lv.index] = rv;
      switch (rv.type) {
      case VT_OBJ:
        objects[rv.index].ref++;
        break;
      }

      // push back, no need to increment ref count
      stack.push(rv);
    } else if (rv.type === VT_STK) {
      rv = stack[rv.index];
      stack[lv.index] = rv;
      switch (rv.type) {
      case VT_OBJ:
        objects[rv.index].ref++;
        break;
      }

      // push new, increment ref count
      stack.push(rv);
      objects[rv.index].ref++;
    }

  } else {
    throw "not supported yet.";
  }
}

function span(x) {
  for (var i = 0; i < x; i++) {
    stack.push(new JSVar(VT_NULL, 0));
  }
}

function printstack() {
  if (stack.length === 0) {
    console.log("STACK Empty");
  } else {
    console.log("STACK size: " + stack.length);
    for (var i = stack.length - 1; i >= 0; i--) {
      var v = stack[i];
      if (v.type == VT_OBJ) {
        var index = v.index;

        console.log(i + " : " + VT_OBJ + " " + index + ", val: "
            + objects[index].value + ", ref: " + objects[index].ref);
      } else if (v.type === VT_STK) {

        console.log(i + " : " + VT_STK + " " + v.index);
      } else {
        console.log(i + " : " + v.type);
      }
    }
  }

  console.log("----------------------------------");
}

function step(bytecode) {

  printstack();
  console.log("OPCODE: " + bytecode.op + ' ' + bytecode.arg1 + ' '
      + bytecode.arg2 + ' ' + bytecode.arg3);

  var v, obj;
  var id, index;
  var val;
  var opd1, opd2;

  switch (bytecode.op) {
  case "ADD":
    // add stack top object and pop
    val = pop();
    val = pop() + val;
    obj = objects.push(new ValueObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "CALL":

    v = stack[stack.length - 1];
    if (v.type === VT_STK) {
      v = load_local();
    }

    pc_stack.push(pc);
    pc = objects[v.index].value;
    fp_stack.push(fp);
    fp = stack.length;

    break;

  case "FUNC":
    val = bytecode.arg1;
    obj = objects.push(new FuncObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "LIT":
    // create new value object and push to stack
    val = bytecode.arg1;
    obj = objects.push(new ValueObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "MUL":
    // multiply stack top object and pop
    val = pop();
    val = pop() * val;
    obj = objects.push(new ValueObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "POP":
    // just pop
    if (bytecode.arg1 === undefined) {
      val = pop();
      if (stack.length == 0) { // debug info only
        console.log("The last value in stack is " + val);
      }
    } else if (bytecode.arg1 === "LOC") { // pop to local

      var idx = fp[fp.length - 1];
      idx += bytecode.arg2;

      id = stack[idx];

      if (id !== 0) {
        objects[id].ref--;
      }

      stack[idx] = stack[stack.length - 1];
      stack.pop();
    }
    break;

  case "SPAN":
    span(bytecode.arg1);
    break;

  case "REF":
    if (bytecode.arg1 === "LOCAL") {
      v = new JSVar(VT_STK, ref_local(bytecode.arg2));
      stack.push(v);
    }
    break;

  case "RET":
    if (fp_stack.length === 1 && fp_stack[0] === 0) {
      while (stack.length) {
        pop();
      }
    }
    break;

  case '=':
    assign();
    break;

  default:
    console.log("!!! unknown instruction : " + bytecode.op);
  }
}

function run(code) {

  console.log("-------------------- start running ---------------------");

  while (PC < code.length) {
    step(code[PC++]);
  }

  printstack();
  assert_no_leak();
}

exports.run = run;
