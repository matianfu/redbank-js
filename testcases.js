/**
 * New node file
 */

var basics = {

  /**
   * the very first simple variable declaration
   */
  var_declare : {

    source : 'var a; rb_test("test");',

    test : function(vm) {
      vm.assertStackLengthEqual(1);
      vm.assertStackSlotUndefined(0);
    },
  },
};

var tests = {
  basic : basics,
};

exports.TESTS = tests;