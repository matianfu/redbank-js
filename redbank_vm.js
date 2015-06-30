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
 * argc           <- FP - 1  
 * param [argc - 1]
 * ... 
 * param [0]      <- FP - 1 - argc
 * THIS           <- FP - 1 - argc - 1
 * FUNCTION       <- FP - 1 - argc - 1 - 1
 * 
 ******************************************************************************/

var Common = require('./common.js');

var NO_TESTCASE_ASSERTION = true

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

var STRING_HASH = 0;
var stringHashObj;
var PROPERTY_HASH = 0;
var propertyHashObj;

var MAIN_STACK = 0;
var mainStackLength = 0;
var mainStackObj;

var ERROR_STACK = 0;
var errorStackObj;

var MACHINE;

function ecmaIsAccessorDescriptor(desc) {
  if (desc === undefined) {
    return false;
  }
  if (desc.GET === undefined && desc.SET === undefined) {
    return false;
  }
  return true;
}

function ecmaIsDataDescriptor(desc) {
  if (desc === undefined) {
    return false;
  }
  if (desc.VALUE === undefined && desc.WRITABLE === undefined) {
    return false;
  }
  return true;
}

function ecmaIsGenericDescriptor(desc) {
  if (desc === undefined) {
    return false;
  }
  if (false === ecmaIsAccessorDescriptor(desc)
      && false === ecmaIsDataDescriptor(desc)) {
    return true;
  }
  return false;
}

function ecmaFromPropertyDescriptor(desc) {
  if (desc === undefined) {
    return JS_UNDEFINED;
  }

  throw "not implemented yet";
}

function ecmaToPropertyDescriptor(obj) {

  throw "not implemented yet";
}

/**
 * this data type won't be put into ObjectHeap
 */
function PropertyDescriptor() {
  this.type = PROPERTY_DESCRIPTOR_TYPE;
}

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

function classOfObject(id) {
  return getObject(id).CLASS;
}

function assert(expr) {
  if (!(expr)) {
    throw "ASSERT FAIL";
  }
}

function assertValid(id) {
  if (typeof id !== 'number' || id < 0 || id >= ObjectHeap.length) {
    throw "assert fail, id is NOT zero or positive number";
  }
}

function assertDefined(id) {

  assertValid(id);
  if (getObject(id) === undefined) {
    throw "assert fail, undefined object id";
  }
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

var ecma;
var typeProto;
var propertyProto;
var objectProto;
var functionProto;
var arrayProto;

typeProto = {

  isPrimitive : function() {
    if (this.type === UNDEFINED_TYPE || this.type === NULL_TYPE
        || this.type === BOOLEAN_TYPE || this.type === NUMBER_TYPE
        || this.type === STRING_TYPE) {
      return true;
    }
    return false;
  },

  isObject : function() {
    if (this.type === OBJECT_TYPE) {
      return true;
    }
    return false;
  },

  /**
   * is primitve or is object
   */
  isEcmaLangType : function() {
    if (this.isPrimitive() || this.isObject()) {
      return true;
    }
    return false;
  },

  /**
   * all ecma language type and specification type
   */
  isEcmaType : function() {
    if (this.isEcmaLangObject() || this.type === REFERENCE_TYPE
        || this.type === LIST_TYPE || this.type === COMPLETION_TYPE
        || this.type === PROPERTY_DESCRIPTOR_TYPE
        || this.type === PROPERTY_IDENTIFIER_TYPE
        || this.type === LEXICAL_ENVIRONMENT_TYPE
        || this.type === ENVIRONMENT_RECORD_TYPE) {
      return true;
    }
    return false;
  },

  toPrimitive : function() {

    if (!(this.isEcmaType())) {
      throw "error";
    }

  }
};

function ecmaGetValue(V) {

  if (V.isEcmaType() !== true) {
    throw "error";
  }

  if (V.type !== REFERENCE_TYPE) {
    return V;
  }

  var base = V.GetBase();

  if (V.IsUnresolvableReference()) {
    return -1; // THROW
  }

  if (V.IsPropertyReference()) {

  }
}

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

function createUndefined() {

  var obj = Object.create(typeProto);

  obj.type = UNDEFINED_TYPE;
  obj.count = Infinity;
  obj.referrer = [];
  obj.tag = 'undefined';
  return register(obj);
}

function createNull() {

  var obj = Object.create(typeProto);

  obj.type = NULL_TYPE;
  obj.count = Infinity;
  obj.referrer = [];
  obj.tag = 'null';
  return register(obj);
}

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

function internNewString(id) {

  var obj = getObject(id);

  var str = obj.value;

  var hash = HASH(str);
  obj.interned = true;
  obj.hash = hash;

  hash = hash >>> (32 - STRING_HASHBITS); // drop 20 bits, 12 bit left

  // set(StringHash[hash], id, 'nextInSlot');
  set(stringHashObj.elem[hash], id, 'nextInSlot');

  // set(id, this.id, 'StringHash', hash);
  set(id, STRING_HASH, hash);
}

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
  var parent = propObj.parent;
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
  var parent = propObj.parent;
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

propertyProto = Object.create(typeProto);

propertyProto.isDataProperty = function() {
  return (this.VALUE !== 0) ? true : false;
};

propertyProto.isAccessorProperty = function() {
  return (this.GET !== 0 || this.SET) ? true : false;
};

function createProperty(parent, name, value, g, s, w, e, c) {

  assert(parent !== 0 && typeOfObject(parent) === 'object');
  assert(name !== 0 && typeOfObject(name) === 'string');

  if (value === 0 && g === 0 && s === 0) {
    throw "error";
  }

  if (value !== 0 && (g !== 0 || s !== 0)) {
    throw "error";
  }

  var obj = Object.create(propertyProto);

  obj.type = PROPERTY_TYPE;
  obj.count = 0;
  obj.referrer = [];

  obj.WRITABLE = (w === true) ? true : false;
  obj.ENUMERABLE = (e === true) ? true : false;
  obj.CONFIGURABLE = (c === true) ? true : false;

  obj.VALUE = 0; // ecma, ref
  obj.GET = 0; // ecma, ref
  obj.SET = 0; // ecma, ref

  obj.name = 0; // redbank internal, ref
  obj.nextInObject = 0; // redbank internal, ref
  obj.nextInSlot = 0; // redbank internal, ref

  obj.parent = parent; // redbank internal, non-ref

  var id = register(obj);

  if (value !== 0) {
    set(value, id, 'VALUE');
  }
  if (g !== 0) {
    set(g, id, 'GET');
  }
  if (s !== 0) {
    set(s, id, 'SET');
  }
  set(name, id, 'name');

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

function setProperty(value, parent, name, w, e, c) {

  var obj;

  // for debug
  if (typeof parent !== 'number' || typeof value !== 'number') {
    throw "Convert object to object id for setProperty";
  }

  obj = ObjectHeap[parent];

  /**
   * any string is valid for js property name, including undefined, null, and
   * numbers number property name can NOT be used with dot notation, but bracket
   * notation is OK. other strings are OK for both dot and bracket notation.
   */
  // name = name.toString();
  if (obj.isPrimitive()) {
    return;
  }

  var prop = searchProperty(parent, name);

  if (prop === 0) {
    var id = createProperty(parent, name, value, 0, 0, w, e, c);

    set(getObject(parent).property, id, 'nextInObject');
    set(id, parent, 'property');

    hashProperty(id);
  }
  else if (getObject(prop).WRITABLE === false) {
    return;
  }
  else {
    set(value, prop, 'VALUE');
  }
}

function deleteProperty(property) {

  unhashProperty(property);

  var propObj = getObject(property);
  var parent = propObj.parent;
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

function deepSearchProperty(object, name) {

  for (var x = object; x !== 0; x = getObject(x).PROTOTYPE) {

    var prop = searchProperty(x, name);

    if (prop !== undefined) {
      return prop;
    }
  }
}

function getProperty(parent, name) {

  var prop = deepSearchProperty(parent, name);

  if (prop === undefined) {
    return JS_UNDEFINED;
  }
  var id = getObject(prop).VALUE;
  return (id === 0) ? JS_UNDEFINED : id;
}

objectProto = Object.create(typeProto);

/*-
 * 8.12.1 [[GetOwnProperty]] (P)
 */

/**
 * This function returns host-type undefined or PropertyDescriptor
 * 
 * @param propertyName
 */
objectProto.GET_OWN_PROPERTY = function(propertyName) {

  assert(typeOfObject(propertyName) === STRING_TYPE);

  for (var prop = this.property; prop !== 0; prop = getObject(prop).nextInObject) {
    if (getObject(prop).name === propertyName) {
      break;
    }
  }

  if (prop === 0) {
    return undefined;
  }
  var X = getObject(prop);

  var D = new PropertyDescriptor();

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

  return D;
};

/**
 * 
 */
objectProto.GET_PROPTERTY = function(propertyName) {

  var pdesc = this.GET_OWN_PROPERTY(propertyName);
  if (pdesc !== undefined) {
    return pdesc;
  }

  var proto = this.PROTOTYPE;
  if (proto === JS_NULL) {
    return undefined;
  }

  return proto.GET_PROPERTY(propertyName);
};

/**
 * 
 */
objectProto.GET = function(propertyName) {

  var desc = this.GET_PROPERTY();
  if (desc === undefined) {
    return JS_UNDEFINED;
  }

  if (ecmaIsDataDescriptor(desc)) {
    return desc.VALUE;
  }

  assert(ecmaIsAccessorDescriptor());

  if (desc.GET === 0) {
    return 0;
  }

  return getObject(desc.GET).CALL(this);
};

objectProto.PUT = function(propertyName, id, opt) {

};

objectProto.CAN_PUT = function(propertyName) {

};

objectProto.HAS_PROPERTY = function(propertyName) {

};

objectProto.DELETE = function(propertyName, opt) {

};

objectProto.DEFAULT_VALUE = function(hint) {

  if (hint === STRING_TYPE) {
    var toString = this.GET('toString');
    if (toString && getObject(toString).IS_CALLABLE()) {
      var str = getObject(toString).CALL(this);
      if (str.IsPrimitive()) {
        return str;
      }
    }

    var valueOf = this.GET('valueOf');
    if (valueOf && getObject(toString).IS_CALLABLE()) {
      var val = getObject(toString).CALL(this);
      if (str.IsPrimitive()) {
        return val;
      }
    }

    return -1;
  }
};

/**
 * The original definition is (P, Desc, Throw
 */
objectProto.DEFINE_OWN_PROPERTY = function(propertyName, propertyDescriptor,
    thr) {

};

functionProto = Object.create(objectProto);

functionProto.CONSTRUCT = function() {

};

functionProto.CALL = function(__VA_ARGS__) {

  // at least, this should be provided
  assert(arguments.length > 0);

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
   * callee
   * 
   * callee is responsible for cleaning up stacks
   */
  MACHINE.doCall();
  
  /**
   * after the call, the return value is left on stack
   */
  var obj = getObject(MACHINE.TOS());
  MACHINE.pop();
  return obj;
};

functionProto.HAS_INSTANCE = function() {

};

arrayProto = Object.create(typeProto);

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
    // if (this.parent === vm.OBJECT) { // TODO
    // throw "new is not supported yet";
    // // Called with new.
    // newObj = this;
    // }
    // else {
    // newObj = vm.createObject(vm.OBJECT_PROTO);
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
    // newFunc.parentScope =
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
    return 

    

        

    

  }
}

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

RedbankVM.prototype.FUNC = function() {
  var id = mainStackObj.elem[this.FP - 1 - this.ARGC() - 1 - 1];
  
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
 * 
 * @returns argument count
 */
RedbankVM.prototype.ARGC = function() {
  
  var id = mainStackObj.elem[this.FP - 1];
  assertType(id, NUMBER_TYPE);
  return getObject(id).value;

  if (this.FP === 0) {
    throw "main function has no args";
  }

  var id = mainStackObj.elem[this.FP - 3];
  assertType(id, NUMBER_TYPE);
  return getObject(id).value;
};

RedbankVM.prototype.NativeARGC = function() {

  var id = mainStackObj.elem[mainStackLength - 3];
  assertType(id, NUMBER_TYPE);
  return getObject(id).value;
};

RedbankVM.prototype.indexOfRET = function() {

  /**
   * FP -> function object this object argc argx ... arg0
   */

  var index = this.FP - 3; // now point to argc
  index = index - this.ARGC();
  return index; // now point to arg0
};

RedbankVM.prototype.indexOfNativeRET = function() {

  var index = mainStackLength - 3; // now point to argc
  index = index - this.NativeARGC();
  return index; // now point to arg0
};

/**
 * Top of stack
 * 
 * @returns
 */
RedbankVM.prototype.TOS = function() {
  return mainStackObj.elem[mainStackLength - 1];
};

RedbankVM.prototype.indexOfTOS = function() {
  return mainStackLength - 1;
};

/**
 * Next on stack
 * 
 * @returns
 */
RedbankVM.prototype.indexOfNOS = function() {
  return mainStackLength - 2;
};

RedbankVM.prototype.NOS = function() {
  return mainStackObj.elem[this.indexOfNOS()];
};

/**
 * The 3rd on stack
 */
RedbankVM.prototype.ThirdOS = function() {
  return mainStackObj.elem[mainStackLength - 3];
};

RedbankVM.prototype.indexOfThirdOS = function() {
  return mainStackLength - 3;
};

RedbankVM.prototype.assertStackLengthEqual = function(len) {
  if (NO_TESTCASE_ASSERTION) {
    return;
  }
  assert(mainStackLength === len);
};

RedbankVM.prototype.assertStackSlotUndefined = function(slot) {
  if (NO_TESTCASE_ASSERTION) {
    return;
  }
  assert(mainStackLength > slot);
  assert(mainStackObj.elem[slot] === JS_UNDEFINED);
};

RedbankVM.prototype.assertStackSlotNumberValue = function(slot, val) {

  var obj = getObject(mainStackObj.elem[slot]);
  assert(obj.type === 'number');
  assert(obj.value === val);
};

RedbankVM.prototype.assertStackSlotBooleanValue = function(slot, val) {

  if (val === true) {
    assert(mainStackObj.elem[slot] === JS_TRUE);
  }
  else if (val === false) {
    assert(mainStackObj.elem[slot] === JS_FALSE);
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

  var id = mainStackObj.elem[slot];
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

  var id = mainStackObj.elem[slot];

  assert(typeOfObject(id) === OBJECT_TYPE);
  assert(classOfObject(id) === FUNCTION_CLASS);
};

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
 * convert parameter index to (absolute) stack index
 * 
 * @param pid
 *          parameter index (relative to parameter[0], calculated from fp)
 * @returns
 */
RedbankVM.prototype.pid2sid = function(pid) {
  return this.FP - 3 - this.ARGC() + pid;
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

    // get function object id
    var fid = mainStackObj.elem[this.FP - 1];

    // assertFunctionObject(fid);
    assertClass(fid, FUNCTION_CLASS);

    // get object
    var funcObj = getObject(fid);
    var lex = funcObj.lexicals;
    var lexObj = getObject(lex);

    assert(lex > 0);
    assert(lexObj.size > index);

    // assert index not out-of-range
    // assert(funcObj.lexnum > index);

    // retrieve link
    // var link = funcObj.lexicals[index];
    var link = lexObj.elem[index];

    // assert link
    assert(typeOfObject(link) === LINK_TYPE);

    linkObj = getObject(link);

    // set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
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
  // set(id, this.id, 'Stack', this.indexOfNOS());
  set(id, MAIN_STACK, this.indexOfNOS());
  this.pop();
};

/**
 * parent, prop -- parent, value
 */
RedbankVM.prototype.fetchof = function() {

  assertType(this.TOS(), STRING_TYPE);
  assertEcmaLangObject(this.NOS());

  var id = this.getProperty(this.NOS(), this.TOS());
  set(id, this.id, 'Stack', this.indexOfTOS());
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
    // get function object id
    var func = mainStackObj.elem[this.FP - 1];
    var funcObj = getObject(func);
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

/**
 * Store or Assign to object/property
 * 
 * 
 * @param mode
 */
RedbankVM.prototype.storeOrAssignToObject = function(mode) {

  assertEcmaLangType(this.TOS());
  assertType(this.NOS(), STRING_TYPE);
  assertEcmaLangObject(this.ThirdOS());

  setProperty(this.TOS(), this.ThirdOS(), this.NOS(), true, true, true);

  if (mode === 'store') {
    this.pop();
    this.pop();
    this.pop();
  }
  else if (mode === 'assign') {
    // set(this.TOS(), this.id, 'Stack', this.indexOfThirdOS());
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
        console.log(i + " : " + id + " (object) ref: " + obj.count);
        break;
      case 'function':
        var appendix = (obj.nativeFunc !== undefined) ? "[native] " + obj.tag
            : "non-native";
        console.log(i + " : " + id + " (function) " + appendix);
        break;
      default:
        throw "unknown type";
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

RedbankVM.prototype.doCall = function() {

  var preserve = this.PCStack.length;

  this.PCStack.push(this.PC);
  this.FPStack.push(this.FP);

  this.FP = mainStackLength;
  
  var argc = mainStackObj.elem[this.FP - 1];
  var argcObj = getObject(argc);
  var argcVal = argcObj.value;
  
  var func = mainStackObj.elem[this.FP - 1 - argcVal - 1 - 1];
  var funcObj = getObject(func);

  this.PC = funcObj.label;

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

  var fid = this.TOS();
  var fObj = getObject(fid);

  assert(typeOfObject(fid) === OBJECT_TYPE);
  assert(classOfObject(fid) === FUNCTION_CLASS);

  if (fObj.nativeFunc === undefined) {
    this.PCStack.push(this.PC);
    this.FPStack.push(this.FP);
    this.PC = fObj.label;
    this.FP = mainStackLength;
    return;
  }

  /**
   * for native call, there is no corresponding RET
   * 
   * the native function should return an VM defined value the VM is responsible
   * for clearing stack like RET is called.
   */
  var result = fObj.nativeFunc();

  // save argc before being (possibly) overwritten
  var argc = this.NativeARGC();

  // overwrite
  set(result, this.id, "Stack", this.indexOfNativeRET());

  this.pop(); // pop function object
  this.pop(); // pop this object

  // don't pop argc, ret may be popped.
  // this.pop(); // argc
  for (var i = 0; i < argc; i++) {
    this.pop(); // pop params
  }
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
      // this.push(this.createPrimitive(bytecode.arg2));
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
    // id = this.createPrimitive(val);
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

    if (this.FP === 0) { // main()
    // while (mainStackLength) {
    // this.pop();
    // }
    // this.PC = this.code.length; // exit
      this.PC = this.PCStack.pop();
      this.FP = this.FPStack.pop();
    }
    else {

      var result;
      var argc = this.ARGC();

      if (bytecode.arg1 === "RESULT") {
        result = this.TOS();
      }
      else {
        result = JS_UNDEFINED;
      }

      // overwrite
      set(result, MAIN_STACK, this.indexOfRET());

      while (mainStackLength > this.FP) {
        this.pop();
      }

      this.pop(); // pop function object
      this.pop(); // pop this object

      // don't pop argc, ret will be popped.
      for (i = 0; i < argc; i++) {
        this.pop(); // pop params
      }

      // restore fp and pc
      this.PC = this.PCStack.pop();
      this.FP = this.FPStack.pop();
    }
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

  case "STOREP": // object key value -- object

    assertEcmaLangType(this.TOS());
    assertType(this.NOS(), STRING_TYPE);
    assertEcmaLangObject(this.ThirdOS());
    setProperty(this.TOS(), this.ThirdOS(), this.NOS(), true, true, true);
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
    // this.storeOrAssign('assign');
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
  assert(ret.type === UNDEFINED_TYPE);

  this.printstack();
  this.printLexicals();

  console.log(Common.Format.hline);
  console.log("[[ Stop Running ]]");
  console.log(Common.Format.hline);

};

module.exports = RedbankVM;
