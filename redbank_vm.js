/*******************************************************************************
 * 
 * Virtual Machine
 * 
 * 
 * TOS NOS ThirdOS temp ... temp local [local size - 1] ... local [1] FP ->
 * local [0] function FP - 1 this FP - 2 argc FP - 3 param [argc - 1] ... param
 * [0]
 * 
 ******************************************************************************/

var Common = require('./common.js');

// var HORIZONTAL_LINE = "=================================================";

var ADDR_LOCAL = 'local';
var ADDR_PARAM = 'param';
var ADDR_LEXICAL = 'lexical';

var STRING_HASHBITS = 7;
var STRING_HASHTABLE_SIZE = (1 << STRING_HASHBITS);
var PROPERTY_HASHBITS = 7;
var PROPERTY_HASHTABLE_SIZE = (1 << PROPERTY_HASHBITS);

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

/**
 * for other parts of vm object, see initBootstrap function.
 */
function RedbankVM() {

  this.PC = 0;
  this.FP = 0;

  this.PCStack = [];
  this.FPStack = [];

  this.Stack = [];
  this.Objects = [];

  // string hash table
  this.StringHash = [];
  // property hash table
  this.PropertyHash = [];

  // used for debug purpose
  this.objectSnapshot = [];
  this.stringHashSnapshot = [];
  this.propertyHashSnapshot = [];

  // bytecode array
  this.code = {};
  // testcase
  this.testcase = {};
}

RedbankVM.prototype.hashProperty = function(property) {

  var propObj = this.getObject(property);
  var parent = propObj.parent;
  var name = propObj.name;

  var nameObj = this.getObject(name);
  var nameHash = nameObj.hash;

  var propHash = HASHMORE(nameHash, parent);

  propHash = propHash >>> (32 - PROPERTY_HASHBITS);

  var x = this.PropertyHash[propHash];
  if (x === 0) {
    // PropertyHash[propHash] = property;
    this.set(property, this.id, 'PropertyHash', propHash);
  }
  else {
    this.set(x, property, 'nextInSlot');
    this.set(property, this.id, 'PropertyHash', propHash);
  }
};

/**
 * This function remove the property out of hash table
 * 
 * @param property
 */
RedbankVM.prototype.unhashProperty = function(property) {

  var propObj = this.getObject(property);
  var parent = propObj.parent;
  var name = propObj.name;
  var child = propObj.child;

  var nameObj = this.getObject(name);
  var nameHash = nameObj.hash;

  var propHash = HASHMORE(nameHash, parent);

  propHash = propHash >>> (32 - PROPERTY_HASHBITS);

  if (this.PropertyHash[propHash] === property) {
    this.set(propObj.nextInSlot, this.id, 'PropertyHash', propHash);
    return;
  }

  for (var x = this.PropertyHash[propHash];; x = this.getObject(x).nextInSlot) {

    var next = this.getObject(x).nextInSlot;
    if (next === 0) {
      throw "property not found in property hash";
    }

    if (next === property) {
      var nextnext = this.getObject(next).nextInSlot;
      this.set(nextnext, x, 'nextInSlot');
      return;
    }
  }
};

/**
 * Retrieve object by id
 * 
 * @param id
 * @returns
 */
RedbankVM.prototype.getObject = function(id) {

  return this.Objects[id];
};

RedbankVM.prototype.typeOfObject = function(id) {

  return this.Objects[id].type;
};

/**
 * add object to array and return id
 * 
 * @param obj
 * @returns {Number}
 */
RedbankVM.prototype.register = function(obj) {

  if (obj.type === undefined) {
    throw "error";
  }

  this.Objects.push(obj);
  var id = this.Objects.length - 1;
  obj.id = id; // back annotation
  return id;
};

/**
 * 
 * remove object out of array
 * 
 * @param id
 */
RedbankVM.prototype.unregister = function(id) {

  var obj = this.Objects[id];
  this.assert(obj.REF.count === 0);
  console.log("[[ Object " + id + " (" + obj.type + ") being removed ]]");
  this.Objects[id] = undefined;
};

/**
 * may be problematic, examine it! TODO
 * 
 * @param child
 * @param parent
 * @returns
 */
RedbankVM.prototype.isa = function(child, parent) {

  if (typeof child !== 'number' || typeof parent !== 'number') {
    throw "wrong input";
  }
  if (child === 0) {
    return false;
  }
  if (child === parent) {
    return true;
  }
  if (this.Objects[child].PROTOTYPE === parent) {
    return true;
  }
  child = this.Objects[child].PROTOTYPE;
  return this.isa(child, parent);
};

RedbankVM.prototype.internFindString = function(string) {

  var hash = HASH(string);

  hash = hash >>> (32 - STRING_HASHBITS);

  var id = this.StringHash[hash];

  if (id === undefined) {
    throw "undefined is illegal value for StringHash table slot";
  }

  if (id === 0) {
    return;
  }

  for (; id !== 0; id = this.getObject(id).nextInSlot) {
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

  hash = hash >>> (32 - STRING_HASHBITS); // drop 20 bits, 12 bit left

  this.set(this.StringHash[hash], id, 'nextInSlot');
  this.set(id, this.id, 'StringHash', hash);
};

RedbankVM.prototype.uninternString = function(id) {

  var obj = this.getObject(id);

  this.assert(obj.type === 'string');

  var hash = obj.hash;
  hash = hash >>> (32 - STRING_HASHBITS); // shake off 20 bits

  if (this.StringHash[hash] === id) {

    this.set(this.getObject(id).nextInSlot, this.id, 'StringHash', hash);
    return;
  }

  for (var curr = this.StringHash[hash];; curr = this.getObject(curr).nextInSlot) {
    var next = this.getObject(curr).nextInSlot;
    if (next === 0) {
      throw "not found in StringHash";
    }

    if (next === id) {
      var nextnext = this.getObject(next).nextInSlot;
      this.set(nextnext, curr, 'nextInSlot');
      return;
    }
  }
};

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
RedbankVM.prototype.incrREF = function(id, object, name, index) {

  // if (name === 'nextInSlot') {
  // throw 'error';
  // }

  if (object === undefined) {
    throw "error";
  }

  if (id === 0) {
    return;
  }

  var obj = this.getObject(id);

  // for early stage debugging
  if (typeof obj.REF !== 'object' || typeof obj.REF.referrer !== 'object'
      || Array.isArray(obj.REF.referrer) !== true) {
    throw "error";
  }

  obj.REF.count++;
  obj.REF.referrer.push({
    object : object,
    name : name,
    index : index
  });
};

RedbankVM.prototype.decrREF = function(id, object, name, index) {

  var i;

  if (id === 0) {
    return;
  }

  var obj = this.getObject(id);
  if (obj === undefined || obj.REF.referrer.length === 0) {
    throw "error";
  }

  for (i = 0; i < obj.REF.referrer.length; i++) {
    if (index === undefined) {
      if (obj.REF.referrer[i].object === object
          && obj.REF.referrer[i].name === name) {
        break;
      }
    }
    else {
      if (obj.REF.referrer[i].object === object
          && obj.REF.referrer[i].name === name
          && obj.REF.referrer[i].index === index) {
        break;
      }
    }
  }

  if (i === obj.REF.referrer.length) {
    throw "error, referrer not found";
  }

  obj.REF.referrer.splice(i, 1);
  obj.REF.count--;

  if (obj.REF.count === 1 && obj.type === 'string') {

    this.uninternString(id); // uninterning string will cause it be removed.
    return;
  }

  if (obj.REF.count === 0) {

    switch (obj.type) {
    case 'addr':
      break;
    case 'boolean':
      break;
    case 'number':
      break;
    case 'string':
      this.decrREF(obj.nextInSlot, id, 'nextInSlot');
      break;

    case 'link':
      this.decrREF(obj.target, id, 'target');
      break;

    case 'property':
      this.decrREF(obj.name, id, 'name'); // recycle name string
      this.decrREF(obj.child, id, 'child'); // recycle child
      this.decrREF(obj.nextInObject, id, 'nextInObject'); // recycle next
      break;

    case 'function':
      // recycle lexicals
      for (i = 0; i < obj.lexicals.length; i++) {
        this.decrREF(obj.lexicals[i], id, 'lexicals', i);
      }

    case 'object':
      // recycle all property hash
      for (var curr = obj.property; curr !== 0; curr = this.getObject(curr).nextInObject) {
        this.unhashProperty(curr);
      }

      // recycle prototype
      this.set(0, id, 'PROTOTYPE');

      // recycle root property
      this.set(0, id, 'property');
      break;

    default:
      throw "not implemented.";
    }

    this.unregister(id);
  }
};

/**
 * Factory for addr object
 * 
 * @param addrType
 * @param index
 * @returns
 */
RedbankVM.prototype.createAddr = function(addrType, index) {

  var addr = {
    type : 'addr',
    REF : {
      count : 0,
      referrer : [],
    },

    addrType : addrType,
    index : index,
  };
  var id = this.register(addr);
  return id;
};

/**
 * 
 * @param target
 * @returns
 */
RedbankVM.prototype.createLink = function(target) {

  var link = {

    type : 'link',

    REF : {
      count : 0,
      referrer : [],
    },

    target : 0,
  };
  var id = this.register(link);
  this.set(target, id, 'target');
  return id;
};

/** not used yet * */
RedbankVM.prototype.createLexical = function(size) {

  var lexical = {
    type : 'lexical',
    REF : {
      count : 0,
      referrer : [],
    },
    size : size,
    slots : []
  };

  for (var i = 0; i < size; i++) {
    lexical.slots[i] = 0;
  }
  return this.register(lexical);
};

RedbankVM.prototype.set = function(id, object, name, index) {

  var old = 0;
  var source = this.getObject(object);

  if (source[name] === undefined) {
    // do NOT accept non-exist prop yet
    throw "error";
  }

  if (index !== undefined) {
    // index must be number and source[name] must be array
    if (typeof index !== 'number' || Array.isArray(source[name]) !== true) {
      throw "error";
    }

    if (source[name][index] !== 0) { // preserve a copy
      old = source[name][index];
      source[name][index] = 0;
    }
    source[name][index] = id;
  }
  else {

    if (source[name] !== 0) { // preserve a copy
      old = source[name];
      source[name] = 0;
    }
    source[name] = id;
  }

  if (id !== 0) {
    this.incrREF(id, object, name, index);
  }

  if (old !== 0) {
    this.decrREF(old, object, name, index);
  }

};

/** not used yet * */
RedbankVM.prototype.createProperty = function(parent, child, name, w, e, c) {

};

RedbankVM.prototype.createUndefined = function() {

  var obj = {
    type : 'undefined',
    REF : {
      count : 0,
      referrer : [],
    },

    isPrimitive : true,
    tag : 'undefined',
  };
  return this.register(obj);
};

RedbankVM.prototype.createNull = function() {

  var obj = {
    type : 'null',
    REF : {
      count : 0,
      referrer : [],
    },

    isPrimitive : true,
    tag : 'null',
  };
  return this.register(obj);
};

RedbankVM.prototype.createTrue = function() {

  var obj = {
    type : 'boolean',
    REF : {
      count : 0,
      referrer : [],
    },

    bValue : true,

    isPrimitive : true,
    tag : 'true',
  };
  return this.register(obj);
};

RedbankVM.prototype.createFalse = function() {

  var obj = {
    type : 'boolean',
    REF : {
      count : 0,
      referrer : [],
    },

    bValue : false,

    isPrimitive : true,
    tag : 'false',
  }
  return this.register(obj);
};

RedbankVM.prototype.createNumber = function(val) {

  if (typeof val !== 'number') {
    throw 'error';
  }

  var obj = {
    type : 'number',
    REF : {
      count : 0,
      referrer : [],
    },

    nValue : val,

    isPrimitive : true,
  }
  return this.register(obj);
};

RedbankVM.prototype.createString = function(str) {

  if (typeof val !== 'string') {
    throw 'error';
  }

  var obj = {
    type : 'string',
    REF : {
      count : 0,
      referrer : [],
    },

    nValue : val,

    isPrimitive : true,
    
    isInterned : false,
    hash : 0 >>> 0
  }
  return this.register(obj);
}

/**
 * Create a primitive Javascript value object
 * 
 * If the value is a string, it is automatically interned.
 * 
 * @param value
 * @param tag
 * @param builtin
 * @returns
 */
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

  // null, string, number, boolean, undefined
  var primitive = {
    type : typeof value,
    REF : {
      count : 0,
      referrer : [],
    },

    isPrimitive : true,
    value : value,
    tag : tag,

  };
  id = this.register(primitive, builtin);

  // string intern
  if (typeof value === 'string') {
    primitive.nextInSlot = 0;
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

    type : 'object',

    PROTOTYPE : 0,
    property : 0,

    REF : {
      count : 0,
      referrer : [],
    },

    isPrimitive : false,
    tag : tag,

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

  this.set(proto, id, 'PROTOTYPE');

  // Functions have prototype objects.
  if (this.FUNCTION_PROTO !== undefined && this.isa(id, this.FUNCTION_PROTO)) {
    obj.type = 'function';
    var pid = this.createObject(this.OBJECT_PROTO);
    this.setPropertyByLiteral(pid, id, 'prototype', true, false, false);
  }

  if (this.ARRAY_PROTO !== undefined && this.isa(id, this.ARRAY_PROTO)) {
    // obj.length = 0;
    // obj.toString = function() {
    // var strs = [];
    // for (var i = 0; i < this.length; i++) {
    // strs[i] = this.properties[i].toString();
    // }
    // return strs.join(',');
    // };
  }

  return id;
};

RedbankVM.prototype.createFunction = function(label, lexnum, length) {

  if (this.FUNCTION_PROTO === undefined || this.FUNCTION_PROTO === null) {
    throw "FUNCTION_PROTOtype not initialized.";
  }

  var id = this.createObject(this.FUNCTION_PROTO);
  var obj = this.Objects[id];
  obj.label = label;
  obj.lexicals = [];
  obj.lexnum = lexnum;

  for (var i = 0; i < lexnum; i++) {
    obj.lexicals[i] = 0;
  }

  var l = this.createPrimitive(length);
  this.setPropertyByLiteral(l, id, 'length', true, true, true);
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

  if (this.FUNCTION_PROTO === undefined || this.FUNCTION_PROTO === null) {
    throw "FUNCTION_PROTOtype not initialized.";
  }

  // create object
  var func = this.createObject(this.FUNCTION_PROTO, tag);

  // set native func
  var funcObj = this.getObject(func);
  funcObj.nativeFunc = nativeFunc;

  // create length property
  var id = this.createPrimitive(nativeFunc.length);
  this.setPropertyByLiteral(id, func, 'length', false, false, false);
  return func;
};

RedbankVM.prototype.createProperty = function(parent, writable, enumerable,
    configurable) {

  var property = {

    type : 'property',

    REF : {
      count : 0,
      referrer : [],
    },

    children : [],
    nextInObject : 0,

    parent : parent,

    writable : (writable === true) ? true : false,
    enumerable : (enumerable === true) ? true : false,
    configurable : (configurable === true) ? true : false,
  };
};

RedbankVM.prototype.searchProperty = function(object, name) {

  if (typeof object !== 'number' || typeof name !== 'number') {
    throw "Not an object id";
  }

  var obj = this.getObject(object);

  for (var prop = obj.property; prop !== 0; prop = this.getObject(prop).nextInObject) {
    if (this.getObject(prop).name === name) {
      return prop;
    }
  }

  return;
};

RedbankVM.prototype.deepSearchProperty = function(object, name) {

  for (var x = object; x !== 0; x = this.getObject(x).PROTOTYPE) {

    var prop = this.searchProperty(x, name);

    if (prop !== undefined) {
      return prop;
    }
  }
};

RedbankVM.prototype.setProperty = function(child, parent, name, writable,
    enumerable, configurable) {

  var obj;

  // for debug
  if (typeof parent !== 'number' || typeof child !== 'number') {
    throw "Convert object to object id for setProperty";
  }

  obj = this.Objects[parent];

  /**
   * any string is valid for js property name, including undefined, null, and
   * numbers number property name can NOT be used with dot notation, but bracket
   * notation is OK. other strings are OK for both dot and bracket notation.
   */
  // name = name.toString();
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

  var prop = this.searchProperty(parent, name);

  if (prop === undefined) {

    var property = {

      type : 'property',

      child : 0,
      name : 0,
      nextInObject : 0,
      nextInSlot : 0,

      REF : {
        count : 0,
        referrer : [],
      },

      parent : parent,

      writable : (writable === true) ? true : false,
      enumerable : (enumerable === true) ? true : false,
      configurable : (configurable === true) ? true : false,
    };
    var id = this.register(property);

    this.set(child, id, 'child');
    this.set(name, id, 'name');
    this.set(this.getObject(parent).property, id, 'nextInObject');
    this.set(id, parent, 'property');

    this.hashProperty(id);
  }
  else if (this.getObject(prop).writable === false) {
    return;
  }
  else {
    this.set(child, prop, 'child');
  }
};

RedbankVM.prototype.deleteProperty = function(property) {

  this.unhashProperty(property);

  var propObj = this.getObject(property);
  var parent = propObj.parent;
  var name = propObj.name;
  var child = propObj.child;

  if (propObj.property === property) {
    this.set(child, parent, 'property');
    return;
  }

  for (var x = propObj.property;; x = this.getObject(x).nextInObject) {

    var next = this.getObject(x).nextInObject;
    if (next === property) {
      var nextnext = this.getObject(next).nextInObject;
      this.set(nextnext, x, 'nextInObject');
      return;
    }

    if (next === 0) {
      throw "Error, property not found";
    }
  }
};

RedbankVM.prototype.setPropertyByLiteral = function(child, parent, nameLiteral,
    writable, enumerable, configurable) {

  var type = this.typeOfObject(parent);
  if (type !== 'object' && type !== 'function') {
    throw "error";
  }

  var name = this.createPrimitive(nameLiteral);
  this.setProperty(child, parent, name, writable, enumerable, configurable);
};

RedbankVM.prototype.getProperty = function(parent, name) {

  var prop = this.deepSearchProperty(parent, name);

  if (prop === undefined) {
    return this.UNDEFINED;
  }
  var id = this.getObject(prop).child;
  return (id === 0) ? this.UNDEFINED : id;
};

RedbankVM.prototype.createJSArray = function() {

  var arr = this.createObject(this.ARRAY_PROTO);
};

RedbankVM.prototype.snapshot = function() {

  var i;

  for (i = 0; i < this.Objects.length; i++) {
    if (this.Objects[i] !== undefined) {
      this.objectSnapshot.push(i);
    }
  }

  for (i = 0; i < STRING_HASHTABLE_SIZE; i++) {
    if (this.StringHash[i] !== 0) {
      this.stringHashSnapshot.push(i);
    }
  }

  for (i = 0; i < PROPERTY_HASHTABLE_SIZE; i++) {
    if (this.PropertyHash[i] !== 0) {
      this.propertyHashSnapshot.push(i);
    }
  }

  console.log(this.objectSnapshot);
  console.log(this.stringHashSnapshot);
  console.log(this.propertyHashSnapshot);
};

RedbankVM.prototype.createGlobal = function() {

  var id = this.createObject(this.OBJECT_PROTO, "Global Object");
  var obj = this.getObject(id);
  obj.REF.count = Infinity;

  this.GLOBAL = id;
  this.setPropertyByLiteral(this.UNDEFINED, this.GLOBAL, 'undefined', false,
      false, false);
};

RedbankVM.prototype.bootstrap = function() {

  var i, id, obj, wrapper;
  var vm = this;

  // zero string hash table
  for (i = 0; i < STRING_HASHTABLE_SIZE; i++) {
    this.StringHash[i] = 0;
  }

  // zero property hash table
  for (i = 0; i < PROPERTY_HASHTABLE_SIZE; i++) {
    this.PropertyHash[i] = 0;
  }

  // value constant
  this.UNDEFINED = undefined; // also a global property
  this.NULL = undefined;
  this.TRUE = undefined;
  this.FALSE = undefined;

  // global property (Number)
  this.INFINITY = undefined;
  this.NAN = undefined;

  // built-in prototypes
  this.OBJECT_PROTO = undefined;
  this.FUNCTION_PROTO = undefined;
  this.ARRAY_PROTO = undefined;
  this.GLOBAL = undefined;

  // poison
  this.register({
    type : 'poison'
  });

  // put vm inside objects array
  this.type = 'machine';
  this.REF = {
    count : 0,
    referrer : []
  };
  id = this.register(this);
  this.getObject(id).REF.count = Infinity;

  // null (value)
  id = this.createPrimitive(null, "NULL");
  this.NULL = id;
  this.getObject(id).REF.count = Infinity;

  // undefined (value)
  id = this.createPrimitive(undefined, "UNDEFINED");
  this.UNDEFINED = id;
  this.getObject(id).REF.count = Infinity;

  // boolean true (value)
  id = this.createPrimitive(true, "TRUE");
  this.TRUE = id;
  this.getObject(id).REF.count = Infinity;

  // boolean false (value)
  id = this.createPrimitive(false, "FALSE");
  this.FALSE = id;
  this.getObject(id).REF.count = Infinity;

  /**
   * Object.prototype
   */
  obj = {
    type : 'object',
    REF : {
      count : Infinity,
      referrer : [],
    },
    PROTOTYPE : 0,
    property : 0,
    isPrimitive : false,

    tag : "Object.prototype",
  };
  id = this.register(obj);
  this.OBJECT_PROTO = id;

  /**
   * Function.prototype
   * 
   * ECMA262:
   * 
   * The Function prototype is itself a Function object that, when invoked,
   * accepts any arguments and returns undefined.
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
  obj = {
    type : 'function',
    REF : {
      count : Infinity,
      referrer : [],
    },
    PROTOTYPE : this.OBJECT_PROTO,
    property : 0,

    nativeFunc : function() {
      return vm.UNDEFINED;
    },

    tag : "Function.prototype",
  };
  id = this.register(obj);
  this.FUNCTION_PROTO = id;

  /**
   * Object (constructor)
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
    return vm.createObject(vm.OBJECT_PROTO);
  };
  id = this.createNativeFunction(wrapper, "Object Constructor");
  this.setPropertyByLiteral(id, this.OBJECT_PROTO, 'prototype', false, false,
      false);
  this.OBJECT_CONSTRUCTOR = id;

  /**
   * Function (constructor)
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
  id = this.createNativeFunction(wrapper, "Function Constructor");
  this.setPropertyByLiteral(id, this.FUNCTION_PROTO, 'prototype', false, false,
      false);
  this.FUNCTION_CONSTRUCTOR = id;

  /**
   * Array.prototype
   */
  obj = {
    type : 'object',
    REF : {
      count : Infinity,
      referrer : [],
    },
    PROTOTYPE : 0,
    property : 0,
    isPrimitive : false,
    isArray : true,

    tag : "Object.prototype",
  };
  id = this.register(obj);
  this.ARRAY_PROTO = id;

  id = this.createObject(this.OBJECT_PROTO, "global object/scope");
  this.GLOBAL = id;
  this.getObject(id).REF.count = Infinity;

  this.setPropertyByLiteral(this.UNDEFINED, id, 'undefined', false, false,
      false);
  this.setPropertyByLiteral(this.OBJECT_CONSTRUCTOR, id, 'Object', false,
      false, false);
  this.setPropertyByLiteral(this.FUNCTION_CONSTRUCTOR, id, 'Function', false,
      false, false);

};

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
    return vm.UNDEFINED;
  };
  id = this.createNativeFunction(wrapper, "Object.prototype.dummy()");
  this
      .setPropertyByLiteral(id, this.OBJECT_PROTO, 'dummy', false, false, false);

  // Object.prototype.toString(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.toString());
  };
  id = this.createNativeFunction(wrapper, "Object.prototype.toString()");
  this.setPropertyByLiteral(id, this.OBJECT_PROTO, 'toString', true, false,
      true);

  // Object.prototype.valueOf(), native
  wrapper = function() { // TODO don't know if works
    return vm.createPrimitive(this.valueOf());
  };
  id = this.createNativeFunction(wrapper, "Object.prototype.valueOf()");
  this
      .setPropertyByLiteral(id, this.OBJECT_PROTO, 'valueOf', true, false, true);

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
 * Get current function's argument count
 * 
 * 
 * @returns argument count
 */
RedbankVM.prototype.ARGC = function() {

  if (this.FP === 0) {
    throw "main function has no args";
  }

  var id = this.Stack[this.FP - 3];
  this.assertNumber(id);
  return this.getObject(id).value;
};

RedbankVM.prototype.NativeARGC = function() {

  var id = this.Stack[this.Stack.length - 3];
  this.assertNumber(id);
  return this.getObject(id).value;
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

  var index = this.Stack.length - 3; // now point to argc
  index = index - this.NativeARGC();
  return index; // now point to arg0
};

/**
 * Top of stack
 * 
 * @returns
 */
RedbankVM.prototype.TOS = function() {
  return this.Stack[this.Stack.length - 1];
};

RedbankVM.prototype.indexOfTOS = function() {
  return this.Stack.length - 1;
};

/**
 * Next on stack
 * 
 * @returns
 */
RedbankVM.prototype.indexOfNOS = function() {
  return this.Stack.length - 2;
};

RedbankVM.prototype.NOS = function() {
  return this.Stack[this.indexOfNOS()];
};

/**
 * The 3rd on stack
 */
RedbankVM.prototype.ThirdOS = function() {
  return this.Stack[this.Stack.length - 3];
};

RedbankVM.prototype.indexOfThirdOS = function() {
  return this.Stack.length - 3;
};

RedbankVM.prototype.assertPropertyHash = function() {

  for (var i = 0; i < PROPERTY_HASHTABLE_SIZE; i++) {
    if (this.PropertyHash[i] === 0) {
      continue;
    }

    for (var prop = this.PropertyHash[i]; prop !== 0; prop = this
        .getObject(prop).nextInSlot) {
      this.assert(this.typeOfObject(this.PropertyHash[i]) === 'property');
    }
  }
};

/**
 * TODO refactoring this function. Out dated.
 */
RedbankVM.prototype.assert_no_leak = function() {

  return;
};

/**
 * Assert the given id is a valid object id
 * 
 * @param id
 */
RedbankVM.prototype.assertDefined = function(id) {

  if (typeof id !== 'number' || id < 0) {
    throw "assert fail, id is NOT zero or positive number";
  }

  if (this.getObject(id) === undefined) {
    throw "assert fail, undefined object id";
  }
};

RedbankVM.prototype.assertAddr = function(id) {

  this.assertDefined(id);
  if (this.getObject(id).type !== 'addr') {
    throw "assert fail, given id is NOT an addr";
  }
};

RedbankVM.prototype.assertNonAddr = function(id) {

  this.assertDefined(id);
  if (this.getObject(id).type === 'addr') {
    throw "assert fail, given id is an addr";
  }
};

RedbankVM.prototype.assertNumber = function(id) {

  this.assertDefined(id);
  if (this.getObject(id).type !== 'number') {
    throw "assert fail, given id is NOT a number";
  }
};

RedbankVM.prototype.assertString = function(id) {

  this.assertDefined(id);
  if (this.getObject(id).type !== 'string') {
    throw "assert fail, given id is NOT a string";
  }
};

/**
 * both object and function are valid JSObject
 * 
 * @param id
 */
RedbankVM.prototype.assertJSObject = function(id) {

  this.assertDefined(id);

  var type = this.getObject(id).type;

  if (type === 'object' || type === 'function') {
    return;
  }

  throw "assert fail, given id is NEITHER object NOR function";
};

RedbankVM.prototype.assertAddrLocal = function(id) {

  this.assertAddr(id);

  var obj = this.getObject(id);
  this.assert(obj.addrType === ADDR_LOCAL);
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
  this.assert(this.Stack[slot] === this.UNDEFINED);
};

RedbankVM.prototype.assertStackSlotNumberValue = function(slot, val) {

  var obj = this.getObject(this.Stack[slot]);
  this.assert(obj.type === 'number');
  this.assert(obj.value === val);
};

RedbankVM.prototype.assertStackSlotBooleanValue = function(slot, val) {

  if (val === true) {
    this.assert(this.Stack[slot] === this.TRUE);
  }
  else if (val === false) {
    this.assert(this.Stack[slot] === this.FALSE);
  }
  else {
    throw "unexpected assert value";
  }
};

RedbankVM.prototype.assertStackSlotObject = function(slot) {

  this.assert(this.typeOfObject(this.Stack[slot]) === 'object');
};

RedbankVM.prototype.assertStackSlotObjectPropertyNumberValue = function(slot,
    nameLit, val) {

  var id = this.Stack[slot];
  this.assert(this.typeOfObject(id) === 'object');

  var obj = this.getObject(id);
  for (var prop = obj.property; prop !== 0; prop = this.getObject(prop).nextInObject) {
    var propObj = this.getObject(prop);
    var nameObj = this.getObject(propObj.name);
    if (nameObj.value === nameLit) {
      this.assert(this.typeOfObject(propObj.child) === 'number');
      this.assert(this.getObject(propObj.child).value === val);
      return;
    }
  }

  throw "property not found or value mismatch";
};

RedbankVM.prototype.assertStackSlotFunction = function(slot) {

  var id = this.Stack[slot];
  this.assert(this.typeOfObject(id) === 'function');
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

  this.assertDefined(id);

  var index = this.Stack.length;
  this.Stack.push(0);
  this.set(id, this.id, 'Stack', index);
};

RedbankVM.prototype.pop = function() {

  var id = this.TOS();
  this.set(0, this.id, 'Stack', this.indexOfTOS());
  this.Stack.pop();
  return; // don't return id, may be undefined
};

RedbankVM.prototype.fetcha = function() {

  this.assertAddr(this.TOS());

  var addr = this.TOS();
  var addrObj = this.getObject(addr);
  var index = addrObj.index;
  var linkObj;

  if (addrObj.addrType === ADDR_LOCAL) {
    index = this.lid2sid(index);

    if (this.typeOfObject(this.Stack[index]) === 'link') {
      linkObj = this.getObject(this.Stack[index]);

      this.set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
    }
    else {
      this.set(this.Stack[index], this.id, 'Stack', this.indexOfTOS());
    }
  }
  else if (addrObj.addrType === ADDR_PARAM) {
    index = this.pid2sid(index);

    if (this.typeOfObject(this.Stack[index]) === 'link') {
      linkObj = this.getObject(this.Stack[index]);

      this.set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
    }
    else {
      this.set(this.Stack[index], this.id, 'Stack', this.indexOfTOS());
    }
  }
  else if (addrObj.addrType === ADDR_LEXICAL) {

    this.assert(this.FP !== 0);

    // get function object id
    var fid = this.Stack[this.FP - 1];

    // assert it's a function
    this.assert(this.typeOfObject(fid) === 'function');

    // get object
    var funcObj = this.getObject(fid);

    // assert index not out-of-range
    this.assert(funcObj.lexnum > index);

    // retrieve link
    var link = funcObj.lexicals[index];

    // assert link
    this.assert(this.typeOfObject(link) === 'link');

    linkObj = this.getObject(link);

    this.set(linkObj.target, this.id, 'Stack', this.indexOfTOS());
  }
  else {
    throw "Unknown address type";
  }
};

/**
 * parent, prop -- child
 */
RedbankVM.prototype.fetcho = function() {

  this.assertString(this.TOS());
  this.assertJSObject(this.NOS());

  var id = this.getProperty(this.NOS(), this.TOS());
  this.set(id, this.id, 'Stack', this.indexOfNOS());
  this.pop();
};

/**
 * parent, prop -- parent, child
 */
RedbankVM.prototype.fetchof = function() {

  this.assertString(this.TOS());
  this.assertJSObject(this.NOS());

  var id = this.getProperty(this.NOS(), this.TOS());
  this.set(id, this.id, 'Stack', this.indexOfTOS());
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

  this.assertNonAddr(this.TOS());
  this.assertAddr(this.NOS());

  var id = this.TOS();
  var addr = this.NOS();
  var addrObj = this.getObject(addr);
  var index = addrObj.index;
  var object;

  if (addrObj.addrType === ADDR_LOCAL || addrObj.addrType === ADDR_PARAM) {

    if (addrObj.addrType === ADDR_LOCAL) {
      index = this.lid2sid(index);
    }
    else {
      index = this.pid2sid(index);
    }

    if (this.typeOfObject(this.Stack[index]) === 'link') {
      object = this.Stack[index];
      this.set(id, object, 'target');
    }
    else {
      this.set(id, this.id, 'Stack', index);
    }
  }
  else if (addrObj.addrType === ADDR_LEXICAL) {
    // get function object id
    var func = this.Stack[this.FP - 1];
    var funcObj = this.getObject(func);
    var link = funcObj.lexicals[index];

    this.set(id, link, 'target');
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
    this.set(this.TOS(), this.id, 'Stack', this.indexOfNOS());
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

  this.assertNonAddr(this.TOS());
  this.assertString(this.NOS());
  this.assertJSObject(this.ThirdOS());

  this.setProperty(this.TOS(), this.ThirdOS(), this.NOS(), true, true, true);

  if (mode === 'store') {
    this.pop();
    this.pop();
    this.pop();
  }
  else if (mode === 'assign') {
    this.set(this.TOS(), this.id, 'Stack', this.indexOfThirdOS());
    this.pop();
    this.pop();
  }
};

RedbankVM.prototype.printstack = function() {

  if (this.Stack.length === 0) {
    console.log("STACK Empty");
  }
  else {
    console.log("STACK size: " + this.Stack.length);
    for (var i = this.Stack.length - 1; i >= 0; i--) {

      var id = this.Stack[i];
      var obj = this.getObject(id);

      switch (this.typeOfObject(id)) {
      case 'boolean':
        console.log(i + " : " + id + " (boolean) " + obj.value + " ref: "
            + obj.REF.count);
        break;
      case 'undefined':
        console.log(i + " : " + id + " (undefined) ref: " + obj.REF.count);
        break;
      case 'number':
        console.log(i + " : " + id + " (number) " + obj.value + " ref: "
            + obj.REF.count);
        break;
      case 'string':
        console.log(i + " : " + id + " (string) " + obj.value + " ref: "
            + obj.REF.count);
        break;
      case 'link':
        console.log(i + " : " + id + " (link) ref: " + obj.REF.count
            + "target: " + obj.target);
        break;
      case 'addr':
        console.log(i + " : " + id + " (addr) " + obj.addrType + " "
            + obj.index);
        break;
      case 'object':
        console.log(i + " : " + id + " (object) ref: " + obj.REF.count);
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

  var fid = this.Stack[this.FP - 1];
  this.assert(this.typeOfObject(fid) === 'function');

  var funcObj = this.getObject(fid);

  if (funcObj.nativeFunc !== 'undefined') {
    return;
  }

  if (funcObj.lexnum === 0 || funcObj.lexicals.length === 0) {
    return;
  }

  console.log("  --- lexicals ---  ");

  for (var i = 0; i < funcObj.lexicals.length; i++) {

    var link = funcObj.lexicals[i];
    var linkObj = this.getObject(link);
    if (linkObj.type !== 'link') {
      throw "non-link object in function's lexicals";
    }

    var targetObj = this.getObject(linkObj.target);
    console.log(i + " : " + "link : " + link + ", ref: " + linkObj.REF.count
        + ", target: " + linkObj.target + ", ref: " + targetObj.REF.count);
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

  this.assert(this.typeOfObject(this.TOS()) === 'function');

  /**
   * arg1 is the capture source, local, param, or lexical arg2 is the slot from
   * source arg3 is the slot to target
   */
  if (bytecode.arg1 === "argument" || bytecode.arg1 === "local") {
    if (bytecode.arg1 === "argument") {
      index = this.pid2sid(bytecode.arg2);
    }
    else {
      index = this.lid2sid(bytecode.arg2);
    }

    id = this.Stack[index];
    if (this.typeOfObject(id) === 'link') {
      this.set(id, this.TOS(), 'lexicals', bytecode.arg3);
    }
    else {
      // create a link, this will incr ref to target
      link = this.createLink(id);
      // TOS() is the function object
      this.set(link, this.TOS(), 'lexicals', bytecode.arg3);
      this.set(link, this.id, 'Stack', index);
    }
  }
  else if (bytecode.arg1 === "lexical") {

    var funcFrom = this.Stack[this.FP - 1];
    var funcFromObj = this.getObject(funcFrom);
    link = funcFromObj.lexicals[bytecode.arg2];
    this.set(link, this.TOS(), 'lexicals', bytecode.arg3);
  }
  else {
    throw "unknown capture from region";
  }
};

RedbankVM.prototype.stepCall = function() {

  this.assert(this.typeOfObject(this.TOS()) === 'function');

  var fid = this.TOS();
  var fObj = this.getObject(fid);

  if (fObj.nativeFunc === undefined) {
    this.PCStack.push(this.PC);
    this.FPStack.push(this.FP);
    this.PC = fObj.label;
    this.FP = this.Stack.length;
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
  this.set(result, this.id, "Stack", this.indexOfNativeRET());

  this.pop(); // pop function object
  this.pop(); // pop this object

  // don't pop argc, ret may be popped.
  // this.pop(); // argc
  for (var i = 0; i < argc; i++) {
    this.pop(); // pop params
  }
};

RedbankVM.prototype.stepBinop = function(binop) {

  // var comp = this.comp(leftSide, rightSide);
  // if (node.operator == '==' || node.operator == '!=') {
  // value = comp === 0;
  // if (node.operator == '!=') {
  // value = !value;
  // }
  // } else if (node.operator == '===' || node.operator == '!==') {
  // if (leftSide.isPrimitive && rightSide.isPrimitive) {
  // value = leftSide.data === rightSide.data;
  // } else {
  // value = leftSide === rightSide;
  // }
  // if (node.operator == '!==') {
  // value = !value;
  // }
  // } else if (node.operator == '>') {
  // value = comp == 1;
  // } else if (node.operator == '>=') {
  // value = comp == 1 || comp === 0;
  // } else if (node.operator == '<') {
  // value = comp == -1;
  // } else if (node.operator == '<=') {
  // value = comp == -1 || comp === 0;
  // } else if (node.operator == '+') {
  // if (leftSide.type == 'string' || rightSide.type == 'string') {
  // var leftValue = leftSide.toString();
  // var rightValue = rightSide.toString();
  // } else {
  // var leftValue = leftSide.toNumber();
  // var rightValue = rightSide.toNumber();
  // }
  // value = leftValue + rightValue;
  // } else if (node.operator == 'in') {
  // value = this.hasProperty(rightSide, leftSide);
  // } else {
  // var leftValue = leftSide.toNumber();
  // var rightValue = rightSide.toNumber();
  // if (node.operator == '-') {
  // value = leftValue - rightValue;
  // } else if (node.operator == '*') {
  // value = leftValue * rightValue;
  // } else if (node.operator == '/') {
  // value = leftValue / rightValue;
  // } else if (node.operator == '%') {
  // value = leftValue % rightValue;
  // } else if (node.operator == '&') {
  // value = leftValue & rightValue;
  // } else if (node.operator == '|') {
  // value = leftValue | rightValue;
  // } else if (node.operator == '^') {
  // value = leftValue ^ rightValue;
  // } else if (node.operator == '<<') {
  // value = leftValue << rightValue;
  // } else if (node.operator == '>>') {
  // value = leftValue >> rightValue;
  // } else if (node.operator == '>>>') {
  // value = leftValue >>> rightValue;
  // } else {
  // throw 'Unknown binary operator: ' + node.operator;
  // }
  // }

  var left = this.NOS();
  var right = this.TOS();
  var leftObj = this.getObject(left);
  var rightObj = this.getObject(right);

  var id, val;

  if (binop === '+' || binop === '-' || binop === '*' || binop === '/'
      || binop === '%') {

    if (leftObj.isPrimitive !== true || rightObj.isPrimitive !== true) {
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
        id = this.createPrimitive(val);
      }

      this.pop();
      this.pop();
      this.push(id);

      return;
    }
  }
  else if (binop === '===') {
    this.assertNonAddr(this.TOS());
    this.assertNonAddr(this.NOS());

    var equality;

    if (this.typeOfObject(this.TOS()) !== this.typeOfObject(this.NOS())) {
      equality = false;
    }
    else {
      var type = this.typeOfObject(this.TOS());
      if (type === 'undefined') {
        equality = true;
      }
      else if (type === 'boolean') {
        equality = (this.TOS() === this.NOS());
      }
      else if (type === 'number') {
        equality = (this.getObject(this.TOS()).value === this.getObject(this
            .NOS()).value);
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
      this.push(this.TRUE);
    }
    else {
      this.push(this.FALSE);
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

  case "DROP": // n1 --
    this.pop();
    break;

  case "FETCHA": // addr -- obj
    this.fetcha();
    break;

  case "FETCHO": // parent, prop -- child
    this.fetcho();
    break;

  case "FETCHOF": // parent, prop -- parent, child
    this.fetchof();
    break;

  case "FUNC": // -- f1
    id = this.createFunction(bytecode.arg1, bytecode.arg2, bytecode.arg3);
    this.push(id);
    break;

  case "JUMP":
    v = bytecode.arg1;
    v = this.findLabel(this.code, v);
    this.PC = v;
    break;

  case "JUMPC":
    if (this.TOS() === this.TRUE) {
      this.PC = this.findLabel(this.code, bytecode.arg1);
    }
    else if (this.TOS() === this.FALSE) {
      this.PC = this.findLabel(this.code, bytecode.arg2);
    }
    else {
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
      this.push(this.createAddr(ADDR_LOCAL, bytecode.arg2));
    }
    else if (bytecode.arg1 === 'PARAM') {
      this.push(this.createAddr(ADDR_PARAM, bytecode.arg2));
    }
    else if (bytecode.arg1 === 'LEXICAL') {
      this.push(this.createAddr(ADDR_LEXICAL, bytecode.arg2));
    }
    else if (bytecode.arg1 === "PROP") {
      this.push(this.createPrimitive(bytecode.arg2));
    }
    else if (bytecode.arg1 === "GLOBAL") {
      this.push(this.GLOBAL);
      this.push(this.createPrimitive(bytecode.arg2)); // string name
    }
    else {
      throw "not supported yet";
    }

    break;

  case "LITC":
    // push an constant value
    val = bytecode.arg1;
    id = this.createPrimitive(val);
    this.push(id);
    break;

  case "LITG":
    this.push(this.GLOBAL);
    break;

  case "LITN":
    // push n UNDEFINED object
    for (var i = 0; i < bytecode.arg1; i++) {
      this.push(this.UNDEFINED);
    }
    break;

  case "LITO":
    // create an empty object and push to stack
    id = this.createObject(this.OBJECT_PROTO);
    this.push(id);
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
        result = this.TOS();
      }
      else {
        result = this.UNDEFINED;
      }

      // overwrite
      this.set(result, this.id, "Stack", this.indexOfRET());

      while (this.Stack.length > this.FP) {
        this.pop();
      }

      this.pop(); // pop function object
      this.pop(); // pop this object

      // don't pop argc, ret will be popped.
      // this.pop(); // argc
      for (i = 0; i < argc; i++) {
        this.pop(); // pop params
      }

      // restore fp and pc
      this.PC = this.PCStack.pop();
      this.FP = this.FPStack.pop();
    }
    break;

  case "STORE": // addr n1 --

    if (this.typeOfObject(this.NOS()) === 'addr') {
      this.storeOrAssignToAddress('store');
    }
    else if (this.typeOfObject(this.NOS()) === 'string') {
      this.storeOrAssignToObject('store');
    }
    else {
      throw "don't known how to store";
    }
    break;

  case "STOREP": // object key value -- object

    this.assertNonAddr(this.TOS());
    this.assertString(this.NOS());
    this.assertJSObject(this.ThirdOS());
    this.setProperty(this.TOS(), this.ThirdOS(), this.NOS(), true, true, true);

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
    id = this.Stack[this.FP - 2];
    this.push(id);
    break;

  case '=':
    if (this.typeOfObject(this.NOS()) === 'addr') {
      this.storeOrAssignToAddress('assign');
    }
    else if (this.typeOfObject(this.NOS()) === 'string') {
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

  this.bootstrap();
  this.init(initmode);

  this.code = input;
  this.testcase = testcase;

  console.log(Common.Format.hline);
  console.log("[[ Start Running ]]");
  console.log(Common.Format.hline);

  while (this.PC < this.code.length) {

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
    this.assertPropertyHash();
    this.step(this.code, bytecode);
  }

  this.assertPropertyHash();

  this.printstack();
  this.printLexicals();
  this.assert_no_leak();
};

module.exports = RedbankVM;
