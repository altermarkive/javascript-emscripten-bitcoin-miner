// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.
// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');
// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}
// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  Module['print'] = function print(x) {
    process['stdout'].write(x + '\n');
  };
  Module['printErr'] = function printErr(x) {
    process['stderr'].write(x + '\n');
  };
  var nodeFS = require('fs');
  var nodePath = require('path');
  Module['read'] = function read(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };
  Module['readBinary'] = function readBinary(filename) { return Module['read'](filename, true) };
  Module['load'] = function load(f) {
    globalEval(read(f));
  };
  Module['arguments'] = process['argv'].slice(2);
  module['exports'] = Module;
}
else if (ENVIRONMENT_IS_SHELL) {
  Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm
  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }
  Module['readBinary'] = function readBinary(f) {
    return read(f, 'binary');
  };
  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }
  this['Module'] = Module;
  eval("if (typeof gc === 'function' && gc.toString().indexOf('[native code]') > 0) var gc = undefined"); // wipe out the SpiderMonkey shell 'gc' function, which can confuse closure (uses it as a minified name, and it is then initted to a non-falsey value unexpectedly)
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };
  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }
  if (typeof console !== 'undefined') {
    Module['print'] = function print(x) {
      console.log(x);
    };
    Module['printErr'] = function printErr(x) {
      console.log(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }
  if (ENVIRONMENT_IS_WEB) {
    this['Module'] = Module;
  } else {
    Module['load'] = importScripts;
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}
function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] == 'undefined' && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
// *** Environment setup code ***
// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];
// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];
// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// === Auto-generated preamble library stuff ===
//========================================
// Runtime code shared with compiler
//========================================
var Runtime = {
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  forceAlign: function (target, quantum) {
    quantum = quantum || 4;
    if (quantum == 1) return target;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target/quantum)*quantum;
    } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
      return '(((' +target + ')+' + (quantum-1) + ')&' + -quantum + ')';
    }
    return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
  },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  },
  isPointerType: function isPointerType(type) {
  return type[type.length-1] == '*';
},
  isStructType: function isStructType(type) {
  if (isPointerType(type)) return false;
  if (isArrayType(type)) return true;
  if (/<?{ ?[^}]* ?}>?/.test(type)) return true; // { i32, i8 } etc. - anonymous struct types
  // See comment in isStructPointerType()
  return type[0] == '%';
},
  INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
  FLOAT_TYPES: {"float":0,"double":0},
  or64: function (x, y) {
    var l = (x | 0) | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  and64: function (x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  xor64: function (x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  dedup: function dedup(items, ident) {
  var seen = {};
  if (ident) {
    return items.filter(function(item) {
      if (seen[item[ident]]) return false;
      seen[item[ident]] = true;
      return true;
    });
  } else {
    return items.filter(function(item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }
},
  set: function set() {
  var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
  var ret = {};
  for (var i = 0; i < args.length; i++) {
    ret[args[i]] = 0;
  }
  return ret;
},
  STACK_ALIGN: 8,
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (type == 'i64' || type == 'double' || vararg) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    var index = 0;
    type.flatIndexes = type.fields.map(function(field) {
      index++;
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
        alignSize = Runtime.getAlignSize(field, size);
      } else if (Runtime.isStructType(field)) {
        if (field[1] === '0') {
          // this is [0 x something]. When inside another structure like here, it must be at the end,
          // and it adds no size
          // XXX this happens in java-nbody for example... assert(index === type.fields.length, 'zero-length in the middle!');
          size = 0;
          if (Types.types[field]) {
            alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
          } else {
            alignSize = type.alignSize || QUANTUM_SIZE;
          }
        } else {
          size = Types.types[field].flatSize;
          alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
        }
      } else if (field[0] == 'b') {
        // bN, large number field, like a [N x i8]
        size = field.substr(1)|0;
        alignSize = 1;
      } else if (field[0] === '<') {
        // vector type
        size = alignSize = Types.types[field].flatSize; // fully aligned
      } else if (field[0] === 'i') {
        // illegal integer field, that could not be legalized because it is an internal structure field
        // it is ok to have such fields, if we just use them as markers of field size and nothing more complex
        size = alignSize = parseInt(field.substr(1))/8;
        assert(size % 1 === 0, 'cannot handle non-byte-size field ' + field);
      } else {
        assert(false, 'invalid type for calculateStructAlignment');
      }
      if (type.packed) alignSize = 1;
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr-prev);
      }
      prev = curr;
      return curr;
    });
    if (type.name_[0] === '[') {
      // arrays have 2 elements, so we get the proper difference. then we scale here. that way we avoid
      // allocating a potentially huge array for [999999 x i8] etc.
      type.flatSize = parseInt(type.name_.substr(1))*type.flatSize/2;
    }
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = (type.flatFactor != 1);
    return type.flatIndexes;
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName];
      if (!type) return null;
      if (type.fields.length != struct.length) {
        printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo');
        return null;
      }
      alignment = type.flatIndexes;
    } else {
      var type = { fields: struct.map(function(item) { return item[0] }) };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach(function(item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset;
        } else {
          // embedded struct
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      });
    } else {
      struct.forEach(function(item, i) {
        ret[item[1]] = alignment[i];
      });
    }
    return ret;
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  getAsmConst: function (code, numArgs) {
    // code is a constant string on the heap, so we can cache these
    if (!Runtime.asmConstCache) Runtime.asmConstCache = {};
    var func = Runtime.asmConstCache[code];
    if (func) return func;
    var args = [];
    for (var i = 0; i < numArgs; i++) {
      args.push(String.fromCharCode(36) + i); // $0, $1 etc
    }
    return Runtime.asmConstCache[code] = eval('(function(' + args.join(',') + '){ ' + Pointer_stringify(code) + ' })'); // new Function does not allow upvars in node
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return Runtime.funcWrappers[func];
  },
  UTF8Processor: function () {
    var buffer = [];
    var needed = 0;
    this.processCChar = function (code) {
      code = code & 0xFF;
      if (buffer.length == 0) {
        if ((code & 0x80) == 0x00) {        // 0xxxxxxx
          return String.fromCharCode(code);
        }
        buffer.push(code);
        if ((code & 0xE0) == 0xC0) {        // 110xxxxx
          needed = 1;
        } else if ((code & 0xF0) == 0xE0) { // 1110xxxx
          needed = 2;
        } else {                            // 11110xxx
          needed = 3;
        }
        return '';
      }
      if (needed) {
        buffer.push(code);
        needed--;
        if (needed > 0) return '';
      }
      var c1 = buffer[0];
      var c2 = buffer[1];
      var c3 = buffer[2];
      var c4 = buffer[3];
      var ret;
      if (buffer.length == 2) {
        ret = String.fromCharCode(((c1 & 0x1F) << 6)  | (c2 & 0x3F));
      } else if (buffer.length == 3) {
        ret = String.fromCharCode(((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6)  | (c3 & 0x3F));
      } else {
        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        var codePoint = ((c1 & 0x07) << 18) | ((c2 & 0x3F) << 12) |
                        ((c3 & 0x3F) << 6)  | (c4 & 0x3F);
        ret = String.fromCharCode(
          Math.floor((codePoint - 0x10000) / 0x400) + 0xD800,
          (codePoint - 0x10000) % 0x400 + 0xDC00);
      }
      buffer.length = 0;
      return ret;
    }
    this.processJSString = function processJSString(string) {
      string = unescape(encodeURIComponent(string));
      var ret = [];
      for (var i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i));
      }
      return ret;
    }
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+7)&-8); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+7)&-8); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+7)&-8); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 8))*(quantum ? quantum : 8); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}
//========================================
// Runtime essentials
//========================================
var __THREW__ = 0; // Used in checking for thrown exceptions.
var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;
var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}
var globalScope = this;
// C calling interface. A convenient way to call C functions (in C files, or
// defined with extern "C").
//
// Note: LLVM optimizations can inline and remove functions, after which you will not be
//       able to call them. Closure can also do so. To avoid that, add your function to
//       the exports using something like
//
//         -s EXPORTED_FUNCTIONS='["_main", "_myfunc"]'
//
// @param ident      The name of the C function (note that C++ functions will be name-mangled - use extern "C")
// @param returnType The return type of the function, one of the JS types 'number', 'string' or 'array' (use 'number' for any C pointer, and
//                   'array' for JavaScript arrays and typed arrays; note that arrays are 8-bit).
// @param argTypes   An array of the types of arguments for the function (if there are no arguments, this can be ommitted). Types are as in returnType,
//                   except that 'array' is not possible (there is no way for us to know the length of the array)
// @param args       An array of the arguments to the function, as native JS values (as in returnType)
//                   Note that string arguments will be stored on the stack (the JS string will become a C string on the stack).
// @return           The return value, as a native JS value (as in returnType)
function ccall(ident, returnType, argTypes, args) {
  return ccallFunc(getCFunc(ident), returnType, argTypes, args);
}
Module["ccall"] = ccall;
// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  try {
    var func = Module['_' + ident]; // closure exported function
    if (!func) func = eval('_' + ident); // explicit lookup
  } catch(e) {
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}
// Internal function that does a C call using a function, not an identifier
function ccallFunc(func, returnType, argTypes, args) {
  var stack = 0;
  function toC(value, type) {
    if (type == 'string') {
      if (value === null || value === undefined || value === 0) return 0; // null string
      value = intArrayFromString(value);
      type = 'array';
    }
    if (type == 'array') {
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length);
      writeArrayToMemory(value, ret);
      return ret;
    }
    return value;
  }
  function fromC(value, type) {
    if (type == 'string') {
      return Pointer_stringify(value);
    }
    assert(type != 'array');
    return value;
  }
  var i = 0;
  var cArgs = args ? args.map(function(arg) {
    return toC(arg, argTypes[i++]);
  }) : [];
  var ret = fromC(func.apply(null, cArgs), returnType);
  if (stack) Runtime.stackRestore(stack);
  return ret;
}
// Returns a native JS wrapper for a C function. This is similar to ccall, but
// returns a function you can call repeatedly in a normal way. For example:
//
//   var my_function = cwrap('my_c_function', 'number', ['number', 'number']);
//   alert(my_function(5, 22));
//   alert(my_function(99, 12));
//
function cwrap(ident, returnType, argTypes) {
  var func = getCFunc(ident);
  return function() {
    return ccallFunc(func, returnType, argTypes, Array.prototype.slice.call(arguments));
  }
}
Module["cwrap"] = cwrap;
// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.
// Note that setValue and getValue only do *aligned* writes and reads!
// Note that ccall uses JS types as for defining types, while setValue and
// getValue need LLVM types ('i8', 'i32') - this is a lower-level operation
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[(ptr)]=value; break;
      case 'i8': HEAP8[(ptr)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;
// Parallel to setValue.
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[(ptr)];
      case 'i8': return HEAP8[(ptr)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;
var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;
// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }
  var singleType = typeof types === 'string' ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }
  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)|0)]=0;
    }
    return ret;
  }
  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }
  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];
    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later
    setValue(ret+i, curr, type);
    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }
  return ret;
}
Module['allocate'] = allocate;
function Pointer_stringify(ptr, /* optional */ length) {
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = false;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))|0)];
    if (t >= 128) hasUtf = true;
    else if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;
  var ret = '';
  if (!hasUtf) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  var utf8 = new Runtime.UTF8Processor();
  for (i = 0; i < length; i++) {
    t = HEAPU8[(((ptr)+(i))|0)];
    ret += utf8.processCChar(t);
  }
  return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;
// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.
function UTF16ToString(ptr) {
  var i = 0;
  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}
Module['UTF16ToString'] = UTF16ToString;
// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr', 
// null-terminated and encoded in UTF16LE form. The copy will require at most (str.length*2+1)*2 bytes of space in the HEAP.
function stringToUTF16(str, outPtr) {
  for(var i = 0; i < str.length; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[(((outPtr)+(i*2))>>1)]=codeUnit
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[(((outPtr)+(str.length*2))>>1)]=0
}
Module['stringToUTF16'] = stringToUTF16;
// Given a pointer 'ptr' to a null-terminated UTF32LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.
function UTF32ToString(ptr) {
  var i = 0;
  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
Module['UTF32ToString'] = UTF32ToString;
// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr', 
// null-terminated and encoded in UTF32LE form. The copy will require at most (str.length+1)*4 bytes of space in the HEAP,
// but can use less, since str.length does not return the number of characters in the string, but the number of UTF-16 code units in the string.
function stringToUTF32(str, outPtr) {
  var iChar = 0;
  for(var iCodeUnit = 0; iCodeUnit < str.length; ++iCodeUnit) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    var codeUnit = str.charCodeAt(iCodeUnit); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++iCodeUnit);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[(((outPtr)+(iChar*4))>>2)]=codeUnit
    ++iChar;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[(((outPtr)+(iChar*4))>>2)]=0
}
Module['stringToUTF32'] = stringToUTF32;
function demangle(func) {
  try {
    if (typeof func === 'number') func = Pointer_stringify(func);
    if (func[0] !== '_') return func;
    if (func[1] !== '_') return func; // C function
    if (func[2] !== 'Z') return func;
    switch (func[3]) {
      case 'n': return 'operator new()';
      case 'd': return 'operator delete()';
    }
    var i = 3;
    // params, etc.
    var basicTypes = {
      'v': 'void',
      'b': 'bool',
      'c': 'char',
      's': 'short',
      'i': 'int',
      'l': 'long',
      'f': 'float',
      'd': 'double',
      'w': 'wchar_t',
      'a': 'signed char',
      'h': 'unsigned char',
      't': 'unsigned short',
      'j': 'unsigned int',
      'm': 'unsigned long',
      'x': 'long long',
      'y': 'unsigned long long',
      'z': '...'
    };
    function dump(x) {
      //return;
      if (x) Module.print(x);
      Module.print(func);
      var pre = '';
      for (var a = 0; a < i; a++) pre += ' ';
      Module.print (pre + '^');
    }
    var subs = [];
    function parseNested() {
      i++;
      if (func[i] === 'K') i++; // ignore const
      var parts = [];
      while (func[i] !== 'E') {
        if (func[i] === 'S') { // substitution
          i++;
          var next = func.indexOf('_', i);
          var num = func.substring(i, next) || 0;
          parts.push(subs[num] || '?');
          i = next+1;
          continue;
        }
        if (func[i] === 'C') { // constructor
          parts.push(parts[parts.length-1]);
          i += 2;
          continue;
        }
        var size = parseInt(func.substr(i));
        var pre = size.toString().length;
        if (!size || !pre) { i--; break; } // counter i++ below us
        var curr = func.substr(i + pre, size);
        parts.push(curr);
        subs.push(curr);
        i += pre + size;
      }
      i++; // skip E
      return parts;
    }
    var first = true;
    function parse(rawList, limit, allowVoid) { // main parser
      limit = limit || Infinity;
      var ret = '', list = [];
      function flushList() {
        return '(' + list.join(', ') + ')';
      }
      var name;
      if (func[i] === 'N') {
        // namespaced N-E
        name = parseNested().join('::');
        limit--;
        if (limit === 0) return rawList ? [name] : name;
      } else {
        // not namespaced
        if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
        var size = parseInt(func.substr(i));
        if (size) {
          var pre = size.toString().length;
          name = func.substr(i + pre, size);
          i += pre + size;
        }
      }
      first = false;
      if (func[i] === 'I') {
        i++;
        var iList = parse(true);
        var iRet = parse(true, 1, true);
        ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
      } else {
        ret = name;
      }
      paramLoop: while (i < func.length && limit-- > 0) {
        //dump('paramLoop');
        var c = func[i++];
        if (c in basicTypes) {
          list.push(basicTypes[c]);
        } else {
          switch (c) {
            case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
            case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
            case 'L': { // literal
              i++; // skip basic type
              var end = func.indexOf('E', i);
              var size = end - i;
              list.push(func.substr(i, size));
              i += size + 2; // size + 'EE'
              break;
            }
            case 'A': { // array
              var size = parseInt(func.substr(i));
              i += size.toString().length;
              if (func[i] !== '_') throw '?';
              i++; // skip _
              list.push(parse(true, 1, true)[0] + ' [' + size + ']');
              break;
            }
            case 'E': break paramLoop;
            default: ret += '?' + c; break paramLoop;
          }
        }
      }
      if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
      return rawList ? list : ret + flushList();
    }
    return parse();
  } catch(e) {
    return func;
  }
}
function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}
function stackTrace() {
  var stack = new Error().stack;
  return stack ? demangleAll(stack) : '(no stack trace available)'; // Stack trace is not available at least on IE10 and Safari 6.
}
// Memory management
var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
  return (x+4095)&-4096;
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk
function enlargeMemory() {
  abort('Cannot enlarge memory arrays in asm.js. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value ' + TOTAL_MEMORY + ', or (2) set Module.TOTAL_MEMORY before the program runs.');
}
var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;
// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'Cannot fallback to non-typed array case: Code is too specialized');
var buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);
// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');
Module['HEAP'] = HEAP;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;
function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited
var runtimeInitialized = false;
function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
}
function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module['addOnPreRun'] = Module.addOnPreRun = addOnPreRun;
function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module['addOnInit'] = Module.addOnInit = addOnInit;
function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module['addOnPreMain'] = Module.addOnPreMain = addOnPreMain;
function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module['addOnExit'] = Module.addOnExit = addOnExit;
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module['addOnPostRun'] = Module.addOnPostRun = addOnPostRun;
// Tools
// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function
function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
  if (length) {
    ret.length = length;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;
// Write a Javascript array to somewhere in the heap
function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))|0)]=chr
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;
function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[(((buffer)+(i))|0)]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; i++) {
    HEAP8[(((buffer)+(i))|0)]=str.charCodeAt(i)
  }
  if (!dontAddNull) HEAP8[(((buffer)+(str.length))|0)]=0
}
Module['writeAsciiToMemory'] = writeAsciiToMemory;
function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore, sig) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}
if (!Math['imul']) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module['removeRunDependency'] = removeRunDependency;
Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data
var memoryInitializer = null;
// === Body ===
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 384;
/* global initializers */ __ATINIT__.push({ func: function() { runPostSets() } });
/* memory initializer */ allocate([104,101,120,50,98,105,110,32,115,116,114,32,116,114,117,110,99,97,116,101,100,0,0,0,103,230,9,106,133,174,103,187,114,243,110,60,58,245,79,165,127,82,14,81,140,104,5,155,171,217,131,31,25,205,224,91,104,101,120,50,98,105,110,32,115,115,99,97,110,102,32,39,37,115,39,32,102,97,105,108,101,100,10,0,0,0,0,0,37,120,0,0,0,0,0,0,37,48,50,120,0,0,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE)
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
assert(tempDoublePtr % 8 == 0);
function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}
function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}
  Module["_strlen"] = _strlen;
  function __reallyNegative(x) {
      return x < 0 || (x === 0 && (1/x) === -Infinity);
    }function __formatString(format, varargs) {
      var textIndex = format;
      var argIndex = 0;
      function getNextArg(type) {
        // NOTE: Explicitly ignoring type safety. Otherwise this fails:
        //       int x = 4; printf("%c\n", (char)x);
        var ret;
        if (type === 'double') {
          ret = HEAPF64[(((varargs)+(argIndex))>>3)];
        } else if (type == 'i64') {
          ret = [HEAP32[(((varargs)+(argIndex))>>2)],
                 HEAP32[(((varargs)+(argIndex+8))>>2)]];
          argIndex += 8; // each 32-bit chunk is in a 64-bit block
        } else {
          type = 'i32'; // varargs are always i32, i64, or double
          ret = HEAP32[(((varargs)+(argIndex))>>2)];
        }
        argIndex += Math.max(Runtime.getNativeFieldSize(type), Runtime.getAlignSize(type, null, true));
        return ret;
      }
      var ret = [];
      var curr, next, currArg;
      while(1) {
        var startTextIndex = textIndex;
        curr = HEAP8[(textIndex)];
        if (curr === 0) break;
        next = HEAP8[((textIndex+1)|0)];
        if (curr == 37) {
          // Handle flags.
          var flagAlwaysSigned = false;
          var flagLeftAlign = false;
          var flagAlternative = false;
          var flagZeroPad = false;
          var flagPadSign = false;
          flagsLoop: while (1) {
            switch (next) {
              case 43:
                flagAlwaysSigned = true;
                break;
              case 45:
                flagLeftAlign = true;
                break;
              case 35:
                flagAlternative = true;
                break;
              case 48:
                if (flagZeroPad) {
                  break flagsLoop;
                } else {
                  flagZeroPad = true;
                  break;
                }
              case 32:
                flagPadSign = true;
                break;
              default:
                break flagsLoop;
            }
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
          }
          // Handle width.
          var width = 0;
          if (next == 42) {
            width = getNextArg('i32');
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
          } else {
            while (next >= 48 && next <= 57) {
              width = width * 10 + (next - 48);
              textIndex++;
              next = HEAP8[((textIndex+1)|0)];
            }
          }
          // Handle precision.
          var precisionSet = false;
          if (next == 46) {
            var precision = 0;
            precisionSet = true;
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
            if (next == 42) {
              precision = getNextArg('i32');
              textIndex++;
            } else {
              while(1) {
                var precisionChr = HEAP8[((textIndex+1)|0)];
                if (precisionChr < 48 ||
                    precisionChr > 57) break;
                precision = precision * 10 + (precisionChr - 48);
                textIndex++;
              }
            }
            next = HEAP8[((textIndex+1)|0)];
          } else {
            var precision = 6; // Standard default.
          }
          // Handle integer sizes. WARNING: These assume a 32-bit architecture!
          var argSize;
          switch (String.fromCharCode(next)) {
            case 'h':
              var nextNext = HEAP8[((textIndex+2)|0)];
              if (nextNext == 104) {
                textIndex++;
                argSize = 1; // char (actually i32 in varargs)
              } else {
                argSize = 2; // short (actually i32 in varargs)
              }
              break;
            case 'l':
              var nextNext = HEAP8[((textIndex+2)|0)];
              if (nextNext == 108) {
                textIndex++;
                argSize = 8; // long long
              } else {
                argSize = 4; // long
              }
              break;
            case 'L': // long long
            case 'q': // int64_t
            case 'j': // intmax_t
              argSize = 8;
              break;
            case 'z': // size_t
            case 't': // ptrdiff_t
            case 'I': // signed ptrdiff_t or unsigned size_t
              argSize = 4;
              break;
            default:
              argSize = null;
          }
          if (argSize) textIndex++;
          next = HEAP8[((textIndex+1)|0)];
          // Handle type specifier.
          switch (String.fromCharCode(next)) {
            case 'd': case 'i': case 'u': case 'o': case 'x': case 'X': case 'p': {
              // Integer.
              var signed = next == 100 || next == 105;
              argSize = argSize || 4;
              var currArg = getNextArg('i' + (argSize * 8));
              var origArg = currArg;
              var argText;
              // Flatten i64-1 [low, high] into a (slightly rounded) double
              if (argSize == 8) {
                currArg = Runtime.makeBigInt(currArg[0], currArg[1], next == 117);
              }
              // Truncate to requested size.
              if (argSize <= 4) {
                var limit = Math.pow(256, argSize) - 1;
                currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
              }
              // Format the number.
              var currAbsArg = Math.abs(currArg);
              var prefix = '';
              if (next == 100 || next == 105) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], null); else
                argText = reSign(currArg, 8 * argSize, 1).toString(10);
              } else if (next == 117) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], true); else
                argText = unSign(currArg, 8 * argSize, 1).toString(10);
                currArg = Math.abs(currArg);
              } else if (next == 111) {
                argText = (flagAlternative ? '0' : '') + currAbsArg.toString(8);
              } else if (next == 120 || next == 88) {
                prefix = (flagAlternative && currArg != 0) ? '0x' : '';
                if (argSize == 8 && i64Math) {
                  if (origArg[1]) {
                    argText = (origArg[1]>>>0).toString(16);
                    var lower = (origArg[0]>>>0).toString(16);
                    while (lower.length < 8) lower = '0' + lower;
                    argText += lower;
                  } else {
                    argText = (origArg[0]>>>0).toString(16);
                  }
                } else
                if (currArg < 0) {
                  // Represent negative numbers in hex as 2's complement.
                  currArg = -currArg;
                  argText = (currAbsArg - 1).toString(16);
                  var buffer = [];
                  for (var i = 0; i < argText.length; i++) {
                    buffer.push((0xF - parseInt(argText[i], 16)).toString(16));
                  }
                  argText = buffer.join('');
                  while (argText.length < argSize * 2) argText = 'f' + argText;
                } else {
                  argText = currAbsArg.toString(16);
                }
                if (next == 88) {
                  prefix = prefix.toUpperCase();
                  argText = argText.toUpperCase();
                }
              } else if (next == 112) {
                if (currAbsArg === 0) {
                  argText = '(nil)';
                } else {
                  prefix = '0x';
                  argText = currAbsArg.toString(16);
                }
              }
              if (precisionSet) {
                while (argText.length < precision) {
                  argText = '0' + argText;
                }
              }
              // Add sign if needed
              if (currArg >= 0) {
                if (flagAlwaysSigned) {
                  prefix = '+' + prefix;
                } else if (flagPadSign) {
                  prefix = ' ' + prefix;
                }
              }
              // Move sign to prefix so we zero-pad after the sign
              if (argText.charAt(0) == '-') {
                prefix = '-' + prefix;
                argText = argText.substr(1);
              }
              // Add padding.
              while (prefix.length + argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad) {
                    argText = '0' + argText;
                  } else {
                    prefix = ' ' + prefix;
                  }
                }
              }
              // Insert the result into the buffer.
              argText = prefix + argText;
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': {
              // Float.
              var currArg = getNextArg('double');
              var argText;
              if (isNaN(currArg)) {
                argText = 'nan';
                flagZeroPad = false;
              } else if (!isFinite(currArg)) {
                argText = (currArg < 0 ? '-' : '') + 'inf';
                flagZeroPad = false;
              } else {
                var isGeneral = false;
                var effectivePrecision = Math.min(precision, 20);
                // Convert g/G to f/F or e/E, as per:
                // http://pubs.opengroup.org/onlinepubs/9699919799/functions/printf.html
                if (next == 103 || next == 71) {
                  isGeneral = true;
                  precision = precision || 1;
                  var exponent = parseInt(currArg.toExponential(effectivePrecision).split('e')[1], 10);
                  if (precision > exponent && exponent >= -4) {
                    next = ((next == 103) ? 'f' : 'F').charCodeAt(0);
                    precision -= exponent + 1;
                  } else {
                    next = ((next == 103) ? 'e' : 'E').charCodeAt(0);
                    precision--;
                  }
                  effectivePrecision = Math.min(precision, 20);
                }
                if (next == 101 || next == 69) {
                  argText = currArg.toExponential(effectivePrecision);
                  // Make sure the exponent has at least 2 digits.
                  if (/[eE][-+]\d$/.test(argText)) {
                    argText = argText.slice(0, -1) + '0' + argText.slice(-1);
                  }
                } else if (next == 102 || next == 70) {
                  argText = currArg.toFixed(effectivePrecision);
                  if (currArg === 0 && __reallyNegative(currArg)) {
                    argText = '-' + argText;
                  }
                }
                var parts = argText.split('e');
                if (isGeneral && !flagAlternative) {
                  // Discard trailing zeros and periods.
                  while (parts[0].length > 1 && parts[0].indexOf('.') != -1 &&
                         (parts[0].slice(-1) == '0' || parts[0].slice(-1) == '.')) {
                    parts[0] = parts[0].slice(0, -1);
                  }
                } else {
                  // Make sure we have a period in alternative mode.
                  if (flagAlternative && argText.indexOf('.') == -1) parts[0] += '.';
                  // Zero pad until required precision.
                  while (precision > effectivePrecision++) parts[0] += '0';
                }
                argText = parts[0] + (parts.length > 1 ? 'e' + parts[1] : '');
                // Capitalize 'E' if needed.
                if (next == 69) argText = argText.toUpperCase();
                // Add sign.
                if (currArg >= 0) {
                  if (flagAlwaysSigned) {
                    argText = '+' + argText;
                  } else if (flagPadSign) {
                    argText = ' ' + argText;
                  }
                }
              }
              // Add padding.
              while (argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad && (argText[0] == '-' || argText[0] == '+')) {
                    argText = argText[0] + '0' + argText.slice(1);
                  } else {
                    argText = (flagZeroPad ? '0' : ' ') + argText;
                  }
                }
              }
              // Adjust case.
              if (next < 97) argText = argText.toUpperCase();
              // Insert the result into the buffer.
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 's': {
              // String.
              var arg = getNextArg('i8*');
              var argLength = arg ? _strlen(arg) : '(null)'.length;
              if (precisionSet) argLength = Math.min(argLength, precision);
              if (!flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              if (arg) {
                for (var i = 0; i < argLength; i++) {
                  ret.push(HEAPU8[((arg++)|0)]);
                }
              } else {
                ret = ret.concat(intArrayFromString('(null)'.substr(0, argLength), true));
              }
              if (flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              break;
            }
            case 'c': {
              // Character.
              if (flagLeftAlign) ret.push(getNextArg('i8'));
              while (--width > 0) {
                ret.push(32);
              }
              if (!flagLeftAlign) ret.push(getNextArg('i8'));
              break;
            }
            case 'n': {
              // Write the length written so far to the next parameter.
              var ptr = getNextArg('i32*');
              HEAP32[((ptr)>>2)]=ret.length
              break;
            }
            case '%': {
              // Literal percent sign.
              ret.push(curr);
              break;
            }
            default: {
              // Unknown specifiers remain untouched.
              for (var i = startTextIndex; i < textIndex + 2; i++) {
                ret.push(HEAP8[(i)]);
              }
            }
          }
          textIndex += 2;
          // TODO: Support a/A (hex float) and m (last error) specifiers.
          // TODO: Support %1${specifier} for arg selection.
        } else {
          ret.push(curr);
          textIndex += 1;
        }
      }
      return ret;
    }function _snprintf(s, n, format, varargs) {
      // int snprintf(char *restrict s, size_t n, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var result = __formatString(format, varargs);
      var limit = (n === undefined) ? result.length
                                    : Math.min(result.length, Math.max(n - 1, 0));
      if (s < 0) {
        s = -s;
        var buf = _malloc(limit+1);
        HEAP32[((s)>>2)]=buf;
        s = buf;
      }
      for (var i = 0; i < limit; i++) {
        HEAP8[(((s)+(i))|0)]=result[i];
      }
      if (limit < n || (n === undefined)) HEAP8[(((s)+(i))|0)]=0;
      return result.length;
    }function _sprintf(s, format, varargs) {
      // int sprintf(char *restrict s, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      return _snprintf(s, undefined, format, varargs);
    }
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  var ___errno_state=0;function ___setErrNo(value) {
      // For convenient setting and returning of errno.
      HEAP32[((___errno_state)>>2)]=value
      return value;
    }
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            continue;
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          if (stream.tty.output.length) {
            stream.tty.ops.put_char(stream.tty, 10);
          }
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              result = process['stdin']['read']();
              if (!result) {
                if (process['stdin']['_readableState'] && process['stdin']['_readableState']['ended']) {
                  return null;  // EOF
                }
                return undefined;  // no data available
              }
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](tty.output.join(''));
            tty.output = [];
          } else {
            tty.output.push(TTY.utf8.processCChar(val));
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](tty.output.join(''));
            tty.output = [];
          } else {
            tty.output.push(TTY.utf8.processCChar(val));
          }
        }}};
  var MEMFS={ops_table:null,CONTENT_OWNING:1,CONTENT_FLEXIBLE:2,CONTENT_FIXED:3,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 0777, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            },
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.contents = [];
          node.contentMode = MEMFS.CONTENT_FLEXIBLE;
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },ensureFlexible:function (node) {
        if (node.contentMode !== MEMFS.CONTENT_FLEXIBLE) {
          var contents = node.contents;
          node.contents = Array.prototype.slice.call(contents);
          node.contentMode = MEMFS.CONTENT_FLEXIBLE;
        }
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.contents.length;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.ensureFlexible(node);
            var contents = node.contents;
            if (attr.size < contents.length) contents.length = attr.size;
            else while (attr.size > contents.length) contents.push(0);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 0777 | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else
          {
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          var node = stream.node;
          node.timestamp = Date.now();
          var contents = node.contents;
          if (length && contents.length === 0 && position === 0 && buffer.subarray) {
            // just replace it with the new data
            if (canOwn && offset === 0) {
              node.contents = buffer; // this could be a subarray of Emscripten HEAP, or allocated from some other source.
              node.contentMode = (buffer.buffer === HEAP8.buffer) ? MEMFS.CONTENT_OWNING : MEMFS.CONTENT_FIXED;
            } else {
              node.contents = new Uint8Array(buffer.subarray(offset, offset+length));
              node.contentMode = MEMFS.CONTENT_FIXED;
            }
            return length;
          }
          MEMFS.ensureFlexible(node);
          var contents = node.contents;
          while (contents.length < position) contents.push(0);
          for (var i = 0; i < length; i++) {
            contents[position + i] = buffer[offset + i];
          }
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.contents.length;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          stream.ungotten = [];
          stream.position = position;
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.ensureFlexible(stream.node);
          var contents = stream.node.contents;
          var limit = offset + length;
          while (limit > contents.length) contents.push(0);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        }}};
  var IDBFS={dbs:{},indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },reconcile:function (src, dst, callback) {
        var total = 0;
        var create = {};
        for (var key in src.files) {
          if (!src.files.hasOwnProperty(key)) continue;
          var e = src.files[key];
          var e2 = dst.files[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create[key] = e;
            total++;
          }
        }
        var remove = {};
        for (var key in dst.files) {
          if (!dst.files.hasOwnProperty(key)) continue;
          var e = dst.files[key];
          var e2 = src.files[key];
          if (!e2) {
            remove[key] = e;
            total++;
          }
        }
        if (!total) {
          // early out
          return callback(null);
        }
        var completed = 0;
        function done(err) {
          if (err) return callback(err);
          if (++completed >= total) {
            return callback(null);
          }
        };
        // create a single transaction to handle and IDB reads / writes we'll need to do
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        transaction.onerror = function transaction_onerror() { callback(this.error); };
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        for (var path in create) {
          if (!create.hasOwnProperty(path)) continue;
          var entry = create[path];
          if (dst.type === 'local') {
            // save file to local
            try {
              if (FS.isDir(entry.mode)) {
                FS.mkdir(path, entry.mode);
              } else if (FS.isFile(entry.mode)) {
                var stream = FS.open(path, 'w+', 0666);
                FS.write(stream, entry.contents, 0, entry.contents.length, 0, true /* canOwn */);
                FS.close(stream);
              }
              done(null);
            } catch (e) {
              return done(e);
            }
          } else {
            // save file to IDB
            var req = store.put(entry, path);
            req.onsuccess = function req_onsuccess() { done(null); };
            req.onerror = function req_onerror() { done(this.error); };
          }
        }
        for (var path in remove) {
          if (!remove.hasOwnProperty(path)) continue;
          var entry = remove[path];
          if (dst.type === 'local') {
            // delete file from local
            try {
              if (FS.isDir(entry.mode)) {
                // TODO recursive delete?
                FS.rmdir(path);
              } else if (FS.isFile(entry.mode)) {
                FS.unlink(path);
              }
              done(null);
            } catch (e) {
              return done(e);
            }
          } else {
            // delete file from IDB
            var req = store.delete(path);
            req.onsuccess = function req_onsuccess() { done(null); };
            req.onerror = function req_onerror() { done(this.error); };
          }
        }
      },getLocalSet:function (mount, callback) {
        var files = {};
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
        var check = FS.readdir(mount.mountpoint)
          .filter(isRealDir)
          .map(toAbsolute(mount.mountpoint));
        while (check.length) {
          var path = check.pop();
          var stat, node;
          try {
            var lookup = FS.lookupPath(path);
            node = lookup.node;
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path)
              .filter(isRealDir)
              .map(toAbsolute(path)));
            files[path] = { mode: stat.mode, timestamp: stat.mtime };
          } else if (FS.isFile(stat.mode)) {
            files[path] = { contents: node.contents, mode: stat.mode, timestamp: stat.mtime };
          } else {
            return callback(new Error('node type not supported'));
          }
        }
        return callback(null, { type: 'local', files: files });
      },getDB:function (name, callback) {
        // look it up in the cache
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        req.onupgradeneeded = function req_onupgradeneeded() {
          db = req.result;
          db.createObjectStore(IDBFS.DB_STORE_NAME);
        };
        req.onsuccess = function req_onsuccess() {
          db = req.result;
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function req_onerror() {
          callback(this.error);
        };
      },getRemoteSet:function (mount, callback) {
        var files = {};
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function transaction_onerror() { callback(this.error); };
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          store.openCursor().onsuccess = function store_openCursor_onsuccess(event) {
            var cursor = event.target.result;
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, files: files });
            }
            files[cursor.key] = cursor.value;
            cursor.continue();
          };
        });
      }};
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so 
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          return flags;
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          stream.position = position;
          return position;
        }}};
  var _stdin=allocate(1, "i32*", ALLOC_STATIC);
  var _stdout=allocate(1, "i32*", ALLOC_STATIC);
  var _stderr=allocate(1, "i32*", ALLOC_STATIC);
  function _fflush(stream) {
      // int fflush(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fflush.html
      // we don't currently perform any user-space buffering of data
    }var FS={root:null,mounts:[],devices:[null],streams:[null],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,ErrnoError:null,genericErrors:{},handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || { recurse_count: 0 };
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
        // start at the root
        var current = FS.root;
        var current_path = '/';
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            current = current.mount.root;
          }
          // follow symlinks
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
            this.parent = null;
            this.mount = null;
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            FS.hashAddNode(this);
          };
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
          FS.FSNode.prototype = {};
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); },
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); },
            },
          });
        }
        return new FS.FSNode(parent, name, mode, rdev);
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var accmode = flag & 2097155;
        var perms = ['r', 'w', 'rw'][accmode];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        return FS.nodePermissions(dir, 'x');
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if ((flags & 2097155) !== 0 ||  // opening for write
              (flags & 512)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 1;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        if (stream.__proto__) {
          // reuse the object
          stream.__proto__ = FS.FSStream.prototype;
        } else {
          var newStream = new FS.FSStream();
          for (var p in stream) {
            newStream[p] = stream[p];
          }
          stream = newStream;
        }
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
        var completed = 0;
        var total = FS.mounts.length;
        function done(err) {
          if (err) {
            return callback(err);
          }
          if (++completed >= total) {
            callback(null);
          }
        };
        // sync all mounts
        for (var i = 0; i < FS.mounts.length; i++) {
          var mount = FS.mounts[i];
          if (!mount.type.syncfs) {
            done(null);
            continue;
          }
          mount.type.syncfs(mount, populate, done);
        }
      },mount:function (type, opts, mountpoint) {
        var lookup;
        if (mountpoint) {
          lookup = FS.lookupPath(mountpoint, { follow: false });
          mountpoint = lookup.path;  // use the absolute path
        }
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          root: null
        };
        // create a root node for the fs
        var root = type.mount(mount);
        root.mount = mount;
        mount.root = root;
        // assign the mount info to the mountpoint's node
        if (lookup) {
          lookup.node.mount = mount;
          lookup.node.mounted = true;
          // compatibility update FS.root if we mount to /
          if (mountpoint === '/') {
            FS.root = mount.root;
          }
        }
        // add to our cached list of mounts
        FS.mounts.push(mount);
        return root;
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 0666;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 0777;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 0666;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // POSIX says unlink should set EPERM, not EISDIR
          if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },readlink:function (path) {
        var lookup = FS.lookupPath(path, { follow: false });
        var link = lookup.node;
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return link.node_ops.readlink(link);
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 0666 : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // check permissions
        var err = FS.mayOpen(node, flags);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        return stream;
      },close:function (stream) {
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        return stream.stream_ops.llseek(stream, offset, whence);
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.errnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = '';
          var utf8 = new Runtime.UTF8Processor();
          for (var i = 0; i < length; i++) {
            ret += utf8.processCChar(buf[i]);
          }
        } else if (opts.encoding === 'binary') {
          ret = buf;
        } else {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var utf8 = new Runtime.UTF8Processor();
          var buf = new Uint8Array(utf8.processJSString(data));
          FS.write(stream, buf, 0, buf.length, 0);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0);
        } else {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function() { return 0; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        HEAP32[((_stdin)>>2)]=stdin.fd;
        assert(stdin.fd === 1, 'invalid handle for stdin (' + stdin.fd + ')');
        var stdout = FS.open('/dev/stdout', 'w');
        HEAP32[((_stdout)>>2)]=stdout.fd;
        assert(stdout.fd === 2, 'invalid handle for stdout (' + stdout.fd + ')');
        var stderr = FS.open('/dev/stderr', 'w');
        HEAP32[((_stderr)>>2)]=stderr.fd;
        assert(stderr.fd === 3, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno) {
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break;
            }
          }
          this.message = ERRNO_MESSAGES[errno];
          this.stack = stackTrace();
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
        FS.nameTable = new Array(4096);
        FS.root = FS.createNode(null, '/', 16384 | 0777, 0);
        FS.mount(MEMFS, {}, '/');
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
        FS.ensureErrnoError();
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []; // Loaded chunks. Index is the chunk number
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = Math.floor(idx / this.chunkSize);
            return this.getter(chunkNum)[chunkOffset];
          }
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
          }
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
              // Find length
              var xhr = new XMLHttpRequest();
              xhr.open('HEAD', url, false);
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
              var datalength = Number(xhr.getResponseHeader("Content-length"));
              var header;
              var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
              var chunkSize = 1024*1024; // Chunk size in bytes
              if (!hasByteServing) chunkSize = datalength;
              // Function to get a range from the remote URL.
              var doXHR = (function(from, to) {
                if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
                // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                // Some hints to the browser that we want binary data.
                if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
                if (xhr.overrideMimeType) {
                  xhr.overrideMimeType('text/plain; charset=x-user-defined');
                }
                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                if (xhr.response !== undefined) {
                  return new Uint8Array(xhr.response || []);
                } else {
                  return intArrayFromString(xhr.responseText || '', true);
                }
              });
              var lazyArray = this;
              lazyArray.setDataGetter(function(chunkNum) {
                var start = chunkNum * chunkSize;
                var end = (chunkNum+1) * chunkSize - 1; // including this byte
                end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
                  lazyArray.chunks[chunkNum] = doXHR(start, end);
                }
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
                return lazyArray.chunks[chunkNum];
              });
              this._length = datalength;
              this._chunkSize = chunkSize;
              this.lengthKnown = true;
          }
          var lazyArray = new LazyUint8Array();
          Object.defineProperty(lazyArray, "length", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._length;
              }
          });
          Object.defineProperty(lazyArray, "chunkSize", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._chunkSize;
              }
          });
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn) {
        Browser.init();
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        function processData(byteArray) {
          function finish(byteArray) {
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency('cp ' + fullname);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency('cp ' + fullname);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency('cp ' + fullname);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};
  var SOCKFS={mount:function (mount) {
        return FS.createNode(null, '/', 16384 | 0777, 0);
      },createSocket:function (family, type, protocol) {
        var streaming = type == 1;
        if (protocol) {
          assert(streaming == (protocol == 6)); // if SOCK_STREAM, must be tcp
        }
        // create our internal socket structure
        var sock = {
          family: family,
          type: type,
          protocol: protocol,
          server: null,
          peers: {},
          pending: [],
          recv_queue: [],
          sock_ops: SOCKFS.websocket_sock_ops
        };
        // create the filesystem node to store the socket structure
        var name = SOCKFS.nextname();
        var node = FS.createNode(SOCKFS.root, name, 49152, 0);
        node.sock = sock;
        // and the wrapping stream that enables library functions such
        // as read and write to indirectly interact with the socket
        var stream = FS.createStream({
          path: name,
          node: node,
          flags: FS.modeStringToFlags('r+'),
          seekable: false,
          stream_ops: SOCKFS.stream_ops
        });
        // map the new stream to the socket structure (sockets have a 1:1
        // relationship with a stream)
        sock.stream = stream;
        return sock;
      },getSocket:function (fd) {
        var stream = FS.getStream(fd);
        if (!stream || !FS.isSocket(stream.node.mode)) {
          return null;
        }
        return stream.node.sock;
      },stream_ops:{poll:function (stream) {
          var sock = stream.node.sock;
          return sock.sock_ops.poll(sock);
        },ioctl:function (stream, request, varargs) {
          var sock = stream.node.sock;
          return sock.sock_ops.ioctl(sock, request, varargs);
        },read:function (stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          var msg = sock.sock_ops.recvmsg(sock, length);
          if (!msg) {
            // socket is closed
            return 0;
          }
          buffer.set(msg.buffer, offset);
          return msg.buffer.length;
        },write:function (stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          return sock.sock_ops.sendmsg(sock, buffer, offset, length);
        },close:function (stream) {
          var sock = stream.node.sock;
          sock.sock_ops.close(sock);
        }},nextname:function () {
        if (!SOCKFS.nextname.current) {
          SOCKFS.nextname.current = 0;
        }
        return 'socket[' + (SOCKFS.nextname.current++) + ']';
      },websocket_sock_ops:{createPeer:function (sock, addr, port) {
          var ws;
          if (typeof addr === 'object') {
            ws = addr;
            addr = null;
            port = null;
          }
          if (ws) {
            // for sockets that've already connected (e.g. we're the server)
            // we can inspect the _socket property for the address
            if (ws._socket) {
              addr = ws._socket.remoteAddress;
              port = ws._socket.remotePort;
            }
            // if we're just now initializing a connection to the remote,
            // inspect the url property
            else {
              var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
              if (!result) {
                throw new Error('WebSocket URL must be in the format ws(s)://address:port');
              }
              addr = result[1];
              port = parseInt(result[2], 10);
            }
          } else {
            // create the actual websocket object and connect
            try {
              var url = 'ws://' + addr + ':' + port;
              // the node ws library API is slightly different than the browser's
              var opts = ENVIRONMENT_IS_NODE ? {headers: {'websocket-protocol': ['binary']}} : ['binary'];
              // If node we use the ws library.
              var WebSocket = ENVIRONMENT_IS_NODE ? require('ws') : window['WebSocket'];
              ws = new WebSocket(url, opts);
              ws.binaryType = 'arraybuffer';
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
            }
          }
          var peer = {
            addr: addr,
            port: port,
            socket: ws,
            dgram_send_queue: []
          };
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
          // if this is a bound dgram socket, send the port number first to allow
          // us to override the ephemeral port reported to us by remotePort on the
          // remote end.
          if (sock.type === 2 && typeof sock.sport !== 'undefined') {
            peer.dgram_send_queue.push(new Uint8Array([
                255, 255, 255, 255,
                'p'.charCodeAt(0), 'o'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0),
                ((sock.sport & 0xff00) >> 8) , (sock.sport & 0xff)
            ]));
          }
          return peer;
        },getPeer:function (sock, addr, port) {
          return sock.peers[addr + ':' + port];
        },addPeer:function (sock, peer) {
          sock.peers[peer.addr + ':' + peer.port] = peer;
        },removePeer:function (sock, peer) {
          delete sock.peers[peer.addr + ':' + peer.port];
        },handlePeerEvents:function (sock, peer) {
          var first = true;
          var handleOpen = function () {
            try {
              var queued = peer.dgram_send_queue.shift();
              while (queued) {
                peer.socket.send(queued);
                queued = peer.dgram_send_queue.shift();
              }
            } catch (e) {
              // not much we can do here in the way of proper error handling as we've already
              // lied and said this data was sent. shut it down.
              peer.socket.close();
            }
          };
          function handleMessage(data) {
            assert(typeof data !== 'string' && data.byteLength !== undefined);  // must receive an ArrayBuffer
            data = new Uint8Array(data);  // make a typed array view on the array buffer
            // if this is the port message, override the peer's port with it
            var wasfirst = first;
            first = false;
            if (wasfirst &&
                data.length === 10 &&
                data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 &&
                data[4] === 'p'.charCodeAt(0) && data[5] === 'o'.charCodeAt(0) && data[6] === 'r'.charCodeAt(0) && data[7] === 't'.charCodeAt(0)) {
              // update the peer's port and it's key in the peer map
              var newport = ((data[8] << 8) | data[9]);
              SOCKFS.websocket_sock_ops.removePeer(sock, peer);
              peer.port = newport;
              SOCKFS.websocket_sock_ops.addPeer(sock, peer);
              return;
            }
            sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
          };
          if (ENVIRONMENT_IS_NODE) {
            peer.socket.on('open', handleOpen);
            peer.socket.on('message', function(data, flags) {
              if (!flags.binary) {
                return;
              }
              handleMessage((new Uint8Array(data)).buffer);  // copy from node Buffer -> ArrayBuffer
            });
            peer.socket.on('error', function() {
              // don't throw
            });
          } else {
            peer.socket.onopen = handleOpen;
            peer.socket.onmessage = function peer_socket_onmessage(event) {
              handleMessage(event.data);
            };
          }
        },poll:function (sock) {
          if (sock.type === 1 && sock.server) {
            // listen sockets should only say they're available for reading
            // if there are pending clients.
            return sock.pending.length ? (64 | 1) : 0;
          }
          var mask = 0;
          var dest = sock.type === 1 ?  // we only care about the socket state for connection-based sockets
            SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) :
            null;
          if (sock.recv_queue.length ||
              !dest ||  // connection-less sockets are always ready to read
              (dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {  // let recv return 0 once closed
            mask |= (64 | 1);
          }
          if (!dest ||  // connection-less sockets are always ready to write
              (dest && dest.socket.readyState === dest.socket.OPEN)) {
            mask |= 4;
          }
          if ((dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {
            mask |= 16;
          }
          return mask;
        },ioctl:function (sock, request, arg) {
          switch (request) {
            case 21531:
              var bytes = 0;
              if (sock.recv_queue.length) {
                bytes = sock.recv_queue[0].data.length;
              }
              HEAP32[((arg)>>2)]=bytes;
              return 0;
            default:
              return ERRNO_CODES.EINVAL;
          }
        },close:function (sock) {
          // if we've spawned a listen server, close it
          if (sock.server) {
            try {
              sock.server.close();
            } catch (e) {
            }
            sock.server = null;
          }
          // close any peer connections
          var peers = Object.keys(sock.peers);
          for (var i = 0; i < peers.length; i++) {
            var peer = sock.peers[peers[i]];
            try {
              peer.socket.close();
            } catch (e) {
            }
            SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          }
          return 0;
        },bind:function (sock, addr, port) {
          if (typeof sock.saddr !== 'undefined' || typeof sock.sport !== 'undefined') {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already bound
          }
          sock.saddr = addr;
          sock.sport = port || _mkport();
          // in order to emulate dgram sockets, we need to launch a listen server when
          // binding on a connection-less socket
          // note: this is only required on the server side
          if (sock.type === 2) {
            // close the existing server if it exists
            if (sock.server) {
              sock.server.close();
              sock.server = null;
            }
            // swallow error operation not supported error that occurs when binding in the
            // browser where this isn't supported
            try {
              sock.sock_ops.listen(sock, 0);
            } catch (e) {
              if (!(e instanceof FS.ErrnoError)) throw e;
              if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e;
            }
          }
        },connect:function (sock, addr, port) {
          if (sock.server) {
            throw new FS.ErrnoError(ERRNO_CODS.EOPNOTSUPP);
          }
          // TODO autobind
          // if (!sock.addr && sock.type == 2) {
          // }
          // early out if we're already connected / in the middle of connecting
          if (typeof sock.daddr !== 'undefined' && typeof sock.dport !== 'undefined') {
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
            if (dest) {
              if (dest.socket.readyState === dest.socket.CONNECTING) {
                throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
              } else {
                throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
              }
            }
          }
          // add the socket to our peer list and set our
          // destination address / port to match
          var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          sock.daddr = peer.addr;
          sock.dport = peer.port;
          // always "fail" in non-blocking mode
          throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        },listen:function (sock, backlog) {
          if (!ENVIRONMENT_IS_NODE) {
            throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
          }
          if (sock.server) {
             throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already listening
          }
          var WebSocketServer = require('ws').Server;
          var host = sock.saddr;
          sock.server = new WebSocketServer({
            host: host,
            port: sock.sport
            // TODO support backlog
          });
          sock.server.on('connection', function(ws) {
            if (sock.type === 1) {
              var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
              // create a peer on the new socket
              var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
              newsock.daddr = peer.addr;
              newsock.dport = peer.port;
              // push to queue for accept to pick up
              sock.pending.push(newsock);
            } else {
              // create a peer on the listen socket so calling sendto
              // with the listen socket and an address will resolve
              // to the correct client
              SOCKFS.websocket_sock_ops.createPeer(sock, ws);
            }
          });
          sock.server.on('closed', function() {
            sock.server = null;
          });
          sock.server.on('error', function() {
            // don't throw
          });
        },accept:function (listensock) {
          if (!listensock.server) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          var newsock = listensock.pending.shift();
          newsock.stream.flags = listensock.stream.flags;
          return newsock;
        },getname:function (sock, peer) {
          var addr, port;
          if (peer) {
            if (sock.daddr === undefined || sock.dport === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            }
            addr = sock.daddr;
            port = sock.dport;
          } else {
            // TODO saddr and sport will be set for bind()'d UDP sockets, but what
            // should we be returning for TCP sockets that've been connect()'d?
            addr = sock.saddr || 0;
            port = sock.sport || 0;
          }
          return { addr: addr, port: port };
        },sendmsg:function (sock, buffer, offset, length, addr, port) {
          if (sock.type === 2) {
            // connection-less sockets will honor the message address,
            // and otherwise fall back to the bound destination address
            if (addr === undefined || port === undefined) {
              addr = sock.daddr;
              port = sock.dport;
            }
            // if there was no address to fall back to, error out
            if (addr === undefined || port === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
            }
          } else {
            // connection-based sockets will only use the bound
            addr = sock.daddr;
            port = sock.dport;
          }
          // find the peer for the destination address
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
          // early out if not connected with a connection-based socket
          if (sock.type === 1) {
            if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            } else if (dest.socket.readyState === dest.socket.CONNECTING) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
          // create a copy of the incoming data to send, as the WebSocket API
          // doesn't work entirely with an ArrayBufferView, it'll just send
          // the entire underlying buffer
          var data;
          if (buffer instanceof Array || buffer instanceof ArrayBuffer) {
            data = buffer.slice(offset, offset + length);
          } else {  // ArrayBufferView
            data = buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + offset + length);
          }
          // if we're emulating a connection-less dgram socket and don't have
          // a cached connection, queue the buffer to send upon connect and
          // lie, saying the data was sent now.
          if (sock.type === 2) {
            if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
              // if we're not connected, open a new connection
              if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
              }
              dest.dgram_send_queue.push(data);
              return length;
            }
          }
          try {
            // send the actual data
            dest.socket.send(data);
            return length;
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
        },recvmsg:function (sock, length) {
          // http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
          if (sock.type === 1 && sock.server) {
            // tcp servers should not be recv()'ing on the listen socket
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          }
          var queued = sock.recv_queue.shift();
          if (!queued) {
            if (sock.type === 1) {
              var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
              if (!dest) {
                // if we have a destination address but are not connected, error out
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
              }
              else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                // return null if the socket has closed
                return null;
              }
              else {
                // else, our socket is in a valid state but truly has nothing available
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
            } else {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
          // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
          // requeued TCP data it'll be an ArrayBufferView
          var queuedLength = queued.data.byteLength || queued.data.length;
          var queuedOffset = queued.data.byteOffset || 0;
          var queuedBuffer = queued.data.buffer || queued.data;
          var bytesRead = Math.min(length, queuedLength);
          var res = {
            buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
            addr: queued.addr,
            port: queued.port
          };
          // push back any unread data for TCP connections
          if (sock.type === 1 && bytesRead < queuedLength) {
            var bytesRemaining = queuedLength - bytesRead;
            queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
            sock.recv_queue.unshift(queued);
          }
          return res;
        }}};function _send(fd, buf, len, flags) {
      var sock = SOCKFS.getSocket(fd);
      if (!sock) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      // TODO honor flags
      return _write(fd, buf, len);
    }
  function _pwrite(fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte, offset);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }function _write(fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }function _fwrite(ptr, size, nitems, stream) {
      // size_t fwrite(const void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fwrite.html
      var bytesToWrite = nitems * size;
      if (bytesToWrite == 0) return 0;
      var bytesWritten = _write(stream, ptr, bytesToWrite);
      if (bytesWritten == -1) {
        var streamObj = FS.getStream(stream);
        if (streamObj) streamObj.error = true;
        return 0;
      } else {
        return Math.floor(bytesWritten / size);
      }
    }function _fprintf(stream, format, varargs) {
      // int fprintf(FILE *restrict stream, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var result = __formatString(format, varargs);
      var stack = Runtime.stackSave();
      var ret = _fwrite(allocate(result, 'i8', ALLOC_STACK), 1, result.length, stream);
      Runtime.stackRestore(stack);
      return ret;
    }function _printf(format, varargs) {
      // int printf(const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var stdout = HEAP32[((_stdout)>>2)];
      return _fprintf(stdout, format, varargs);
    }
  function __getFloat(text) {
      return /^[+-]?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/.exec(text);
    }function __scanString(format, get, unget, varargs) {
      if (!__scanString.whiteSpace) {
        __scanString.whiteSpace = {};
        __scanString.whiteSpace[32] = 1;
        __scanString.whiteSpace[9] = 1;
        __scanString.whiteSpace[10] = 1;
        __scanString.whiteSpace[11] = 1;
        __scanString.whiteSpace[12] = 1;
        __scanString.whiteSpace[13] = 1;
      }
      // Supports %x, %4x, %d.%d, %lld, %s, %f, %lf.
      // TODO: Support all format specifiers.
      format = Pointer_stringify(format);
      var soFar = 0;
      if (format.indexOf('%n') >= 0) {
        // need to track soFar
        var _get = get;
        get = function get() {
          soFar++;
          return _get();
        }
        var _unget = unget;
        unget = function unget() {
          soFar--;
          return _unget();
        }
      }
      var formatIndex = 0;
      var argsi = 0;
      var fields = 0;
      var argIndex = 0;
      var next;
      mainLoop:
      for (var formatIndex = 0; formatIndex < format.length;) {
        if (format[formatIndex] === '%' && format[formatIndex+1] == 'n') {
          var argPtr = HEAP32[(((varargs)+(argIndex))>>2)];
          argIndex += Runtime.getAlignSize('void*', null, true);
          HEAP32[((argPtr)>>2)]=soFar;
          formatIndex += 2;
          continue;
        }
        if (format[formatIndex] === '%') {
          var nextC = format.indexOf('c', formatIndex+1);
          if (nextC > 0) {
            var maxx = 1;
            if (nextC > formatIndex+1) {
              var sub = format.substring(formatIndex+1, nextC);
              maxx = parseInt(sub);
              if (maxx != sub) maxx = 0;
            }
            if (maxx) {
              var argPtr = HEAP32[(((varargs)+(argIndex))>>2)];
              argIndex += Runtime.getAlignSize('void*', null, true);
              fields++;
              for (var i = 0; i < maxx; i++) {
                next = get();
                HEAP8[((argPtr++)|0)]=next;
              }
              formatIndex += nextC - formatIndex + 1;
              continue;
            }
          }
        }
        // handle %[...]
        if (format[formatIndex] === '%' && format.indexOf('[', formatIndex+1) > 0) {
          var match = /\%([0-9]*)\[(\^)?(\]?[^\]]*)\]/.exec(format.substring(formatIndex));
          if (match) {
            var maxNumCharacters = parseInt(match[1]) || Infinity;
            var negateScanList = (match[2] === '^');
            var scanList = match[3];
            // expand "middle" dashs into character sets
            var middleDashMatch;
            while ((middleDashMatch = /([^\-])\-([^\-])/.exec(scanList))) {
              var rangeStartCharCode = middleDashMatch[1].charCodeAt(0);
              var rangeEndCharCode = middleDashMatch[2].charCodeAt(0);
              for (var expanded = ''; rangeStartCharCode <= rangeEndCharCode; expanded += String.fromCharCode(rangeStartCharCode++));
              scanList = scanList.replace(middleDashMatch[1] + '-' + middleDashMatch[2], expanded);
            }
            var argPtr = HEAP32[(((varargs)+(argIndex))>>2)];
            argIndex += Runtime.getAlignSize('void*', null, true);
            fields++;
            for (var i = 0; i < maxNumCharacters; i++) {
              next = get();
              if (negateScanList) {
                if (scanList.indexOf(String.fromCharCode(next)) < 0) {
                  HEAP8[((argPtr++)|0)]=next;
                } else {
                  unget();
                  break;
                }
              } else {
                if (scanList.indexOf(String.fromCharCode(next)) >= 0) {
                  HEAP8[((argPtr++)|0)]=next;
                } else {
                  unget();
                  break;
                }
              }
            }
            // write out null-terminating character
            HEAP8[((argPtr++)|0)]=0;
            formatIndex += match[0].length;
            continue;
          }
        }      
        // remove whitespace
        while (1) {
          next = get();
          if (next == 0) return fields;
          if (!(next in __scanString.whiteSpace)) break;
        }
        unget();
        if (format[formatIndex] === '%') {
          formatIndex++;
          var suppressAssignment = false;
          if (format[formatIndex] == '*') {
            suppressAssignment = true;
            formatIndex++;
          }
          var maxSpecifierStart = formatIndex;
          while (format[formatIndex].charCodeAt(0) >= 48 &&
                 format[formatIndex].charCodeAt(0) <= 57) {
            formatIndex++;
          }
          var max_;
          if (formatIndex != maxSpecifierStart) {
            max_ = parseInt(format.slice(maxSpecifierStart, formatIndex), 10);
          }
          var long_ = false;
          var half = false;
          var longLong = false;
          if (format[formatIndex] == 'l') {
            long_ = true;
            formatIndex++;
            if (format[formatIndex] == 'l') {
              longLong = true;
              formatIndex++;
            }
          } else if (format[formatIndex] == 'h') {
            half = true;
            formatIndex++;
          }
          var type = format[formatIndex];
          formatIndex++;
          var curr = 0;
          var buffer = [];
          // Read characters according to the format. floats are trickier, they may be in an unfloat state in the middle, then be a valid float later
          if (type == 'f' || type == 'e' || type == 'g' ||
              type == 'F' || type == 'E' || type == 'G') {
            next = get();
            while (next > 0 && (!(next in __scanString.whiteSpace)))  {
              buffer.push(String.fromCharCode(next));
              next = get();
            }
            var m = __getFloat(buffer.join(''));
            var last = m ? m[0].length : 0;
            for (var i = 0; i < buffer.length - last + 1; i++) {
              unget();
            }
            buffer.length = last;
          } else {
            next = get();
            var first = true;
            // Strip the optional 0x prefix for %x.
            if ((type == 'x' || type == 'X') && (next == 48)) {
              var peek = get();
              if (peek == 120 || peek == 88) {
                next = get();
              } else {
                unget();
              }
            }
            while ((curr < max_ || isNaN(max_)) && next > 0) {
              if (!(next in __scanString.whiteSpace) && // stop on whitespace
                  (type == 's' ||
                   ((type === 'd' || type == 'u' || type == 'i') && ((next >= 48 && next <= 57) ||
                                                                     (first && next == 45))) ||
                   ((type === 'x' || type === 'X') && (next >= 48 && next <= 57 ||
                                     next >= 97 && next <= 102 ||
                                     next >= 65 && next <= 70))) &&
                  (formatIndex >= format.length || next !== format[formatIndex].charCodeAt(0))) { // Stop when we read something that is coming up
                buffer.push(String.fromCharCode(next));
                next = get();
                curr++;
                first = false;
              } else {
                break;
              }
            }
            unget();
          }
          if (buffer.length === 0) return 0;  // Failure.
          if (suppressAssignment) continue;
          var text = buffer.join('');
          var argPtr = HEAP32[(((varargs)+(argIndex))>>2)];
          argIndex += Runtime.getAlignSize('void*', null, true);
          switch (type) {
            case 'd': case 'u': case 'i':
              if (half) {
                HEAP16[((argPtr)>>1)]=parseInt(text, 10);
              } else if (longLong) {
                (tempI64 = [parseInt(text, 10)>>>0,(tempDouble=parseInt(text, 10),(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((argPtr)>>2)]=tempI64[0],HEAP32[(((argPtr)+(4))>>2)]=tempI64[1]);
              } else {
                HEAP32[((argPtr)>>2)]=parseInt(text, 10);
              }
              break;
            case 'X':
            case 'x':
              HEAP32[((argPtr)>>2)]=parseInt(text, 16)
              break;
            case 'F':
            case 'f':
            case 'E':
            case 'e':
            case 'G':
            case 'g':
            case 'E':
              // fallthrough intended
              if (long_) {
                HEAPF64[((argPtr)>>3)]=parseFloat(text)
              } else {
                HEAPF32[((argPtr)>>2)]=parseFloat(text)
              }
              break;
            case 's':
              var array = intArrayFromString(text);
              for (var j = 0; j < array.length; j++) {
                HEAP8[(((argPtr)+(j))|0)]=array[j]
              }
              break;
          }
          fields++;
        } else if (format[formatIndex].charCodeAt(0) in __scanString.whiteSpace) {
          next = get();
          while (next in __scanString.whiteSpace) {
            if (next <= 0) break mainLoop;  // End of input.
            next = get();
          }
          unget(next);
          formatIndex++;
        } else {
          // Not a specifier.
          next = get();
          if (format[formatIndex].charCodeAt(0) !== next) {
            unget(next);
            break mainLoop;
          }
          formatIndex++;
        }
      }
      return fields;
    }function _sscanf(s, format, varargs) {
      // int sscanf(const char *restrict s, const char *restrict format, ... );
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/scanf.html
      var index = 0;
      function get() { return HEAP8[(((s)+(index++))|0)]; };
      function unget() { index--; };
      return __scanString(format, get, unget, varargs);
    }
  Module["_memset"] = _memset;var _llvm_memset_p0i8_i32=_memset;
  Module["_memcpy"] = _memcpy;var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;
  function _llvm_bswap_i32(x) {
      return ((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24);
    }
  function _fputs(s, stream) {
      // int fputs(const char *restrict s, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputs.html
      return _write(stream, s, _strlen(s));
    }
  function _fputc(c, stream) {
      // int fputc(int c, FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputc.html
      var chr = unSign(c & 0xFF);
      HEAP8[((_fputc.ret)|0)]=chr
      var ret = _write(stream, _fputc.ret, 1);
      if (ret == -1) {
        var streamObj = FS.getStream(stream);
        if (streamObj) streamObj.error = true;
        return -1;
      } else {
        return chr;
      }
    }function _puts(s) {
      // int puts(const char *s);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/puts.html
      // NOTE: puts() always writes an extra newline.
      var stdout = HEAP32[((_stdout)>>2)];
      var ret = _fputs(s, stdout);
      if (ret < 0) {
        return ret;
      } else {
        var newlineRet = _fputc(10, stdout);
        return (newlineRet < 0) ? -1 : ret + 1;
      }
    }
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  Module["_malloc"] = _malloc;
  function _free() {
  }
  Module["_free"] = _free;
  var Browser={mainLoop:{scheduler:null,shouldPause:false,paused:false,queue:[],pause:function () {
          Browser.mainLoop.shouldPause = true;
        },resume:function () {
          if (Browser.mainLoop.paused) {
            Browser.mainLoop.paused = false;
            Browser.mainLoop.scheduler();
          }
          Browser.mainLoop.shouldPause = false;
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
        if (Browser.initted || ENVIRONMENT_IS_WORKER) return;
        Browser.initted = true;
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
        // Canvas event setup
        var canvas = Module['canvas'];
        canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                    canvas['mozRequestPointerLock'] ||
                                    canvas['webkitRequestPointerLock'];
        canvas.exitPointerLock = document['exitPointerLock'] ||
                                 document['mozExitPointerLock'] ||
                                 document['webkitExitPointerLock'] ||
                                 function(){}; // no-op if function does not exist
        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas;
        }
        document.addEventListener('pointerlockchange', pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
        if (Module['elementPointerLock']) {
          canvas.addEventListener("click", function(ev) {
            if (!Browser.pointerLock && canvas.requestPointerLock) {
              canvas.requestPointerLock();
              ev.preventDefault();
            }
          }, false);
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        var ctx;
        try {
          if (useWebGL) {
            var contextAttributes = {
              antialias: false,
              alpha: false
            };
            if (webGLContextAttributes) {
              for (var attribute in webGLContextAttributes) {
                contextAttributes[attribute] = webGLContextAttributes[attribute];
              }
            }
            ['experimental-webgl', 'webgl'].some(function(webglId) {
              return ctx = canvas.getContext(webglId, contextAttributes);
            });
          } else {
            ctx = canvas.getContext('2d');
          }
          if (!ctx) throw ':(';
        } catch (e) {
          Module.print('Could not create canvas - ' + e);
          return null;
        }
        if (useWebGL) {
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
          // Warn on context loss
          canvas.addEventListener('webglcontextlost', function(event) {
            alert('WebGL context lost. You will need to reload the page.');
          }, false);
        }
        if (setInModule) {
          Module.ctx = ctx;
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement']) === canvas) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'];
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else if (Browser.resizeCanvas){
            Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
        }
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
        }
        canvas.requestFullScreen = canvas['requestFullScreen'] ||
                                   canvas['mozRequestFullScreen'] ||
                                   (canvas['webkitRequestFullScreen'] ? function() { canvas['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
        canvas.requestFullScreen();
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          setTimeout(func, 1000/60);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           window['setTimeout'];
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (!ABORT) func();
        });
      },safeSetTimeout:function (func, timeout) {
        return setTimeout(function() {
          if (!ABORT) func();
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        return setInterval(function() {
          if (!ABORT) func();
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var x, y;
          if (event.type == 'touchstart' ||
              event.type == 'touchend' ||
              event.type == 'touchmove') {
            var t = event.touches.item(0);
            if (t) {
              x = t.pageX - (window.scrollX + rect.left);
              y = t.pageY - (window.scrollY + rect.top);
            } else {
              return;
            }
          } else {
            x = event.pageX - (window.scrollX + rect.left);
            y = event.pageY - (window.scrollY + rect.top);
          }
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        canvas.width = width;
        canvas.height = height;
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        var canvas = Module['canvas'];
        this.windowedWidth = canvas.width;
        this.windowedHeight = canvas.height;
        canvas.width = screen.width;
        canvas.height = screen.height;
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        var canvas = Module['canvas'];
        canvas.width = this.windowedWidth;
        canvas.height = this.windowedHeight;
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      }};
FS.staticInit();__ATINIT__.unshift({ func: function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() } });__ATMAIN__.push({ func: function() { FS.ignorePermissions = false } });__ATEXIT__.push({ func: function() { FS.quit() } });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;
___errno_state = Runtime.staticAlloc(4); HEAP32[((___errno_state)>>2)]=0;
__ATINIT__.unshift({ func: function() { TTY.init() } });__ATEXIT__.push({ func: function() { TTY.shutdown() } });TTY.utf8 = new Runtime.UTF8Processor();
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); NODEFS.staticInit(); }
__ATINIT__.push({ func: function() { SOCKFS.root = FS.mount(SOCKFS, {}, null); } });
_fputc.ret = allocate([0], "i8", ALLOC_STATIC);
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas) { Browser.requestFullScreen(lockPointer, resizeCanvas) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true; // seal the static portion of memory
STACK_MAX = STACK_BASE + 5242880;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY); // Stack must fit in TOTAL_MEMORY; allocations from here on may enlarge TOTAL_MEMORY
var Math_min = Math.min;
function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function asmPrintInt(x, y) {
  Module.print('int ' + x + ',' + y);// + ' ' + new Error().stack);
}
function asmPrintFloat(x, y) {
  Module.print('float ' + x + ',' + y);// + ' ' + new Error().stack);
}
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var NaN=+env.NaN;
  var Infinity=+env.Infinity;
  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var abort=env.abort;
  var assert=env.assert;
  var asmPrintInt=env.asmPrintInt;
  var asmPrintFloat=env.asmPrintFloat;
  var Math_min=env.min;
  var invoke_ii=env.invoke_ii;
  var invoke_v=env.invoke_v;
  var invoke_iii=env.invoke_iii;
  var invoke_vi=env.invoke_vi;
  var _malloc=env._malloc;
  var _sscanf=env._sscanf;
  var _snprintf=env._snprintf;
  var __scanString=env.__scanString;
  var __getFloat=env.__getFloat;
  var _fprintf=env._fprintf;
  var _printf=env._printf;
  var _fflush=env._fflush;
  var __reallyNegative=env.__reallyNegative;
  var _fputc=env._fputc;
  var _puts=env._puts;
  var ___setErrNo=env.___setErrNo;
  var _fwrite=env._fwrite;
  var _send=env._send;
  var _write=env._write;
  var _fputs=env._fputs;
  var _sprintf=env._sprintf;
  var __formatString=env.__formatString;
  var _free=env._free;
  var _pwrite=env._pwrite;
  var _llvm_bswap_i32=env._llvm_bswap_i32;
  var tempFloat = 0.0;
// EMSCRIPTEN_START_FUNCS
function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
STACKTOP = (STACKTOP + 7)&-8;
  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}
function copyTempFloat(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1|0] = HEAP8[ptr+1|0];
  HEAP8[tempDoublePtr+2|0] = HEAP8[ptr+2|0];
  HEAP8[tempDoublePtr+3|0] = HEAP8[ptr+3|0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1|0] = HEAP8[ptr+1|0];
  HEAP8[tempDoublePtr+2|0] = HEAP8[ptr+2|0];
  HEAP8[tempDoublePtr+3|0] = HEAP8[ptr+3|0];
  HEAP8[tempDoublePtr+4|0] = HEAP8[ptr+4|0];
  HEAP8[tempDoublePtr+5|0] = HEAP8[ptr+5|0];
  HEAP8[tempDoublePtr+6|0] = HEAP8[ptr+6|0];
  HEAP8[tempDoublePtr+7|0] = HEAP8[ptr+7|0];
}
function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function setTempRet1(value) {
  value = value|0;
  tempRet1 = value;
}
function setTempRet2(value) {
  value = value|0;
  tempRet2 = value;
}
function setTempRet3(value) {
  value = value|0;
  tempRet3 = value;
}
function setTempRet4(value) {
  value = value|0;
  tempRet4 = value;
}
function setTempRet5(value) {
  value = value|0;
  tempRet5 = value;
}
function setTempRet6(value) {
  value = value|0;
  tempRet6 = value;
}
function setTempRet7(value) {
  value = value|0;
  tempRet7 = value;
}
function setTempRet8(value) {
  value = value|0;
  tempRet8 = value;
}
function setTempRet9(value) {
  value = value|0;
  tempRet9 = value;
}
function runPostSets() {
}
function _bin2hex($source,$length,$target){
 $source=($source)|0;
 $length=($length)|0;
 $target=($target)|0;
 var $1=0,$i_08=0,$2=0,$3=0,$4=0,$5=0,$6=0,$7=0,$8=0,$9=0,$10=0,$11=0,label=0;
 var tempVarArgs=0;
 var sp=0;sp=STACKTOP;
 $1=($length|0)==0;
 if ($1) {
  $10=$length<<1;
  $11=(($target+$10)|0);
  HEAP8[($11)]=0;
  STACKTOP=sp;return;
 } else {
  $i_08=0;
 }
 while(1) {
  $2=$i_08<<1;
  $3=(($target+$2)|0);
  $4=(($source+$i_08)|0);
  $5=((HEAP8[($4)])|0);
  $6=($5&255);
  $7=((_sprintf((($3)|0),((104)|0),(((tempVarArgs=STACKTOP,STACKTOP = (STACKTOP + 8)|0,HEAP32[((tempVarArgs)>>2)]=$6,tempVarArgs))|0)))|0); STACKTOP=tempVarArgs;
  $8=((($i_08)+(1))|0);
  $9=($8>>>0)<($length>>>0);
  if ($9) {
   $i_08=$8;
  } else {
   break;
  }
 }
 $10=$length<<1;
 $11=(($target+$10)|0);
 HEAP8[($11)]=0;
 STACKTOP=sp;return;
}
function _hex2bin($p,$hexstr,$len){
 $p=($p)|0;
 $hexstr=($hexstr)|0;
 $len=($len)|0;
 var $hex_byte=0,$v=0,$1=0,$2=0,$3=0,$or_cond17=0,$4=0,$5=0,$6=0,$8=0,$_020=0,$_01119=0,$_01218=0,$9=0,$10=0,$11=0,$puts=0,$14=0,$15=0,$16=0;
 var $18=0,$20=0,$21=0,$22=0,$23=0,$24=0,$25=0,$26=0,$27=0,$or_cond=0,$_lcssa=0,$28=0,$_013=0,label=0;
 var tempVarArgs=0;
 var sp=0;sp=STACKTOP;STACKTOP=(STACKTOP+16)|0;
 $hex_byte=((sp)|0);
 $v=(((sp)+(8))|0);
 $1=((HEAP8[($hexstr)])|0);
 $2=(($1<<24)>>24)==0;
 $3=($len|0)==0;
 $or_cond17=$2|$3;
 L7: do {
  if ($or_cond17) {
   $_lcssa=$3;
  } else {
   $4=(($hex_byte)|0);
   $5=(($hex_byte+1)|0);
   $6=(($hex_byte+2)|0);
   $_01218=$p;$_01119=$hexstr;$_020=$len;$8=$1;
   while(1) {
    $9=(($_01119+1)|0);
    $10=((HEAP8[($9)])|0);
    $11=(($10<<24)>>24)==0;
    if ($11) {
     label = 9;
     break;
    }
    HEAP8[($4)]=$8;
    $14=((HEAP8[($9)])|0);
    HEAP8[($5)]=$14;
    HEAP8[($6)]=0;
    $15=((_sscanf((($4)|0),((96)|0),(((tempVarArgs=STACKTOP,STACKTOP = (STACKTOP + 8)|0,HEAP32[((tempVarArgs)>>2)]=$v,tempVarArgs))|0)))|0); STACKTOP=tempVarArgs;
    $16=($15|0)==1;
    if (!($16)) {
     label = 11;
     break;
    }
    $20=((HEAP32[(($v)>>2)])|0);
    $21=(($20)&255);
    HEAP8[($_01218)]=$21;
    $22=(($_01218+1)|0);
    $23=(($_01119+2)|0);
    $24=((($_020)-(1))|0);
    $25=((HEAP8[($23)])|0);
    $26=(($25<<24)>>24)==0;
    $27=($24|0)==0;
    $or_cond=$26|$27;
    if ($or_cond) {
     $_lcssa=$27;
     break L7;
    } else {
     $_01218=$22;$_01119=$23;$_020=$24;$8=$25;
    }
   }
   if ((label|0) == 9) {
    $puts=((_puts(((8)|0)))|0);
    $_013=0;
    STACKTOP=sp;return (($_013)|0);
   }
   else if ((label|0) == 11) {
    $18=((_printf(((64)|0),(((tempVarArgs=STACKTOP,STACKTOP = (STACKTOP + 8)|0,HEAP32[((tempVarArgs)>>2)]=$4,tempVarArgs))|0)))|0); STACKTOP=tempVarArgs;
    $_013=0;
    STACKTOP=sp;return (($_013)|0);
   }
  }
 } while(0);
 $28=($_lcssa&1);
 $_013=$28;
 STACKTOP=sp;return (($_013)|0);
}
function _fulltest($hash,$target){
 $hash=($hash)|0;
 $target=($target)|0;
 var $hash_swap23=0,$target_swap24=0,$1=0,$2=0,$i_0=0,$4=0,$6=0,$7=0,$8=0,$9=0,$10=0,$11=0,$12=0,$14=0,$15=0,$rc_0=0,label=0;
 var sp=0;sp=STACKTOP;STACKTOP=(STACKTOP+64)|0;
 $hash_swap23=((sp)|0);
 $target_swap24=(((sp)+(32))|0);
 $1=$hash_swap23;
 $2=$target_swap24;
 _swap256($1,$hash);
 _swap256($2,$target);
 $i_0=0;
 while(1) {
  $4=($i_0|0)<8;
  if (!($4)) {
   $rc_0=1;
   label = 23;
   break;
  }
  $6=(($hash_swap23+($i_0<<2))|0);
  $7=((HEAP32[(($6)>>2)])|0);
  $8=((_llvm_bswap_i32((($7)|0)))|0);
  $9=(($target_swap24+($i_0<<2))|0);
  $10=((HEAP32[(($9)>>2)])|0);
  $11=((_llvm_bswap_i32((($10)|0)))|0);
  HEAP32[(($9)>>2)]=$11;
  $12=($8>>>0)>($10>>>0);
  if ($12) {
   $rc_0=0;
   label = 24;
   break;
  }
  $14=($8>>>0)<($10>>>0);
  $15=((($i_0)+(1))|0);
  if ($14) {
   $rc_0=1;
   label = 25;
   break;
  } else {
   $i_0=$15;
  }
 }
 if ((label|0) == 23) {
  STACKTOP=sp;return (($rc_0)|0);
 }
 else if ((label|0) == 24) {
  STACKTOP=sp;return (($rc_0)|0);
 }
 else if ((label|0) == 25) {
  STACKTOP=sp;return (($rc_0)|0);
 }
  return 0;
}
function _swap256($dest_p,$src_p){
 $dest_p=($dest_p)|0;
 $src_p=($src_p)|0;
 var $1=0,$2=0,$3=0,$4=0,$5=0,$6=0,$7=0,$8=0,$9=0,$10=0,$11=0,$12=0,$13=0,$14=0,$15=0,$16=0,$17=0,$18=0,$19=0,$20=0;
 var $21=0,$22=0,$23=0,$24=0,$25=0,$26=0,$27=0,$28=0,$29=0,$30=0,$31=0,$32=0,$33=0,$34=0,$35=0,$36=0,$37=0,$38=0,label=0;
 $1=$dest_p;
 $2=$src_p;
 $3=(($src_p+28)|0);
 $4=$3;
 $5=((HEAP32[(($4)>>2)])|0);
 HEAP32[(($1)>>2)]=$5;
 $6=(($src_p+24)|0);
 $7=$6;
 $8=((HEAP32[(($7)>>2)])|0);
 $9=(($dest_p+4)|0);
 $10=$9;
 HEAP32[(($10)>>2)]=$8;
 $11=(($src_p+20)|0);
 $12=$11;
 $13=((HEAP32[(($12)>>2)])|0);
 $14=(($dest_p+8)|0);
 $15=$14;
 HEAP32[(($15)>>2)]=$13;
 $16=(($src_p+16)|0);
 $17=$16;
 $18=((HEAP32[(($17)>>2)])|0);
 $19=(($dest_p+12)|0);
 $20=$19;
 HEAP32[(($20)>>2)]=$18;
 $21=(($src_p+12)|0);
 $22=$21;
 $23=((HEAP32[(($22)>>2)])|0);
 $24=(($dest_p+16)|0);
 $25=$24;
 HEAP32[(($25)>>2)]=$23;
 $26=(($src_p+8)|0);
 $27=$26;
 $28=((HEAP32[(($27)>>2)])|0);
 $29=(($dest_p+20)|0);
 $30=$29;
 HEAP32[(($30)>>2)]=$28;
 $31=(($src_p+4)|0);
 $32=$31;
 $33=((HEAP32[(($32)>>2)])|0);
 $34=(($dest_p+24)|0);
 $35=$34;
 HEAP32[(($35)>>2)]=$33;
 $36=((HEAP32[(($2)>>2)])|0);
 $37=(($dest_p+28)|0);
 $38=$37;
 HEAP32[(($38)>>2)]=$36;
 return;
}
function _scanhash($midstate,$data,$hash1,$hash,$target,$min_nonce,$max_nonce,$last_nonce,$restart){
 $midstate=($midstate)|0;
 $data=($data)|0;
 $hash1=($hash1)|0;
 $hash=($hash)|0;
 $target=($target)|0;
 $min_nonce=($min_nonce)|0;
 $max_nonce=($max_nonce)|0;
 $last_nonce=($last_nonce)|0;
 $restart=($restart)|0;
 var $1=0,$2=0,$3=0,$4=0,$5=0,$n_0=0,$7=0,$8=0,$9=0,$11=0,$12=0,$14=0,$16=0,$17=0,$_0=0,label=0;
 $1=(($data+64)|0);
 $2=(($data+76)|0);
 $3=$2;
 $4=(($hash+28)|0);
 $5=$4;
 $n_0=$min_nonce;
 while(1) {
  $7=((($n_0)+(1))|0);
  HEAP32[(($3)>>2)]=$7;
  _runhash($hash1,$1,$midstate);
  _runhash($hash,$hash1,32);
  $8=((HEAP32[(($5)>>2)])|0);
  $9=($8|0)==0;
  if ($9) {
   $11=((_fulltest($hash,$target))|0);
   $12=($11|0)==0;
   if (!($12)) {
    $_0=1;
    break;
   }
  }
  $14=($7>>>0)<($max_nonce>>>0);
  if (!($14)) {
   $_0=0;
   break;
  }
  $16=((HEAP32[(($restart)>>2)])|0);
  $17=($16|0)==0;
  if ($17) {
   $n_0=$7;
  } else {
   $_0=0;
   break;
  }
 }
 HEAP32[(($last_nonce)>>2)]=$7;
 return (($_0)|0);
}
function _runhash($state,$input,$init){
 $state=($state)|0;
 $input=($input)|0;
 $init=($init)|0;
 var $1=0,label=0;
 (_memcpy((($state)|0), (($init)|0), 32)|0);
 $1=$state;
 _sha256_transform($1,$input);
 return;
}
function _nonce(){
 var $1=0,label=0;
 $1=((HEAP32[((384)>>2)])|0);
 return (($1)|0);
}
function _proof(){
 var label=0;
 return ((120)|0);
}
function _mine($hash1String,$dataString,$midstateString,$targetString,$minNonce,$maxNonce){
 $hash1String=($hash1String)|0;
 $dataString=($dataString)|0;
 $midstateString=($midstateString)|0;
 $targetString=($targetString)|0;
 $minNonce=($minNonce)|0;
 $maxNonce=($maxNonce)|0;
 var $hash1=0,$data=0,$midstate=0,$target=0,$hash=0,$1=0,$2=0,$3=0,$4=0,$5=0,$6=0,$7=0,$8=0,$9=0,$10=0,$11=0,label=0;
 var sp=0;sp=STACKTOP;STACKTOP=(STACKTOP+288)|0;
 $hash1=((sp)|0);
 $data=(((sp)+(64))|0);
 $midstate=(((sp)+(192))|0);
 $target=(((sp)+(224))|0);
 $hash=(((sp)+(256))|0);
 $1=(($hash1)|0);
 $2=((_hex2bin($1,$hash1String,64))|0);
 $3=(($data)|0);
 $4=((_hex2bin($3,$dataString,128))|0);
 $5=(($midstate)|0);
 $6=((_hex2bin($5,$midstateString,32))|0);
 $7=(($target)|0);
 $8=((_hex2bin($7,$targetString,32))|0);
 $9=(($hash)|0);
 _memset((((($9)|0))|0), ((((0)|0))|0), ((((32)|0))|0));
 $10=((_scanhash($5,$3,$1,$9,$7,$minNonce,$maxNonce,384,112))|0);
 HEAP8[(120)]=0;
 HEAP8[(376)]=0;
 $11=($10|0)==0;
 if ($11) {
  STACKTOP=sp;return (($10)|0);
 }
 _bin2hex($3,128,120);
 STACKTOP=sp;return (($10)|0);
}
function _sha256_transform($state,$input){
 $state=($state)|0;
 $input=($input)|0;
 var $W=0,$1=0,$2=0,$i_01109=0,$4=0,$5=0,$i_11108=0,$7=0,$8=0,$10=0,$11=0,$12=0,$13=0,$14=0,$15=0,$16=0,$17=0,$18=0,$19=0,$20=0;
 var $21=0,$22=0,$23=0,$24=0,$25=0,$26=0,$27=0,$28=0,$29=0,$30=0,$31=0,$32=0,$33=0,$34=0,$35=0,$36=0,$37=0,$38=0,$39=0,$40=0;
 var $41=0,$42=0,$43=0,$44=0,$45=0,$46=0,$47=0,$48=0,$49=0,$50=0,$51=0,$52=0,$53=0,$54=0,$55=0,$56=0,$57=0,$58=0,$59=0,$60=0;
 var $61=0,$62=0,$63=0,$64=0,$65=0,$66=0,$67=0,$68=0,$69=0,$70=0,$71=0,$72=0,$73=0,$74=0,$75=0,$76=0,$77=0,$78=0,$79=0,$80=0;
 var $81=0,$82=0,$83=0,$84=0,$85=0,$86=0,$87=0,$88=0,$89=0,$90=0,$91=0,$92=0,$93=0,$94=0,$95=0,$96=0,$97=0,$98=0,$99=0,$100=0;
 var $101=0,$102=0,$103=0,$104=0,$105=0,$106=0,$107=0,$108=0,$109=0,$110=0,$111=0,$112=0,$113=0,$114=0,$115=0,$116=0,$117=0,$118=0,$119=0,$120=0;
 var $121=0,$122=0,$123=0,$124=0,$125=0,$126=0,$127=0,$128=0,$129=0,$130=0,$131=0,$132=0,$133=0,$134=0,$135=0,$136=0,$137=0,$138=0,$139=0,$140=0;
 var $141=0,$142=0,$143=0,$144=0,$145=0,$146=0,$147=0,$148=0,$149=0,$150=0,$151=0,$152=0,$153=0,$154=0,$155=0,$156=0,$157=0,$158=0,$159=0,$160=0;
 var $161=0,$162=0,$163=0,$164=0,$165=0,$166=0,$167=0,$168=0,$169=0,$170=0,$171=0,$172=0,$173=0,$174=0,$175=0,$176=0,$177=0,$178=0,$179=0,$180=0;
 var $181=0,$182=0,$183=0,$184=0,$185=0,$186=0,$187=0,$188=0,$189=0,$190=0,$191=0,$192=0,$193=0,$194=0,$195=0,$196=0,$197=0,$198=0,$199=0,$200=0;
 var $201=0,$202=0,$203=0,$204=0,$205=0,$206=0,$207=0,$208=0,$209=0,$210=0,$211=0,$212=0,$213=0,$214=0,$215=0,$216=0,$217=0,$218=0,$219=0,$220=0;
 var $221=0,$222=0,$223=0,$224=0,$225=0,$226=0,$227=0,$228=0,$229=0,$230=0,$231=0,$232=0,$233=0,$234=0,$235=0,$236=0,$237=0,$238=0,$239=0,$240=0;
 var $241=0,$242=0,$243=0,$244=0,$245=0,$246=0,$247=0,$248=0,$249=0,$250=0,$251=0,$252=0,$253=0,$254=0,$255=0,$256=0,$257=0,$258=0,$259=0,$260=0;
 var $261=0,$262=0,$263=0,$264=0,$265=0,$266=0,$267=0,$268=0,$269=0,$270=0,$271=0,$272=0,$273=0,$274=0,$275=0,$276=0,$277=0,$278=0,$279=0,$280=0;
 var $281=0,$282=0,$283=0,$284=0,$285=0,$286=0,$287=0,$288=0,$289=0,$290=0,$291=0,$292=0,$293=0,$294=0,$295=0,$296=0,$297=0,$298=0,$299=0,$300=0;
 var $301=0,$302=0,$303=0,$304=0,$305=0,$306=0,$307=0,$308=0,$309=0,$310=0,$311=0,$312=0,$313=0,$314=0,$315=0,$316=0,$317=0,$318=0,$319=0,$320=0;
 var $321=0,$322=0,$323=0,$324=0,$325=0,$326=0,$327=0,$328=0,$329=0,$330=0,$331=0,$332=0,$333=0,$334=0,$335=0,$336=0,$337=0,$338=0,$339=0,$340=0;
 var $341=0,$342=0,$343=0,$344=0,$345=0,$346=0,$347=0,$348=0,$349=0,$350=0,$351=0,$352=0,$353=0,$354=0,$355=0,$356=0,$357=0,$358=0,$359=0,$360=0;
 var $361=0,$362=0,$363=0,$364=0,$365=0,$366=0,$367=0,$368=0,$369=0,$370=0,$371=0,$372=0,$373=0,$374=0,$375=0,$376=0,$377=0,$378=0,$379=0,$380=0;
 var $381=0,$382=0,$383=0,$384=0,$385=0,$386=0,$387=0,$388=0,$389=0,$390=0,$391=0,$392=0,$393=0,$394=0,$395=0,$396=0,$397=0,$398=0,$399=0,$400=0;
 var $401=0,$402=0,$403=0,$404=0,$405=0,$406=0,$407=0,$408=0,$409=0,$410=0,$411=0,$412=0,$413=0,$414=0,$415=0,$416=0,$417=0,$418=0,$419=0,$420=0;
 var $421=0,$422=0,$423=0,$424=0,$425=0,$426=0,$427=0,$428=0,$429=0,$430=0,$431=0,$432=0,$433=0,$434=0,$435=0,$436=0,$437=0,$438=0,$439=0,$440=0;
 var $441=0,$442=0,$443=0,$444=0,$445=0,$446=0,$447=0,$448=0,$449=0,$450=0,$451=0,$452=0,$453=0,$454=0,$455=0,$456=0,$457=0,$458=0,$459=0,$460=0;
 var $461=0,$462=0,$463=0,$464=0,$465=0,$466=0,$467=0,$468=0,$469=0,$470=0,$471=0,$472=0,$473=0,$474=0,$475=0,$476=0,$477=0,$478=0,$479=0,$480=0;
 var $481=0,$482=0,$483=0,$484=0,$485=0,$486=0,$487=0,$488=0,$489=0,$490=0,$491=0,$492=0,$493=0,$494=0,$495=0,$496=0,$497=0,$498=0,$499=0,$500=0;
 var $501=0,$502=0,$503=0,$504=0,$505=0,$506=0,$507=0,$508=0,$509=0,$510=0,$511=0,$512=0,$513=0,$514=0,$515=0,$516=0,$517=0,$518=0,$519=0,$520=0;
 var $521=0,$522=0,$523=0,$524=0,$525=0,$526=0,$527=0,$528=0,$529=0,$530=0,$531=0,$532=0,$533=0,$534=0,$535=0,$536=0,$537=0,$538=0,$539=0,$540=0;
 var $541=0,$542=0,$543=0,$544=0,$545=0,$546=0,$547=0,$548=0,$549=0,$550=0,$551=0,$552=0,$553=0,$554=0,$555=0,$556=0,$557=0,$558=0,$559=0,$560=0;
 var $561=0,$562=0,$563=0,$564=0,$565=0,$566=0,$567=0,$568=0,$569=0,$570=0,$571=0,$572=0,$573=0,$574=0,$575=0,$576=0,$577=0,$578=0,$579=0,$580=0;
 var $581=0,$582=0,$583=0,$584=0,$585=0,$586=0,$587=0,$588=0,$589=0,$590=0,$591=0,$592=0,$593=0,$594=0,$595=0,$596=0,$597=0,$598=0,$599=0,$600=0;
 var $601=0,$602=0,$603=0,$604=0,$605=0,$606=0,$607=0,$608=0,$609=0,$610=0,$611=0,$612=0,$613=0,$614=0,$615=0,$616=0,$617=0,$618=0,$619=0,$620=0;
 var $621=0,$622=0,$623=0,$624=0,$625=0,$626=0,$627=0,$628=0,$629=0,$630=0,$631=0,$632=0,$633=0,$634=0,$635=0,$636=0,$637=0,$638=0,$639=0,$640=0;
 var $641=0,$642=0,$643=0,$644=0,$645=0,$646=0,$647=0,$648=0,$649=0,$650=0,$651=0,$652=0,$653=0,$654=0,$655=0,$656=0,$657=0,$658=0,$659=0,$660=0;
 var $661=0,$662=0,$663=0,$664=0,$665=0,$666=0,$667=0,$668=0,$669=0,$670=0,$671=0,$672=0,$673=0,$674=0,$675=0,$676=0,$677=0,$678=0,$679=0,$680=0;
 var $681=0,$682=0,$683=0,$684=0,$685=0,$686=0,$687=0,$688=0,$689=0,$690=0,$691=0,$692=0,$693=0,$694=0,$695=0,$696=0,$697=0,$698=0,$699=0,$700=0;
 var $701=0,$702=0,$703=0,$704=0,$705=0,$706=0,$707=0,$708=0,$709=0,$710=0,$711=0,$712=0,$713=0,$714=0,$715=0,$716=0,$717=0,$718=0,$719=0,$720=0;
 var $721=0,$722=0,$723=0,$724=0,$725=0,$726=0,$727=0,$728=0,$729=0,$730=0,$731=0,$732=0,$733=0,$734=0,$735=0,$736=0,$737=0,$738=0,$739=0,$740=0;
 var $741=0,$742=0,$743=0,$744=0,$745=0,$746=0,$747=0,$748=0,$749=0,$750=0,$751=0,$752=0,$753=0,$754=0,$755=0,$756=0,$757=0,$758=0,$759=0,$760=0;
 var $761=0,$762=0,$763=0,$764=0,$765=0,$766=0,$767=0,$768=0,$769=0,$770=0,$771=0,$772=0,$773=0,$774=0,$775=0,$776=0,$777=0,$778=0,$779=0,$780=0;
 var $781=0,$782=0,$783=0,$784=0,$785=0,$786=0,$787=0,$788=0,$789=0,$790=0,$791=0,$792=0,$793=0,$794=0,$795=0,$796=0,$797=0,$798=0,$799=0,$800=0;
 var $801=0,$802=0,$803=0,$804=0,$805=0,$806=0,$807=0,$808=0,$809=0,$810=0,$811=0,$812=0,$813=0,$814=0,$815=0,$816=0,$817=0,$818=0,$819=0,$820=0;
 var $821=0,$822=0,$823=0,$824=0,$825=0,$826=0,$827=0,$828=0,$829=0,$830=0,$831=0,$832=0,$833=0,$834=0,$835=0,$836=0,$837=0,$838=0,$839=0,$840=0;
 var $841=0,$842=0,$843=0,$844=0,$845=0,$846=0,$847=0,$848=0,$849=0,$850=0,$851=0,$852=0,$853=0,$854=0,$855=0,$856=0,$857=0,$858=0,$859=0,$860=0;
 var $861=0,$862=0,$863=0,$864=0,$865=0,$866=0,$867=0,$868=0,$869=0,$870=0,$871=0,$872=0,$873=0,$874=0,$875=0,$876=0,$877=0,$878=0,$879=0,$880=0;
 var $881=0,$882=0,$883=0,$884=0,$885=0,$886=0,$887=0,$888=0,$889=0,$890=0,$891=0,$892=0,$893=0,$894=0,$895=0,$896=0,$897=0,$898=0,$899=0,$900=0;
 var $901=0,$902=0,$903=0,$904=0,$905=0,$906=0,$907=0,$908=0,$909=0,$910=0,$911=0,$912=0,$913=0,$914=0,$915=0,$916=0,$917=0,$918=0,$919=0,$920=0;
 var $921=0,$922=0,$923=0,$924=0,$925=0,$926=0,$927=0,$928=0,$929=0,$930=0,$931=0,$932=0,$933=0,$934=0,$935=0,$936=0,$937=0,$938=0,$939=0,$940=0;
 var $941=0,$942=0,$943=0,$944=0,$945=0,$946=0,$947=0,$948=0,$949=0,$950=0,$951=0,$952=0,$953=0,$954=0,$955=0,$956=0,$957=0,$958=0,$959=0,$960=0;
 var $961=0,$962=0,$963=0,$964=0,$965=0,$966=0,$967=0,$968=0,$969=0,$970=0,$971=0,$972=0,$973=0,$974=0,$975=0,$976=0,$977=0,$978=0,$979=0,$980=0;
 var $981=0,$982=0,$983=0,$984=0,$985=0,$986=0,$987=0,$988=0,$989=0,$990=0,$991=0,$992=0,$993=0,$994=0,$995=0,$996=0,$997=0,$998=0,$999=0,$1000=0;
 var $1001=0,$1002=0,$1003=0,$1004=0,$1005=0,$1006=0,$1007=0,$1008=0,$1009=0,$1010=0,$1011=0,$1012=0,$1013=0,$1014=0,$1015=0,$1016=0,$1017=0,$1018=0,$1019=0,$1020=0;
 var $1021=0,$1022=0,$1023=0,$1024=0,$1025=0,$1026=0,$1027=0,$1028=0,$1029=0,$1030=0,$1031=0,$1032=0,$1033=0,$1034=0,$1035=0,$1036=0,$1037=0,$1038=0,$1039=0,$1040=0;
 var $1041=0,$1042=0,$1043=0,$1044=0,$1045=0,$1046=0,$1047=0,$1048=0,$1049=0,$1050=0,$1051=0,$1052=0,$1053=0,$1054=0,$1055=0,$1056=0,$1057=0,$1058=0,$1059=0,$1060=0;
 var $1061=0,$1062=0,$1063=0,$1064=0,$1065=0,$1066=0,$1067=0,$1068=0,$1069=0,$1070=0,$1071=0,$1072=0,$1073=0,$1074=0,$1075=0,$1076=0,$1077=0,$1078=0,$1079=0,$1080=0;
 var $1081=0,$1082=0,$1083=0,$1084=0,$1085=0,$1086=0,$1087=0,$1088=0,$1089=0,$1090=0,$1091=0,$1092=0,$1093=0,$1094=0,$1095=0,$1096=0,$1097=0,$1098=0,$1099=0,$1100=0;
 var $1101=0,$1102=0,$1103=0,$1104=0,$1105=0,$1106=0,$1107=0,$1108=0,$1109=0,$1110=0,$1111=0,$1112=0,$1113=0,$1114=0,$1115=0,$1116=0,$1117=0,$1118=0,$1119=0,$1120=0;
 var $1121=0,$1122=0,$1123=0,$1124=0,$1125=0,$1126=0,$1127=0,$1128=0,$1129=0,$1130=0,$1131=0,$1132=0,$1133=0,$1134=0,$1135=0,$1136=0,$1137=0,$1138=0,$1139=0,$1140=0;
 var $1141=0,$1142=0,$1143=0,$1144=0,$1145=0,$1146=0,$1147=0,$1148=0,$1149=0,$1150=0,$1151=0,$1152=0,$1153=0,$1154=0,$1155=0,$1156=0,$1157=0,$1158=0,$1159=0,$1160=0;
 var $1161=0,$1162=0,$1163=0,$1164=0,$1165=0,$1166=0,$1167=0,$1168=0,$1169=0,$1170=0,$1171=0,$1172=0,$1173=0,$1174=0,$1175=0,$1176=0,$1177=0,$1178=0,$1179=0,$1180=0;
 var $1181=0,$1182=0,$1183=0,$1184=0,$1185=0,$1186=0,$1187=0,$1188=0,$1189=0,$1190=0,$1191=0,$1192=0,$1193=0,$1194=0,$1195=0,$1196=0,$1197=0,$1198=0,$1199=0,$1200=0;
 var $1201=0,$1202=0,$1203=0,$1204=0,$1205=0,$1206=0,$1207=0,$1208=0,$1209=0,$1210=0,$1211=0,$1212=0,$1213=0,$1214=0,$1215=0,$1216=0,$1217=0,$1218=0,$1219=0,$1220=0;
 var $1221=0,$1222=0,$1223=0,$1224=0,$1225=0,$1226=0,$1227=0,$1228=0,$1229=0,$1230=0,$1231=0,$1232=0,$1233=0,$1234=0,$1235=0,$1236=0,$1237=0,$1238=0,$1239=0,$1240=0;
 var $1241=0,$1242=0,$1243=0,$1244=0,$1245=0,$1246=0,$1247=0,$1248=0,$1249=0,$1250=0,$1251=0,$1252=0,$1253=0,$1254=0,$1255=0,$1256=0,$1257=0,$1258=0,$1259=0,$1260=0;
 var $1261=0,$1262=0,$1263=0,$1264=0,$1265=0,$1266=0,$1267=0,$1268=0,$1269=0,$1270=0,$1271=0,$1272=0,$1273=0,$1274=0,$1275=0,$1276=0,$1277=0,$1278=0,$1279=0,$1280=0;
 var $1281=0,$1282=0,$1283=0,$1284=0,$1285=0,$1286=0,$1287=0,$1288=0,$1289=0,$1290=0,$1291=0,$1292=0,$1293=0,$1294=0,$1295=0,$1296=0,$1297=0,$1298=0,$1299=0,$1300=0;
 var $1301=0,$1302=0,$1303=0,$1304=0,$1305=0,$1306=0,$1307=0,$1308=0,$1309=0,$1310=0,$1311=0,$1312=0,$1313=0,$1314=0,$1315=0,$1316=0,$1317=0,$1318=0,$1319=0,$1320=0;
 var $1321=0,$1322=0,$1323=0,$1324=0,$1325=0,$1326=0,$1327=0,$1328=0,$1329=0,$1330=0,$1331=0,$1332=0,$1333=0,$1334=0,$1335=0,$1336=0,$1337=0,$1338=0,$1339=0,$1340=0;
 var $1341=0,$1342=0,$1343=0,$1344=0,$1345=0,$1346=0,$1347=0,$1348=0,$1349=0,$1350=0,$1351=0,$1352=0,$1353=0,$1354=0,$1355=0,$1356=0,$1357=0,$1358=0,$1359=0,$1360=0;
 var $1361=0,$1362=0,$1363=0,$1364=0,$1365=0,$1366=0,$1367=0,$1368=0,$1369=0,$1370=0,$1371=0,$1372=0,$1373=0,$1374=0,$1375=0,$1376=0,$1377=0,$1378=0,$1379=0,$1380=0;
 var $1381=0,$1382=0,$1383=0,label=0;
 var sp=0;sp=STACKTOP;STACKTOP=(STACKTOP+256)|0;
 $W=((sp)|0);
 $1=(($W)|0);
 $i_01109=0;
 while(1) {
  _LOAD_OP($i_01109,$1,$input);
  $4=((($i_01109)+(1))|0);
  $5=($4|0)<16;
  if ($5) {
   $i_01109=$4;
  } else {
   break;
  }
 }
 $2=(($W)|0);
 $i_11108=16;
 while(1) {
  _BLEND_OP($i_11108,$2);
  $7=((($i_11108)+(1))|0);
  $8=($7|0)<64;
  if ($8) {
   $i_11108=$7;
  } else {
   break;
  }
 }
 $10=((HEAP32[(($state)>>2)])|0);
 $11=(($state+4)|0);
 $12=((HEAP32[(($11)>>2)])|0);
 $13=(($state+8)|0);
 $14=((HEAP32[(($13)>>2)])|0);
 $15=(($state+12)|0);
 $16=((HEAP32[(($15)>>2)])|0);
 $17=(($state+16)|0);
 $18=((HEAP32[(($17)>>2)])|0);
 $19=(($state+20)|0);
 $20=((HEAP32[(($19)>>2)])|0);
 $21=(($state+24)|0);
 $22=((HEAP32[(($21)>>2)])|0);
 $23=(($state+28)|0);
 $24=((HEAP32[(($23)>>2)])|0);
 $25=((_ror32($18,6))|0);
 $26=((_ror32($18,11))|0);
 $27=$26^$25;
 $28=((_ror32($18,25))|0);
 $29=$27^$28;
 $30=((_Ch($18,$20,$22))|0);
 $31=(($W)|0);
 $32=((HEAP32[(($31)>>2)])|0);
 $33=((($24)+(1116352408))|0);
 $34=((($33)+($29))|0);
 $35=((($34)+($30))|0);
 $36=((($35)+($32))|0);
 $37=((_ror32($10,2))|0);
 $38=((_ror32($10,13))|0);
 $39=$38^$37;
 $40=((_ror32($10,22))|0);
 $41=$39^$40;
 $42=((_Maj($10,$12,$14))|0);
 $43=((($36)+($16))|0);
 $44=((($42)+($36))|0);
 $45=((($44)+($41))|0);
 $46=((_ror32($43,6))|0);
 $47=((_ror32($43,11))|0);
 $48=$47^$46;
 $49=((_ror32($43,25))|0);
 $50=$48^$49;
 $51=((_Ch($43,$18,$20))|0);
 $52=(($W+4)|0);
 $53=((HEAP32[(($52)>>2)])|0);
 $54=((($22)+(1899447441))|0);
 $55=((($54)+($50))|0);
 $56=((($55)+($51))|0);
 $57=((($56)+($53))|0);
 $58=((_ror32($45,2))|0);
 $59=((_ror32($45,13))|0);
 $60=$59^$58;
 $61=((_ror32($45,22))|0);
 $62=$60^$61;
 $63=((_Maj($45,$10,$12))|0);
 $64=((($57)+($14))|0);
 $65=((($63)+($57))|0);
 $66=((($65)+($62))|0);
 $67=((_ror32($64,6))|0);
 $68=((_ror32($64,11))|0);
 $69=$68^$67;
 $70=((_ror32($64,25))|0);
 $71=$69^$70;
 $72=((_Ch($64,$43,$18))|0);
 $73=(($W+8)|0);
 $74=((HEAP32[(($73)>>2)])|0);
 $75=((($20)-(1245643825))|0);
 $76=((($75)+($71))|0);
 $77=((($76)+($72))|0);
 $78=((($77)+($74))|0);
 $79=((_ror32($66,2))|0);
 $80=((_ror32($66,13))|0);
 $81=$80^$79;
 $82=((_ror32($66,22))|0);
 $83=$81^$82;
 $84=((_Maj($66,$45,$10))|0);
 $85=((($78)+($12))|0);
 $86=((($84)+($78))|0);
 $87=((($86)+($83))|0);
 $88=((_ror32($85,6))|0);
 $89=((_ror32($85,11))|0);
 $90=$89^$88;
 $91=((_ror32($85,25))|0);
 $92=$90^$91;
 $93=((_Ch($85,$64,$43))|0);
 $94=(($W+12)|0);
 $95=((HEAP32[(($94)>>2)])|0);
 $96=((($18)-(373957723))|0);
 $97=((($96)+($92))|0);
 $98=((($97)+($93))|0);
 $99=((($98)+($95))|0);
 $100=((_ror32($87,2))|0);
 $101=((_ror32($87,13))|0);
 $102=$101^$100;
 $103=((_ror32($87,22))|0);
 $104=$102^$103;
 $105=((_Maj($87,$66,$45))|0);
 $106=((($99)+($10))|0);
 $107=((($105)+($99))|0);
 $108=((($107)+($104))|0);
 $109=((_ror32($106,6))|0);
 $110=((_ror32($106,11))|0);
 $111=$110^$109;
 $112=((_ror32($106,25))|0);
 $113=$111^$112;
 $114=((_Ch($106,$85,$64))|0);
 $115=(($W+16)|0);
 $116=((HEAP32[(($115)>>2)])|0);
 $117=((($43)+(961987163))|0);
 $118=((($117)+($113))|0);
 $119=((($118)+($114))|0);
 $120=((($119)+($116))|0);
 $121=((_ror32($108,2))|0);
 $122=((_ror32($108,13))|0);
 $123=$122^$121;
 $124=((_ror32($108,22))|0);
 $125=$123^$124;
 $126=((_Maj($108,$87,$66))|0);
 $127=((($120)+($45))|0);
 $128=((($126)+($120))|0);
 $129=((($128)+($125))|0);
 $130=((_ror32($127,6))|0);
 $131=((_ror32($127,11))|0);
 $132=$131^$130;
 $133=((_ror32($127,25))|0);
 $134=$132^$133;
 $135=((_Ch($127,$106,$85))|0);
 $136=(($W+20)|0);
 $137=((HEAP32[(($136)>>2)])|0);
 $138=((($64)+(1508970993))|0);
 $139=((($138)+($134))|0);
 $140=((($139)+($135))|0);
 $141=((($140)+($137))|0);
 $142=((_ror32($129,2))|0);
 $143=((_ror32($129,13))|0);
 $144=$143^$142;
 $145=((_ror32($129,22))|0);
 $146=$144^$145;
 $147=((_Maj($129,$108,$87))|0);
 $148=((($141)+($66))|0);
 $149=((($147)+($141))|0);
 $150=((($149)+($146))|0);
 $151=((_ror32($148,6))|0);
 $152=((_ror32($148,11))|0);
 $153=$152^$151;
 $154=((_ror32($148,25))|0);
 $155=$153^$154;
 $156=((_Ch($148,$127,$106))|0);
 $157=(($W+24)|0);
 $158=((HEAP32[(($157)>>2)])|0);
 $159=((($85)-(1841331548))|0);
 $160=((($159)+($155))|0);
 $161=((($160)+($156))|0);
 $162=((($161)+($158))|0);
 $163=((_ror32($150,2))|0);
 $164=((_ror32($150,13))|0);
 $165=$164^$163;
 $166=((_ror32($150,22))|0);
 $167=$165^$166;
 $168=((_Maj($150,$129,$108))|0);
 $169=((($162)+($87))|0);
 $170=((($168)+($162))|0);
 $171=((($170)+($167))|0);
 $172=((_ror32($169,6))|0);
 $173=((_ror32($169,11))|0);
 $174=$173^$172;
 $175=((_ror32($169,25))|0);
 $176=$174^$175;
 $177=((_Ch($169,$148,$127))|0);
 $178=(($W+28)|0);
 $179=((HEAP32[(($178)>>2)])|0);
 $180=((($106)-(1424204075))|0);
 $181=((($180)+($176))|0);
 $182=((($181)+($177))|0);
 $183=((($182)+($179))|0);
 $184=((_ror32($171,2))|0);
 $185=((_ror32($171,13))|0);
 $186=$185^$184;
 $187=((_ror32($171,22))|0);
 $188=$186^$187;
 $189=((_Maj($171,$150,$129))|0);
 $190=((($183)+($108))|0);
 $191=((($189)+($183))|0);
 $192=((($191)+($188))|0);
 $193=((_ror32($190,6))|0);
 $194=((_ror32($190,11))|0);
 $195=$194^$193;
 $196=((_ror32($190,25))|0);
 $197=$195^$196;
 $198=((_Ch($190,$169,$148))|0);
 $199=(($W+32)|0);
 $200=((HEAP32[(($199)>>2)])|0);
 $201=((($127)-(670586216))|0);
 $202=((($201)+($197))|0);
 $203=((($202)+($198))|0);
 $204=((($203)+($200))|0);
 $205=((_ror32($192,2))|0);
 $206=((_ror32($192,13))|0);
 $207=$206^$205;
 $208=((_ror32($192,22))|0);
 $209=$207^$208;
 $210=((_Maj($192,$171,$150))|0);
 $211=((($204)+($129))|0);
 $212=((($210)+($204))|0);
 $213=((($212)+($209))|0);
 $214=((_ror32($211,6))|0);
 $215=((_ror32($211,11))|0);
 $216=$215^$214;
 $217=((_ror32($211,25))|0);
 $218=$216^$217;
 $219=((_Ch($211,$190,$169))|0);
 $220=(($W+36)|0);
 $221=((HEAP32[(($220)>>2)])|0);
 $222=((($148)+(310598401))|0);
 $223=((($222)+($218))|0);
 $224=((($223)+($219))|0);
 $225=((($224)+($221))|0);
 $226=((_ror32($213,2))|0);
 $227=((_ror32($213,13))|0);
 $228=$227^$226;
 $229=((_ror32($213,22))|0);
 $230=$228^$229;
 $231=((_Maj($213,$192,$171))|0);
 $232=((($225)+($150))|0);
 $233=((($231)+($225))|0);
 $234=((($233)+($230))|0);
 $235=((_ror32($232,6))|0);
 $236=((_ror32($232,11))|0);
 $237=$236^$235;
 $238=((_ror32($232,25))|0);
 $239=$237^$238;
 $240=((_Ch($232,$211,$190))|0);
 $241=(($W+40)|0);
 $242=((HEAP32[(($241)>>2)])|0);
 $243=((($169)+(607225278))|0);
 $244=((($243)+($239))|0);
 $245=((($244)+($240))|0);
 $246=((($245)+($242))|0);
 $247=((_ror32($234,2))|0);
 $248=((_ror32($234,13))|0);
 $249=$248^$247;
 $250=((_ror32($234,22))|0);
 $251=$249^$250;
 $252=((_Maj($234,$213,$192))|0);
 $253=((($246)+($171))|0);
 $254=((($252)+($246))|0);
 $255=((($254)+($251))|0);
 $256=((_ror32($253,6))|0);
 $257=((_ror32($253,11))|0);
 $258=$257^$256;
 $259=((_ror32($253,25))|0);
 $260=$258^$259;
 $261=((_Ch($253,$232,$211))|0);
 $262=(($W+44)|0);
 $263=((HEAP32[(($262)>>2)])|0);
 $264=((($190)+(1426881987))|0);
 $265=((($264)+($260))|0);
 $266=((($265)+($261))|0);
 $267=((($266)+($263))|0);
 $268=((_ror32($255,2))|0);
 $269=((_ror32($255,13))|0);
 $270=$269^$268;
 $271=((_ror32($255,22))|0);
 $272=$270^$271;
 $273=((_Maj($255,$234,$213))|0);
 $274=((($267)+($192))|0);
 $275=((($273)+($267))|0);
 $276=((($275)+($272))|0);
 $277=((_ror32($274,6))|0);
 $278=((_ror32($274,11))|0);
 $279=$278^$277;
 $280=((_ror32($274,25))|0);
 $281=$279^$280;
 $282=((_Ch($274,$253,$232))|0);
 $283=(($W+48)|0);
 $284=((HEAP32[(($283)>>2)])|0);
 $285=((($211)+(1925078388))|0);
 $286=((($285)+($281))|0);
 $287=((($286)+($282))|0);
 $288=((($287)+($284))|0);
 $289=((_ror32($276,2))|0);
 $290=((_ror32($276,13))|0);
 $291=$290^$289;
 $292=((_ror32($276,22))|0);
 $293=$291^$292;
 $294=((_Maj($276,$255,$234))|0);
 $295=((($288)+($213))|0);
 $296=((($294)+($288))|0);
 $297=((($296)+($293))|0);
 $298=((_ror32($295,6))|0);
 $299=((_ror32($295,11))|0);
 $300=$299^$298;
 $301=((_ror32($295,25))|0);
 $302=$300^$301;
 $303=((_Ch($295,$274,$253))|0);
 $304=(($W+52)|0);
 $305=((HEAP32[(($304)>>2)])|0);
 $306=((($232)-(2132889090))|0);
 $307=((($306)+($302))|0);
 $308=((($307)+($303))|0);
 $309=((($308)+($305))|0);
 $310=((_ror32($297,2))|0);
 $311=((_ror32($297,13))|0);
 $312=$311^$310;
 $313=((_ror32($297,22))|0);
 $314=$312^$313;
 $315=((_Maj($297,$276,$255))|0);
 $316=((($309)+($234))|0);
 $317=((($315)+($309))|0);
 $318=((($317)+($314))|0);
 $319=((_ror32($316,6))|0);
 $320=((_ror32($316,11))|0);
 $321=$320^$319;
 $322=((_ror32($316,25))|0);
 $323=$321^$322;
 $324=((_Ch($316,$295,$274))|0);
 $325=(($W+56)|0);
 $326=((HEAP32[(($325)>>2)])|0);
 $327=((($253)-(1680079193))|0);
 $328=((($327)+($323))|0);
 $329=((($328)+($324))|0);
 $330=((($329)+($326))|0);
 $331=((_ror32($318,2))|0);
 $332=((_ror32($318,13))|0);
 $333=$332^$331;
 $334=((_ror32($318,22))|0);
 $335=$333^$334;
 $336=((_Maj($318,$297,$276))|0);
 $337=((($330)+($255))|0);
 $338=((($336)+($330))|0);
 $339=((($338)+($335))|0);
 $340=((_ror32($337,6))|0);
 $341=((_ror32($337,11))|0);
 $342=$341^$340;
 $343=((_ror32($337,25))|0);
 $344=$342^$343;
 $345=((_Ch($337,$316,$295))|0);
 $346=(($W+60)|0);
 $347=((HEAP32[(($346)>>2)])|0);
 $348=((($274)-(1046744716))|0);
 $349=((($348)+($344))|0);
 $350=((($349)+($345))|0);
 $351=((($350)+($347))|0);
 $352=((_ror32($339,2))|0);
 $353=((_ror32($339,13))|0);
 $354=$353^$352;
 $355=((_ror32($339,22))|0);
 $356=$354^$355;
 $357=((_Maj($339,$318,$297))|0);
 $358=((($351)+($276))|0);
 $359=((($357)+($351))|0);
 $360=((($359)+($356))|0);
 $361=((_ror32($358,6))|0);
 $362=((_ror32($358,11))|0);
 $363=$362^$361;
 $364=((_ror32($358,25))|0);
 $365=$363^$364;
 $366=((_Ch($358,$337,$316))|0);
 $367=(($W+64)|0);
 $368=((HEAP32[(($367)>>2)])|0);
 $369=((($295)-(459576895))|0);
 $370=((($369)+($365))|0);
 $371=((($370)+($366))|0);
 $372=((($371)+($368))|0);
 $373=((_ror32($360,2))|0);
 $374=((_ror32($360,13))|0);
 $375=$374^$373;
 $376=((_ror32($360,22))|0);
 $377=$375^$376;
 $378=((_Maj($360,$339,$318))|0);
 $379=((($372)+($297))|0);
 $380=((($378)+($372))|0);
 $381=((($380)+($377))|0);
 $382=((_ror32($379,6))|0);
 $383=((_ror32($379,11))|0);
 $384=$383^$382;
 $385=((_ror32($379,25))|0);
 $386=$384^$385;
 $387=((_Ch($379,$358,$337))|0);
 $388=(($W+68)|0);
 $389=((HEAP32[(($388)>>2)])|0);
 $390=((($316)-(272742522))|0);
 $391=((($390)+($386))|0);
 $392=((($391)+($387))|0);
 $393=((($392)+($389))|0);
 $394=((_ror32($381,2))|0);
 $395=((_ror32($381,13))|0);
 $396=$395^$394;
 $397=((_ror32($381,22))|0);
 $398=$396^$397;
 $399=((_Maj($381,$360,$339))|0);
 $400=((($393)+($318))|0);
 $401=((($399)+($393))|0);
 $402=((($401)+($398))|0);
 $403=((_ror32($400,6))|0);
 $404=((_ror32($400,11))|0);
 $405=$404^$403;
 $406=((_ror32($400,25))|0);
 $407=$405^$406;
 $408=((_Ch($400,$379,$358))|0);
 $409=(($W+72)|0);
 $410=((HEAP32[(($409)>>2)])|0);
 $411=((($337)+(264347078))|0);
 $412=((($411)+($407))|0);
 $413=((($412)+($408))|0);
 $414=((($413)+($410))|0);
 $415=((_ror32($402,2))|0);
 $416=((_ror32($402,13))|0);
 $417=$416^$415;
 $418=((_ror32($402,22))|0);
 $419=$417^$418;
 $420=((_Maj($402,$381,$360))|0);
 $421=((($414)+($339))|0);
 $422=((($420)+($414))|0);
 $423=((($422)+($419))|0);
 $424=((_ror32($421,6))|0);
 $425=((_ror32($421,11))|0);
 $426=$425^$424;
 $427=((_ror32($421,25))|0);
 $428=$426^$427;
 $429=((_Ch($421,$400,$379))|0);
 $430=(($W+76)|0);
 $431=((HEAP32[(($430)>>2)])|0);
 $432=((($358)+(604807628))|0);
 $433=((($432)+($428))|0);
 $434=((($433)+($429))|0);
 $435=((($434)+($431))|0);
 $436=((_ror32($423,2))|0);
 $437=((_ror32($423,13))|0);
 $438=$437^$436;
 $439=((_ror32($423,22))|0);
 $440=$438^$439;
 $441=((_Maj($423,$402,$381))|0);
 $442=((($435)+($360))|0);
 $443=((($441)+($435))|0);
 $444=((($443)+($440))|0);
 $445=((_ror32($442,6))|0);
 $446=((_ror32($442,11))|0);
 $447=$446^$445;
 $448=((_ror32($442,25))|0);
 $449=$447^$448;
 $450=((_Ch($442,$421,$400))|0);
 $451=(($W+80)|0);
 $452=((HEAP32[(($451)>>2)])|0);
 $453=((($379)+(770255983))|0);
 $454=((($453)+($449))|0);
 $455=((($454)+($450))|0);
 $456=((($455)+($452))|0);
 $457=((_ror32($444,2))|0);
 $458=((_ror32($444,13))|0);
 $459=$458^$457;
 $460=((_ror32($444,22))|0);
 $461=$459^$460;
 $462=((_Maj($444,$423,$402))|0);
 $463=((($456)+($381))|0);
 $464=((($462)+($456))|0);
 $465=((($464)+($461))|0);
 $466=((_ror32($463,6))|0);
 $467=((_ror32($463,11))|0);
 $468=$467^$466;
 $469=((_ror32($463,25))|0);
 $470=$468^$469;
 $471=((_Ch($463,$442,$421))|0);
 $472=(($W+84)|0);
 $473=((HEAP32[(($472)>>2)])|0);
 $474=((($400)+(1249150122))|0);
 $475=((($474)+($470))|0);
 $476=((($475)+($471))|0);
 $477=((($476)+($473))|0);
 $478=((_ror32($465,2))|0);
 $479=((_ror32($465,13))|0);
 $480=$479^$478;
 $481=((_ror32($465,22))|0);
 $482=$480^$481;
 $483=((_Maj($465,$444,$423))|0);
 $484=((($477)+($402))|0);
 $485=((($483)+($477))|0);
 $486=((($485)+($482))|0);
 $487=((_ror32($484,6))|0);
 $488=((_ror32($484,11))|0);
 $489=$488^$487;
 $490=((_ror32($484,25))|0);
 $491=$489^$490;
 $492=((_Ch($484,$463,$442))|0);
 $493=(($W+88)|0);
 $494=((HEAP32[(($493)>>2)])|0);
 $495=((($421)+(1555081692))|0);
 $496=((($495)+($491))|0);
 $497=((($496)+($492))|0);
 $498=((($497)+($494))|0);
 $499=((_ror32($486,2))|0);
 $500=((_ror32($486,13))|0);
 $501=$500^$499;
 $502=((_ror32($486,22))|0);
 $503=$501^$502;
 $504=((_Maj($486,$465,$444))|0);
 $505=((($498)+($423))|0);
 $506=((($504)+($498))|0);
 $507=((($506)+($503))|0);
 $508=((_ror32($505,6))|0);
 $509=((_ror32($505,11))|0);
 $510=$509^$508;
 $511=((_ror32($505,25))|0);
 $512=$510^$511;
 $513=((_Ch($505,$484,$463))|0);
 $514=(($W+92)|0);
 $515=((HEAP32[(($514)>>2)])|0);
 $516=((($442)+(1996064986))|0);
 $517=((($516)+($512))|0);
 $518=((($517)+($513))|0);
 $519=((($518)+($515))|0);
 $520=((_ror32($507,2))|0);
 $521=((_ror32($507,13))|0);
 $522=$521^$520;
 $523=((_ror32($507,22))|0);
 $524=$522^$523;
 $525=((_Maj($507,$486,$465))|0);
 $526=((($519)+($444))|0);
 $527=((($525)+($519))|0);
 $528=((($527)+($524))|0);
 $529=((_ror32($526,6))|0);
 $530=((_ror32($526,11))|0);
 $531=$530^$529;
 $532=((_ror32($526,25))|0);
 $533=$531^$532;
 $534=((_Ch($526,$505,$484))|0);
 $535=(($W+96)|0);
 $536=((HEAP32[(($535)>>2)])|0);
 $537=((($463)-(1740746414))|0);
 $538=((($537)+($533))|0);
 $539=((($538)+($534))|0);
 $540=((($539)+($536))|0);
 $541=((_ror32($528,2))|0);
 $542=((_ror32($528,13))|0);
 $543=$542^$541;
 $544=((_ror32($528,22))|0);
 $545=$543^$544;
 $546=((_Maj($528,$507,$486))|0);
 $547=((($540)+($465))|0);
 $548=((($546)+($540))|0);
 $549=((($548)+($545))|0);
 $550=((_ror32($547,6))|0);
 $551=((_ror32($547,11))|0);
 $552=$551^$550;
 $553=((_ror32($547,25))|0);
 $554=$552^$553;
 $555=((_Ch($547,$526,$505))|0);
 $556=(($W+100)|0);
 $557=((HEAP32[(($556)>>2)])|0);
 $558=((($484)-(1473132947))|0);
 $559=((($558)+($554))|0);
 $560=((($559)+($555))|0);
 $561=((($560)+($557))|0);
 $562=((_ror32($549,2))|0);
 $563=((_ror32($549,13))|0);
 $564=$563^$562;
 $565=((_ror32($549,22))|0);
 $566=$564^$565;
 $567=((_Maj($549,$528,$507))|0);
 $568=((($561)+($486))|0);
 $569=((($567)+($561))|0);
 $570=((($569)+($566))|0);
 $571=((_ror32($568,6))|0);
 $572=((_ror32($568,11))|0);
 $573=$572^$571;
 $574=((_ror32($568,25))|0);
 $575=$573^$574;
 $576=((_Ch($568,$547,$526))|0);
 $577=(($W+104)|0);
 $578=((HEAP32[(($577)>>2)])|0);
 $579=((($505)-(1341970488))|0);
 $580=((($579)+($575))|0);
 $581=((($580)+($576))|0);
 $582=((($581)+($578))|0);
 $583=((_ror32($570,2))|0);
 $584=((_ror32($570,13))|0);
 $585=$584^$583;
 $586=((_ror32($570,22))|0);
 $587=$585^$586;
 $588=((_Maj($570,$549,$528))|0);
 $589=((($582)+($507))|0);
 $590=((($588)+($582))|0);
 $591=((($590)+($587))|0);
 $592=((_ror32($589,6))|0);
 $593=((_ror32($589,11))|0);
 $594=$593^$592;
 $595=((_ror32($589,25))|0);
 $596=$594^$595;
 $597=((_Ch($589,$568,$547))|0);
 $598=(($W+108)|0);
 $599=((HEAP32[(($598)>>2)])|0);
 $600=((($526)-(1084653625))|0);
 $601=((($600)+($596))|0);
 $602=((($601)+($597))|0);
 $603=((($602)+($599))|0);
 $604=((_ror32($591,2))|0);
 $605=((_ror32($591,13))|0);
 $606=$605^$604;
 $607=((_ror32($591,22))|0);
 $608=$606^$607;
 $609=((_Maj($591,$570,$549))|0);
 $610=((($603)+($528))|0);
 $611=((($609)+($603))|0);
 $612=((($611)+($608))|0);
 $613=((_ror32($610,6))|0);
 $614=((_ror32($610,11))|0);
 $615=$614^$613;
 $616=((_ror32($610,25))|0);
 $617=$615^$616;
 $618=((_Ch($610,$589,$568))|0);
 $619=(($W+112)|0);
 $620=((HEAP32[(($619)>>2)])|0);
 $621=((($547)-(958395405))|0);
 $622=((($621)+($617))|0);
 $623=((($622)+($618))|0);
 $624=((($623)+($620))|0);
 $625=((_ror32($612,2))|0);
 $626=((_ror32($612,13))|0);
 $627=$626^$625;
 $628=((_ror32($612,22))|0);
 $629=$627^$628;
 $630=((_Maj($612,$591,$570))|0);
 $631=((($624)+($549))|0);
 $632=((($630)+($624))|0);
 $633=((($632)+($629))|0);
 $634=((_ror32($631,6))|0);
 $635=((_ror32($631,11))|0);
 $636=$635^$634;
 $637=((_ror32($631,25))|0);
 $638=$636^$637;
 $639=((_Ch($631,$610,$589))|0);
 $640=(($W+116)|0);
 $641=((HEAP32[(($640)>>2)])|0);
 $642=((($568)-(710438585))|0);
 $643=((($642)+($638))|0);
 $644=((($643)+($639))|0);
 $645=((($644)+($641))|0);
 $646=((_ror32($633,2))|0);
 $647=((_ror32($633,13))|0);
 $648=$647^$646;
 $649=((_ror32($633,22))|0);
 $650=$648^$649;
 $651=((_Maj($633,$612,$591))|0);
 $652=((($645)+($570))|0);
 $653=((($651)+($645))|0);
 $654=((($653)+($650))|0);
 $655=((_ror32($652,6))|0);
 $656=((_ror32($652,11))|0);
 $657=$656^$655;
 $658=((_ror32($652,25))|0);
 $659=$657^$658;
 $660=((_Ch($652,$631,$610))|0);
 $661=(($W+120)|0);
 $662=((HEAP32[(($661)>>2)])|0);
 $663=((($589)+(113926993))|0);
 $664=((($663)+($659))|0);
 $665=((($664)+($660))|0);
 $666=((($665)+($662))|0);
 $667=((_ror32($654,2))|0);
 $668=((_ror32($654,13))|0);
 $669=$668^$667;
 $670=((_ror32($654,22))|0);
 $671=$669^$670;
 $672=((_Maj($654,$633,$612))|0);
 $673=((($666)+($591))|0);
 $674=((($672)+($666))|0);
 $675=((($674)+($671))|0);
 $676=((_ror32($673,6))|0);
 $677=((_ror32($673,11))|0);
 $678=$677^$676;
 $679=((_ror32($673,25))|0);
 $680=$678^$679;
 $681=((_Ch($673,$652,$631))|0);
 $682=(($W+124)|0);
 $683=((HEAP32[(($682)>>2)])|0);
 $684=((($610)+(338241895))|0);
 $685=((($684)+($680))|0);
 $686=((($685)+($681))|0);
 $687=((($686)+($683))|0);
 $688=((_ror32($675,2))|0);
 $689=((_ror32($675,13))|0);
 $690=$689^$688;
 $691=((_ror32($675,22))|0);
 $692=$690^$691;
 $693=((_Maj($675,$654,$633))|0);
 $694=((($687)+($612))|0);
 $695=((($693)+($687))|0);
 $696=((($695)+($692))|0);
 $697=((_ror32($694,6))|0);
 $698=((_ror32($694,11))|0);
 $699=$698^$697;
 $700=((_ror32($694,25))|0);
 $701=$699^$700;
 $702=((_Ch($694,$673,$652))|0);
 $703=(($W+128)|0);
 $704=((HEAP32[(($703)>>2)])|0);
 $705=((($631)+(666307205))|0);
 $706=((($705)+($701))|0);
 $707=((($706)+($702))|0);
 $708=((($707)+($704))|0);
 $709=((_ror32($696,2))|0);
 $710=((_ror32($696,13))|0);
 $711=$710^$709;
 $712=((_ror32($696,22))|0);
 $713=$711^$712;
 $714=((_Maj($696,$675,$654))|0);
 $715=((($708)+($633))|0);
 $716=((($714)+($708))|0);
 $717=((($716)+($713))|0);
 $718=((_ror32($715,6))|0);
 $719=((_ror32($715,11))|0);
 $720=$719^$718;
 $721=((_ror32($715,25))|0);
 $722=$720^$721;
 $723=((_Ch($715,$694,$673))|0);
 $724=(($W+132)|0);
 $725=((HEAP32[(($724)>>2)])|0);
 $726=((($652)+(773529912))|0);
 $727=((($726)+($722))|0);
 $728=((($727)+($723))|0);
 $729=((($728)+($725))|0);
 $730=((_ror32($717,2))|0);
 $731=((_ror32($717,13))|0);
 $732=$731^$730;
 $733=((_ror32($717,22))|0);
 $734=$732^$733;
 $735=((_Maj($717,$696,$675))|0);
 $736=((($729)+($654))|0);
 $737=((($735)+($729))|0);
 $738=((($737)+($734))|0);
 $739=((_ror32($736,6))|0);
 $740=((_ror32($736,11))|0);
 $741=$740^$739;
 $742=((_ror32($736,25))|0);
 $743=$741^$742;
 $744=((_Ch($736,$715,$694))|0);
 $745=(($W+136)|0);
 $746=((HEAP32[(($745)>>2)])|0);
 $747=((($673)+(1294757372))|0);
 $748=((($747)+($743))|0);
 $749=((($748)+($744))|0);
 $750=((($749)+($746))|0);
 $751=((_ror32($738,2))|0);
 $752=((_ror32($738,13))|0);
 $753=$752^$751;
 $754=((_ror32($738,22))|0);
 $755=$753^$754;
 $756=((_Maj($738,$717,$696))|0);
 $757=((($750)+($675))|0);
 $758=((($756)+($750))|0);
 $759=((($758)+($755))|0);
 $760=((_ror32($757,6))|0);
 $761=((_ror32($757,11))|0);
 $762=$761^$760;
 $763=((_ror32($757,25))|0);
 $764=$762^$763;
 $765=((_Ch($757,$736,$715))|0);
 $766=(($W+140)|0);
 $767=((HEAP32[(($766)>>2)])|0);
 $768=((($694)+(1396182291))|0);
 $769=((($768)+($764))|0);
 $770=((($769)+($765))|0);
 $771=((($770)+($767))|0);
 $772=((_ror32($759,2))|0);
 $773=((_ror32($759,13))|0);
 $774=$773^$772;
 $775=((_ror32($759,22))|0);
 $776=$774^$775;
 $777=((_Maj($759,$738,$717))|0);
 $778=((($771)+($696))|0);
 $779=((($777)+($771))|0);
 $780=((($779)+($776))|0);
 $781=((_ror32($778,6))|0);
 $782=((_ror32($778,11))|0);
 $783=$782^$781;
 $784=((_ror32($778,25))|0);
 $785=$783^$784;
 $786=((_Ch($778,$757,$736))|0);
 $787=(($W+144)|0);
 $788=((HEAP32[(($787)>>2)])|0);
 $789=((($715)+(1695183700))|0);
 $790=((($789)+($785))|0);
 $791=((($790)+($786))|0);
 $792=((($791)+($788))|0);
 $793=((_ror32($780,2))|0);
 $794=((_ror32($780,13))|0);
 $795=$794^$793;
 $796=((_ror32($780,22))|0);
 $797=$795^$796;
 $798=((_Maj($780,$759,$738))|0);
 $799=((($792)+($717))|0);
 $800=((($798)+($792))|0);
 $801=((($800)+($797))|0);
 $802=((_ror32($799,6))|0);
 $803=((_ror32($799,11))|0);
 $804=$803^$802;
 $805=((_ror32($799,25))|0);
 $806=$804^$805;
 $807=((_Ch($799,$778,$757))|0);
 $808=(($W+148)|0);
 $809=((HEAP32[(($808)>>2)])|0);
 $810=((($736)+(1986661051))|0);
 $811=((($810)+($806))|0);
 $812=((($811)+($807))|0);
 $813=((($812)+($809))|0);
 $814=((_ror32($801,2))|0);
 $815=((_ror32($801,13))|0);
 $816=$815^$814;
 $817=((_ror32($801,22))|0);
 $818=$816^$817;
 $819=((_Maj($801,$780,$759))|0);
 $820=((($813)+($738))|0);
 $821=((($819)+($813))|0);
 $822=((($821)+($818))|0);
 $823=((_ror32($820,6))|0);
 $824=((_ror32($820,11))|0);
 $825=$824^$823;
 $826=((_ror32($820,25))|0);
 $827=$825^$826;
 $828=((_Ch($820,$799,$778))|0);
 $829=(($W+152)|0);
 $830=((HEAP32[(($829)>>2)])|0);
 $831=((($757)-(2117940946))|0);
 $832=((($831)+($827))|0);
 $833=((($832)+($828))|0);
 $834=((($833)+($830))|0);
 $835=((_ror32($822,2))|0);
 $836=((_ror32($822,13))|0);
 $837=$836^$835;
 $838=((_ror32($822,22))|0);
 $839=$837^$838;
 $840=((_Maj($822,$801,$780))|0);
 $841=((($834)+($759))|0);
 $842=((($840)+($834))|0);
 $843=((($842)+($839))|0);
 $844=((_ror32($841,6))|0);
 $845=((_ror32($841,11))|0);
 $846=$845^$844;
 $847=((_ror32($841,25))|0);
 $848=$846^$847;
 $849=((_Ch($841,$820,$799))|0);
 $850=(($W+156)|0);
 $851=((HEAP32[(($850)>>2)])|0);
 $852=((($778)-(1838011259))|0);
 $853=((($852)+($848))|0);
 $854=((($853)+($849))|0);
 $855=((($854)+($851))|0);
 $856=((_ror32($843,2))|0);
 $857=((_ror32($843,13))|0);
 $858=$857^$856;
 $859=((_ror32($843,22))|0);
 $860=$858^$859;
 $861=((_Maj($843,$822,$801))|0);
 $862=((($855)+($780))|0);
 $863=((($861)+($855))|0);
 $864=((($863)+($860))|0);
 $865=((_ror32($862,6))|0);
 $866=((_ror32($862,11))|0);
 $867=$866^$865;
 $868=((_ror32($862,25))|0);
 $869=$867^$868;
 $870=((_Ch($862,$841,$820))|0);
 $871=(($W+160)|0);
 $872=((HEAP32[(($871)>>2)])|0);
 $873=((($799)-(1564481375))|0);
 $874=((($873)+($869))|0);
 $875=((($874)+($870))|0);
 $876=((($875)+($872))|0);
 $877=((_ror32($864,2))|0);
 $878=((_ror32($864,13))|0);
 $879=$878^$877;
 $880=((_ror32($864,22))|0);
 $881=$879^$880;
 $882=((_Maj($864,$843,$822))|0);
 $883=((($876)+($801))|0);
 $884=((($882)+($876))|0);
 $885=((($884)+($881))|0);
 $886=((_ror32($883,6))|0);
 $887=((_ror32($883,11))|0);
 $888=$887^$886;
 $889=((_ror32($883,25))|0);
 $890=$888^$889;
 $891=((_Ch($883,$862,$841))|0);
 $892=(($W+164)|0);
 $893=((HEAP32[(($892)>>2)])|0);
 $894=((($820)-(1474664885))|0);
 $895=((($894)+($890))|0);
 $896=((($895)+($891))|0);
 $897=((($896)+($893))|0);
 $898=((_ror32($885,2))|0);
 $899=((_ror32($885,13))|0);
 $900=$899^$898;
 $901=((_ror32($885,22))|0);
 $902=$900^$901;
 $903=((_Maj($885,$864,$843))|0);
 $904=((($897)+($822))|0);
 $905=((($903)+($897))|0);
 $906=((($905)+($902))|0);
 $907=((_ror32($904,6))|0);
 $908=((_ror32($904,11))|0);
 $909=$908^$907;
 $910=((_ror32($904,25))|0);
 $911=$909^$910;
 $912=((_Ch($904,$883,$862))|0);
 $913=(($W+168)|0);
 $914=((HEAP32[(($913)>>2)])|0);
 $915=((($841)-(1035236496))|0);
 $916=((($915)+($911))|0);
 $917=((($916)+($912))|0);
 $918=((($917)+($914))|0);
 $919=((_ror32($906,2))|0);
 $920=((_ror32($906,13))|0);
 $921=$920^$919;
 $922=((_ror32($906,22))|0);
 $923=$921^$922;
 $924=((_Maj($906,$885,$864))|0);
 $925=((($918)+($843))|0);
 $926=((($924)+($918))|0);
 $927=((($926)+($923))|0);
 $928=((_ror32($925,6))|0);
 $929=((_ror32($925,11))|0);
 $930=$929^$928;
 $931=((_ror32($925,25))|0);
 $932=$930^$931;
 $933=((_Ch($925,$904,$883))|0);
 $934=(($W+172)|0);
 $935=((HEAP32[(($934)>>2)])|0);
 $936=((($862)-(949202525))|0);
 $937=((($936)+($932))|0);
 $938=((($937)+($933))|0);
 $939=((($938)+($935))|0);
 $940=((_ror32($927,2))|0);
 $941=((_ror32($927,13))|0);
 $942=$941^$940;
 $943=((_ror32($927,22))|0);
 $944=$942^$943;
 $945=((_Maj($927,$906,$885))|0);
 $946=((($939)+($864))|0);
 $947=((($945)+($939))|0);
 $948=((($947)+($944))|0);
 $949=((_ror32($946,6))|0);
 $950=((_ror32($946,11))|0);
 $951=$950^$949;
 $952=((_ror32($946,25))|0);
 $953=$951^$952;
 $954=((_Ch($946,$925,$904))|0);
 $955=(($W+176)|0);
 $956=((HEAP32[(($955)>>2)])|0);
 $957=((($883)-(778901479))|0);
 $958=((($957)+($953))|0);
 $959=((($958)+($954))|0);
 $960=((($959)+($956))|0);
 $961=((_ror32($948,2))|0);
 $962=((_ror32($948,13))|0);
 $963=$962^$961;
 $964=((_ror32($948,22))|0);
 $965=$963^$964;
 $966=((_Maj($948,$927,$906))|0);
 $967=((($960)+($885))|0);
 $968=((($966)+($960))|0);
 $969=((($968)+($965))|0);
 $970=((_ror32($967,6))|0);
 $971=((_ror32($967,11))|0);
 $972=$971^$970;
 $973=((_ror32($967,25))|0);
 $974=$972^$973;
 $975=((_Ch($967,$946,$925))|0);
 $976=(($W+180)|0);
 $977=((HEAP32[(($976)>>2)])|0);
 $978=((($904)-(694614492))|0);
 $979=((($978)+($974))|0);
 $980=((($979)+($975))|0);
 $981=((($980)+($977))|0);
 $982=((_ror32($969,2))|0);
 $983=((_ror32($969,13))|0);
 $984=$983^$982;
 $985=((_ror32($969,22))|0);
 $986=$984^$985;
 $987=((_Maj($969,$948,$927))|0);
 $988=((($981)+($906))|0);
 $989=((($987)+($981))|0);
 $990=((($989)+($986))|0);
 $991=((_ror32($988,6))|0);
 $992=((_ror32($988,11))|0);
 $993=$992^$991;
 $994=((_ror32($988,25))|0);
 $995=$993^$994;
 $996=((_Ch($988,$967,$946))|0);
 $997=(($W+184)|0);
 $998=((HEAP32[(($997)>>2)])|0);
 $999=((($925)-(200395387))|0);
 $1000=((($999)+($995))|0);
 $1001=((($1000)+($996))|0);
 $1002=((($1001)+($998))|0);
 $1003=((_ror32($990,2))|0);
 $1004=((_ror32($990,13))|0);
 $1005=$1004^$1003;
 $1006=((_ror32($990,22))|0);
 $1007=$1005^$1006;
 $1008=((_Maj($990,$969,$948))|0);
 $1009=((($1002)+($927))|0);
 $1010=((($1008)+($1002))|0);
 $1011=((($1010)+($1007))|0);
 $1012=((_ror32($1009,6))|0);
 $1013=((_ror32($1009,11))|0);
 $1014=$1013^$1012;
 $1015=((_ror32($1009,25))|0);
 $1016=$1014^$1015;
 $1017=((_Ch($1009,$988,$967))|0);
 $1018=(($W+188)|0);
 $1019=((HEAP32[(($1018)>>2)])|0);
 $1020=((($946)+(275423344))|0);
 $1021=((($1020)+($1016))|0);
 $1022=((($1021)+($1017))|0);
 $1023=((($1022)+($1019))|0);
 $1024=((_ror32($1011,2))|0);
 $1025=((_ror32($1011,13))|0);
 $1026=$1025^$1024;
 $1027=((_ror32($1011,22))|0);
 $1028=$1026^$1027;
 $1029=((_Maj($1011,$990,$969))|0);
 $1030=((($1023)+($948))|0);
 $1031=((($1029)+($1023))|0);
 $1032=((($1031)+($1028))|0);
 $1033=((_ror32($1030,6))|0);
 $1034=((_ror32($1030,11))|0);
 $1035=$1034^$1033;
 $1036=((_ror32($1030,25))|0);
 $1037=$1035^$1036;
 $1038=((_Ch($1030,$1009,$988))|0);
 $1039=(($W+192)|0);
 $1040=((HEAP32[(($1039)>>2)])|0);
 $1041=((($967)+(430227734))|0);
 $1042=((($1041)+($1037))|0);
 $1043=((($1042)+($1038))|0);
 $1044=((($1043)+($1040))|0);
 $1045=((_ror32($1032,2))|0);
 $1046=((_ror32($1032,13))|0);
 $1047=$1046^$1045;
 $1048=((_ror32($1032,22))|0);
 $1049=$1047^$1048;
 $1050=((_Maj($1032,$1011,$990))|0);
 $1051=((($1044)+($969))|0);
 $1052=((($1050)+($1044))|0);
 $1053=((($1052)+($1049))|0);
 $1054=((_ror32($1051,6))|0);
 $1055=((_ror32($1051,11))|0);
 $1056=$1055^$1054;
 $1057=((_ror32($1051,25))|0);
 $1058=$1056^$1057;
 $1059=((_Ch($1051,$1030,$1009))|0);
 $1060=(($W+196)|0);
 $1061=((HEAP32[(($1060)>>2)])|0);
 $1062=((($988)+(506948616))|0);
 $1063=((($1062)+($1058))|0);
 $1064=((($1063)+($1059))|0);
 $1065=((($1064)+($1061))|0);
 $1066=((_ror32($1053,2))|0);
 $1067=((_ror32($1053,13))|0);
 $1068=$1067^$1066;
 $1069=((_ror32($1053,22))|0);
 $1070=$1068^$1069;
 $1071=((_Maj($1053,$1032,$1011))|0);
 $1072=((($1065)+($990))|0);
 $1073=((($1071)+($1065))|0);
 $1074=((($1073)+($1070))|0);
 $1075=((_ror32($1072,6))|0);
 $1076=((_ror32($1072,11))|0);
 $1077=$1076^$1075;
 $1078=((_ror32($1072,25))|0);
 $1079=$1077^$1078;
 $1080=((_Ch($1072,$1051,$1030))|0);
 $1081=(($W+200)|0);
 $1082=((HEAP32[(($1081)>>2)])|0);
 $1083=((($1009)+(659060556))|0);
 $1084=((($1083)+($1079))|0);
 $1085=((($1084)+($1080))|0);
 $1086=((($1085)+($1082))|0);
 $1087=((_ror32($1074,2))|0);
 $1088=((_ror32($1074,13))|0);
 $1089=$1088^$1087;
 $1090=((_ror32($1074,22))|0);
 $1091=$1089^$1090;
 $1092=((_Maj($1074,$1053,$1032))|0);
 $1093=((($1086)+($1011))|0);
 $1094=((($1092)+($1086))|0);
 $1095=((($1094)+($1091))|0);
 $1096=((_ror32($1093,6))|0);
 $1097=((_ror32($1093,11))|0);
 $1098=$1097^$1096;
 $1099=((_ror32($1093,25))|0);
 $1100=$1098^$1099;
 $1101=((_Ch($1093,$1072,$1051))|0);
 $1102=(($W+204)|0);
 $1103=((HEAP32[(($1102)>>2)])|0);
 $1104=((($1030)+(883997877))|0);
 $1105=((($1104)+($1100))|0);
 $1106=((($1105)+($1101))|0);
 $1107=((($1106)+($1103))|0);
 $1108=((_ror32($1095,2))|0);
 $1109=((_ror32($1095,13))|0);
 $1110=$1109^$1108;
 $1111=((_ror32($1095,22))|0);
 $1112=$1110^$1111;
 $1113=((_Maj($1095,$1074,$1053))|0);
 $1114=((($1107)+($1032))|0);
 $1115=((($1113)+($1107))|0);
 $1116=((($1115)+($1112))|0);
 $1117=((_ror32($1114,6))|0);
 $1118=((_ror32($1114,11))|0);
 $1119=$1118^$1117;
 $1120=((_ror32($1114,25))|0);
 $1121=$1119^$1120;
 $1122=((_Ch($1114,$1093,$1072))|0);
 $1123=(($W+208)|0);
 $1124=((HEAP32[(($1123)>>2)])|0);
 $1125=((($1051)+(958139571))|0);
 $1126=((($1125)+($1121))|0);
 $1127=((($1126)+($1122))|0);
 $1128=((($1127)+($1124))|0);
 $1129=((_ror32($1116,2))|0);
 $1130=((_ror32($1116,13))|0);
 $1131=$1130^$1129;
 $1132=((_ror32($1116,22))|0);
 $1133=$1131^$1132;
 $1134=((_Maj($1116,$1095,$1074))|0);
 $1135=((($1128)+($1053))|0);
 $1136=((($1134)+($1128))|0);
 $1137=((($1136)+($1133))|0);
 $1138=((_ror32($1135,6))|0);
 $1139=((_ror32($1135,11))|0);
 $1140=$1139^$1138;
 $1141=((_ror32($1135,25))|0);
 $1142=$1140^$1141;
 $1143=((_Ch($1135,$1114,$1093))|0);
 $1144=(($W+212)|0);
 $1145=((HEAP32[(($1144)>>2)])|0);
 $1146=((($1072)+(1322822218))|0);
 $1147=((($1146)+($1142))|0);
 $1148=((($1147)+($1143))|0);
 $1149=((($1148)+($1145))|0);
 $1150=((_ror32($1137,2))|0);
 $1151=((_ror32($1137,13))|0);
 $1152=$1151^$1150;
 $1153=((_ror32($1137,22))|0);
 $1154=$1152^$1153;
 $1155=((_Maj($1137,$1116,$1095))|0);
 $1156=((($1149)+($1074))|0);
 $1157=((($1155)+($1149))|0);
 $1158=((($1157)+($1154))|0);
 $1159=((_ror32($1156,6))|0);
 $1160=((_ror32($1156,11))|0);
 $1161=$1160^$1159;
 $1162=((_ror32($1156,25))|0);
 $1163=$1161^$1162;
 $1164=((_Ch($1156,$1135,$1114))|0);
 $1165=(($W+216)|0);
 $1166=((HEAP32[(($1165)>>2)])|0);
 $1167=((($1093)+(1537002063))|0);
 $1168=((($1167)+($1163))|0);
 $1169=((($1168)+($1164))|0);
 $1170=((($1169)+($1166))|0);
 $1171=((_ror32($1158,2))|0);
 $1172=((_ror32($1158,13))|0);
 $1173=$1172^$1171;
 $1174=((_ror32($1158,22))|0);
 $1175=$1173^$1174;
 $1176=((_Maj($1158,$1137,$1116))|0);
 $1177=((($1170)+($1095))|0);
 $1178=((($1176)+($1170))|0);
 $1179=((($1178)+($1175))|0);
 $1180=((_ror32($1177,6))|0);
 $1181=((_ror32($1177,11))|0);
 $1182=$1181^$1180;
 $1183=((_ror32($1177,25))|0);
 $1184=$1182^$1183;
 $1185=((_Ch($1177,$1156,$1135))|0);
 $1186=(($W+220)|0);
 $1187=((HEAP32[(($1186)>>2)])|0);
 $1188=((($1114)+(1747873779))|0);
 $1189=((($1188)+($1184))|0);
 $1190=((($1189)+($1185))|0);
 $1191=((($1190)+($1187))|0);
 $1192=((_ror32($1179,2))|0);
 $1193=((_ror32($1179,13))|0);
 $1194=$1193^$1192;
 $1195=((_ror32($1179,22))|0);
 $1196=$1194^$1195;
 $1197=((_Maj($1179,$1158,$1137))|0);
 $1198=((($1191)+($1116))|0);
 $1199=((($1197)+($1191))|0);
 $1200=((($1199)+($1196))|0);
 $1201=((_ror32($1198,6))|0);
 $1202=((_ror32($1198,11))|0);
 $1203=$1202^$1201;
 $1204=((_ror32($1198,25))|0);
 $1205=$1203^$1204;
 $1206=((_Ch($1198,$1177,$1156))|0);
 $1207=(($W+224)|0);
 $1208=((HEAP32[(($1207)>>2)])|0);
 $1209=((($1135)+(1955562222))|0);
 $1210=((($1209)+($1205))|0);
 $1211=((($1210)+($1206))|0);
 $1212=((($1211)+($1208))|0);
 $1213=((_ror32($1200,2))|0);
 $1214=((_ror32($1200,13))|0);
 $1215=$1214^$1213;
 $1216=((_ror32($1200,22))|0);
 $1217=$1215^$1216;
 $1218=((_Maj($1200,$1179,$1158))|0);
 $1219=((($1212)+($1137))|0);
 $1220=((($1218)+($1212))|0);
 $1221=((($1220)+($1217))|0);
 $1222=((_ror32($1219,6))|0);
 $1223=((_ror32($1219,11))|0);
 $1224=$1223^$1222;
 $1225=((_ror32($1219,25))|0);
 $1226=$1224^$1225;
 $1227=((_Ch($1219,$1198,$1177))|0);
 $1228=(($W+228)|0);
 $1229=((HEAP32[(($1228)>>2)])|0);
 $1230=((($1156)+(2024104815))|0);
 $1231=((($1230)+($1226))|0);
 $1232=((($1231)+($1227))|0);
 $1233=((($1232)+($1229))|0);
 $1234=((_ror32($1221,2))|0);
 $1235=((_ror32($1221,13))|0);
 $1236=$1235^$1234;
 $1237=((_ror32($1221,22))|0);
 $1238=$1236^$1237;
 $1239=((_Maj($1221,$1200,$1179))|0);
 $1240=((($1233)+($1158))|0);
 $1241=((($1239)+($1233))|0);
 $1242=((($1241)+($1238))|0);
 $1243=((_ror32($1240,6))|0);
 $1244=((_ror32($1240,11))|0);
 $1245=$1244^$1243;
 $1246=((_ror32($1240,25))|0);
 $1247=$1245^$1246;
 $1248=((_Ch($1240,$1219,$1198))|0);
 $1249=(($W+232)|0);
 $1250=((HEAP32[(($1249)>>2)])|0);
 $1251=((($1177)-(2067236844))|0);
 $1252=((($1251)+($1247))|0);
 $1253=((($1252)+($1248))|0);
 $1254=((($1253)+($1250))|0);
 $1255=((_ror32($1242,2))|0);
 $1256=((_ror32($1242,13))|0);
 $1257=$1256^$1255;
 $1258=((_ror32($1242,22))|0);
 $1259=$1257^$1258;
 $1260=((_Maj($1242,$1221,$1200))|0);
 $1261=((($1254)+($1179))|0);
 $1262=((($1260)+($1254))|0);
 $1263=((($1262)+($1259))|0);
 $1264=((_ror32($1261,6))|0);
 $1265=((_ror32($1261,11))|0);
 $1266=$1265^$1264;
 $1267=((_ror32($1261,25))|0);
 $1268=$1266^$1267;
 $1269=((_Ch($1261,$1240,$1219))|0);
 $1270=(($W+236)|0);
 $1271=((HEAP32[(($1270)>>2)])|0);
 $1272=((($1198)-(1933114872))|0);
 $1273=((($1272)+($1268))|0);
 $1274=((($1273)+($1269))|0);
 $1275=((($1274)+($1271))|0);
 $1276=((_ror32($1263,2))|0);
 $1277=((_ror32($1263,13))|0);
 $1278=$1277^$1276;
 $1279=((_ror32($1263,22))|0);
 $1280=$1278^$1279;
 $1281=((_Maj($1263,$1242,$1221))|0);
 $1282=((($1275)+($1200))|0);
 $1283=((($1281)+($1275))|0);
 $1284=((($1283)+($1280))|0);
 $1285=((_ror32($1282,6))|0);
 $1286=((_ror32($1282,11))|0);
 $1287=$1286^$1285;
 $1288=((_ror32($1282,25))|0);
 $1289=$1287^$1288;
 $1290=((_Ch($1282,$1261,$1240))|0);
 $1291=(($W+240)|0);
 $1292=((HEAP32[(($1291)>>2)])|0);
 $1293=((($1219)-(1866530822))|0);
 $1294=((($1293)+($1289))|0);
 $1295=((($1294)+($1290))|0);
 $1296=((($1295)+($1292))|0);
 $1297=((_ror32($1284,2))|0);
 $1298=((_ror32($1284,13))|0);
 $1299=$1298^$1297;
 $1300=((_ror32($1284,22))|0);
 $1301=$1299^$1300;
 $1302=((_Maj($1284,$1263,$1242))|0);
 $1303=((($1296)+($1221))|0);
 $1304=((($1302)+($1296))|0);
 $1305=((($1304)+($1301))|0);
 $1306=((_ror32($1303,6))|0);
 $1307=((_ror32($1303,11))|0);
 $1308=$1307^$1306;
 $1309=((_ror32($1303,25))|0);
 $1310=$1308^$1309;
 $1311=((_Ch($1303,$1282,$1261))|0);
 $1312=(($W+244)|0);
 $1313=((HEAP32[(($1312)>>2)])|0);
 $1314=((($1240)-(1538233109))|0);
 $1315=((($1314)+($1310))|0);
 $1316=((($1315)+($1311))|0);
 $1317=((($1316)+($1313))|0);
 $1318=((_ror32($1305,2))|0);
 $1319=((_ror32($1305,13))|0);
 $1320=$1319^$1318;
 $1321=((_ror32($1305,22))|0);
 $1322=$1320^$1321;
 $1323=((_Maj($1305,$1284,$1263))|0);
 $1324=((($1317)+($1242))|0);
 $1325=((($1323)+($1317))|0);
 $1326=((($1325)+($1322))|0);
 $1327=((_ror32($1324,6))|0);
 $1328=((_ror32($1324,11))|0);
 $1329=$1328^$1327;
 $1330=((_ror32($1324,25))|0);
 $1331=$1329^$1330;
 $1332=((_Ch($1324,$1303,$1282))|0);
 $1333=(($W+248)|0);
 $1334=((HEAP32[(($1333)>>2)])|0);
 $1335=((($1261)-(1090935817))|0);
 $1336=((($1335)+($1331))|0);
 $1337=((($1336)+($1332))|0);
 $1338=((($1337)+($1334))|0);
 $1339=((_ror32($1326,2))|0);
 $1340=((_ror32($1326,13))|0);
 $1341=$1340^$1339;
 $1342=((_ror32($1326,22))|0);
 $1343=$1341^$1342;
 $1344=((_Maj($1326,$1305,$1284))|0);
 $1345=((($1338)+($1263))|0);
 $1346=((($1344)+($1338))|0);
 $1347=((($1346)+($1343))|0);
 $1348=((_ror32($1345,6))|0);
 $1349=((_ror32($1345,11))|0);
 $1350=$1349^$1348;
 $1351=((_ror32($1345,25))|0);
 $1352=$1350^$1351;
 $1353=((_Ch($1345,$1324,$1303))|0);
 $1354=(($W+252)|0);
 $1355=((HEAP32[(($1354)>>2)])|0);
 $1356=((($1282)-(965641998))|0);
 $1357=((($1356)+($1352))|0);
 $1358=((($1357)+($1353))|0);
 $1359=((($1358)+($1355))|0);
 $1360=((_ror32($1347,2))|0);
 $1361=((_ror32($1347,13))|0);
 $1362=$1361^$1360;
 $1363=((_ror32($1347,22))|0);
 $1364=$1362^$1363;
 $1365=((_Maj($1347,$1326,$1305))|0);
 $1366=((($1359)+($1284))|0);
 $1367=((($1359)+($10))|0);
 $1368=((($1367)+($1365))|0);
 $1369=((($1368)+($1364))|0);
 HEAP32[(($state)>>2)]=$1369;
 $1370=((HEAP32[(($11)>>2)])|0);
 $1371=((($1370)+($1347))|0);
 HEAP32[(($11)>>2)]=$1371;
 $1372=((HEAP32[(($13)>>2)])|0);
 $1373=((($1372)+($1326))|0);
 HEAP32[(($13)>>2)]=$1373;
 $1374=((HEAP32[(($15)>>2)])|0);
 $1375=((($1374)+($1305))|0);
 HEAP32[(($15)>>2)]=$1375;
 $1376=((HEAP32[(($17)>>2)])|0);
 $1377=((($1366)+($1376))|0);
 HEAP32[(($17)>>2)]=$1377;
 $1378=((HEAP32[(($19)>>2)])|0);
 $1379=((($1378)+($1345))|0);
 HEAP32[(($19)>>2)]=$1379;
 $1380=((HEAP32[(($21)>>2)])|0);
 $1381=((($1380)+($1324))|0);
 HEAP32[(($21)>>2)]=$1381;
 $1382=((HEAP32[(($23)>>2)])|0);
 $1383=((($1382)+($1303))|0);
 HEAP32[(($23)>>2)]=$1383;
 STACKTOP=sp;return;
}
function _LOAD_OP($I,$W,$input){
 $I=($I)|0;
 $W=($W)|0;
 $input=($input)|0;
 var $1=0,$2=0,$3=0,$4=0,label=0;
 $1=$input;
 $2=(($1+($I<<2))|0);
 $3=((HEAP32[(($2)>>2)])|0);
 $4=(($W+($I<<2))|0);
 HEAP32[(($4)>>2)]=$3;
 return;
}
function _BLEND_OP($I,$W){
 $I=($I)|0;
 $W=($W)|0;
 var $1=0,$2=0,$3=0,$4=0,$5=0,$6=0,$7=0,$8=0,$9=0,$10=0,$11=0,$12=0,$13=0,$14=0,$15=0,$16=0,$17=0,$18=0,$19=0,$20=0;
 var $21=0,$22=0,$23=0,$24=0,$25=0,$26=0,label=0;
 $1=((($I)-(2))|0);
 $2=(($W+($1<<2))|0);
 $3=((HEAP32[(($2)>>2)])|0);
 $4=((_ror32($3,17))|0);
 $5=((_ror32($3,19))|0);
 $6=$3>>>10;
 $7=$6^$4;
 $8=$7^$5;
 $9=((($I)-(7))|0);
 $10=(($W+($9<<2))|0);
 $11=((HEAP32[(($10)>>2)])|0);
 $12=((($8)+($11))|0);
 $13=((($I)-(15))|0);
 $14=(($W+($13<<2))|0);
 $15=((HEAP32[(($14)>>2)])|0);
 $16=((_ror32($15,7))|0);
 $17=((_ror32($15,18))|0);
 $18=$15>>>3;
 $19=$18^$16;
 $20=$19^$17;
 $21=((($12)+($20))|0);
 $22=((($I)-(16))|0);
 $23=(($W+($22<<2))|0);
 $24=((HEAP32[(($23)>>2)])|0);
 $25=((($21)+($24))|0);
 $26=(($W+($I<<2))|0);
 HEAP32[(($26)>>2)]=$25;
 return;
}
function _ror32($word,$shift){
 $word=($word)|0;
 $shift=($shift)|0;
 var $1=0,$2=0,$3=0,$4=0,label=0;
 $1=$word>>>($shift>>>0);
 $2=(((32)-($shift))|0);
 $3=$word<<$2;
 $4=$3|$1;
 return (($4)|0);
}
function _Ch($x,$y,$z){
 $x=($x)|0;
 $y=($y)|0;
 $z=($z)|0;
 var $1=0,$2=0,$3=0,label=0;
 $1=$z^$y;
 $2=$1&$x;
 $3=$2^$z;
 return (($3)|0);
}
function _Maj($x,$y,$z){
 $x=($x)|0;
 $y=($y)|0;
 $z=($z)|0;
 var $1=0,$2=0,$3=0,$4=0,label=0;
 $1=$y&$x;
 $2=$y|$x;
 $3=$2&$z;
 $4=$3|$1;
 return (($4)|0);
}
function _strlen(ptr) {
    ptr = ptr|0;
    var curr = 0;
    curr = ptr;
    while (((HEAP8[(curr)])|0)) {
      curr = (curr + 1)|0;
    }
    return (curr - ptr)|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[(ptr)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[(ptr)]=value;
      ptr = (ptr+1)|0;
    }
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[(dest)]=((HEAP8[(src)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[(dest)]=((HEAP8[(src)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
// EMSCRIPTEN_END_FUNCS
  function dynCall_ii(index,a1) {
    index = index|0;
    a1=a1|0;
    return FUNCTION_TABLE_ii[index&1](a1|0)|0;
  }
  function dynCall_v(index) {
    index = index|0;
    FUNCTION_TABLE_v[index&1]();
  }
  function dynCall_iii(index,a1,a2) {
    index = index|0;
    a1=a1|0; a2=a2|0;
    return FUNCTION_TABLE_iii[index&1](a1|0,a2|0)|0;
  }
  function dynCall_vi(index,a1) {
    index = index|0;
    a1=a1|0;
    FUNCTION_TABLE_vi[index&1](a1|0);
  }
function b0(p0) { p0 = p0|0; abort(0); return 0 }
  function b1() { ; abort(1);  }
  function b2(p0,p1) { p0 = p0|0;p1 = p1|0; abort(2); return 0 }
  function b3(p0) { p0 = p0|0; abort(3);  }
  // EMSCRIPTEN_END_FUNCS
  var FUNCTION_TABLE_ii = [b0,b0];
  var FUNCTION_TABLE_v = [b1,b1];
  var FUNCTION_TABLE_iii = [b2,b2];
  var FUNCTION_TABLE_vi = [b3,b3];
  return { _strlen: _strlen, _memset: _memset, _mine: _mine, _memcpy: _memcpy, _nonce: _nonce, _proof: _proof, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, setThrew: setThrew, setTempRet0: setTempRet0, setTempRet1: setTempRet1, setTempRet2: setTempRet2, setTempRet3: setTempRet3, setTempRet4: setTempRet4, setTempRet5: setTempRet5, setTempRet6: setTempRet6, setTempRet7: setTempRet7, setTempRet8: setTempRet8, setTempRet9: setTempRet9, dynCall_ii: dynCall_ii, dynCall_v: dynCall_v, dynCall_iii: dynCall_iii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
({ "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array }, { "abort": abort, "assert": assert, "asmPrintInt": asmPrintInt, "asmPrintFloat": asmPrintFloat, "min": Math_min, "invoke_ii": invoke_ii, "invoke_v": invoke_v, "invoke_iii": invoke_iii, "invoke_vi": invoke_vi, "_malloc": _malloc, "_sscanf": _sscanf, "_snprintf": _snprintf, "__scanString": __scanString, "__getFloat": __getFloat, "_fprintf": _fprintf, "_printf": _printf, "_fflush": _fflush, "__reallyNegative": __reallyNegative, "_fputc": _fputc, "_puts": _puts, "___setErrNo": ___setErrNo, "_fwrite": _fwrite, "_send": _send, "_write": _write, "_fputs": _fputs, "_sprintf": _sprintf, "__formatString": __formatString, "_free": _free, "_pwrite": _pwrite, "_llvm_bswap_i32": _llvm_bswap_i32, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "NaN": NaN, "Infinity": Infinity }, buffer);
var _strlen = Module["_strlen"] = asm["_strlen"];
var _memset = Module["_memset"] = asm["_memset"];
var _mine = Module["_mine"] = asm["_mine"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _nonce = Module["_nonce"] = asm["_nonce"];
var _proof = Module["_proof"] = asm["_proof"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
Runtime.stackAlloc = function(size) { return asm['stackAlloc'](size) };
Runtime.stackSave = function() { return asm['stackSave']() };
Runtime.stackRestore = function(top) { asm['stackRestore'](top) };
// Warning: printing of i64 values may be slightly rounded! No deep i64 math used, so precise i64 code not included
var i64Math = null;
// === Auto-generated postamble setup entry stuff ===
if (memoryInitializer) {
  function applyData(data) {
    HEAPU8.set(data, STATIC_BASE);
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    applyData(Module['readBinary'](memoryInitializer));
  } else {
    addRunDependency('memory initializer');
    Browser.asyncLoad(memoryInitializer, function(data) {
      applyData(data);
      removeRunDependency('memory initializer');
    }, function(data) {
      throw 'could not load memory initializer ' + memoryInitializer;
    });
  }
}
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;
var initialStackTop;
var preloadStartTime = null;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun'] && shouldRunNow) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}
Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');
  args = args || [];
  if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
    Module.printErr('preload time: ' + (Date.now() - preloadStartTime) + ' ms');
  }
  ensureInitRuntime();
  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);
  initialStackTop = STACKTOP;
  try {
    var ret = Module['_main'](argc, argv, 0);
    // if we're not running an evented main loop, it's time to exit
    if (!Module['noExitRuntime']) {
      exit(ret);
    }
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}
function run(args) {
  args = args || Module['arguments'];
  if (preloadStartTime === null) preloadStartTime = Date.now();
  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }
  preRun();
  if (runDependencies > 0) {
    // a preRun added a dependency, run will be called later
    return;
  }
  function doRun() {
    ensureInitRuntime();
    preMain();
    Module['calledRun'] = true;
    if (Module['_main'] && shouldRunNow) {
      Module['callMain'](args);
    }
    postRun();
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      if (!ABORT) doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;
function exit(status) {
  ABORT = true;
  EXITSTATUS = status;
  STACKTOP = initialStackTop;
  // exit the runtime
  exitRuntime();
  // TODO We should handle this differently based on environment.
  // In the browser, the best we can do is throw an exception
  // to halt execution, but in node we could process.exit and
  // I'd imagine SM shell would have something equivalent.
  // This would let us set a proper exit status (which
  // would be great for checking test exit statuses).
  // https://github.com/kripken/emscripten/issues/1371
  // throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;
function abort(text) {
  if (text) {
    Module.print(text);
    Module.printErr(text);
  }
  ABORT = true;
  EXITSTATUS = 1;
  throw 'abort() at ' + stackTrace();
}
Module['abort'] = Module.abort = abort;
// {{PRE_RUN_ADDITIONS}}
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}
// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}
run();
// {{POST_RUN_ADDITIONS}}
// {{MODULE_ADDITIONS}}
