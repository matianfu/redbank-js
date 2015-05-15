/**
 * New node file
 */

var fs = require('fs');
var path = require('path');
var esprima = require("./esprima");

var filePath = path.join('.', 'esprima.js');

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err){
      var ast = esprima.parse(data);
      var ast_json = JSON.stringify(ast);
      console.log(ast_json);
    }else{
        console.log(err);
    }

});