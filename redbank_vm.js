/*-*****************************************************************************
 * 
 * Virtual Machine
 * 
 * 
 * TOS 
 * NOS
 * ThirdOS 
 * temp 
 * ... 
 * temp 
 * local [local size - 1] 
 * ... 
 * local [1] 
 * local [0]      <- FP
 * argc           <- FP - 1   argc must be placed on the caller stack
 * param [argc - 1]
 * ... 
 * param [0]      <- FP - 1 - argc
 * THIS           <- FP - 1 - argc - 1
 * FUNCTION       <- FP - 1 - argc - 1 - 1
 * 
 ******************************************************************************/

/**
 * NOTE! on value space
 * 
 * ECMA262 specification uses the uniform value space to describe both abstract
 * (host) and native methods. This is inconvenient for host implementation. It
 * also has negative impact on performance.
 * 
 * For example, the GET_OWN_PROPERTY abstract method possibly returns undefined.
 * 
 * In red bank, we do our best to separate native (implemented javascript) value
 * space and host abstract methods.
 * 
 * For example, the GET_OWN_PROPERTY returns a PropertyDescriptor object, which
 * has isUndefined() method to check it's nullability, rather than return
 * JS_UNDEFINED, which is a value in native value space.
 * 
 * There should be no intersection between native value space and host value
 * space. Or the conversion must be done in host functions that returns or
 * modifies values in native space.
 */

/**
 * NOTE on host function
 * 
 * 1. Use stack top to pass returned native value. This should also be true for
 * ecma defined abstract method. For example, the internal GET method for Object
 * or the CALL method for Function. If stack top is not used for passing return
 * value, there is a danger that the object or the object it refers to, either
 * directly or indirectly, may be removed due to reference counting.
 * 
 * 2. The general rules are:
 * 
 * a. If the host function returns host value. It should not put that value onto
 * stack.
 * 
 * b. If the host function returns native value. It should push it onto stack.
 * The caller, either host or native, pick the value from the stack. So the
 * callee doesn't need to know whether the caller is host or native.
 * 
 * c. The host function should return error, using host value (negative number).
 * 
 */

var Common = require('./common.js');

var NO_TESTCASE_ASSERTION = true;

var ERR_NONE = 0;
var ERR_TYPE_ERROR = -1;
var ERR_REFERENCE_ERROR = -2;

var ADDR_LOCAL = 'local';
var ADDR_PARAM = 'param';
var ADDR_LEXICAL = 'lexical';
var ADDR_PROPERTY = 'property';
var ADDR_CATCH = 'catch';

/**
 * The complete list of ecma object types, including internal types
 * 
 * not all of these types are implemented in red bank
 */
var UNDEFINED_TYPE = 'undefined';
var NULL_TYPE = 'null';
var BOOLEAN_TYPE = 'boolean';
var STRING_TYPE = 'string';
var NUMBER_TYPE = 'number';
var OBJECT_TYPE = 'object';

var REFERENCE_TYPE = 'reference';
var LIST_TYPE = 'list';
var COMPLETION_TYPE = 'completion';
var PROPERTY_DESCRIPTOR_TYPE = 'property descriptor';
var PROPERTY_IDENTIFIER_TYPE = 'property identifier';
var LEXICAL_ENVIRONMENT_TYPE = 'lexical environment';
var ENVIRONMENT_RECORD_TYPE = 'environment record';

/**
 * The red bank specific type
 */
var ADDR_TYPE = 'addr'; // red bank internal type
var LINK_TYPE = 'link'; // red bank internal type
var TRAP_TYPE = 'trap'; // red bank internal type
var VECTOR_TYPE = 'vector'; // red bank internal type
var PROPERTY_TYPE = 'property'; // red bank internal type

/**
 * Object Class
 * 
 * "Arguments", "Array", "Boolean", "Date", "Error", "Function", "JSON", "Math",
 * "Number", "Object", "RegExp", and "String".
 */
var ARGUMENTS_CLASS = "Arguments";
var ARRAY_CLASS = "Array";
var BOOLEAN_CLASS = "Boolean";
var DATE_CLASS = "Date";
var ERROR_CLASS = "Error";
var FUNCTION_CLASS = "Function";
var JSON_CLASS = "JSON";
var MATH_CLASS = "Math";
var NUMBER_CLASS = "Number";
var OBJECT_CLASS = "Object";
var REGEXP_CLASS = "RegExp";
var STRING_CLASS = "String";

/**
 * hash table constants
 */
var STRING_HASHBITS = 7;
var STRING_HASHTABLE_SIZE = (1 << STRING_HASHBITS);
var PROPERTY_HASHBITS = 7;
var PROPERTY_HASHTABLE_SIZE = (1 << PROPERTY_HASHBITS);

var STACK_SIZE_LIMIT = 65536;

/**
 * The Object Heap in red bank
 * 
 */
var ObjectHeap = [];

/**
 * The host object heap, not used yet
 */
var HostHeap = [];

function build_const_dictionary() {

  var p = [];
  p.push("toString");
  p.push("valueOf");
  p.push("Object");
  p.push("Function");
  p.push("length");
  p.push("prototype");
  p.push("undefined");
  p.push("null");
  p.push("boolean");
  p.push("true");
  p.push("false");
  p.push("number");
  p.push("string");

  return p;
}

/**
 * Push an host object into host heap
 * 
 * @param x
 */
function hostRegister(x) {

  if (HostHeap.indexOf(x) !== -1) {
    throw "error";
  }

  HostHeap.push(x);
}

/**
 * Remove an host object from host heap
 * 
 * @param x
 */
function hostUnregister(x) {

  var index = HostHeap.indexOf(x);

  if (index === -1) {
    throw "error";
  }

  HostHeap.splice(index, 1);
}

var STRING_HASH = 0;
var stringHashObj;
var PROPERTY_HASH = 0;
var propertyHashObj;

/**
 * main stack and error stack TODO
 */
var MAIN_STACK = 0;
var mainStackLength = 0;
var mainStackObj;

var ERROR_STACK = 0;
var errorStackObj;

var MACHINE;

/**
 * Hash function (FNV-1a 32bit)
 * 
 * This function is used to hash a string into 32bit unsigned integer
 * 
 * @param str
 * @returns
 */
function HASH(str) {
  // gist code : https://gist.github.com/vaiorabbit/5657561
  // 32 bit FNV-1a hash
  // Ref.: http://isthe.com/chongo/tech/comp/fnv/

  var FNV1_32A_INIT = 0x811c9dc5;
  var hval = FNV1_32A_INIT;
  for (var i = 0; i < str.length; ++i) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8)
        + (hval << 24);
  }
  return hval >>> 0;
}

/**
 * This function
 * 
 * @param hash
 * @param id
 * @returns
 */
function HASHMORE(hash, id) {
  // naive implementation
  return (hash * id) >>> 0;
}

function register(obj) {

  if (obj.type === undefined) {
    throw "error";
  }

  ObjectHeap.push(obj);
  var id = ObjectHeap.length - 1;
  obj.id = id; // back annotation
  return id;
}

function unregister(id) {

  var obj = ObjectHeap[id];
  if (obj.count !== 0) {
    throw "error"; // TODO assert?
  }

  console.log("[[ Object " + id + " (" + obj.type + ") being removed ]]");
  ObjectHeap[id] = undefined;
}

function getObject(id) {
  return ObjectHeap[id];
}

function typeOfObject(id) {
  return getObject(id).type;
}

function assert(expr) {
  if (!(expr)) {
    throw "ASSERT FAIL";
  }
}

function classOfObject(id) {
  assert(typeOfObject(id) === 'object');
  return getObject(id).CLASS;
}

function assertValid(id) {
  if (typeof id !== 'number' || id < 0 || id >= ObjectHeap.length) {
    throw "assert fail, id is NOT zero or positive number";
  }
}

function defined(id) {
  assertValid(id);
  return (getObject(id) === undefined) ? false : true;
}

function assertDefined(id) {

  assert(defined(id));
}

function assertType(id, type) {

  assertDefined(id);
  assert(typeOfObject(id) === type);
}

function assertEcmaLangObject(id) {

  assertDefined(id);
  assert(typeOfObject(id) === OBJECT_TYPE);
}

function assertEcmaLangType(id) {

  assertDefined(id);
  assert(getObject(id).isEcmaLangType());
}

function assertClass(id, CLASS) {

  assertEcmaLangObject(id);
  assert(classOfObject(id) === CLASS);
}

/**
 * 
 * This function increment the reference count of object id
 * 
 * The object/name/index is pushed into object id's referrer queue, for
 * debugging purpose.
 * 
 * @param id
 * @param object
 * @param name
 * @param index
 */
function incr(id, object, member) {

  if (object === undefined) {
    throw "error";
  }

  if (id === 0) {
    return;
  }

  var obj = getObject(id);

  obj.count++;
  obj.referrer.push({
    object : object,
    member : member
  });
}

function decr(id, object, member) {

  var i;

  if (id === 0) {
    return;
  }

  var obj = getObject(id);
  if (obj === undefined || obj.referrer.length === 0) {
    throw "error";
  }

  for (i = 0; i < obj.referrer.length; i++) {
    if (obj.referrer[i].object === object && obj.referrer[i].member === member) {
      break;
    }
  }

  if (i === obj.referrer.length) {
    throw "error, referrer not found";
  }

  obj.referrer.splice(i, 1);
  obj.count--;

  if (obj.count === 1 && obj.type === 'string') {

    uninternString(id); // uninterning string will cause it be removed.
    return;
  }

  if (obj.count === 0) {

    switch (obj.type) {
    case 'addr':
      break;

    case 'boolean':
      break;

    case 'number':
      break;

    case 'string':
      decr(obj.nextInSlot, id, 'nextInSlot');
      break;

    case 'link':
      decr(obj.target, id, 'target');
      break;

    case 'property':
      // hash is already recycled in object decr
      if (obj.VALUE) {
        decr(obj.VALUE, id, 'VALUE'); // recycle child
      }
      if (obj.GET) {
        decr(obj.GET, id, 'GET');
      }
      if (obj.SET) {
        decr(obj.SET, id, 'SET');
      }
      decr(obj.name, id, 'name'); // recycle name string
      decr(obj.nextInObject, id, 'nextInObject'); // recycle next
      break;

    case 'object':

      if (obj.CLASS === FUNCTION_CLASS) {
        decr(obj.lexicals, id, 'lexicals');
      }

      // recycle all property hash
      for (var curr = obj.property; curr !== 0; curr = getObject(curr).nextInObject) {
        unhashProperty(curr);
      }

      // recycle prototype
      decr(obj.PROTOTYPE, id, 'PROTOTYPE');
      // recycle root property
      decr(obj.property, id, 'property');
      break;

    case 'trap':
      decr(obj.param, id, 'param');
      break;

    case 'vector':
      for (var v = 0; v < obj.size; v++) {
        decr(obj.elem[v], id, v);
      }
      break;

    default:
      throw "not implemented.";
    }

    unregister(id);
  }
}

/**
 * 
 * set id to object's member field
 * 
 * @param id
 * @param object
 * @param member
 */
function set(id, object, member) {

  var old = 0;
  var obj = getObject(object);
  var type = obj.type;

  if (type === VECTOR_TYPE) {
    old = obj.elem[member];
    obj.elem[member] = id;
  }
  else {
    old = obj[member];
    obj[member] = id;
  }

  if (id !== 0) {
    incr(id, object, member);
  }

  if (old !== 0) {
    decr(old, object, member);
  }
}

/**
 * 
 * @param string
 * @returns
 */
function internFindString(string) {

  assert(typeof string === 'string');

  var StringHash = getObject(STRING_HASH);
  var hash = HASH(string);
  hash = hash >>> (32 - STRING_HASHBITS);

  var id = StringHash.elem[hash];
  if (id === 0) {
    return 0;
  }

  // traverse linked list
  for (; id !== 0; id = getObject(id).nextInSlot) {

    var obj = ObjectHeap[id];
    if (obj.type !== 'string') {
      throw "not a string";
    }
    if (obj.value === string) {
      return id;
    }
  }

  return 0;
}

function internFindConstantString(string) {

  assert(typeof string === 'string');

  var id = internFindString(string);

  if (id === 0) {
    console.log("ERROR: string '" + string + "' is not interned as constant!");
    throw "error";
  }
}

function internNewString(id) {

  var obj = getObject(id);

  var str = obj.value;

  var hash = HASH(str);
  obj.interned = true;
  obj.hash = hash;

  hash = hash >>> (32 - STRING_HASHBITS); // drop 20 bits, 12 bit left

  set(stringHashObj.elem[hash], id, 'nextInSlot');

  set(id, STRING_HASH, hash);
}

function uninternString(id) {

  var obj = getObject(id);

  assert(typeOfObject(id) === STRING_TYPE);

  // assert(obj.type === 'string');

  var hash = obj.hash;
  hash = hash >>> (32 - STRING_HASHBITS); // shake off 20 bits

  // if (StringHash[hash] === id) {
  if (stringHashObj.elem[hash] === id) {

    // set(getObject(id).nextInSlot, this.id, 'StringHash', hash);
    set(getObject(id).nextInSlot, STRING_HASH, hash);
    return;
  }

  // for (var curr = StringHash[hash];; curr = getObject(curr).nextInSlot) {
  for (var curr = stringHashObj.elem[hash];; curr = getObject(curr).nextInSlot) {
    var next = getObject(curr).nextInSlot;
    if (next === 0) {
      throw "not found in StringHash";
    }

    if (next === id) {
      var nextnext = getObject(next).nextInSlot;
      set(nextnext, curr, 'nextInSlot');
      return;
    }
  }
};

/**
 * 
 * @param property
 */
function hashProperty(property) {

  var propObj = getObject(property);
  var parent = propObj.object;
  var name = propObj.name;

  var nameObj = getObject(name);
  var nameHash = nameObj.hash;

  var propHash = HASHMORE(nameHash, parent);

  propHash = propHash >>> (32 - PROPERTY_HASHBITS);

  // var x = this.PropertyHash[propHash];
  var x = propertyHashObj.elem[propHash];
  if (x === 0) {
    set(property, PROPERTY_HASH, propHash);
  }
  else {
    set(x, property, 'nextInSlot');
    set(property, PROPERTY_HASH, propHash);
  }
}

/**
 * This function remove the property out of hash table
 * 
 * @param property
 */
function unhashProperty(property) {

  var propObj = getObject(property);
  var parent = propObj.object;
  var name = propObj.name;
  // var child = propObj.child;

  var nameObj = getObject(name);
  var nameHash = nameObj.hash;

  var propHash = HASHMORE(nameHash, parent);

  propHash = propHash >>> (32 - PROPERTY_HASHBITS);

  if (propertyHashObj.elem[propHash] === property) {
    set(propObj.nextInSlot, PROPERTY_HASH, propHash);
    return;
  }

  for (var x = propertyHashObj.elem[propHash];; x = getObject(x).nextInSlot) {

    var next = getObject(x).nextInSlot;
    if (next === 0) {
      throw "property not found in property hash";
    }

    if (next === property) {
      var nextnext = getObject(next).nextInSlot;
      set(nextnext, x, 'nextInSlot');
      return;
    }
  }
}

// TODO should be set in boot strap
var JS_UNDEFINED = 0;
var JS_NULL = 0;
var JS_TRUE = 0;
var JS_FALSE = 0;

var JS_POSITIVE_INFINITY = 0;
var JS_NEGATIVE_INFINITY = 0;
var JS_POSITIVE_ZERO = 0;
var JS_NEGATIVE_ZERO = 0;
var JS_NAN = 0;

// built-in prototypes
var OBJECT_PROTO = 0;
var OBJECT_CONSTRUCTOR = 0;
var FUNCTION_PROTO = 0;
var FUNCTION_CONSTRUCTOR = 0;
var ARRAY_PROTO = 0;

var JS_GLOBAL = 0;
var globalObj;

/**
 * the ultimate prototype of all types
 */
var typeProto = {};

typeProto.isPrimitive = function() {
  if (this.type === UNDEFINED_TYPE || this.type === NULL_TYPE
      || this.type === BOOLEAN_TYPE || this.type === NUMBER_TYPE
      || this.type === STRING_TYPE) {
    return true;
  }
  return false;
};

typeProto.isObject = function() {
  if (this.type === OBJECT_TYPE) {
    return true;
  }
  return false;
};

/**
 * is primitve or is object
 */
typeProto.isEcmaLangType = function() {
  if (this.isPrimitive() || this.isObject()) {
    return true;
  }
  return false;
};

typeProto.isEdmaSpecType = function() {
  if (this.type === REFERENCE_TYPE || this.type === LIST_TYPE
      || this.type === COMPLETION_TYPE
      || this.type === PROPERTY_DESCRIPTOR_TYPE
      || this.type === PROPERTY_IDENTIFIER_TYPE
      || this.type === LEXICAL_ENVIRONMENT_TYPE
      || this.type === ENVIRONMENT_RECORD_TYPE) {
    return true;
  }

  return false;
};

/**
 * all ecma language type and specification type
 */
typeProto.isEcmaType = function() {
  if (this.isEcmaLangType() || this.isEcmaSpecType()) {
    return true;
  }
  return false;
};

/*******************************************************************************
 * 
 * CHAPTER 8
 * 
 ******************************************************************************/
var CHAPTER_08;

/**
 * 8.1 The Undefined Type
 */
var CHAPTER_08_01;

function createUndefined() {

  var obj = Object.create(typeProto);

  obj.type = UNDEFINED_TYPE;
  obj.count = Infinity;
  obj.referrer = [];
  obj.tag = 'undefined';

  obj.IsUndefined = function() {
    return true;
  };

  return register(obj);
}

/**
 * 8.2 The Null Type
 */
var CHAPTER_08_02;

function createNull() {

  var obj = Object.create(typeProto);

  obj.type = NULL_TYPE;
  obj.count = Infinity;
  obj.referrer = [];
  obj.tag = 'null';
  return register(obj);
}

/**
 * 8.3 The Boolean Type
 */
var CHAPTER_08_03;

function createBoolean(value) {

  if (typeof value !== 'boolean') {
    throw "error";
  }

  var obj = Object.create(typeProto);

  obj.type = BOOLEAN_TYPE;
  obj.count = 0;
  obj.referrer = [];
  obj.value = value;
  obj.tag = (value) ? "true" : "false";
  return register(obj);
}

/**
 * 8.4 The String Type
 */
var CHAPTER_08_04_THE_STRING_TYPE;

function createString(value) {

  if (typeof value !== 'string') {
    throw "error";
  }

  var id = internFindString(value);

  if (id !== 0) {
    return id;
  }

  var obj = Object.create(typeProto);

  obj.type = STRING_TYPE;
  obj.count = 0;
  obj.referrer = [];
  obj.value = value;
  obj.nextInSlot = 0;

  id = register(obj);
  internNewString(id);
  return id;
}

/**
 * 8.5 The Number Type
 */
var CHAPTER_08_05_THE_NUMBER_TYPE;

function createNumber(value) {

  if (typeof value !== 'number') {
    throw 'error';
  }

  var obj = Object.create(typeProto);

  obj.type = NUMBER_TYPE;
  obj.count = 0;
  obj.referrer = [];
  obj.value = value;
  return register(obj);
}

/**
 * 8.6 The Object Type
 */
var CHAPTER_08_06_THE_OBJECT_TYPE;

/**
 * 8.7 The Reference Specification Type
 */
var CHAPTER_08_07_THE_REFERENCE_SPECIFICATION_TYPE;

var referenceProto = Object.create(typeProto);

referenceProto.GetBase = function() {
  return this.base;
};

referenceProto.GetReferencedName = function() {
  return this.name;
};

referenceProto.IsStrictReference = function() {
  return this.strict;
};

referenceProto.HasPrimitiveBase = function() {

  var baseType = typeOfObject(this.base);
  if (baseType === BOOLEAN_TYPE || baseType === STRING_TYPE
      || baseType === NUMBER_TYPE) {
    return true;
  }
  return false;
};

referenceProto.IsPropertyReference = function() {

  // if environment record is not implemented, this function always return true.
  if (this.HasPrimitiveBase() || typeOfObject(this.base) === OBJECT_TYPE) {
    return true;
  }
  return false;
};

referenceProto.IsUnresolvableReference = function() {

  return (this.base === JS_UNDEFINED) ? true : false;
};

function newReferenceType(base, name, strict) {

  assertDefined(base);

  /**
   * environment record type is not implemented
   */
  var baseType = typeOfObject(base);
  assert(baseType === UNDEFINED_TYPE || baseType === OBJECT_TYPE
      || baseType === BOOLEAN_TYPE || baseType === STRING_TYPE
      || baseType === NUMBER_TYPE);

  assert(typeOfObject(name) === STRING_TYPE);

  var obj = Object.create(referenceProto);

  obj.type = REFERENCE_TYPE;

  obj.base = base;
  obj.name = name;
  obj.strict = strict;

  return obj;
}

var CHAPTER_08_07_01;

/**
 * 8.7.1 GetValue (V)
 * 
 * This abstract method retrieves ecma lang type from reference type.
 * 
 * This is a stack function. V is supposed to be TOS and replaced by result.
 * 
 * FORTH NOTATION: V -- result
 * 
 */
function GetValue() {

  var id = MACHINE.TOS();
  var obj = getObject(id);

  if (typeOfObject(id) !== REFERENCE_TYPE) {
    return ERR_NONE;
  }

  var base = obj.GetBase();
  var P = obj.GetReferencedName();

  if (obj.IsUnresolvableReference() === true) {
    return ERR_REFERENCE_ERROR;
  }

  if (obj.IsPropertyReference()) {

    var get;
    if (obj.HasPrimitiveBase() === false) {
      get = obj.GET;
    }
    else {
      get = function() {
        
        // ref-type -- base
        set(base, MAIN_STACK, MACHINE.indexOfTOS());
        
        // base -- object (with primitive value)
        toObject();
        
        var desc = getObject(MACHINE.TOS()).GET_PROPERTY(P);
        if (desc === undefined ) { // refactor TODO
          set(JS_UNDEFINED, MAIN_STACK, MACHINE.indexOfTOS());
        } 
        
      };
    }
    
    get(base, P);
  }
  
  throw "error";

  // no else, environment record not implemented.
}

var CH08_07_02_PUT_VALUE;

function PutValue(V, W) {

}

/**
 * 
 */

var propertyDescriptorProto = Object.create(typeProto);

/*******************************************************************************
 * 
 * PropertyDescriptor is a host object defined for abstract methods
 * 
 ******************************************************************************/

/**
 * using 'new' rather than 'create' as function name prefix to denote that the
 * object is NOT allocated on ObjectHeap.
 * 
 * All Object's abstract methods are implemented using this data structure.
 * 
 * Logically, this type has six data fields, in which:
 * 
 * GET, SET, and VALUE maps to redbank-js value space, that is, 0 for undefined,
 * positive integer for object heap id.
 * 
 * WRITABLE, ENUMERABLE, CONFIGURABLE, are host js boolean values.
 */
function newPropertyDescriptor() {

  var obj = Object.create(propertyDescriptorProto);
  obj.type = PROPERTY_DESCRIPTOR_TYPE;

  obj.GET = 0;
  obj.SET = 0;
  obj.VALUE = 0;

  /**
   * According to spec, writable, enumerable, and configurable fields are
   * tri-state: undefined, true, or false
   */
  return obj;
}

/** not used yet * */
function deletePropertyDescriptor(obj) {

  hostUnregister(obj);
}

/**
 * 8.10.1 IsAccessorDescriptor ( Desc )
 * 
 * @param Desc
 * @returns {Boolean} host value true or false
 */
function isAccessorDescriptor(Desc) {

  if (Desc === undefined) {
    return false;
  }
  if (Desc.GET === JS_UNDEFINED && Desc.SET === JS_UNDEFINED) {
    return false;
  }
  return true;
}

/**
 * 8.10.2 IsDataDescriptor ( Desc )
 * 
 * @param Desc
 * @returns {Boolean} host value true or false
 */
function isDataDescriptor(Desc) {

  if (Desc === undefined) {
    return false;
  }
  if (Desc.VALUE === JS_UNDEFINED && this.WRITABLE === undefined) {
    return false;
  }
  return true;
}

/**
 * 8.10.3 IsGenericDescriptor ( Desc )
 * 
 * @param Desc
 * @returns {Boolean}
 */
function isGenericDescriptor(Desc) {

  if (Desc === undefined) {
    return false;
  }
  if (false === isAccessorDescriptor(Desc) && false === isDataDescriptor(Desc)) {
    return true;
  }
  return false;
}

/**
 * 8.10.4 FromPropertyDescriptor ( Desc )
 * 
 * In spec, this function is only used in 15.2.3.3
 * Object.getOwnPropertyDescriptor ( O, P ), where a native property descriptor
 * object is created.
 * 
 * The Desc must be a fully populated descriptor
 * 
 * @param Desc
 */
function fromPropertyDescriptor(Desc) {

  if (Desc === undefined) {
    return undefined;
  }

  var id = createObjectObject(); // TODO
  var obj = getObject(id);
  var descArg, name;

  if (isDataDescriptor(Desc)) {

    name = internFindConstantString("value");

    descArg = newPropertyDescriptor();
    descArg.VALUE = Desc.VALUE;
    descArg.WRITABLE = true;
    descArg.ENUMERABLE = true;
    descArg.CONFIGURABLE = true;

    obj.DEFINE_OWN_PROPERTY(name, descArg, false);

    name = internFindConstantString("writable");
    descArg = newPropertyDescriptor();
    descArg.VALUE = (Desc.WRITABLE === true) ? JS_TRUE : JS_FALSE;
    descArg.WRITABLE = true;
    descArg.ENUMERABLE = true;
    descArg.CONFIGURABLE = true;

    obj.DEFINE_OWN_PROPERTY(name, descArg, false);
  }

  // not finished yet TODO

  return id;
}

/**
 * 8.10.5 ToPropertyDescriptor ( Obj )
 * 
 * This function is used only in 15.2.3.6 Object.defineProperty ( O, P,
 * Attributes ) and 15.2.3.7 Object.defineProperties ( O, Properties ) to
 * construct native object's properties from native property object.
 */
function toPropertyDescriptor() {

  throw "not implemented yet";
}

var propertyProto = Object.create(typeProto);
var objectProto = Object.create(typeProto);

var functionProto = Object.create(objectProto);
var arrayProto = Object.create(objectProto);
var booleanProto = Object.create(objectProto);
var numberProto = Object.create(objectProto);
var stringProto = Object.create(objectProto);

/**
 * Factory for (indexed) addr object
 * 
 * @param addrType
 * @param index
 * @returns
 */
function createAddr(addrType, index) {

  if (typeof addrType !== 'string' || typeof index !== 'number') {
    throw "error";
  }

  var obj = Object.create(typeProto);

  obj.type = ADDR_TYPE;
  obj.count = 0;
  obj.referrer = [];

  obj.addrType = addrType;
  obj.index = index;
  return register(obj);
}

/**
 * 
 * @param target
 * @returns
 */
function createLink(target) {

  assertDefined(target);

  var obj = Object.create(typeProto);

  obj.type = LINK_TYPE;
  obj.count = 0;
  obj.referrer = [];

  obj.target = 0;

  var id = register(obj);
  set(target, id, 'target');
  return id;
}

/**
 * 
 * Vector are red bank internal type
 * 
 * Vector stores an array of object id. Fixed size.
 * 
 * @param size
 * @param tag
 * @returns {Number}
 */
function createVector(size, tag) {

  if (typeof size !== 'number' || size <= 0) {
    throw "error";
  }

  var obj = Object.create(typeProto);

  obj.type = VECTOR_TYPE;
  obj.count = 0;
  obj.referrer = [];
  obj.tag = tag;

  obj.size = size;
  obj.elem = [];

  for (var i = 0; i < size; i++) {
    obj.elem[i] = 0;
  }

  return register(obj);
}

function createTrap(catchLabel, finalLabel, stackLength) {

  var obj = Object.create(typeProto);

  obj.type = TRAP_TYPE;
  obj.count = 0;
  obj.referrer = [];

  obj.catchLabel = catchLabel;
  obj.finalLabel = finalLabel;
  obj.stackLength = stackLength;

  obj.param = 0; // referencing field

  return register(obj);
}

// TODO
propertyProto.isDataProperty = function() {
  return (this.VALUE !== 0) ? true : false;
};

// TODO
propertyProto.isAccessorProperty = function() {
  return (this.GET !== 0 || this.SET) ? true : false;
};

/**
 * Create an property object (but not set to object)
 * 
 * @param O
 *          Object (id)
 * @param P
 *          Property Name String (id)
 * @param V
 *          Value object (id)
 * @param G
 *          Getter object (func id)
 * @param S
 *          Setter object (func id)
 * @param W
 *          Writable, host boolean
 * @param E
 *          Enumerable, host boolean
 * @param C
 *          Configurable, host boolean
 * @returns
 */
function createProperty(O, P, V, G, S, W, E, C) {

  assert(defined(O) && typeOfObject(O) === OBJECT_TYPE);
  assert(defined(P) && typeOfObject(P) === STRING_TYPE);
  assert(defined(V));
  assert(defined(G));
  assert(defined(S));
  assert(G === 0 || classOfObject(G) === FUNCTION_CLASS);
  assert(S === 0 || classOfObject(S) === FUNCTION_CLASS);
  assert(typeof W === 'boolean');
  assert(typeof E === 'boolean');
  assert(typeof C === 'boolean');

  if (V === 0 && G === 0 && S === 0) {
    throw "error";
  }

  if (V !== 0 && (G !== 0 || S !== 0)) {
    throw "error";
  }

  var obj = Object.create(propertyProto);

  obj.type = PROPERTY_TYPE;
  obj.count = 0;
  obj.referrer = [];

  obj.WRITABLE = (W === true) ? true : false;
  obj.ENUMERABLE = (E === true) ? true : false;
  obj.CONFIGURABLE = (C === true) ? true : false;

  obj.VALUE = 0; // ecma, ref
  obj.GET = 0; // ecma, ref
  obj.SET = 0; // ecma, ref

  obj.name = 0; // redbank internal, ref
  obj.nextInObject = 0; // redbank internal, ref
  obj.nextInSlot = 0; // redbank internal, ref

  obj.object = O; // redbank internal, non-ref

  var id = register(obj);

  if (V !== 0) {
    set(V, id, 'VALUE');
  }
  if (G !== 0) {
    set(G, id, 'GET');
  }
  if (S !== 0) {
    set(S, id, 'SET');
  }
  set(P, id, 'name');

  return id;
}

/**
 * Search property with 'name' in 'object
 * 
 * @param object
 * @param name
 * @returns property id or 0 (not found)
 */
function searchProperty(object, name) {

  if (typeof object !== 'number' || typeof name !== 'number') {
    throw "Not an object id";
  }

  var obj = getObject(object);
  for (var prop = obj.property; prop !== 0; prop = getObject(prop).nextInObject) {
    if (getObject(prop).name === name) {
      return prop;
    }
  }
  return 0;
}

function deepSearchProperty(object, name) {

  for (var x = object; x !== 0; x = getObject(x).PROTOTYPE) {
    var prop = searchProperty(x, name);
    if (prop !== 0) {
      return prop;
    }
  }
}

function getProperty(parent, name) {

  var prop = deepSearchProperty(parent, name);
  if (prop === 0) {
    return JS_UNDEFINED;
  }
  var id = getObject(prop).VALUE;
  return (id === 0) ? JS_UNDEFINED : id;
}

function setProperty(V, O, name, w, e, c) {

  var obj;

  // for debug
  if (typeof O !== 'number' || typeof V !== 'number') {
    throw "Convert object to object id for setProperty";
  }

  obj = getObject(O);

  /**
   * any string is valid for js property name, including undefined, null, and
   * numbers number property name can NOT be used with dot notation, but bracket
   * notation is OK. other strings are OK for both dot and bracket notation.
   */
  // name = name.toString();
  if (obj.isPrimitive()) {
    return;
  }

  var prop = searchProperty(O, name);

  if (prop === 0) {
    var id = createProperty(O, name, V, 0, 0, w, e, c);

    set(getObject(O).property, id, 'nextInObject');
    set(id, O, 'property');
    hashProperty(id);
  }
  else if (getObject(prop).WRITABLE === false) {
    return;
  }
  else {
    set(V, prop, 'VALUE');
  }
}

function deleteProperty(property) {

  unhashProperty(property);

  var propObj = getObject(property);
  var parent = propObj.object;
  var name = propObj.name;
  var value = propObj.VALUE;

  if (propObj.property === property) {
    set(value, parent, 'property');
    return;
  }

  for (var x = propObj.property;; x = getObject(x).nextInObject) {

    var next = getObject(x).nextInObject;
    if (next === property) {
      var nextnext = getObject(next).nextInObject;
      set(nextnext, x, 'nextInObject');
      return;
    }

    if (next === 0) {
      throw "Error, property not found";
    }
  }
}

function setPropertyByLiteral(value, parent, nameLiteral, w, e, c) {

  var type = typeOfObject(parent);
  if (type !== 'object' && type !== 'function') {
    throw "error";
  }

  var name = createString(nameLiteral);
  setProperty(value, parent, name, w, e, c);
}

/*******************************************************************************
 * 
 * Abstract methods for JS Object
 * 
 * These methods are the core logic of Javascript Object Model
 * 
 ******************************************************************************/

/**
 * 8.12.1 [[GetOwnProperty]] (P)
 * 
 * P is string value (id)
 * 
 * This function returns undefined or a fully populated PropertyDescriptor,
 * which is an host object.
 */
objectProto.GET_OWN_PROPERTY = function(P) {

  assert(typeOfObject(P) === STRING_TYPE);

  for (var prop = this.property; prop !== 0; prop = getObject(prop).nextInObject) {
    if (getObject(prop).name === P) {
      break;
    }
  }

  if (prop === 0) {
    return undefined;
  }

  var D = newPropertyDescriptor();

  var X = getObject(prop);
  if (X.isDataProperty()) {
    D.VALUE = X.VALUE;
    D.WRITABLE = X.WRITABLE;
  }
  else if (X.isAccessorProperty()) {
    D.GET = X.GET;
    D.SET = X.SET;
  }
  else {
    throw "error";
  }

  D.ENUMERABLE = X.ENUMERABLE;
  D.CONFIGURABLE = X.CONFIGURABLE;
  return D; // fully populated
};

/**
 * 8.12.2 [[GetProperty]] (P)
 * 
 * This function recursively find property with given name along prototype
 * chain.
 */
objectProto.GET_PROPERTY = function(P) {

  var prop = this.GET_OWN_PROPERTY(P);
  if (prop !== undefined) {
    return prop;
  }

  var proto = this.PROTOTYPE;
  if (proto === JS_NULL) { // PROTOTYPE chains use JS_NULL for nullability, not
    // undefined
    return undefined;
  }
  return getObject(proto).GET_PROPERTY(P);
};

/**
 * 8.12.3 [[Get]] (P)
 * 
 * return JS_UNDEFINED or object id.
 */
objectProto.GET = function(P) {

  var desc = this.GET_PROPERTY(P);
  if (desc === undefined) {
    return JS_UNDEFINED;
  }

  if (desc.IsDataDescriptor()) {
    return desc.VALUE;
  }
  assert(desc.IsAccessorDescriptor());

  if (desc.GET === 0) {
    return JS_UNDEFINED;
  }
  return getObject(desc.GET).CALL(this.id); // CALL will pop value on stack TODO
};

/**
 * 8.12.4 [[CanPut]] (P)
 * 
 * This function returns true of false, which is the value in host space.
 */
objectProto.CAN_PUT = function(P) {

  var desc = this.GET_OWN_PROPERTY(P);

  /**
   * for own property
   */
  if (desc !== undefined) {
    if (desc.IsAccessorDescriptor()) {
      // no setter, no put
      return (desc.SET === 0) ? false : true;
    }
    else { // must be data property descriptor
      return desc.WRITABLE;
    }
  }

  /**
   * for inherited property
   */
  var proto = this.PROTOTYPE;
  if (proto === JS_NULL) {
    // for Object.prototype, extensible rules.
    return this.EXTENSIBLE;
  }

  var inherited = getObject(proto).GET_PROPERTY(P);
  if (inherited === undefined) {
    // if not defined in any ancestor, extensible rules.
    return this.EXTENSIBLE;
  }

  if (inherited.IsAccessorDescriptor()) {
    // if inherited no setter, no put
    return (inherited.SET === 0) ? false : true;
  }

  assert(isDataDescriptor(inherited));

  if (this.EXTENSIBLE === false) {
    // if this is not extensible (read only), no way
    return false;
  }

  // if ancestor's property read-only
  return inherited.WRITABLE;
};

/**
 * 8.12.5 [[Put]] ( P, V, Throw )
 * 
 * P - property name string (object id) V - value (object id) Throw - true or
 * false, host value space
 */
objectProto.PUT = function(P, V, Throw) {

  assert(defined(P) && typeOfObject(P) === STRING_TYPE);

  assert(typeof Throw === 'boolean');

  if (this.CAN_PUT(P) === false) {
    if (Throw) {
      return ERR_TYPE_ERROR;
    }
    return;
  }

  var ownDesc = this.GET_OWN_PROPERTY(P);
  if (isDataDescriptor(ownDesc) === true) {
    var valueDesc = newPropertyDescriptor();
    valueDesc.VALUE = V;

    this.DEFINE_OWN_PROPERTY(P, valueDesc, Throw);
    return;
  }

  var desc = this.GET_PROPERTY(P);
  if (isAccessorDescriptor(desc) === true) {
    var setter = desc.SET; // this is an ID!
    getObject(setter).CALL(this.id, V);
  }
  else {
    var newDesc = newPropertyDescriptor();
    newDesc.VALUE = V;
    newDesc.WRITABLE = true;
    newDesc.ENUMERABLE = true;
    newDesc.CONFIGURABLE = true;

    this.DEFINE_OWN_PROPERTY(P, newDesc, Throw);
  }
};

/**
 * 8.12.6 [[HasProperty]] (P)
 */
objectProto.HAS_PROPERTY = function(P) {

  var desc = this.GET_PROPERTY(P);
  if (desc === undefined) {
    return false;
  }

  return true;
};

/**
 * 8.12.7 [[Delete]] (P, Throw)
 */
objectProto.DELETE = function(P, Throw) {

  var desc = this.GET_OWN_PROPERTY(P);

  if (desc === undefined) {
    return true;
  }

  if (desc.CONFIGURABLE === true) {
    // remove TODO
    return true;
  }

  if (Throw) {
    return ERR_TYPE_ERROR;
  }

  return false;
};

/**
 * 8.12.8 [[DefaultValue]] (hint)
 */
objectProto.DEFAULT_VALUE = function(hint) {

  var P, E;
  if (hint === STRING_TYPE) {

    // 1. Let toString be the result of calling the [[Get]] internal method of
    // object O with argument "toString".
    // 2. If IsCallable(toString) is true then,
    // a. Let str be the result of calling the [[Call]] internal method of
    // toString, with O as the this value and an empty argument list.
    // b. If str is a primitive value, return str.
    // 3. Let valueOf be the result of calling the [[Get]] internal method of
    // object O with argument "valueOf".
    // 4. If IsCallable(valueOf) is true then,
    // a. Let val be the result of calling the [[Call]] internal method of
    // valueOf,
    // with O as the this value and an empty argument list.
    // b. If val is a primitive value, return val.
    // 5. Throw a TypeError exception.

    P = internFindConstantString("toString");
    E = this.GET(P); // -- toString
    if (E < 0) {
      return E;
    }

    if (isCallable(MACHINE.TOS()) === true) {
      E = getObject(MACHINE.TOS()).CALL(this); // toString -- str
      if (E < 0) {
        return E;
      }
      if (getObject(MACHINE.TOS()).IsPrimitive()) {
        return ERR_NONE;
      }

      MACHINE.pop(); // str --
    }

    P = internFindConstantString("valueOf");
    E = this.GET(P); // -- valueOf
    if (E < 0) {
      return E;
    }

    if (isCallable(MACHINE.TOS()) === true) {
      E = getObject(MACHINE.TOS()).CALL(this);
      if (E < 0) {
        return E;
      }

      if (getObject(MACHINE.TOS()).IsPrimitive()) {
        return ERR_NONE; // val
      }

      MACHINE.pop(); // 
    }

    return ERR_TYPE_ERROR;
  }

  // TODO prefered number
};

/**
 * 8.12.9 [[DefineOwnProperty]] (P, Desc, Throw)
 * 
 * In the following algorithm, the term “Reject” means “If Throw is true, then
 * throw a TypeError exception, otherwise return false”.
 * 
 * This function can throw errors. So the return value is contracted as:
 * 
 * Returns true, false or error
 */
objectProto.DEFINE_OWN_PROPERTY = function(P, Desc, Throw) {

  assert(typeof Throw === 'boolean');

  var current = this.GET_OWN_PROPERTY(P);
  var extensible = this.EXTENSIBLE;
  var prop;

  // no owned property with given name and the object is NOT extensible
  if (current === undefined && extensible === false) {
    if (Throw) {
      return ERR_TYPE_ERROR;
    }
    return false;
  }

  /**
   * 4. If current is undefined and extensible is true, then
   */
  // no given named property but the object is extensible
  if (current === undefined && extensible === true) {
    /**
     * a. If IsGenericDescriptor(Desc) or IsDataDescriptor(Desc) is true, then
     */
    if (isGenericDescriptor(Desc) || isDataDescriptor(Desc)) {
      /**
       * i. Create an own data property named P of object O whose [[Value]],
       * [[Writable]], [[Enumerable]] and [[Configurable]] attribute values are
       * described by Desc. If the value of an attribute field of Desc is
       * absent, the attribute of the newly created property is set to its
       * default value.
       */
      // TODO assert
      prop = createProperty(this.id, P, Desc.VALUE, Desc.GET, Desc.SET,
          Desc.WRITABLE, Desc.ENUMERABLE, Desc.CONFIGURABLE);

      // install
      set(this.property, prop, 'nextInObject');
      set(prop, this.id, 'property');
      hashProperty(prop);
    }
    /**
     * b. Else, Desc must be an accessor Property Descriptor so,
     */
    else {
      /**
       * i. Create an own accessor property named P of object O whose [[Get]],
       * [[Set]], [[Enumerable]] and [[Configurable]] attribute values are
       * described by Desc. If the value of an attribute field of Desc is
       * absent, the attribute of the newly created property is set to its
       * default value.
       */
      assert(Desc.isAccessorDescriptor());
      // TODO assert
      createProperty(this.id, P, Desc.VALUE, Desc.GET, Desc.SET, Desc.WRITABLE,
          Desc.ENUMERABLE, Desc.CONFIGURABLE);

      // install
      set(this.property, prop, 'nextInObject');
      set(prop, this.id, 'property');
      hashProperty(prop);
    }
    /**
     * C. Return true.
     */
    return true;
  }

  // Now, the owned property with given name exists.
  /**
   * 5. Return true, if every field in Desc is absent.
   */
  if (Desc.GET === JS_UNDEFINED && Desc.SET === JS_UNDEFINED
      && Desc.VALUE === JS_UNDEFINED && Desc.WRITABLE === undefined
      && Desc.ENUMERABLE === undefined && Desc.CONFIGURABLE === undefined) {
    return true;
  }

  /**
   * 6. Return true, if every field in Desc also occurs in current and the value
   * of every field in Desc is the same value as the corresponding field in
   * current when compared using the SameValue algorithm (9.12).
   */
  // is this simple implementation OK? TODO
  if (current.VALUE === Desc.VALUE && current.GET === Desc.GET
      && current.SET === Desc.SET && current.WRITABLE === Desc.WRITABLE
      && current.ENUMERABLE === Desc.ENUMERABLE
      && current.CONFIGURABLE === Desc.CONFIGURABLE) {
    return true;
  }

  /**
   * 7. If the [[Configurable]] field of current is false then
   */
  if (current.CONFIGURABLE === false) {
    /**
     * a. Reject, if the [[Configurable]] field of Desc is true.
     */
    if (Desc.CONFIGURABLE === true) {
      if (Throw) {
        return ERR_TYPE_ERROR;
      }
      return false;
    }
    /**
     * b. Reject, if the [[Enumerable]] field of Desc is present and the
     * [[Enumerable]] fields of current and Desc are the Boolean negation of
     * each other.
     */
    if (Desc.ENUMERABLE !== undefined && Desc.ENUMERABLE !== current.ENUMERABLE) {
      if (Throw) {
        return ERR_TYPE_ERROR;
      }
      return false;
    }
  }

  /**
   * 8. If IsGenericDescriptor(Desc) is true, then no further validation is
   * required.
   */
  if (isGenericDescriptor(Desc)) {

  }
  /**
   * 9. Else, if IsDataDescriptor(current) and IsDataDescriptor(Desc) have
   * different results, then
   */
  else if (isDataDescriptor(current) !== isDataDescriptor(Desc)) {
    /**
     * a. Reject, if the [[Configurable]] field of current is false.
     */
    if (current.CONFIGURABLE === false) {
      if (Throw) {
        return ERR_TYPE_ERROR;
      }
      return false;
    }
    /**
     * b. If IsDataDescriptor(current) is true, then
     */
    if (isDataDescriptor(current) === true) {
      /**
       * i. Convert the property named P of object O from a data property to an
       * accessor property. Preserve the existing values of the converted
       * property’s [[Configurable]] and [[Enumerable]] attributes and set the
       * rest of the property’s attributes to their default values.
       */
      // TODO Convert data property to accessor property !!!
    }

    /**
     * c. Else,
     */
    else {
      /**
       * Convert the property named P of object O from an accessor property to a
       * data property. Preserve the existing values of the converted property’s
       * [[Configurable]] and [[Enumerable]] attributes and set the rest of the
       * property’s attributes to their default values.
       */
      // TODO Convert accessor property to data property !!!
    }
  }
  /**
   * 10. Else, if IsDataDescriptor(current) and IsDataDescriptor(Desc) are both
   * true, then
   */
  else if (isDataDescriptor(current) === true
      && isDataDescriptor(Desc) === true) {
    /**
     * a. If the [[Configurable]] field of current is false, then
     */
    if (current.CONFIGURABLE === false) {
      /**
       * i. Reject, if the [[Writable]] field of current is false and the
       * [[Writable]] field of Desc is true.
       */
      if (current.WRITABLE === false && Desc.WRITABLE === true) {
        return (Throw) ? ERR_TYPE_ERROR : false;
      }
      /**
       * ii. If the [[Writable]] field of current is false, then
       */
      if (current.WRITABLE === false) {
        /**
         * 1. Reject, if the [[Value]] field of Desc is present and
         * SameValue(Desc.[[Value]], current.[[Value]]) is false.
         */
        // TODO SAME VALUE!
        if (Desc.VALUE !== undefined) {
          return (Throw) ? ERR_TYPE_ERROR : false;
        }
      }
    }
    /**
     * b. else, the [[Configurable]] field of current is true, so any change is
     * acceptable.
     */
    // this seems to be a pure comment.
  }
  /**
   * 11. Else, IsAccessorDescriptor(current) and IsAccessorDescriptor(Desc) are
   * both true so,
   */
  else if (current.IsAccessorDescriptor() === true
      && Desc.IsAccessorDescriptor() === true) {
    /**
     * a. If the [[Configurable]] field of current is false, then
     */
    if (current.CONFIGURABLE === false) {
      /**
       * i. Reject, if the [[Set]] field of Desc is present and
       * SameValue(Desc.[[Set]], current.[[Set]]) is false.
       */
      if (Desc.SET && Desc.SET !== current.SET) {
        return (Throw) ? ERR_TYPE_ERROR : false;
      }

      /**
       * ii. Reject, if the [[Get]] field of Desc is present and
       * SameValue(Desc.[[Get]], current.[[Get]]) is false.
       */
      if (Desc.GET && Desc.GET !== current.GET) {
        return (Throw) ? ERR_TYPE_ERROR : false;
      }
    }
  }

  /**
   * 12. For each attribute field of Desc that is present, set the
   * correspondingly named attribute of the property named P of object O to the
   * value of the field.
   */

  /**
   * 13. Return true
   */
  return true;
};

functionProto.CONSTRUCT = function() {

};

/**
 * 
 */
functionProto.CALL = function(__VA_ARGS__) {

  // at least, thisArg should be provided
  assert(arguments.length > 0);

  if (this.nativeFunc !== undefined) {
    var thisArg = arguments[0];
    // use splice to get all the arguments after thisArg;
    var args = Array.prototype.splice.call(arguments, 1);
    return this.nativeFunc.apply(thisArg, args);
  }

  /**
   * caller
   */
  // put function object on stack
  MACHINE.push(this.id);
  // put 'this' on stack
  MACHINE.push(arguments[0]);
  // put arguments
  for (var i = 1; i < arguments.length; i++) {
    MACHINE.push(arguments[i]);
  }
  // put argc on stack
  MACHINE.push(createNumber(arguments.length - 1));

  /**
   * callee is responsible for cleaning up stacks
   */
  return MACHINE.doCall();

  /**
   * after the call, the return value is left on stack
   */
  // var obj = getObject(MACHINE.TOS());
  // MACHINE.pop();
  // return obj;
};

functionProto.HAS_INSTANCE = function() {

};

/*******************************************************************************
 * 
 * Chapter 9
 * 
 ******************************************************************************/
var CH_09_01;

// input -- primitive
function ToPrimitive(preferredType) {

  var input = MACHINE.TOS();
  var obj = getObject(input);

  assert(obj.isEcmaLangType());

  if (obj.isPrimitive()) {
    return ERR_NONE;
  }

  return obj.DEFAULT_VALUE(preferredType);
}

var CH_09_02;

function ToBoolean() {

  var input = MACHINE.TOS();
  var obj = getObject(input);

  assert(obj.isEcmaLangType());

  if (input === JS_UNDEFINED || input === JS_NULL) {
    set(JS_FALSE, MAIN_STACK, MACHINE.indexOfTOS());
  }
  else if (typeOfObject(input) === NUMBER_TYPE) {
    if (input === JS_POSITIVE_ZERO || input === JS_NEGATIVE_ZERO
        || input === JS_NAN) {
      set(JS_FALSE, MAIN_STACK, MACHINE.indexOfTOS());
    }
    set(JS_TRUE, MAIN_STACK, MACHINE.indexOfTOS());
  }
  else if (typeOfObject(input) === STRING_TYPE) {
    set(JS_TRUE, MAIN_STACK, MACHINE.indexOfTOS());
    // TODO empty string return false
  }
  else if (typeOfObject(input) === OBJECT_TYPE) {
    set(JS_TRUE, MAIN_STACK, MACHINE.indexOfTOS());
  }
}

var CH_09_03;

function ToNumber() {

}

var CH_09_04;

function ToInteger() {

}

var CH_09_08;

/**
 * 9.8 ToString()
 * 
 * This is a stack function.
 */
function ToString() {
  
  var id = MACHINE.TOS();
  var obj = getObject(id);
  var type = typeOfObject(id);
  var str;
  
  if (type === UNDEFINED_TYPE) {
    str = internFindConstantString("undefined");
    
  }
}

var CH_09_09;

/**
 * 9.9 ToObject
 * 
 * This is a stack function. It replaces the TOS with result.
 * 
 */
function ToObject() {
  
  var type = typeOfObject(MACHINE.TOS());
  if (type === UNDEFINED_TYPE || type === NULL_TYPE) {
    return ERR_TYPE_ERROR;
  }
  
  if (type === BOOLEAN_TYPE) {
    // TODO
  }
  else if (type === NUMBER_TYPE) {
    // TODO
  }
  else if (type === STRING_TYPE) {
    // TODO
  }
  else { // must be object type
    // do nothing
  }
  return ERR_NONE;
}

var CH_09_10;

/**
 * 9.10 CheckObjectCoercible
 * 
 * This function test if given object coercible. Since this function does NOT 
 * create anything, it is not necessarily to be a stack function.
 */
function CheckObjectCoercible(id) {

  var obj = getObject(id);
  assert(obj.isEcmaLangType() === true);

  if (typeOfObject(id) === UNDEFINED_TYPE || typeOfObject(id) === NULL_TYPE) {
    return ERR_TYPE_ERROR;
  }

  return ERR_NONE;
}

var CH_09_11;

/**
 * This function test if given ecma lang type is callable
 * @param id
 * @returns host value true or false
 */
function IsCallable(id) {

  var obj = getObject(id);
  assert(obj.isEcmaLangType() === true);

  // TODO verify
  return (obj.isObject() && obj.CALL !== undefined) ? true : false;
}

var CH_09_12;

/**
 * 9.12 The SameValue Algorithm
 * @param x
 * @param y
 */
function SameValue(x, y) {
  
  assert(getObject(x).isEcmaLangType());
  assert(getObject(y).isEcmaLangType());
  
  var typeX = typeOfObject(x);
  var typeY = typeOfObject(y);
  
  if (typeX !== typeY) {
    return false;
  }
  
  if (typeX === UNDEFINED_TYPE || typeX === NULL_TYPE) {
    return true;
  }
  
  if (typeX === NUMBER_TYPE) {
    // TODO may be problematic
    if (x === JS_NAN && y === JS_NAN) {
      return true;
    }
    
    if (x === JS_POSITIVE_ZERO && y === JS_NEGATIVE_ZERO) {
      return false;
    }
    
    if (x === JS_NEGATIVE_ZERO && y === JS_POSITIVE_ZERO) {
      return false;
    }
    
    if (getObject(x).value === getObject(y).value) {
      return true;
    }
    
    return false;
  }
  
  if (typeX === STRING_TYPE) {
    // TODO
    return (getObject(x).value === getObject(y).value);
  }
  
  if (typeX === BOOLEAN_TYPE) {
    return (x === y);
  }
  
  return (x === y);
}

function createObject(proto) {

  if (typeof proto === 'number') {
    throw "Use some prototype object as parameter";
  }

  var obj = Object.create(proto);

  obj.type = OBJECT_TYPE;
  obj.count = 0;
  obj.referrer = [];
  obj.property = 0; // referencing
  obj.PROTOTYPE = 0; // referencing

  var id = register(obj);

  return id;
}

function createObjectObject(PROTO, extensible, tag) {

  if (typeof PROTO !== 'number' || typeof extensible !== 'boolean') {
    throw "error";
  }

  if (PROTO !== JS_NULL && typeOfObject(PROTO) !== OBJECT_TYPE) {
    throw "error";
  }

  var id = createObject(objectProto);
  var obj = getObject(id);
  obj.CLASS = OBJECT_CLASS;
  obj.EXTENSIBLE = extensible;
  obj.tag = tag;

  set(PROTO, id, 'PROTOTYPE');

  return id;
}

function createFunctionObject(PROTO, extensible, tag) {

  if (typeof PROTO !== 'number' || PROTO === 0) {
    throw "error";
  }

  var id = createObject(functionProto);
  var obj = getObject(id);
  obj.CLASS = FUNCTION_CLASS;
  obj.EXTENSIBLE = extensible;
  obj.tag = tag;

  set(PROTO, id, 'PROTOTYPE');
  return id;
}

function createArrayObject(PROTO, tag) {

  if (typeof PROTO !== 'number' || PROTO === 0) {
    throw "error";
  }

  var id = createObject(arrayProto);
  var obj = getObject(id);
  obj.CLASS = ARRAY_CLASS;
  obj.tag = tag;

  set(PROTO, id, 'PROTOTYPE');
  return id;
}

/**
 * The native function should be called 'host function'
 * 
 * @param nativeFunc
 * @param extensible
 * @param tag
 * @returns
 */
function createNativeFunction(nativeFunc, extensible, tag) {

  if (FUNCTION_PROTO === 0) {
    throw "FUNCTION_PROTO not initialized.";
  }

  assert(typeof nativeFunc === 'function');
  assert(typeof extensible === 'boolean');
  if (tag !== undefined) {
    assert(typeof tag === 'string');
  }

  // create object
  var func = createFunctionObject(FUNCTION_PROTO, extensible, tag);

  // set native func
  var funcObj = getObject(func);
  funcObj.nativeFunc = nativeFunc;

  // create length property
  var id = createNumber(nativeFunc.length);
  setPropertyByLiteral(id, func, 'length', false, false, false);
  return func;
}

/**
 * 
 * @param label
 * @param lexSize
 * @param length
 * @returns
 */
function createFunction(label, lexSize, length) {

  if (FUNCTION_PROTO === 0) {
    throw "FUNCTION_PROTOtype not initialized.";
  }

  // assume all user created function are extensible
  var id = createFunctionObject(FUNCTION_PROTO, true);
  var obj = getObject(id);

  obj.label = label;
  obj.lexicals = 0; // referencing field

  if (lexSize !== 0) {
    var lex = createVector(lexSize);
    set(lex, id, 'lexicals');
  }

  var len = createNumber(length);
  setPropertyByLiteral(len, id, 'length', true, true, true);

  var prototype = createObjectObject(OBJECT_PROTO, true);
  setPropertyByLiteral(prototype, id, 'prototype', true, true, true);
  return id;
}

function bootstrap() {

  var i, id, obj, wrapper, value;
  var vm = this;

  MAIN_STACK = createVector(STACK_SIZE_LIMIT, "main stack");
  mainStackObj = getObject(MAIN_STACK);
  mainStackLength = 0; // important

  STRING_HASH = createVector(STRING_HASHTABLE_SIZE, "string hash table");
  stringHashObj = getObject(STRING_HASH);

  PROPERTY_HASH = createVector(PROPERTY_HASHTABLE_SIZE, "property hash table");
  propertyHashObj = getObject(PROPERTY_HASH);

  // value constant
  JS_UNDEFINED = 0;

  JS_NULL = 0;
  JS_TRUE = 0;
  JS_FALSE = 0;

  JS_POSITIVE_INFINITY = 0;
  JS_NEGATIVE_INFINITY = 0;
  JS_POSITIVE_ZERO = 0;
  JS_NEGATIVE_ZERO = 0;
  JS_NAN = 0;

  // built-in prototypes
  OBJECT_PROTO = 0;
  FUNCTION_PROTO = 0;
  ARRAY_PROTO = 0;

  JS_GLOBAL = 0;

  // poison
  register({
    type : 'poison'
  });

  /**
   * basic values
   */
  JS_UNDEFINED = createUndefined();
  JS_NULL = createNull();
  JS_TRUE = createBoolean(true, true, "True");
  JS_FALSE = createBoolean(false, true, "False");
  JS_POSITIVE_ZERO = createNumber(+0, true, "Positive Zero");
  JS_NEGATIVE_ZERO = createNumber(-0, true, "Negative Zero");
  JS_POSITIVE_INFINITY = createNumber(Number.POSITIVE_INFINITY, true,
      "Positive Infinity");
  JS_NEGATIVE_INFINITY = createNumber(Number.NEGATIVE_INFINITY, true,
      "Negative Infinity");
  JS_NAN = createNumber(Number.NaN, true, "NaN");

  /**
   * Object.prototype
   * 
   * The value of the [[Prototype]] internal property of the Object prototype
   * object is null, the value of the [[Class]] internal property is "Object",
   * and the initial value of the [[Extensible]] internal property is true.
   */
  OBJECT_PROTO = createObjectObject(JS_NULL, true, "Object.prototype");

  /**
   * Function.prototype
   * 
   * ECMA262:
   * 
   * The Function prototype object is itself a Function object (its [[Class]] is
   * "Function") that, when invoked, accepts any arguments and returns
   * undefined.
   * 
   * The value of the [[Prototype]] internal property of the Function prototype
   * object is the standard built-in Object prototype object (15.2.4). The
   * initial value of the [[Extensible]] internal property of the Function
   * prototype object is true.
   * 
   * The Function prototype object does not have a valueOf property of its own;
   * however, it inherits the valueOf property from the Object prototype Object.
   * 
   * The length property of the Function prototype object is 0.
   * 
   * Properties to be implemented:
   * 
   * apply, arguments, bind, call, caller, constructor, length, name, toString,
   * __proto__, <function scope>
   * 
   * ATTENTION: this object does NOT have 'prototype' property. When invoked
   * with 'new' > new Function.prototype() > TypeError: function Empty() {} is
   * not a constructor
   * 
   */
  id = createFunctionObject(OBJECT_PROTO, true, "Function.prototype");
  setPropertyByLiteral(createNumber(0), id, 'length', false, false, false);
  FUNCTION_PROTO = id;

  /**
   * Object constructor
   * 
   * TODO: Don't know if it works. Probably not.
   */
  wrapper = function() {
    // var newObj;
    //
    // if (this.object === vm.object) { // TODO
    // throw "new is not supported yet";
    // // Called with new.
    // newObj = this;
    // }
    // else {
    // newObj = vm.createObject(vm.object_PROTO);
    // }
    return createObject(OBJECT_PROTO);
  };
  id = createNativeFunction(wrapper, true, "Object Constructor");
  setPropertyByLiteral(OBJECT_PROTO, id, 'prototype', false, false, false);
  OBJECT_CONSTRUCTOR = id;

  /**
   * Function constructor
   */
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
    // newFunc.objectScope =
    // vm.stateStack[vm.stateStack.length - 1].scope;
    // var ast = esprima.parse('$ = function(' + args + ') {' + code + '};');
    // newFunc.node = ast.body[0].expression.right;
    // vm.setProperty(newFunc, 'length',
    // vm.createPrimitive(newFunc.node.length), true);
    return newFunc;
  };
  id = createNativeFunction(wrapper, true, "Function Constructor");
  setPropertyByLiteral(FUNCTION_PROTO, id, 'prototype', false, false, false);
  FUNCTION_CONSTRUCTOR = id;

  /**
   * Array.prototype
   */
  obj = {
    type : 'object',

    count : Infinity,
    referrer : [],

    PROTOTYPE : 0,
    property : 0,
    isPrimitive : false,
    isArray : true,

    tag : "Object.prototype",
  };
  id = register(obj);
  ARRAY_PROTO = id;

  id = createObjectObject(OBJECT_PROTO, true, "Global Object");
  JS_GLOBAL = id;
  getObject(id).count = Infinity;

  setPropertyByLiteral(JS_UNDEFINED, id, 'undefined', false, false, false);
  setPropertyByLiteral(OBJECT_CONSTRUCTOR, id, 'Object', false, false, false);
  setPropertyByLiteral(FUNCTION_CONSTRUCTOR, id, 'Function', false, false,
      false);

};

/*******************************************************************************
 * 
 * Abstract Abstract Abstract Abstract
 * 
 ******************************************************************************/

/**
 * 9.1 ToPrimitve(Input, PreferredType)
 */
function toPrimitive(Input, PreferredType) {

  var type = Input.type;

  if (type === UNDEFINED_TYPE || type === NULL_TYPE || type === BOOLEAN_TYPE
      || type === NUMBER_TYPE || type === STRING_TYPE) {
    return Input;
  }

  assert(type === OBJECT_TYPE);

  return Input.DEFAULT_VALUE(PreferredType);
}

/**
 * 9.2 ToBoolean(Input)
 */
function toBoolean(Input) {

  var type = Input.type;

  if (type === UNDEFINED_TYPE || type === NULL_TYPE) {
    return false;
  }

  if (type === BOOLEAN_TYPE) {
    return;

  }
}

var CH_11_09_03;

/**
 * ecma262 11.9.3
 */
function abstractEqualityComparison(x, y) {

  var typeX = typeOfObject(x);
  var typeY = typeOfObject(y);

  if (typeX === typeY) {

    if (typeX === UNDEFINED_TYPE || typeX === NULL_TYPE) {
      return true;
    }

    if (typeX === NUMBER_TYPE) {
      if (x === JS_NAN || y === JS_NAN) {
        return false;
      }
      if (getObject(x).value === getObject(y).value) {
        return true;
      }
      if (x === JS_POSITIVE_ZERO && y === JS_NEGATIVE_ZERO
          || x === JS_NEGATIVE_ZERO && y === JS_POSITIVE_ZERO) {
        return true;
      }
      return false;
    }

    // 1.d If Type(x) is String, then return true if x and y are exactly the
    // same sequence of characters (same length and same characters in
    // corresponding positions). Otherwise, return false.
    if (typeX === STRING_TYPE) {
      return (getObject(x).value === getObject(y).value) ? true : false;
    }

    // 1.e If Type(x) is Boolean, return true if x and y are both true or both
    // false. Otherwise, return false.
    if (typeX === BOOLEAN_TYPE) {
      return (x === y) ? true : false;
    }

    // 1.f Return true if x and y refer to the same object. Otherwise, return
    // false.
    return (x === y) ? true : false;
  }

  // 2. If x is null and y is undefined, return true.
  // 3. If x is undefined and y is null, return true.
  if ((typeX === UNDEFINED_TYPE && typeY === NULL_TYPE)
      || (typeY === UNDEFINED_TYPE && typeX === NULL_TYPE)) {
    return true;
  }

  // 4. If Type(x) is Number and Type(y) is String, return the result of the
  // comparison x == ToNumber(y).
  if (typeX === NUMBER_TYPE && typeY === STRING_TYPE) {
    // TODO
  }

  // 5. If Type(x) is String and Type(y) is Number, return the result of the
  // comparison ToNumber(x) == y.
  if (typeX === STRING_TYPE && typeY === NUMBER_TYPE) {
    // TODO
  }

  // 6.If Type(x) is Boolean, return the result of the comparison ToNumber(x) ==
  // y.
  if (typeX === BOOLEAN_TYPE) {
    // TODO
  }

  // 7. If Type(y) is Boolean, return the result of the comparison x ==
  // ToNumber(y).
  if (typeY === BOOLEAN_TYPE) {
    // TODO
  }

  // 8. If Type(x) is either String or Number and Type(y) is Object, return the
  // result of the comparison x == ToPrimitive(y).
  if ((typeX === STRING_TYPE || typeX === NUMBER_TYPE) && typeY === OBJECT_TYPE) {
    // TODO
  }

  // 9. If Type(x) is Object and Type(y) is either String or Number, return the
  // result of the comparison ToPrimitive(x) == y.
  if (typeX === OBJECT_TYPE && (typeY === STRING_TYPE || typeY === NUMBER_TYPE)) {

  }

  // 10. return false;

  // TODO not correct yet
  return (getObject(x).value == getObject(y).value) ? true : false;
};

var CH_11_09_06;
/**
 * ecma262, 11.9.6
 */
function strictEqualityComparison(x, y) {

  if (typeOfObject(x) !== typeOfObject(y)) {
    return false;
  }
  if (typeOfObject(x) === 'undefined') {
    return true;
  }
  if (typeOfObject(x) === 'null') {
    return true;
  }

  if (typeOfObject(x) === 'number') {
    if (x === this.NAN || y === this.NAN) {
      return false;
    }
    if (getObject(x).value === getObject(x).value) {
      return true;
    }
    if (getObject(x).value === this.JS_POSITIVE_ZERO
        && getObject(y).value === this.NEGATIVE_ZERO) {
      return true;
    }
    if (getObject(x).value === this.NEGATIVE_ZERO
        && getObject(y).value === this.JS_POSITIVE_ZERO) {
      return true;
    }
    return false;
  }

  if (typeOfObject(x) === 'string') {
    if (getObject(x).isInterned && getObject(y).isInterned) {
      if (x === y) {
        return true;
      }
      return false;
    }
    if (getObject(x).value === getObject(y).value) {
      return true;
    }
    return false;
  }

  if (typeOfObject(x) === 'boolean') {
    return (x === y) ? true : false;
  }
  return (x === y) ? true : false;
}

/**
 * for other parts of vm object, see initBootstrap function.
 */
function RedbankVM() {

  this.PC = 0;
  this.FP = 0;
  this.PCStack = [];
  this.FPStack = [];
  this.ErrorStack = [];
  this.code = {};
  this.testcase = {};
}

/**
 * init built-in (global) objects and global scope
 * 
 * @param mode
 * 
 * zero hash table create poison object create vm object create undefined object
 * create null object create boolean true/false object
 * 
 * create Object.prototype create Function.prototype
 * 
 */
RedbankVM.prototype.init = function(mode) {

  var i, id, obj, wrapper;
  var vm = this;

  // Object.prototype.dummy(), native, for test-only
  wrapper = function() { // This works
    console.log("[[ Object.prototype.dummy() called ]]");
    return JS_UNDEFINED;
  };
  id = createNativeFunction(wrapper, true, "Object.prototype.dummy()");
  setPropertyByLiteral(id, OBJECT_PROTO, 'dummy', false, false, false);

  // Object.prototype.toString(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.toString());
  };
  id = createNativeFunction(wrapper, true, "Object.prototype.toString()");
  setPropertyByLiteral(id, OBJECT_PROTO, 'toString', true, false, true);

  // Object.prototype.valueOf(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.valueOf());
  };
  id = createNativeFunction(wrapper, true, "Object.prototype.valueOf()");
  setPropertyByLiteral(id, OBJECT_PROTO, 'valueOf', true, false, true);
};

RedbankVM.prototype.indexOfARGC = function() {
  var index = this.FP; // point to FP
  index = index - 1; // point to ARGC
  return index;
};

RedbankVM.prototype.indexOfPARAM = function(index) {

};

RedbankVM.prototype.indexOfFUNC = function() {

  var index = this.FP; // point to FP
  index = index - 1; // point to ARGC
  index = index - this.ARGC(); // point to param[0]
  index = index - 1; // point to THIS object
  index = index - 1; // point to FUNC object
  return index;
};

/**
 * Return current frame function object
 * 
 * @returns
 */
RedbankVM.prototype.FUNC = function() {

  var id = mainStackObj.elem[this.indexOfFUNC()];

  assert(typeOfObject(id) === OBJECT_TYPE);
  assert(classOfObject(id) === FUNCTION_CLASS);

  return id;
};

RedbankVM.prototype.FUNC_OBJ = function() {

  return getObject(this.FUNC());
};

/**
 * Get current function's argument count
 * 
 * @returns argument count
 */
RedbankVM.prototype.ARGC = function() {

  var id = mainStackObj.elem[this.FP - 1];
  assertType(id, NUMBER_TYPE);
  return getObject(id).value;
};

/**
 * Top of stack
 * 
 * @returns
 */
RedbankVM.prototype.TOS = function() {
  return mainStackObj.elem[mainStackLength - 1];
};

RedbankVM.prototype.NOS = function() {
  return mainStackObj.elem[this.indexOfNOS()];
};

RedbankVM.prototype.ThirdOS = function() {
  return mainStackObj.elem[mainStackLength - 3];
};

RedbankVM.prototype.indexOfTOS = function() {
  return mainStackLength - 1;
};

RedbankVM.prototype.indexOfNOS = function() {
  return mainStackLength - 2;
};

RedbankVM.prototype.indexOfThirdOS = function() {
  return mainStackLength - 3;
};

RedbankVM.prototype.assertStackLengthEqual = function(len) {
  if (NO_TESTCASE_ASSERTION) {
    return;
  }
  assert(mainStackLength - this.FP === len);
};

RedbankVM.prototype.assertStackSlotUndefined = function(slot) {
  if (NO_TESTCASE_ASSERTION) {
    return;
  }
  assert(mainStackLength - this.FP > slot);
  assert(mainStackObj.elem[this.FP + slot] === JS_UNDEFINED);
};

RedbankVM.prototype.assertStackSlotNumberValue = function(slot, val) {

  var obj = getObject(mainStackObj.elem[this.FP + slot]);
  assert(obj.type === 'number');
  assert(obj.value === val);
};

RedbankVM.prototype.assertStackSlotBooleanValue = function(slot, val) {

  if (val === true) {
    assert(mainStackObj.elem[this.FP + slot] === JS_TRUE);
  }
  else if (val === false) {
    assert(mainStackObj.elem[this.FP + slot] === JS_FALSE);
  }
  else {
    throw "unexpected assert value";
  }
};

RedbankVM.prototype.assertStackSlotObject = function(slot) {

  assert(typeOfObject(mainStackObj.elem[slot]) === 'object');
};

RedbankVM.prototype.assertStackSlotObjectPropertyNumberValue = function(slot,
    nameLit, val) {

  var id = mainStackObj.elem[this.FP + slot];
  assert(typeOfObject(id) === 'object');

  var obj = getObject(id);
  for (var prop = obj.property; prop !== 0; prop = getObject(prop).nextInObject) {
    var propObj = getObject(prop);
    var nameObj = getObject(propObj.name);
    if (nameObj.value === nameLit) {
      assert(typeOfObject(propObj.VALUE) === 'number');
      assert(getObject(propObj.VALUE).value === val);
      return;
    }
  }

  throw "property not found or value mismatch";
};

RedbankVM.prototype.assertStackSlotFunction = function(slot) {

  if (NO_TESTCASE_ASSERTION) {
    return;
  }

  var id = mainStackObj.elem[this.FP + slot];
  assert(typeOfObject(id) === OBJECT_TYPE);
  assert(classOfObject(id) === FUNCTION_CLASS);
};

RedbankVM.prototype.lid2sid = function(lid) {
  return this.FP + lid;
};

RedbankVM.prototype.pid2sid = function(pid) {
  return this.FP - 1 - this.ARGC() + pid;
};

RedbankVM.prototype.push = function(id) {

  assertDefined(id);

  var index = mainStackLength;
  mainStackObj.elem[mainStackLength++] = 0;
  set(id, MAIN_STACK, index);
};

RedbankVM.prototype.esPush = function(id) {

  assertDefined(id);
  var index = this.ErrorStack.length;
  this.ErrorStack.push(0);
  set(id, this.id, 'ErrorStack', index);
};

RedbankVM.prototype.pop = function() {

  set(0, MAIN_STACK, this.indexOfTOS());
  mainStackLength--;
};

RedbankVM.prototype.subst = function(id, index) {
  
  set(id, MAIN_STACK, index);
};

RedbankVM.prototype.substTop = function(id) {
  
  set(id, MAIN_STACK, this.indexOfTOS());
}

RedbankVM.prototype.fetcha = function() {

  assertType(this.TOS(), ADDR_TYPE);

  var addr = this.TOS();
  var addrObj = getObject(addr);
  var index = addrObj.index;
  var linkObj;

  if (addrObj.addrType === ADDR_LOCAL) {
    index = this.lid2sid(index);

    if (typeOfObject(mainStackObj.elem[index]) === 'link') {
      linkObj = getObject(mainStackObj.elem[index]);

      // set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
      set(linkObj.target, MAIN_STACK, this.indexOfTOS());
    }
    else {
      // set(mainStackObj.elem[index], this.id, 'Stack', this.indexOfTOS());
      set(mainStackObj.elem[index], MAIN_STACK, this.indexOfTOS());
    }
  }
  else if (addrObj.addrType === ADDR_PARAM) {
    index = this.pid2sid(index);

    if (typeOfObject(mainStackObj.elem[index]) === 'link') {
      linkObj = getObject(mainStackObj.elem[index]);

      // set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
      set(linkObj.target, MAIN_STACK, this.indexOfTOS());
    }
    else {
      // set(mainStackObj.elem[index], this.id, 'Stack', this.indexOfTOS());
      set(mainStackObj.elem[index], MAIN_STACK, this.indexOfTOS());
    }
  }
  else if (addrObj.addrType === ADDR_LEXICAL) {

    assert(this.FP !== 0);

    // get object
    var funcObj = this.FUNC_OBJ();
    var lex = funcObj.lexicals;
    var lexObj = getObject(lex);

    assert(lex > 0);
    assert(lexObj.size > index);

    // retrieve link
    var link = lexObj.elem[index];

    // assert link
    assert(typeOfObject(link) === LINK_TYPE);

    linkObj = getObject(link);
    set(linkObj.target, MAIN_STACK, this.indexOfTOS());
  }
  else if (addrObj.addrType === ADDR_PROPERTY) { // propAddr -- obj

    var id = this.getProperty(); // TODO
    set(id, this.id, 'Stack', this.indexOfTOS());
  }
  else if (addrObj.addrType === ADDR_CATCH) {

    var eid = this.ErrorStack[this.ErrorStack.length - 1 - index];
    var pid = getObject(eid).param;
    set(pid, this.id, 'Stack', this.indexOfTOS());
  }
  else {
    throw "Unknown address type";
  }
};

/**
 * parent, prop -- value
 */
RedbankVM.prototype.fetcho = function() {

  assertType(this.TOS(), STRING_TYPE);
  assertEcmaLangObject(this.NOS());

  var id = getProperty(this.NOS(), this.TOS());
  set(id, MAIN_STACK, this.indexOfNOS());
  this.pop();
};

/**
 * parent, propertyName -- parent, value
 */
RedbankVM.prototype.fetchof = function() {

  assertType(this.TOS(), STRING_TYPE);
  assertEcmaLangObject(this.NOS());

  var func = getProperty(this.NOS(), this.TOS());

  // remove string
  this.pop();
  // dup
  this.push(this.TOS());
  // set to NOS
  set(func, MAIN_STACK, this.indexOfNOS());
};

/**
 * Store or Assign
 * 
 * In store mode:
 * 
 * FORTH: addr, N1 -- (! the sequence is different from that of FORTH)
 * 
 * In assign mode:
 * 
 * FORTH: addr, N1 -- N1
 */
RedbankVM.prototype.storeOrAssignToAddress = function(mode) {

  assertEcmaLangType(this.TOS());
  assertType(this.NOS(), ADDR_TYPE);

  var id = this.TOS();
  var addr = this.NOS();
  var addrObj = getObject(addr);
  var index = addrObj.index;
  var object;

  if (addrObj.addrType === ADDR_LOCAL || addrObj.addrType === ADDR_PARAM) {

    if (addrObj.addrType === ADDR_LOCAL) {
      index = this.lid2sid(index);
    }
    else {
      index = this.pid2sid(index);
    }

    if (typeOfObject(mainStackObj.elem[index]) === 'link') {
      object = mainStackObj.elem[index];
      set(id, object, 'target');
    }
    else {
      // set(id, this.id, 'Stack', index);
      set(id, MAIN_STACK, index);
    }
  }
  else if (addrObj.addrType === ADDR_LEXICAL) {

    var funcObj = this.FUNC_OBJ();
    var lex = funcObj.lexicals;
    var lexObj = getObject(lex);
    var link = lexObj.elem[index];

    set(id, link, 'target');
  }
  else {
    throw "unsupported address type";
  }

  if (mode === 'store') {
    this.pop();
    this.pop();
  }
  else if (mode === 'assign') {
    // set object in TOS to NOS
    // set(this.TOS(), this.id, 'Stack', this.indexOfNOS());
    set(this.TOS(), MAIN_STACK, this.indexOfNOS());
    this.pop();
  }
  else {
    throw "unsupported mode";
  }
};

RedbankVM.prototype.storeProperty = function() {

  assertEcmaLangType(this.TOS());
  assertType(this.NOS(), STRING_TYPE);
  assertEcmaLangObject(this.ThirdOS());

  // setProperty(this.TOS(), this.ThirdOS(), this.NOS(), true, true, true);
  var O = getObject(this.ThirdOS());
  var P = this.NOS();
  var V = this.TOS();

  O.PUT(P, V, false); // TODO how to determine throw?
};

/**
 * Store or Assign to object/property
 * 
 * 
 * @param mode
 */
RedbankVM.prototype.storeOrAssignToObject = function(mode) {

  this.storeProperty();

  if (mode === 'store') { // O, P, V --
    this.pop();
    this.pop();
    this.pop();
  }
  else if (mode === 'assign') { // O, P, V -- V
    set(this.TOS(), MAIN_STACK, this.indexOfThirdOS());
    this.pop();
    this.pop();
  }
};

RedbankVM.prototype.printstack = function() {

  if (mainStackLength === 0) {
    console.log("STACK Empty");
  }
  else {
    console.log("STACK size: " + mainStackLength);
    for (var i = mainStackLength - 1; i >= 0; i--) {

      var id = mainStackObj.elem[i]; // mainStackObj.elem[i];
      var obj = getObject(id);

      switch (typeOfObject(id)) {
      case 'boolean':
        console.log(i + " : " + id + " (boolean) " + obj.value + " ref: "
            + obj.count);
        break;
      case 'undefined':
        console.log(i + " : " + id + " (undefined) ref: " + obj.count);
        break;
      case 'number':
        console.log(i + " : " + id + " (number) " + obj.value + " ref: "
            + obj.count);
        break;
      case 'string':
        console.log(i + " : " + id + " (string) " + obj.value + " ref: "
            + obj.count);
        break;
      case 'link':
        console.log(i + " : " + id + " (link) ref: " + obj.count + "target: "
            + obj.target);
        break;
      case 'addr':
        console.log(i + " : " + id + " (addr) " + obj.addrType + " "
            + obj.index);
        break;
      case 'object':
        switch (obj.CLASS) {
        case OBJECT_CLASS:
          console.log(i + " : " + id + " (object) ref: " + obj.count);
          break;
        case FUNCTION_CLASS:
          var appendix = (obj.nativeFunc !== undefined) ? "[native] " + obj.tag
              : "non-native";
          console.log(i + " : " + id + " (function) " + appendix);
          break;
        default:
          console.log("unknown object class");
        }

        break;

      default:
        throw "unknown type";
      }

      for (var x = 0; x < this.FPStack.length; x++) {
        if (i === this.FPStack[x] || i === this.FP) {
          console.log("---------------");
          break;
        }
      }
    }
  }
};

RedbankVM.prototype.printLexicals = function() {

  if (this.FP < 2) {
    return;
  }

  var funcObj = this.FUNC_OBJ();

  if (funcObj.nativeFunc !== 'undefined') {
    return;
  }

  if (funcObj.lexnum === 0 || funcObj.lexicals.length === 0) {
    return;
  }

  console.log("  --- lexicals ---  ");

  for (var i = 0; i < funcObj.lexicals.length; i++) {

    var link = funcObj.lexicals[i];
    var linkObj = getObject(link);
    if (linkObj.type !== 'link') {
      throw "non-link object in function's lexicals";
    }

    var targetObj = getObject(linkObj.target);
    console.log(i + " : " + "link : " + link + ", ref: " + linkObj.count
        + ", target: " + linkObj.target + ", ref: " + targetObj.count);
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

  var index, id, link;

  assert(typeOfObject(this.TOS()) === OBJECT_TYPE);
  assert(classOfObject(this.TOS()) === FUNCTION_CLASS);

  var funcObj = getObject(this.TOS());
  var lex = funcObj.lexicals;
  // var lexObj = getObject(lex);

  /*-
   * arg1 is the capture source, local, param, or lexical. 
   * arg2 is the slot from source. 
   * arg3 is the slot to target.
   */
  if (bytecode.arg1 === "argument" || bytecode.arg1 === "local") {
    // capture from stack

    // index is the stack index
    if (bytecode.arg1 === "argument") {
      index = this.pid2sid(bytecode.arg2);
    }
    else {
      index = this.lid2sid(bytecode.arg2);
    }

    // retrieve object to be captured
    id = mainStackObj.elem[index];

    // if already a link
    if (typeOfObject(id) === 'link') {
      // set(id, this.TOS(), 'lexicals', bytecode.arg3);
      set(id, lex, bytecode.arg3);
    }
    else {
      // create a link, this will incr ref to target
      link = createLink(id);
      // TOS() is the function object
      // set(link, this.TOS(), 'lexicals', bytecode.arg3);
      set(link, lex, bytecode.arg3);
      // set(link, this.id, 'Stack', index);
      set(link, MAIN_STACK, index);
    }
  }
  else if (bytecode.arg1 === "lexical") {
    // capture from lex

    var funcFrom = mainStackObj.elem[this.FP - 1];
    var funcFromObj = getObject(funcFrom);
    var lexFrom = funcFromObj.lexicals;

    // link = funcFromObj.lexicals[bytecode.arg2];
    link = lexFrom.elem[bytecode.arg2];
    // set(link, this.TOS(), 'lexicals', bytecode.arg3);
    set(link, lex, bytecode.arg3);
  }
  else {
    throw "unknown capture from region";
  }
};

// assume return value is on top of stack
RedbankVM.prototype.doReturn = function() {

  // overwrite function object with result
  set(this.TOS(), MAIN_STACK, this.indexOfFUNC());

  // pop all temps and locals
  while (mainStackLength > this.FP) {
    this.pop();
  }

  // pop all args, argc, this, but not function (replaced)
  var num = this.ARGC() + 1 + 1 + 1 - 1;
  for (var xyz = 0; xyz < num; xyz++) {
    this.pop();
  }

  // restore fp and pc
  this.PC = this.PCStack.pop();
  this.FP = this.FPStack.pop();
};

/**
 * This function implement the callee part
 */
RedbankVM.prototype.doCall = function() {

  // preserve the PCStack length for detecting call completion
  var preserve = this.PCStack.length;

  // save context
  this.PCStack.push(this.PC);
  this.FPStack.push(this.FP);

  // set new FP
  this.FP = mainStackLength;
  // set new PC
  this.PC = this.FUNC_OBJ().label;

  while (this.PCStack.length !== preserve) {

    var bytecode = this.code[this.PC];

    this.printstack();
    this.printLexicals();

    console.log(Common.Format.hline);
    console.log("PC : " + this.PC + ", FP : " + this.FP);
    console.log("OPCODE: " + bytecode.op + ' '
        + ((bytecode.arg1 === undefined) ? '' : bytecode.arg1) + ' '
        + ((bytecode.arg2 === undefined) ? '' : bytecode.arg2) + ' '
        + ((bytecode.arg3 === undefined) ? '' : bytecode.arg3));

    // like the real
    this.PC++;
    this.step(this.code, bytecode);
  }
};

RedbankVM.prototype.stepCall = function() {

  this.PCStack.push(this.PC);
  this.FPStack.push(this.FP);

  // set new FP
  this.FP = mainStackLength;

  var fid = this.FUNC();
  var fObj = this.FUNC_OBJ();

  if (fObj.nativeFunc === undefined) {
    this.PC = this.FUNC_OBJ().label;
    return;
  }

  // this is js call host
  var result = fObj.nativeFunc();

  this.push(result);
  this.doReturn();
};

RedbankVM.prototype.compare = function(a, b) {

  var aObj = getObject(a);
  var bObj = getObject(b);

  if (a.isPrimitive && typeof a == 'number' && isNaN(a.data) || b.isPrimitive
      && typeof b == 'number' && isNaN(b.data)) {
    return NaN;
  }
  if (a.isPrimitive && b.isPrimitive) {
    a = a.data;
    b = b.data;
  }
  else {
    // TODO: Handle other types.
    return NaN;
  }
  if (a < b) {
    return -1;
  }
  else if (a > b) {
    return 1;
  }
  return 0;
};

RedbankVM.prototype.stepBinop = function(binop) {

  var left = this.NOS();
  var right = this.TOS();
  var leftObj = getObject(left);
  var rightObj = getObject(right);

  var id, val;

  if (binop === '+' || binop === '-' || binop === '*' || binop === '/'
      || binop === '%') {

    if (leftObj.isPrimitive() !== true || rightObj.isPrimitive() !== true) {
      val = this.NAN;
    }
    else {
      if (binop === '+') {
        val = leftObj.value + rightObj.value;
      }
      else if (binop === '-') {
        val = leftObj.value - rightObj.value;
      }
      else if (binop === '*') {
        val = leftObj.value * rightObj.value;
      }
      else if (binop === '/') {
        val = leftObj.value / rightObj.value;
      }
      else if (binop === '%') {
        val = leftObj.value % rightObj.value;
      }
      else {
        throw 'error';
      }

      if (isNaN(val)) {
        id = this.NAN;
      }
      else if (val === Infinity) {
        id = this.INFINITY;
      }
      else {

        if (typeof val === 'number') {
          id = createNumber(val);
        }
        else {
          throw "not supported yet";
        }
        // id = this.createPrimitive(val);
      }

      this.pop();
      this.pop();
      this.push(id);

      return;
    }
  }
  else if (binop === '===') {

    assertEcmaLangType(this.TOS());
    assertEcmaLangType(this.NOS());

    var equality;

    if (typeOfObject(this.TOS()) !== typeOfObject(this.NOS())) {
      equality = false;
    }
    else {
      var type = typeOfObject(this.TOS());
      if (type === 'undefined') {
        equality = true;
      }
      else if (type === 'boolean') {
        equality = (this.TOS() === this.NOS());
      }
      else if (type === 'number') {
        equality = (getObject(this.TOS()).value === getObject(this.NOS()).value);
      }
      else if (type === 'string') { // TODO now all strings are interned
        equality = (this.TOS() === this.NOS());
      }
      else if (type === 'object' || type === "function") {
        equality = (this.TOS() === this.NOS());
      }
      else {
        throw "not supported for equality";
      }
    }

    this.pop();
    this.pop();

    if (equality) {
      this.push(JS_TRUE);
    }
    else {
      this.push(JS_FALSE);
    }
  }
  else {
    throw "not supported yet";
  }
};

RedbankVM.prototype.step = function(code, bytecode) {
  var v, obj;
  var id, index;
  var val;
  var opd1, opd2;

  switch (bytecode.op) {

  case "ARRAY":
    id = this.createObject(this.ARRAY_PROTO);
    this.push(id);
    break;

  case "BINOP":
    this.stepBinop(bytecode.arg1);
    break;

  case "CALL":
    this.stepCall();
    break;

  case "CAPTURE":
    this.stepCapture(bytecode);
    break;

  case "DROP": // obj --
    this.pop();
    break;

  case "FETCHA": // addr -- obj
    this.fetcha();
    break;

  case "FETCHO": // parent, prop -- value
    this.fetcho();
    break;

  case "FETCHOF": // parent, prop -- parent, value
    this.fetchof();
    break;

  case "FUNC": // -- f1
    id = createFunction(bytecode.arg1, bytecode.arg2, bytecode.arg3);
    this.push(id);
    break;

  case "JUMP":
    v = bytecode.arg1;
    v = this.findLabel(this.code, v);
    this.PC = v;
    break;

  case "JUMPC":
    if (this.TOS() === JS_FALSE) {
      this.PC = this.findLabel(this.code, bytecode.arg2);
    }
    else if (this.TOS() !== JS_TRUE) {
      throw "non-boolean value on stack";
    }

    this.pop();
    break;

  case "LABEL":
    // do nothing
    break;

  case "LITA":
    // push an address, may be local, param, or closed
    if (bytecode.arg1 === "LOCAL") {
      this.push(createAddr(ADDR_LOCAL, bytecode.arg2));
    }
    else if (bytecode.arg1 === 'PARAM') {
      this.push(createAddr(ADDR_PARAM, bytecode.arg2));
    }
    else if (bytecode.arg1 === 'LEXICAL') {
      this.push(createAddr(ADDR_LEXICAL, bytecode.arg2));
    }
    else if (bytecode.arg1 === "PROP") {
      this.push(createString(bytecode.arg2));
    }
    else if (bytecode.arg1 === "GLOBAL") {
      this.push(JS_GLOBAL);
      this.push(createString(bytecode.arg2)); // string name
    }
    else if (bytecode.arg1 === "CATCH") {
      this.push(createAddr(ADDR_CATCH, bytecode.arg2));
    }
    else {
      throw "not supported yet";
    }
    break;

  case "LITC":
    // push an constant value
    val = bytecode.arg1;

    if (typeof val === 'number') {
      id = createNumber(val);
    }
    else if (typeof val === 'string') {
      id = createString(val);
    }
    else {
      throw "error";
    }
    this.push(id);
    break;

  case "LITG":
    this.push(JS_GLOBAL);
    break;

  case "LITN":
    // push n UNDEFINED object
    for (var i = 0; i < bytecode.arg1; i++) {
      this.push(JS_UNDEFINED);
    }
    break;

  case "LITO":
    // create an empty object and push to stack
    id = createObjectObject(OBJECT_PROTO, true);
    this.push(id);
    break;

  case 'THROW':

    id = this.ErrorStack[this.ErrorStack.length - 1];
    var errObj = getObject(id);

    // preserve throw argument
    set(this.TOS(), id, 'param');

    // unwinding stack
    while (mainStackLength > errObj.stackLength) {
      this.pop();
    }

    if (errObj.catchLabel !== 0) {
      this.PC = this.findLabel(this.code, errObj.catchLabel);
    }
    else {
      this.PC = this.findLabel(this.code, errObj.finalLabel);
    }
    break;

  case "TRAP":
    id = this.createTrap(bytecode.arg1, bytecode.arg2, mainStackLength);
    this.esPush(id);
    break;

  case "RET":
    var result;
    if (bytecode.arg1 !== "RESULT") {
      this.push(JS_UNDEFINED);
    }

    this.doReturn();
    break;

  case "STORE": // addr n1 --

    if (typeOfObject(this.NOS()) === 'addr') {
      this.storeOrAssignToAddress('store');
    }
    else if (typeOfObject(this.NOS()) === 'string') {
      this.storeOrAssignToObject('store');
    }
    else {
      throw "don't known how to store";
    }
    break;

  case "STOREP": // O, P, V -- O
    this.storeProperty();
    this.pop();
    this.pop();
    break;

  case "TEST":
    if (this.testcase !== undefined) {
      if (!(bytecode.arg1 in this.testcase)) {
        console.log(Common.Format.dotline
            + "WARNING :: testcase does not have function " + bytecode.arg1);
      }
      else if (typeof this.testcase[bytecode.arg1] !== 'function') {
        console.log(Common.Format.dotline + "WARNING :: testcase's property "
            + this.testcase[bytecode.arg1] + " is not a function");
      }
      else {
        console.log(Common.Format.dotline + "[" + this.testcase.group + "] "
            + this.testcase.name);
        this.testcase[bytecode.arg1](this);
        console.log(Common.Format.dotline + "[PASS]");
      }
    }
    else {
      console.log(Common.Format.dotline + "WARNING :: testcase not found");
    }
    break;

  case "THIS":
    id = mainStackObj.elem[this.FP - 2];
    this.push(id);
    break;

  case 'UNTRAP':
    set(0, this.id, 'ErrorStack', this.ErrorStack.length - 1);
    this.ErrorStack.pop();
    break;

  case '=':
    if (typeOfObject(this.NOS()) === 'addr') {
      this.storeOrAssignToAddress('assign');
    }
    else if (typeOfObject(this.NOS()) === 'string') {
      this.storeOrAssignToObject('assign');
    }
    else {
      throw "don't known how to assign";
    }
    break;

  default:
    throw "!!! unknown instruction : " + bytecode.op;
  }
};

RedbankVM.prototype.run = function(input, testcase, initmode) {

  ObjectHeap = [];

  bootstrap();
  this.init(initmode);

  this.code = input;
  this.testcase = testcase;

  console.log(Common.Format.hline);
  console.log("[[ Start Running ]]");
  console.log(Common.Format.hline);

  MACHINE = this;
  var program = createFunction(0, 0, 0);
  var ret = getObject(program).CALL(JS_GLOBAL);

  // this assertion assumes the
  assert(mainStackLength === 1);
  assert(mainStackObj.elem[0] === JS_UNDEFINED);

  this.printstack();
  this.printLexicals();

  console.log(Common.Format.hline);
  console.log("[[ Stop Running ]]");
  console.log(Common.Format.hline);

};

module.exports = RedbankVM;
