/*******************************************************************************
 * 
 * Virtual Machine
 * 
 ******************************************************************************/

var rb_tester;

/**
 * var type constant
 * 
 * VT_OBJ is the object id, including primitive and non-primitive may be placed
 * on params, locals, temps, but not freevars
 * 
 * VT_LNK is the link to object id, it may be placed on params and locals. temps
 * may not be VT_LINK, freevars must be VT_LNK
 */
var VT_OBJ = "Object";
var VT_LNK = "ObjectLink";

var VT_FRV = "Freevar";
var VT_LOC = "Local";
var VT_ARG = "Argument";
var VT_PRO = "Property";

var VT_VAL = "Value";

var VT_LIT = "Literal";
var VT_NIL = "Null";

/**
 * globals
 */
var PC = 0;
var FP = 0;

var pc_stack = [];
var fp_stack = [];

var stack = [];

/**
 * each cell in display has a reference count and a object id
 */
var Links = [];

function alloc_display() {

  for (var i = 0; i < Links.length; i++) {
    if (Links[i] === undefined)
      return i;
  }

  return Links.length;
}

var Objects = [];

var literals = [];

var code = undefined;

function ObjectObject() {

  function find_property(name) {
    for (var i = 0; i < this.properties.length; i++) {
      if (this.properties[i].name === name)
        return i;
    }
  }

  function set_property(name, object_index) {
    var i = this.find_property(name);
    if (i === undefined) {
      this.properties.push({
        name : name,
        index : object_index
      });

      object_ref_incr(object_index);
    } else {
      var old = this.properties[i].index;
      this.properties[i].index = object_index;

      object_ref_incr(object_index);
      object_ref_decr(old);
    }
  }

  function get_property(name) {

  }

  this.isPrimitive = false;
  this.type = "object";
  this.properties = [];
  this.ref = 0;
  this.find_property = find_property;
  this.set_property = set_property;
  this.get_property = get_property;
}

/**
 * constructor for value object (except function)
 */
function ValueObject(value) {
  this.isPrimitive = true;
  this.type = typeof value;
  this.value = value;
  this.ref = 0;
}

/**
 * constructor for function object
 */
function FuncObject(value) {
  this.isPrimitive = true;
  this.type = "function";
  this.value = value; // value is the jump position
  this.freevars = []; // hold freevar
  this.ref = 0;
}

/**
 * construct a var
 */
function JSVar(type, index) {
  this.type = type;
  this.index = index;
}

/**
 * Top of stack
 * 
 * @returns
 */
function TOS() {
  return stack[stack.length - 1];
}

/**
 * Next on stack
 * 
 * @returns
 */
function NOS() {
  return stack[stack.length - 2];
}

/**
 * The 3rd cell on stack
 */
function ThirdOS() {
  return stack[stack.length - 3];
}

/**
 * 
 */
function assert_no_leak() {
  // check objects
  for (var i = 1; i < Objects.length; i++) {
    if (Objects[i] !== undefined) {
      console.log("mem leak @ object id: " + i);
    }
  }
  // check display
  // check stack
  if (stack.length > 0) {
    console.log("mem leak @ stack.")
  }
}

function assert_var_object(v) {
  if (v.type !== VT_OBJ)
    throw "var is not an object, assert fail";
}

/**
 * input is a OBJ var
 * 
 * @param v
 */
function assert_var_object_number(v) {
  if (v.type !== VT_OBJ)
    throw "var is not an object, assert fail";

  if (Objects[v.index].type !== "number")
    throw "var -> object is not an number, assert fail";
}

function assert_var_object_boolean(v) {
  if (v.type !== VT_OBJ)
    throw "var is not an object, assert fail";

  if (Objects[v.index].type !== "boolean")
    throw "var -> object is not a boolean, assert fail";
}

function getval_var_object_boolean(v) {

  assert_var_object_boolean(v);

  return Objects[v.index].value;
}

function assert_var_object_object(v) {
  if (v.type !== VT_OBJ)
    throw "var is not an object, assert fail";
  if (Objects[v.index].type !== "object")
    throw "var -> object is not an object object assert fail";
}

function assert_var_addr(v) {
  if (v.type === VT_LOC || v.type === VT_ARG || v.type === VT_FRV
      || v.type === VT_PRO)
    return;
  else
    throw "var is not an address, assert fail";
}

function assert_var_addr_local(v) {
  if (v.type === VT_LOC)
    return;
  else
    throw "var is not an local address";
}

function assert_var_addr_param(v) {
  if (v.type === VT_ARG)
    return;
  else
    throw "var is not an param address";
}

function assert_var_addr_frvar(v) {
  if (v.type === VT_FRV)
    return;
  else
    throw "var is not an freevar address";
}

function assert_var_addr_prop(v) {
  if (v.type === VT_PRO)
    return;
  else
    throw "var is not an property address";
}

function verify_vartype_parameter() {

}

function verify_vartype_locals() {

}

function verify_vartype_temps() {

}

function verify_vartype() {

}

function object_ref_incr(index) {
  if (index === 0)
    return;

  Objects[index].ref++;
}

/**
 * Decrement object's reference count
 * 
 * If the object is a function object, the freevars are cleared; if the object
 * is an object object, the properties are cleared.
 * 
 * @param index
 */
function object_ref_decr(index) {

  if (index === 0)
    return;
  Objects[index].ref--;

  if (Objects[index].ref === 0) {

    var obj = Objects[index];

    if (obj.type === "function") {
      for (var i = 0; i < obj.freevars.length; i++) {
        link_ref_decr(obj.freevars[i].index);
      }
    } else if (obj.type === "object") {
      for (var i = 0; i < obj.properties.length; i++) {
        object_ref_decr(obj.properties[i].index);
      }
    }

    Objects[index] = undefined;
  }
}

function link_ref_incr(index) {
  Links[index].ref++;
}

/**
 * Decrement link's reference count
 * 
 * If links reference count down to zero, the referenced object's reference
 * decrements and the link is cleared.
 * 
 * @param index
 *          link index
 */
function link_ref_decr(index) {

  Links[index].ref--;

  if (Links[index].ref === 0) {
    object_ref_decr(Links[index].object);
    Links[index] = undefined;
  }
}

/**
 * Get the freevar array of current function
 * 
 * @returns
 */
function freevars() {

  if (FP === 0)
    throw "main function has no freevars";

  var v = stack[FP - 1]; // jsvar for Function Object
  v = Objects[v.index]; // function object
  return v.freevars;
}

function check_reference_chain() {

}

/**
 * convert local index to (absolute) stack index
 * 
 * @param lid
 *          local index (relative to fp)
 * @returns absolute stack index
 */
function lid2sid(lid) {
  return FP + lid;
}

/**
 * Get current function's argument count
 * 
 * 
 * @returns argument count
 */
function ARGC() {

  if (FP === 0)
    throw "main function has no args";

  var v = stack[FP - 3];

  assert_var_object_number(v);

  return Objects[v.index].value;
}

/**
 * convert parameter index to (absolute) stack index
 * 
 * @param pid
 *          parameter index (relative to parameter[0], calculated from fp)
 * @returns
 */
function pid2sid(pid) {

  // var v = stack[FP - 3];
  //  
  // assert_var_object_number(v);
  //  
  // // var argc = stack[FP - 3].index;
  // var argc = Objects[v.index].value;
  return FP - 3 - ARGC() + pid;
}

/**
 * push a JSVar onto stack, update reference count if necessary
 * 
 * Only OBJ var should update reference.
 * 
 * @param v
 *          JSVar to push on stack
 */
function push(v) {

  stack.push(v);

  if (v.type === VT_OBJ) {
    Objects[v.index].ref++;
  } else if (v.type === VT_LNK) { // pushing parameters
    Links[v.index].ref++;
  }
}

/**
 * 
 * @returns
 */
function pop() {

  var v = stack.pop();

  if (v.type === VT_OBJ) {
    object_ref_decr(v.index);
  } else if (v.type === VT_LNK) {
    link_ref_decr(v.index);
  }

  return v;
}

/**
 * Swap TOS and NOS
 * 
 * FORTH: N1, N1 -- N2, N1
 */
function swap() {
  var n1, n2;
  n1 = stack.pop();
  n2 = stack.pop();

  stack.push(n1);
  stack.push(n2);
}

/**
 * set an object var to local slot
 * 
 * @param addr
 * @param objvar
 */
function set_to_local(addr, objvar) {

  assert_var_addr_local(addr);
  assert_var_object(objvar);

  var v = stack[lid2sid(addr.index)];
  if (v.type === VT_LNK) {
    object_ref_decr(Links[v.index].object);
    Links[v.index].object = objvar.index;
    object_ref_incr(objvar.index);
  } else if (v.type === VT_OBJ) {
    object_ref_decr(v.index);
    stack[lid2sid(addr.index)] = objvar;
    object_ref_incr(objvar.index);
  } else
    throw "unrecognized var type in local slot";
}

/**
 * set an object var to param slot
 * 
 * @param addr
 * @param objvar
 */
function set_to_param(addr, objvar) {

  assert_var_addr_param(addr);
  assert_var_object(objvar);

  var v = stack[pid2sid(addr.index)];
  if (v.type === VT_LNK) {
    object_ref_decr(Links[v.index].object);
    Links[v.index].object = objvar.index;
    object_ref_incr(objvar.index);
  } else if (v.type === VT_OBJ) {
    object_ref_decr(v.index);
    stack[pid2sid(addr.index)] = objvar;
    object_ref_incr(objvar.index);
  } else
    throw "unrecognized var type in param slot";
}

/**
 * set an object var to frvar slot
 * 
 * @param addr
 * @param objvar
 */
function set_to_frvar(addr, objvar) {

  assert_var_addr_frvar(addr);
  assert_var_object(objvar);

  var v = freevars()[addr.index];

  if (v.type === VT_LNK) {
    object_ref_decr(Links[v.index].object);
    Links[v.index].object = objvar.index;
    object_ref_incr(objvar.index);
  } else
    throw "unrecognized var type in frvar slot";
}

function set_to_object_prop(dst_objvar, propvar, src_objvar) {

  assert_var_object_object(dst_objvar);
  assert_var_addr_prop(propvar);

  var dst_object_index = dst_objvar.index;
  var dst_object = Objects[dst_object_index];

  dst_object.set_property(propvar.index, src_objvar.index);
}

/**
 * Store N1 to addr
 * 
 * FORTH: addr, N1 -- (! the sequence is different from that of FORTH)
 */
function store() {

  assert_var_object(TOS());
  assert_var_addr(NOS());

  var addr = NOS();

  if (addr.type === VT_LOC) { // store to local
    set_to_local(NOS(), TOS());
    pop();
    pop();

  } else if (addr.type === VT_ARG) { // store to arg

    set_to_param(NOS(), TOS());
    pop();
    pop();

  } else if (addr.type === VT_FRV) { // store to freevar

    set_to_frvar(NOS(), TOS());
    pop();
    pop();
  } else
    throw "not supported address type for STORE";
}

/**
 * Assign N1 to addr and left N1 as TOS
 * 
 * FORTH: addr, N1 -- N1
 */
function assign() {

  assert_var_object(TOS());
  assert_var_addr(NOS());

  var addr = NOS();

  if (addr.type === VT_LOC) {
    set_to_local(NOS(), TOS());
    swap();
    pop();
  } else if (addr.type === VT_ARG) {
    set_to_param(NOS(), TOS());
    swap();
    pop();
  } else if (addr.type === VT_FRV) {
    set_to_frvar(NOS(), TOS());
    swap();
    pop();
  } else if (addr.type === VT_PRO) {
    set_to_object_prop(ThirdOS(), NOS(), TOS());
    swap();
    pop();
    swap();
    pop();
  } else
    throw "not supported yet";
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
        var obj = Objects[index];

        if (obj.type === "object") {
          console.log(i + " : " + index + " (object) ref: " + obj.ref);
        } else if (obj.type === "function") {
          var func_prt = VT_OBJ + " " + index + " (function) " + "entry: "
              + obj.value + ", ref: " + obj.ref;
          console.log(i + " : " + func_prt);
        } else if (obj.type === "undefined") {
          console.log(i + " : " + "UNDEFINED");
        } else {
          console.log(i + " : " + VT_OBJ + ", index: " + index + ", value: "
              + obj.value + ", ref: " + obj.ref);
        }

      } else if (v.type === VT_LOC) {
        console.log(i + " : [addr] " + VT_LOC + " " + v.index);
      } else if (v.type === VT_VAL) {
        console.log(i + " : " + VT_VAL + " " + v.index);
      } else if (v.type === VT_ARG) {
        console.log(i + " : [addr] " + VT_ARG + " " + v.index);
      } else if (v.type === VT_FRV) {
        console.log(i + " : [addr] " + VT_FRV + " " + v.index);
      } else if (v.type === "undefined") {
        console.log(i + " : UNDEFINED");
      } else {
        console.log(i + " : " + v.type);
      }
    }
  }
}

function printfreevar() {

  if (FP === 0)
    return;

  var v = stack[FP - 1];

  if (v.type !== VT_OBJ || Objects[v.index].type !== "function")
    throw "error, function object not found!";

  v = Objects[v.index];

  if (v.freevars.length === 0)
    return;

  console.log("  --- freevars ---");

  for (var i = 0; i < v.freevars.length; i++) {

    var f = v.freevars[i];
    if (f.type !== VT_LNK)
      throw "error freevar type";

    console.log(i + " : " + "link id: " + f.index + ", ref: "
        + Links[f.index].ref + ", obj: " + Links[f.index].object);
  }
}

function findLabel(code, label) {

  for (var i = 0; i < code.length; i++) {
    var bytecode = code[i];
    if (bytecode.op === "LABEL" && bytecode.arg1 === label)
      return i;
  }

  throw "Label not found";
}

function step(code, bytecode) {
  var v, obj;
  var id, index;
  var val;
  var opd1, opd2;

  switch (bytecode.op) {


  case "CALL":
    v = TOS();
    pc_stack.push(PC);
    fp_stack.push(FP);
    PC = Objects[v.index].value;
    FP = stack.length;
    break;

  case "CAPTURE":
    var f = Objects[TOS().index];
    if (bytecode.arg1 === "parameters" || bytecode.arg1 === "locals") {
      if (bytecode.arg1 === "parameters") {
        v = stack[pid2sid(bytecode.arg2)];
      } else {
        v = stack[lid2sid(bytecode.arg2)];
      }

      if (v.type === VT_LNK) {
        f.freevars.push(new JSVar(VT_LNK, v.index));
        Links[v.index].ref++;
      } else if (v.type === VT_OBJ) {
        id = alloc_display();

        Links[id] = {
          ref : 2, // we create 2 links to it
          object : v.index
        };

        // change to link
        v.type = VT_LNK;
        v.index = id;

        f.freevars.push(new JSVar(VT_LNK, id));
      } else
        throw "ERROR";
    } else if (bytecode.arg1 === "freevars") {
      // copy link id and incr reference count
    } else {
      throw "error capture from type";
    }
    break;

  case "DROP": // n1 --
    pop();
    break;

  case "FETCH": // addr -- n1 or O1, prop1 -- O2
    var addr = stack.pop();
    if (addr.type === VT_LOC) {
      v = stack[lid2sid(addr.index)];
      if (v.type === VT_OBJ) {
      } else if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, Links[v.index].object);
      } else
        throw "Unsupported var type in local slot";
    } else if (addr.type === VT_ARG) {
      v = stack[pid2sid(addr.index)];
      if (v.type === VT_OBJ) {
      } else if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, Links[v.index].object);
      } else
        throw "Unsupported var type in param slot";
    } else if (addr.type === VT_FRV) {
      v = freevars()[addr.index] // freevar
      if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, Links[v.index].object);
      } else
        throw "Unsupported var type in frvar slot";
    } else if (addr.type === VT_PRO) {

    } else
      throw "not supported yet.";
    push(v);
    break;

  case "FUNC": // -- f1
    val = bytecode.arg1;
    obj = Objects.push(new FuncObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "JUMP":
    v = bytecode.arg1;
    v = findLabel(code, v);
    PC = v;
    break;

  case "JUMPC":
    v = getval_var_object_boolean(TOS());
    pop();
    if (v) {
      PC = findLabel(code, bytecode.arg1);
    } else {
      PC = findLabel(code, bytecode.arg2);
    }
    break;

  case "LABEL":
    // do nothing
    break;

  case "LITA":
    // push an address, may be local, param, or closed
    if (bytecode.arg1 === "LOCAL") {
      v = new JSVar(VT_LOC, bytecode.arg2);
      stack.push(v);
    } else if (bytecode.arg1 === 'PARAM') {
      v = new JSVar(VT_ARG, bytecode.arg2);
      stack.push(v);
    } else if (bytecode.arg1 === 'FRVAR') {
      v = new JSVar(VT_FRV, bytecode.arg2);
      stack.push(v);
    } else if (bytecode.arg1 === "PROP") {
      v = new JSVar(VT_PRO, bytecode.arg2);
      stack.push(v);
    } else
      throw "not supported yet";

    break;

  case "LITC":
    // push an constant value
    // create new value object and push to stack
    val = bytecode.arg1;
    obj = Objects.push(new ValueObject(val)) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "LITN":
    // push n UNDEFINED object
    for (var i = 0; i < bytecode.arg1; i++) {
      stack.push(new JSVar(VT_OBJ, 0));
    }
    break;

  case "LITO":
    // create an object object and push to stack
    obj = Objects.push(new ObjectObject()) - 1;
    v = new JSVar(VT_OBJ, obj);
    push(v);
    break;

  case "RBTEST":
    if (rb_tester !== undefined) {
      rb_tester[bytecode.arg1](this);
    }
    break;

  case "RET":
    if (FP === 0) { // main()
      while (stack.length) {
        pop();
      }
      PC = code.length; // exit

    } else {

      var result = undefined;
      var argc = ARGC();

      if (bytecode.arg1 === "RESULT") {
        result = stack.pop();
      }

      while (stack.length > FP) {
        pop();
      }

      pop(); // pop function object
      pop(); // pop this object
      pop(); // argc
      for (i = 0; i < argc; i++) {
        pop(); // pop params
      }

      // restore fp and pc
      PC = pc_stack.pop();
      FP = fp_stack.pop();

      if (result === undefined) { // no return value provided
        stack.push(new JSVar(VT_OBJ, 0));
      } else {
        stack.push(result);
      }
    }
    break;

  case "STORE": // addr n1 --
    store();
    break;

  case "VAL":
    v = new JSVar(VT_VAL, bytecode.arg1);
    stack.push(v);
    break;
    
  case "+":
    // assert, only number supported up to now
    assert_var_object_number(TOS());
    assert_var_object_number(NOS());

    // do calculation
    v = Objects[NOS().index].value + Objects[TOS().index].value;

    // pop operand
    pop();
    pop();

    // create new value object
    // TODO using alloc
    obj = Objects.push(new ValueObject(v)) - 1;

    // push result on stack
    push(new JSVar(VT_OBJ, obj));
    break;    
    
  case "*":
    // assert, only number supported up to now
    assert_var_object_number(TOS());
    assert_var_object_number(NOS());

    // do calculation
    v = Objects[NOS().index].value * Objects[TOS().index].value;

    // pop operand
    pop();
    pop();

    // create new value object
    // TODO using alloc
    obj = Objects.push(new ValueObject(v)) - 1;

    // push result on stack
    push(new JSVar(VT_OBJ, obj));
    break;    

  case '=':
    assign();
    break;

  case '===':

    assert_var_object(TOS());
    assert_var_object(NOS());

    if (TOS().type === NOS().type
        && Objects[TOS().index].type === Objects[NOS().index].type
        && Objects[TOS().index].value === Objects[NOS().index].value) {
      v = new ValueObject(true);
    } else {
      v = new ValueObject(false);
    }

    index = Objects.push(v) - 1;
    v = new JSVar(VT_OBJ, index);

    pop();
    pop();
    push(v);

    break;

  default:
    throw "!!! unknown instruction : " + bytecode.op;
  }
}

function run(input, tester) {

  code = input;
  rb_tester = tester;

  Objects[0] = new ValueObject(undefined);
  Objects[0].ref = -1;

  console.log("-------------------- start running ---------------------");

  while (PC < code.length) {

    var bytecode = code[PC];

    printstack();
    printfreevar();
    console.log("==================================================");

    console.log("PC : " + PC + ", FP : " + FP);
    console.log("OPCODE: " + bytecode.op + ' ' + bytecode.arg1 + ' '
        + bytecode.arg2 + ' ' + bytecode.arg3);

    // like the real
    PC++;

    step(code, bytecode);
  }

  printstack();
  printfreevar();
  assert_no_leak();
}



exports.run = run;
