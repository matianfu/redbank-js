/**
 * New node file
 */

var JSInterpreter = require("./interpreter.js");

var code = "var a = 10";

var interpreter = JSInterpreter.BuildInterpreter(code);

interpreter.run();
		
