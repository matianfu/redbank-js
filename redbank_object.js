/**
 * These are the complete list of ecma object types, including internal types
 * 
 * not all of these are implemented in red bank
 */
var UNDEFINED_TYPE = 'undefined'; // ecma language type
var NULL_TYPE = 'null'; // ecma language type
var BOOLEAN_TYPE = 'boolean'; // ecma language type
var STRING_TYPE = 'string'; // ecma language type
var NUMBER_TYPE = 'number'; // ecma language type
var OBJECT_TYPE = 'object'; // ecma language type
var REFERENCE_TYPE = 'reference'; // ecma spec type
var LIST_TYPE = 'list'; // ecma spec type
var COMPLETION_TYPE = 'completion'; // ecma spec type
var PROPERTY_DESCRIPTOR_TYPE = 'property descriptor'; // ecma spec type
var PROPERTY_IDENTIFIER_TYPE = 'property identifier'; // ecma spec type
var LEXICAL_ENVIRONMENT_TYPE = 'lexical environment'; // ecma spec type
var ENVIRONMENT_RECORD_TYPE = 'environment record'; // ecma spec type

/**
 *  The red bank specific type
 */
var ADDR_TYPE = 'addr'; // red bank internal type
var LINK_TYPE = 'link'; // red bank internal type
var TRAP_TYPE = 'trap'; // red bank internal type

/**
 * for saving constant after bootstrap
 */
var JS_UNDEFINED = 0;
var JS_NULL = 0;

/**
 * 
 */
var ObjectHeap = [];

/**
 * 
 */
function JSUndefined() {

  this.type = UNDEFINED_TYPE;
  this.count = 0;
  this.referrer = [];
}

JSUndefined.prototype = Object.create(null);
JSUndefined.prototype.constructor = JSUndefined;

/**
 * 
 */
function JSNull() {

  this.type = NULL_TYPE;
  this.count = 0;
  this.referrer = [];
}

JSNull.prototype = Object.create(null);
JSNull.prototype.constructor = JSNull;

/**
 * 
 */
function JSBoolean(value) {
  
  if (value !== 0 && value !== 1) {
    throw error;
  }
  
  this.type = BOOLEAN_TYPE;
  this.count = 0;
  this.referrer = [];
  this.value = value;
}

JSBoolean.prototype = Object.create(null);
JSBoolean.prototype.constructor = JSBoolean;

function JSNumber() {
  
  
}

/**
 * 
 */
function JSObject(proto) {

  this.type = OBJECT_TYPE;
  this.count = 0;
  this.referrer = [];

  this.PROTOTYPE = proto;
  this.CLASS = "";
  this.EXTENSIBLE = false;
}

JSObject.prototype = Object.create(null);
JSObject.prototype.constructor = JSObject;

/**
 * Returns the value of the named property
 * 
 * @param propertyName
 */
JSObject.prototype.GET = function(propertyName) {

  return 0;
};

JSObject.prototype.GET_OWN_PROPERTY = function(propertyName) {

};

JSObject.prototype.GET_PROPERTY = function(propertyName) {

};

JSObject.prototype.PUT = function() {

};

JSObject.prototype.CAN_PUT = function() {

};

JSObject.prototype.HAS_PROPERTY = function() {

};

JSObject.prototype.DELETE = function() {

};

JSObject.prototype.DEFAULT_VALUE = function() {

};

JSObject.prototype.DEFINE_OWN_PROPERTY = function() {

}

function bootstrap() {
  
}
