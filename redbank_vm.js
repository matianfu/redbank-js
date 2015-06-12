/*******************************************************************************
 * 
 * Virtual Machine
 * 
 ******************************************************************************/

/**
 * var type constant
 * 
 * VT_OBJ is the object id, including primitive and non-primitive may be placed
 * on params, locals, temps, but not lexical
 * 
 * VT_LNK is the link to object id, it may be placed on params and locals. temps
 * may not be VT_LINK, lexical must be VT_LNK
 */
var Format = require('./redbank_format.js');

var HORIZONTAL_LINE = "=================================================";

var VT_OBJ = "Object";
var VT_LNK = "ObjectLink";

var VT_LEX = "Freevar";
var VT_LOC = "Local";
var VT_ARG = "Argument";
var VT_PRO = "Property";

/**
 * Hash function (FNV-1a 32bit)
 * @param str
 * @returns
 */
function HASH(str) {
  //gist code
  //https://gist.github.com/vaiorabbit/5657561
  //32 bit FNV-1a hash
  //Ref.: http://isthe.com/chongo/tech/comp/fnv/

  var FNV1_32A_INIT = 0x811c9dc5;
  var hval = FNV1_32A_INIT;
  for (var i = 0; i < str.length; ++i) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8)
        + (hval << 24);
  }
  return hval >>> 0;
}

function HASHMORE(hash, id) {
  /**
   * naive implementation
   */
  return (hash * id) >>> 0;
}

function RedbankVM() {

  this.PC = 0;
  this.FP = 0;

  this.PCStack = [];
  this.FPStack = [];
  this.Stack = [];
  this.Objects = [];

  this.Links = []; // TODO should be removed

  // string hash table
  this.StringHash = [];
  // property hash table
  this.PropertyHash = [];

  // bytecode array
  this.code = undefined;

  // testcase
  this.testcase = undefined;
}

/**
 * Push an object onto heap and return object id
 * 
 * @param obj
 * @returns {Number}
 */
RedbankVM.prototype.register = function(obj) {

  this.Objects.push(obj);
  var id = this.Objects.length - 1;
  obj.id = id; // back annotation
  return id;
};

/**
 * Pop an object out of heap and recycle object id
 * 
 * @param id
 */
RedbankVM.prototype.unregister = function(id) {

  this.Objects[id] = undefined;
};

RedbankVM.prototype.isa = function(child, parent) {

  if (typeof child !== 'number' || typeof parent !== 'number') {
    throw "wrong input";
  }

  if (child === 0) {
    return false;
  }

  if (this.Objects[child].PROTOTYPE === parent) {
    return true;
  }

  child = this.Objects[child].PROTOTYPE;
  return this.isa(child, parent);
};

/** obsolete **/
RedbankVM.prototype.alloc_link = function() {

  for (var i = 0; i < this.Links.length; i++) {
    if (this.Links[i] === undefined) {
      return i;
    }
  }
  return this.Links.length;
};

RedbankVM.prototype.internFindString = function(string) {

  var hash = HASH(string);

  hash = hash >>> 20; // drop 20 bits, 12 bit left
  var id = this.StringHash[hash];

  if (id === undefined) {
    return;
  }

  for (; id !== undefined; id = this.getObject(id).nextInSlot) {
    var obj = this.Objects[id];

    if (obj.type !== 'string') {
      throw "not a string";
    }

    if (obj.value === string) {
      return id;
    }
  }
};

RedbankVM.prototype.internNewString = function(id) {

  var obj = this.getObject(id);

  var str = obj.value;

  var hash = HASH(str);
  obj.interned = true;
  obj.hash = hash;

  hash = hash >>> 20; // drop 20 bits, 12 bit left

  obj.nextInSlot = this.StringHash[hash];
  this.StringHash[hash] = id;
};

RedbankVM.prototype.incrREF = function(id) {

  this.getObject(id).ref++;
};

RedbankVM.prototype.decrREF = function(id) {

  var obj = this.getObject(id);
  obj.ref--;

  if (obj.ref === 0) {
    switch (obj.type) {
    // TODO
    }
  }
};

RedbankVM.prototype.createLink = function(target) {

  var link = {
    type : 'link',
    target : target,
    ref : 0,
  };
  var id = this.register(link);

  this.incrREF(target);
  return id;
};

RedbankVM.prototype.unregisterLink = function(id) {

  var obj = this.getObject(id);

  if (obj.type !== 'link') {
    throw "not a link";
  }

  this.decrREF(target);
  this.unregister(id);
};

RedbankVM.prototype.createPrimitive = function(value, tag, builtin) {

  var id;

  // check if value is js primitive
  if (!(value === null || // ECMAScript bug according to MDN
  typeof value === 'string' || typeof value === 'number'
      || typeof value === 'boolean' || typeof value === 'undefined')) {
    throw "value is NOT primitive";
  }

  // string intern
  if (typeof value === 'string') {
    id = this.internFindString(value);
    if (id !== undefined) {
      return id;
    }
  }

  var primitive = {

    isPrimitive : true,
    type : typeof value,
    value : value,
    tag : tag,

    ref : 0,
  };
  id = this.register(primitive, builtin);

  // string intern
  if (typeof value === 'string') {
    this.internNewString(id);
  }

  return id;
};

RedbankVM.prototype.createObject = function(proto, tag) {

  var obj, id;

  if (typeof proto !== 'number') {
    throw "Use object id as prototype of object";
  }

  obj = {

    isPrimitive : false,
    type : 'object',
    ref : 0,
    tag : tag,

    /** __proto__ * */
    PROTOTYPE : proto,

    properties : [],

    /*
     * don't confuse these methods with Object's methods, which should be a
     * property mapped to (native) function object. these methods may be used to
     * implement them.
     */
    toBoolean : function() {
      return true;
    },
    toNumber : function() {
      return 0;
    },
    toString : function() {
      return '[' + this.type + ']';
    },
    valueOf : function() {
      return this;
    }
  };

  id = this.register(obj);

  // Functions have prototype objects.
  if (this.FUNCTION !== undefined && this.FUNCTION.proto !== undefined
      && this.isa(id, this.FUNCTION.proto)) {
    obj.type = 'function';
    var pid = this.createObject(this.OBJECT.proto);
    this.setProperty(id, 'prototype', pid, true, false, false);
  }

  // // Arrays have length.
  // if (this.isa(obj, this.ARRAY)) {
  // obj.length = 0;
  // obj.toString = function() {
  // var strs = [];
  // for (var i = 0; i < this.length; i++) {
  // strs[i] = this.properties[i].toString();
  // }
  // return strs.join(',');
  // };
  // };

  return id;
};

RedbankVM.prototype.createFunction = function(label, lexnum, length) {

  if (this.FUNCTION.proto === undefined || this.FUNCTION.proto === null) {
    throw "FUNCTION.prototype not initialized.";
  }

  var id = this.createObject(this.FUNCTION.proto);
  var obj = this.Objects[id];
  obj.label = label;
  obj.lexicals = [];
  obj.lexnum = lexnum;

  var l = this.createPrimitive(length);
  this.setProperty(id, 'length', l, true, true, true);
  return id;
};

/**
 * Create a new native function.
 * 
 * @param {!Function}
 *          nativeFunc JavaScript function.
 * @return {!Object} New function.
 */
RedbankVM.prototype.createNativeFunction = function(nativeFunc, tag) {

  if (this.FUNCTION.proto === undefined || this.FUNCTION.proto === null) {
    throw "FUNCTION.prototype not initialized.";
  }

  var func = this.createObject(this.FUNCTION.proto, tag);
  func.nativeFunc = nativeFunc;
  var id = this.createPrimitive(nativeFunc.length);
  this.setProperty(func, 'length', id, false, false, false);
  return func;
};

RedbankVM.prototype.findProperty = function(id, name) {

  if (typeof id !== 'number') {
    throw "Not an object id";
  }

  var obj = this.Objects[id];
  for (var i = 0; i < obj.properties.length; i++) {
    if (obj.properties[i].name === name) {
      return i;
    }
  }
};

RedbankVM.prototype.getObject = function(id) {

  return this.Objects[id];
};

/**
 * 
 * @param parent
 * @param child
 * @param prop
 * @param w
 * @param e
 * @param c
 */
RedbankVM.prototype.setProperty_2 = function(parent, child, prop, w, e, c) {

  var parentObject = this.getObject(parent);
  var propertyObject = this.getObject(property);

  // set into object
  propertyObject.nextInObject = parentObject.property;
  parentObject.property = property;

  // set into table
  // propstring hash 
  // parent id hash
  // insert into PropertyHash

  var property = {
    type : 'property',
    ref : 0,
    parent : parent,
    child : child,
    prop : prop,
    w : (w === true) ? true : false,
    e : (e === true) ? true : false,
    c : (c === true) ? true : false,
    nextInObject : undefined,
    nextInSlot : undefined,
  };

  var id = this.register(property);

  // set to parent property
  var parentObject = this.getObject(parent);
  property.nextInObject = parentObject.property;
  parent.property = property;

  // add to property hash
  var hash = prop.hash;
  hash = HASHMORE(hash, parent);

  hash >>> 20; // shake off lower 20 bits

  this.PropertyHash
};

/**
 * Set a property value on a data object.
 * 
 * @param {!Object}
 *          obj Data object.
 * @param {*}
 *          name Name of property.
 * @param {*}
 *          value New property value.
 * @param {boolean}
 *          opt_fixed Unchangeable property if true.
 * @param {boolean}
 *          opt_nonenum Non-enumerable property if true.
 */
RedbankVM.prototype.setProperty = function(id, name, index, writable,
    enumerable, configurable) {

  var obj;

  if (typeof id !== 'number' || typeof index !== 'number') {
    throw "Convert object to object id for setProperty";
  }

  obj = this.Objects[id];

  /**
   * any string is valid for js property name, including undefined, null, and
   * numbers number property name can NOT be used with dot notation, but bracket
   * notation is OK. other strings are OK for both dot and bracket notation.
   */
  name = name.toString();
  if (obj.isPrimitive) {
    return;
  }

  // if (this.isa(obj, this.STRING)) {
  // var n = this.arrayIndex(name);
  // if (name == 'length' || (!isNaN(n) && n < obj.data.length)) {
  // // Can't set length or letters on Strings.
  // return;
  // }
  // }

  // if (this.isa(obj, this.ARRAY)) {
  // // Arrays have a magic length variable that is bound to the elements.
  // var i;
  // if (name == 'length') {
  // // Delete elements if length is smaller.
  // var newLength = this.arrayIndex(value.toNumber());
  // if (isNaN(newLength)) {
  // throw new RangeError('Invalid array length');
  // }
  // if (newLength < obj.length) {
  // for (i in obj.properties) {
  // i = this.arrayIndex(i);
  // if (!isNaN(i) && newLength <= i) {
  // delete obj.properties[i];
  // }
  // }
  // }
  // obj.length = newLength;
  // return; // Don't set a real length property.
  // }
  // else if (!isNaN(i = this.arrayIndex(name))) {
  // // Increase length if this index is larger.
  // obj.length = Math.max(obj.length, i + 1);
  // }
  // }

  // Set the property.
  // obj.properties[name] = value;
  // if (opt_fixed) {
  // obj.fixed[name] = true;
  // }
  // if (opt_nonenum) {
  // obj.nonenumerable[name] = true;
  // }

  var i = this.findProperty(id, name);
  if (i === undefined) {
    var str = this.createPrimitive(name);
    this.incrREF(str);
    var property = {
      name : name,
      nameString : str,
      index : index,
      writable : (writable === true) ? true : false,
      enumerable : (enumerable === true) ? true : false,
      configurable : (configurable === true) ? true : false,
    };

    obj.properties.push(property);
    this.incrREF(index);
  }
  else if (obj.properties[i].writable === false) {
    return;
  }
  else {
    var old = obj.properties[i].index;
    obj.properties[i].index = index;
    this.incrREF(index);
    this.object_ref_decr(old);
  }
};

/**
 * constructor for function object
 */
// function FuncObject(vm, value) {
// this.vm = vm;
// this.isPrimitive = true;
// this.type = "function";
//  
// this.value = value; // value is the jump position
// this.freevars = []; // hold freevar
// this.ref = 0;
// }
RedbankVM.prototype.init = function() {

  // lexical for nested function
  var vm = this;
  var wrapper, id, obj;

  id = this.createPrimitive(undefined, "UNDEFINED");
  this.UNDEFINED = id;

  // Object.prototype inherits null TODO
  id = this.createObject(0, "Object.prototype");
  this.OBJECT = {};
  this.OBJECT.proto = id;

  // Function.prototype inherits Object.prototype
  // createNativeFunction require this prototype
  id = this.createObject(this.OBJECT.proto, "Function.prototype");
  obj = this.Objects[id];
  obj.type = 'function';
  this.FUNCTION = {};
  this.FUNCTION.proto = id;

  // Object.prototype.toString(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.toString());
  };
  id = this.createNativeFunction(wrapper, "Object.prototype.toString()");
  this.setProperty(this.OBJECT.proto, 'toString', id, true, false, true);

  // Object.prototype.valueOf(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.valueOf());
  };
  id = this.createNativeFunction(wrapper, "Object.prototype.valueOf()");
  this.setProperty(this.OBJECT.proto, 'valueOf', id, true, false, true);

  // TODO add more native functions according to ECMA standard

  // Object constructor, native
  wrapper = function(var_args) {
    var newObj;

    if (this.parent === vm.OBJECT) {
      throw "new is not supported yet";
      // Called with new.
      newObj = this;
    }
    else {
      newObj = vm.createObject(vm.OBJECT.proto);
    }
    return newObj;
  };
  id = this.createNativeFunction(wrapper, "Object constructor");
  this.setProperty(id, 'prototype', this.OBJECT.proto, false, false, false);
  this.OBJECT.ctor = id;

  // Function constructor. TODO need to adapt
  wrapper = function(var_args) {

    var newFunc, code;

    if (this.PROTOTYPE === vm.FUNCTION) {
      // Called with new.
      newFunc = this;
    }
    else {
      newFunc = vm.createObject(vm.FUNCTION);
    }
    if (arguments.length) {
      code = arguments[arguments.length - 1].toString();
    }
    else {
      code = '';
    }
    var args = [];
    for (var i = 0; i < arguments.length - 1; i++) {
      args.push(arguments[i].toString());
    }
    args = args.join(', ');
    if (args.indexOf(')') !== -1) {
      throw new SyntaxError('Function arg string contains parenthesis');
    }
    // Interestingly, the scope for constructed functions is the global scope,
    // even if they were constructed in some other scope. TODO what does this
    // mean?
    // newFunc.parentScope =
    // vm.stateStack[vm.stateStack.length - 1].scope;
    // var ast = esprima.parse('$ = function(' + args + ') {' + code + '};');
    // newFunc.node = ast.body[0].expression.right;
    // vm.setProperty(newFunc, 'length',
    // vm.createPrimitive(newFunc.node.length), true);
    return newFunc;
  };

  id = this.createNativeFunction(wrapper, "Function constructor");
  this.setProperty(id, 'prototype', this.FUNCTION.proto, false, false, false);
  this.FUNCTION.ctor = id;

  // Create stub functions for apply and call.
  // These are processed as special cases in stepCallExpression.
  /**
   * var node = { type : 'FunctionApply_', params : [], id : null, body : null,
   * start : 0, end : 0 }; this.setProperty(this.FUNCTION.properties.prototype,
   * 'apply', this .createFunction(node, {}), false, true); var node = { type :
   * 'FunctionCall_', params : [], id : null, body : null, start : 0, end : 0 };
   * this.setProperty(this.FUNCTION.properties.prototype, 'call', this
   * .createFunction(node, {}), false, true); // Function has no parent to
   * inherit from, so it needs its own mandatory // toString and valueOf
   * functions. wrapper = function() { return
   * vm.createPrimitive(this.toString()); };
   * this.setProperty(this.FUNCTION.properties.prototype, 'toString', this
   * .createNativeFunction(wrapper), false, true);
   * this.setProperty(this.FUNCTION, 'toString', this
   * .createNativeFunction(wrapper), false, true); wrapper = function() { return
   * vm.createPrimitive(this.valueOf()); };
   * this.setProperty(this.FUNCTION.properties.prototype, 'valueOf', this
   * .createNativeFunction(wrapper), false, true);
   * this.setProperty(this.FUNCTION, 'valueOf',
   * this.createNativeFunction(wrapper), false, true);
   */

};

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
RedbankVM.prototype.TOS = function() {
  return this.Stack[this.Stack.length - 1];
};

/**
 * Next on stack
 * 
 * @returns
 */
RedbankVM.prototype.NOS = function() {
  return this.Stack[this.Stack.length - 2];
};

/**
 * The 3rd cell on stack
 */
RedbankVM.prototype.ThirdOS = function() {
  return this.Stack[this.Stack.length - 3];
};

/**
 * 
 */
RedbankVM.prototype.assert_no_leak = function() {
  // check objects
  for (var i = 1; i < this.Objects.length; i++) {
    if (this.Objects[i] !== undefined) {
      console.log("mem leak @ object id: " + i);
    }
  }
  // check display
  // check stack
  if (this.Stack.length > 0) {
    console.log("mem leak @ stack.");
  }
};

RedbankVM.prototype.assert_var_object = function(v) {
  if (v.type !== VT_OBJ) {
    throw "var is not an object, assert fail";
  }
};

/**
 * input is a OBJ var
 * 
 * @param v
 */
RedbankVM.prototype.assert_var_object_number = function(v) {
  if (v.type !== VT_OBJ) {
    throw "var is not an object, assert fail";
  }

  if (this.Objects[v.index].type !== "number") {
    throw "var -> object is not an number, assert fail";
  }
};

RedbankVM.prototype.assert_var_object_boolean = function(v) {
  if (v.type !== VT_OBJ) {
    throw "var is not an object, assert fail";
  }

  if (this.Objects[v.index].type !== "boolean") {
    throw "var -> object is not a boolean, assert fail";
  }
};

RedbankVM.prototype.getval_var_object_boolean = function(v) {

  this.assert_var_object_boolean(v);
  return this.Objects[v.index].value;
};

RedbankVM.prototype.assert_var_object_object = function(v) {
  if (v.type !== VT_OBJ) {
    throw "var is not an object, assert fail";
  }
  if (this.Objects[v.index].type !== "object") {
    throw "var -> object is not an object object assert fail";
  }
};

RedbankVM.prototype.assert_var_addr = function(v) {
  if (v.type === VT_LOC || v.type === VT_ARG || v.type === VT_LEX
      || v.type === VT_PRO) {
    return;
  }
  else {
    throw "var is not an address, assert fail";
  }
};

RedbankVM.prototype.assert_var_addr_local = function(v) {
  if (v.type === VT_LOC) {
    return;
  }
  else {
    throw "var is not an local address";
  }
};

RedbankVM.prototype.assert_var_addr_param = function(v) {
  if (v.type === VT_ARG) {
    return;
  }
  else {
    throw "var is not an param address";
  }
};

RedbankVM.prototype.assert_var_addr_frvar = function(v) {
  if (v.type === VT_LEX) {
    return;
  }
  else {
    throw "var is not an freevar address";
  }
};

RedbankVM.prototype.assert_var_addr_prop = function(v) {
  if (v.type === VT_PRO) {
    return;
  }
  else {
    throw "var is not an property address";
  }
};

/**
 * for external auto test
 */
RedbankVM.prototype.assert = function(expr) {
  if (!(expr)) {
    throw "ASSERT FAIL";
  }
};

RedbankVM.prototype.assertStackLengthEqual = function(len) {
  this.assert(this.Stack.length === len);
};

RedbankVM.prototype.assertStackSlotUndefined = function(slot) {

  this.assert(this.Stack.length > slot);
  this.assert(this.Stack[slot].type === "Object");
  this.assert(this.Stack[slot].index === 0);
};

RedbankVM.prototype.assertStackSlotNumberValue = function(slot, val) {

  this.assert(this.Stack.length > slot);
  this.assert(this.Stack[slot].type === "Object");

  var objIndex = this.Stack[slot].index;

  this.assert(this.Objects[objIndex].type === "number");
  this.assert(this.Objects[objIndex].value === val);
};

/**
 * Decrement object's reference count
 * 
 * If the object is a function object, the lexials are cleared; if the object is
 * an object object, the properties are cleared.
 * 
 * @param index
 */
RedbankVM.prototype.object_ref_decr = function(index) {

  var i;

  if (index === 0) {
    return;
  }

  this.Objects[index].ref--;

  if (this.Objects[index].ref === 0) {

    var obj = this.Objects[index];

    if (obj.type === "function") {
      for (i = 0; i < obj.lexicals.length; i++) {
        this.link_ref_decr(obj.lexicals[i].index);
      }
    }
    else if (obj.type === "object") {
      for (i = 0; i < obj.properties.length; i++) {
        this.object_ref_decr(obj.properties[i].index);
      }
    }

    this.Objects[index] = undefined;
  }
};

RedbankVM.prototype.link_ref_incr = function(index) {
  this.Links[index].ref++;
};

/**
 * Decrement link's reference count
 * 
 * If links reference count down to zero, the referenced object's reference
 * decrements and the link is cleared.
 * 
 * @param index
 *          link index
 */
RedbankVM.prototype.link_ref_decr = function(index) {

  this.Links[index].ref--;

  if (this.Links[index].ref === 0) {
    this.object_ref_decr(this.Links[index].object);
    this.Links[index] = undefined;
  }
};

/**
 * Get the freevar array of current function
 * 
 * @returns
 */
RedbankVM.prototype.freevars = function() {

  if (this.FP === 0) {
    throw "main function has no freevars";
  }

  var v = this.Stack[this.FP - 1]; // jsvar for Function Object
  v = this.Objects[v.index]; // function object
  return v.lexicals;
};

function check_reference_chain() {

}

/**
 * convert local index to (absolute) stack index
 * 
 * @param lid
 *          local index (relative to fp)
 * @returns absolute stack index
 */
RedbankVM.prototype.lid2sid = function(lid) {
  return this.FP + lid;
};

/**
 * Get current function's argument count
 * 
 * 
 * @returns argument count
 */
RedbankVM.prototype.ARGC = function() {

  if (this.FP === 0) {
    throw "main function has no args";
  }

  var v = this.Stack[this.FP - 3];

  this.assert_var_object_number(v);

  return this.Objects[v.index].value;
};

/**
 * convert parameter index to (absolute) stack index
 * 
 * @param pid
 *          parameter index (relative to parameter[0], calculated from fp)
 * @returns
 */
RedbankVM.prototype.pid2sid = function(pid) {
  return this.FP - 3 - this.ARGC() + pid;
};

/**
 * push a JSVar onto stack, update reference count if necessary
 * 
 * Only OBJ var should update reference.
 * 
 * @param v
 *          JSVar to push on stack
 */
RedbankVM.prototype.push = function(v) {

  this.Stack.push(v);

  if (v.type === VT_OBJ) {
    this.Objects[v.index].ref++;
  }
  else if (v.type === VT_LNK) { // pushing parameters
    this.Links[v.index].ref++;
  }
};

RedbankVM.prototype.pop = function() {

  var v = this.Stack.pop();

  if (v.type === VT_OBJ) {
    this.object_ref_decr(v.index);
  }
  else if (v.type === VT_LNK) {
    this.link_ref_decr(v.index);
  }

  return v;
};

/**
 * Swap TOS and NOS
 * 
 * FORTH: N1, N1 -- N2, N1
 */
RedbankVM.prototype.swap = function() {
  var n1, n2;
  n1 = this.Stack.pop();
  n2 = this.Stack.pop();

  this.Stack.push(n1);
  this.Stack.push(n2);
};

/**
 * set an object var to local slot
 * 
 * @param addr
 * @param objvar
 */
RedbankVM.prototype.set_to_local = function(addr, objvar) {

  this.assert_var_addr_local(addr);
  this.assert_var_object(objvar);

  var v = this.Stack[this.lid2sid(addr.index)];
  if (v.type === VT_LNK) {
    this.object_ref_decr(this.Links[v.index].object);
    this.Links[v.index].object = objvar.index;
    this.incrREF(objvar.index);
  }
  else if (v.type === VT_OBJ) {
    this.object_ref_decr(v.index);
    this.Stack[this.lid2sid(addr.index)] = objvar;
    this.incrREF(objvar.index);
  }
  else {
    throw "unrecognized var type in local slot";
  }
};

/**
 * set an object var to param slot
 * 
 * @param addr
 * @param objvar
 */
RedbankVM.prototype.set_to_param = function(addr, objvar) {

  this.assert_var_addr_param(addr);
  this.assert_var_object(objvar);

  var v = this.Stack[this.pid2sid(addr.index)];
  if (v.type === VT_LNK) {
    this.object_ref_decr(this.Links[v.index].object);
    this.Links[v.index].object = objvar.index;
    this.incrREF(objvar.index);
  }
  else if (v.type === VT_OBJ) {
    this.object_ref_decr(v.index);
    this.Stack[this.pid2sid(addr.index)] = objvar;
    this.incrREF(objvar.index);
  }
  else {
    throw "unrecognized var type in param slot";
  }
};

/**
 * set an object var to frvar slot
 * 
 * @param addr
 * @param objvar
 */
RedbankVM.prototype.set_to_frvar = function(addr, objvar) {

  this.assert_var_addr_frvar(addr);
  this.assert_var_object(objvar);

  var v = this.freevars()[addr.index];

  if (v.type === VT_LNK) {
    this.object_ref_decr(this.Links[v.index].object);
    this.Links[v.index].object = objvar.index;
    this.incrREF(objvar.index);
  }
  else {
    throw "unrecognized var type in frvar slot";
  }
};

RedbankVM.prototype.set_to_object_prop = function(dst_objvar, propvar,
    src_objvar) {

  this.assert_var_object_object(dst_objvar);
  this.assert_var_addr_prop(propvar);

  var dst_object_index = dst_objvar.index;
  this.setProperty(dst_object_index, propvar.index, src_objvar.index);
};

/**
 * Store N1 to addr
 * 
 * FORTH: addr, N1 -- (! the sequence is different from that of FORTH)
 */
RedbankVM.prototype.store = function() {

  this.assert_var_object(this.TOS());
  this.assert_var_addr(this.NOS());

  var addr = this.NOS();

  if (addr.type === VT_LOC) { // store to local
    this.set_to_local(this.NOS(), this.TOS());
    this.pop();
    this.pop();

  }
  else if (addr.type === VT_ARG) { // store to arg

    this.set_to_param(this.NOS(), this.TOS());
    this.pop();
    this.pop();

  }
  else if (addr.type === VT_LEX) { // store to freevar

    this.set_to_frvar(this.NOS(), this.TOS());
    this.pop();
    this.pop();
  }
  else {
    throw "not supported address type for STORE";
  }
};

/**
 * Assign N1 to addr and left N1 as TOS
 * 
 * FORTH: addr, N1 -- N1
 */
RedbankVM.prototype.assign = function() {

  this.assert_var_object(this.TOS());
  this.assert_var_addr(this.NOS());

  var addr = this.NOS();

  if (addr.type === VT_LOC) {
    this.set_to_local(this.NOS(), this.TOS());
    this.swap();
    this.pop();
  }
  else if (addr.type === VT_ARG) {
    this.set_to_param(this.NOS(), this.TOS());
    this.swap();
    this.pop();
  }
  else if (addr.type === VT_LEX) {
    this.set_to_frvar(this.NOS(), this.TOS());
    this.swap();
    this.pop();
  }
  else if (addr.type === VT_PRO) {
    this.set_to_object_prop(this.ThirdOS(), this.NOS(), this.TOS());
    this.swap();
    this.pop();
    this.swap();
    this.pop();
  }
  else {
    throw "not supported yet";
  }
};

RedbankVM.prototype.printstack = function() {

  if (this.Stack.length === 0) {
    console.log("STACK Empty");
  }
  else {
    console.log("STACK size: " + this.Stack.length);
    for (var i = this.Stack.length - 1; i >= 0; i--) {
      var v = this.Stack[i];
      if (v.type === VT_OBJ) {
        var index = v.index;
        var obj = this.Objects[index];

        if (obj.type === "object") {
          console.log(i + " : " + index + " (object) ref: " + obj.ref);
        }
        else if (obj.type === "function") {
          var func_prt = VT_OBJ + " " + index + " (function) " + "entry: "
              + obj.value + ", ref: " + obj.ref;
          console.log(i + " : " + func_prt);
        }
        else if (obj.type === "undefined") {
          console.log(i + " : " + "UNDEFINED");
        }
        else {
          console.log(i + " : " + VT_OBJ + ", index: " + index + ", value: "
              + obj.value + ", ref: " + obj.ref);
        }

      }
      else if (v.type === VT_LOC) {
        console.log(i + " : [addr] " + VT_LOC + " " + v.index);
        // } else if (v.type === VT_VAL) {
        // console.log(i + " : " + VT_VAL + " " + v.index);
      }
      else if (v.type === VT_ARG) {
        console.log(i + " : [addr] " + VT_ARG + " " + v.index);
      }
      else if (v.type === VT_LEX) {
        console.log(i + " : [addr] " + VT_LEX + " " + v.index);
      }
      else if (v.type === "undefined") {
        console.log(i + " : UNDEFINED");
      }
      else {
        console.log(i + " : " + v.type);
      }
    }
  }
};

RedbankVM.prototype.printfreevar = function() {

  if (this.FP === 0) {
    return;
  }

  var v = this.Stack[this.FP - 1];

  if (v.type !== VT_OBJ || this.Objects[v.index].type !== "function") {
    throw "error, function object not found!";
  }

  v = this.Objects[v.index];

  if (v.lexicals.length === 0) {
    return;
  }

  console.log("  --- lexicals ---");

  for (var i = 0; i < v.lexicals.length; i++) {

    var f = v.lexicals[i];
    if (f.type !== VT_LNK) {
      throw "error freevar type";
    }

    console.log(i + " : " + "link id: " + f.index + ", ref: "
        + this.Links[f.index].ref + ", obj: " + this.Links[f.index].object);
  }
};

RedbankVM.prototype.findLabel = function(code, label) {

  for (var i = 0; i < code.length; i++) {
    var bytecode = this.code[i];
    if (bytecode.op === "LABEL" && bytecode.arg1 === label) {
      return i;
    }
  }

  throw "Label not found";
};

RedbankVM.prototype.stepCapture = function(bytecode) {

  var v, id;
  var f = this.Objects[this.TOS().index];
  
  if (bytecode.arg1 === "argument" || bytecode.arg1 === "local") {
    if (bytecode.arg1 === "argument") {
      v = this.Stack[this.pid2sid(bytecode.arg2)];
    }
    else {
      v = this.Stack[this.lid2sid(bytecode.arg2)];
    }

    if (v.type === VT_LNK) {
      f.lexicals.push(new JSVar(VT_LNK, v.index));
      this.Links[v.index].ref++;

    }
    else if (v.type === VT_OBJ) {
      id = this.alloc_link();

      this.Links[id] = {
        ref : 2, // we create 2 links to it
        object : v.index
      };

      // change to link
      v.type = VT_LNK;
      v.index = id;

      f.lexicals.push(new JSVar(VT_LNK, id));
    }
    else {
      throw "error";
    }
  }
  else if (bytecode.arg1 === "lexical") {
    // copy link id and incr reference count
    throw "not implemented yet";
  }
  else {
    throw "error capture from type : " + bytecode.arg1;
  }
};

RedbankVM.prototype.step = function(code, bytecode) {
  var v, obj;
  var id, index;
  var val;
  var opd1, opd2;

  switch (bytecode.op) {

  case "CALL":
    v = this.TOS();
    this.PCStack.push(this.PC);
    this.FPStack.push(this.FP);
    this.PC = this.Objects[v.index].label;
    this.FP = this.Stack.length;
    break;

  case "CAPTURE":
    this.stepCapture(bytecode);
    break;

  case "DROP": // n1 --
    this.pop();
    break;

  case "FETCH": // addr -- n1 or O1, prop1 -- O2
    var addr = this.Stack.pop();
    if (addr.type === VT_LOC) {
      v = this.Stack[this.lid2sid(addr.index)];
      if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, this.Links[v.index].object);
      }
      else if (v.type !== VT_OBJ) {
        throw "Unsupported var type in local slot";
      }
    }
    else if (addr.type === VT_ARG) {
      v = this.Stack[this.pid2sid(addr.index)];
      if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, this.Links[v.index].object);
      }
      else if (v.type !== VT_OBJ) {
        throw "Unsupported var type in param slot";
      }
    }
    else if (addr.type === VT_LEX) {
      v = this.freevars()[addr.index]; // freevar
      if (v.type === VT_LNK) {
        v = new JSVar(VT_OBJ, this.Links[v.index].object);
      }
      else {
        throw "Unsupported var type in frvar slot";
      }
    }
    else if (addr.type === VT_PRO) {

      id = this.TOS().index;
      var propIndex = this.findProperty(id, addr.index);
      if (propIndex === undefined) {
        v = new JSVar(VT_OBJ, 0);
      }
      else {
        v = new JSVar(VT_OBJ, this.Objects[id].properties[propIndex].index);
      }

      this.pop(); // TODO be careful for pop first push second for the same
      // object may be delete.

    }
    else {
      throw "not supported yet.";
    }
    this.push(v);
    break;

  case "FUNC": // -- f1
    id = this.createFunction(bytecode.arg1, bytecode.arg2, bytecode.arg3);
    this.push(new JSVar(VT_OBJ, id));
    break;

  case "JUMP":
    v = bytecode.arg1;
    v = this.findLabel(this.code, v);
    this.PC = v;
    break;

  case "JUMPC":
    v = this.getval_var_object_boolean(this.TOS());
    this.pop();
    if (v) {
      this.PC = this.findLabel(this.code, bytecode.arg1);
    }
    else {
      this.PC = this.findLabel(this.code, bytecode.arg2);
    }
    break;

  case "LABEL":
    // do nothing
    break;

  case "LITA":
    // push an address, may be local, param, or closed
    if (bytecode.arg1 === "LOCAL") {
      v = new JSVar(VT_LOC, bytecode.arg2);
      this.Stack.push(v);
    }
    else if (bytecode.arg1 === 'PARAM') {
      v = new JSVar(VT_ARG, bytecode.arg2);
      this.Stack.push(v);
    }
    else if (bytecode.arg1 === 'LEXICAL') {
      v = new JSVar(VT_LEX, bytecode.arg2);
      this.Stack.push(v);
    }
    else if (bytecode.arg1 === "PROP") {
      v = new JSVar(VT_PRO, bytecode.arg2);
      this.Stack.push(v);
    }
    else {
      throw "not supported yet";
    }

    break;

  case "LITC":
    // push an constant value
    val = bytecode.arg1;
    id = this.createPrimitive(val);
    v = new JSVar(VT_OBJ, id);
    this.push(v);
    break;

  case "LITN":
    // push n UNDEFINED object
    for (var i = 0; i < bytecode.arg1; i++) {
      this.Stack.push(new JSVar(VT_OBJ, this.UNDEFINED));
    }
    break;

  case "LITO":
    // create an object object and push to stack
    id = this.createObject(this.OBJECT.proto);
    v = new JSVar(VT_OBJ, id);
    this.push(v);
    break;

  case "TEST":
    if (this.testcase !== undefined) {
      if (!(bytecode.arg1 in this.testcase)) {
        console.log(Format.dotline
            + "WARNING :: testcase does not have function " + bytecode.arg1);
      }
      else if (typeof this.testcase[bytecode.arg1] !== 'function') {
        console.log(Format.dotline + "WARNING :: testcase's property "
            + this.testcase[bytecode.arg1] + " is not a function");
      }
      else {
        console.log(Format.dotline + "[" + this.testcase.group + "] "
            + this.testcase.name);
        this.testcase[bytecode.arg1](this);
        console.log(Format.dotline + "[PASS]");
      }
    }
    else {
      console.log(Format.dotline + "WARNING :: testcase not found");
    }
    break;

  case "RET":
    if (this.FP === 0) { // main()
      while (this.Stack.length) {
        this.pop();
      }
      this.PC = this.code.length; // exit

    }
    else {

      var result;
      var argc = this.ARGC();

      if (bytecode.arg1 === "RESULT") {
        result = this.Stack.pop();
      }

      while (this.Stack.length > this.FP) {
        this.pop();
      }

      this.pop(); // pop function object
      this.pop(); // pop this object
      this.pop(); // argc
      for (i = 0; i < argc; i++) {
        this.pop(); // pop params
      }

      // restore fp and pc
      this.PC = this.PCStack.pop();
      this.FP = this.FPStack.pop();

      if (result === undefined) { // no return value provided
        this.Stack.push(new JSVar(VT_OBJ, 0));
      }
      else {
        this.Stack.push(result);
      }
    }
    break;

  case "STORE": // addr n1 --
    this.store();
    break;

  case "+":
    // assert, only number supported up to now
    this.assert_var_object_number(this.TOS());
    this.assert_var_object_number(this.NOS());

    // do calculation
    v = this.Objects[this.NOS().index].value
        + this.Objects[this.TOS().index].value;

    // pop operand
    this.pop();
    this.pop();

    // create new value object
    id = this.createPrimitive(v);

    // push result on stack
    this.push(new JSVar(VT_OBJ, id));
    break;

  case "*":
    // assert, only number supported up to now
    this.assert_var_object_number(this.TOS());
    this.assert_var_object_number(this.NOS());

    // do calculation
    v = this.Objects[this.NOS().index].value
        * this.Objects[this.TOS().index].value;

    // pop operand
    this.pop();
    this.pop();

    // create new value object
    // TODO using alloc
    id = this.createPrimitive(v);

    // push result on stack
    this.push(new JSVar(VT_OBJ, id));
    break;

  case '=':
    this.assign();
    break;

  case '===':

    this.assert_var_object(this.TOS());
    this.assert_var_object(this.NOS());

    if (this.TOS().type === this.NOS().type
        && this.Objects[this.TOS().index].type === this.Objects[this.NOS().index].type
        && this.Objects[this.TOS().index].value === this.Objects[this.NOS().index].value) {
      id = this.createPrimitive(true);
    }
    else {
      id = this.createPrimitive(false);
    }
    v = new JSVar(VT_OBJ, id);

    this.pop();
    this.pop();
    this.push(v);

    break;

  default:
    throw "!!! unknown instruction : " + bytecode.op;
  }
};

RedbankVM.prototype.run = function(input, testcase) {

  this.init();

  this.code = input;
  this.testcase = testcase;

  console.log(Format.hline);
  console.log("[[Start Running ]]");
  console.log(Format.hline);

  while (this.PC < this.code.length) {

    var bytecode = this.code[this.PC];

    this.printstack();
    this.printfreevar();
    console.log(Format.hline);
    console.log("PC : " + this.PC + ", FP : " + this.FP);
    console.log("OPCODE: " + bytecode.op + ' '
        + ((bytecode.arg1 === undefined) ? '' : bytecode.arg1) + ' '
        + ((bytecode.arg2 === undefined) ? '' : bytecode.arg2) + ' '
        + ((bytecode.arg3 === undefined) ? '' : bytecode.arg3));

    // like the real
    this.PC++;
    this.step(this.code, bytecode);
  }

  this.printstack();
  this.printfreevar();
  this.assert_no_leak();
};

module.exports = RedbankVM;
