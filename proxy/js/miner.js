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
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

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
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');

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

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
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
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
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
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
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
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
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
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
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
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }
  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

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
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
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
      HEAP8[((ptr++)>>0)]=0;
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
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
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
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

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


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
      return func;
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
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
var runtimeExited = false;


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
  runtimeExited = true;
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
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

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
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
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


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

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
var Math_clz32 = Math.clz32;

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

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

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
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;




// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 4864;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([103,230,9,106,133,174,103,187,114,243,110,60,58,245,79,165,127,82,14,81,140,104,5,155,171,217,131,31,25,205,224,91,2,0,0,192,3,0,0,192,4,0,0,192,5,0,0,192,6,0,0,192,7,0,0,192,8,0,0,192,9,0,0,192,10,0,0,192,11,0,0,192,12,0,0,192,13,0,0,192,14,0,0,192,15,0,0,192,16,0,0,192,17,0,0,192,18,0,0,192,19,0,0,192,20,0,0,192,21,0,0,192,22,0,0,192,23,0,0,192,24,0,0,192,25,0,0,192,26,0,0,192,27,0,0,192,28,0,0,192,29,0,0,192,30,0,0,192,31,0,0,192,0,0,0,179,1,0,0,195,2,0,0,195,3,0,0,195,4,0,0,195,5,0,0,195,6,0,0,195,7,0,0,195,8,0,0,195,9,0,0,195,10,0,0,195,11,0,0,195,12,0,0,195,13,0,0,211,14,0,0,195,15,0,0,195,0,0,12,187,1,0,12,195,2,0,12,195,3,0,12,195,4,0,12,211,248,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,244,14,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,100,0,0,0,232,3,0,0,16,39,0,0,160,134,1,0,64,66,15,0,128,150,152,0,0,225,245,5,37,48,50,120,0,37,120,0,104,101,120,50,98,105,110,32,115,115,99,97,110,102,32,39,37,115,39,32,102,97,105,108,101,100,10,0,104,101,120,50,98,105,110,32,115,116,114,32,116,114,117,110,99,97,116,101,100,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,3,4,5,6,7,8,9,255,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,4,7,3,6,5,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,78,65,78,0,46,0,105,110,102,105,110,105,116,121,0,110,97,110,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

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

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  function ___lock() {}

  function ___unlock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  var _llvm_fabs_f64=Math_abs;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

   
  Module["_llvm_bswap_i32"] = _llvm_bswap_i32;

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
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

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "___lock": ___lock, "_pthread_self": _pthread_self, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "_sbrk": _sbrk, "_time": _time, "_llvm_fabs_f64": _llvm_fabs_f64, "_pthread_cleanup_push": _pthread_cleanup_push, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall140": ___syscall140, "_sysconf": _sysconf, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
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
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
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
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var ___lock=env.___lock;
  var _pthread_self=env._pthread_self;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _llvm_fabs_f64=env._llvm_fabs_f64;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall140=env.___syscall140;
  var _sysconf=env._sysconf;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
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
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
  HEAP8[tempDoublePtr+4>>0] = HEAP8[ptr+4>>0];
  HEAP8[tempDoublePtr+5>>0] = HEAP8[ptr+5>>0];
  HEAP8[tempDoublePtr+6>>0] = HEAP8[ptr+6>>0];
  HEAP8[tempDoublePtr+7>>0] = HEAP8[ptr+7>>0];
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _bin2hex($source,$length,$target) {
 $source = $source|0;
 $length = $length|0;
 $target = $target|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $exitcond = 0, $i$01 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = ($length|0)==(0);
 if (!($0)) {
  $i$01 = 0;
  while(1) {
   $1 = $i$01 << 1;
   $2 = (($target) + ($1)|0);
   $3 = (($source) + ($i$01)|0);
   $4 = HEAP8[$3>>0]|0;
   $5 = $4&255;
   HEAP32[$vararg_buffer>>2] = $5;
   (_sprintf($2,508,$vararg_buffer)|0);
   $6 = (($i$01) + 1)|0;
   $exitcond = ($6|0)==($length|0);
   if ($exitcond) {
    break;
   } else {
    $i$01 = $6;
   }
  }
 }
 $7 = $length << 1;
 $8 = (($target) + ($7)|0);
 HEAP8[$8>>0] = 0;
 STACKTOP = sp;return;
}
function _hex2bin($p,$hexstr,$len) {
 $p = $p|0;
 $hexstr = $hexstr|0;
 $len = $len|0;
 var $$01$lcssa = 0, $$0115 = 0, $$0214 = 0, $$0413 = 0, $$2 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $hex_byte = 0, $v = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $hex_byte = sp + 16|0;
 $v = sp + 12|0;
 $0 = HEAP8[$hexstr>>0]|0;
 $1 = ($0<<24>>24)!=(0);
 $2 = ($len|0)!=(0);
 $3 = $2 & $1;
 L1: do {
  if ($3) {
   $4 = ((($hex_byte)) + 1|0);
   $5 = ((($hex_byte)) + 2|0);
   $$0115 = $len;$$0214 = $hexstr;$$0413 = $p;
   while(1) {
    $6 = ((($$0214)) + 1|0);
    $7 = HEAP8[$6>>0]|0;
    $8 = ($7<<24>>24)==(0);
    if ($8) {
     label = 4;
     break;
    }
    $9 = HEAP8[$$0214>>0]|0;
    HEAP8[$hex_byte>>0] = $9;
    $10 = HEAP8[$6>>0]|0;
    HEAP8[$4>>0] = $10;
    HEAP8[$5>>0] = 0;
    HEAP32[$vararg_buffer>>2] = $v;
    $11 = (_sscanf($hex_byte,513,$vararg_buffer)|0);
    $12 = ($11|0)==(1);
    if (!($12)) {
     label = 6;
     break;
    }
    $13 = HEAP32[$v>>2]|0;
    $14 = $13&255;
    HEAP8[$$0413>>0] = $14;
    $15 = ((($$0413)) + 1|0);
    $16 = ((($$0214)) + 2|0);
    $17 = (($$0115) + -1)|0;
    $18 = HEAP8[$16>>0]|0;
    $19 = ($18<<24>>24)!=(0);
    $20 = ($17|0)!=(0);
    $21 = $20 & $19;
    if ($21) {
     $$0115 = $17;$$0214 = $16;$$0413 = $15;
    } else {
     $$01$lcssa = $17;
     break L1;
    }
   }
   if ((label|0) == 4) {
    (_puts(544)|0);
   }
   else if ((label|0) == 6) {
    HEAP32[$vararg_buffer1>>2] = $hex_byte;
    (_printf(516,$vararg_buffer1)|0);
   }
   $$2 = 0;
   STACKTOP = sp;return ($$2|0);
  } else {
   $$01$lcssa = $len;
  }
 } while(0);
 $22 = ($$01$lcssa|0)==(0);
 $23 = $22&1;
 $$2 = $23;
 STACKTOP = sp;return ($$2|0);
}
function _fulltest($hash,$target) {
 $hash = $hash|0;
 $target = $target|0;
 var $$not = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $hash_swap = 0, $i$02 = 0, $or$cond = 0, $rc$2 = 0, $target_swap = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $hash_swap = sp + 32|0;
 $target_swap = sp;
 _swap256($hash_swap,$hash);
 _swap256($target_swap,$target);
 $i$02 = 0;
 while(1) {
  $0 = (($hash_swap) + ($i$02<<2)|0);
  $1 = HEAP32[$0>>2]|0;
  $2 = (_llvm_bswap_i32(($1|0))|0);
  $3 = (($target_swap) + ($i$02<<2)|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = (_llvm_bswap_i32(($4|0))|0);
  HEAP32[$3>>2] = $5;
  $6 = ($2>>>0)>($4>>>0);
  if ($6) {
   $rc$2 = 0;
   label = 4;
   break;
  }
  $7 = (($i$02) + 1)|0;
  $$not = ($2>>>0)>=($4>>>0);
  $8 = ($7|0)<(8);
  $or$cond = $$not & $8;
  if ($or$cond) {
   $i$02 = $7;
  } else {
   $rc$2 = 1;
   label = 4;
   break;
  }
 }
 if ((label|0) == 4) {
  STACKTOP = sp;return ($rc$2|0);
 }
 return (0)|0;
}
function _swap256($dest_p,$src_p) {
 $dest_p = $dest_p|0;
 $src_p = $src_p|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($src_p)) + 28|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$dest_p>>2] = $1;
 $2 = ((($src_p)) + 24|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ((($dest_p)) + 4|0);
 HEAP32[$4>>2] = $3;
 $5 = ((($src_p)) + 20|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($dest_p)) + 8|0);
 HEAP32[$7>>2] = $6;
 $8 = ((($src_p)) + 16|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($dest_p)) + 12|0);
 HEAP32[$10>>2] = $9;
 $11 = ((($src_p)) + 12|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($dest_p)) + 16|0);
 HEAP32[$13>>2] = $12;
 $14 = ((($src_p)) + 8|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($dest_p)) + 20|0);
 HEAP32[$16>>2] = $15;
 $17 = ((($src_p)) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ((($dest_p)) + 24|0);
 HEAP32[$19>>2] = $18;
 $20 = HEAP32[$src_p>>2]|0;
 $21 = ((($dest_p)) + 28|0);
 HEAP32[$21>>2] = $20;
 return;
}
function _scanhash($midstate,$data,$hash1,$hash,$target,$min_nonce,$max_nonce,$last_nonce,$restart) {
 $midstate = $midstate|0;
 $data = $data|0;
 $hash1 = $hash1|0;
 $hash = $hash|0;
 $target = $target|0;
 $min_nonce = $min_nonce|0;
 $max_nonce = $max_nonce|0;
 $last_nonce = $last_nonce|0;
 $restart = $restart|0;
 var $$0 = 0, $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $n$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($data)) + 64|0);
 $1 = ((($data)) + 76|0);
 $2 = ((($hash)) + 28|0);
 $n$0 = $min_nonce;
 while(1) {
  $3 = (($n$0) + 1)|0;
  HEAP32[$1>>2] = $3;
  _runhash($hash1,$0,$midstate);
  _runhash($hash,$hash1,8);
  $4 = HEAP32[$2>>2]|0;
  $5 = ($4|0)==(0);
  if ($5) {
   $6 = (_fulltest($hash,$target)|0);
   $7 = ($6|0)==(0);
   if (!($7)) {
    $$0 = 1;$$lcssa = $3;
    break;
   }
  }
  $8 = ($3>>>0)<($max_nonce>>>0);
  if (!($8)) {
   $$0 = 0;$$lcssa = $3;
   break;
  }
  $9 = HEAP32[$restart>>2]|0;
  $10 = ($9|0)==(0);
  if ($10) {
   $n$0 = $3;
  } else {
   $$0 = 0;$$lcssa = $3;
   break;
  }
 }
 HEAP32[$last_nonce>>2] = $$lcssa;
 return ($$0|0);
}
function _runhash($state,$input,$init) {
 $state = $state|0;
 $input = $input|0;
 $init = $init|0;
 var dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 dest=$state; src=$init; stop=dest+32|0; do { HEAP8[dest>>0]=HEAP8[src>>0]|0; dest=dest+1|0; src=src+1|0; } while ((dest|0) < (stop|0));
 _sha256_transform($state,$input);
 return;
}
function _mine($hash1String,$dataString,$midstateString,$targetString,$minNonce,$maxNonce,$proof) {
 $hash1String = $hash1String|0;
 $dataString = $dataString|0;
 $midstateString = $midstateString|0;
 $targetString = $targetString|0;
 $minNonce = $minNonce|0;
 $maxNonce = $maxNonce|0;
 $proof = $proof|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $data = 0, $hash = 0, $hash1 = 0, $midstate = 0, $nonce = 0, $target = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 304|0;
 $nonce = sp;
 $hash1 = sp + 232|0;
 $data = sp + 104|0;
 $midstate = sp + 72|0;
 $target = sp + 40|0;
 $hash = sp + 8|0;
 (_hex2bin($hash1,$hash1String,64)|0);
 (_hex2bin($data,$dataString,128)|0);
 (_hex2bin($midstate,$midstateString,32)|0);
 (_hex2bin($target,$targetString,32)|0);
 dest=$hash; stop=dest+32|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0));
 $0 = (_scanhash($midstate,$data,$hash1,$hash,$target,$minNonce,$maxNonce,$nonce,3268)|0);
 HEAP8[$proof>>0] = 0;
 $1 = ((($proof)) + 256|0);
 HEAP8[$1>>0] = 0;
 $2 = ($0|0)==(0);
 if ($2) {
  $3 = HEAP32[$nonce>>2]|0;
  STACKTOP = sp;return ($3|0);
 }
 _bin2hex($data,128,$proof);
 $3 = HEAP32[$nonce>>2]|0;
 STACKTOP = sp;return ($3|0);
}
function _sha256_transform($state,$input) {
 $state = $state|0;
 $input = $input|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0;
 var $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0;
 var $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0;
 var $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0;
 var $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0;
 var $1088 = 0, $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0;
 var $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0;
 var $1123 = 0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0;
 var $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0;
 var $116 = 0, $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0;
 var $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0;
 var $1196 = 0, $1197 = 0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0;
 var $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0;
 var $1231 = 0, $1232 = 0, $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0;
 var $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0;
 var $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0;
 var $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0;
 var $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0;
 var $1321 = 0, $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0;
 var $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0;
 var $1358 = 0, $1359 = 0, $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $138 = 0;
 var $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0;
 var $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0;
 var $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0;
 var $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0;
 var $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0;
 var $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0;
 var $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0;
 var $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0;
 var $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0;
 var $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0;
 var $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0;
 var $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0;
 var $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0;
 var $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0;
 var $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0;
 var $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0;
 var $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0;
 var $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0;
 var $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0;
 var $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0;
 var $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0;
 var $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0;
 var $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0;
 var $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0;
 var $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0;
 var $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0;
 var $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0;
 var $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0;
 var $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0;
 var $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0;
 var $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0;
 var $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0;
 var $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0;
 var $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0;
 var $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0;
 var $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0;
 var $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0;
 var $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0;
 var $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0;
 var $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0;
 var $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0;
 var $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0;
 var $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0;
 var $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0;
 var $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0;
 var $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $W = 0, $exitcond = 0, $exitcond3 = 0, $i$02 = 0, $i$11 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $W = sp;
 $i$02 = 0;
 while(1) {
  _LOAD_OP($i$02,$W,$input);
  $0 = (($i$02) + 1)|0;
  $exitcond3 = ($0|0)==(16);
  if ($exitcond3) {
   break;
  } else {
   $i$02 = $0;
  }
 }
 $i$11 = 16;
 while(1) {
  _BLEND_OP($i$11,$W);
  $1 = (($i$11) + 1)|0;
  $exitcond = ($1|0)==(64);
  if ($exitcond) {
   break;
  } else {
   $i$11 = $1;
  }
 }
 $2 = HEAP32[$state>>2]|0;
 $3 = ((($state)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($state)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($state)) + 12|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($state)) + 16|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ((($state)) + 20|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($state)) + 24|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($state)) + 28|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (_ror32($10,6)|0);
 $18 = (_ror32($10,11)|0);
 $19 = $18 ^ $17;
 $20 = (_ror32($10,25)|0);
 $21 = $19 ^ $20;
 $22 = (_Ch($10,$12,$14)|0);
 $23 = HEAP32[$W>>2]|0;
 $24 = (($16) + 1116352408)|0;
 $25 = (($24) + ($21))|0;
 $26 = (($25) + ($22))|0;
 $27 = (($26) + ($23))|0;
 $28 = (_ror32($2,2)|0);
 $29 = (_ror32($2,13)|0);
 $30 = $29 ^ $28;
 $31 = (_ror32($2,22)|0);
 $32 = $30 ^ $31;
 $33 = (_Maj($2,$4,$6)|0);
 $34 = (($27) + ($8))|0;
 $35 = (($33) + ($27))|0;
 $36 = (($35) + ($32))|0;
 $37 = (_ror32($34,6)|0);
 $38 = (_ror32($34,11)|0);
 $39 = $38 ^ $37;
 $40 = (_ror32($34,25)|0);
 $41 = $39 ^ $40;
 $42 = (_Ch($34,$10,$12)|0);
 $43 = ((($W)) + 4|0);
 $44 = HEAP32[$43>>2]|0;
 $45 = (($14) + 1899447441)|0;
 $46 = (($45) + ($41))|0;
 $47 = (($46) + ($42))|0;
 $48 = (($47) + ($44))|0;
 $49 = (_ror32($36,2)|0);
 $50 = (_ror32($36,13)|0);
 $51 = $50 ^ $49;
 $52 = (_ror32($36,22)|0);
 $53 = $51 ^ $52;
 $54 = (_Maj($36,$2,$4)|0);
 $55 = (($48) + ($6))|0;
 $56 = (($54) + ($48))|0;
 $57 = (($56) + ($53))|0;
 $58 = (_ror32($55,6)|0);
 $59 = (_ror32($55,11)|0);
 $60 = $59 ^ $58;
 $61 = (_ror32($55,25)|0);
 $62 = $60 ^ $61;
 $63 = (_Ch($55,$34,$10)|0);
 $64 = ((($W)) + 8|0);
 $65 = HEAP32[$64>>2]|0;
 $66 = (($12) + -1245643825)|0;
 $67 = (($66) + ($62))|0;
 $68 = (($67) + ($63))|0;
 $69 = (($68) + ($65))|0;
 $70 = (_ror32($57,2)|0);
 $71 = (_ror32($57,13)|0);
 $72 = $71 ^ $70;
 $73 = (_ror32($57,22)|0);
 $74 = $72 ^ $73;
 $75 = (_Maj($57,$36,$2)|0);
 $76 = (($69) + ($4))|0;
 $77 = (($75) + ($69))|0;
 $78 = (($77) + ($74))|0;
 $79 = (_ror32($76,6)|0);
 $80 = (_ror32($76,11)|0);
 $81 = $80 ^ $79;
 $82 = (_ror32($76,25)|0);
 $83 = $81 ^ $82;
 $84 = (_Ch($76,$55,$34)|0);
 $85 = ((($W)) + 12|0);
 $86 = HEAP32[$85>>2]|0;
 $87 = (($10) + -373957723)|0;
 $88 = (($87) + ($83))|0;
 $89 = (($88) + ($84))|0;
 $90 = (($89) + ($86))|0;
 $91 = (_ror32($78,2)|0);
 $92 = (_ror32($78,13)|0);
 $93 = $92 ^ $91;
 $94 = (_ror32($78,22)|0);
 $95 = $93 ^ $94;
 $96 = (_Maj($78,$57,$36)|0);
 $97 = (($90) + ($2))|0;
 $98 = (($96) + ($90))|0;
 $99 = (($98) + ($95))|0;
 $100 = (_ror32($97,6)|0);
 $101 = (_ror32($97,11)|0);
 $102 = $101 ^ $100;
 $103 = (_ror32($97,25)|0);
 $104 = $102 ^ $103;
 $105 = (_Ch($97,$76,$55)|0);
 $106 = ((($W)) + 16|0);
 $107 = HEAP32[$106>>2]|0;
 $108 = (($34) + 961987163)|0;
 $109 = (($108) + ($104))|0;
 $110 = (($109) + ($105))|0;
 $111 = (($110) + ($107))|0;
 $112 = (_ror32($99,2)|0);
 $113 = (_ror32($99,13)|0);
 $114 = $113 ^ $112;
 $115 = (_ror32($99,22)|0);
 $116 = $114 ^ $115;
 $117 = (_Maj($99,$78,$57)|0);
 $118 = (($111) + ($36))|0;
 $119 = (($117) + ($111))|0;
 $120 = (($119) + ($116))|0;
 $121 = (_ror32($118,6)|0);
 $122 = (_ror32($118,11)|0);
 $123 = $122 ^ $121;
 $124 = (_ror32($118,25)|0);
 $125 = $123 ^ $124;
 $126 = (_Ch($118,$97,$76)|0);
 $127 = ((($W)) + 20|0);
 $128 = HEAP32[$127>>2]|0;
 $129 = (($55) + 1508970993)|0;
 $130 = (($129) + ($125))|0;
 $131 = (($130) + ($126))|0;
 $132 = (($131) + ($128))|0;
 $133 = (_ror32($120,2)|0);
 $134 = (_ror32($120,13)|0);
 $135 = $134 ^ $133;
 $136 = (_ror32($120,22)|0);
 $137 = $135 ^ $136;
 $138 = (_Maj($120,$99,$78)|0);
 $139 = (($132) + ($57))|0;
 $140 = (($138) + ($132))|0;
 $141 = (($140) + ($137))|0;
 $142 = (_ror32($139,6)|0);
 $143 = (_ror32($139,11)|0);
 $144 = $143 ^ $142;
 $145 = (_ror32($139,25)|0);
 $146 = $144 ^ $145;
 $147 = (_Ch($139,$118,$97)|0);
 $148 = ((($W)) + 24|0);
 $149 = HEAP32[$148>>2]|0;
 $150 = (($76) + -1841331548)|0;
 $151 = (($150) + ($146))|0;
 $152 = (($151) + ($147))|0;
 $153 = (($152) + ($149))|0;
 $154 = (_ror32($141,2)|0);
 $155 = (_ror32($141,13)|0);
 $156 = $155 ^ $154;
 $157 = (_ror32($141,22)|0);
 $158 = $156 ^ $157;
 $159 = (_Maj($141,$120,$99)|0);
 $160 = (($153) + ($78))|0;
 $161 = (($159) + ($153))|0;
 $162 = (($161) + ($158))|0;
 $163 = (_ror32($160,6)|0);
 $164 = (_ror32($160,11)|0);
 $165 = $164 ^ $163;
 $166 = (_ror32($160,25)|0);
 $167 = $165 ^ $166;
 $168 = (_Ch($160,$139,$118)|0);
 $169 = ((($W)) + 28|0);
 $170 = HEAP32[$169>>2]|0;
 $171 = (($97) + -1424204075)|0;
 $172 = (($171) + ($167))|0;
 $173 = (($172) + ($168))|0;
 $174 = (($173) + ($170))|0;
 $175 = (_ror32($162,2)|0);
 $176 = (_ror32($162,13)|0);
 $177 = $176 ^ $175;
 $178 = (_ror32($162,22)|0);
 $179 = $177 ^ $178;
 $180 = (_Maj($162,$141,$120)|0);
 $181 = (($174) + ($99))|0;
 $182 = (($180) + ($174))|0;
 $183 = (($182) + ($179))|0;
 $184 = (_ror32($181,6)|0);
 $185 = (_ror32($181,11)|0);
 $186 = $185 ^ $184;
 $187 = (_ror32($181,25)|0);
 $188 = $186 ^ $187;
 $189 = (_Ch($181,$160,$139)|0);
 $190 = ((($W)) + 32|0);
 $191 = HEAP32[$190>>2]|0;
 $192 = (($118) + -670586216)|0;
 $193 = (($192) + ($188))|0;
 $194 = (($193) + ($189))|0;
 $195 = (($194) + ($191))|0;
 $196 = (_ror32($183,2)|0);
 $197 = (_ror32($183,13)|0);
 $198 = $197 ^ $196;
 $199 = (_ror32($183,22)|0);
 $200 = $198 ^ $199;
 $201 = (_Maj($183,$162,$141)|0);
 $202 = (($195) + ($120))|0;
 $203 = (($201) + ($195))|0;
 $204 = (($203) + ($200))|0;
 $205 = (_ror32($202,6)|0);
 $206 = (_ror32($202,11)|0);
 $207 = $206 ^ $205;
 $208 = (_ror32($202,25)|0);
 $209 = $207 ^ $208;
 $210 = (_Ch($202,$181,$160)|0);
 $211 = ((($W)) + 36|0);
 $212 = HEAP32[$211>>2]|0;
 $213 = (($139) + 310598401)|0;
 $214 = (($213) + ($209))|0;
 $215 = (($214) + ($210))|0;
 $216 = (($215) + ($212))|0;
 $217 = (_ror32($204,2)|0);
 $218 = (_ror32($204,13)|0);
 $219 = $218 ^ $217;
 $220 = (_ror32($204,22)|0);
 $221 = $219 ^ $220;
 $222 = (_Maj($204,$183,$162)|0);
 $223 = (($216) + ($141))|0;
 $224 = (($222) + ($216))|0;
 $225 = (($224) + ($221))|0;
 $226 = (_ror32($223,6)|0);
 $227 = (_ror32($223,11)|0);
 $228 = $227 ^ $226;
 $229 = (_ror32($223,25)|0);
 $230 = $228 ^ $229;
 $231 = (_Ch($223,$202,$181)|0);
 $232 = ((($W)) + 40|0);
 $233 = HEAP32[$232>>2]|0;
 $234 = (($160) + 607225278)|0;
 $235 = (($234) + ($230))|0;
 $236 = (($235) + ($231))|0;
 $237 = (($236) + ($233))|0;
 $238 = (_ror32($225,2)|0);
 $239 = (_ror32($225,13)|0);
 $240 = $239 ^ $238;
 $241 = (_ror32($225,22)|0);
 $242 = $240 ^ $241;
 $243 = (_Maj($225,$204,$183)|0);
 $244 = (($237) + ($162))|0;
 $245 = (($243) + ($237))|0;
 $246 = (($245) + ($242))|0;
 $247 = (_ror32($244,6)|0);
 $248 = (_ror32($244,11)|0);
 $249 = $248 ^ $247;
 $250 = (_ror32($244,25)|0);
 $251 = $249 ^ $250;
 $252 = (_Ch($244,$223,$202)|0);
 $253 = ((($W)) + 44|0);
 $254 = HEAP32[$253>>2]|0;
 $255 = (($181) + 1426881987)|0;
 $256 = (($255) + ($251))|0;
 $257 = (($256) + ($252))|0;
 $258 = (($257) + ($254))|0;
 $259 = (_ror32($246,2)|0);
 $260 = (_ror32($246,13)|0);
 $261 = $260 ^ $259;
 $262 = (_ror32($246,22)|0);
 $263 = $261 ^ $262;
 $264 = (_Maj($246,$225,$204)|0);
 $265 = (($258) + ($183))|0;
 $266 = (($264) + ($258))|0;
 $267 = (($266) + ($263))|0;
 $268 = (_ror32($265,6)|0);
 $269 = (_ror32($265,11)|0);
 $270 = $269 ^ $268;
 $271 = (_ror32($265,25)|0);
 $272 = $270 ^ $271;
 $273 = (_Ch($265,$244,$223)|0);
 $274 = ((($W)) + 48|0);
 $275 = HEAP32[$274>>2]|0;
 $276 = (($202) + 1925078388)|0;
 $277 = (($276) + ($272))|0;
 $278 = (($277) + ($273))|0;
 $279 = (($278) + ($275))|0;
 $280 = (_ror32($267,2)|0);
 $281 = (_ror32($267,13)|0);
 $282 = $281 ^ $280;
 $283 = (_ror32($267,22)|0);
 $284 = $282 ^ $283;
 $285 = (_Maj($267,$246,$225)|0);
 $286 = (($279) + ($204))|0;
 $287 = (($285) + ($279))|0;
 $288 = (($287) + ($284))|0;
 $289 = (_ror32($286,6)|0);
 $290 = (_ror32($286,11)|0);
 $291 = $290 ^ $289;
 $292 = (_ror32($286,25)|0);
 $293 = $291 ^ $292;
 $294 = (_Ch($286,$265,$244)|0);
 $295 = ((($W)) + 52|0);
 $296 = HEAP32[$295>>2]|0;
 $297 = (($223) + -2132889090)|0;
 $298 = (($297) + ($293))|0;
 $299 = (($298) + ($294))|0;
 $300 = (($299) + ($296))|0;
 $301 = (_ror32($288,2)|0);
 $302 = (_ror32($288,13)|0);
 $303 = $302 ^ $301;
 $304 = (_ror32($288,22)|0);
 $305 = $303 ^ $304;
 $306 = (_Maj($288,$267,$246)|0);
 $307 = (($300) + ($225))|0;
 $308 = (($306) + ($300))|0;
 $309 = (($308) + ($305))|0;
 $310 = (_ror32($307,6)|0);
 $311 = (_ror32($307,11)|0);
 $312 = $311 ^ $310;
 $313 = (_ror32($307,25)|0);
 $314 = $312 ^ $313;
 $315 = (_Ch($307,$286,$265)|0);
 $316 = ((($W)) + 56|0);
 $317 = HEAP32[$316>>2]|0;
 $318 = (($244) + -1680079193)|0;
 $319 = (($318) + ($314))|0;
 $320 = (($319) + ($315))|0;
 $321 = (($320) + ($317))|0;
 $322 = (_ror32($309,2)|0);
 $323 = (_ror32($309,13)|0);
 $324 = $323 ^ $322;
 $325 = (_ror32($309,22)|0);
 $326 = $324 ^ $325;
 $327 = (_Maj($309,$288,$267)|0);
 $328 = (($321) + ($246))|0;
 $329 = (($327) + ($321))|0;
 $330 = (($329) + ($326))|0;
 $331 = (_ror32($328,6)|0);
 $332 = (_ror32($328,11)|0);
 $333 = $332 ^ $331;
 $334 = (_ror32($328,25)|0);
 $335 = $333 ^ $334;
 $336 = (_Ch($328,$307,$286)|0);
 $337 = ((($W)) + 60|0);
 $338 = HEAP32[$337>>2]|0;
 $339 = (($265) + -1046744716)|0;
 $340 = (($339) + ($335))|0;
 $341 = (($340) + ($336))|0;
 $342 = (($341) + ($338))|0;
 $343 = (_ror32($330,2)|0);
 $344 = (_ror32($330,13)|0);
 $345 = $344 ^ $343;
 $346 = (_ror32($330,22)|0);
 $347 = $345 ^ $346;
 $348 = (_Maj($330,$309,$288)|0);
 $349 = (($342) + ($267))|0;
 $350 = (($348) + ($342))|0;
 $351 = (($350) + ($347))|0;
 $352 = (_ror32($349,6)|0);
 $353 = (_ror32($349,11)|0);
 $354 = $353 ^ $352;
 $355 = (_ror32($349,25)|0);
 $356 = $354 ^ $355;
 $357 = (_Ch($349,$328,$307)|0);
 $358 = ((($W)) + 64|0);
 $359 = HEAP32[$358>>2]|0;
 $360 = (($286) + -459576895)|0;
 $361 = (($360) + ($356))|0;
 $362 = (($361) + ($357))|0;
 $363 = (($362) + ($359))|0;
 $364 = (_ror32($351,2)|0);
 $365 = (_ror32($351,13)|0);
 $366 = $365 ^ $364;
 $367 = (_ror32($351,22)|0);
 $368 = $366 ^ $367;
 $369 = (_Maj($351,$330,$309)|0);
 $370 = (($363) + ($288))|0;
 $371 = (($369) + ($363))|0;
 $372 = (($371) + ($368))|0;
 $373 = (_ror32($370,6)|0);
 $374 = (_ror32($370,11)|0);
 $375 = $374 ^ $373;
 $376 = (_ror32($370,25)|0);
 $377 = $375 ^ $376;
 $378 = (_Ch($370,$349,$328)|0);
 $379 = ((($W)) + 68|0);
 $380 = HEAP32[$379>>2]|0;
 $381 = (($307) + -272742522)|0;
 $382 = (($381) + ($377))|0;
 $383 = (($382) + ($378))|0;
 $384 = (($383) + ($380))|0;
 $385 = (_ror32($372,2)|0);
 $386 = (_ror32($372,13)|0);
 $387 = $386 ^ $385;
 $388 = (_ror32($372,22)|0);
 $389 = $387 ^ $388;
 $390 = (_Maj($372,$351,$330)|0);
 $391 = (($384) + ($309))|0;
 $392 = (($390) + ($384))|0;
 $393 = (($392) + ($389))|0;
 $394 = (_ror32($391,6)|0);
 $395 = (_ror32($391,11)|0);
 $396 = $395 ^ $394;
 $397 = (_ror32($391,25)|0);
 $398 = $396 ^ $397;
 $399 = (_Ch($391,$370,$349)|0);
 $400 = ((($W)) + 72|0);
 $401 = HEAP32[$400>>2]|0;
 $402 = (($328) + 264347078)|0;
 $403 = (($402) + ($398))|0;
 $404 = (($403) + ($399))|0;
 $405 = (($404) + ($401))|0;
 $406 = (_ror32($393,2)|0);
 $407 = (_ror32($393,13)|0);
 $408 = $407 ^ $406;
 $409 = (_ror32($393,22)|0);
 $410 = $408 ^ $409;
 $411 = (_Maj($393,$372,$351)|0);
 $412 = (($405) + ($330))|0;
 $413 = (($411) + ($405))|0;
 $414 = (($413) + ($410))|0;
 $415 = (_ror32($412,6)|0);
 $416 = (_ror32($412,11)|0);
 $417 = $416 ^ $415;
 $418 = (_ror32($412,25)|0);
 $419 = $417 ^ $418;
 $420 = (_Ch($412,$391,$370)|0);
 $421 = ((($W)) + 76|0);
 $422 = HEAP32[$421>>2]|0;
 $423 = (($349) + 604807628)|0;
 $424 = (($423) + ($419))|0;
 $425 = (($424) + ($420))|0;
 $426 = (($425) + ($422))|0;
 $427 = (_ror32($414,2)|0);
 $428 = (_ror32($414,13)|0);
 $429 = $428 ^ $427;
 $430 = (_ror32($414,22)|0);
 $431 = $429 ^ $430;
 $432 = (_Maj($414,$393,$372)|0);
 $433 = (($426) + ($351))|0;
 $434 = (($432) + ($426))|0;
 $435 = (($434) + ($431))|0;
 $436 = (_ror32($433,6)|0);
 $437 = (_ror32($433,11)|0);
 $438 = $437 ^ $436;
 $439 = (_ror32($433,25)|0);
 $440 = $438 ^ $439;
 $441 = (_Ch($433,$412,$391)|0);
 $442 = ((($W)) + 80|0);
 $443 = HEAP32[$442>>2]|0;
 $444 = (($370) + 770255983)|0;
 $445 = (($444) + ($440))|0;
 $446 = (($445) + ($441))|0;
 $447 = (($446) + ($443))|0;
 $448 = (_ror32($435,2)|0);
 $449 = (_ror32($435,13)|0);
 $450 = $449 ^ $448;
 $451 = (_ror32($435,22)|0);
 $452 = $450 ^ $451;
 $453 = (_Maj($435,$414,$393)|0);
 $454 = (($447) + ($372))|0;
 $455 = (($453) + ($447))|0;
 $456 = (($455) + ($452))|0;
 $457 = (_ror32($454,6)|0);
 $458 = (_ror32($454,11)|0);
 $459 = $458 ^ $457;
 $460 = (_ror32($454,25)|0);
 $461 = $459 ^ $460;
 $462 = (_Ch($454,$433,$412)|0);
 $463 = ((($W)) + 84|0);
 $464 = HEAP32[$463>>2]|0;
 $465 = (($391) + 1249150122)|0;
 $466 = (($465) + ($461))|0;
 $467 = (($466) + ($462))|0;
 $468 = (($467) + ($464))|0;
 $469 = (_ror32($456,2)|0);
 $470 = (_ror32($456,13)|0);
 $471 = $470 ^ $469;
 $472 = (_ror32($456,22)|0);
 $473 = $471 ^ $472;
 $474 = (_Maj($456,$435,$414)|0);
 $475 = (($468) + ($393))|0;
 $476 = (($474) + ($468))|0;
 $477 = (($476) + ($473))|0;
 $478 = (_ror32($475,6)|0);
 $479 = (_ror32($475,11)|0);
 $480 = $479 ^ $478;
 $481 = (_ror32($475,25)|0);
 $482 = $480 ^ $481;
 $483 = (_Ch($475,$454,$433)|0);
 $484 = ((($W)) + 88|0);
 $485 = HEAP32[$484>>2]|0;
 $486 = (($412) + 1555081692)|0;
 $487 = (($486) + ($482))|0;
 $488 = (($487) + ($483))|0;
 $489 = (($488) + ($485))|0;
 $490 = (_ror32($477,2)|0);
 $491 = (_ror32($477,13)|0);
 $492 = $491 ^ $490;
 $493 = (_ror32($477,22)|0);
 $494 = $492 ^ $493;
 $495 = (_Maj($477,$456,$435)|0);
 $496 = (($489) + ($414))|0;
 $497 = (($495) + ($489))|0;
 $498 = (($497) + ($494))|0;
 $499 = (_ror32($496,6)|0);
 $500 = (_ror32($496,11)|0);
 $501 = $500 ^ $499;
 $502 = (_ror32($496,25)|0);
 $503 = $501 ^ $502;
 $504 = (_Ch($496,$475,$454)|0);
 $505 = ((($W)) + 92|0);
 $506 = HEAP32[$505>>2]|0;
 $507 = (($433) + 1996064986)|0;
 $508 = (($507) + ($503))|0;
 $509 = (($508) + ($504))|0;
 $510 = (($509) + ($506))|0;
 $511 = (_ror32($498,2)|0);
 $512 = (_ror32($498,13)|0);
 $513 = $512 ^ $511;
 $514 = (_ror32($498,22)|0);
 $515 = $513 ^ $514;
 $516 = (_Maj($498,$477,$456)|0);
 $517 = (($510) + ($435))|0;
 $518 = (($516) + ($510))|0;
 $519 = (($518) + ($515))|0;
 $520 = (_ror32($517,6)|0);
 $521 = (_ror32($517,11)|0);
 $522 = $521 ^ $520;
 $523 = (_ror32($517,25)|0);
 $524 = $522 ^ $523;
 $525 = (_Ch($517,$496,$475)|0);
 $526 = ((($W)) + 96|0);
 $527 = HEAP32[$526>>2]|0;
 $528 = (($454) + -1740746414)|0;
 $529 = (($528) + ($524))|0;
 $530 = (($529) + ($525))|0;
 $531 = (($530) + ($527))|0;
 $532 = (_ror32($519,2)|0);
 $533 = (_ror32($519,13)|0);
 $534 = $533 ^ $532;
 $535 = (_ror32($519,22)|0);
 $536 = $534 ^ $535;
 $537 = (_Maj($519,$498,$477)|0);
 $538 = (($531) + ($456))|0;
 $539 = (($537) + ($531))|0;
 $540 = (($539) + ($536))|0;
 $541 = (_ror32($538,6)|0);
 $542 = (_ror32($538,11)|0);
 $543 = $542 ^ $541;
 $544 = (_ror32($538,25)|0);
 $545 = $543 ^ $544;
 $546 = (_Ch($538,$517,$496)|0);
 $547 = ((($W)) + 100|0);
 $548 = HEAP32[$547>>2]|0;
 $549 = (($475) + -1473132947)|0;
 $550 = (($549) + ($545))|0;
 $551 = (($550) + ($546))|0;
 $552 = (($551) + ($548))|0;
 $553 = (_ror32($540,2)|0);
 $554 = (_ror32($540,13)|0);
 $555 = $554 ^ $553;
 $556 = (_ror32($540,22)|0);
 $557 = $555 ^ $556;
 $558 = (_Maj($540,$519,$498)|0);
 $559 = (($552) + ($477))|0;
 $560 = (($558) + ($552))|0;
 $561 = (($560) + ($557))|0;
 $562 = (_ror32($559,6)|0);
 $563 = (_ror32($559,11)|0);
 $564 = $563 ^ $562;
 $565 = (_ror32($559,25)|0);
 $566 = $564 ^ $565;
 $567 = (_Ch($559,$538,$517)|0);
 $568 = ((($W)) + 104|0);
 $569 = HEAP32[$568>>2]|0;
 $570 = (($496) + -1341970488)|0;
 $571 = (($570) + ($566))|0;
 $572 = (($571) + ($567))|0;
 $573 = (($572) + ($569))|0;
 $574 = (_ror32($561,2)|0);
 $575 = (_ror32($561,13)|0);
 $576 = $575 ^ $574;
 $577 = (_ror32($561,22)|0);
 $578 = $576 ^ $577;
 $579 = (_Maj($561,$540,$519)|0);
 $580 = (($573) + ($498))|0;
 $581 = (($579) + ($573))|0;
 $582 = (($581) + ($578))|0;
 $583 = (_ror32($580,6)|0);
 $584 = (_ror32($580,11)|0);
 $585 = $584 ^ $583;
 $586 = (_ror32($580,25)|0);
 $587 = $585 ^ $586;
 $588 = (_Ch($580,$559,$538)|0);
 $589 = ((($W)) + 108|0);
 $590 = HEAP32[$589>>2]|0;
 $591 = (($517) + -1084653625)|0;
 $592 = (($591) + ($587))|0;
 $593 = (($592) + ($588))|0;
 $594 = (($593) + ($590))|0;
 $595 = (_ror32($582,2)|0);
 $596 = (_ror32($582,13)|0);
 $597 = $596 ^ $595;
 $598 = (_ror32($582,22)|0);
 $599 = $597 ^ $598;
 $600 = (_Maj($582,$561,$540)|0);
 $601 = (($594) + ($519))|0;
 $602 = (($600) + ($594))|0;
 $603 = (($602) + ($599))|0;
 $604 = (_ror32($601,6)|0);
 $605 = (_ror32($601,11)|0);
 $606 = $605 ^ $604;
 $607 = (_ror32($601,25)|0);
 $608 = $606 ^ $607;
 $609 = (_Ch($601,$580,$559)|0);
 $610 = ((($W)) + 112|0);
 $611 = HEAP32[$610>>2]|0;
 $612 = (($538) + -958395405)|0;
 $613 = (($612) + ($608))|0;
 $614 = (($613) + ($609))|0;
 $615 = (($614) + ($611))|0;
 $616 = (_ror32($603,2)|0);
 $617 = (_ror32($603,13)|0);
 $618 = $617 ^ $616;
 $619 = (_ror32($603,22)|0);
 $620 = $618 ^ $619;
 $621 = (_Maj($603,$582,$561)|0);
 $622 = (($615) + ($540))|0;
 $623 = (($621) + ($615))|0;
 $624 = (($623) + ($620))|0;
 $625 = (_ror32($622,6)|0);
 $626 = (_ror32($622,11)|0);
 $627 = $626 ^ $625;
 $628 = (_ror32($622,25)|0);
 $629 = $627 ^ $628;
 $630 = (_Ch($622,$601,$580)|0);
 $631 = ((($W)) + 116|0);
 $632 = HEAP32[$631>>2]|0;
 $633 = (($559) + -710438585)|0;
 $634 = (($633) + ($629))|0;
 $635 = (($634) + ($630))|0;
 $636 = (($635) + ($632))|0;
 $637 = (_ror32($624,2)|0);
 $638 = (_ror32($624,13)|0);
 $639 = $638 ^ $637;
 $640 = (_ror32($624,22)|0);
 $641 = $639 ^ $640;
 $642 = (_Maj($624,$603,$582)|0);
 $643 = (($636) + ($561))|0;
 $644 = (($642) + ($636))|0;
 $645 = (($644) + ($641))|0;
 $646 = (_ror32($643,6)|0);
 $647 = (_ror32($643,11)|0);
 $648 = $647 ^ $646;
 $649 = (_ror32($643,25)|0);
 $650 = $648 ^ $649;
 $651 = (_Ch($643,$622,$601)|0);
 $652 = ((($W)) + 120|0);
 $653 = HEAP32[$652>>2]|0;
 $654 = (($580) + 113926993)|0;
 $655 = (($654) + ($650))|0;
 $656 = (($655) + ($651))|0;
 $657 = (($656) + ($653))|0;
 $658 = (_ror32($645,2)|0);
 $659 = (_ror32($645,13)|0);
 $660 = $659 ^ $658;
 $661 = (_ror32($645,22)|0);
 $662 = $660 ^ $661;
 $663 = (_Maj($645,$624,$603)|0);
 $664 = (($657) + ($582))|0;
 $665 = (($663) + ($657))|0;
 $666 = (($665) + ($662))|0;
 $667 = (_ror32($664,6)|0);
 $668 = (_ror32($664,11)|0);
 $669 = $668 ^ $667;
 $670 = (_ror32($664,25)|0);
 $671 = $669 ^ $670;
 $672 = (_Ch($664,$643,$622)|0);
 $673 = ((($W)) + 124|0);
 $674 = HEAP32[$673>>2]|0;
 $675 = (($601) + 338241895)|0;
 $676 = (($675) + ($671))|0;
 $677 = (($676) + ($672))|0;
 $678 = (($677) + ($674))|0;
 $679 = (_ror32($666,2)|0);
 $680 = (_ror32($666,13)|0);
 $681 = $680 ^ $679;
 $682 = (_ror32($666,22)|0);
 $683 = $681 ^ $682;
 $684 = (_Maj($666,$645,$624)|0);
 $685 = (($678) + ($603))|0;
 $686 = (($684) + ($678))|0;
 $687 = (($686) + ($683))|0;
 $688 = (_ror32($685,6)|0);
 $689 = (_ror32($685,11)|0);
 $690 = $689 ^ $688;
 $691 = (_ror32($685,25)|0);
 $692 = $690 ^ $691;
 $693 = (_Ch($685,$664,$643)|0);
 $694 = ((($W)) + 128|0);
 $695 = HEAP32[$694>>2]|0;
 $696 = (($622) + 666307205)|0;
 $697 = (($696) + ($692))|0;
 $698 = (($697) + ($693))|0;
 $699 = (($698) + ($695))|0;
 $700 = (_ror32($687,2)|0);
 $701 = (_ror32($687,13)|0);
 $702 = $701 ^ $700;
 $703 = (_ror32($687,22)|0);
 $704 = $702 ^ $703;
 $705 = (_Maj($687,$666,$645)|0);
 $706 = (($699) + ($624))|0;
 $707 = (($705) + ($699))|0;
 $708 = (($707) + ($704))|0;
 $709 = (_ror32($706,6)|0);
 $710 = (_ror32($706,11)|0);
 $711 = $710 ^ $709;
 $712 = (_ror32($706,25)|0);
 $713 = $711 ^ $712;
 $714 = (_Ch($706,$685,$664)|0);
 $715 = ((($W)) + 132|0);
 $716 = HEAP32[$715>>2]|0;
 $717 = (($643) + 773529912)|0;
 $718 = (($717) + ($713))|0;
 $719 = (($718) + ($714))|0;
 $720 = (($719) + ($716))|0;
 $721 = (_ror32($708,2)|0);
 $722 = (_ror32($708,13)|0);
 $723 = $722 ^ $721;
 $724 = (_ror32($708,22)|0);
 $725 = $723 ^ $724;
 $726 = (_Maj($708,$687,$666)|0);
 $727 = (($720) + ($645))|0;
 $728 = (($726) + ($720))|0;
 $729 = (($728) + ($725))|0;
 $730 = (_ror32($727,6)|0);
 $731 = (_ror32($727,11)|0);
 $732 = $731 ^ $730;
 $733 = (_ror32($727,25)|0);
 $734 = $732 ^ $733;
 $735 = (_Ch($727,$706,$685)|0);
 $736 = ((($W)) + 136|0);
 $737 = HEAP32[$736>>2]|0;
 $738 = (($664) + 1294757372)|0;
 $739 = (($738) + ($734))|0;
 $740 = (($739) + ($735))|0;
 $741 = (($740) + ($737))|0;
 $742 = (_ror32($729,2)|0);
 $743 = (_ror32($729,13)|0);
 $744 = $743 ^ $742;
 $745 = (_ror32($729,22)|0);
 $746 = $744 ^ $745;
 $747 = (_Maj($729,$708,$687)|0);
 $748 = (($741) + ($666))|0;
 $749 = (($747) + ($741))|0;
 $750 = (($749) + ($746))|0;
 $751 = (_ror32($748,6)|0);
 $752 = (_ror32($748,11)|0);
 $753 = $752 ^ $751;
 $754 = (_ror32($748,25)|0);
 $755 = $753 ^ $754;
 $756 = (_Ch($748,$727,$706)|0);
 $757 = ((($W)) + 140|0);
 $758 = HEAP32[$757>>2]|0;
 $759 = (($685) + 1396182291)|0;
 $760 = (($759) + ($755))|0;
 $761 = (($760) + ($756))|0;
 $762 = (($761) + ($758))|0;
 $763 = (_ror32($750,2)|0);
 $764 = (_ror32($750,13)|0);
 $765 = $764 ^ $763;
 $766 = (_ror32($750,22)|0);
 $767 = $765 ^ $766;
 $768 = (_Maj($750,$729,$708)|0);
 $769 = (($762) + ($687))|0;
 $770 = (($768) + ($762))|0;
 $771 = (($770) + ($767))|0;
 $772 = (_ror32($769,6)|0);
 $773 = (_ror32($769,11)|0);
 $774 = $773 ^ $772;
 $775 = (_ror32($769,25)|0);
 $776 = $774 ^ $775;
 $777 = (_Ch($769,$748,$727)|0);
 $778 = ((($W)) + 144|0);
 $779 = HEAP32[$778>>2]|0;
 $780 = (($706) + 1695183700)|0;
 $781 = (($780) + ($776))|0;
 $782 = (($781) + ($777))|0;
 $783 = (($782) + ($779))|0;
 $784 = (_ror32($771,2)|0);
 $785 = (_ror32($771,13)|0);
 $786 = $785 ^ $784;
 $787 = (_ror32($771,22)|0);
 $788 = $786 ^ $787;
 $789 = (_Maj($771,$750,$729)|0);
 $790 = (($783) + ($708))|0;
 $791 = (($789) + ($783))|0;
 $792 = (($791) + ($788))|0;
 $793 = (_ror32($790,6)|0);
 $794 = (_ror32($790,11)|0);
 $795 = $794 ^ $793;
 $796 = (_ror32($790,25)|0);
 $797 = $795 ^ $796;
 $798 = (_Ch($790,$769,$748)|0);
 $799 = ((($W)) + 148|0);
 $800 = HEAP32[$799>>2]|0;
 $801 = (($727) + 1986661051)|0;
 $802 = (($801) + ($797))|0;
 $803 = (($802) + ($798))|0;
 $804 = (($803) + ($800))|0;
 $805 = (_ror32($792,2)|0);
 $806 = (_ror32($792,13)|0);
 $807 = $806 ^ $805;
 $808 = (_ror32($792,22)|0);
 $809 = $807 ^ $808;
 $810 = (_Maj($792,$771,$750)|0);
 $811 = (($804) + ($729))|0;
 $812 = (($810) + ($804))|0;
 $813 = (($812) + ($809))|0;
 $814 = (_ror32($811,6)|0);
 $815 = (_ror32($811,11)|0);
 $816 = $815 ^ $814;
 $817 = (_ror32($811,25)|0);
 $818 = $816 ^ $817;
 $819 = (_Ch($811,$790,$769)|0);
 $820 = ((($W)) + 152|0);
 $821 = HEAP32[$820>>2]|0;
 $822 = (($748) + -2117940946)|0;
 $823 = (($822) + ($818))|0;
 $824 = (($823) + ($819))|0;
 $825 = (($824) + ($821))|0;
 $826 = (_ror32($813,2)|0);
 $827 = (_ror32($813,13)|0);
 $828 = $827 ^ $826;
 $829 = (_ror32($813,22)|0);
 $830 = $828 ^ $829;
 $831 = (_Maj($813,$792,$771)|0);
 $832 = (($825) + ($750))|0;
 $833 = (($831) + ($825))|0;
 $834 = (($833) + ($830))|0;
 $835 = (_ror32($832,6)|0);
 $836 = (_ror32($832,11)|0);
 $837 = $836 ^ $835;
 $838 = (_ror32($832,25)|0);
 $839 = $837 ^ $838;
 $840 = (_Ch($832,$811,$790)|0);
 $841 = ((($W)) + 156|0);
 $842 = HEAP32[$841>>2]|0;
 $843 = (($769) + -1838011259)|0;
 $844 = (($843) + ($839))|0;
 $845 = (($844) + ($840))|0;
 $846 = (($845) + ($842))|0;
 $847 = (_ror32($834,2)|0);
 $848 = (_ror32($834,13)|0);
 $849 = $848 ^ $847;
 $850 = (_ror32($834,22)|0);
 $851 = $849 ^ $850;
 $852 = (_Maj($834,$813,$792)|0);
 $853 = (($846) + ($771))|0;
 $854 = (($852) + ($846))|0;
 $855 = (($854) + ($851))|0;
 $856 = (_ror32($853,6)|0);
 $857 = (_ror32($853,11)|0);
 $858 = $857 ^ $856;
 $859 = (_ror32($853,25)|0);
 $860 = $858 ^ $859;
 $861 = (_Ch($853,$832,$811)|0);
 $862 = ((($W)) + 160|0);
 $863 = HEAP32[$862>>2]|0;
 $864 = (($790) + -1564481375)|0;
 $865 = (($864) + ($860))|0;
 $866 = (($865) + ($861))|0;
 $867 = (($866) + ($863))|0;
 $868 = (_ror32($855,2)|0);
 $869 = (_ror32($855,13)|0);
 $870 = $869 ^ $868;
 $871 = (_ror32($855,22)|0);
 $872 = $870 ^ $871;
 $873 = (_Maj($855,$834,$813)|0);
 $874 = (($867) + ($792))|0;
 $875 = (($873) + ($867))|0;
 $876 = (($875) + ($872))|0;
 $877 = (_ror32($874,6)|0);
 $878 = (_ror32($874,11)|0);
 $879 = $878 ^ $877;
 $880 = (_ror32($874,25)|0);
 $881 = $879 ^ $880;
 $882 = (_Ch($874,$853,$832)|0);
 $883 = ((($W)) + 164|0);
 $884 = HEAP32[$883>>2]|0;
 $885 = (($811) + -1474664885)|0;
 $886 = (($885) + ($881))|0;
 $887 = (($886) + ($882))|0;
 $888 = (($887) + ($884))|0;
 $889 = (_ror32($876,2)|0);
 $890 = (_ror32($876,13)|0);
 $891 = $890 ^ $889;
 $892 = (_ror32($876,22)|0);
 $893 = $891 ^ $892;
 $894 = (_Maj($876,$855,$834)|0);
 $895 = (($888) + ($813))|0;
 $896 = (($894) + ($888))|0;
 $897 = (($896) + ($893))|0;
 $898 = (_ror32($895,6)|0);
 $899 = (_ror32($895,11)|0);
 $900 = $899 ^ $898;
 $901 = (_ror32($895,25)|0);
 $902 = $900 ^ $901;
 $903 = (_Ch($895,$874,$853)|0);
 $904 = ((($W)) + 168|0);
 $905 = HEAP32[$904>>2]|0;
 $906 = (($832) + -1035236496)|0;
 $907 = (($906) + ($902))|0;
 $908 = (($907) + ($903))|0;
 $909 = (($908) + ($905))|0;
 $910 = (_ror32($897,2)|0);
 $911 = (_ror32($897,13)|0);
 $912 = $911 ^ $910;
 $913 = (_ror32($897,22)|0);
 $914 = $912 ^ $913;
 $915 = (_Maj($897,$876,$855)|0);
 $916 = (($909) + ($834))|0;
 $917 = (($915) + ($909))|0;
 $918 = (($917) + ($914))|0;
 $919 = (_ror32($916,6)|0);
 $920 = (_ror32($916,11)|0);
 $921 = $920 ^ $919;
 $922 = (_ror32($916,25)|0);
 $923 = $921 ^ $922;
 $924 = (_Ch($916,$895,$874)|0);
 $925 = ((($W)) + 172|0);
 $926 = HEAP32[$925>>2]|0;
 $927 = (($853) + -949202525)|0;
 $928 = (($927) + ($923))|0;
 $929 = (($928) + ($924))|0;
 $930 = (($929) + ($926))|0;
 $931 = (_ror32($918,2)|0);
 $932 = (_ror32($918,13)|0);
 $933 = $932 ^ $931;
 $934 = (_ror32($918,22)|0);
 $935 = $933 ^ $934;
 $936 = (_Maj($918,$897,$876)|0);
 $937 = (($930) + ($855))|0;
 $938 = (($936) + ($930))|0;
 $939 = (($938) + ($935))|0;
 $940 = (_ror32($937,6)|0);
 $941 = (_ror32($937,11)|0);
 $942 = $941 ^ $940;
 $943 = (_ror32($937,25)|0);
 $944 = $942 ^ $943;
 $945 = (_Ch($937,$916,$895)|0);
 $946 = ((($W)) + 176|0);
 $947 = HEAP32[$946>>2]|0;
 $948 = (($874) + -778901479)|0;
 $949 = (($948) + ($944))|0;
 $950 = (($949) + ($945))|0;
 $951 = (($950) + ($947))|0;
 $952 = (_ror32($939,2)|0);
 $953 = (_ror32($939,13)|0);
 $954 = $953 ^ $952;
 $955 = (_ror32($939,22)|0);
 $956 = $954 ^ $955;
 $957 = (_Maj($939,$918,$897)|0);
 $958 = (($951) + ($876))|0;
 $959 = (($957) + ($951))|0;
 $960 = (($959) + ($956))|0;
 $961 = (_ror32($958,6)|0);
 $962 = (_ror32($958,11)|0);
 $963 = $962 ^ $961;
 $964 = (_ror32($958,25)|0);
 $965 = $963 ^ $964;
 $966 = (_Ch($958,$937,$916)|0);
 $967 = ((($W)) + 180|0);
 $968 = HEAP32[$967>>2]|0;
 $969 = (($895) + -694614492)|0;
 $970 = (($969) + ($965))|0;
 $971 = (($970) + ($966))|0;
 $972 = (($971) + ($968))|0;
 $973 = (_ror32($960,2)|0);
 $974 = (_ror32($960,13)|0);
 $975 = $974 ^ $973;
 $976 = (_ror32($960,22)|0);
 $977 = $975 ^ $976;
 $978 = (_Maj($960,$939,$918)|0);
 $979 = (($972) + ($897))|0;
 $980 = (($978) + ($972))|0;
 $981 = (($980) + ($977))|0;
 $982 = (_ror32($979,6)|0);
 $983 = (_ror32($979,11)|0);
 $984 = $983 ^ $982;
 $985 = (_ror32($979,25)|0);
 $986 = $984 ^ $985;
 $987 = (_Ch($979,$958,$937)|0);
 $988 = ((($W)) + 184|0);
 $989 = HEAP32[$988>>2]|0;
 $990 = (($916) + -200395387)|0;
 $991 = (($990) + ($986))|0;
 $992 = (($991) + ($987))|0;
 $993 = (($992) + ($989))|0;
 $994 = (_ror32($981,2)|0);
 $995 = (_ror32($981,13)|0);
 $996 = $995 ^ $994;
 $997 = (_ror32($981,22)|0);
 $998 = $996 ^ $997;
 $999 = (_Maj($981,$960,$939)|0);
 $1000 = (($993) + ($918))|0;
 $1001 = (($999) + ($993))|0;
 $1002 = (($1001) + ($998))|0;
 $1003 = (_ror32($1000,6)|0);
 $1004 = (_ror32($1000,11)|0);
 $1005 = $1004 ^ $1003;
 $1006 = (_ror32($1000,25)|0);
 $1007 = $1005 ^ $1006;
 $1008 = (_Ch($1000,$979,$958)|0);
 $1009 = ((($W)) + 188|0);
 $1010 = HEAP32[$1009>>2]|0;
 $1011 = (($937) + 275423344)|0;
 $1012 = (($1011) + ($1007))|0;
 $1013 = (($1012) + ($1008))|0;
 $1014 = (($1013) + ($1010))|0;
 $1015 = (_ror32($1002,2)|0);
 $1016 = (_ror32($1002,13)|0);
 $1017 = $1016 ^ $1015;
 $1018 = (_ror32($1002,22)|0);
 $1019 = $1017 ^ $1018;
 $1020 = (_Maj($1002,$981,$960)|0);
 $1021 = (($1014) + ($939))|0;
 $1022 = (($1020) + ($1014))|0;
 $1023 = (($1022) + ($1019))|0;
 $1024 = (_ror32($1021,6)|0);
 $1025 = (_ror32($1021,11)|0);
 $1026 = $1025 ^ $1024;
 $1027 = (_ror32($1021,25)|0);
 $1028 = $1026 ^ $1027;
 $1029 = (_Ch($1021,$1000,$979)|0);
 $1030 = ((($W)) + 192|0);
 $1031 = HEAP32[$1030>>2]|0;
 $1032 = (($958) + 430227734)|0;
 $1033 = (($1032) + ($1028))|0;
 $1034 = (($1033) + ($1029))|0;
 $1035 = (($1034) + ($1031))|0;
 $1036 = (_ror32($1023,2)|0);
 $1037 = (_ror32($1023,13)|0);
 $1038 = $1037 ^ $1036;
 $1039 = (_ror32($1023,22)|0);
 $1040 = $1038 ^ $1039;
 $1041 = (_Maj($1023,$1002,$981)|0);
 $1042 = (($1035) + ($960))|0;
 $1043 = (($1041) + ($1035))|0;
 $1044 = (($1043) + ($1040))|0;
 $1045 = (_ror32($1042,6)|0);
 $1046 = (_ror32($1042,11)|0);
 $1047 = $1046 ^ $1045;
 $1048 = (_ror32($1042,25)|0);
 $1049 = $1047 ^ $1048;
 $1050 = (_Ch($1042,$1021,$1000)|0);
 $1051 = ((($W)) + 196|0);
 $1052 = HEAP32[$1051>>2]|0;
 $1053 = (($979) + 506948616)|0;
 $1054 = (($1053) + ($1049))|0;
 $1055 = (($1054) + ($1050))|0;
 $1056 = (($1055) + ($1052))|0;
 $1057 = (_ror32($1044,2)|0);
 $1058 = (_ror32($1044,13)|0);
 $1059 = $1058 ^ $1057;
 $1060 = (_ror32($1044,22)|0);
 $1061 = $1059 ^ $1060;
 $1062 = (_Maj($1044,$1023,$1002)|0);
 $1063 = (($1056) + ($981))|0;
 $1064 = (($1062) + ($1056))|0;
 $1065 = (($1064) + ($1061))|0;
 $1066 = (_ror32($1063,6)|0);
 $1067 = (_ror32($1063,11)|0);
 $1068 = $1067 ^ $1066;
 $1069 = (_ror32($1063,25)|0);
 $1070 = $1068 ^ $1069;
 $1071 = (_Ch($1063,$1042,$1021)|0);
 $1072 = ((($W)) + 200|0);
 $1073 = HEAP32[$1072>>2]|0;
 $1074 = (($1000) + 659060556)|0;
 $1075 = (($1074) + ($1070))|0;
 $1076 = (($1075) + ($1071))|0;
 $1077 = (($1076) + ($1073))|0;
 $1078 = (_ror32($1065,2)|0);
 $1079 = (_ror32($1065,13)|0);
 $1080 = $1079 ^ $1078;
 $1081 = (_ror32($1065,22)|0);
 $1082 = $1080 ^ $1081;
 $1083 = (_Maj($1065,$1044,$1023)|0);
 $1084 = (($1077) + ($1002))|0;
 $1085 = (($1083) + ($1077))|0;
 $1086 = (($1085) + ($1082))|0;
 $1087 = (_ror32($1084,6)|0);
 $1088 = (_ror32($1084,11)|0);
 $1089 = $1088 ^ $1087;
 $1090 = (_ror32($1084,25)|0);
 $1091 = $1089 ^ $1090;
 $1092 = (_Ch($1084,$1063,$1042)|0);
 $1093 = ((($W)) + 204|0);
 $1094 = HEAP32[$1093>>2]|0;
 $1095 = (($1021) + 883997877)|0;
 $1096 = (($1095) + ($1091))|0;
 $1097 = (($1096) + ($1092))|0;
 $1098 = (($1097) + ($1094))|0;
 $1099 = (_ror32($1086,2)|0);
 $1100 = (_ror32($1086,13)|0);
 $1101 = $1100 ^ $1099;
 $1102 = (_ror32($1086,22)|0);
 $1103 = $1101 ^ $1102;
 $1104 = (_Maj($1086,$1065,$1044)|0);
 $1105 = (($1098) + ($1023))|0;
 $1106 = (($1104) + ($1098))|0;
 $1107 = (($1106) + ($1103))|0;
 $1108 = (_ror32($1105,6)|0);
 $1109 = (_ror32($1105,11)|0);
 $1110 = $1109 ^ $1108;
 $1111 = (_ror32($1105,25)|0);
 $1112 = $1110 ^ $1111;
 $1113 = (_Ch($1105,$1084,$1063)|0);
 $1114 = ((($W)) + 208|0);
 $1115 = HEAP32[$1114>>2]|0;
 $1116 = (($1042) + 958139571)|0;
 $1117 = (($1116) + ($1112))|0;
 $1118 = (($1117) + ($1113))|0;
 $1119 = (($1118) + ($1115))|0;
 $1120 = (_ror32($1107,2)|0);
 $1121 = (_ror32($1107,13)|0);
 $1122 = $1121 ^ $1120;
 $1123 = (_ror32($1107,22)|0);
 $1124 = $1122 ^ $1123;
 $1125 = (_Maj($1107,$1086,$1065)|0);
 $1126 = (($1119) + ($1044))|0;
 $1127 = (($1125) + ($1119))|0;
 $1128 = (($1127) + ($1124))|0;
 $1129 = (_ror32($1126,6)|0);
 $1130 = (_ror32($1126,11)|0);
 $1131 = $1130 ^ $1129;
 $1132 = (_ror32($1126,25)|0);
 $1133 = $1131 ^ $1132;
 $1134 = (_Ch($1126,$1105,$1084)|0);
 $1135 = ((($W)) + 212|0);
 $1136 = HEAP32[$1135>>2]|0;
 $1137 = (($1063) + 1322822218)|0;
 $1138 = (($1137) + ($1133))|0;
 $1139 = (($1138) + ($1134))|0;
 $1140 = (($1139) + ($1136))|0;
 $1141 = (_ror32($1128,2)|0);
 $1142 = (_ror32($1128,13)|0);
 $1143 = $1142 ^ $1141;
 $1144 = (_ror32($1128,22)|0);
 $1145 = $1143 ^ $1144;
 $1146 = (_Maj($1128,$1107,$1086)|0);
 $1147 = (($1140) + ($1065))|0;
 $1148 = (($1146) + ($1140))|0;
 $1149 = (($1148) + ($1145))|0;
 $1150 = (_ror32($1147,6)|0);
 $1151 = (_ror32($1147,11)|0);
 $1152 = $1151 ^ $1150;
 $1153 = (_ror32($1147,25)|0);
 $1154 = $1152 ^ $1153;
 $1155 = (_Ch($1147,$1126,$1105)|0);
 $1156 = ((($W)) + 216|0);
 $1157 = HEAP32[$1156>>2]|0;
 $1158 = (($1084) + 1537002063)|0;
 $1159 = (($1158) + ($1154))|0;
 $1160 = (($1159) + ($1155))|0;
 $1161 = (($1160) + ($1157))|0;
 $1162 = (_ror32($1149,2)|0);
 $1163 = (_ror32($1149,13)|0);
 $1164 = $1163 ^ $1162;
 $1165 = (_ror32($1149,22)|0);
 $1166 = $1164 ^ $1165;
 $1167 = (_Maj($1149,$1128,$1107)|0);
 $1168 = (($1161) + ($1086))|0;
 $1169 = (($1167) + ($1161))|0;
 $1170 = (($1169) + ($1166))|0;
 $1171 = (_ror32($1168,6)|0);
 $1172 = (_ror32($1168,11)|0);
 $1173 = $1172 ^ $1171;
 $1174 = (_ror32($1168,25)|0);
 $1175 = $1173 ^ $1174;
 $1176 = (_Ch($1168,$1147,$1126)|0);
 $1177 = ((($W)) + 220|0);
 $1178 = HEAP32[$1177>>2]|0;
 $1179 = (($1105) + 1747873779)|0;
 $1180 = (($1179) + ($1175))|0;
 $1181 = (($1180) + ($1176))|0;
 $1182 = (($1181) + ($1178))|0;
 $1183 = (_ror32($1170,2)|0);
 $1184 = (_ror32($1170,13)|0);
 $1185 = $1184 ^ $1183;
 $1186 = (_ror32($1170,22)|0);
 $1187 = $1185 ^ $1186;
 $1188 = (_Maj($1170,$1149,$1128)|0);
 $1189 = (($1182) + ($1107))|0;
 $1190 = (($1188) + ($1182))|0;
 $1191 = (($1190) + ($1187))|0;
 $1192 = (_ror32($1189,6)|0);
 $1193 = (_ror32($1189,11)|0);
 $1194 = $1193 ^ $1192;
 $1195 = (_ror32($1189,25)|0);
 $1196 = $1194 ^ $1195;
 $1197 = (_Ch($1189,$1168,$1147)|0);
 $1198 = ((($W)) + 224|0);
 $1199 = HEAP32[$1198>>2]|0;
 $1200 = (($1126) + 1955562222)|0;
 $1201 = (($1200) + ($1196))|0;
 $1202 = (($1201) + ($1197))|0;
 $1203 = (($1202) + ($1199))|0;
 $1204 = (_ror32($1191,2)|0);
 $1205 = (_ror32($1191,13)|0);
 $1206 = $1205 ^ $1204;
 $1207 = (_ror32($1191,22)|0);
 $1208 = $1206 ^ $1207;
 $1209 = (_Maj($1191,$1170,$1149)|0);
 $1210 = (($1203) + ($1128))|0;
 $1211 = (($1209) + ($1203))|0;
 $1212 = (($1211) + ($1208))|0;
 $1213 = (_ror32($1210,6)|0);
 $1214 = (_ror32($1210,11)|0);
 $1215 = $1214 ^ $1213;
 $1216 = (_ror32($1210,25)|0);
 $1217 = $1215 ^ $1216;
 $1218 = (_Ch($1210,$1189,$1168)|0);
 $1219 = ((($W)) + 228|0);
 $1220 = HEAP32[$1219>>2]|0;
 $1221 = (($1147) + 2024104815)|0;
 $1222 = (($1221) + ($1217))|0;
 $1223 = (($1222) + ($1218))|0;
 $1224 = (($1223) + ($1220))|0;
 $1225 = (_ror32($1212,2)|0);
 $1226 = (_ror32($1212,13)|0);
 $1227 = $1226 ^ $1225;
 $1228 = (_ror32($1212,22)|0);
 $1229 = $1227 ^ $1228;
 $1230 = (_Maj($1212,$1191,$1170)|0);
 $1231 = (($1224) + ($1149))|0;
 $1232 = (($1230) + ($1224))|0;
 $1233 = (($1232) + ($1229))|0;
 $1234 = (_ror32($1231,6)|0);
 $1235 = (_ror32($1231,11)|0);
 $1236 = $1235 ^ $1234;
 $1237 = (_ror32($1231,25)|0);
 $1238 = $1236 ^ $1237;
 $1239 = (_Ch($1231,$1210,$1189)|0);
 $1240 = ((($W)) + 232|0);
 $1241 = HEAP32[$1240>>2]|0;
 $1242 = (($1168) + -2067236844)|0;
 $1243 = (($1242) + ($1238))|0;
 $1244 = (($1243) + ($1239))|0;
 $1245 = (($1244) + ($1241))|0;
 $1246 = (_ror32($1233,2)|0);
 $1247 = (_ror32($1233,13)|0);
 $1248 = $1247 ^ $1246;
 $1249 = (_ror32($1233,22)|0);
 $1250 = $1248 ^ $1249;
 $1251 = (_Maj($1233,$1212,$1191)|0);
 $1252 = (($1245) + ($1170))|0;
 $1253 = (($1251) + ($1245))|0;
 $1254 = (($1253) + ($1250))|0;
 $1255 = (_ror32($1252,6)|0);
 $1256 = (_ror32($1252,11)|0);
 $1257 = $1256 ^ $1255;
 $1258 = (_ror32($1252,25)|0);
 $1259 = $1257 ^ $1258;
 $1260 = (_Ch($1252,$1231,$1210)|0);
 $1261 = ((($W)) + 236|0);
 $1262 = HEAP32[$1261>>2]|0;
 $1263 = (($1189) + -1933114872)|0;
 $1264 = (($1263) + ($1259))|0;
 $1265 = (($1264) + ($1260))|0;
 $1266 = (($1265) + ($1262))|0;
 $1267 = (_ror32($1254,2)|0);
 $1268 = (_ror32($1254,13)|0);
 $1269 = $1268 ^ $1267;
 $1270 = (_ror32($1254,22)|0);
 $1271 = $1269 ^ $1270;
 $1272 = (_Maj($1254,$1233,$1212)|0);
 $1273 = (($1266) + ($1191))|0;
 $1274 = (($1272) + ($1266))|0;
 $1275 = (($1274) + ($1271))|0;
 $1276 = (_ror32($1273,6)|0);
 $1277 = (_ror32($1273,11)|0);
 $1278 = $1277 ^ $1276;
 $1279 = (_ror32($1273,25)|0);
 $1280 = $1278 ^ $1279;
 $1281 = (_Ch($1273,$1252,$1231)|0);
 $1282 = ((($W)) + 240|0);
 $1283 = HEAP32[$1282>>2]|0;
 $1284 = (($1210) + -1866530822)|0;
 $1285 = (($1284) + ($1280))|0;
 $1286 = (($1285) + ($1281))|0;
 $1287 = (($1286) + ($1283))|0;
 $1288 = (_ror32($1275,2)|0);
 $1289 = (_ror32($1275,13)|0);
 $1290 = $1289 ^ $1288;
 $1291 = (_ror32($1275,22)|0);
 $1292 = $1290 ^ $1291;
 $1293 = (_Maj($1275,$1254,$1233)|0);
 $1294 = (($1287) + ($1212))|0;
 $1295 = (($1293) + ($1287))|0;
 $1296 = (($1295) + ($1292))|0;
 $1297 = (_ror32($1294,6)|0);
 $1298 = (_ror32($1294,11)|0);
 $1299 = $1298 ^ $1297;
 $1300 = (_ror32($1294,25)|0);
 $1301 = $1299 ^ $1300;
 $1302 = (_Ch($1294,$1273,$1252)|0);
 $1303 = ((($W)) + 244|0);
 $1304 = HEAP32[$1303>>2]|0;
 $1305 = (($1231) + -1538233109)|0;
 $1306 = (($1305) + ($1301))|0;
 $1307 = (($1306) + ($1302))|0;
 $1308 = (($1307) + ($1304))|0;
 $1309 = (_ror32($1296,2)|0);
 $1310 = (_ror32($1296,13)|0);
 $1311 = $1310 ^ $1309;
 $1312 = (_ror32($1296,22)|0);
 $1313 = $1311 ^ $1312;
 $1314 = (_Maj($1296,$1275,$1254)|0);
 $1315 = (($1308) + ($1233))|0;
 $1316 = (($1314) + ($1308))|0;
 $1317 = (($1316) + ($1313))|0;
 $1318 = (_ror32($1315,6)|0);
 $1319 = (_ror32($1315,11)|0);
 $1320 = $1319 ^ $1318;
 $1321 = (_ror32($1315,25)|0);
 $1322 = $1320 ^ $1321;
 $1323 = (_Ch($1315,$1294,$1273)|0);
 $1324 = ((($W)) + 248|0);
 $1325 = HEAP32[$1324>>2]|0;
 $1326 = (($1252) + -1090935817)|0;
 $1327 = (($1326) + ($1322))|0;
 $1328 = (($1327) + ($1323))|0;
 $1329 = (($1328) + ($1325))|0;
 $1330 = (_ror32($1317,2)|0);
 $1331 = (_ror32($1317,13)|0);
 $1332 = $1331 ^ $1330;
 $1333 = (_ror32($1317,22)|0);
 $1334 = $1332 ^ $1333;
 $1335 = (_Maj($1317,$1296,$1275)|0);
 $1336 = (($1329) + ($1254))|0;
 $1337 = (($1335) + ($1329))|0;
 $1338 = (($1337) + ($1334))|0;
 $1339 = (_ror32($1336,6)|0);
 $1340 = (_ror32($1336,11)|0);
 $1341 = $1340 ^ $1339;
 $1342 = (_ror32($1336,25)|0);
 $1343 = $1341 ^ $1342;
 $1344 = (_Ch($1336,$1315,$1294)|0);
 $1345 = ((($W)) + 252|0);
 $1346 = HEAP32[$1345>>2]|0;
 $1347 = (($1273) + -965641998)|0;
 $1348 = (($1347) + ($1343))|0;
 $1349 = (($1348) + ($1344))|0;
 $1350 = (($1349) + ($1346))|0;
 $1351 = (_ror32($1338,2)|0);
 $1352 = (_ror32($1338,13)|0);
 $1353 = $1352 ^ $1351;
 $1354 = (_ror32($1338,22)|0);
 $1355 = $1353 ^ $1354;
 $1356 = (_Maj($1338,$1317,$1296)|0);
 $1357 = (($1350) + ($1275))|0;
 $1358 = (($1350) + ($2))|0;
 $1359 = (($1358) + ($1356))|0;
 $1360 = (($1359) + ($1355))|0;
 HEAP32[$state>>2] = $1360;
 $1361 = HEAP32[$3>>2]|0;
 $1362 = (($1361) + ($1338))|0;
 HEAP32[$3>>2] = $1362;
 $1363 = HEAP32[$5>>2]|0;
 $1364 = (($1363) + ($1317))|0;
 HEAP32[$5>>2] = $1364;
 $1365 = HEAP32[$7>>2]|0;
 $1366 = (($1365) + ($1296))|0;
 HEAP32[$7>>2] = $1366;
 $1367 = HEAP32[$9>>2]|0;
 $1368 = (($1357) + ($1367))|0;
 HEAP32[$9>>2] = $1368;
 $1369 = HEAP32[$11>>2]|0;
 $1370 = (($1369) + ($1336))|0;
 HEAP32[$11>>2] = $1370;
 $1371 = HEAP32[$13>>2]|0;
 $1372 = (($1371) + ($1315))|0;
 HEAP32[$13>>2] = $1372;
 $1373 = HEAP32[$15>>2]|0;
 $1374 = (($1373) + ($1294))|0;
 HEAP32[$15>>2] = $1374;
 STACKTOP = sp;return;
}
function _LOAD_OP($I,$W,$input) {
 $I = $I|0;
 $W = $W|0;
 $input = $input|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (($input) + ($I<<2)|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = (($W) + ($I<<2)|0);
 HEAP32[$2>>2] = $1;
 return;
}
function _BLEND_OP($I,$W) {
 $I = $I|0;
 $W = $W|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (($I) + -2)|0;
 $1 = (($W) + ($0<<2)|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_ror32($2,17)|0);
 $4 = (_ror32($2,19)|0);
 $5 = $2 >>> 10;
 $6 = $5 ^ $3;
 $7 = $6 ^ $4;
 $8 = (($I) + -7)|0;
 $9 = (($W) + ($8<<2)|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($7) + ($10))|0;
 $12 = (($I) + -15)|0;
 $13 = (($W) + ($12<<2)|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (_ror32($14,7)|0);
 $16 = (_ror32($14,18)|0);
 $17 = $14 >>> 3;
 $18 = $17 ^ $15;
 $19 = $18 ^ $16;
 $20 = (($I) + -16)|0;
 $21 = (($W) + ($20<<2)|0);
 $22 = HEAP32[$21>>2]|0;
 $23 = (($11) + ($22))|0;
 $24 = (($23) + ($19))|0;
 $25 = (($W) + ($I<<2)|0);
 HEAP32[$25>>2] = $24;
 return;
}
function _ror32($word,$shift) {
 $word = $word|0;
 $shift = $shift|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $word >>> $shift;
 $1 = (32 - ($shift))|0;
 $2 = $word << $1;
 $3 = $2 | $0;
 return ($3|0);
}
function _Ch($x,$y,$z) {
 $x = $x|0;
 $y = $y|0;
 $z = $z|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $z ^ $y;
 $1 = $0 & $x;
 $2 = $1 ^ $z;
 return ($2|0);
}
function _Maj($x,$y,$z) {
 $x = $x|0;
 $y = $y|0;
 $z = $z|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $y & $x;
 $1 = $y | $x;
 $2 = $1 & $z;
 $3 = $2 | $0;
 return ($3|0);
}
function ___stdio_close($f) {
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = ((($f)) + 60|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$vararg_buffer>>2] = $1;
 $2 = (___syscall6(6,($vararg_buffer|0))|0);
 $3 = (___syscall_ret($2)|0);
 STACKTOP = sp;return ($3|0);
}
function ___syscall_ret($r) {
 $r = $r|0;
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($r>>>0)>(4294963200);
 if ($0) {
  $1 = (0 - ($r))|0;
  $2 = (___errno_location()|0);
  HEAP32[$2>>2] = $1;
  $$0 = -1;
 } else {
  $$0 = $r;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[818]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 3316;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function ___stdio_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0;
 var $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $iovs = sp + 32|0;
 $0 = ((($f)) + 28|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$iovs>>2] = $1;
 $2 = ((($iovs)) + 4|0);
 $3 = ((($f)) + 20|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) - ($1))|0;
 HEAP32[$2>>2] = $5;
 $6 = ((($iovs)) + 8|0);
 HEAP32[$6>>2] = $buf;
 $7 = ((($iovs)) + 12|0);
 HEAP32[$7>>2] = $len;
 $8 = (($5) + ($len))|0;
 $9 = ((($f)) + 60|0);
 $10 = ((($f)) + 44|0);
 $iov$0 = $iovs;$iovcnt$0 = 2;$rem$0 = $8;
 while(1) {
  $11 = HEAP32[818]|0;
  $12 = ($11|0)==(0|0);
  if ($12) {
   $16 = HEAP32[$9>>2]|0;
   HEAP32[$vararg_buffer3>>2] = $16;
   $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
   HEAP32[$vararg_ptr6>>2] = $iov$0;
   $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
   HEAP32[$vararg_ptr7>>2] = $iovcnt$0;
   $17 = (___syscall146(146,($vararg_buffer3|0))|0);
   $18 = (___syscall_ret($17)|0);
   $cnt$0 = $18;
  } else {
   _pthread_cleanup_push((1|0),($f|0));
   $13 = HEAP32[$9>>2]|0;
   HEAP32[$vararg_buffer>>2] = $13;
   $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr1>>2] = $iov$0;
   $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
   HEAP32[$vararg_ptr2>>2] = $iovcnt$0;
   $14 = (___syscall146(146,($vararg_buffer|0))|0);
   $15 = (___syscall_ret($14)|0);
   _pthread_cleanup_pop(0);
   $cnt$0 = $15;
  }
  $19 = ($rem$0|0)==($cnt$0|0);
  if ($19) {
   label = 6;
   break;
  }
  $26 = ($cnt$0|0)<(0);
  if ($26) {
   $iov$0$lcssa11 = $iov$0;$iovcnt$0$lcssa12 = $iovcnt$0;
   label = 8;
   break;
  }
  $34 = (($rem$0) - ($cnt$0))|0;
  $35 = ((($iov$0)) + 4|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = ($cnt$0>>>0)>($36>>>0);
  if ($37) {
   $38 = HEAP32[$10>>2]|0;
   HEAP32[$0>>2] = $38;
   HEAP32[$3>>2] = $38;
   $39 = (($cnt$0) - ($36))|0;
   $40 = ((($iov$0)) + 8|0);
   $41 = (($iovcnt$0) + -1)|0;
   $$phi$trans$insert = ((($iov$0)) + 12|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   $49 = $$pre;$cnt$1 = $39;$iov$1 = $40;$iovcnt$1 = $41;
  } else {
   $42 = ($iovcnt$0|0)==(2);
   if ($42) {
    $43 = HEAP32[$0>>2]|0;
    $44 = (($43) + ($cnt$0)|0);
    HEAP32[$0>>2] = $44;
    $49 = $36;$cnt$1 = $cnt$0;$iov$1 = $iov$0;$iovcnt$1 = 2;
   } else {
    $49 = $36;$cnt$1 = $cnt$0;$iov$1 = $iov$0;$iovcnt$1 = $iovcnt$0;
   }
  }
  $45 = HEAP32[$iov$1>>2]|0;
  $46 = (($45) + ($cnt$1)|0);
  HEAP32[$iov$1>>2] = $46;
  $47 = ((($iov$1)) + 4|0);
  $48 = (($49) - ($cnt$1))|0;
  HEAP32[$47>>2] = $48;
  $iov$0 = $iov$1;$iovcnt$0 = $iovcnt$1;$rem$0 = $34;
 }
 if ((label|0) == 6) {
  $20 = HEAP32[$10>>2]|0;
  $21 = ((($f)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($f)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$0>>2] = $25;
  HEAP32[$3>>2] = $25;
  $$0 = $len;
 }
 else if ((label|0) == 8) {
  $27 = ((($f)) + 16|0);
  HEAP32[$27>>2] = 0;
  HEAP32[$0>>2] = 0;
  HEAP32[$3>>2] = 0;
  $28 = HEAP32[$f>>2]|0;
  $29 = $28 | 32;
  HEAP32[$f>>2] = $29;
  $30 = ($iovcnt$0$lcssa12|0)==(2);
  if ($30) {
   $$0 = 0;
  } else {
   $31 = ((($iov$0$lcssa11)) + 4|0);
   $32 = HEAP32[$31>>2]|0;
   $33 = (($len) - ($32))|0;
   $$0 = $33;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _cleanup_314($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($p)) + 68|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  ___unlockfile($p);
 }
 return;
}
function ___unlockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___stdio_seek($f,$off,$whence) {
 $f = $f|0;
 $off = $off|0;
 $whence = $whence|0;
 var $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $ret = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $ret = sp + 20|0;
 $0 = ((($f)) + 60|0);
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$vararg_buffer>>2] = $1;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $off;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $ret;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $whence;
 $2 = (___syscall140(140,($vararg_buffer|0))|0);
 $3 = (___syscall_ret($2)|0);
 $4 = ($3|0)<(0);
 if ($4) {
  HEAP32[$ret>>2] = -1;
  $5 = -1;
 } else {
  $$pre = HEAP32[$ret>>2]|0;
  $5 = $$pre;
 }
 STACKTOP = sp;return ($5|0);
}
function ___stdout_write($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $tio = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer = sp;
 $tio = sp + 12|0;
 $0 = ((($f)) + 36|0);
 HEAP32[$0>>2] = 4;
 $1 = HEAP32[$f>>2]|0;
 $2 = $1 & 64;
 $3 = ($2|0)==(0);
 if ($3) {
  $4 = ((($f)) + 60|0);
  $5 = HEAP32[$4>>2]|0;
  HEAP32[$vararg_buffer>>2] = $5;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21505;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $tio;
  $6 = (___syscall54(54,($vararg_buffer|0))|0);
  $7 = ($6|0)==(0);
  if (!($7)) {
   $8 = ((($f)) + 75|0);
   HEAP8[$8>>0] = -1;
  }
 }
 $9 = (___stdio_write($f,$buf,$len)|0);
 STACKTOP = sp;return ($9|0);
}
function _copysign($x,$y) {
 $x = +$x;
 $y = +$y;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $fabs = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $y;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 $fabs = (+Math_abs((+$x)));
 HEAPF64[tempDoublePtr>>3] = $fabs;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = $1 & -2147483648;
 $5 = $4 | $3;
 HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $5;$6 = +HEAPF64[tempDoublePtr>>3];
 return (+$6);
}
function ___shlim($f,$lim) {
 $f = $f|0;
 $lim = $lim|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 104|0);
 HEAP32[$0>>2] = $lim;
 $1 = ((($f)) + 8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($f)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) - ($4))|0;
 $6 = ((($f)) + 108|0);
 HEAP32[$6>>2] = $5;
 $7 = ($lim|0)!=(0);
 $8 = ($5|0)>($lim|0);
 $or$cond = $7 & $8;
 if ($or$cond) {
  $9 = $4;
  $10 = (($9) + ($lim)|0);
  $11 = ((($f)) + 100|0);
  HEAP32[$11>>2] = $10;
 } else {
  $12 = ((($f)) + 100|0);
  HEAP32[$12>>2] = $2;
 }
 return;
}
function ___intscan($f,$base,$pok,$0,$1) {
 $f = $f|0;
 $base = $base|0;
 $pok = $pok|0;
 $0 = $0|0;
 $1 = $1|0;
 var $$1 = 0, $$115 = 0, $$116 = 0, $$base14 = 0, $$lcssa = 0, $$lcssa108 = 0, $$lcssa109 = 0, $$lcssa110 = 0, $$lcssa111 = 0, $$lcssa112 = 0, $$lcssa113 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0;
 var $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0;
 var $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0;
 var $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0;
 var $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0;
 var $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0;
 var $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0;
 var $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0;
 var $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0;
 var $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0;
 var $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0;
 var $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $c$0 = 0, $c$1 = 0, $c$117 = 0, $c$2$be = 0, $c$2$be$lcssa = 0, $c$2$lcssa = 0, $c$3$be = 0, $c$3$lcssa = 0, $c$359 = 0, $c$4$be = 0, $c$4$be$lcssa = 0, $c$4$lcssa = 0, $c$5$be = 0, $c$6$be = 0, $c$6$be$lcssa = 0;
 var $c$6$lcssa = 0, $c$7$be = 0, $c$742 = 0, $c$8 = 0, $c$9$be = 0, $neg$0 = 0, $neg$0$ = 0, $neg$1 = 0, $or$cond = 0, $or$cond12 = 0, $or$cond31 = 0, $or$cond5 = 0, $or$cond7 = 0, $x$070 = 0, $x$136 = 0, $x$254 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($base>>>0)>(36);
 L1: do {
  if ($2) {
   $5 = (___errno_location()|0);
   HEAP32[$5>>2] = 22;
   $286 = 0;$287 = 0;
  } else {
   $3 = ((($f)) + 4|0);
   $4 = ((($f)) + 100|0);
   while(1) {
    $6 = HEAP32[$3>>2]|0;
    $7 = HEAP32[$4>>2]|0;
    $8 = ($6>>>0)<($7>>>0);
    if ($8) {
     $9 = ((($6)) + 1|0);
     HEAP32[$3>>2] = $9;
     $10 = HEAP8[$6>>0]|0;
     $11 = $10&255;
     $13 = $11;
    } else {
     $12 = (___shgetc($f)|0);
     $13 = $12;
    }
    $14 = (_isspace($13)|0);
    $15 = ($14|0)==(0);
    if ($15) {
     $$lcssa113 = $13;
     break;
    }
   }
   $16 = ($$lcssa113|0)==(45);
   L11: do {
    switch ($$lcssa113|0) {
    case 43: case 45:  {
     $17 = $16 << 31 >> 31;
     $18 = HEAP32[$3>>2]|0;
     $19 = HEAP32[$4>>2]|0;
     $20 = ($18>>>0)<($19>>>0);
     if ($20) {
      $21 = ((($18)) + 1|0);
      HEAP32[$3>>2] = $21;
      $22 = HEAP8[$18>>0]|0;
      $23 = $22&255;
      $c$0 = $23;$neg$0 = $17;
      break L11;
     } else {
      $24 = (___shgetc($f)|0);
      $c$0 = $24;$neg$0 = $17;
      break L11;
     }
     break;
    }
    default: {
     $c$0 = $$lcssa113;$neg$0 = 0;
    }
    }
   } while(0);
   $25 = ($base|0)==(0);
   $26 = $base | 16;
   $27 = ($26|0)==(16);
   $28 = ($c$0|0)==(48);
   $or$cond5 = $27 & $28;
   do {
    if ($or$cond5) {
     $29 = HEAP32[$3>>2]|0;
     $30 = HEAP32[$4>>2]|0;
     $31 = ($29>>>0)<($30>>>0);
     if ($31) {
      $32 = ((($29)) + 1|0);
      HEAP32[$3>>2] = $32;
      $33 = HEAP8[$29>>0]|0;
      $34 = $33&255;
      $37 = $34;
     } else {
      $35 = (___shgetc($f)|0);
      $37 = $35;
     }
     $36 = $37 | 32;
     $38 = ($36|0)==(120);
     if (!($38)) {
      if ($25) {
       $$116 = 8;$c$117 = $37;
       label = 46;
       break;
      } else {
       $$1 = $base;$c$1 = $37;
       label = 32;
       break;
      }
     }
     $39 = HEAP32[$3>>2]|0;
     $40 = HEAP32[$4>>2]|0;
     $41 = ($39>>>0)<($40>>>0);
     if ($41) {
      $42 = ((($39)) + 1|0);
      HEAP32[$3>>2] = $42;
      $43 = HEAP8[$39>>0]|0;
      $44 = $43&255;
      $47 = $44;
     } else {
      $45 = (___shgetc($f)|0);
      $47 = $45;
     }
     $46 = ((567) + ($47)|0);
     $48 = HEAP8[$46>>0]|0;
     $49 = ($48&255)>(15);
     if ($49) {
      $50 = HEAP32[$4>>2]|0;
      $51 = ($50|0)==(0|0);
      if (!($51)) {
       $52 = HEAP32[$3>>2]|0;
       $53 = ((($52)) + -1|0);
       HEAP32[$3>>2] = $53;
      }
      $54 = ($pok|0)==(0);
      if ($54) {
       ___shlim($f,0);
       $286 = 0;$287 = 0;
       break L1;
      }
      if ($51) {
       $286 = 0;$287 = 0;
       break L1;
      }
      $55 = HEAP32[$3>>2]|0;
      $56 = ((($55)) + -1|0);
      HEAP32[$3>>2] = $56;
      $286 = 0;$287 = 0;
      break L1;
     } else {
      $$116 = 16;$c$117 = $47;
      label = 46;
     }
    } else {
     $$base14 = $25 ? 10 : $base;
     $57 = ((567) + ($c$0)|0);
     $58 = HEAP8[$57>>0]|0;
     $59 = $58&255;
     $60 = ($59>>>0)<($$base14>>>0);
     if ($60) {
      $$1 = $$base14;$c$1 = $c$0;
      label = 32;
     } else {
      $61 = HEAP32[$4>>2]|0;
      $62 = ($61|0)==(0|0);
      if (!($62)) {
       $63 = HEAP32[$3>>2]|0;
       $64 = ((($63)) + -1|0);
       HEAP32[$3>>2] = $64;
      }
      ___shlim($f,0);
      $65 = (___errno_location()|0);
      HEAP32[$65>>2] = 22;
      $286 = 0;$287 = 0;
      break L1;
     }
    }
   } while(0);
   if ((label|0) == 32) {
    $66 = ($$1|0)==(10);
    if ($66) {
     $67 = (($c$1) + -48)|0;
     $68 = ($67>>>0)<(10);
     if ($68) {
      $71 = $67;$x$070 = 0;
      while(1) {
       $69 = ($x$070*10)|0;
       $70 = (($69) + ($71))|0;
       $72 = HEAP32[$3>>2]|0;
       $73 = HEAP32[$4>>2]|0;
       $74 = ($72>>>0)<($73>>>0);
       if ($74) {
        $75 = ((($72)) + 1|0);
        HEAP32[$3>>2] = $75;
        $76 = HEAP8[$72>>0]|0;
        $77 = $76&255;
        $c$2$be = $77;
       } else {
        $78 = (___shgetc($f)|0);
        $c$2$be = $78;
       }
       $79 = (($c$2$be) + -48)|0;
       $80 = ($79>>>0)<(10);
       $81 = ($70>>>0)<(429496729);
       $82 = $80 & $81;
       if ($82) {
        $71 = $79;$x$070 = $70;
       } else {
        $$lcssa112 = $70;$c$2$be$lcssa = $c$2$be;
        break;
       }
      }
      $288 = $$lcssa112;$289 = 0;$c$2$lcssa = $c$2$be$lcssa;
     } else {
      $288 = 0;$289 = 0;$c$2$lcssa = $c$1;
     }
     $83 = (($c$2$lcssa) + -48)|0;
     $84 = ($83>>>0)<(10);
     if ($84) {
      $85 = $288;$86 = $289;$89 = $83;$c$359 = $c$2$lcssa;
      while(1) {
       $87 = (___muldi3(($85|0),($86|0),10,0)|0);
       $88 = tempRet0;
       $90 = ($89|0)<(0);
       $91 = $90 << 31 >> 31;
       $92 = $89 ^ -1;
       $93 = $91 ^ -1;
       $94 = ($88>>>0)>($93>>>0);
       $95 = ($87>>>0)>($92>>>0);
       $96 = ($88|0)==($93|0);
       $97 = $96 & $95;
       $98 = $94 | $97;
       if ($98) {
        $$lcssa = $89;$290 = $85;$291 = $86;$c$3$lcssa = $c$359;
        break;
       }
       $99 = (_i64Add(($87|0),($88|0),($89|0),($91|0))|0);
       $100 = tempRet0;
       $101 = HEAP32[$3>>2]|0;
       $102 = HEAP32[$4>>2]|0;
       $103 = ($101>>>0)<($102>>>0);
       if ($103) {
        $104 = ((($101)) + 1|0);
        HEAP32[$3>>2] = $104;
        $105 = HEAP8[$101>>0]|0;
        $106 = $105&255;
        $c$3$be = $106;
       } else {
        $107 = (___shgetc($f)|0);
        $c$3$be = $107;
       }
       $108 = (($c$3$be) + -48)|0;
       $109 = ($108>>>0)<(10);
       $110 = ($100>>>0)<(429496729);
       $111 = ($99>>>0)<(2576980378);
       $112 = ($100|0)==(429496729);
       $113 = $112 & $111;
       $114 = $110 | $113;
       $or$cond7 = $109 & $114;
       if ($or$cond7) {
        $85 = $99;$86 = $100;$89 = $108;$c$359 = $c$3$be;
       } else {
        $$lcssa = $108;$290 = $99;$291 = $100;$c$3$lcssa = $c$3$be;
        break;
       }
      }
      $115 = ($$lcssa>>>0)>(9);
      if ($115) {
       $259 = $291;$261 = $290;$neg$1 = $neg$0;
      } else {
       $$115 = 10;$292 = $290;$293 = $291;$c$8 = $c$3$lcssa;
       label = 72;
      }
     } else {
      $259 = $289;$261 = $288;$neg$1 = $neg$0;
     }
    } else {
     $$116 = $$1;$c$117 = $c$1;
     label = 46;
    }
   }
   L63: do {
    if ((label|0) == 46) {
     $116 = (($$116) + -1)|0;
     $117 = $116 & $$116;
     $118 = ($117|0)==(0);
     if ($118) {
      $123 = ($$116*23)|0;
      $124 = $123 >>> 5;
      $125 = $124 & 7;
      $126 = (823 + ($125)|0);
      $127 = HEAP8[$126>>0]|0;
      $128 = $127 << 24 >> 24;
      $129 = ((567) + ($c$117)|0);
      $130 = HEAP8[$129>>0]|0;
      $131 = $130&255;
      $132 = ($131>>>0)<($$116>>>0);
      if ($132) {
       $135 = $131;$x$136 = 0;
       while(1) {
        $133 = $x$136 << $128;
        $134 = $135 | $133;
        $136 = HEAP32[$3>>2]|0;
        $137 = HEAP32[$4>>2]|0;
        $138 = ($136>>>0)<($137>>>0);
        if ($138) {
         $139 = ((($136)) + 1|0);
         HEAP32[$3>>2] = $139;
         $140 = HEAP8[$136>>0]|0;
         $141 = $140&255;
         $c$4$be = $141;
        } else {
         $142 = (___shgetc($f)|0);
         $c$4$be = $142;
        }
        $143 = ((567) + ($c$4$be)|0);
        $144 = HEAP8[$143>>0]|0;
        $145 = $144&255;
        $146 = ($145>>>0)<($$116>>>0);
        $147 = ($134>>>0)<(134217728);
        $148 = $147 & $146;
        if ($148) {
         $135 = $145;$x$136 = $134;
        } else {
         $$lcssa108 = $134;$$lcssa109 = $144;$c$4$be$lcssa = $c$4$be;
         break;
        }
       }
       $152 = $$lcssa109;$154 = 0;$156 = $$lcssa108;$c$4$lcssa = $c$4$be$lcssa;
      } else {
       $152 = $130;$154 = 0;$156 = 0;$c$4$lcssa = $c$117;
      }
      $149 = (_bitshift64Lshr(-1,-1,($128|0))|0);
      $150 = tempRet0;
      $151 = $152&255;
      $153 = ($151>>>0)>=($$116>>>0);
      $155 = ($154>>>0)>($150>>>0);
      $157 = ($156>>>0)>($149>>>0);
      $158 = ($154|0)==($150|0);
      $159 = $158 & $157;
      $160 = $155 | $159;
      $or$cond31 = $153 | $160;
      if ($or$cond31) {
       $$115 = $$116;$292 = $156;$293 = $154;$c$8 = $c$4$lcssa;
       label = 72;
       break;
      } else {
       $161 = $156;$162 = $154;$166 = $152;
      }
      while(1) {
       $163 = (_bitshift64Shl(($161|0),($162|0),($128|0))|0);
       $164 = tempRet0;
       $165 = $166&255;
       $167 = $165 | $163;
       $168 = HEAP32[$3>>2]|0;
       $169 = HEAP32[$4>>2]|0;
       $170 = ($168>>>0)<($169>>>0);
       if ($170) {
        $171 = ((($168)) + 1|0);
        HEAP32[$3>>2] = $171;
        $172 = HEAP8[$168>>0]|0;
        $173 = $172&255;
        $c$5$be = $173;
       } else {
        $174 = (___shgetc($f)|0);
        $c$5$be = $174;
       }
       $175 = ((567) + ($c$5$be)|0);
       $176 = HEAP8[$175>>0]|0;
       $177 = $176&255;
       $178 = ($177>>>0)>=($$116>>>0);
       $179 = ($164>>>0)>($150>>>0);
       $180 = ($167>>>0)>($149>>>0);
       $181 = ($164|0)==($150|0);
       $182 = $181 & $180;
       $183 = $179 | $182;
       $or$cond = $178 | $183;
       if ($or$cond) {
        $$115 = $$116;$292 = $167;$293 = $164;$c$8 = $c$5$be;
        label = 72;
        break L63;
       } else {
        $161 = $167;$162 = $164;$166 = $176;
       }
      }
     }
     $119 = ((567) + ($c$117)|0);
     $120 = HEAP8[$119>>0]|0;
     $121 = $120&255;
     $122 = ($121>>>0)<($$116>>>0);
     if ($122) {
      $186 = $121;$x$254 = 0;
      while(1) {
       $184 = Math_imul($x$254, $$116)|0;
       $185 = (($186) + ($184))|0;
       $187 = HEAP32[$3>>2]|0;
       $188 = HEAP32[$4>>2]|0;
       $189 = ($187>>>0)<($188>>>0);
       if ($189) {
        $190 = ((($187)) + 1|0);
        HEAP32[$3>>2] = $190;
        $191 = HEAP8[$187>>0]|0;
        $192 = $191&255;
        $c$6$be = $192;
       } else {
        $193 = (___shgetc($f)|0);
        $c$6$be = $193;
       }
       $194 = ((567) + ($c$6$be)|0);
       $195 = HEAP8[$194>>0]|0;
       $196 = $195&255;
       $197 = ($196>>>0)<($$116>>>0);
       $198 = ($185>>>0)<(119304647);
       $199 = $198 & $197;
       if ($199) {
        $186 = $196;$x$254 = $185;
       } else {
        $$lcssa110 = $185;$$lcssa111 = $195;$c$6$be$lcssa = $c$6$be;
        break;
       }
      }
      $201 = $$lcssa111;$294 = $$lcssa110;$295 = 0;$c$6$lcssa = $c$6$be$lcssa;
     } else {
      $201 = $120;$294 = 0;$295 = 0;$c$6$lcssa = $c$117;
     }
     $200 = $201&255;
     $202 = ($200>>>0)<($$116>>>0);
     if ($202) {
      $203 = (___udivdi3(-1,-1,($$116|0),0)|0);
      $204 = tempRet0;
      $205 = $295;$207 = $294;$215 = $201;$c$742 = $c$6$lcssa;
      while(1) {
       $206 = ($205>>>0)>($204>>>0);
       $208 = ($207>>>0)>($203>>>0);
       $209 = ($205|0)==($204|0);
       $210 = $209 & $208;
       $211 = $206 | $210;
       if ($211) {
        $$115 = $$116;$292 = $207;$293 = $205;$c$8 = $c$742;
        label = 72;
        break L63;
       }
       $212 = (___muldi3(($207|0),($205|0),($$116|0),0)|0);
       $213 = tempRet0;
       $214 = $215&255;
       $216 = $214 ^ -1;
       $217 = ($213>>>0)>(4294967295);
       $218 = ($212>>>0)>($216>>>0);
       $219 = ($213|0)==(-1);
       $220 = $219 & $218;
       $221 = $217 | $220;
       if ($221) {
        $$115 = $$116;$292 = $207;$293 = $205;$c$8 = $c$742;
        label = 72;
        break L63;
       }
       $222 = (_i64Add(($214|0),0,($212|0),($213|0))|0);
       $223 = tempRet0;
       $224 = HEAP32[$3>>2]|0;
       $225 = HEAP32[$4>>2]|0;
       $226 = ($224>>>0)<($225>>>0);
       if ($226) {
        $227 = ((($224)) + 1|0);
        HEAP32[$3>>2] = $227;
        $228 = HEAP8[$224>>0]|0;
        $229 = $228&255;
        $c$7$be = $229;
       } else {
        $230 = (___shgetc($f)|0);
        $c$7$be = $230;
       }
       $231 = ((567) + ($c$7$be)|0);
       $232 = HEAP8[$231>>0]|0;
       $233 = $232&255;
       $234 = ($233>>>0)<($$116>>>0);
       if ($234) {
        $205 = $223;$207 = $222;$215 = $232;$c$742 = $c$7$be;
       } else {
        $$115 = $$116;$292 = $222;$293 = $223;$c$8 = $c$7$be;
        label = 72;
        break;
       }
      }
     } else {
      $$115 = $$116;$292 = $294;$293 = $295;$c$8 = $c$6$lcssa;
      label = 72;
     }
    }
   } while(0);
   if ((label|0) == 72) {
    $235 = ((567) + ($c$8)|0);
    $236 = HEAP8[$235>>0]|0;
    $237 = $236&255;
    $238 = ($237>>>0)<($$115>>>0);
    if ($238) {
     while(1) {
      $239 = HEAP32[$3>>2]|0;
      $240 = HEAP32[$4>>2]|0;
      $241 = ($239>>>0)<($240>>>0);
      if ($241) {
       $242 = ((($239)) + 1|0);
       HEAP32[$3>>2] = $242;
       $243 = HEAP8[$239>>0]|0;
       $244 = $243&255;
       $c$9$be = $244;
      } else {
       $245 = (___shgetc($f)|0);
       $c$9$be = $245;
      }
      $246 = ((567) + ($c$9$be)|0);
      $247 = HEAP8[$246>>0]|0;
      $248 = $247&255;
      $249 = ($248>>>0)<($$115>>>0);
      if (!($249)) {
       break;
      }
     }
     $250 = (___errno_location()|0);
     HEAP32[$250>>2] = 34;
     $251 = $0 & 1;
     $252 = ($251|0)==(0);
     $253 = (0)==(0);
     $254 = $252 & $253;
     $neg$0$ = $254 ? $neg$0 : 0;
     $259 = $1;$261 = $0;$neg$1 = $neg$0$;
    } else {
     $259 = $293;$261 = $292;$neg$1 = $neg$0;
    }
   }
   $255 = HEAP32[$4>>2]|0;
   $256 = ($255|0)==(0|0);
   if (!($256)) {
    $257 = HEAP32[$3>>2]|0;
    $258 = ((($257)) + -1|0);
    HEAP32[$3>>2] = $258;
   }
   $260 = ($259>>>0)<($1>>>0);
   $262 = ($261>>>0)<($0>>>0);
   $263 = ($259|0)==($1|0);
   $264 = $263 & $262;
   $265 = $260 | $264;
   if (!($265)) {
    $266 = $0 & 1;
    $267 = ($266|0)!=(0);
    $268 = (0)!=(0);
    $269 = $267 | $268;
    $270 = ($neg$1|0)!=(0);
    $or$cond12 = $269 | $270;
    if (!($or$cond12)) {
     $271 = (___errno_location()|0);
     HEAP32[$271>>2] = 34;
     $272 = (_i64Add(($0|0),($1|0),-1,-1)|0);
     $273 = tempRet0;
     $286 = $273;$287 = $272;
     break;
    }
    $274 = ($259>>>0)>($1>>>0);
    $275 = ($261>>>0)>($0>>>0);
    $276 = ($259|0)==($1|0);
    $277 = $276 & $275;
    $278 = $274 | $277;
    if ($278) {
     $279 = (___errno_location()|0);
     HEAP32[$279>>2] = 34;
     $286 = $1;$287 = $0;
     break;
    }
   }
   $280 = ($neg$1|0)<(0);
   $281 = $280 << 31 >> 31;
   $282 = $261 ^ $neg$1;
   $283 = $259 ^ $281;
   $284 = (_i64Subtract(($282|0),($283|0),($neg$1|0),($281|0))|0);
   $285 = tempRet0;
   $286 = $285;$287 = $284;
  }
 } while(0);
 tempRet0 = ($286);
 return ($287|0);
}
function ___shgetc($f) {
 $f = $f|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$phi$trans$insert3 = 0, $$pre = 0, $$pre4 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 104|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  label = 3;
 } else {
  $3 = ((($f)) + 108|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = ($4|0)<($1|0);
  if ($5) {
   label = 3;
  } else {
   label = 4;
  }
 }
 if ((label|0) == 3) {
  $6 = (___uflow($f)|0);
  $7 = ($6|0)<(0);
  if ($7) {
   label = 4;
  } else {
   $9 = HEAP32[$0>>2]|0;
   $10 = ($9|0)==(0);
   $$phi$trans$insert = ((($f)) + 8|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   if ($10) {
    $11 = $$pre;
    $41 = $11;
    label = 9;
   } else {
    $12 = ((($f)) + 4|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = $13;
    $15 = (($$pre) - ($14))|0;
    $16 = ((($f)) + 108|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = (($9) - ($17))|0;
    $19 = ($15|0)<($18|0);
    $20 = $$pre;
    if ($19) {
     $41 = $20;
     label = 9;
    } else {
     $21 = (($18) + -1)|0;
     $22 = (($13) + ($21)|0);
     $23 = ((($f)) + 100|0);
     HEAP32[$23>>2] = $22;
     $25 = $20;
    }
   }
   if ((label|0) == 9) {
    $24 = ((($f)) + 100|0);
    HEAP32[$24>>2] = $$pre;
    $25 = $41;
   }
   $26 = ($25|0)==(0|0);
   $$phi$trans$insert3 = ((($f)) + 4|0);
   if ($26) {
    $$pre4 = HEAP32[$$phi$trans$insert3>>2]|0;
    $36 = $$pre4;
   } else {
    $27 = HEAP32[$$phi$trans$insert3>>2]|0;
    $28 = $25;
    $29 = ((($f)) + 108|0);
    $30 = HEAP32[$29>>2]|0;
    $31 = (($28) + 1)|0;
    $32 = (($31) - ($27))|0;
    $33 = (($32) + ($30))|0;
    HEAP32[$29>>2] = $33;
    $34 = $27;
    $36 = $34;
   }
   $35 = ((($36)) + -1|0);
   $37 = HEAP8[$35>>0]|0;
   $38 = $37&255;
   $39 = ($38|0)==($6|0);
   if ($39) {
    $$0 = $6;
   } else {
    $40 = $6&255;
    HEAP8[$35>>0] = $40;
    $$0 = $6;
   }
  }
 }
 if ((label|0) == 4) {
  $8 = ((($f)) + 100|0);
  HEAP32[$8>>2] = 0;
  $$0 = -1;
 }
 return ($$0|0);
}
function ___uflow($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $c = sp;
 $0 = ((($f)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $3 = (___toread($f)|0);
  $4 = ($3|0)==(0);
  if ($4) {
   label = 3;
  } else {
   $$0 = -1;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $5 = ((($f)) + 32|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = (FUNCTION_TABLE_iiii[$6 & 7]($f,$c,1)|0);
  $8 = ($7|0)==(1);
  if ($8) {
   $9 = HEAP8[$c>>0]|0;
   $10 = $9&255;
   $$0 = $10;
  } else {
   $$0 = -1;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function ___toread($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 74|0);
 $1 = HEAP8[$0>>0]|0;
 $2 = $1 << 24 >> 24;
 $3 = (($2) + 255)|0;
 $4 = $3 | $2;
 $5 = $4&255;
 HEAP8[$0>>0] = $5;
 $6 = ((($f)) + 20|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($f)) + 44|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($7>>>0)>($9>>>0);
 if ($10) {
  $11 = ((($f)) + 36|0);
  $12 = HEAP32[$11>>2]|0;
  (FUNCTION_TABLE_iiii[$12 & 7]($f,0,0)|0);
 }
 $13 = ((($f)) + 16|0);
 HEAP32[$13>>2] = 0;
 $14 = ((($f)) + 28|0);
 HEAP32[$14>>2] = 0;
 HEAP32[$6>>2] = 0;
 $15 = HEAP32[$f>>2]|0;
 $16 = $15 & 20;
 $17 = ($16|0)==(0);
 if ($17) {
  $21 = HEAP32[$8>>2]|0;
  $22 = ((($f)) + 8|0);
  HEAP32[$22>>2] = $21;
  $23 = ((($f)) + 4|0);
  HEAP32[$23>>2] = $21;
  $$0 = 0;
 } else {
  $18 = $15 & 4;
  $19 = ($18|0)==(0);
  if ($19) {
   $$0 = -1;
  } else {
   $20 = $15 | 32;
   HEAP32[$f>>2] = $20;
   $$0 = -1;
  }
 }
 return ($$0|0);
}
function _isspace($c) {
 $c = $c|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($c|0)==(32);
 $1 = (($c) + -9)|0;
 $2 = ($1>>>0)<(5);
 $3 = $0 | $2;
 $4 = $3&1;
 return ($4|0);
}
function _memchr($src,$c,$n) {
 $src = $src|0;
 $c = $c|0;
 $n = $n|0;
 var $$0$lcssa = 0, $$0$lcssa30 = 0, $$019 = 0, $$1$lcssa = 0, $$110 = 0, $$110$lcssa = 0, $$24 = 0, $$3 = 0, $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond18 = 0, $s$0$lcssa = 0, $s$0$lcssa29 = 0, $s$020 = 0, $s$15 = 0, $s$2 = 0, $w$0$lcssa = 0, $w$011 = 0, $w$011$lcssa = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $c & 255;
 $1 = $src;
 $2 = $1 & 3;
 $3 = ($2|0)!=(0);
 $4 = ($n|0)!=(0);
 $or$cond18 = $4 & $3;
 L1: do {
  if ($or$cond18) {
   $5 = $c&255;
   $$019 = $n;$s$020 = $src;
   while(1) {
    $6 = HEAP8[$s$020>>0]|0;
    $7 = ($6<<24>>24)==($5<<24>>24);
    if ($7) {
     $$0$lcssa30 = $$019;$s$0$lcssa29 = $s$020;
     label = 6;
     break L1;
    }
    $8 = ((($s$020)) + 1|0);
    $9 = (($$019) + -1)|0;
    $10 = $8;
    $11 = $10 & 3;
    $12 = ($11|0)!=(0);
    $13 = ($9|0)!=(0);
    $or$cond = $13 & $12;
    if ($or$cond) {
     $$019 = $9;$s$020 = $8;
    } else {
     $$0$lcssa = $9;$$lcssa = $13;$s$0$lcssa = $8;
     label = 5;
     break;
    }
   }
  } else {
   $$0$lcssa = $n;$$lcssa = $4;$s$0$lcssa = $src;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$0$lcssa30 = $$0$lcssa;$s$0$lcssa29 = $s$0$lcssa;
   label = 6;
  } else {
   $$3 = 0;$s$2 = $s$0$lcssa;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $14 = HEAP8[$s$0$lcssa29>>0]|0;
   $15 = $c&255;
   $16 = ($14<<24>>24)==($15<<24>>24);
   if ($16) {
    $$3 = $$0$lcssa30;$s$2 = $s$0$lcssa29;
   } else {
    $17 = Math_imul($0, 16843009)|0;
    $18 = ($$0$lcssa30>>>0)>(3);
    L11: do {
     if ($18) {
      $$110 = $$0$lcssa30;$w$011 = $s$0$lcssa29;
      while(1) {
       $19 = HEAP32[$w$011>>2]|0;
       $20 = $19 ^ $17;
       $21 = (($20) + -16843009)|0;
       $22 = $20 & -2139062144;
       $23 = $22 ^ -2139062144;
       $24 = $23 & $21;
       $25 = ($24|0)==(0);
       if (!($25)) {
        $$110$lcssa = $$110;$w$011$lcssa = $w$011;
        break;
       }
       $26 = ((($w$011)) + 4|0);
       $27 = (($$110) + -4)|0;
       $28 = ($27>>>0)>(3);
       if ($28) {
        $$110 = $27;$w$011 = $26;
       } else {
        $$1$lcssa = $27;$w$0$lcssa = $26;
        label = 11;
        break L11;
       }
      }
      $$24 = $$110$lcssa;$s$15 = $w$011$lcssa;
     } else {
      $$1$lcssa = $$0$lcssa30;$w$0$lcssa = $s$0$lcssa29;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $29 = ($$1$lcssa|0)==(0);
     if ($29) {
      $$3 = 0;$s$2 = $w$0$lcssa;
      break;
     } else {
      $$24 = $$1$lcssa;$s$15 = $w$0$lcssa;
     }
    }
    while(1) {
     $30 = HEAP8[$s$15>>0]|0;
     $31 = ($30<<24>>24)==($15<<24>>24);
     if ($31) {
      $$3 = $$24;$s$2 = $s$15;
      break L8;
     }
     $32 = ((($s$15)) + 1|0);
     $33 = (($$24) + -1)|0;
     $34 = ($33|0)==(0);
     if ($34) {
      $$3 = 0;$s$2 = $32;
      break;
     } else {
      $$24 = $33;$s$15 = $32;
     }
    }
   }
  }
 } while(0);
 $35 = ($$3|0)!=(0);
 $36 = $35 ? $s$2 : 0;
 return ($36|0);
}
function _strlen($s) {
 $s = $s|0;
 var $$0 = 0, $$01$lcssa = 0, $$014 = 0, $$1$lcssa = 0, $$lcssa20 = 0, $$pn = 0, $$pn15 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $w$0 = 0, $w$0$lcssa = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = $s;
 $1 = $0 & 3;
 $2 = ($1|0)==(0);
 L1: do {
  if ($2) {
   $$01$lcssa = $s;
   label = 4;
  } else {
   $$014 = $s;$21 = $0;
   while(1) {
    $3 = HEAP8[$$014>>0]|0;
    $4 = ($3<<24>>24)==(0);
    if ($4) {
     $$pn = $21;
     break L1;
    }
    $5 = ((($$014)) + 1|0);
    $6 = $5;
    $7 = $6 & 3;
    $8 = ($7|0)==(0);
    if ($8) {
     $$01$lcssa = $5;
     label = 4;
     break;
    } else {
     $$014 = $5;$21 = $6;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $w$0 = $$01$lcssa;
  while(1) {
   $9 = HEAP32[$w$0>>2]|0;
   $10 = (($9) + -16843009)|0;
   $11 = $9 & -2139062144;
   $12 = $11 ^ -2139062144;
   $13 = $12 & $10;
   $14 = ($13|0)==(0);
   $15 = ((($w$0)) + 4|0);
   if ($14) {
    $w$0 = $15;
   } else {
    $$lcssa20 = $9;$w$0$lcssa = $w$0;
    break;
   }
  }
  $16 = $$lcssa20&255;
  $17 = ($16<<24>>24)==(0);
  if ($17) {
   $$1$lcssa = $w$0$lcssa;
  } else {
   $$pn15 = $w$0$lcssa;
   while(1) {
    $18 = ((($$pn15)) + 1|0);
    $$pre = HEAP8[$18>>0]|0;
    $19 = ($$pre<<24>>24)==(0);
    if ($19) {
     $$1$lcssa = $18;
     break;
    } else {
     $$pn15 = $18;
    }
   }
  }
  $20 = $$1$lcssa;
  $$pn = $20;
 }
 $$0 = (($$pn) - ($0))|0;
 return ($$0|0);
}
function _vsnprintf($s,$n,$fmt,$ap) {
 $s = $s|0;
 $n = $n|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $$$02 = 0, $$0 = 0, $$01 = 0, $$02 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $b = 0, $f = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $b = sp + 112|0;
 $f = sp;
 dest=$f; src=364; stop=dest+112|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $0 = (($n) + -1)|0;
 $1 = ($0>>>0)>(2147483646);
 if ($1) {
  $2 = ($n|0)==(0);
  if ($2) {
   $$01 = $b;$$02 = 1;
   label = 4;
  } else {
   $3 = (___errno_location()|0);
   HEAP32[$3>>2] = 75;
   $$0 = -1;
  }
 } else {
  $$01 = $s;$$02 = $n;
  label = 4;
 }
 if ((label|0) == 4) {
  $4 = $$01;
  $5 = (-2 - ($4))|0;
  $6 = ($$02>>>0)>($5>>>0);
  $$$02 = $6 ? $5 : $$02;
  $7 = ((($f)) + 48|0);
  HEAP32[$7>>2] = $$$02;
  $8 = ((($f)) + 20|0);
  HEAP32[$8>>2] = $$01;
  $9 = ((($f)) + 44|0);
  HEAP32[$9>>2] = $$01;
  $10 = (($$01) + ($$$02)|0);
  $11 = ((($f)) + 16|0);
  HEAP32[$11>>2] = $10;
  $12 = ((($f)) + 28|0);
  HEAP32[$12>>2] = $10;
  $13 = (_vfprintf($f,$fmt,$ap)|0);
  $14 = ($$$02|0)==(0);
  if ($14) {
   $$0 = $13;
  } else {
   $15 = HEAP32[$8>>2]|0;
   $16 = HEAP32[$11>>2]|0;
   $17 = ($15|0)==($16|0);
   $18 = $17 << 31 >> 31;
   $19 = (($15) + ($18)|0);
   HEAP8[$19>>0] = 0;
   $$0 = $13;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _sn_write($f,$s,$l) {
 $f = $f|0;
 $s = $s|0;
 $l = $l|0;
 var $$cast = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $l$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 16|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($f)) + 20|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (($1) - ($3))|0;
 $5 = ($4>>>0)>($l>>>0);
 $l$ = $5 ? $l : $4;
 $$cast = $3;
 _memcpy(($$cast|0),($s|0),($l$|0))|0;
 $6 = HEAP32[$2>>2]|0;
 $7 = (($6) + ($l$)|0);
 HEAP32[$2>>2] = $7;
 return ($l|0);
}
function _vfprintf($f,$fmt,$ap) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $$ = 0, $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ap2 = 0, $internal_buf = 0, $nl_arg = 0, $nl_type = 0;
 var $ret$1 = 0, $ret$1$ = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $ap2 = sp + 120|0;
 $nl_type = sp + 80|0;
 $nl_arg = sp;
 $internal_buf = sp + 136|0;
 dest=$nl_type; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$ap>>2]|0;
 HEAP32[$ap2>>2] = $vacopy_currentptr;
 $0 = (_printf_core(0,$fmt,$ap2,$nl_arg,$nl_type)|0);
 $1 = ($0|0)<(0);
 if ($1) {
  $$0 = -1;
 } else {
  $2 = ((($f)) + 76|0);
  $3 = HEAP32[$2>>2]|0;
  $4 = ($3|0)>(-1);
  if ($4) {
   $5 = (___lockfile($f)|0);
   $32 = $5;
  } else {
   $32 = 0;
  }
  $6 = HEAP32[$f>>2]|0;
  $7 = $6 & 32;
  $8 = ((($f)) + 74|0);
  $9 = HEAP8[$8>>0]|0;
  $10 = ($9<<24>>24)<(1);
  if ($10) {
   $11 = $6 & -33;
   HEAP32[$f>>2] = $11;
  }
  $12 = ((($f)) + 48|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($13|0)==(0);
  if ($14) {
   $16 = ((($f)) + 44|0);
   $17 = HEAP32[$16>>2]|0;
   HEAP32[$16>>2] = $internal_buf;
   $18 = ((($f)) + 28|0);
   HEAP32[$18>>2] = $internal_buf;
   $19 = ((($f)) + 20|0);
   HEAP32[$19>>2] = $internal_buf;
   HEAP32[$12>>2] = 80;
   $20 = ((($internal_buf)) + 80|0);
   $21 = ((($f)) + 16|0);
   HEAP32[$21>>2] = $20;
   $22 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $23 = ($17|0)==(0|0);
   if ($23) {
    $ret$1 = $22;
   } else {
    $24 = ((($f)) + 36|0);
    $25 = HEAP32[$24>>2]|0;
    (FUNCTION_TABLE_iiii[$25 & 7]($f,0,0)|0);
    $26 = HEAP32[$19>>2]|0;
    $27 = ($26|0)==(0|0);
    $$ = $27 ? -1 : $22;
    HEAP32[$16>>2] = $17;
    HEAP32[$12>>2] = 0;
    HEAP32[$21>>2] = 0;
    HEAP32[$18>>2] = 0;
    HEAP32[$19>>2] = 0;
    $ret$1 = $$;
   }
  } else {
   $15 = (_printf_core($f,$fmt,$ap2,$nl_arg,$nl_type)|0);
   $ret$1 = $15;
  }
  $28 = HEAP32[$f>>2]|0;
  $29 = $28 & 32;
  $30 = ($29|0)==(0);
  $ret$1$ = $30 ? $ret$1 : -1;
  $31 = $28 | $7;
  HEAP32[$f>>2] = $31;
  $33 = ($32|0)==(0);
  if (!($33)) {
   ___unlockfile($f);
  }
  $$0 = $ret$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($f,$fmt,$ap,$nl_arg,$nl_type) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 $nl_arg = $nl_arg|0;
 $nl_type = $nl_type|0;
 var $$ = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$lcssa$i = 0, $$012$i = 0, $$013$i = 0, $$03$i33 = 0, $$07$i = 0.0, $$1$i = 0.0, $$114$i = 0, $$2$i = 0.0, $$20$i = 0.0, $$210$$24$i = 0, $$210$$26$i = 0, $$210$i = 0, $$23$i = 0, $$25$i = 0, $$3$i = 0.0, $$311$i = 0;
 var $$33$i = 0, $$36$i = 0.0, $$4$i = 0.0, $$412$lcssa$i = 0, $$41278$i = 0, $$43 = 0, $$5$lcssa$i = 0, $$589$i = 0, $$a$3$i = 0, $$a$3191$i = 0, $$a$3192$i = 0, $$fl$4 = 0, $$l10n$0 = 0, $$lcssa = 0, $$lcssa162$i = 0, $$lcssa295 = 0, $$lcssa300 = 0, $$lcssa301 = 0, $$lcssa302 = 0, $$lcssa303 = 0;
 var $$lcssa304 = 0, $$lcssa306 = 0, $$lcssa316 = 0, $$lcssa319 = 0.0, $$lcssa321 = 0, $$neg55$i = 0, $$neg56$i = 0, $$p$$i = 0, $$p$5 = 0, $$p$i = 0, $$pn$i = 0, $$pr$i = 0, $$pr50$i = 0, $$pre = 0, $$pre$i = 0, $$pre$phi190$iZ2D = 0, $$pre170 = 0, $$pre171 = 0, $$pre185$i = 0, $$pre188$i = 0;
 var $$pre189$i = 0, $$z$3$i = 0, $$z$4$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0.0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0.0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0.0, $391 = 0.0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0.0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0.0, $411 = 0.0, $412 = 0.0, $413 = 0.0, $414 = 0.0, $415 = 0.0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0.0, $442 = 0.0, $443 = 0.0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0.0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0.0, $483 = 0.0, $484 = 0.0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0.0, $594 = 0.0, $595 = 0, $596 = 0.0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $a$0 = 0, $a$1 = 0, $a$1$lcssa$i = 0, $a$1149$i = 0, $a$2 = 0, $a$2$ph$i = 0, $a$3$lcssa$i = 0, $a$3136$i = 0, $a$5$lcssa$i = 0, $a$5111$i = 0, $a$6$i = 0, $a$8$i = 0, $a$9$ph$i = 0, $arg = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0;
 var $argpos$0 = 0, $big$i = 0, $buf = 0, $buf$i = 0, $carry$0142$i = 0, $carry3$0130$i = 0, $cnt$0 = 0, $cnt$1 = 0, $cnt$1$lcssa = 0, $d$0$i = 0, $d$0141$i = 0, $d$0143$i = 0, $d$1129$i = 0, $d$2$lcssa$i = 0, $d$2110$i = 0, $d$4$i = 0, $d$584$i = 0, $d$677$i = 0, $d$788$i = 0, $e$0125$i = 0;
 var $e$1$i = 0, $e$2106$i = 0, $e$4$i = 0, $e$5$ph$i = 0, $e2$i = 0, $ebuf0$i = 0, $estr$0$i = 0, $estr$1$lcssa$i = 0, $estr$195$i = 0, $estr$2$i = 0, $exitcond$i = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0;
 var $expanded8 = 0, $fl$0100 = 0, $fl$053 = 0, $fl$1 = 0, $fl$1$ = 0, $fl$3 = 0, $fl$4 = 0, $fl$6 = 0, $i$0$lcssa = 0, $i$0$lcssa178 = 0, $i$0105 = 0, $i$0124$i = 0, $i$03$i = 0, $i$03$i25 = 0, $i$1$lcssa$i = 0, $i$1116 = 0, $i$1118$i = 0, $i$2105$i = 0, $i$291 = 0, $i$291$lcssa = 0;
 var $i$3101$i = 0, $i$389 = 0, $isdigit = 0, $isdigit$i = 0, $isdigit$i27 = 0, $isdigit10 = 0, $isdigit12 = 0, $isdigit2$i = 0, $isdigit2$i23 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp$i = 0, $isdigittmp$i26 = 0, $isdigittmp1$i = 0, $isdigittmp1$i22 = 0, $isdigittmp11 = 0, $isdigittmp4$i = 0, $isdigittmp4$i24 = 0, $isdigittmp9 = 0, $j$0$i = 0;
 var $j$0117$i = 0, $j$0119$i = 0, $j$1102$i = 0, $j$2$i = 0, $l$0 = 0, $l$0$i = 0, $l$1$i = 0, $l$1104 = 0, $l$2 = 0, $l10n$0 = 0, $l10n$0$lcssa = 0, $l10n$0$phi = 0, $l10n$1 = 0, $l10n$2 = 0, $l10n$3 = 0, $mb = 0, $notlhs$i = 0, $notrhs$i = 0, $or$cond = 0, $or$cond$i = 0;
 var $or$cond122 = 0, $or$cond15 = 0, $or$cond17 = 0, $or$cond18$i = 0, $or$cond20 = 0, $or$cond22$i = 0, $or$cond3$not$i = 0, $or$cond31$i = 0, $or$cond6$i = 0, $p$0 = 0, $p$0$ = 0, $p$1 = 0, $p$2 = 0, $p$2$ = 0, $p$3 = 0, $p$4176 = 0, $p$5 = 0, $pl$0 = 0, $pl$0$i = 0, $pl$1 = 0;
 var $pl$1$i = 0, $pl$2 = 0, $prefix$0 = 0, $prefix$0$$i = 0, $prefix$0$i = 0, $prefix$1 = 0, $prefix$2 = 0, $r$0$a$9$i = 0, $re$171$i = 0, $round$070$i = 0.0, $round6$1$i = 0.0, $s$0 = 0, $s$0$i = 0, $s$1 = 0, $s$1$i = 0, $s$1$i$lcssa = 0, $s$2$lcssa = 0, $s$292 = 0, $s$4 = 0, $s$6 = 0;
 var $s$7 = 0, $s$7$lcssa298 = 0, $s1$0$i = 0, $s7$081$i = 0, $s7$1$i = 0, $s8$0$lcssa$i = 0, $s8$072$i = 0, $s9$0$i = 0, $s9$185$i = 0, $s9$2$i = 0, $scevgep182$i = 0, $scevgep182183$i = 0, $small$0$i = 0.0, $small$1$i = 0.0, $st$0 = 0, $st$0$lcssa299 = 0, $storemerge = 0, $storemerge13 = 0, $storemerge851 = 0, $storemerge899 = 0;
 var $sum = 0, $t$0 = 0, $t$1 = 0, $w$$i = 0, $w$0 = 0, $w$1 = 0, $w$2 = 0, $w$32$i = 0, $wc = 0, $ws$0106 = 0, $ws$1117 = 0, $z$0$i = 0, $z$0$lcssa = 0, $z$093 = 0, $z$1 = 0, $z$1$lcssa$i = 0, $z$1148$i = 0, $z$2 = 0, $z$2$i = 0, $z$2$i$lcssa = 0;
 var $z$3$lcssa$i = 0, $z$3135$i = 0, $z$4$i = 0, $z$7$$i = 0, $z$7$i = 0, $z$7$i$lcssa = 0, $z$7$ph$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 624|0;
 $big$i = sp + 24|0;
 $e2$i = sp + 16|0;
 $buf$i = sp + 588|0;
 $ebuf0$i = sp + 576|0;
 $arg = sp;
 $buf = sp + 536|0;
 $wc = sp + 8|0;
 $mb = sp + 528|0;
 $0 = ($f|0)!=(0|0);
 $1 = ((($buf)) + 40|0);
 $2 = $1;
 $3 = ((($buf)) + 39|0);
 $4 = ((($wc)) + 4|0);
 $5 = $buf$i;
 $6 = (0 - ($5))|0;
 $7 = ((($ebuf0$i)) + 12|0);
 $8 = ((($ebuf0$i)) + 11|0);
 $9 = $7;
 $10 = (($9) - ($5))|0;
 $11 = (-2 - ($5))|0;
 $12 = (($9) + 2)|0;
 $13 = ((($big$i)) + 288|0);
 $14 = ((($buf$i)) + 9|0);
 $15 = $14;
 $16 = ((($buf$i)) + 8|0);
 $cnt$0 = 0;$l$0 = 0;$l10n$0 = 0;$s$0 = $fmt;
 L1: while(1) {
  $17 = ($cnt$0|0)>(-1);
  do {
   if ($17) {
    $18 = (2147483647 - ($cnt$0))|0;
    $19 = ($l$0|0)>($18|0);
    if ($19) {
     $20 = (___errno_location()|0);
     HEAP32[$20>>2] = 75;
     $cnt$1 = -1;
     break;
    } else {
     $21 = (($l$0) + ($cnt$0))|0;
     $cnt$1 = $21;
     break;
    }
   } else {
    $cnt$1 = $cnt$0;
   }
  } while(0);
  $22 = HEAP8[$s$0>>0]|0;
  $23 = ($22<<24>>24)==(0);
  if ($23) {
   $cnt$1$lcssa = $cnt$1;$l10n$0$lcssa = $l10n$0;
   label = 244;
   break;
  } else {
   $24 = $22;$s$1 = $s$0;
  }
  L9: while(1) {
   switch ($24<<24>>24) {
   case 37:  {
    $s$292 = $s$1;$z$093 = $s$1;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $s$2$lcssa = $s$1;$z$0$lcssa = $s$1;
    break L9;
    break;
   }
   default: {
   }
   }
   $25 = ((($s$1)) + 1|0);
   $$pre = HEAP8[$25>>0]|0;
   $24 = $$pre;$s$1 = $25;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $26 = ((($s$292)) + 1|0);
     $27 = HEAP8[$26>>0]|0;
     $28 = ($27<<24>>24)==(37);
     if (!($28)) {
      $s$2$lcssa = $s$292;$z$0$lcssa = $z$093;
      break L12;
     }
     $29 = ((($z$093)) + 1|0);
     $30 = ((($s$292)) + 2|0);
     $31 = HEAP8[$30>>0]|0;
     $32 = ($31<<24>>24)==(37);
     if ($32) {
      $s$292 = $30;$z$093 = $29;
      label = 9;
     } else {
      $s$2$lcssa = $30;$z$0$lcssa = $29;
      break;
     }
    }
   }
  } while(0);
  $33 = $z$0$lcssa;
  $34 = $s$0;
  $35 = (($33) - ($34))|0;
  if ($0) {
   $36 = HEAP32[$f>>2]|0;
   $37 = $36 & 32;
   $38 = ($37|0)==(0);
   if ($38) {
    (___fwritex($s$0,$35,$f)|0);
   }
  }
  $39 = ($z$0$lcssa|0)==($s$0|0);
  if (!($39)) {
   $l10n$0$phi = $l10n$0;$cnt$0 = $cnt$1;$l$0 = $35;$s$0 = $s$2$lcssa;$l10n$0 = $l10n$0$phi;
   continue;
  }
  $40 = ((($s$2$lcssa)) + 1|0);
  $41 = HEAP8[$40>>0]|0;
  $42 = $41 << 24 >> 24;
  $isdigittmp = (($42) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $43 = ((($s$2$lcssa)) + 2|0);
   $44 = HEAP8[$43>>0]|0;
   $45 = ($44<<24>>24)==(36);
   $46 = ((($s$2$lcssa)) + 3|0);
   $$43 = $45 ? $46 : $40;
   $$l10n$0 = $45 ? 1 : $l10n$0;
   $isdigittmp$ = $45 ? $isdigittmp : -1;
   $$pre170 = HEAP8[$$43>>0]|0;
   $48 = $$pre170;$argpos$0 = $isdigittmp$;$l10n$1 = $$l10n$0;$storemerge = $$43;
  } else {
   $48 = $41;$argpos$0 = -1;$l10n$1 = $l10n$0;$storemerge = $40;
  }
  $47 = $48 << 24 >> 24;
  $49 = $47 & -32;
  $50 = ($49|0)==(32);
  L25: do {
   if ($50) {
    $52 = $47;$57 = $48;$fl$0100 = 0;$storemerge899 = $storemerge;
    while(1) {
     $51 = (($52) + -32)|0;
     $53 = 1 << $51;
     $54 = $53 & 75913;
     $55 = ($54|0)==(0);
     if ($55) {
      $66 = $57;$fl$053 = $fl$0100;$storemerge851 = $storemerge899;
      break L25;
     }
     $56 = $57 << 24 >> 24;
     $58 = (($56) + -32)|0;
     $59 = 1 << $58;
     $60 = $59 | $fl$0100;
     $61 = ((($storemerge899)) + 1|0);
     $62 = HEAP8[$61>>0]|0;
     $63 = $62 << 24 >> 24;
     $64 = $63 & -32;
     $65 = ($64|0)==(32);
     if ($65) {
      $52 = $63;$57 = $62;$fl$0100 = $60;$storemerge899 = $61;
     } else {
      $66 = $62;$fl$053 = $60;$storemerge851 = $61;
      break;
     }
    }
   } else {
    $66 = $48;$fl$053 = 0;$storemerge851 = $storemerge;
   }
  } while(0);
  $67 = ($66<<24>>24)==(42);
  do {
   if ($67) {
    $68 = ((($storemerge851)) + 1|0);
    $69 = HEAP8[$68>>0]|0;
    $70 = $69 << 24 >> 24;
    $isdigittmp11 = (($70) + -48)|0;
    $isdigit12 = ($isdigittmp11>>>0)<(10);
    if ($isdigit12) {
     $71 = ((($storemerge851)) + 2|0);
     $72 = HEAP8[$71>>0]|0;
     $73 = ($72<<24>>24)==(36);
     if ($73) {
      $74 = (($nl_type) + ($isdigittmp11<<2)|0);
      HEAP32[$74>>2] = 10;
      $75 = HEAP8[$68>>0]|0;
      $76 = $75 << 24 >> 24;
      $77 = (($76) + -48)|0;
      $78 = (($nl_arg) + ($77<<3)|0);
      $79 = $78;
      $80 = $79;
      $81 = HEAP32[$80>>2]|0;
      $82 = (($79) + 4)|0;
      $83 = $82;
      $84 = HEAP32[$83>>2]|0;
      $85 = ((($storemerge851)) + 3|0);
      $l10n$2 = 1;$storemerge13 = $85;$w$0 = $81;
     } else {
      label = 24;
     }
    } else {
     label = 24;
    }
    if ((label|0) == 24) {
     label = 0;
     $86 = ($l10n$1|0)==(0);
     if (!($86)) {
      $$0 = -1;
      break L1;
     }
     if (!($0)) {
      $fl$1 = $fl$053;$l10n$3 = 0;$s$4 = $68;$w$1 = 0;
      break;
     }
     $arglist_current = HEAP32[$ap>>2]|0;
     $87 = $arglist_current;
     $88 = ((0) + 4|0);
     $expanded4 = $88;
     $expanded = (($expanded4) - 1)|0;
     $89 = (($87) + ($expanded))|0;
     $90 = ((0) + 4|0);
     $expanded8 = $90;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $91 = $89 & $expanded6;
     $92 = $91;
     $93 = HEAP32[$92>>2]|0;
     $arglist_next = ((($92)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     $l10n$2 = 0;$storemerge13 = $68;$w$0 = $93;
    }
    $94 = ($w$0|0)<(0);
    if ($94) {
     $95 = $fl$053 | 8192;
     $96 = (0 - ($w$0))|0;
     $fl$1 = $95;$l10n$3 = $l10n$2;$s$4 = $storemerge13;$w$1 = $96;
    } else {
     $fl$1 = $fl$053;$l10n$3 = $l10n$2;$s$4 = $storemerge13;$w$1 = $w$0;
    }
   } else {
    $97 = $66 << 24 >> 24;
    $isdigittmp1$i = (($97) + -48)|0;
    $isdigit2$i = ($isdigittmp1$i>>>0)<(10);
    if ($isdigit2$i) {
     $101 = $storemerge851;$i$03$i = 0;$isdigittmp4$i = $isdigittmp1$i;
     while(1) {
      $98 = ($i$03$i*10)|0;
      $99 = (($98) + ($isdigittmp4$i))|0;
      $100 = ((($101)) + 1|0);
      $102 = HEAP8[$100>>0]|0;
      $103 = $102 << 24 >> 24;
      $isdigittmp$i = (($103) + -48)|0;
      $isdigit$i = ($isdigittmp$i>>>0)<(10);
      if ($isdigit$i) {
       $101 = $100;$i$03$i = $99;$isdigittmp4$i = $isdigittmp$i;
      } else {
       $$lcssa = $99;$$lcssa295 = $100;
       break;
      }
     }
     $104 = ($$lcssa|0)<(0);
     if ($104) {
      $$0 = -1;
      break L1;
     } else {
      $fl$1 = $fl$053;$l10n$3 = $l10n$1;$s$4 = $$lcssa295;$w$1 = $$lcssa;
     }
    } else {
     $fl$1 = $fl$053;$l10n$3 = $l10n$1;$s$4 = $storemerge851;$w$1 = 0;
    }
   }
  } while(0);
  $105 = HEAP8[$s$4>>0]|0;
  $106 = ($105<<24>>24)==(46);
  L46: do {
   if ($106) {
    $107 = ((($s$4)) + 1|0);
    $108 = HEAP8[$107>>0]|0;
    $109 = ($108<<24>>24)==(42);
    if (!($109)) {
     $136 = $108 << 24 >> 24;
     $isdigittmp1$i22 = (($136) + -48)|0;
     $isdigit2$i23 = ($isdigittmp1$i22>>>0)<(10);
     if ($isdigit2$i23) {
      $140 = $107;$i$03$i25 = 0;$isdigittmp4$i24 = $isdigittmp1$i22;
     } else {
      $p$0 = 0;$s$6 = $107;
      break;
     }
     while(1) {
      $137 = ($i$03$i25*10)|0;
      $138 = (($137) + ($isdigittmp4$i24))|0;
      $139 = ((($140)) + 1|0);
      $141 = HEAP8[$139>>0]|0;
      $142 = $141 << 24 >> 24;
      $isdigittmp$i26 = (($142) + -48)|0;
      $isdigit$i27 = ($isdigittmp$i26>>>0)<(10);
      if ($isdigit$i27) {
       $140 = $139;$i$03$i25 = $138;$isdigittmp4$i24 = $isdigittmp$i26;
      } else {
       $p$0 = $138;$s$6 = $139;
       break L46;
      }
     }
    }
    $110 = ((($s$4)) + 2|0);
    $111 = HEAP8[$110>>0]|0;
    $112 = $111 << 24 >> 24;
    $isdigittmp9 = (($112) + -48)|0;
    $isdigit10 = ($isdigittmp9>>>0)<(10);
    if ($isdigit10) {
     $113 = ((($s$4)) + 3|0);
     $114 = HEAP8[$113>>0]|0;
     $115 = ($114<<24>>24)==(36);
     if ($115) {
      $116 = (($nl_type) + ($isdigittmp9<<2)|0);
      HEAP32[$116>>2] = 10;
      $117 = HEAP8[$110>>0]|0;
      $118 = $117 << 24 >> 24;
      $119 = (($118) + -48)|0;
      $120 = (($nl_arg) + ($119<<3)|0);
      $121 = $120;
      $122 = $121;
      $123 = HEAP32[$122>>2]|0;
      $124 = (($121) + 4)|0;
      $125 = $124;
      $126 = HEAP32[$125>>2]|0;
      $127 = ((($s$4)) + 4|0);
      $p$0 = $123;$s$6 = $127;
      break;
     }
    }
    $128 = ($l10n$3|0)==(0);
    if (!($128)) {
     $$0 = -1;
     break L1;
    }
    if ($0) {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $129 = $arglist_current2;
     $130 = ((0) + 4|0);
     $expanded11 = $130;
     $expanded10 = (($expanded11) - 1)|0;
     $131 = (($129) + ($expanded10))|0;
     $132 = ((0) + 4|0);
     $expanded15 = $132;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $133 = $131 & $expanded13;
     $134 = $133;
     $135 = HEAP32[$134>>2]|0;
     $arglist_next3 = ((($134)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $p$0 = $135;$s$6 = $110;
    } else {
     $p$0 = 0;$s$6 = $110;
    }
   } else {
    $p$0 = -1;$s$6 = $s$4;
   }
  } while(0);
  $s$7 = $s$6;$st$0 = 0;
  while(1) {
   $143 = HEAP8[$s$7>>0]|0;
   $144 = $143 << 24 >> 24;
   $145 = (($144) + -65)|0;
   $146 = ($145>>>0)>(57);
   if ($146) {
    $$0 = -1;
    break L1;
   }
   $147 = ((($s$7)) + 1|0);
   $148 = ((832 + (($st$0*58)|0)|0) + ($145)|0);
   $149 = HEAP8[$148>>0]|0;
   $150 = $149&255;
   $151 = (($150) + -1)|0;
   $152 = ($151>>>0)<(8);
   if ($152) {
    $s$7 = $147;$st$0 = $150;
   } else {
    $$lcssa300 = $147;$$lcssa301 = $149;$$lcssa302 = $150;$s$7$lcssa298 = $s$7;$st$0$lcssa299 = $st$0;
    break;
   }
  }
  $153 = ($$lcssa301<<24>>24)==(0);
  if ($153) {
   $$0 = -1;
   break;
  }
  $154 = ($$lcssa301<<24>>24)==(19);
  $155 = ($argpos$0|0)>(-1);
  do {
   if ($154) {
    if ($155) {
     $$0 = -1;
     break L1;
    } else {
     label = 52;
    }
   } else {
    if ($155) {
     $156 = (($nl_type) + ($argpos$0<<2)|0);
     HEAP32[$156>>2] = $$lcssa302;
     $157 = (($nl_arg) + ($argpos$0<<3)|0);
     $158 = $157;
     $159 = $158;
     $160 = HEAP32[$159>>2]|0;
     $161 = (($158) + 4)|0;
     $162 = $161;
     $163 = HEAP32[$162>>2]|0;
     $164 = $arg;
     $165 = $164;
     HEAP32[$165>>2] = $160;
     $166 = (($164) + 4)|0;
     $167 = $166;
     HEAP32[$167>>2] = $163;
     label = 52;
     break;
    }
    if (!($0)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg($arg,$$lcssa302,$ap);
   }
  } while(0);
  if ((label|0) == 52) {
   label = 0;
   if (!($0)) {
    $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
    continue;
   }
  }
  $168 = HEAP8[$s$7$lcssa298>>0]|0;
  $169 = $168 << 24 >> 24;
  $170 = ($st$0$lcssa299|0)!=(0);
  $171 = $169 & 15;
  $172 = ($171|0)==(3);
  $or$cond15 = $170 & $172;
  $173 = $169 & -33;
  $t$0 = $or$cond15 ? $173 : $169;
  $174 = $fl$1 & 8192;
  $175 = ($174|0)==(0);
  $176 = $fl$1 & -65537;
  $fl$1$ = $175 ? $fl$1 : $176;
  L75: do {
   switch ($t$0|0) {
   case 110:  {
    switch ($st$0$lcssa299|0) {
    case 0:  {
     $183 = HEAP32[$arg>>2]|0;
     HEAP32[$183>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 1:  {
     $184 = HEAP32[$arg>>2]|0;
     HEAP32[$184>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 2:  {
     $185 = ($cnt$1|0)<(0);
     $186 = $185 << 31 >> 31;
     $187 = HEAP32[$arg>>2]|0;
     $188 = $187;
     $189 = $188;
     HEAP32[$189>>2] = $cnt$1;
     $190 = (($188) + 4)|0;
     $191 = $190;
     HEAP32[$191>>2] = $186;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 3:  {
     $192 = $cnt$1&65535;
     $193 = HEAP32[$arg>>2]|0;
     HEAP16[$193>>1] = $192;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 4:  {
     $194 = $cnt$1&255;
     $195 = HEAP32[$arg>>2]|0;
     HEAP8[$195>>0] = $194;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 6:  {
     $196 = HEAP32[$arg>>2]|0;
     HEAP32[$196>>2] = $cnt$1;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    case 7:  {
     $197 = ($cnt$1|0)<(0);
     $198 = $197 << 31 >> 31;
     $199 = HEAP32[$arg>>2]|0;
     $200 = $199;
     $201 = $200;
     HEAP32[$201>>2] = $cnt$1;
     $202 = (($200) + 4)|0;
     $203 = $202;
     HEAP32[$203>>2] = $198;
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
     break;
    }
    default: {
     $cnt$0 = $cnt$1;$l$0 = $35;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $204 = ($p$0>>>0)>(8);
    $205 = $204 ? $p$0 : 8;
    $206 = $fl$1$ | 8;
    $fl$3 = $206;$p$1 = $205;$t$1 = 120;
    label = 64;
    break;
   }
   case 88: case 120:  {
    $fl$3 = $fl$1$;$p$1 = $p$0;$t$1 = $t$0;
    label = 64;
    break;
   }
   case 111:  {
    $244 = $arg;
    $245 = $244;
    $246 = HEAP32[$245>>2]|0;
    $247 = (($244) + 4)|0;
    $248 = $247;
    $249 = HEAP32[$248>>2]|0;
    $250 = ($246|0)==(0);
    $251 = ($249|0)==(0);
    $252 = $250 & $251;
    if ($252) {
     $$0$lcssa$i = $1;
    } else {
     $$03$i33 = $1;$254 = $246;$258 = $249;
     while(1) {
      $253 = $254 & 7;
      $255 = $253 | 48;
      $256 = $255&255;
      $257 = ((($$03$i33)) + -1|0);
      HEAP8[$257>>0] = $256;
      $259 = (_bitshift64Lshr(($254|0),($258|0),3)|0);
      $260 = tempRet0;
      $261 = ($259|0)==(0);
      $262 = ($260|0)==(0);
      $263 = $261 & $262;
      if ($263) {
       $$0$lcssa$i = $257;
       break;
      } else {
       $$03$i33 = $257;$254 = $259;$258 = $260;
      }
     }
    }
    $264 = $fl$1$ & 8;
    $265 = ($264|0)==(0);
    if ($265) {
     $a$0 = $$0$lcssa$i;$fl$4 = $fl$1$;$p$2 = $p$0;$pl$1 = 0;$prefix$1 = 1312;
     label = 77;
    } else {
     $266 = $$0$lcssa$i;
     $267 = (($2) - ($266))|0;
     $268 = ($p$0|0)>($267|0);
     $269 = (($267) + 1)|0;
     $p$0$ = $268 ? $p$0 : $269;
     $a$0 = $$0$lcssa$i;$fl$4 = $fl$1$;$p$2 = $p$0$;$pl$1 = 0;$prefix$1 = 1312;
     label = 77;
    }
    break;
   }
   case 105: case 100:  {
    $270 = $arg;
    $271 = $270;
    $272 = HEAP32[$271>>2]|0;
    $273 = (($270) + 4)|0;
    $274 = $273;
    $275 = HEAP32[$274>>2]|0;
    $276 = ($275|0)<(0);
    if ($276) {
     $277 = (_i64Subtract(0,0,($272|0),($275|0))|0);
     $278 = tempRet0;
     $279 = $arg;
     $280 = $279;
     HEAP32[$280>>2] = $277;
     $281 = (($279) + 4)|0;
     $282 = $281;
     HEAP32[$282>>2] = $278;
     $287 = $277;$288 = $278;$pl$0 = 1;$prefix$0 = 1312;
     label = 76;
     break L75;
    }
    $283 = $fl$1$ & 2048;
    $284 = ($283|0)==(0);
    if ($284) {
     $285 = $fl$1$ & 1;
     $286 = ($285|0)==(0);
     $$ = $286 ? 1312 : (1314);
     $287 = $272;$288 = $275;$pl$0 = $285;$prefix$0 = $$;
     label = 76;
    } else {
     $287 = $272;$288 = $275;$pl$0 = 1;$prefix$0 = (1313);
     label = 76;
    }
    break;
   }
   case 117:  {
    $177 = $arg;
    $178 = $177;
    $179 = HEAP32[$178>>2]|0;
    $180 = (($177) + 4)|0;
    $181 = $180;
    $182 = HEAP32[$181>>2]|0;
    $287 = $179;$288 = $182;$pl$0 = 0;$prefix$0 = 1312;
    label = 76;
    break;
   }
   case 99:  {
    $308 = $arg;
    $309 = $308;
    $310 = HEAP32[$309>>2]|0;
    $311 = (($308) + 4)|0;
    $312 = $311;
    $313 = HEAP32[$312>>2]|0;
    $314 = $310&255;
    HEAP8[$3>>0] = $314;
    $a$2 = $3;$fl$6 = $176;$p$5 = 1;$pl$2 = 0;$prefix$2 = 1312;$z$2 = $1;
    break;
   }
   case 109:  {
    $315 = (___errno_location()|0);
    $316 = HEAP32[$315>>2]|0;
    $317 = (_strerror($316)|0);
    $a$1 = $317;
    label = 82;
    break;
   }
   case 115:  {
    $318 = HEAP32[$arg>>2]|0;
    $319 = ($318|0)!=(0|0);
    $320 = $319 ? $318 : 3214;
    $a$1 = $320;
    label = 82;
    break;
   }
   case 67:  {
    $327 = $arg;
    $328 = $327;
    $329 = HEAP32[$328>>2]|0;
    $330 = (($327) + 4)|0;
    $331 = $330;
    $332 = HEAP32[$331>>2]|0;
    HEAP32[$wc>>2] = $329;
    HEAP32[$4>>2] = 0;
    HEAP32[$arg>>2] = $wc;
    $798 = $wc;$p$4176 = -1;
    label = 86;
    break;
   }
   case 83:  {
    $$pre171 = HEAP32[$arg>>2]|0;
    $333 = ($p$0|0)==(0);
    if ($333) {
     _pad($f,32,$w$1,0,$fl$1$);
     $i$0$lcssa178 = 0;
     label = 97;
    } else {
     $798 = $$pre171;$p$4176 = $p$0;
     label = 86;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $358 = +HEAPF64[$arg>>3];
    HEAP32[$e2$i>>2] = 0;
    HEAPF64[tempDoublePtr>>3] = $358;$359 = HEAP32[tempDoublePtr>>2]|0;
    $360 = HEAP32[tempDoublePtr+4>>2]|0;
    $361 = ($360|0)<(0);
    if ($361) {
     $362 = -$358;
     $$07$i = $362;$pl$0$i = 1;$prefix$0$i = 3221;
    } else {
     $363 = $fl$1$ & 2048;
     $364 = ($363|0)==(0);
     if ($364) {
      $365 = $fl$1$ & 1;
      $366 = ($365|0)==(0);
      $$$i = $366 ? (3222) : (3227);
      $$07$i = $358;$pl$0$i = $365;$prefix$0$i = $$$i;
     } else {
      $$07$i = $358;$pl$0$i = 1;$prefix$0$i = (3224);
     }
    }
    HEAPF64[tempDoublePtr>>3] = $$07$i;$367 = HEAP32[tempDoublePtr>>2]|0;
    $368 = HEAP32[tempDoublePtr+4>>2]|0;
    $369 = $368 & 2146435072;
    $370 = ($369>>>0)<(2146435072);
    $371 = (0)<(0);
    $372 = ($369|0)==(2146435072);
    $373 = $372 & $371;
    $374 = $370 | $373;
    do {
     if ($374) {
      $390 = (+_frexpl($$07$i,$e2$i));
      $391 = $390 * 2.0;
      $392 = $391 != 0.0;
      if ($392) {
       $393 = HEAP32[$e2$i>>2]|0;
       $394 = (($393) + -1)|0;
       HEAP32[$e2$i>>2] = $394;
      }
      $395 = $t$0 | 32;
      $396 = ($395|0)==(97);
      if ($396) {
       $397 = $t$0 & 32;
       $398 = ($397|0)==(0);
       $399 = ((($prefix$0$i)) + 9|0);
       $prefix$0$$i = $398 ? $prefix$0$i : $399;
       $400 = $pl$0$i | 2;
       $401 = ($p$0>>>0)>(11);
       $402 = (12 - ($p$0))|0;
       $403 = ($402|0)==(0);
       $404 = $401 | $403;
       do {
        if ($404) {
         $$1$i = $391;
        } else {
         $re$171$i = $402;$round$070$i = 8.0;
         while(1) {
          $405 = (($re$171$i) + -1)|0;
          $406 = $round$070$i * 16.0;
          $407 = ($405|0)==(0);
          if ($407) {
           $$lcssa319 = $406;
           break;
          } else {
           $re$171$i = $405;$round$070$i = $406;
          }
         }
         $408 = HEAP8[$prefix$0$$i>>0]|0;
         $409 = ($408<<24>>24)==(45);
         if ($409) {
          $410 = -$391;
          $411 = $410 - $$lcssa319;
          $412 = $$lcssa319 + $411;
          $413 = -$412;
          $$1$i = $413;
          break;
         } else {
          $414 = $391 + $$lcssa319;
          $415 = $414 - $$lcssa319;
          $$1$i = $415;
          break;
         }
        }
       } while(0);
       $416 = HEAP32[$e2$i>>2]|0;
       $417 = ($416|0)<(0);
       $418 = (0 - ($416))|0;
       $419 = $417 ? $418 : $416;
       $420 = ($419|0)<(0);
       $421 = $420 << 31 >> 31;
       $422 = (_fmt_u($419,$421,$7)|0);
       $423 = ($422|0)==($7|0);
       if ($423) {
        HEAP8[$8>>0] = 48;
        $estr$0$i = $8;
       } else {
        $estr$0$i = $422;
       }
       $424 = $416 >> 31;
       $425 = $424 & 2;
       $426 = (($425) + 43)|0;
       $427 = $426&255;
       $428 = ((($estr$0$i)) + -1|0);
       HEAP8[$428>>0] = $427;
       $429 = (($t$0) + 15)|0;
       $430 = $429&255;
       $431 = ((($estr$0$i)) + -2|0);
       HEAP8[$431>>0] = $430;
       $notrhs$i = ($p$0|0)<(1);
       $432 = $fl$1$ & 8;
       $433 = ($432|0)==(0);
       $$2$i = $$1$i;$s$0$i = $buf$i;
       while(1) {
        $434 = (~~(($$2$i)));
        $435 = (1296 + ($434)|0);
        $436 = HEAP8[$435>>0]|0;
        $437 = $436&255;
        $438 = $437 | $397;
        $439 = $438&255;
        $440 = ((($s$0$i)) + 1|0);
        HEAP8[$s$0$i>>0] = $439;
        $441 = (+($434|0));
        $442 = $$2$i - $441;
        $443 = $442 * 16.0;
        $444 = $440;
        $445 = (($444) - ($5))|0;
        $446 = ($445|0)==(1);
        do {
         if ($446) {
          $notlhs$i = $443 == 0.0;
          $or$cond3$not$i = $notrhs$i & $notlhs$i;
          $or$cond$i = $433 & $or$cond3$not$i;
          if ($or$cond$i) {
           $s$1$i = $440;
           break;
          }
          $447 = ((($s$0$i)) + 2|0);
          HEAP8[$440>>0] = 46;
          $s$1$i = $447;
         } else {
          $s$1$i = $440;
         }
        } while(0);
        $448 = $443 != 0.0;
        if ($448) {
         $$2$i = $443;$s$0$i = $s$1$i;
        } else {
         $s$1$i$lcssa = $s$1$i;
         break;
        }
       }
       $449 = ($p$0|0)!=(0);
       $$pre188$i = $s$1$i$lcssa;
       $450 = (($11) + ($$pre188$i))|0;
       $451 = ($450|0)<($p$0|0);
       $or$cond122 = $449 & $451;
       $452 = $431;
       $453 = (($12) + ($p$0))|0;
       $454 = (($453) - ($452))|0;
       $455 = (($10) - ($452))|0;
       $456 = (($455) + ($$pre188$i))|0;
       $l$0$i = $or$cond122 ? $454 : $456;
       $457 = (($l$0$i) + ($400))|0;
       _pad($f,32,$w$1,$457,$fl$1$);
       $458 = HEAP32[$f>>2]|0;
       $459 = $458 & 32;
       $460 = ($459|0)==(0);
       if ($460) {
        (___fwritex($prefix$0$$i,$400,$f)|0);
       }
       $461 = $fl$1$ ^ 65536;
       _pad($f,48,$w$1,$457,$461);
       $462 = (($$pre188$i) - ($5))|0;
       $463 = HEAP32[$f>>2]|0;
       $464 = $463 & 32;
       $465 = ($464|0)==(0);
       if ($465) {
        (___fwritex($buf$i,$462,$f)|0);
       }
       $466 = (($9) - ($452))|0;
       $sum = (($462) + ($466))|0;
       $467 = (($l$0$i) - ($sum))|0;
       _pad($f,48,$467,0,0);
       $468 = HEAP32[$f>>2]|0;
       $469 = $468 & 32;
       $470 = ($469|0)==(0);
       if ($470) {
        (___fwritex($431,$466,$f)|0);
       }
       $471 = $fl$1$ ^ 8192;
       _pad($f,32,$w$1,$457,$471);
       $472 = ($457|0)<($w$1|0);
       $w$$i = $472 ? $w$1 : $457;
       $$0$i = $w$$i;
       break;
      }
      $473 = ($p$0|0)<(0);
      $$p$i = $473 ? 6 : $p$0;
      if ($392) {
       $474 = $391 * 268435456.0;
       $475 = HEAP32[$e2$i>>2]|0;
       $476 = (($475) + -28)|0;
       HEAP32[$e2$i>>2] = $476;
       $$3$i = $474;$477 = $476;
      } else {
       $$pre185$i = HEAP32[$e2$i>>2]|0;
       $$3$i = $391;$477 = $$pre185$i;
      }
      $478 = ($477|0)<(0);
      $$33$i = $478 ? $big$i : $13;
      $479 = $$33$i;
      $$4$i = $$3$i;$z$0$i = $$33$i;
      while(1) {
       $480 = (~~(($$4$i))>>>0);
       HEAP32[$z$0$i>>2] = $480;
       $481 = ((($z$0$i)) + 4|0);
       $482 = (+($480>>>0));
       $483 = $$4$i - $482;
       $484 = $483 * 1.0E+9;
       $485 = $484 != 0.0;
       if ($485) {
        $$4$i = $484;$z$0$i = $481;
       } else {
        $$lcssa303 = $481;
        break;
       }
      }
      $$pr$i = HEAP32[$e2$i>>2]|0;
      $486 = ($$pr$i|0)>(0);
      if ($486) {
       $487 = $$pr$i;$a$1149$i = $$33$i;$z$1148$i = $$lcssa303;
       while(1) {
        $488 = ($487|0)>(29);
        $489 = $488 ? 29 : $487;
        $d$0141$i = ((($z$1148$i)) + -4|0);
        $490 = ($d$0141$i>>>0)<($a$1149$i>>>0);
        do {
         if ($490) {
          $a$2$ph$i = $a$1149$i;
         } else {
          $carry$0142$i = 0;$d$0143$i = $d$0141$i;
          while(1) {
           $491 = HEAP32[$d$0143$i>>2]|0;
           $492 = (_bitshift64Shl(($491|0),0,($489|0))|0);
           $493 = tempRet0;
           $494 = (_i64Add(($492|0),($493|0),($carry$0142$i|0),0)|0);
           $495 = tempRet0;
           $496 = (___uremdi3(($494|0),($495|0),1000000000,0)|0);
           $497 = tempRet0;
           HEAP32[$d$0143$i>>2] = $496;
           $498 = (___udivdi3(($494|0),($495|0),1000000000,0)|0);
           $499 = tempRet0;
           $d$0$i = ((($d$0143$i)) + -4|0);
           $500 = ($d$0$i>>>0)<($a$1149$i>>>0);
           if ($500) {
            $$lcssa304 = $498;
            break;
           } else {
            $carry$0142$i = $498;$d$0143$i = $d$0$i;
           }
          }
          $501 = ($$lcssa304|0)==(0);
          if ($501) {
           $a$2$ph$i = $a$1149$i;
           break;
          }
          $502 = ((($a$1149$i)) + -4|0);
          HEAP32[$502>>2] = $$lcssa304;
          $a$2$ph$i = $502;
         }
        } while(0);
        $z$2$i = $z$1148$i;
        while(1) {
         $503 = ($z$2$i>>>0)>($a$2$ph$i>>>0);
         if (!($503)) {
          $z$2$i$lcssa = $z$2$i;
          break;
         }
         $504 = ((($z$2$i)) + -4|0);
         $505 = HEAP32[$504>>2]|0;
         $506 = ($505|0)==(0);
         if ($506) {
          $z$2$i = $504;
         } else {
          $z$2$i$lcssa = $z$2$i;
          break;
         }
        }
        $507 = HEAP32[$e2$i>>2]|0;
        $508 = (($507) - ($489))|0;
        HEAP32[$e2$i>>2] = $508;
        $509 = ($508|0)>(0);
        if ($509) {
         $487 = $508;$a$1149$i = $a$2$ph$i;$z$1148$i = $z$2$i$lcssa;
        } else {
         $$pr50$i = $508;$a$1$lcssa$i = $a$2$ph$i;$z$1$lcssa$i = $z$2$i$lcssa;
         break;
        }
       }
      } else {
       $$pr50$i = $$pr$i;$a$1$lcssa$i = $$33$i;$z$1$lcssa$i = $$lcssa303;
      }
      $510 = ($$pr50$i|0)<(0);
      if ($510) {
       $511 = (($$p$i) + 25)|0;
       $512 = (($511|0) / 9)&-1;
       $513 = (($512) + 1)|0;
       $514 = ($395|0)==(102);
       $516 = $$pr50$i;$a$3136$i = $a$1$lcssa$i;$z$3135$i = $z$1$lcssa$i;
       while(1) {
        $515 = (0 - ($516))|0;
        $517 = ($515|0)>(9);
        $518 = $517 ? 9 : $515;
        $519 = ($a$3136$i>>>0)<($z$3135$i>>>0);
        do {
         if ($519) {
          $523 = 1 << $518;
          $524 = (($523) + -1)|0;
          $525 = 1000000000 >>> $518;
          $carry3$0130$i = 0;$d$1129$i = $a$3136$i;
          while(1) {
           $526 = HEAP32[$d$1129$i>>2]|0;
           $527 = $526 & $524;
           $528 = $526 >>> $518;
           $529 = (($528) + ($carry3$0130$i))|0;
           HEAP32[$d$1129$i>>2] = $529;
           $530 = Math_imul($527, $525)|0;
           $531 = ((($d$1129$i)) + 4|0);
           $532 = ($531>>>0)<($z$3135$i>>>0);
           if ($532) {
            $carry3$0130$i = $530;$d$1129$i = $531;
           } else {
            $$lcssa306 = $530;
            break;
           }
          }
          $533 = HEAP32[$a$3136$i>>2]|0;
          $534 = ($533|0)==(0);
          $535 = ((($a$3136$i)) + 4|0);
          $$a$3$i = $534 ? $535 : $a$3136$i;
          $536 = ($$lcssa306|0)==(0);
          if ($536) {
           $$a$3192$i = $$a$3$i;$z$4$i = $z$3135$i;
           break;
          }
          $537 = ((($z$3135$i)) + 4|0);
          HEAP32[$z$3135$i>>2] = $$lcssa306;
          $$a$3192$i = $$a$3$i;$z$4$i = $537;
         } else {
          $520 = HEAP32[$a$3136$i>>2]|0;
          $521 = ($520|0)==(0);
          $522 = ((($a$3136$i)) + 4|0);
          $$a$3191$i = $521 ? $522 : $a$3136$i;
          $$a$3192$i = $$a$3191$i;$z$4$i = $z$3135$i;
         }
        } while(0);
        $538 = $514 ? $$33$i : $$a$3192$i;
        $539 = $z$4$i;
        $540 = $538;
        $541 = (($539) - ($540))|0;
        $542 = $541 >> 2;
        $543 = ($542|0)>($513|0);
        $544 = (($538) + ($513<<2)|0);
        $$z$4$i = $543 ? $544 : $z$4$i;
        $545 = HEAP32[$e2$i>>2]|0;
        $546 = (($545) + ($518))|0;
        HEAP32[$e2$i>>2] = $546;
        $547 = ($546|0)<(0);
        if ($547) {
         $516 = $546;$a$3136$i = $$a$3192$i;$z$3135$i = $$z$4$i;
        } else {
         $a$3$lcssa$i = $$a$3192$i;$z$3$lcssa$i = $$z$4$i;
         break;
        }
       }
      } else {
       $a$3$lcssa$i = $a$1$lcssa$i;$z$3$lcssa$i = $z$1$lcssa$i;
      }
      $548 = ($a$3$lcssa$i>>>0)<($z$3$lcssa$i>>>0);
      do {
       if ($548) {
        $549 = $a$3$lcssa$i;
        $550 = (($479) - ($549))|0;
        $551 = $550 >> 2;
        $552 = ($551*9)|0;
        $553 = HEAP32[$a$3$lcssa$i>>2]|0;
        $554 = ($553>>>0)<(10);
        if ($554) {
         $e$1$i = $552;
         break;
        } else {
         $e$0125$i = $552;$i$0124$i = 10;
        }
        while(1) {
         $555 = ($i$0124$i*10)|0;
         $556 = (($e$0125$i) + 1)|0;
         $557 = ($553>>>0)<($555>>>0);
         if ($557) {
          $e$1$i = $556;
          break;
         } else {
          $e$0125$i = $556;$i$0124$i = $555;
         }
        }
       } else {
        $e$1$i = 0;
       }
      } while(0);
      $558 = ($395|0)!=(102);
      $559 = $558 ? $e$1$i : 0;
      $560 = (($$p$i) - ($559))|0;
      $561 = ($395|0)==(103);
      $562 = ($$p$i|0)!=(0);
      $563 = $562 & $561;
      $$neg55$i = $563 << 31 >> 31;
      $564 = (($560) + ($$neg55$i))|0;
      $565 = $z$3$lcssa$i;
      $566 = (($565) - ($479))|0;
      $567 = $566 >> 2;
      $568 = ($567*9)|0;
      $569 = (($568) + -9)|0;
      $570 = ($564|0)<($569|0);
      if ($570) {
       $571 = ((($$33$i)) + 4|0);
       $572 = (($564) + 9216)|0;
       $573 = (($572|0) / 9)&-1;
       $574 = (($573) + -1024)|0;
       $575 = (($571) + ($574<<2)|0);
       $576 = (($572|0) % 9)&-1;
       $j$0117$i = (($576) + 1)|0;
       $577 = ($j$0117$i|0)<(9);
       if ($577) {
        $i$1118$i = 10;$j$0119$i = $j$0117$i;
        while(1) {
         $578 = ($i$1118$i*10)|0;
         $j$0$i = (($j$0119$i) + 1)|0;
         $exitcond$i = ($j$0$i|0)==(9);
         if ($exitcond$i) {
          $i$1$lcssa$i = $578;
          break;
         } else {
          $i$1118$i = $578;$j$0119$i = $j$0$i;
         }
        }
       } else {
        $i$1$lcssa$i = 10;
       }
       $579 = HEAP32[$575>>2]|0;
       $580 = (($579>>>0) % ($i$1$lcssa$i>>>0))&-1;
       $581 = ($580|0)==(0);
       $582 = ((($575)) + 4|0);
       $583 = ($582|0)==($z$3$lcssa$i|0);
       $or$cond18$i = $583 & $581;
       do {
        if ($or$cond18$i) {
         $a$8$i = $a$3$lcssa$i;$d$4$i = $575;$e$4$i = $e$1$i;
        } else {
         $584 = (($579>>>0) / ($i$1$lcssa$i>>>0))&-1;
         $585 = $584 & 1;
         $586 = ($585|0)==(0);
         $$20$i = $586 ? 9007199254740992.0 : 9007199254740994.0;
         $587 = (($i$1$lcssa$i|0) / 2)&-1;
         $588 = ($580>>>0)<($587>>>0);
         if ($588) {
          $small$0$i = 0.5;
         } else {
          $589 = ($580|0)==($587|0);
          $or$cond22$i = $583 & $589;
          $$36$i = $or$cond22$i ? 1.0 : 1.5;
          $small$0$i = $$36$i;
         }
         $590 = ($pl$0$i|0)==(0);
         do {
          if ($590) {
           $round6$1$i = $$20$i;$small$1$i = $small$0$i;
          } else {
           $591 = HEAP8[$prefix$0$i>>0]|0;
           $592 = ($591<<24>>24)==(45);
           if (!($592)) {
            $round6$1$i = $$20$i;$small$1$i = $small$0$i;
            break;
           }
           $593 = -$$20$i;
           $594 = -$small$0$i;
           $round6$1$i = $593;$small$1$i = $594;
          }
         } while(0);
         $595 = (($579) - ($580))|0;
         HEAP32[$575>>2] = $595;
         $596 = $round6$1$i + $small$1$i;
         $597 = $596 != $round6$1$i;
         if (!($597)) {
          $a$8$i = $a$3$lcssa$i;$d$4$i = $575;$e$4$i = $e$1$i;
          break;
         }
         $598 = (($595) + ($i$1$lcssa$i))|0;
         HEAP32[$575>>2] = $598;
         $599 = ($598>>>0)>(999999999);
         if ($599) {
          $a$5111$i = $a$3$lcssa$i;$d$2110$i = $575;
          while(1) {
           $600 = ((($d$2110$i)) + -4|0);
           HEAP32[$d$2110$i>>2] = 0;
           $601 = ($600>>>0)<($a$5111$i>>>0);
           if ($601) {
            $602 = ((($a$5111$i)) + -4|0);
            HEAP32[$602>>2] = 0;
            $a$6$i = $602;
           } else {
            $a$6$i = $a$5111$i;
           }
           $603 = HEAP32[$600>>2]|0;
           $604 = (($603) + 1)|0;
           HEAP32[$600>>2] = $604;
           $605 = ($604>>>0)>(999999999);
           if ($605) {
            $a$5111$i = $a$6$i;$d$2110$i = $600;
           } else {
            $a$5$lcssa$i = $a$6$i;$d$2$lcssa$i = $600;
            break;
           }
          }
         } else {
          $a$5$lcssa$i = $a$3$lcssa$i;$d$2$lcssa$i = $575;
         }
         $606 = $a$5$lcssa$i;
         $607 = (($479) - ($606))|0;
         $608 = $607 >> 2;
         $609 = ($608*9)|0;
         $610 = HEAP32[$a$5$lcssa$i>>2]|0;
         $611 = ($610>>>0)<(10);
         if ($611) {
          $a$8$i = $a$5$lcssa$i;$d$4$i = $d$2$lcssa$i;$e$4$i = $609;
          break;
         } else {
          $e$2106$i = $609;$i$2105$i = 10;
         }
         while(1) {
          $612 = ($i$2105$i*10)|0;
          $613 = (($e$2106$i) + 1)|0;
          $614 = ($610>>>0)<($612>>>0);
          if ($614) {
           $a$8$i = $a$5$lcssa$i;$d$4$i = $d$2$lcssa$i;$e$4$i = $613;
           break;
          } else {
           $e$2106$i = $613;$i$2105$i = $612;
          }
         }
        }
       } while(0);
       $615 = ((($d$4$i)) + 4|0);
       $616 = ($z$3$lcssa$i>>>0)>($615>>>0);
       $$z$3$i = $616 ? $615 : $z$3$lcssa$i;
       $a$9$ph$i = $a$8$i;$e$5$ph$i = $e$4$i;$z$7$ph$i = $$z$3$i;
      } else {
       $a$9$ph$i = $a$3$lcssa$i;$e$5$ph$i = $e$1$i;$z$7$ph$i = $z$3$lcssa$i;
      }
      $617 = (0 - ($e$5$ph$i))|0;
      $z$7$i = $z$7$ph$i;
      while(1) {
       $618 = ($z$7$i>>>0)>($a$9$ph$i>>>0);
       if (!($618)) {
        $$lcssa162$i = 0;$z$7$i$lcssa = $z$7$i;
        break;
       }
       $619 = ((($z$7$i)) + -4|0);
       $620 = HEAP32[$619>>2]|0;
       $621 = ($620|0)==(0);
       if ($621) {
        $z$7$i = $619;
       } else {
        $$lcssa162$i = 1;$z$7$i$lcssa = $z$7$i;
        break;
       }
      }
      do {
       if ($561) {
        $622 = $562&1;
        $623 = $622 ^ 1;
        $$p$$i = (($623) + ($$p$i))|0;
        $624 = ($$p$$i|0)>($e$5$ph$i|0);
        $625 = ($e$5$ph$i|0)>(-5);
        $or$cond6$i = $624 & $625;
        if ($or$cond6$i) {
         $626 = (($t$0) + -1)|0;
         $$neg56$i = (($$p$$i) + -1)|0;
         $627 = (($$neg56$i) - ($e$5$ph$i))|0;
         $$013$i = $626;$$210$i = $627;
        } else {
         $628 = (($t$0) + -2)|0;
         $629 = (($$p$$i) + -1)|0;
         $$013$i = $628;$$210$i = $629;
        }
        $630 = $fl$1$ & 8;
        $631 = ($630|0)==(0);
        if (!($631)) {
         $$114$i = $$013$i;$$311$i = $$210$i;$$pre$phi190$iZ2D = $630;
         break;
        }
        do {
         if ($$lcssa162$i) {
          $632 = ((($z$7$i$lcssa)) + -4|0);
          $633 = HEAP32[$632>>2]|0;
          $634 = ($633|0)==(0);
          if ($634) {
           $j$2$i = 9;
           break;
          }
          $635 = (($633>>>0) % 10)&-1;
          $636 = ($635|0)==(0);
          if ($636) {
           $i$3101$i = 10;$j$1102$i = 0;
          } else {
           $j$2$i = 0;
           break;
          }
          while(1) {
           $637 = ($i$3101$i*10)|0;
           $638 = (($j$1102$i) + 1)|0;
           $639 = (($633>>>0) % ($637>>>0))&-1;
           $640 = ($639|0)==(0);
           if ($640) {
            $i$3101$i = $637;$j$1102$i = $638;
           } else {
            $j$2$i = $638;
            break;
           }
          }
         } else {
          $j$2$i = 9;
         }
        } while(0);
        $641 = $$013$i | 32;
        $642 = ($641|0)==(102);
        $643 = $z$7$i$lcssa;
        $644 = (($643) - ($479))|0;
        $645 = $644 >> 2;
        $646 = ($645*9)|0;
        $647 = (($646) + -9)|0;
        if ($642) {
         $648 = (($647) - ($j$2$i))|0;
         $649 = ($648|0)<(0);
         $$23$i = $649 ? 0 : $648;
         $650 = ($$210$i|0)<($$23$i|0);
         $$210$$24$i = $650 ? $$210$i : $$23$i;
         $$114$i = $$013$i;$$311$i = $$210$$24$i;$$pre$phi190$iZ2D = 0;
         break;
        } else {
         $651 = (($647) + ($e$5$ph$i))|0;
         $652 = (($651) - ($j$2$i))|0;
         $653 = ($652|0)<(0);
         $$25$i = $653 ? 0 : $652;
         $654 = ($$210$i|0)<($$25$i|0);
         $$210$$26$i = $654 ? $$210$i : $$25$i;
         $$114$i = $$013$i;$$311$i = $$210$$26$i;$$pre$phi190$iZ2D = 0;
         break;
        }
       } else {
        $$pre189$i = $fl$1$ & 8;
        $$114$i = $t$0;$$311$i = $$p$i;$$pre$phi190$iZ2D = $$pre189$i;
       }
      } while(0);
      $655 = $$311$i | $$pre$phi190$iZ2D;
      $656 = ($655|0)!=(0);
      $657 = $656&1;
      $658 = $$114$i | 32;
      $659 = ($658|0)==(102);
      if ($659) {
       $660 = ($e$5$ph$i|0)>(0);
       $661 = $660 ? $e$5$ph$i : 0;
       $$pn$i = $661;$estr$2$i = 0;
      } else {
       $662 = ($e$5$ph$i|0)<(0);
       $663 = $662 ? $617 : $e$5$ph$i;
       $664 = ($663|0)<(0);
       $665 = $664 << 31 >> 31;
       $666 = (_fmt_u($663,$665,$7)|0);
       $667 = $666;
       $668 = (($9) - ($667))|0;
       $669 = ($668|0)<(2);
       if ($669) {
        $estr$195$i = $666;
        while(1) {
         $670 = ((($estr$195$i)) + -1|0);
         HEAP8[$670>>0] = 48;
         $671 = $670;
         $672 = (($9) - ($671))|0;
         $673 = ($672|0)<(2);
         if ($673) {
          $estr$195$i = $670;
         } else {
          $estr$1$lcssa$i = $670;
          break;
         }
        }
       } else {
        $estr$1$lcssa$i = $666;
       }
       $674 = $e$5$ph$i >> 31;
       $675 = $674 & 2;
       $676 = (($675) + 43)|0;
       $677 = $676&255;
       $678 = ((($estr$1$lcssa$i)) + -1|0);
       HEAP8[$678>>0] = $677;
       $679 = $$114$i&255;
       $680 = ((($estr$1$lcssa$i)) + -2|0);
       HEAP8[$680>>0] = $679;
       $681 = $680;
       $682 = (($9) - ($681))|0;
       $$pn$i = $682;$estr$2$i = $680;
      }
      $683 = (($pl$0$i) + 1)|0;
      $684 = (($683) + ($$311$i))|0;
      $l$1$i = (($684) + ($657))|0;
      $685 = (($l$1$i) + ($$pn$i))|0;
      _pad($f,32,$w$1,$685,$fl$1$);
      $686 = HEAP32[$f>>2]|0;
      $687 = $686 & 32;
      $688 = ($687|0)==(0);
      if ($688) {
       (___fwritex($prefix$0$i,$pl$0$i,$f)|0);
      }
      $689 = $fl$1$ ^ 65536;
      _pad($f,48,$w$1,$685,$689);
      do {
       if ($659) {
        $690 = ($a$9$ph$i>>>0)>($$33$i>>>0);
        $r$0$a$9$i = $690 ? $$33$i : $a$9$ph$i;
        $d$584$i = $r$0$a$9$i;
        while(1) {
         $691 = HEAP32[$d$584$i>>2]|0;
         $692 = (_fmt_u($691,0,$14)|0);
         $693 = ($d$584$i|0)==($r$0$a$9$i|0);
         do {
          if ($693) {
           $699 = ($692|0)==($14|0);
           if (!($699)) {
            $s7$1$i = $692;
            break;
           }
           HEAP8[$16>>0] = 48;
           $s7$1$i = $16;
          } else {
           $694 = ($692>>>0)>($buf$i>>>0);
           if (!($694)) {
            $s7$1$i = $692;
            break;
           }
           $695 = $692;
           $696 = (($695) - ($5))|0;
           _memset(($buf$i|0),48,($696|0))|0;
           $s7$081$i = $692;
           while(1) {
            $697 = ((($s7$081$i)) + -1|0);
            $698 = ($697>>>0)>($buf$i>>>0);
            if ($698) {
             $s7$081$i = $697;
            } else {
             $s7$1$i = $697;
             break;
            }
           }
          }
         } while(0);
         $700 = HEAP32[$f>>2]|0;
         $701 = $700 & 32;
         $702 = ($701|0)==(0);
         if ($702) {
          $703 = $s7$1$i;
          $704 = (($15) - ($703))|0;
          (___fwritex($s7$1$i,$704,$f)|0);
         }
         $705 = ((($d$584$i)) + 4|0);
         $706 = ($705>>>0)>($$33$i>>>0);
         if ($706) {
          $$lcssa316 = $705;
          break;
         } else {
          $d$584$i = $705;
         }
        }
        $707 = ($655|0)==(0);
        do {
         if (!($707)) {
          $708 = HEAP32[$f>>2]|0;
          $709 = $708 & 32;
          $710 = ($709|0)==(0);
          if (!($710)) {
           break;
          }
          (___fwritex(3252,1,$f)|0);
         }
        } while(0);
        $711 = ($$lcssa316>>>0)<($z$7$i$lcssa>>>0);
        $712 = ($$311$i|0)>(0);
        $713 = $712 & $711;
        if ($713) {
         $$41278$i = $$311$i;$d$677$i = $$lcssa316;
         while(1) {
          $714 = HEAP32[$d$677$i>>2]|0;
          $715 = (_fmt_u($714,0,$14)|0);
          $716 = ($715>>>0)>($buf$i>>>0);
          if ($716) {
           $717 = $715;
           $718 = (($717) - ($5))|0;
           _memset(($buf$i|0),48,($718|0))|0;
           $s8$072$i = $715;
           while(1) {
            $719 = ((($s8$072$i)) + -1|0);
            $720 = ($719>>>0)>($buf$i>>>0);
            if ($720) {
             $s8$072$i = $719;
            } else {
             $s8$0$lcssa$i = $719;
             break;
            }
           }
          } else {
           $s8$0$lcssa$i = $715;
          }
          $721 = HEAP32[$f>>2]|0;
          $722 = $721 & 32;
          $723 = ($722|0)==(0);
          if ($723) {
           $724 = ($$41278$i|0)>(9);
           $725 = $724 ? 9 : $$41278$i;
           (___fwritex($s8$0$lcssa$i,$725,$f)|0);
          }
          $726 = ((($d$677$i)) + 4|0);
          $727 = (($$41278$i) + -9)|0;
          $728 = ($726>>>0)<($z$7$i$lcssa>>>0);
          $729 = ($$41278$i|0)>(9);
          $730 = $729 & $728;
          if ($730) {
           $$41278$i = $727;$d$677$i = $726;
          } else {
           $$412$lcssa$i = $727;
           break;
          }
         }
        } else {
         $$412$lcssa$i = $$311$i;
        }
        $731 = (($$412$lcssa$i) + 9)|0;
        _pad($f,48,$731,9,0);
       } else {
        $732 = ((($a$9$ph$i)) + 4|0);
        $z$7$$i = $$lcssa162$i ? $z$7$i$lcssa : $732;
        $733 = ($$311$i|0)>(-1);
        if ($733) {
         $734 = ($$pre$phi190$iZ2D|0)==(0);
         $$589$i = $$311$i;$d$788$i = $a$9$ph$i;
         while(1) {
          $735 = HEAP32[$d$788$i>>2]|0;
          $736 = (_fmt_u($735,0,$14)|0);
          $737 = ($736|0)==($14|0);
          if ($737) {
           HEAP8[$16>>0] = 48;
           $s9$0$i = $16;
          } else {
           $s9$0$i = $736;
          }
          $738 = ($d$788$i|0)==($a$9$ph$i|0);
          do {
           if ($738) {
            $742 = ((($s9$0$i)) + 1|0);
            $743 = HEAP32[$f>>2]|0;
            $744 = $743 & 32;
            $745 = ($744|0)==(0);
            if ($745) {
             (___fwritex($s9$0$i,1,$f)|0);
            }
            $746 = ($$589$i|0)<(1);
            $or$cond31$i = $734 & $746;
            if ($or$cond31$i) {
             $s9$2$i = $742;
             break;
            }
            $747 = HEAP32[$f>>2]|0;
            $748 = $747 & 32;
            $749 = ($748|0)==(0);
            if (!($749)) {
             $s9$2$i = $742;
             break;
            }
            (___fwritex(3252,1,$f)|0);
            $s9$2$i = $742;
           } else {
            $739 = ($s9$0$i>>>0)>($buf$i>>>0);
            if (!($739)) {
             $s9$2$i = $s9$0$i;
             break;
            }
            $scevgep182$i = (($s9$0$i) + ($6)|0);
            $scevgep182183$i = $scevgep182$i;
            _memset(($buf$i|0),48,($scevgep182183$i|0))|0;
            $s9$185$i = $s9$0$i;
            while(1) {
             $740 = ((($s9$185$i)) + -1|0);
             $741 = ($740>>>0)>($buf$i>>>0);
             if ($741) {
              $s9$185$i = $740;
             } else {
              $s9$2$i = $740;
              break;
             }
            }
           }
          } while(0);
          $750 = $s9$2$i;
          $751 = (($15) - ($750))|0;
          $752 = HEAP32[$f>>2]|0;
          $753 = $752 & 32;
          $754 = ($753|0)==(0);
          if ($754) {
           $755 = ($$589$i|0)>($751|0);
           $756 = $755 ? $751 : $$589$i;
           (___fwritex($s9$2$i,$756,$f)|0);
          }
          $757 = (($$589$i) - ($751))|0;
          $758 = ((($d$788$i)) + 4|0);
          $759 = ($758>>>0)<($z$7$$i>>>0);
          $760 = ($757|0)>(-1);
          $761 = $759 & $760;
          if ($761) {
           $$589$i = $757;$d$788$i = $758;
          } else {
           $$5$lcssa$i = $757;
           break;
          }
         }
        } else {
         $$5$lcssa$i = $$311$i;
        }
        $762 = (($$5$lcssa$i) + 18)|0;
        _pad($f,48,$762,18,0);
        $763 = HEAP32[$f>>2]|0;
        $764 = $763 & 32;
        $765 = ($764|0)==(0);
        if (!($765)) {
         break;
        }
        $766 = $estr$2$i;
        $767 = (($9) - ($766))|0;
        (___fwritex($estr$2$i,$767,$f)|0);
       }
      } while(0);
      $768 = $fl$1$ ^ 8192;
      _pad($f,32,$w$1,$685,$768);
      $769 = ($685|0)<($w$1|0);
      $w$32$i = $769 ? $w$1 : $685;
      $$0$i = $w$32$i;
     } else {
      $375 = $t$0 & 32;
      $376 = ($375|0)!=(0);
      $377 = $376 ? 3240 : 3244;
      $378 = ($$07$i != $$07$i) | (0.0 != 0.0);
      $379 = $376 ? 3263 : 3248;
      $pl$1$i = $378 ? 0 : $pl$0$i;
      $s1$0$i = $378 ? $379 : $377;
      $380 = (($pl$1$i) + 3)|0;
      _pad($f,32,$w$1,$380,$176);
      $381 = HEAP32[$f>>2]|0;
      $382 = $381 & 32;
      $383 = ($382|0)==(0);
      if ($383) {
       (___fwritex($prefix$0$i,$pl$1$i,$f)|0);
       $$pre$i = HEAP32[$f>>2]|0;
       $385 = $$pre$i;
      } else {
       $385 = $381;
      }
      $384 = $385 & 32;
      $386 = ($384|0)==(0);
      if ($386) {
       (___fwritex($s1$0$i,3,$f)|0);
      }
      $387 = $fl$1$ ^ 8192;
      _pad($f,32,$w$1,$380,$387);
      $388 = ($380|0)<($w$1|0);
      $389 = $388 ? $w$1 : $380;
      $$0$i = $389;
     }
    } while(0);
    $cnt$0 = $cnt$1;$l$0 = $$0$i;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
    continue L1;
    break;
   }
   default: {
    $a$2 = $s$0;$fl$6 = $fl$1$;$p$5 = $p$0;$pl$2 = 0;$prefix$2 = 1312;$z$2 = $1;
   }
   }
  } while(0);
  L311: do {
   if ((label|0) == 64) {
    label = 0;
    $207 = $arg;
    $208 = $207;
    $209 = HEAP32[$208>>2]|0;
    $210 = (($207) + 4)|0;
    $211 = $210;
    $212 = HEAP32[$211>>2]|0;
    $213 = $t$1 & 32;
    $214 = ($209|0)==(0);
    $215 = ($212|0)==(0);
    $216 = $214 & $215;
    if ($216) {
     $a$0 = $1;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 0;$prefix$1 = 1312;
     label = 77;
    } else {
     $$012$i = $1;$218 = $209;$225 = $212;
     while(1) {
      $217 = $218 & 15;
      $219 = (1296 + ($217)|0);
      $220 = HEAP8[$219>>0]|0;
      $221 = $220&255;
      $222 = $221 | $213;
      $223 = $222&255;
      $224 = ((($$012$i)) + -1|0);
      HEAP8[$224>>0] = $223;
      $226 = (_bitshift64Lshr(($218|0),($225|0),4)|0);
      $227 = tempRet0;
      $228 = ($226|0)==(0);
      $229 = ($227|0)==(0);
      $230 = $228 & $229;
      if ($230) {
       $$lcssa321 = $224;
       break;
      } else {
       $$012$i = $224;$218 = $226;$225 = $227;
      }
     }
     $231 = $arg;
     $232 = $231;
     $233 = HEAP32[$232>>2]|0;
     $234 = (($231) + 4)|0;
     $235 = $234;
     $236 = HEAP32[$235>>2]|0;
     $237 = ($233|0)==(0);
     $238 = ($236|0)==(0);
     $239 = $237 & $238;
     $240 = $fl$3 & 8;
     $241 = ($240|0)==(0);
     $or$cond17 = $241 | $239;
     if ($or$cond17) {
      $a$0 = $$lcssa321;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 0;$prefix$1 = 1312;
      label = 77;
     } else {
      $242 = $t$1 >> 4;
      $243 = (1312 + ($242)|0);
      $a$0 = $$lcssa321;$fl$4 = $fl$3;$p$2 = $p$1;$pl$1 = 2;$prefix$1 = $243;
      label = 77;
     }
    }
   }
   else if ((label|0) == 76) {
    label = 0;
    $289 = (_fmt_u($287,$288,$1)|0);
    $a$0 = $289;$fl$4 = $fl$1$;$p$2 = $p$0;$pl$1 = $pl$0;$prefix$1 = $prefix$0;
    label = 77;
   }
   else if ((label|0) == 82) {
    label = 0;
    $321 = (_memchr($a$1,0,$p$0)|0);
    $322 = ($321|0)==(0|0);
    $323 = $321;
    $324 = $a$1;
    $325 = (($323) - ($324))|0;
    $326 = (($a$1) + ($p$0)|0);
    $z$1 = $322 ? $326 : $321;
    $p$3 = $322 ? $p$0 : $325;
    $a$2 = $a$1;$fl$6 = $176;$p$5 = $p$3;$pl$2 = 0;$prefix$2 = 1312;$z$2 = $z$1;
   }
   else if ((label|0) == 86) {
    label = 0;
    $i$0105 = 0;$l$1104 = 0;$ws$0106 = $798;
    while(1) {
     $334 = HEAP32[$ws$0106>>2]|0;
     $335 = ($334|0)==(0);
     if ($335) {
      $i$0$lcssa = $i$0105;$l$2 = $l$1104;
      break;
     }
     $336 = (_wctomb($mb,$334)|0);
     $337 = ($336|0)<(0);
     $338 = (($p$4176) - ($i$0105))|0;
     $339 = ($336>>>0)>($338>>>0);
     $or$cond20 = $337 | $339;
     if ($or$cond20) {
      $i$0$lcssa = $i$0105;$l$2 = $336;
      break;
     }
     $340 = ((($ws$0106)) + 4|0);
     $341 = (($336) + ($i$0105))|0;
     $342 = ($p$4176>>>0)>($341>>>0);
     if ($342) {
      $i$0105 = $341;$l$1104 = $336;$ws$0106 = $340;
     } else {
      $i$0$lcssa = $341;$l$2 = $336;
      break;
     }
    }
    $343 = ($l$2|0)<(0);
    if ($343) {
     $$0 = -1;
     break L1;
    }
    _pad($f,32,$w$1,$i$0$lcssa,$fl$1$);
    $344 = ($i$0$lcssa|0)==(0);
    if ($344) {
     $i$0$lcssa178 = 0;
     label = 97;
    } else {
     $i$1116 = 0;$ws$1117 = $798;
     while(1) {
      $345 = HEAP32[$ws$1117>>2]|0;
      $346 = ($345|0)==(0);
      if ($346) {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break L311;
      }
      $347 = ((($ws$1117)) + 4|0);
      $348 = (_wctomb($mb,$345)|0);
      $349 = (($348) + ($i$1116))|0;
      $350 = ($349|0)>($i$0$lcssa|0);
      if ($350) {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break L311;
      }
      $351 = HEAP32[$f>>2]|0;
      $352 = $351 & 32;
      $353 = ($352|0)==(0);
      if ($353) {
       (___fwritex($mb,$348,$f)|0);
      }
      $354 = ($349>>>0)<($i$0$lcssa>>>0);
      if ($354) {
       $i$1116 = $349;$ws$1117 = $347;
      } else {
       $i$0$lcssa178 = $i$0$lcssa;
       label = 97;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 97) {
   label = 0;
   $355 = $fl$1$ ^ 8192;
   _pad($f,32,$w$1,$i$0$lcssa178,$355);
   $356 = ($w$1|0)>($i$0$lcssa178|0);
   $357 = $356 ? $w$1 : $i$0$lcssa178;
   $cnt$0 = $cnt$1;$l$0 = $357;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
   continue;
  }
  if ((label|0) == 77) {
   label = 0;
   $290 = ($p$2|0)>(-1);
   $291 = $fl$4 & -65537;
   $$fl$4 = $290 ? $291 : $fl$4;
   $292 = $arg;
   $293 = $292;
   $294 = HEAP32[$293>>2]|0;
   $295 = (($292) + 4)|0;
   $296 = $295;
   $297 = HEAP32[$296>>2]|0;
   $298 = ($294|0)!=(0);
   $299 = ($297|0)!=(0);
   $300 = $298 | $299;
   $301 = ($p$2|0)!=(0);
   $or$cond = $301 | $300;
   if ($or$cond) {
    $302 = $a$0;
    $303 = (($2) - ($302))|0;
    $304 = $300&1;
    $305 = $304 ^ 1;
    $306 = (($305) + ($303))|0;
    $307 = ($p$2|0)>($306|0);
    $p$2$ = $307 ? $p$2 : $306;
    $a$2 = $a$0;$fl$6 = $$fl$4;$p$5 = $p$2$;$pl$2 = $pl$1;$prefix$2 = $prefix$1;$z$2 = $1;
   } else {
    $a$2 = $1;$fl$6 = $$fl$4;$p$5 = 0;$pl$2 = $pl$1;$prefix$2 = $prefix$1;$z$2 = $1;
   }
  }
  $770 = $z$2;
  $771 = $a$2;
  $772 = (($770) - ($771))|0;
  $773 = ($p$5|0)<($772|0);
  $$p$5 = $773 ? $772 : $p$5;
  $774 = (($pl$2) + ($$p$5))|0;
  $775 = ($w$1|0)<($774|0);
  $w$2 = $775 ? $774 : $w$1;
  _pad($f,32,$w$2,$774,$fl$6);
  $776 = HEAP32[$f>>2]|0;
  $777 = $776 & 32;
  $778 = ($777|0)==(0);
  if ($778) {
   (___fwritex($prefix$2,$pl$2,$f)|0);
  }
  $779 = $fl$6 ^ 65536;
  _pad($f,48,$w$2,$774,$779);
  _pad($f,48,$$p$5,$772,0);
  $780 = HEAP32[$f>>2]|0;
  $781 = $780 & 32;
  $782 = ($781|0)==(0);
  if ($782) {
   (___fwritex($a$2,$772,$f)|0);
  }
  $783 = $fl$6 ^ 8192;
  _pad($f,32,$w$2,$774,$783);
  $cnt$0 = $cnt$1;$l$0 = $w$2;$l10n$0 = $l10n$3;$s$0 = $$lcssa300;
 }
 L345: do {
  if ((label|0) == 244) {
   $784 = ($f|0)==(0|0);
   if ($784) {
    $785 = ($l10n$0$lcssa|0)==(0);
    if ($785) {
     $$0 = 0;
    } else {
     $i$291 = 1;
     while(1) {
      $786 = (($nl_type) + ($i$291<<2)|0);
      $787 = HEAP32[$786>>2]|0;
      $788 = ($787|0)==(0);
      if ($788) {
       $i$291$lcssa = $i$291;
       break;
      }
      $790 = (($nl_arg) + ($i$291<<3)|0);
      _pop_arg($790,$787,$ap);
      $791 = (($i$291) + 1)|0;
      $792 = ($791|0)<(10);
      if ($792) {
       $i$291 = $791;
      } else {
       $$0 = 1;
       break L345;
      }
     }
     $789 = ($i$291$lcssa|0)<(10);
     if ($789) {
      $i$389 = $i$291$lcssa;
      while(1) {
       $795 = (($nl_type) + ($i$389<<2)|0);
       $796 = HEAP32[$795>>2]|0;
       $797 = ($796|0)==(0);
       $793 = (($i$389) + 1)|0;
       if (!($797)) {
        $$0 = -1;
        break L345;
       }
       $794 = ($793|0)<(10);
       if ($794) {
        $i$389 = $793;
       } else {
        $$0 = 1;
        break;
       }
      }
     } else {
      $$0 = 1;
     }
    }
   } else {
    $$0 = $cnt$1$lcssa;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___fwritex($s,$l,$f) {
 $s = $s|0;
 $l = $l|0;
 $f = $f|0;
 var $$0 = 0, $$01 = 0, $$02 = 0, $$pre = 0, $$pre6 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i$0 = 0, $i$0$lcssa12 = 0;
 var $i$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 16|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $4 = (___towrite($f)|0);
  $5 = ($4|0)==(0);
  if ($5) {
   $$pre = HEAP32[$0>>2]|0;
   $9 = $$pre;
   label = 5;
  } else {
   $$0 = 0;
  }
 } else {
  $3 = $1;
  $9 = $3;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $6 = ((($f)) + 20|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = (($9) - ($7))|0;
   $10 = ($8>>>0)<($l>>>0);
   $11 = $7;
   if ($10) {
    $12 = ((($f)) + 36|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = (FUNCTION_TABLE_iiii[$13 & 7]($f,$s,$l)|0);
    $$0 = $14;
    break;
   }
   $15 = ((($f)) + 75|0);
   $16 = HEAP8[$15>>0]|0;
   $17 = ($16<<24>>24)>(-1);
   L10: do {
    if ($17) {
     $i$0 = $l;
     while(1) {
      $18 = ($i$0|0)==(0);
      if ($18) {
       $$01 = $l;$$02 = $s;$29 = $11;$i$1 = 0;
       break L10;
      }
      $19 = (($i$0) + -1)|0;
      $20 = (($s) + ($19)|0);
      $21 = HEAP8[$20>>0]|0;
      $22 = ($21<<24>>24)==(10);
      if ($22) {
       $i$0$lcssa12 = $i$0;
       break;
      } else {
       $i$0 = $19;
      }
     }
     $23 = ((($f)) + 36|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = (FUNCTION_TABLE_iiii[$24 & 7]($f,$s,$i$0$lcssa12)|0);
     $26 = ($25>>>0)<($i$0$lcssa12>>>0);
     if ($26) {
      $$0 = $i$0$lcssa12;
      break L5;
     }
     $27 = (($s) + ($i$0$lcssa12)|0);
     $28 = (($l) - ($i$0$lcssa12))|0;
     $$pre6 = HEAP32[$6>>2]|0;
     $$01 = $28;$$02 = $27;$29 = $$pre6;$i$1 = $i$0$lcssa12;
    } else {
     $$01 = $l;$$02 = $s;$29 = $11;$i$1 = 0;
    }
   } while(0);
   _memcpy(($29|0),($$02|0),($$01|0))|0;
   $30 = HEAP32[$6>>2]|0;
   $31 = (($30) + ($$01)|0);
   HEAP32[$6>>2] = $31;
   $32 = (($i$1) + ($$01))|0;
   $$0 = $32;
  }
 } while(0);
 return ($$0|0);
}
function ___towrite($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 74|0);
 $1 = HEAP8[$0>>0]|0;
 $2 = $1 << 24 >> 24;
 $3 = (($2) + 255)|0;
 $4 = $3 | $2;
 $5 = $4&255;
 HEAP8[$0>>0] = $5;
 $6 = HEAP32[$f>>2]|0;
 $7 = $6 & 8;
 $8 = ($7|0)==(0);
 if ($8) {
  $10 = ((($f)) + 8|0);
  HEAP32[$10>>2] = 0;
  $11 = ((($f)) + 4|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($f)) + 44|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ((($f)) + 28|0);
  HEAP32[$14>>2] = $13;
  $15 = ((($f)) + 20|0);
  HEAP32[$15>>2] = $13;
  $16 = $13;
  $17 = ((($f)) + 48|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (($16) + ($18)|0);
  $20 = ((($f)) + 16|0);
  HEAP32[$20>>2] = $19;
  $$0 = 0;
 } else {
  $9 = $6 | 32;
  HEAP32[$f>>2] = $9;
  $$0 = -1;
 }
 return ($$0|0);
}
function _pop_arg($arg,$type,$ap) {
 $arg = $arg|0;
 $type = $type|0;
 $ap = $ap|0;
 var $$mask = 0, $$mask1 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0.0;
 var $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($type>>>0)>(20);
 L1: do {
  if (!($0)) {
   do {
    switch ($type|0) {
    case 9:  {
     $arglist_current = HEAP32[$ap>>2]|0;
     $1 = $arglist_current;
     $2 = ((0) + 4|0);
     $expanded28 = $2;
     $expanded = (($expanded28) - 1)|0;
     $3 = (($1) + ($expanded))|0;
     $4 = ((0) + 4|0);
     $expanded32 = $4;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $5 = $3 & $expanded30;
     $6 = $5;
     $7 = HEAP32[$6>>2]|0;
     $arglist_next = ((($6)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next;
     HEAP32[$arg>>2] = $7;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$ap>>2]|0;
     $8 = $arglist_current2;
     $9 = ((0) + 4|0);
     $expanded35 = $9;
     $expanded34 = (($expanded35) - 1)|0;
     $10 = (($8) + ($expanded34))|0;
     $11 = ((0) + 4|0);
     $expanded39 = $11;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $12 = $10 & $expanded37;
     $13 = $12;
     $14 = HEAP32[$13>>2]|0;
     $arglist_next3 = ((($13)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next3;
     $15 = ($14|0)<(0);
     $16 = $15 << 31 >> 31;
     $17 = $arg;
     $18 = $17;
     HEAP32[$18>>2] = $14;
     $19 = (($17) + 4)|0;
     $20 = $19;
     HEAP32[$20>>2] = $16;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$ap>>2]|0;
     $21 = $arglist_current5;
     $22 = ((0) + 4|0);
     $expanded42 = $22;
     $expanded41 = (($expanded42) - 1)|0;
     $23 = (($21) + ($expanded41))|0;
     $24 = ((0) + 4|0);
     $expanded46 = $24;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $25 = $23 & $expanded44;
     $26 = $25;
     $27 = HEAP32[$26>>2]|0;
     $arglist_next6 = ((($26)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next6;
     $28 = $arg;
     $29 = $28;
     HEAP32[$29>>2] = $27;
     $30 = (($28) + 4)|0;
     $31 = $30;
     HEAP32[$31>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$ap>>2]|0;
     $32 = $arglist_current8;
     $33 = ((0) + 8|0);
     $expanded49 = $33;
     $expanded48 = (($expanded49) - 1)|0;
     $34 = (($32) + ($expanded48))|0;
     $35 = ((0) + 8|0);
     $expanded53 = $35;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $36 = $34 & $expanded51;
     $37 = $36;
     $38 = $37;
     $39 = $38;
     $40 = HEAP32[$39>>2]|0;
     $41 = (($38) + 4)|0;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $arglist_next9 = ((($37)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next9;
     $44 = $arg;
     $45 = $44;
     HEAP32[$45>>2] = $40;
     $46 = (($44) + 4)|0;
     $47 = $46;
     HEAP32[$47>>2] = $43;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$ap>>2]|0;
     $48 = $arglist_current11;
     $49 = ((0) + 4|0);
     $expanded56 = $49;
     $expanded55 = (($expanded56) - 1)|0;
     $50 = (($48) + ($expanded55))|0;
     $51 = ((0) + 4|0);
     $expanded60 = $51;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $52 = $50 & $expanded58;
     $53 = $52;
     $54 = HEAP32[$53>>2]|0;
     $arglist_next12 = ((($53)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next12;
     $55 = $54&65535;
     $56 = $55 << 16 >> 16;
     $57 = ($56|0)<(0);
     $58 = $57 << 31 >> 31;
     $59 = $arg;
     $60 = $59;
     HEAP32[$60>>2] = $56;
     $61 = (($59) + 4)|0;
     $62 = $61;
     HEAP32[$62>>2] = $58;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$ap>>2]|0;
     $63 = $arglist_current14;
     $64 = ((0) + 4|0);
     $expanded63 = $64;
     $expanded62 = (($expanded63) - 1)|0;
     $65 = (($63) + ($expanded62))|0;
     $66 = ((0) + 4|0);
     $expanded67 = $66;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $67 = $65 & $expanded65;
     $68 = $67;
     $69 = HEAP32[$68>>2]|0;
     $arglist_next15 = ((($68)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next15;
     $$mask1 = $69 & 65535;
     $70 = $arg;
     $71 = $70;
     HEAP32[$71>>2] = $$mask1;
     $72 = (($70) + 4)|0;
     $73 = $72;
     HEAP32[$73>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$ap>>2]|0;
     $74 = $arglist_current17;
     $75 = ((0) + 4|0);
     $expanded70 = $75;
     $expanded69 = (($expanded70) - 1)|0;
     $76 = (($74) + ($expanded69))|0;
     $77 = ((0) + 4|0);
     $expanded74 = $77;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $78 = $76 & $expanded72;
     $79 = $78;
     $80 = HEAP32[$79>>2]|0;
     $arglist_next18 = ((($79)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next18;
     $81 = $80&255;
     $82 = $81 << 24 >> 24;
     $83 = ($82|0)<(0);
     $84 = $83 << 31 >> 31;
     $85 = $arg;
     $86 = $85;
     HEAP32[$86>>2] = $82;
     $87 = (($85) + 4)|0;
     $88 = $87;
     HEAP32[$88>>2] = $84;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$ap>>2]|0;
     $89 = $arglist_current20;
     $90 = ((0) + 4|0);
     $expanded77 = $90;
     $expanded76 = (($expanded77) - 1)|0;
     $91 = (($89) + ($expanded76))|0;
     $92 = ((0) + 4|0);
     $expanded81 = $92;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $93 = $91 & $expanded79;
     $94 = $93;
     $95 = HEAP32[$94>>2]|0;
     $arglist_next21 = ((($94)) + 4|0);
     HEAP32[$ap>>2] = $arglist_next21;
     $$mask = $95 & 255;
     $96 = $arg;
     $97 = $96;
     HEAP32[$97>>2] = $$mask;
     $98 = (($96) + 4)|0;
     $99 = $98;
     HEAP32[$99>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$ap>>2]|0;
     $100 = $arglist_current23;
     $101 = ((0) + 8|0);
     $expanded84 = $101;
     $expanded83 = (($expanded84) - 1)|0;
     $102 = (($100) + ($expanded83))|0;
     $103 = ((0) + 8|0);
     $expanded88 = $103;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $104 = $102 & $expanded86;
     $105 = $104;
     $106 = +HEAPF64[$105>>3];
     $arglist_next24 = ((($105)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next24;
     HEAPF64[$arg>>3] = $106;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$ap>>2]|0;
     $107 = $arglist_current26;
     $108 = ((0) + 8|0);
     $expanded91 = $108;
     $expanded90 = (($expanded91) - 1)|0;
     $109 = (($107) + ($expanded90))|0;
     $110 = ((0) + 8|0);
     $expanded95 = $110;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $111 = $109 & $expanded93;
     $112 = $111;
     $113 = +HEAPF64[$112>>3];
     $arglist_next27 = ((($112)) + 8|0);
     HEAP32[$ap>>2] = $arglist_next27;
     HEAPF64[$arg>>3] = $113;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_u($0,$1,$s) {
 $0 = $0|0;
 $1 = $1|0;
 $s = $s|0;
 var $$0$lcssa = 0, $$01$lcssa$off0 = 0, $$05 = 0, $$1$lcssa = 0, $$12 = 0, $$lcssa19 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $y$03 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(0);
 $3 = ($0>>>0)>(4294967295);
 $4 = ($1|0)==(0);
 $5 = $4 & $3;
 $6 = $2 | $5;
 if ($6) {
  $$05 = $s;$7 = $0;$8 = $1;
  while(1) {
   $9 = (___uremdi3(($7|0),($8|0),10,0)|0);
   $10 = tempRet0;
   $11 = $9 | 48;
   $12 = $11&255;
   $13 = ((($$05)) + -1|0);
   HEAP8[$13>>0] = $12;
   $14 = (___udivdi3(($7|0),($8|0),10,0)|0);
   $15 = tempRet0;
   $16 = ($8>>>0)>(9);
   $17 = ($7>>>0)>(4294967295);
   $18 = ($8|0)==(9);
   $19 = $18 & $17;
   $20 = $16 | $19;
   if ($20) {
    $$05 = $13;$7 = $14;$8 = $15;
   } else {
    $$lcssa19 = $13;$28 = $14;$29 = $15;
    break;
   }
  }
  $$0$lcssa = $$lcssa19;$$01$lcssa$off0 = $28;
 } else {
  $$0$lcssa = $s;$$01$lcssa$off0 = $0;
 }
 $21 = ($$01$lcssa$off0|0)==(0);
 if ($21) {
  $$1$lcssa = $$0$lcssa;
 } else {
  $$12 = $$0$lcssa;$y$03 = $$01$lcssa$off0;
  while(1) {
   $22 = (($y$03>>>0) % 10)&-1;
   $23 = $22 | 48;
   $24 = $23&255;
   $25 = ((($$12)) + -1|0);
   HEAP8[$25>>0] = $24;
   $26 = (($y$03>>>0) / 10)&-1;
   $27 = ($y$03>>>0)<(10);
   if ($27) {
    $$1$lcssa = $25;
    break;
   } else {
    $$12 = $25;$y$03 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($e) {
 $e = $e|0;
 var $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i$03 = 0, $i$03$lcssa = 0, $i$12 = 0, $s$0$lcssa = 0, $s$01 = 0, $s$1 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $i$03 = 0;
 while(1) {
  $1 = (1322 + ($i$03)|0);
  $2 = HEAP8[$1>>0]|0;
  $3 = $2&255;
  $4 = ($3|0)==($e|0);
  if ($4) {
   $i$03$lcssa = $i$03;
   label = 2;
   break;
  }
  $5 = (($i$03) + 1)|0;
  $6 = ($5|0)==(87);
  if ($6) {
   $i$12 = 87;$s$01 = 1410;
   label = 5;
   break;
  } else {
   $i$03 = $5;
  }
 }
 if ((label|0) == 2) {
  $0 = ($i$03$lcssa|0)==(0);
  if ($0) {
   $s$0$lcssa = 1410;
  } else {
   $i$12 = $i$03$lcssa;$s$01 = 1410;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $s$1 = $s$01;
   while(1) {
    $7 = HEAP8[$s$1>>0]|0;
    $8 = ($7<<24>>24)==(0);
    $9 = ((($s$1)) + 1|0);
    if ($8) {
     $$lcssa = $9;
     break;
    } else {
     $s$1 = $9;
    }
   }
   $10 = (($i$12) + -1)|0;
   $11 = ($10|0)==(0);
   if ($11) {
    $s$0$lcssa = $$lcssa;
    break;
   } else {
    $i$12 = $10;$s$01 = $$lcssa;
    label = 5;
   }
  }
 }
 return ($s$0$lcssa|0);
}
function _pad($f,$c,$w,$l,$fl) {
 $f = $f|0;
 $c = $c|0;
 $w = $w|0;
 $l = $l|0;
 $fl = $fl|0;
 var $$0$lcssa6 = 0, $$02 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $or$cond = 0, $pad = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $pad = sp;
 $0 = $fl & 73728;
 $1 = ($0|0)==(0);
 $2 = ($w|0)>($l|0);
 $or$cond = $2 & $1;
 do {
  if ($or$cond) {
   $3 = (($w) - ($l))|0;
   $4 = ($3>>>0)>(256);
   $5 = $4 ? 256 : $3;
   _memset(($pad|0),($c|0),($5|0))|0;
   $6 = ($3>>>0)>(255);
   $7 = HEAP32[$f>>2]|0;
   $8 = $7 & 32;
   $9 = ($8|0)==(0);
   if ($6) {
    $10 = (($w) - ($l))|0;
    $$02 = $3;$17 = $7;$18 = $9;
    while(1) {
     if ($18) {
      (___fwritex($pad,256,$f)|0);
      $$pre = HEAP32[$f>>2]|0;
      $14 = $$pre;
     } else {
      $14 = $17;
     }
     $11 = (($$02) + -256)|0;
     $12 = ($11>>>0)>(255);
     $13 = $14 & 32;
     $15 = ($13|0)==(0);
     if ($12) {
      $$02 = $11;$17 = $14;$18 = $15;
     } else {
      break;
     }
    }
    $16 = $10 & 255;
    if ($15) {
     $$0$lcssa6 = $16;
    } else {
     break;
    }
   } else {
    if ($9) {
     $$0$lcssa6 = $3;
    } else {
     break;
    }
   }
   (___fwritex($pad,$$0$lcssa6,$f)|0);
  }
 } while(0);
 STACKTOP = sp;return;
}
function _wctomb($s,$wc) {
 $s = $s|0;
 $wc = $wc|0;
 var $$0 = 0, $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($s|0)==(0|0);
 if ($0) {
  $$0 = 0;
 } else {
  $1 = (_wcrtomb($s,$wc,0)|0);
  $$0 = $1;
 }
 return ($$0|0);
}
function _wcrtomb($s,$wc,$st) {
 $s = $s|0;
 $wc = $wc|0;
 $st = $st|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($s|0)==(0|0);
 do {
  if ($0) {
   $$0 = 1;
  } else {
   $1 = ($wc>>>0)<(128);
   if ($1) {
    $2 = $wc&255;
    HEAP8[$s>>0] = $2;
    $$0 = 1;
    break;
   }
   $3 = ($wc>>>0)<(2048);
   if ($3) {
    $4 = $wc >>> 6;
    $5 = $4 | 192;
    $6 = $5&255;
    $7 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $6;
    $8 = $wc & 63;
    $9 = $8 | 128;
    $10 = $9&255;
    HEAP8[$7>>0] = $10;
    $$0 = 2;
    break;
   }
   $11 = ($wc>>>0)<(55296);
   $12 = $wc & -8192;
   $13 = ($12|0)==(57344);
   $or$cond = $11 | $13;
   if ($or$cond) {
    $14 = $wc >>> 12;
    $15 = $14 | 224;
    $16 = $15&255;
    $17 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $16;
    $18 = $wc >>> 6;
    $19 = $18 & 63;
    $20 = $19 | 128;
    $21 = $20&255;
    $22 = ((($s)) + 2|0);
    HEAP8[$17>>0] = $21;
    $23 = $wc & 63;
    $24 = $23 | 128;
    $25 = $24&255;
    HEAP8[$22>>0] = $25;
    $$0 = 3;
    break;
   }
   $26 = (($wc) + -65536)|0;
   $27 = ($26>>>0)<(1048576);
   if ($27) {
    $28 = $wc >>> 18;
    $29 = $28 | 240;
    $30 = $29&255;
    $31 = ((($s)) + 1|0);
    HEAP8[$s>>0] = $30;
    $32 = $wc >>> 12;
    $33 = $32 & 63;
    $34 = $33 | 128;
    $35 = $34&255;
    $36 = ((($s)) + 2|0);
    HEAP8[$31>>0] = $35;
    $37 = $wc >>> 6;
    $38 = $37 & 63;
    $39 = $38 | 128;
    $40 = $39&255;
    $41 = ((($s)) + 3|0);
    HEAP8[$36>>0] = $40;
    $42 = $wc & 63;
    $43 = $42 | 128;
    $44 = $43&255;
    HEAP8[$41>>0] = $44;
    $$0 = 4;
    break;
   } else {
    $45 = (___errno_location()|0);
    HEAP32[$45>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function _frexpl($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (+_frexp($x,$e));
 return (+$0);
}
function _frexp($x,$e) {
 $x = +$x;
 $e = $e|0;
 var $$0 = 0.0, $$01 = 0.0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $x;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 $2 = (_bitshift64Lshr(($0|0),($1|0),52)|0);
 $3 = tempRet0;
 $4 = $2 & 2047;
 switch ($4|0) {
 case 0:  {
  $5 = $x != 0.0;
  if ($5) {
   $6 = $x * 1.8446744073709552E+19;
   $7 = (+_frexp($6,$e));
   $8 = HEAP32[$e>>2]|0;
   $9 = (($8) + -64)|0;
   $$01 = $7;$storemerge = $9;
  } else {
   $$01 = $x;$storemerge = 0;
  }
  HEAP32[$e>>2] = $storemerge;
  $$0 = $$01;
  break;
 }
 case 2047:  {
  $$0 = $x;
  break;
 }
 default: {
  $10 = (($4) + -1022)|0;
  HEAP32[$e>>2] = $10;
  $11 = $1 & -2146435073;
  $12 = $11 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $0;HEAP32[tempDoublePtr+4>>2] = $12;$13 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $13;
 }
 }
 return (+$$0);
}
function ___lockfile($f) {
 $f = $f|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function _mbrtowc($wc,$src,$n,$st) {
 $wc = $wc|0;
 $src = $src|0;
 $n = $n|0;
 $st = $st|0;
 var $$0 = 0, $$024 = 0, $$1 = 0, $$lcssa = 0, $$lcssa35 = 0, $$st = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c$05 = 0, $c$1 = 0, $c$2 = 0, $dummy = 0, $dummy$wc = 0, $s$06 = 0, $s$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $dummy = sp;
 $0 = ($st|0)==(0|0);
 $$st = $0 ? 3320 : $st;
 $1 = HEAP32[$$st>>2]|0;
 $2 = ($src|0)==(0|0);
 L1: do {
  if ($2) {
   $3 = ($1|0)==(0);
   if ($3) {
    $$0 = 0;
   } else {
    label = 15;
   }
  } else {
   $4 = ($wc|0)==(0|0);
   $dummy$wc = $4 ? $dummy : $wc;
   $5 = ($n|0)==(0);
   if ($5) {
    $$0 = -2;
   } else {
    $6 = ($1|0)==(0);
    if ($6) {
     $7 = HEAP8[$src>>0]|0;
     $8 = $7&255;
     $9 = ($7<<24>>24)>(-1);
     if ($9) {
      HEAP32[$dummy$wc>>2] = $8;
      $10 = ($7<<24>>24)!=(0);
      $11 = $10&1;
      $$0 = $11;
      break;
     }
     $12 = (($8) + -194)|0;
     $13 = ($12>>>0)>(50);
     if ($13) {
      label = 15;
      break;
     }
     $14 = ((($src)) + 1|0);
     $15 = (40 + ($12<<2)|0);
     $16 = HEAP32[$15>>2]|0;
     $17 = (($n) + -1)|0;
     $18 = ($17|0)==(0);
     if ($18) {
      $c$2 = $16;
     } else {
      $$024 = $17;$c$05 = $16;$s$06 = $14;
      label = 9;
     }
    } else {
     $$024 = $n;$c$05 = $1;$s$06 = $src;
     label = 9;
    }
    L11: do {
     if ((label|0) == 9) {
      $19 = HEAP8[$s$06>>0]|0;
      $20 = $19&255;
      $21 = $20 >>> 3;
      $22 = (($21) + -16)|0;
      $23 = $c$05 >> 26;
      $24 = (($21) + ($23))|0;
      $25 = $22 | $24;
      $26 = ($25>>>0)>(7);
      if ($26) {
       label = 15;
       break L1;
      } else {
       $$1 = $$024;$30 = $19;$c$1 = $c$05;$s$1 = $s$06;
      }
      while(1) {
       $27 = $c$1 << 6;
       $28 = ((($s$1)) + 1|0);
       $29 = $30&255;
       $31 = (($29) + -128)|0;
       $32 = $31 | $27;
       $33 = (($$1) + -1)|0;
       $34 = ($32|0)<(0);
       if (!($34)) {
        $$lcssa = $32;$$lcssa35 = $33;
        break;
       }
       $36 = ($33|0)==(0);
       if ($36) {
        $c$2 = $32;
        break L11;
       }
       $37 = HEAP8[$28>>0]|0;
       $38 = $37 & -64;
       $39 = ($38<<24>>24)==(-128);
       if ($39) {
        $$1 = $33;$30 = $37;$c$1 = $32;$s$1 = $28;
       } else {
        label = 15;
        break L1;
       }
      }
      HEAP32[$$st>>2] = 0;
      HEAP32[$dummy$wc>>2] = $$lcssa;
      $35 = (($n) - ($$lcssa35))|0;
      $$0 = $35;
      break L1;
     }
    } while(0);
    HEAP32[$$st>>2] = $c$2;
    $$0 = -2;
   }
  }
 } while(0);
 if ((label|0) == 15) {
  HEAP32[$$st>>2] = 0;
  $40 = (___errno_location()|0);
  HEAP32[$40>>2] = 84;
  $$0 = -1;
 }
 STACKTOP = sp;return ($$0|0);
}
function _mbsinit($st) {
 $st = $st|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($st|0)==(0|0);
 if ($0) {
  $4 = 1;
 } else {
  $1 = HEAP32[$st>>2]|0;
  $2 = ($1|0)==(0);
  $4 = $2;
 }
 $3 = $4&1;
 return ($3|0);
}
function _sprintf($s,$fmt,$varargs) {
 $s = $s|0;
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $0 = 0, $ap = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $0 = (_vsprintf($s,$fmt,$ap)|0);
 STACKTOP = sp;return ($0|0);
}
function _vsprintf($s,$fmt,$ap) {
 $s = $s|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_vsnprintf($s,2147483647,$fmt,$ap)|0);
 return ($0|0);
}
function _sscanf($s,$fmt,$varargs) {
 $s = $s|0;
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $0 = 0, $ap = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $0 = (_vsscanf($s,$fmt,$ap)|0);
 STACKTOP = sp;return ($0|0);
}
function _vsscanf($s,$fmt,$ap) {
 $s = $s|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $f = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0;
 $f = sp;
 dest=$f; stop=dest+112|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $0 = ((($f)) + 32|0);
 HEAP32[$0>>2] = 5;
 $1 = ((($f)) + 44|0);
 HEAP32[$1>>2] = $s;
 $2 = ((($f)) + 76|0);
 HEAP32[$2>>2] = -1;
 $3 = ((($f)) + 84|0);
 HEAP32[$3>>2] = $s;
 $4 = (_vfscanf($f,$fmt,$ap)|0);
 STACKTOP = sp;return ($4|0);
}
function _do_read($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___string_read($f,$buf,$len)|0);
 return ($0|0);
}
function ___string_read($f,$buf,$len) {
 $f = $f|0;
 $buf = $buf|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $k$0 = 0, $k$0$len = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 84|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = (($len) + 256)|0;
 $3 = (_memchr($1,0,$2)|0);
 $4 = ($3|0)==(0|0);
 $5 = $3;
 $6 = $1;
 $7 = (($5) - ($6))|0;
 $k$0 = $4 ? $2 : $7;
 $8 = ($k$0>>>0)<($len>>>0);
 $k$0$len = $8 ? $k$0 : $len;
 _memcpy(($buf|0),($1|0),($k$0$len|0))|0;
 $9 = (($1) + ($k$0$len)|0);
 $10 = ((($f)) + 4|0);
 HEAP32[$10>>2] = $9;
 $11 = (($1) + ($k$0)|0);
 $12 = ((($f)) + 8|0);
 HEAP32[$12>>2] = $11;
 HEAP32[$0>>2] = $11;
 return ($k$0$len|0);
}
function _vfscanf($f,$fmt,$ap) {
 $f = $f|0;
 $fmt = $fmt|0;
 $ap = $ap|0;
 var $$ = 0, $$11 = 0, $$12 = 0, $$13 = 0, $$14 = 0, $$lcssa = 0, $$lcssa386 = 0, $$lcssa40 = 0, $$not = 0, $$old4 = 0, $$pre = 0, $$pre$phi184Z2D = 0, $$pre173 = 0, $$pre175 = 0, $$pre177 = 0, $$pre179 = 0, $$pre180 = 0, $$pre181 = 0, $$pre182 = 0, $$pre183 = 0;
 var $$size$0 = 0, $$width$0 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0;
 var $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0;
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0;
 var $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0;
 var $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0;
 var $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0;
 var $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0.0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0.0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $alloc$0 = 0, $alloc$0402 = 0, $alloc$1 = 0, $alloc$2 = 0, $ap2$i = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $base$0 = 0;
 var $c$0102 = 0, $dest$0 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $factor = 0, $factor18 = 0, $i$0$i = 0, $i$0$ph = 0, $i$0$ph$phi = 0, $i$0$ph22 = 0, $i$0$ph22$lcssa = 0, $i$1 = 0;
 var $i$2 = 0, $i$2$ph = 0, $i$2$ph$phi = 0, $i$3 = 0, $i$4 = 0, $invert$0 = 0, $isdigit = 0, $isdigit8 = 0, $isdigit897 = 0, $isdigittmp = 0, $isdigittmp7 = 0, $isdigittmp796 = 0, $k$0$ph = 0, $k$1$ph = 0, $matches$0$ = 0, $matches$0107 = 0, $matches$0107$lcssa = 0, $matches$0107371 = 0, $matches$1 = 0, $matches$2 = 0;
 var $matches$3 = 0, $not$ = 0, $or$cond = 0, $or$cond10 = 0, $or$cond3 = 0, $or$cond5 = 0, $p$0110 = 0, $p$1 = 0, $p$1$lcssa = 0, $p$10 = 0, $p$11 = 0, $p$2 = 0, $p$3$lcssa = 0, $p$398 = 0, $p$4 = 0, $p$5 = 0, $p$6 = 0, $p$7 = 0, $p$7$ph = 0, $p$8 = 0;
 var $p$9 = 0, $pos$0111 = 0, $pos$1 = 0, $pos$2 = 0, $s$0105 = 0, $s$0105$lcssa = 0, $s$1 = 0, $s$2$ph = 0, $s$4 = 0, $s$5 = 0, $s$6 = 0, $s$7 = 0, $s$8 = 0, $s$9 = 0, $scanset = 0, $size$0 = 0, $st = 0, $vacopy_currentptr = 0, $wc = 0, $wcs$0106 = 0;
 var $wcs$0106$lcssa = 0, $wcs$1 = 0, $wcs$10 = 0, $wcs$2 = 0, $wcs$3$ph = 0, $wcs$3$ph$lcssa = 0, $wcs$5 = 0, $wcs$6 = 0, $wcs$7 = 0, $wcs$8 = 0, $wcs$9 = 0, $width$0$lcssa = 0, $width$099 = 0, $width$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 304|0;
 $ap2$i = sp + 16|0;
 $st = sp + 8|0;
 $scanset = sp + 33|0;
 $wc = sp;
 $0 = sp + 32|0;
 $1 = ((($f)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  $4 = (___lockfile($f)|0);
  $326 = $4;
 } else {
  $326 = 0;
 }
 $5 = HEAP8[$fmt>>0]|0;
 $6 = ($5<<24>>24)==(0);
 L4: do {
  if ($6) {
   $matches$3 = 0;
  } else {
   $7 = ((($f)) + 4|0);
   $8 = ((($f)) + 100|0);
   $9 = ((($f)) + 108|0);
   $10 = ((($f)) + 8|0);
   $11 = ((($scanset)) + 10|0);
   $12 = ((($scanset)) + 33|0);
   $13 = ((($st)) + 4|0);
   $14 = ((($scanset)) + 46|0);
   $15 = ((($scanset)) + 94|0);
   $17 = $5;$matches$0107 = 0;$p$0110 = $fmt;$pos$0111 = 0;$s$0105 = 0;$wcs$0106 = 0;
   L6: while(1) {
    $16 = $17&255;
    $18 = (_isspace($16)|0);
    $19 = ($18|0)==(0);
    L8: do {
     if ($19) {
      $46 = HEAP8[$p$0110>>0]|0;
      $47 = ($46<<24>>24)==(37);
      L10: do {
       if ($47) {
        $48 = ((($p$0110)) + 1|0);
        $49 = HEAP8[$48>>0]|0;
        L12: do {
         switch ($49<<24>>24) {
         case 37:  {
          break L10;
          break;
         }
         case 42:  {
          $70 = ((($p$0110)) + 2|0);
          $dest$0 = 0;$p$2 = $70;
          break;
         }
         default: {
          $71 = $49&255;
          $isdigittmp = (($71) + -48)|0;
          $isdigit = ($isdigittmp>>>0)<(10);
          if ($isdigit) {
           $72 = ((($p$0110)) + 2|0);
           $73 = HEAP8[$72>>0]|0;
           $74 = ($73<<24>>24)==(36);
           if ($74) {
            $vacopy_currentptr = HEAP32[$ap>>2]|0;
            HEAP32[$ap2$i>>2] = $vacopy_currentptr;
            $i$0$i = $isdigittmp;
            while(1) {
             $75 = ($i$0$i>>>0)>(1);
             $arglist_current = HEAP32[$ap2$i>>2]|0;
             $76 = $arglist_current;
             $77 = ((0) + 4|0);
             $expanded4 = $77;
             $expanded = (($expanded4) - 1)|0;
             $78 = (($76) + ($expanded))|0;
             $79 = ((0) + 4|0);
             $expanded8 = $79;
             $expanded7 = (($expanded8) - 1)|0;
             $expanded6 = $expanded7 ^ -1;
             $80 = $78 & $expanded6;
             $81 = $80;
             $82 = HEAP32[$81>>2]|0;
             $arglist_next = ((($81)) + 4|0);
             HEAP32[$ap2$i>>2] = $arglist_next;
             $83 = (($i$0$i) + -1)|0;
             if ($75) {
              $i$0$i = $83;
             } else {
              $$lcssa = $82;
              break;
             }
            }
            $84 = ((($p$0110)) + 3|0);
            $dest$0 = $$lcssa;$p$2 = $84;
            break L12;
           }
          }
          $arglist_current2 = HEAP32[$ap>>2]|0;
          $85 = $arglist_current2;
          $86 = ((0) + 4|0);
          $expanded11 = $86;
          $expanded10 = (($expanded11) - 1)|0;
          $87 = (($85) + ($expanded10))|0;
          $88 = ((0) + 4|0);
          $expanded15 = $88;
          $expanded14 = (($expanded15) - 1)|0;
          $expanded13 = $expanded14 ^ -1;
          $89 = $87 & $expanded13;
          $90 = $89;
          $91 = HEAP32[$90>>2]|0;
          $arglist_next3 = ((($90)) + 4|0);
          HEAP32[$ap>>2] = $arglist_next3;
          $dest$0 = $91;$p$2 = $48;
         }
         }
        } while(0);
        $92 = HEAP8[$p$2>>0]|0;
        $93 = $92&255;
        $isdigittmp796 = (($93) + -48)|0;
        $isdigit897 = ($isdigittmp796>>>0)<(10);
        if ($isdigit897) {
         $97 = $93;$p$398 = $p$2;$width$099 = 0;
         while(1) {
          $94 = ($width$099*10)|0;
          $95 = (($94) + -48)|0;
          $96 = (($95) + ($97))|0;
          $98 = ((($p$398)) + 1|0);
          $99 = HEAP8[$98>>0]|0;
          $100 = $99&255;
          $isdigittmp7 = (($100) + -48)|0;
          $isdigit8 = ($isdigittmp7>>>0)<(10);
          if ($isdigit8) {
           $97 = $100;$p$398 = $98;$width$099 = $96;
          } else {
           $$lcssa40 = $99;$p$3$lcssa = $98;$width$0$lcssa = $96;
           break;
          }
         }
        } else {
         $$lcssa40 = $92;$p$3$lcssa = $p$2;$width$0$lcssa = 0;
        }
        $101 = ($$lcssa40<<24>>24)==(109);
        if ($101) {
         $102 = ($dest$0|0)!=(0|0);
         $103 = $102&1;
         $104 = ((($p$3$lcssa)) + 1|0);
         $$pre173 = HEAP8[$104>>0]|0;
         $107 = $$pre173;$alloc$0 = $103;$p$4 = $104;$s$1 = 0;$wcs$1 = 0;
        } else {
         $107 = $$lcssa40;$alloc$0 = 0;$p$4 = $p$3$lcssa;$s$1 = $s$0105;$wcs$1 = $wcs$0106;
        }
        $105 = ((($p$4)) + 1|0);
        $106 = $107&255;
        switch ($106|0) {
        case 104:  {
         $108 = HEAP8[$105>>0]|0;
         $109 = ($108<<24>>24)==(104);
         $110 = ((($p$4)) + 2|0);
         $$11 = $109 ? $110 : $105;
         $$12 = $109 ? -2 : -1;
         $p$5 = $$11;$size$0 = $$12;
         break;
        }
        case 108:  {
         $111 = HEAP8[$105>>0]|0;
         $112 = ($111<<24>>24)==(108);
         $113 = ((($p$4)) + 2|0);
         $$13 = $112 ? $113 : $105;
         $$14 = $112 ? 3 : 1;
         $p$5 = $$13;$size$0 = $$14;
         break;
        }
        case 106:  {
         $p$5 = $105;$size$0 = 3;
         break;
        }
        case 116: case 122:  {
         $p$5 = $105;$size$0 = 1;
         break;
        }
        case 76:  {
         $p$5 = $105;$size$0 = 2;
         break;
        }
        case 110: case 112: case 67: case 83: case 91: case 99: case 115: case 88: case 71: case 70: case 69: case 65: case 103: case 102: case 101: case 97: case 120: case 117: case 111: case 105: case 100:  {
         $p$5 = $p$4;$size$0 = 0;
         break;
        }
        default: {
         $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = $s$1;$wcs$8 = $wcs$1;
         label = 154;
         break L6;
        }
        }
        $114 = HEAP8[$p$5>>0]|0;
        $115 = $114&255;
        $116 = $115 & 47;
        $117 = ($116|0)==(3);
        $118 = $115 | 32;
        $$ = $117 ? $118 : $115;
        $$size$0 = $117 ? 1 : $size$0;
        switch ($$|0) {
        case 99:  {
         $119 = ($width$0$lcssa|0)<(1);
         $$width$0 = $119 ? 1 : $width$0$lcssa;
         $pos$1 = $pos$0111;$width$1 = $$width$0;
         break;
        }
        case 91:  {
         $pos$1 = $pos$0111;$width$1 = $width$0$lcssa;
         break;
        }
        case 110:  {
         $120 = ($pos$0111|0)<(0);
         $121 = $120 << 31 >> 31;
         $122 = ($dest$0|0)==(0|0);
         if ($122) {
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
         }
         switch ($$size$0|0) {
         case -2:  {
          $123 = $pos$0111&255;
          HEAP8[$dest$0>>0] = $123;
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
          break;
         }
         case -1:  {
          $124 = $pos$0111&65535;
          HEAP16[$dest$0>>1] = $124;
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
          break;
         }
         case 0:  {
          HEAP32[$dest$0>>2] = $pos$0111;
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
          break;
         }
         case 1:  {
          HEAP32[$dest$0>>2] = $pos$0111;
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
          break;
         }
         case 3:  {
          $125 = $dest$0;
          $126 = $125;
          HEAP32[$126>>2] = $pos$0111;
          $127 = (($125) + 4)|0;
          $128 = $127;
          HEAP32[$128>>2] = $121;
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
          break;
         }
         default: {
          $matches$1 = $matches$0107;$p$11 = $p$5;$pos$2 = $pos$0111;$s$6 = $s$1;$wcs$7 = $wcs$1;
          break L8;
         }
         }
         break;
        }
        default: {
         ___shlim($f,0);
         while(1) {
          $129 = HEAP32[$7>>2]|0;
          $130 = HEAP32[$8>>2]|0;
          $131 = ($129>>>0)<($130>>>0);
          if ($131) {
           $132 = ((($129)) + 1|0);
           HEAP32[$7>>2] = $132;
           $133 = HEAP8[$129>>0]|0;
           $134 = $133&255;
           $136 = $134;
          } else {
           $135 = (___shgetc($f)|0);
           $136 = $135;
          }
          $137 = (_isspace($136)|0);
          $138 = ($137|0)==(0);
          if ($138) {
           break;
          }
         }
         $139 = HEAP32[$8>>2]|0;
         $140 = ($139|0)==(0|0);
         if ($140) {
          $$pre175 = HEAP32[$7>>2]|0;
          $148 = $$pre175;
         } else {
          $141 = HEAP32[$7>>2]|0;
          $142 = ((($141)) + -1|0);
          HEAP32[$7>>2] = $142;
          $143 = $142;
          $148 = $143;
         }
         $144 = HEAP32[$9>>2]|0;
         $145 = HEAP32[$10>>2]|0;
         $146 = (($144) + ($pos$0111))|0;
         $147 = (($146) + ($148))|0;
         $149 = (($147) - ($145))|0;
         $pos$1 = $149;$width$1 = $width$0$lcssa;
        }
        }
        ___shlim($f,$width$1);
        $150 = HEAP32[$7>>2]|0;
        $151 = HEAP32[$8>>2]|0;
        $152 = ($150>>>0)<($151>>>0);
        if ($152) {
         $153 = ((($150)) + 1|0);
         HEAP32[$7>>2] = $153;
         $156 = $151;
        } else {
         $154 = (___shgetc($f)|0);
         $155 = ($154|0)<(0);
         if ($155) {
          $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = $s$1;$wcs$8 = $wcs$1;
          label = 154;
          break L6;
         }
         $$pre177 = HEAP32[$8>>2]|0;
         $156 = $$pre177;
        }
        $157 = ($156|0)==(0|0);
        if (!($157)) {
         $158 = HEAP32[$7>>2]|0;
         $159 = ((($158)) + -1|0);
         HEAP32[$7>>2] = $159;
        }
        L68: do {
         switch ($$|0) {
         case 91: case 99: case 115:  {
          $160 = ($$|0)==(99);
          $161 = $$ | 16;
          $162 = ($161|0)==(115);
          L70: do {
           if ($162) {
            $163 = ($$|0)==(115);
            _memset(($scanset|0),-1,257)|0;
            HEAP8[$scanset>>0] = 0;
            if ($163) {
             HEAP8[$12>>0] = 0;
             ;HEAP8[$11>>0]=0|0;HEAP8[$11+1>>0]=0|0;HEAP8[$11+2>>0]=0|0;HEAP8[$11+3>>0]=0|0;HEAP8[$11+4>>0]=0|0;
             $p$9 = $p$5;
            } else {
             $p$9 = $p$5;
            }
           } else {
            $164 = ((($p$5)) + 1|0);
            $165 = HEAP8[$164>>0]|0;
            $166 = ($165<<24>>24)==(94);
            $167 = ((($p$5)) + 2|0);
            $invert$0 = $166&1;
            $p$6 = $166 ? $167 : $164;
            $168 = $166&1;
            _memset(($scanset|0),($168|0),257)|0;
            HEAP8[$scanset>>0] = 0;
            $169 = HEAP8[$p$6>>0]|0;
            switch ($169<<24>>24) {
            case 45:  {
             $170 = ((($p$6)) + 1|0);
             $171 = $invert$0 ^ 1;
             $172 = $171&255;
             HEAP8[$14>>0] = $172;
             $$pre$phi184Z2D = $172;$p$7$ph = $170;
             break;
            }
            case 93:  {
             $173 = ((($p$6)) + 1|0);
             $174 = $invert$0 ^ 1;
             $175 = $174&255;
             HEAP8[$15>>0] = $175;
             $$pre$phi184Z2D = $175;$p$7$ph = $173;
             break;
            }
            default: {
             $$pre182 = $invert$0 ^ 1;
             $$pre183 = $$pre182&255;
             $$pre$phi184Z2D = $$pre183;$p$7$ph = $p$6;
            }
            }
            $p$7 = $p$7$ph;
            while(1) {
             $176 = HEAP8[$p$7>>0]|0;
             L81: do {
              switch ($176<<24>>24) {
              case 0:  {
               $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = $s$1;$wcs$8 = $wcs$1;
               label = 154;
               break L6;
               break;
              }
              case 93:  {
               $p$9 = $p$7;
               break L70;
               break;
              }
              case 45:  {
               $177 = ((($p$7)) + 1|0);
               $178 = HEAP8[$177>>0]|0;
               switch ($178<<24>>24) {
               case 93: case 0:  {
                $189 = 45;$p$8 = $p$7;
                break L81;
                break;
               }
               default: {
               }
               }
               $179 = ((($p$7)) + -1|0);
               $180 = HEAP8[$179>>0]|0;
               $181 = ($180&255)<($178&255);
               if ($181) {
                $182 = $180&255;
                $c$0102 = $182;
                while(1) {
                 $183 = (($c$0102) + 1)|0;
                 $184 = (($scanset) + ($183)|0);
                 HEAP8[$184>>0] = $$pre$phi184Z2D;
                 $185 = HEAP8[$177>>0]|0;
                 $186 = $185&255;
                 $187 = ($183|0)<($186|0);
                 if ($187) {
                  $c$0102 = $183;
                 } else {
                  $189 = $185;$p$8 = $177;
                  break;
                 }
                }
               } else {
                $189 = $178;$p$8 = $177;
               }
               break;
              }
              default: {
               $189 = $176;$p$8 = $p$7;
              }
              }
             } while(0);
             $188 = $189&255;
             $190 = (($188) + 1)|0;
             $191 = (($scanset) + ($190)|0);
             HEAP8[$191>>0] = $$pre$phi184Z2D;
             $192 = ((($p$8)) + 1|0);
             $p$7 = $192;
            }
           }
          } while(0);
          $193 = (($width$1) + 1)|0;
          $194 = $160 ? $193 : 31;
          $195 = ($$size$0|0)==(1);
          $196 = ($alloc$0|0)!=(0);
          L89: do {
           if ($195) {
            if ($196) {
             $197 = $194 << 2;
             $198 = (_malloc($197)|0);
             $199 = ($198|0)==(0|0);
             if ($199) {
              $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = 0;$wcs$8 = $198;
              label = 154;
              break L6;
             } else {
              $wcs$2 = $198;
             }
            } else {
             $wcs$2 = $dest$0;
            }
            HEAP32[$st>>2] = 0;
            HEAP32[$13>>2] = 0;
            $i$0$ph = 0;$k$0$ph = $194;$wcs$3$ph = $wcs$2;
            L95: while(1) {
             $200 = ($wcs$3$ph|0)==(0|0);
             $i$0$ph22 = $i$0$ph;
             while(1) {
              L99: while(1) {
               $201 = HEAP32[$7>>2]|0;
               $202 = HEAP32[$8>>2]|0;
               $203 = ($201>>>0)<($202>>>0);
               if ($203) {
                $204 = ((($201)) + 1|0);
                HEAP32[$7>>2] = $204;
                $205 = HEAP8[$201>>0]|0;
                $206 = $205&255;
                $209 = $206;
               } else {
                $207 = (___shgetc($f)|0);
                $209 = $207;
               }
               $208 = (($209) + 1)|0;
               $210 = (($scanset) + ($208)|0);
               $211 = HEAP8[$210>>0]|0;
               $212 = ($211<<24>>24)==(0);
               if ($212) {
                $i$0$ph22$lcssa = $i$0$ph22;$wcs$3$ph$lcssa = $wcs$3$ph;
                break L95;
               }
               $213 = $209&255;
               HEAP8[$0>>0] = $213;
               $214 = (_mbrtowc($wc,$0,1,$st)|0);
               switch ($214|0) {
               case -1:  {
                $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = 0;$wcs$8 = $wcs$3$ph;
                label = 154;
                break L6;
                break;
               }
               case -2:  {
                break;
               }
               default: {
                break L99;
               }
               }
              }
              if ($200) {
               $i$1 = $i$0$ph22;
              } else {
               $215 = HEAP32[$wc>>2]|0;
               $216 = (($i$0$ph22) + 1)|0;
               $217 = (($wcs$3$ph) + ($i$0$ph22<<2)|0);
               HEAP32[$217>>2] = $215;
               $i$1 = $216;
              }
              $218 = ($i$1|0)==($k$0$ph|0);
              $or$cond = $196 & $218;
              if ($or$cond) {
               break;
              } else {
               $i$0$ph22 = $i$1;
              }
             }
             $factor = $k$0$ph << 1;
             $219 = $factor | 1;
             $220 = $219 << 2;
             $221 = (_realloc($wcs$3$ph,$220)|0);
             $222 = ($221|0)==(0|0);
             if ($222) {
              $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = 0;$wcs$8 = $wcs$3$ph;
              label = 154;
              break L6;
             } else {
              $i$0$ph$phi = $k$0$ph;$k$0$ph = $219;$wcs$3$ph = $221;$i$0$ph = $i$0$ph$phi;
             }
            }
            $223 = (_mbsinit($st)|0);
            $224 = ($223|0)==(0);
            if ($224) {
             $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = 0;$wcs$8 = $wcs$3$ph$lcssa;
             label = 154;
             break L6;
            } else {
             $i$4 = $i$0$ph22$lcssa;$s$4 = 0;$wcs$5 = $wcs$3$ph$lcssa;
            }
           } else {
            if ($196) {
             $225 = (_malloc($194)|0);
             $226 = ($225|0)==(0|0);
             if ($226) {
              $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = 0;$wcs$8 = 0;
              label = 154;
              break L6;
             } else {
              $i$2$ph = 0;$k$1$ph = $194;$s$2$ph = $225;
             }
             while(1) {
              $i$2 = $i$2$ph;
              while(1) {
               $227 = HEAP32[$7>>2]|0;
               $228 = HEAP32[$8>>2]|0;
               $229 = ($227>>>0)<($228>>>0);
               if ($229) {
                $230 = ((($227)) + 1|0);
                HEAP32[$7>>2] = $230;
                $231 = HEAP8[$227>>0]|0;
                $232 = $231&255;
                $235 = $232;
               } else {
                $233 = (___shgetc($f)|0);
                $235 = $233;
               }
               $234 = (($235) + 1)|0;
               $236 = (($scanset) + ($234)|0);
               $237 = HEAP8[$236>>0]|0;
               $238 = ($237<<24>>24)==(0);
               if ($238) {
                $i$4 = $i$2;$s$4 = $s$2$ph;$wcs$5 = 0;
                break L89;
               }
               $239 = $235&255;
               $240 = (($i$2) + 1)|0;
               $241 = (($s$2$ph) + ($i$2)|0);
               HEAP8[$241>>0] = $239;
               $242 = ($240|0)==($k$1$ph|0);
               if ($242) {
                break;
               } else {
                $i$2 = $240;
               }
              }
              $factor18 = $k$1$ph << 1;
              $243 = $factor18 | 1;
              $244 = (_realloc($s$2$ph,$243)|0);
              $245 = ($244|0)==(0|0);
              if ($245) {
               $alloc$0402 = $alloc$0;$matches$0107371 = $matches$0107;$s$7 = $s$2$ph;$wcs$8 = 0;
               label = 154;
               break L6;
              } else {
               $i$2$ph$phi = $k$1$ph;$k$1$ph = $243;$s$2$ph = $244;$i$2$ph = $i$2$ph$phi;
              }
             }
            }
            $246 = ($dest$0|0)==(0|0);
            if ($246) {
             $264 = $156;
             while(1) {
              $262 = HEAP32[$7>>2]|0;
              $263 = ($262>>>0)<($264>>>0);
              if ($263) {
               $265 = ((($262)) + 1|0);
               HEAP32[$7>>2] = $265;
               $266 = HEAP8[$262>>0]|0;
               $267 = $266&255;
               $270 = $267;
              } else {
               $268 = (___shgetc($f)|0);
               $270 = $268;
              }
              $269 = (($270) + 1)|0;
              $271 = (($scanset) + ($269)|0);
              $272 = HEAP8[$271>>0]|0;
              $273 = ($272<<24>>24)==(0);
              if ($273) {
               $i$4 = 0;$s$4 = 0;$wcs$5 = 0;
               break L89;
              }
              $$pre180 = HEAP32[$8>>2]|0;
              $264 = $$pre180;
             }
            } else {
             $249 = $156;$i$3 = 0;
             while(1) {
              $247 = HEAP32[$7>>2]|0;
              $248 = ($247>>>0)<($249>>>0);
              if ($248) {
               $250 = ((($247)) + 1|0);
               HEAP32[$7>>2] = $250;
               $251 = HEAP8[$247>>0]|0;
               $252 = $251&255;
               $255 = $252;
              } else {
               $253 = (___shgetc($f)|0);
               $255 = $253;
              }
              $254 = (($255) + 1)|0;
              $256 = (($scanset) + ($254)|0);
              $257 = HEAP8[$256>>0]|0;
              $258 = ($257<<24>>24)==(0);
              if ($258) {
               $i$4 = $i$3;$s$4 = $dest$0;$wcs$5 = 0;
               break L89;
              }
              $259 = $255&255;
              $260 = (($i$3) + 1)|0;
              $261 = (($dest$0) + ($i$3)|0);
              HEAP8[$261>>0] = $259;
              $$pre179 = HEAP32[$8>>2]|0;
              $249 = $$pre179;$i$3 = $260;
             }
            }
           }
          } while(0);
          $274 = HEAP32[$8>>2]|0;
          $275 = ($274|0)==(0|0);
          if ($275) {
           $$pre181 = HEAP32[$7>>2]|0;
           $282 = $$pre181;
          } else {
           $276 = HEAP32[$7>>2]|0;
           $277 = ((($276)) + -1|0);
           HEAP32[$7>>2] = $277;
           $278 = $277;
           $282 = $278;
          }
          $279 = HEAP32[$9>>2]|0;
          $280 = HEAP32[$10>>2]|0;
          $281 = (($282) - ($280))|0;
          $283 = (($281) + ($279))|0;
          $284 = ($283|0)==(0);
          if ($284) {
           $alloc$2 = $alloc$0;$matches$2 = $matches$0107;$s$9 = $s$4;$wcs$10 = $wcs$5;
           break L6;
          }
          $$not = $160 ^ 1;
          $285 = ($283|0)==($width$1|0);
          $or$cond10 = $285 | $$not;
          if (!($or$cond10)) {
           $alloc$2 = $alloc$0;$matches$2 = $matches$0107;$s$9 = $s$4;$wcs$10 = $wcs$5;
           break L6;
          }
          do {
           if ($196) {
            if ($195) {
             HEAP32[$dest$0>>2] = $wcs$5;
             break;
            } else {
             HEAP32[$dest$0>>2] = $s$4;
             break;
            }
           }
          } while(0);
          if ($160) {
           $p$10 = $p$9;$s$5 = $s$4;$wcs$6 = $wcs$5;
          } else {
           $286 = ($wcs$5|0)==(0|0);
           if (!($286)) {
            $287 = (($wcs$5) + ($i$4<<2)|0);
            HEAP32[$287>>2] = 0;
           }
           $288 = ($s$4|0)==(0|0);
           if ($288) {
            $p$10 = $p$9;$s$5 = 0;$wcs$6 = $wcs$5;
            break L68;
           }
           $289 = (($s$4) + ($i$4)|0);
           HEAP8[$289>>0] = 0;
           $p$10 = $p$9;$s$5 = $s$4;$wcs$6 = $wcs$5;
          }
          break;
         }
         case 120: case 88: case 112:  {
          $base$0 = 16;
          label = 136;
          break;
         }
         case 111:  {
          $base$0 = 8;
          label = 136;
          break;
         }
         case 117: case 100:  {
          $base$0 = 10;
          label = 136;
          break;
         }
         case 105:  {
          $base$0 = 0;
          label = 136;
          break;
         }
         case 71: case 103: case 70: case 102: case 69: case 101: case 65: case 97:  {
          $307 = (+___floatscan($f,$$size$0,0));
          $308 = HEAP32[$9>>2]|0;
          $309 = HEAP32[$7>>2]|0;
          $310 = HEAP32[$10>>2]|0;
          $311 = (($310) - ($309))|0;
          $312 = ($308|0)==($311|0);
          if ($312) {
           $alloc$2 = $alloc$0;$matches$2 = $matches$0107;$s$9 = $s$1;$wcs$10 = $wcs$1;
           break L6;
          }
          $313 = ($dest$0|0)==(0|0);
          if ($313) {
           $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
          } else {
           switch ($$size$0|0) {
           case 0:  {
            $314 = $307;
            HEAPF32[$dest$0>>2] = $314;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L68;
            break;
           }
           case 1:  {
            HEAPF64[$dest$0>>3] = $307;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L68;
            break;
           }
           case 2:  {
            HEAPF64[$dest$0>>3] = $307;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L68;
            break;
           }
           default: {
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L68;
           }
           }
          }
          break;
         }
         default: {
          $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
         }
         }
        } while(0);
        L169: do {
         if ((label|0) == 136) {
          label = 0;
          $290 = (___intscan($f,$base$0,0,-1,-1)|0);
          $291 = tempRet0;
          $292 = HEAP32[$9>>2]|0;
          $293 = HEAP32[$7>>2]|0;
          $294 = HEAP32[$10>>2]|0;
          $295 = (($294) - ($293))|0;
          $296 = ($292|0)==($295|0);
          if ($296) {
           $alloc$2 = $alloc$0;$matches$2 = $matches$0107;$s$9 = $s$1;$wcs$10 = $wcs$1;
           break L6;
          }
          $297 = ($$|0)==(112);
          $298 = ($dest$0|0)!=(0|0);
          $or$cond3 = $298 & $297;
          if ($or$cond3) {
           $299 = $290;
           HEAP32[$dest$0>>2] = $299;
           $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
           break;
          }
          $300 = ($dest$0|0)==(0|0);
          if ($300) {
           $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
          } else {
           switch ($$size$0|0) {
           case -2:  {
            $301 = $290&255;
            HEAP8[$dest$0>>0] = $301;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
            break;
           }
           case -1:  {
            $302 = $290&65535;
            HEAP16[$dest$0>>1] = $302;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
            break;
           }
           case 0:  {
            HEAP32[$dest$0>>2] = $290;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
            break;
           }
           case 1:  {
            HEAP32[$dest$0>>2] = $290;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
            break;
           }
           case 3:  {
            $303 = $dest$0;
            $304 = $303;
            HEAP32[$304>>2] = $290;
            $305 = (($303) + 4)|0;
            $306 = $305;
            HEAP32[$306>>2] = $291;
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
            break;
           }
           default: {
            $p$10 = $p$5;$s$5 = $s$1;$wcs$6 = $wcs$1;
            break L169;
           }
           }
          }
         }
        } while(0);
        $315 = HEAP32[$9>>2]|0;
        $316 = HEAP32[$7>>2]|0;
        $317 = HEAP32[$10>>2]|0;
        $318 = (($315) + ($pos$1))|0;
        $319 = (($318) + ($316))|0;
        $320 = (($319) - ($317))|0;
        $not$ = ($dest$0|0)!=(0|0);
        $321 = $not$&1;
        $matches$0$ = (($321) + ($matches$0107))|0;
        $matches$1 = $matches$0$;$p$11 = $p$10;$pos$2 = $320;$s$6 = $s$5;$wcs$7 = $wcs$6;
        break L8;
       }
      } while(0);
      $50 = $47&1;
      $51 = (($p$0110) + ($50)|0);
      ___shlim($f,0);
      $52 = HEAP32[$7>>2]|0;
      $53 = HEAP32[$8>>2]|0;
      $54 = ($52>>>0)<($53>>>0);
      if ($54) {
       $55 = ((($52)) + 1|0);
       HEAP32[$7>>2] = $55;
       $56 = HEAP8[$52>>0]|0;
       $57 = $56&255;
       $61 = $57;
      } else {
       $58 = (___shgetc($f)|0);
       $61 = $58;
      }
      $59 = HEAP8[$51>>0]|0;
      $60 = $59&255;
      $62 = ($61|0)==($60|0);
      if (!($62)) {
       $$lcssa386 = $61;$matches$0107$lcssa = $matches$0107;$s$0105$lcssa = $s$0105;$wcs$0106$lcssa = $wcs$0106;
       label = 22;
       break L6;
      }
      $69 = (($pos$0111) + 1)|0;
      $matches$1 = $matches$0107;$p$11 = $51;$pos$2 = $69;$s$6 = $s$0105;$wcs$7 = $wcs$0106;
     } else {
      $p$1 = $p$0110;
      while(1) {
       $20 = ((($p$1)) + 1|0);
       $21 = HEAP8[$20>>0]|0;
       $22 = $21&255;
       $23 = (_isspace($22)|0);
       $24 = ($23|0)==(0);
       if ($24) {
        $p$1$lcssa = $p$1;
        break;
       } else {
        $p$1 = $20;
       }
      }
      ___shlim($f,0);
      while(1) {
       $25 = HEAP32[$7>>2]|0;
       $26 = HEAP32[$8>>2]|0;
       $27 = ($25>>>0)<($26>>>0);
       if ($27) {
        $28 = ((($25)) + 1|0);
        HEAP32[$7>>2] = $28;
        $29 = HEAP8[$25>>0]|0;
        $30 = $29&255;
        $32 = $30;
       } else {
        $31 = (___shgetc($f)|0);
        $32 = $31;
       }
       $33 = (_isspace($32)|0);
       $34 = ($33|0)==(0);
       if ($34) {
        break;
       }
      }
      $35 = HEAP32[$8>>2]|0;
      $36 = ($35|0)==(0|0);
      if ($36) {
       $$pre = HEAP32[$7>>2]|0;
       $44 = $$pre;
      } else {
       $37 = HEAP32[$7>>2]|0;
       $38 = ((($37)) + -1|0);
       HEAP32[$7>>2] = $38;
       $39 = $38;
       $44 = $39;
      }
      $40 = HEAP32[$9>>2]|0;
      $41 = HEAP32[$10>>2]|0;
      $42 = (($40) + ($pos$0111))|0;
      $43 = (($42) + ($44))|0;
      $45 = (($43) - ($41))|0;
      $matches$1 = $matches$0107;$p$11 = $p$1$lcssa;$pos$2 = $45;$s$6 = $s$0105;$wcs$7 = $wcs$0106;
     }
    } while(0);
    $322 = ((($p$11)) + 1|0);
    $323 = HEAP8[$322>>0]|0;
    $324 = ($323<<24>>24)==(0);
    if ($324) {
     $matches$3 = $matches$1;
     break L4;
    } else {
     $17 = $323;$matches$0107 = $matches$1;$p$0110 = $322;$pos$0111 = $pos$2;$s$0105 = $s$6;$wcs$0106 = $wcs$7;
    }
   }
   if ((label|0) == 22) {
    $63 = HEAP32[$8>>2]|0;
    $64 = ($63|0)==(0|0);
    if (!($64)) {
     $65 = HEAP32[$7>>2]|0;
     $66 = ((($65)) + -1|0);
     HEAP32[$7>>2] = $66;
    }
    $67 = ($$lcssa386|0)>(-1);
    $68 = ($matches$0107$lcssa|0)!=(0);
    $or$cond5 = $68 | $67;
    if ($or$cond5) {
     $matches$3 = $matches$0107$lcssa;
     break;
    } else {
     $alloc$1 = 0;$s$8 = $s$0105$lcssa;$wcs$9 = $wcs$0106$lcssa;
     label = 155;
    }
   }
   else if ((label|0) == 154) {
    $$old4 = ($matches$0107371|0)==(0);
    if ($$old4) {
     $alloc$1 = $alloc$0402;$s$8 = $s$7;$wcs$9 = $wcs$8;
     label = 155;
    } else {
     $alloc$2 = $alloc$0402;$matches$2 = $matches$0107371;$s$9 = $s$7;$wcs$10 = $wcs$8;
    }
   }
   if ((label|0) == 155) {
    $alloc$2 = $alloc$1;$matches$2 = -1;$s$9 = $s$8;$wcs$10 = $wcs$9;
   }
   $325 = ($alloc$2|0)==(0);
   if ($325) {
    $matches$3 = $matches$2;
   } else {
    _free($s$9);
    _free($wcs$10);
    $matches$3 = $matches$2;
   }
  }
 } while(0);
 $327 = ($326|0)==(0);
 if (!($327)) {
  ___unlockfile($f);
 }
 STACKTOP = sp;return ($matches$3|0);
}
function ___floatscan($f,$prec,$pok) {
 $f = $f|0;
 $prec = $prec|0;
 $pok = $pok|0;
 var $$$i = 0, $$0 = 0.0, $$010$i = 0, $$012$i = 0, $$07$i = 0, $$0710$i = 0, $$0711$i = 0, $$1$i = 0.0, $$111$be$i = 0, $$111$ph$i = 0, $$16$i = 0, $$2$i = 0, $$24$i = 0, $$3$be$i = 0, $$3$lcssa$i = 0, $$3112$i = 0, $$in = 0, $$k$0$i = 0, $$lcssa = 0, $$lcssa258 = 0;
 var $$lcssa258$lcssa = 0, $$lcssa259 = 0, $$lcssa259$lcssa = 0, $$lcssa265 = 0, $$lcssa266 = 0, $$lcssa267 = 0, $$lcssa277 = 0, $$lnz$0$i = 0, $$neg$i = 0, $$neg40$i = 0, $$not$i = 0, $$old8 = 0, $$pn$i = 0.0, $$pre$i = 0, $$pre$i17 = 0, $$pre$phi43$iZ2D = 0.0, $$pre42$i = 0.0, $$promoted$i = 0, $$sink$off0$i = 0, $0 = 0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0.0, $183 = 0.0, $184 = 0.0, $185 = 0.0, $186 = 0, $187 = 0, $188 = 0.0, $189 = 0.0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0.0, $21 = 0, $210 = 0.0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0.0, $259 = 0.0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0.0, $268 = 0.0, $269 = 0.0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0;
 var $28 = 0, $280 = 0.0, $281 = 0.0, $282 = 0.0, $283 = 0, $284 = 0, $285 = 0.0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0.0, $31 = 0, $310 = 0.0, $311 = 0.0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0.0, $318 = 0.0, $319 = 0.0, $32 = 0, $320 = 0.0, $321 = 0.0, $322 = 0.0, $323 = 0, $324 = 0, $325 = 0.0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0;
 var $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0;
 var $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0;
 var $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0;
 var $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0;
 var $423 = 0, $424 = 0.0, $425 = 0.0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0;
 var $441 = 0.0, $442 = 0.0, $443 = 0.0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0.0, $454 = 0.0, $455 = 0.0, $456 = 0, $457 = 0, $458 = 0, $459 = 0;
 var $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0.0, $466 = 0.0, $467 = 0.0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0;
 var $478 = 0, $479 = 0.0, $48 = 0, $480 = 0, $481 = 0.0, $482 = 0.0, $483 = 0, $484 = 0.0, $485 = 0, $486 = 0.0, $487 = 0.0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0.0, $492 = 0.0, $493 = 0, $494 = 0, $495 = 0;
 var $496 = 0, $497 = 0.0, $498 = 0.0, $499 = 0.0, $5 = 0, $50 = 0.0, $500 = 0, $501 = 0, $502 = 0, $503 = 0.0, $504 = 0.0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0.0, $510 = 0, $511 = 0, $512 = 0;
 var $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0.0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0;
 var $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0;
 var $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0;
 var $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0;
 var $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0;
 var $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0.0, $619 = 0, $62 = 0, $620 = 0;
 var $621 = 0, $622 = 0, $623 = 0.0, $624 = 0.0, $625 = 0.0, $626 = 0, $627 = 0.0, $628 = 0.0, $629 = 0.0, $63 = 0, $630 = 0.0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0;
 var $64 = 0, $640 = 0, $641 = 0.0, $642 = 0.0, $643 = 0.0, $644 = 0, $645 = 0.0, $646 = 0.0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0.0, $651 = 0.0, $652 = 0.0, $653 = 0.0, $654 = 0, $655 = 0, $656 = 0.0, $657 = 0;
 var $658 = 0.0, $659 = 0.0, $66 = 0, $660 = 0.0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0.0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0.0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0;
 var $676 = 0, $677 = 0.0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0.0, $683 = 0, $684 = 0, $685 = 0.0, $686 = 0.0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0;
 var $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0;
 var $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $a$0$lcssa161$i = 0, $a$093$i = 0, $a$1$i = 0, $a$1$i$lcssa = 0, $a$2$ph46$i = 0, $a$4$i = 0, $a$4$i$lcssa250 = 0, $a$4$i251 = 0, $a$4$ph$i = 0, $a$4$ph167$i = 0, $a$586$i = 0, $a$6$i = 0, $a$6$i$lcssa = 0, $a$6$i$lcssa$lcssa = 0, $bias$0$i = 0.0, $bias$0$i25 = 0.0, $bits$0$ph = 0, $brmerge$i28 = 0;
 var $c$0 = 0, $c$0$i = 0, $c$1$lcssa = 0, $c$1$ph$i = 0, $c$179 = 0, $c$2 = 0, $c$2$i = 0, $c$2$lcssa$i = 0, $c$377 = 0, $c$4 = 0, $c$5 = 0, $c$6 = 0, $carry$095$i = 0, $carry1$0$i = 0, $carry1$1$i = 0, $carry1$1$i$lcssa = 0, $carry1$1$i$lcssa$lcssa = 0, $carry4$089$i = 0, $cond$i = 0, $d$0$i = 0;
 var $denormal$0$i = 0, $denormal$1$i = 0, $denormal$2$i = 0, $e2$0$i19 = 0, $e2$0$ph$i = 0, $e2$1$i = 0, $e2$1$i248 = 0, $e2$1$ph$i = 0, $e2$1$ph166$i = 0, $e2$3$i = 0, $e2$4$i = 0, $emin$0$ph = 0, $exitcond151$i = 0, $frac$0$i = 0.0, $frac$1$i = 0.0, $frac$3$i = 0.0, $gotdig$0$i = 0, $gotdig$0$i$lcssa244 = 0, $gotdig$0$i12 = 0, $gotdig$0$i12$lcssa275 = 0;
 var $gotdig$2$i = 0, $gotdig$2$i$lcssa = 0, $gotdig$2$i13 = 0, $gotdig$3$i = 0, $gotdig$3$lcssa$i = 0, $gotdig$3108$i = 0, $gotdig$3108$i$lcssa = 0, $gotdig$4$i = 0, $gotrad$0$i = 0, $gotrad$0$i$lcssa = 0, $gotrad$0$i14 = 0, $gotrad$1$i = 0, $gotrad$1$lcssa$i = 0, $gotrad$1109$i = 0, $gotrad$2$i = 0, $gottail$0$i = 0, $gottail$1$i = 0, $gottail$2$i = 0, $i$0$lcssa = 0, $i$078 = 0;
 var $i$1 = 0, $i$276 = 0, $i$3 = 0, $i$4 = 0, $i$4$lcssa = 0, $j$0$lcssa$i = 0, $j$0111$i = 0, $j$0111$i$lcssa = 0, $j$075$i = 0, $j$076$i = 0, $j$077$i = 0, $j$2$i = 0, $j$3102$i = 0, $k$0$lcssa$i = 0, $k$0110$i = 0, $k$0110$i$lcssa = 0, $k$071$i = 0, $k$072$i = 0, $k$073$i = 0, $k$2$i = 0;
 var $k$3$i = 0, $k$494$i = 0, $k$5$i = 0, $k$5$in$i = 0, $k$5$z$2$i = 0, $k$687$i = 0, $lnz$0$lcssa$i = 0, $lnz$0107$i = 0, $lnz$0107$i$lcssa = 0, $lnz$065$i = 0, $lnz$066$i = 0, $lnz$067$i = 0, $lnz$2$i = 0, $or$cond = 0, $or$cond$i = 0, $or$cond$i16 = 0, $or$cond18$i = 0, $or$cond192$i = 0, $or$cond20$i = 0, $or$cond21$i = 0;
 var $or$cond22$i = 0, $or$cond25$i = 0, $or$cond26$i = 0, $or$cond3$i = 0, $or$cond4$i = 0, $or$cond5 = 0, $or$cond6$i = 0, $or$cond7 = 0, $or$cond9 = 0, $or$cond9$i = 0, $or$cond9$i27 = 0, $rp$0$lcssa162$i = 0, $rp$092$i = 0, $rp$1$i18 = 0, $rp$1$i18$lcssa = 0, $rp$2$ph44$i = 0, $rp$4$ph$i = 0, $rp$4$ph42$i = 0, $rp$585$i = 0, $rp$6$i = 0;
 var $rp$6$i$lcssa = 0, $rp$6$i$lcssa$lcssa = 0, $scale$0$i = 0.0, $scale$1$i = 0.0, $scale$2$i = 0.0, $sign$0 = 0, $storemerge$i = 0, $sum$i = 0, $x$0$i = 0, $x$0$i$lcssa = 0, $x$1$i = 0, $x$2$i = 0, $x$3$lcssa$i = 0, $x$324$i = 0, $x$4$lcssa$i = 0, $x$419$i = 0, $x$5$i = 0, $x$6$i = 0, $x$i = 0, $y$0$i = 0.0;
 var $y$0$i$lcssa = 0.0, $y$1$i = 0.0, $y$1$i24 = 0.0, $y$2$i = 0.0, $y$2$i26 = 0.0, $y$3$i = 0.0, $y$3$lcssa$i = 0.0, $y$320$i = 0.0, $y$4$i = 0.0, $y$5$i = 0.0, $z$0$i = 0, $z$1$i = 0, $z$1$ph45$i = 0, $z$10$1$i = 0, $z$10$i = 0, $z$2$i = 0, $z$3$i = 0, $z$3$i$lcssa = 0, $z$3$i$lcssa$lcssa = 0, $z$4$i = 0;
 var $z$6$ph$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 512|0;
 $x$i = sp;
 switch ($prec|0) {
 case 0:  {
  $bits$0$ph = 24;$emin$0$ph = -149;
  label = 4;
  break;
 }
 case 1:  {
  $bits$0$ph = 53;$emin$0$ph = -1074;
  label = 4;
  break;
 }
 case 2:  {
  $bits$0$ph = 53;$emin$0$ph = -1074;
  label = 4;
  break;
 }
 default: {
  $$0 = 0.0;
 }
 }
 L4: do {
  if ((label|0) == 4) {
   $0 = ((($f)) + 4|0);
   $1 = ((($f)) + 100|0);
   while(1) {
    $2 = HEAP32[$0>>2]|0;
    $3 = HEAP32[$1>>2]|0;
    $4 = ($2>>>0)<($3>>>0);
    if ($4) {
     $5 = ((($2)) + 1|0);
     HEAP32[$0>>2] = $5;
     $6 = HEAP8[$2>>0]|0;
     $7 = $6&255;
     $9 = $7;
    } else {
     $8 = (___shgetc($f)|0);
     $9 = $8;
    }
    $10 = (_isspace($9)|0);
    $11 = ($10|0)==(0);
    if ($11) {
     $$lcssa277 = $9;
     break;
    }
   }
   $12 = ($$lcssa277|0)==(45);
   L13: do {
    switch ($$lcssa277|0) {
    case 43: case 45:  {
     $13 = $12&1;
     $14 = $13 << 1;
     $15 = (1 - ($14))|0;
     $16 = HEAP32[$0>>2]|0;
     $17 = HEAP32[$1>>2]|0;
     $18 = ($16>>>0)<($17>>>0);
     if ($18) {
      $19 = ((($16)) + 1|0);
      HEAP32[$0>>2] = $19;
      $20 = HEAP8[$16>>0]|0;
      $21 = $20&255;
      $c$0 = $21;$sign$0 = $15;
      break L13;
     } else {
      $22 = (___shgetc($f)|0);
      $c$0 = $22;$sign$0 = $15;
      break L13;
     }
     break;
    }
    default: {
     $c$0 = $$lcssa277;$sign$0 = 1;
    }
    }
   } while(0);
   $c$179 = $c$0;$i$078 = 0;
   while(1) {
    $23 = $c$179 | 32;
    $24 = (3254 + ($i$078)|0);
    $25 = HEAP8[$24>>0]|0;
    $26 = $25 << 24 >> 24;
    $27 = ($23|0)==($26|0);
    if (!($27)) {
     $c$1$lcssa = $c$179;$i$0$lcssa = $i$078;
     break;
    }
    $28 = ($i$078>>>0)<(7);
    do {
     if ($28) {
      $29 = HEAP32[$0>>2]|0;
      $30 = HEAP32[$1>>2]|0;
      $31 = ($29>>>0)<($30>>>0);
      if ($31) {
       $32 = ((($29)) + 1|0);
       HEAP32[$0>>2] = $32;
       $33 = HEAP8[$29>>0]|0;
       $34 = $33&255;
       $c$2 = $34;
       break;
      } else {
       $35 = (___shgetc($f)|0);
       $c$2 = $35;
       break;
      }
     } else {
      $c$2 = $c$179;
     }
    } while(0);
    $36 = (($i$078) + 1)|0;
    $37 = ($36>>>0)<(8);
    if ($37) {
     $c$179 = $c$2;$i$078 = $36;
    } else {
     $c$1$lcssa = $c$2;$i$0$lcssa = $36;
     break;
    }
   }
   L29: do {
    switch ($i$0$lcssa|0) {
    case 8:  {
     break;
    }
    case 3:  {
     label = 23;
     break;
    }
    default: {
     $38 = ($i$0$lcssa>>>0)>(3);
     $39 = ($pok|0)!=(0);
     $or$cond5 = $39 & $38;
     if ($or$cond5) {
      $40 = ($i$0$lcssa|0)==(8);
      if ($40) {
       break L29;
      } else {
       label = 23;
       break L29;
      }
     }
     $53 = ($i$0$lcssa|0)==(0);
     L34: do {
      if ($53) {
       $c$377 = $c$1$lcssa;$i$276 = 0;
       while(1) {
        $54 = $c$377 | 32;
        $55 = (3263 + ($i$276)|0);
        $56 = HEAP8[$55>>0]|0;
        $57 = $56 << 24 >> 24;
        $58 = ($54|0)==($57|0);
        if (!($58)) {
         $c$5 = $c$377;$i$3 = $i$276;
         break L34;
        }
        $59 = ($i$276>>>0)<(2);
        do {
         if ($59) {
          $60 = HEAP32[$0>>2]|0;
          $61 = HEAP32[$1>>2]|0;
          $62 = ($60>>>0)<($61>>>0);
          if ($62) {
           $63 = ((($60)) + 1|0);
           HEAP32[$0>>2] = $63;
           $64 = HEAP8[$60>>0]|0;
           $65 = $64&255;
           $c$4 = $65;
           break;
          } else {
           $66 = (___shgetc($f)|0);
           $c$4 = $66;
           break;
          }
         } else {
          $c$4 = $c$377;
         }
        } while(0);
        $67 = (($i$276) + 1)|0;
        $68 = ($67>>>0)<(3);
        if ($68) {
         $c$377 = $c$4;$i$276 = $67;
        } else {
         $c$5 = $c$4;$i$3 = $67;
         break;
        }
       }
      } else {
       $c$5 = $c$1$lcssa;$i$3 = $i$0$lcssa;
      }
     } while(0);
     switch ($i$3|0) {
     case 3:  {
      $69 = HEAP32[$0>>2]|0;
      $70 = HEAP32[$1>>2]|0;
      $71 = ($69>>>0)<($70>>>0);
      if ($71) {
       $72 = ((($69)) + 1|0);
       HEAP32[$0>>2] = $72;
       $73 = HEAP8[$69>>0]|0;
       $74 = $73&255;
       $76 = $74;
      } else {
       $75 = (___shgetc($f)|0);
       $76 = $75;
      }
      $77 = ($76|0)==(40);
      if ($77) {
       $i$4 = 1;
      } else {
       $78 = HEAP32[$1>>2]|0;
       $79 = ($78|0)==(0|0);
       if ($79) {
        $$0 = nan;
        break L4;
       }
       $80 = HEAP32[$0>>2]|0;
       $81 = ((($80)) + -1|0);
       HEAP32[$0>>2] = $81;
       $$0 = nan;
       break L4;
      }
      while(1) {
       $82 = HEAP32[$0>>2]|0;
       $83 = HEAP32[$1>>2]|0;
       $84 = ($82>>>0)<($83>>>0);
       if ($84) {
        $85 = ((($82)) + 1|0);
        HEAP32[$0>>2] = $85;
        $86 = HEAP8[$82>>0]|0;
        $87 = $86&255;
        $90 = $87;
       } else {
        $88 = (___shgetc($f)|0);
        $90 = $88;
       }
       $89 = (($90) + -48)|0;
       $91 = ($89>>>0)<(10);
       $92 = (($90) + -65)|0;
       $93 = ($92>>>0)<(26);
       $or$cond = $91 | $93;
       if (!($or$cond)) {
        $94 = (($90) + -97)|0;
        $95 = ($94>>>0)<(26);
        $96 = ($90|0)==(95);
        $or$cond7 = $96 | $95;
        if (!($or$cond7)) {
         $$lcssa = $90;$i$4$lcssa = $i$4;
         break;
        }
       }
       $108 = (($i$4) + 1)|0;
       $i$4 = $108;
      }
      $97 = ($$lcssa|0)==(41);
      if ($97) {
       $$0 = nan;
       break L4;
      }
      $98 = HEAP32[$1>>2]|0;
      $99 = ($98|0)==(0|0);
      if (!($99)) {
       $100 = HEAP32[$0>>2]|0;
       $101 = ((($100)) + -1|0);
       HEAP32[$0>>2] = $101;
      }
      if (!($39)) {
       $103 = (___errno_location()|0);
       HEAP32[$103>>2] = 22;
       ___shlim($f,0);
       $$0 = 0.0;
       break L4;
      }
      $102 = ($i$4$lcssa|0)==(0);
      if ($102) {
       $$0 = nan;
       break L4;
      } else {
       $$in = $i$4$lcssa;
      }
      while(1) {
       $104 = (($$in) + -1)|0;
       if (!($99)) {
        $105 = HEAP32[$0>>2]|0;
        $106 = ((($105)) + -1|0);
        HEAP32[$0>>2] = $106;
       }
       $107 = ($104|0)==(0);
       if ($107) {
        $$0 = nan;
        break L4;
       } else {
        $$in = $104;
       }
      }
      break;
     }
     case 0:  {
      $114 = ($c$5|0)==(48);
      do {
       if ($114) {
        $115 = HEAP32[$0>>2]|0;
        $116 = HEAP32[$1>>2]|0;
        $117 = ($115>>>0)<($116>>>0);
        if ($117) {
         $118 = ((($115)) + 1|0);
         HEAP32[$0>>2] = $118;
         $119 = HEAP8[$115>>0]|0;
         $120 = $119&255;
         $123 = $120;
        } else {
         $121 = (___shgetc($f)|0);
         $123 = $121;
        }
        $122 = $123 | 32;
        $124 = ($122|0)==(120);
        if (!($124)) {
         $326 = HEAP32[$1>>2]|0;
         $327 = ($326|0)==(0|0);
         if ($327) {
          $c$6 = 48;
          break;
         }
         $328 = HEAP32[$0>>2]|0;
         $329 = ((($328)) + -1|0);
         HEAP32[$0>>2] = $329;
         $c$6 = 48;
         break;
        }
        $125 = HEAP32[$0>>2]|0;
        $126 = HEAP32[$1>>2]|0;
        $127 = ($125>>>0)<($126>>>0);
        if ($127) {
         $128 = ((($125)) + 1|0);
         HEAP32[$0>>2] = $128;
         $129 = HEAP8[$125>>0]|0;
         $130 = $129&255;
         $c$0$i = $130;$gotdig$0$i = 0;
        } else {
         $131 = (___shgetc($f)|0);
         $c$0$i = $131;$gotdig$0$i = 0;
        }
        L94: while(1) {
         switch ($c$0$i|0) {
         case 46:  {
          $gotdig$0$i$lcssa244 = $gotdig$0$i;
          label = 74;
          break L94;
          break;
         }
         case 48:  {
          break;
         }
         default: {
          $168 = 0;$170 = 0;$693 = 0;$694 = 0;$c$2$i = $c$0$i;$gotdig$2$i = $gotdig$0$i;$gotrad$0$i = 0;$gottail$0$i = 0;$scale$0$i = 1.0;$x$0$i = 0;$y$0$i = 0.0;
          break L94;
         }
         }
         $132 = HEAP32[$0>>2]|0;
         $133 = HEAP32[$1>>2]|0;
         $134 = ($132>>>0)<($133>>>0);
         if ($134) {
          $135 = ((($132)) + 1|0);
          HEAP32[$0>>2] = $135;
          $136 = HEAP8[$132>>0]|0;
          $137 = $136&255;
          $c$0$i = $137;$gotdig$0$i = 1;
          continue;
         } else {
          $138 = (___shgetc($f)|0);
          $c$0$i = $138;$gotdig$0$i = 1;
          continue;
         }
        }
        if ((label|0) == 74) {
         $139 = HEAP32[$0>>2]|0;
         $140 = HEAP32[$1>>2]|0;
         $141 = ($139>>>0)<($140>>>0);
         if ($141) {
          $142 = ((($139)) + 1|0);
          HEAP32[$0>>2] = $142;
          $143 = HEAP8[$139>>0]|0;
          $144 = $143&255;
          $c$1$ph$i = $144;
         } else {
          $145 = (___shgetc($f)|0);
          $c$1$ph$i = $145;
         }
         $146 = ($c$1$ph$i|0)==(48);
         if ($146) {
          $154 = 0;$155 = 0;
          while(1) {
           $147 = HEAP32[$0>>2]|0;
           $148 = HEAP32[$1>>2]|0;
           $149 = ($147>>>0)<($148>>>0);
           if ($149) {
            $150 = ((($147)) + 1|0);
            HEAP32[$0>>2] = $150;
            $151 = HEAP8[$147>>0]|0;
            $152 = $151&255;
            $158 = $152;
           } else {
            $153 = (___shgetc($f)|0);
            $158 = $153;
           }
           $156 = (_i64Add(($154|0),($155|0),-1,-1)|0);
           $157 = tempRet0;
           $159 = ($158|0)==(48);
           if ($159) {
            $154 = $156;$155 = $157;
           } else {
            $168 = 0;$170 = 0;$693 = $156;$694 = $157;$c$2$i = $158;$gotdig$2$i = 1;$gotrad$0$i = 1;$gottail$0$i = 0;$scale$0$i = 1.0;$x$0$i = 0;$y$0$i = 0.0;
            break;
           }
          }
         } else {
          $168 = 0;$170 = 0;$693 = 0;$694 = 0;$c$2$i = $c$1$ph$i;$gotdig$2$i = $gotdig$0$i$lcssa244;$gotrad$0$i = 1;$gottail$0$i = 0;$scale$0$i = 1.0;$x$0$i = 0;$y$0$i = 0.0;
         }
        }
        while(1) {
         $160 = (($c$2$i) + -48)|0;
         $161 = ($160>>>0)<(10);
         $$pre$i = $c$2$i | 32;
         if ($161) {
          label = 86;
         } else {
          $162 = (($$pre$i) + -97)|0;
          $163 = ($162>>>0)<(6);
          $164 = ($c$2$i|0)==(46);
          $or$cond6$i = $164 | $163;
          if (!($or$cond6$i)) {
           $212 = $693;$213 = $170;$215 = $694;$216 = $168;$c$2$lcssa$i = $c$2$i;$gotdig$2$i$lcssa = $gotdig$2$i;$gotrad$0$i$lcssa = $gotrad$0$i;$x$0$i$lcssa = $x$0$i;$y$0$i$lcssa = $y$0$i;
           break;
          }
          if ($164) {
           $165 = ($gotrad$0$i|0)==(0);
           if ($165) {
            $695 = $170;$696 = $168;$697 = $170;$698 = $168;$gotdig$3$i = $gotdig$2$i;$gotrad$1$i = 1;$gottail$2$i = $gottail$0$i;$scale$2$i = $scale$0$i;$x$2$i = $x$0$i;$y$2$i = $y$0$i;
           } else {
            $212 = $693;$213 = $170;$215 = $694;$216 = $168;$c$2$lcssa$i = 46;$gotdig$2$i$lcssa = $gotdig$2$i;$gotrad$0$i$lcssa = $gotrad$0$i;$x$0$i$lcssa = $x$0$i;$y$0$i$lcssa = $y$0$i;
            break;
           }
          } else {
           label = 86;
          }
         }
         if ((label|0) == 86) {
          label = 0;
          $166 = ($c$2$i|0)>(57);
          $167 = (($$pre$i) + -87)|0;
          $d$0$i = $166 ? $167 : $160;
          $169 = ($168|0)<(0);
          $171 = ($170>>>0)<(8);
          $172 = ($168|0)==(0);
          $173 = $172 & $171;
          $174 = $169 | $173;
          do {
           if ($174) {
            $175 = $x$0$i << 4;
            $176 = (($d$0$i) + ($175))|0;
            $gottail$1$i = $gottail$0$i;$scale$1$i = $scale$0$i;$x$1$i = $176;$y$1$i = $y$0$i;
           } else {
            $177 = ($168|0)<(0);
            $178 = ($170>>>0)<(14);
            $179 = ($168|0)==(0);
            $180 = $179 & $178;
            $181 = $177 | $180;
            if ($181) {
             $182 = (+($d$0$i|0));
             $183 = $scale$0$i * 0.0625;
             $184 = $183 * $182;
             $185 = $y$0$i + $184;
             $gottail$1$i = $gottail$0$i;$scale$1$i = $183;$x$1$i = $x$0$i;$y$1$i = $185;
             break;
            }
            $186 = ($d$0$i|0)==(0);
            $187 = ($gottail$0$i|0)!=(0);
            $or$cond$i = $187 | $186;
            if ($or$cond$i) {
             $gottail$1$i = $gottail$0$i;$scale$1$i = $scale$0$i;$x$1$i = $x$0$i;$y$1$i = $y$0$i;
            } else {
             $188 = $scale$0$i * 0.5;
             $189 = $y$0$i + $188;
             $gottail$1$i = 1;$scale$1$i = $scale$0$i;$x$1$i = $x$0$i;$y$1$i = $189;
            }
           }
          } while(0);
          $190 = (_i64Add(($170|0),($168|0),1,0)|0);
          $191 = tempRet0;
          $695 = $693;$696 = $694;$697 = $190;$698 = $191;$gotdig$3$i = 1;$gotrad$1$i = $gotrad$0$i;$gottail$2$i = $gottail$1$i;$scale$2$i = $scale$1$i;$x$2$i = $x$1$i;$y$2$i = $y$1$i;
         }
         $192 = HEAP32[$0>>2]|0;
         $193 = HEAP32[$1>>2]|0;
         $194 = ($192>>>0)<($193>>>0);
         if ($194) {
          $195 = ((($192)) + 1|0);
          HEAP32[$0>>2] = $195;
          $196 = HEAP8[$192>>0]|0;
          $197 = $196&255;
          $168 = $698;$170 = $697;$693 = $695;$694 = $696;$c$2$i = $197;$gotdig$2$i = $gotdig$3$i;$gotrad$0$i = $gotrad$1$i;$gottail$0$i = $gottail$2$i;$scale$0$i = $scale$2$i;$x$0$i = $x$2$i;$y$0$i = $y$2$i;
          continue;
         } else {
          $198 = (___shgetc($f)|0);
          $168 = $698;$170 = $697;$693 = $695;$694 = $696;$c$2$i = $198;$gotdig$2$i = $gotdig$3$i;$gotrad$0$i = $gotrad$1$i;$gottail$0$i = $gottail$2$i;$scale$0$i = $scale$2$i;$x$0$i = $x$2$i;$y$0$i = $y$2$i;
          continue;
         }
        }
        $199 = ($gotdig$2$i$lcssa|0)==(0);
        if ($199) {
         $200 = HEAP32[$1>>2]|0;
         $201 = ($200|0)==(0|0);
         if (!($201)) {
          $202 = HEAP32[$0>>2]|0;
          $203 = ((($202)) + -1|0);
          HEAP32[$0>>2] = $203;
         }
         $204 = ($pok|0)==(0);
         if ($204) {
          ___shlim($f,0);
         } else {
          if (!($201)) {
           $205 = HEAP32[$0>>2]|0;
           $206 = ((($205)) + -1|0);
           HEAP32[$0>>2] = $206;
           $207 = ($gotrad$0$i$lcssa|0)==(0);
           if (!($207)) {
            $208 = ((($205)) + -2|0);
            HEAP32[$0>>2] = $208;
           }
          }
         }
         $209 = (+($sign$0|0));
         $210 = $209 * 0.0;
         $$0 = $210;
         break L4;
        }
        $211 = ($gotrad$0$i$lcssa|0)==(0);
        $214 = $211 ? $213 : $212;
        $217 = $211 ? $216 : $215;
        $218 = ($216|0)<(0);
        $219 = ($213>>>0)<(8);
        $220 = ($216|0)==(0);
        $221 = $220 & $219;
        $222 = $218 | $221;
        if ($222) {
         $224 = $213;$225 = $216;$x$324$i = $x$0$i$lcssa;
         while(1) {
          $223 = $x$324$i << 4;
          $226 = (_i64Add(($224|0),($225|0),1,0)|0);
          $227 = tempRet0;
          $228 = ($227|0)<(0);
          $229 = ($226>>>0)<(8);
          $230 = ($227|0)==(0);
          $231 = $230 & $229;
          $232 = $228 | $231;
          if ($232) {
           $224 = $226;$225 = $227;$x$324$i = $223;
          } else {
           $x$3$lcssa$i = $223;
           break;
          }
         }
        } else {
         $x$3$lcssa$i = $x$0$i$lcssa;
        }
        $233 = $c$2$lcssa$i | 32;
        $234 = ($233|0)==(112);
        if ($234) {
         $235 = (_scanexp($f,$pok)|0);
         $236 = tempRet0;
         $237 = ($235|0)==(0);
         $238 = ($236|0)==(-2147483648);
         $239 = $237 & $238;
         if ($239) {
          $240 = ($pok|0)==(0);
          if ($240) {
           ___shlim($f,0);
           $$0 = 0.0;
           break L4;
          }
          $241 = HEAP32[$1>>2]|0;
          $242 = ($241|0)==(0|0);
          if ($242) {
           $253 = 0;$254 = 0;
          } else {
           $243 = HEAP32[$0>>2]|0;
           $244 = ((($243)) + -1|0);
           HEAP32[$0>>2] = $244;
           $253 = 0;$254 = 0;
          }
         } else {
          $253 = $235;$254 = $236;
         }
        } else {
         $245 = HEAP32[$1>>2]|0;
         $246 = ($245|0)==(0|0);
         if ($246) {
          $253 = 0;$254 = 0;
         } else {
          $247 = HEAP32[$0>>2]|0;
          $248 = ((($247)) + -1|0);
          HEAP32[$0>>2] = $248;
          $253 = 0;$254 = 0;
         }
        }
        $249 = (_bitshift64Shl(($214|0),($217|0),2)|0);
        $250 = tempRet0;
        $251 = (_i64Add(($249|0),($250|0),-32,-1)|0);
        $252 = tempRet0;
        $255 = (_i64Add(($251|0),($252|0),($253|0),($254|0))|0);
        $256 = tempRet0;
        $257 = ($x$3$lcssa$i|0)==(0);
        if ($257) {
         $258 = (+($sign$0|0));
         $259 = $258 * 0.0;
         $$0 = $259;
         break L4;
        }
        $260 = (0 - ($emin$0$ph))|0;
        $261 = ($256|0)>(0);
        $262 = ($255>>>0)>($260>>>0);
        $263 = ($256|0)==(0);
        $264 = $263 & $262;
        $265 = $261 | $264;
        if ($265) {
         $266 = (___errno_location()|0);
         HEAP32[$266>>2] = 34;
         $267 = (+($sign$0|0));
         $268 = $267 * 1.7976931348623157E+308;
         $269 = $268 * 1.7976931348623157E+308;
         $$0 = $269;
         break L4;
        }
        $270 = (($emin$0$ph) + -106)|0;
        $271 = ($270|0)<(0);
        $272 = $271 << 31 >> 31;
        $273 = ($256|0)<($272|0);
        $274 = ($255>>>0)<($270>>>0);
        $275 = ($256|0)==($272|0);
        $276 = $275 & $274;
        $277 = $273 | $276;
        if ($277) {
         $279 = (___errno_location()|0);
         HEAP32[$279>>2] = 34;
         $280 = (+($sign$0|0));
         $281 = $280 * 2.2250738585072014E-308;
         $282 = $281 * 2.2250738585072014E-308;
         $$0 = $282;
         break L4;
        }
        $278 = ($x$3$lcssa$i|0)>(-1);
        if ($278) {
         $288 = $255;$289 = $256;$x$419$i = $x$3$lcssa$i;$y$320$i = $y$0$i$lcssa;
         while(1) {
          $283 = !($y$320$i >= 0.5);
          $284 = $x$419$i << 1;
          $285 = $y$320$i + -1.0;
          $286 = $283&1;
          $287 = $286 | $284;
          $x$5$i = $287 ^ 1;
          $$pn$i = $283 ? $y$320$i : $285;
          $y$4$i = $y$320$i + $$pn$i;
          $290 = (_i64Add(($288|0),($289|0),-1,-1)|0);
          $291 = tempRet0;
          $292 = ($287|0)>(-1);
          if ($292) {
           $288 = $290;$289 = $291;$x$419$i = $x$5$i;$y$320$i = $y$4$i;
          } else {
           $297 = $290;$298 = $291;$x$4$lcssa$i = $x$5$i;$y$3$lcssa$i = $y$4$i;
           break;
          }
         }
        } else {
         $297 = $255;$298 = $256;$x$4$lcssa$i = $x$3$lcssa$i;$y$3$lcssa$i = $y$0$i$lcssa;
        }
        $293 = ($emin$0$ph|0)<(0);
        $294 = $293 << 31 >> 31;
        $295 = (_i64Subtract(32,0,($emin$0$ph|0),($294|0))|0);
        $296 = tempRet0;
        $299 = (_i64Add(($297|0),($298|0),($295|0),($296|0))|0);
        $300 = tempRet0;
        $301 = (0)>($300|0);
        $302 = ($bits$0$ph>>>0)>($299>>>0);
        $303 = (0)==($300|0);
        $304 = $303 & $302;
        $305 = $301 | $304;
        if ($305) {
         $306 = ($299|0)<(0);
         if ($306) {
          $$0710$i = 0;
          label = 127;
         } else {
          $$07$i = $299;
          label = 125;
         }
        } else {
         $$07$i = $bits$0$ph;
         label = 125;
        }
        if ((label|0) == 125) {
         $307 = ($$07$i|0)<(53);
         if ($307) {
          $$0710$i = $$07$i;
          label = 127;
         } else {
          $$pre42$i = (+($sign$0|0));
          $$0711$i = $$07$i;$$pre$phi43$iZ2D = $$pre42$i;$bias$0$i = 0.0;
         }
        }
        if ((label|0) == 127) {
         $308 = (84 - ($$0710$i))|0;
         $309 = (+_scalbn(1.0,$308));
         $310 = (+($sign$0|0));
         $311 = (+_copysignl($309,$310));
         $$0711$i = $$0710$i;$$pre$phi43$iZ2D = $310;$bias$0$i = $311;
        }
        $312 = ($$0711$i|0)<(32);
        $313 = $y$3$lcssa$i != 0.0;
        $or$cond4$i = $313 & $312;
        $314 = $x$4$lcssa$i & 1;
        $315 = ($314|0)==(0);
        $or$cond9$i = $315 & $or$cond4$i;
        $316 = $or$cond9$i&1;
        $x$6$i = (($316) + ($x$4$lcssa$i))|0;
        $y$5$i = $or$cond9$i ? 0.0 : $y$3$lcssa$i;
        $317 = (+($x$6$i>>>0));
        $318 = $$pre$phi43$iZ2D * $317;
        $319 = $bias$0$i + $318;
        $320 = $$pre$phi43$iZ2D * $y$5$i;
        $321 = $320 + $319;
        $322 = $321 - $bias$0$i;
        $323 = $322 != 0.0;
        if (!($323)) {
         $324 = (___errno_location()|0);
         HEAP32[$324>>2] = 34;
        }
        $325 = (+_scalbnl($322,$297));
        $$0 = $325;
        break L4;
       } else {
        $c$6 = $c$5;
       }
      } while(0);
      $sum$i = (($emin$0$ph) + ($bits$0$ph))|0;
      $330 = (0 - ($sum$i))|0;
      $$010$i = $c$6;$gotdig$0$i12 = 0;
      L184: while(1) {
       switch ($$010$i|0) {
       case 46:  {
        $gotdig$0$i12$lcssa275 = $gotdig$0$i12;
        label = 138;
        break L184;
        break;
       }
       case 48:  {
        break;
       }
       default: {
        $$2$i = $$010$i;$699 = 0;$700 = 0;$gotdig$2$i13 = $gotdig$0$i12;$gotrad$0$i14 = 0;
        break L184;
       }
       }
       $331 = HEAP32[$0>>2]|0;
       $332 = HEAP32[$1>>2]|0;
       $333 = ($331>>>0)<($332>>>0);
       if ($333) {
        $334 = ((($331)) + 1|0);
        HEAP32[$0>>2] = $334;
        $335 = HEAP8[$331>>0]|0;
        $336 = $335&255;
        $$010$i = $336;$gotdig$0$i12 = 1;
        continue;
       } else {
        $337 = (___shgetc($f)|0);
        $$010$i = $337;$gotdig$0$i12 = 1;
        continue;
       }
      }
      if ((label|0) == 138) {
       $338 = HEAP32[$0>>2]|0;
       $339 = HEAP32[$1>>2]|0;
       $340 = ($338>>>0)<($339>>>0);
       if ($340) {
        $341 = ((($338)) + 1|0);
        HEAP32[$0>>2] = $341;
        $342 = HEAP8[$338>>0]|0;
        $343 = $342&255;
        $$111$ph$i = $343;
       } else {
        $344 = (___shgetc($f)|0);
        $$111$ph$i = $344;
       }
       $345 = ($$111$ph$i|0)==(48);
       if ($345) {
        $346 = 0;$347 = 0;
        while(1) {
         $348 = (_i64Add(($346|0),($347|0),-1,-1)|0);
         $349 = tempRet0;
         $350 = HEAP32[$0>>2]|0;
         $351 = HEAP32[$1>>2]|0;
         $352 = ($350>>>0)<($351>>>0);
         if ($352) {
          $353 = ((($350)) + 1|0);
          HEAP32[$0>>2] = $353;
          $354 = HEAP8[$350>>0]|0;
          $355 = $354&255;
          $$111$be$i = $355;
         } else {
          $356 = (___shgetc($f)|0);
          $$111$be$i = $356;
         }
         $357 = ($$111$be$i|0)==(48);
         if ($357) {
          $346 = $348;$347 = $349;
         } else {
          $$2$i = $$111$be$i;$699 = $348;$700 = $349;$gotdig$2$i13 = 1;$gotrad$0$i14 = 1;
          break;
         }
        }
       } else {
        $$2$i = $$111$ph$i;$699 = 0;$700 = 0;$gotdig$2$i13 = $gotdig$0$i12$lcssa275;$gotrad$0$i14 = 1;
       }
      }
      HEAP32[$x$i>>2] = 0;
      $358 = (($$2$i) + -48)|0;
      $359 = ($358>>>0)<(10);
      $360 = ($$2$i|0)==(46);
      $361 = $360 | $359;
      L203: do {
       if ($361) {
        $362 = ((($x$i)) + 496|0);
        $$3112$i = $$2$i;$365 = 0;$366 = 0;$701 = $360;$702 = $358;$703 = $699;$704 = $700;$gotdig$3108$i = $gotdig$2$i13;$gotrad$1109$i = $gotrad$0$i14;$j$0111$i = 0;$k$0110$i = 0;$lnz$0107$i = 0;
        L205: while(1) {
         do {
          if ($701) {
           $cond$i = ($gotrad$1109$i|0)==(0);
           if ($cond$i) {
            $705 = $365;$706 = $366;$707 = $365;$708 = $366;$gotdig$4$i = $gotdig$3108$i;$gotrad$2$i = 1;$j$2$i = $j$0111$i;$k$2$i = $k$0110$i;$lnz$2$i = $lnz$0107$i;
           } else {
            $709 = $703;$710 = $704;$711 = $365;$712 = $366;$gotdig$3108$i$lcssa = $gotdig$3108$i;$j$0111$i$lcssa = $j$0111$i;$k$0110$i$lcssa = $k$0110$i;$lnz$0107$i$lcssa = $lnz$0107$i;
            break L205;
           }
          } else {
           $364 = ($k$0110$i|0)<(125);
           $367 = (_i64Add(($365|0),($366|0),1,0)|0);
           $368 = tempRet0;
           $369 = ($$3112$i|0)!=(48);
           if (!($364)) {
            if (!($369)) {
             $705 = $703;$706 = $704;$707 = $367;$708 = $368;$gotdig$4$i = $gotdig$3108$i;$gotrad$2$i = $gotrad$1109$i;$j$2$i = $j$0111$i;$k$2$i = $k$0110$i;$lnz$2$i = $lnz$0107$i;
             break;
            }
            $379 = HEAP32[$362>>2]|0;
            $380 = $379 | 1;
            HEAP32[$362>>2] = $380;
            $705 = $703;$706 = $704;$707 = $367;$708 = $368;$gotdig$4$i = $gotdig$3108$i;$gotrad$2$i = $gotrad$1109$i;$j$2$i = $j$0111$i;$k$2$i = $k$0110$i;$lnz$2$i = $lnz$0107$i;
            break;
           }
           $$lnz$0$i = $369 ? $367 : $lnz$0107$i;
           $370 = ($j$0111$i|0)==(0);
           $371 = (($x$i) + ($k$0110$i<<2)|0);
           if ($370) {
            $storemerge$i = $702;
           } else {
            $372 = HEAP32[$371>>2]|0;
            $373 = ($372*10)|0;
            $374 = (($$3112$i) + -48)|0;
            $375 = (($374) + ($373))|0;
            $storemerge$i = $375;
           }
           HEAP32[$371>>2] = $storemerge$i;
           $376 = (($j$0111$i) + 1)|0;
           $377 = ($376|0)==(9);
           $378 = $377&1;
           $$k$0$i = (($378) + ($k$0110$i))|0;
           $$16$i = $377 ? 0 : $376;
           $705 = $703;$706 = $704;$707 = $367;$708 = $368;$gotdig$4$i = 1;$gotrad$2$i = $gotrad$1109$i;$j$2$i = $$16$i;$k$2$i = $$k$0$i;$lnz$2$i = $$lnz$0$i;
          }
         } while(0);
         $381 = HEAP32[$0>>2]|0;
         $382 = HEAP32[$1>>2]|0;
         $383 = ($381>>>0)<($382>>>0);
         if ($383) {
          $384 = ((($381)) + 1|0);
          HEAP32[$0>>2] = $384;
          $385 = HEAP8[$381>>0]|0;
          $386 = $385&255;
          $$3$be$i = $386;
         } else {
          $387 = (___shgetc($f)|0);
          $$3$be$i = $387;
         }
         $388 = (($$3$be$i) + -48)|0;
         $389 = ($388>>>0)<(10);
         $390 = ($$3$be$i|0)==(46);
         $391 = $390 | $389;
         if ($391) {
          $$3112$i = $$3$be$i;$365 = $707;$366 = $708;$701 = $390;$702 = $388;$703 = $705;$704 = $706;$gotdig$3108$i = $gotdig$4$i;$gotrad$1109$i = $gotrad$2$i;$j$0111$i = $j$2$i;$k$0110$i = $k$2$i;$lnz$0107$i = $lnz$2$i;
         } else {
          $$3$lcssa$i = $$3$be$i;$393 = $705;$394 = $707;$396 = $706;$397 = $708;$gotdig$3$lcssa$i = $gotdig$4$i;$gotrad$1$lcssa$i = $gotrad$2$i;$j$0$lcssa$i = $j$2$i;$k$0$lcssa$i = $k$2$i;$lnz$0$lcssa$i = $lnz$2$i;
          label = 161;
          break L203;
         }
        }
        $363 = ($gotdig$3108$i$lcssa|0)!=(0);
        $713 = $711;$714 = $712;$715 = $709;$716 = $710;$717 = $363;$j$077$i = $j$0111$i$lcssa;$k$073$i = $k$0110$i$lcssa;$lnz$067$i = $lnz$0107$i$lcssa;
        label = 169;
       } else {
        $$3$lcssa$i = $$2$i;$393 = $699;$394 = 0;$396 = $700;$397 = 0;$gotdig$3$lcssa$i = $gotdig$2$i13;$gotrad$1$lcssa$i = $gotrad$0$i14;$j$0$lcssa$i = 0;$k$0$lcssa$i = 0;$lnz$0$lcssa$i = 0;
        label = 161;
       }
      } while(0);
      do {
       if ((label|0) == 161) {
        $392 = ($gotrad$1$lcssa$i|0)==(0);
        $395 = $392 ? $394 : $393;
        $398 = $392 ? $397 : $396;
        $399 = ($gotdig$3$lcssa$i|0)!=(0);
        $400 = $$3$lcssa$i | 32;
        $401 = ($400|0)==(101);
        $or$cond18$i = $401 & $399;
        if (!($or$cond18$i)) {
         $416 = ($$3$lcssa$i|0)>(-1);
         if ($416) {
          $713 = $394;$714 = $397;$715 = $395;$716 = $398;$717 = $399;$j$077$i = $j$0$lcssa$i;$k$073$i = $k$0$lcssa$i;$lnz$067$i = $lnz$0$lcssa$i;
          label = 169;
          break;
         } else {
          $718 = $394;$719 = $397;$720 = $399;$721 = $395;$722 = $398;$j$076$i = $j$0$lcssa$i;$k$072$i = $k$0$lcssa$i;$lnz$066$i = $lnz$0$lcssa$i;
          label = 171;
          break;
         }
        }
        $402 = (_scanexp($f,$pok)|0);
        $403 = tempRet0;
        $404 = ($402|0)==(0);
        $405 = ($403|0)==(-2147483648);
        $406 = $404 & $405;
        if ($406) {
         $407 = ($pok|0)==(0);
         if ($407) {
          ___shlim($f,0);
          $$1$i = 0.0;
          break;
         }
         $408 = HEAP32[$1>>2]|0;
         $409 = ($408|0)==(0|0);
         if ($409) {
          $412 = 0;$413 = 0;
         } else {
          $410 = HEAP32[$0>>2]|0;
          $411 = ((($410)) + -1|0);
          HEAP32[$0>>2] = $411;
          $412 = 0;$413 = 0;
         }
        } else {
         $412 = $402;$413 = $403;
        }
        $414 = (_i64Add(($412|0),($413|0),($395|0),($398|0))|0);
        $415 = tempRet0;
        $426 = $414;$428 = $394;$429 = $415;$431 = $397;$j$075$i = $j$0$lcssa$i;$k$071$i = $k$0$lcssa$i;$lnz$065$i = $lnz$0$lcssa$i;
        label = 173;
       }
      } while(0);
      if ((label|0) == 169) {
       $417 = HEAP32[$1>>2]|0;
       $418 = ($417|0)==(0|0);
       if ($418) {
        $718 = $713;$719 = $714;$720 = $717;$721 = $715;$722 = $716;$j$076$i = $j$077$i;$k$072$i = $k$073$i;$lnz$066$i = $lnz$067$i;
        label = 171;
       } else {
        $419 = HEAP32[$0>>2]|0;
        $420 = ((($419)) + -1|0);
        HEAP32[$0>>2] = $420;
        if ($717) {
         $426 = $715;$428 = $713;$429 = $716;$431 = $714;$j$075$i = $j$077$i;$k$071$i = $k$073$i;$lnz$065$i = $lnz$067$i;
         label = 173;
        } else {
         label = 172;
        }
       }
      }
      if ((label|0) == 171) {
       if ($720) {
        $426 = $721;$428 = $718;$429 = $722;$431 = $719;$j$075$i = $j$076$i;$k$071$i = $k$072$i;$lnz$065$i = $lnz$066$i;
        label = 173;
       } else {
        label = 172;
       }
      }
      do {
       if ((label|0) == 172) {
        $421 = (___errno_location()|0);
        HEAP32[$421>>2] = 22;
        ___shlim($f,0);
        $$1$i = 0.0;
       }
       else if ((label|0) == 173) {
        $422 = HEAP32[$x$i>>2]|0;
        $423 = ($422|0)==(0);
        if ($423) {
         $424 = (+($sign$0|0));
         $425 = $424 * 0.0;
         $$1$i = $425;
         break;
        }
        $427 = ($426|0)==($428|0);
        $430 = ($429|0)==($431|0);
        $432 = $427 & $430;
        $433 = ($431|0)<(0);
        $434 = ($428>>>0)<(10);
        $435 = ($431|0)==(0);
        $436 = $435 & $434;
        $437 = $433 | $436;
        $or$cond$i16 = $437 & $432;
        if ($or$cond$i16) {
         $438 = ($bits$0$ph>>>0)>(30);
         $439 = $422 >>> $bits$0$ph;
         $440 = ($439|0)==(0);
         $or$cond20$i = $438 | $440;
         if ($or$cond20$i) {
          $441 = (+($sign$0|0));
          $442 = (+($422>>>0));
          $443 = $441 * $442;
          $$1$i = $443;
          break;
         }
        }
        $444 = (($emin$0$ph|0) / -2)&-1;
        $445 = ($444|0)<(0);
        $446 = $445 << 31 >> 31;
        $447 = ($429|0)>($446|0);
        $448 = ($426>>>0)>($444>>>0);
        $449 = ($429|0)==($446|0);
        $450 = $449 & $448;
        $451 = $447 | $450;
        if ($451) {
         $452 = (___errno_location()|0);
         HEAP32[$452>>2] = 34;
         $453 = (+($sign$0|0));
         $454 = $453 * 1.7976931348623157E+308;
         $455 = $454 * 1.7976931348623157E+308;
         $$1$i = $455;
         break;
        }
        $456 = (($emin$0$ph) + -106)|0;
        $457 = ($456|0)<(0);
        $458 = $457 << 31 >> 31;
        $459 = ($429|0)<($458|0);
        $460 = ($426>>>0)<($456>>>0);
        $461 = ($429|0)==($458|0);
        $462 = $461 & $460;
        $463 = $459 | $462;
        if ($463) {
         $464 = (___errno_location()|0);
         HEAP32[$464>>2] = 34;
         $465 = (+($sign$0|0));
         $466 = $465 * 2.2250738585072014E-308;
         $467 = $466 * 2.2250738585072014E-308;
         $$1$i = $467;
         break;
        }
        $468 = ($j$075$i|0)==(0);
        if ($468) {
         $k$3$i = $k$071$i;
        } else {
         $469 = ($j$075$i|0)<(9);
         if ($469) {
          $470 = (($x$i) + ($k$071$i<<2)|0);
          $$promoted$i = HEAP32[$470>>2]|0;
          $472 = $$promoted$i;$j$3102$i = $j$075$i;
          while(1) {
           $471 = ($472*10)|0;
           $473 = (($j$3102$i) + 1)|0;
           $exitcond151$i = ($473|0)==(9);
           if ($exitcond151$i) {
            $$lcssa267 = $471;
            break;
           } else {
            $472 = $471;$j$3102$i = $473;
           }
          }
          HEAP32[$470>>2] = $$lcssa267;
         }
         $474 = (($k$071$i) + 1)|0;
         $k$3$i = $474;
        }
        $475 = ($lnz$065$i|0)<(9);
        if ($475) {
         $476 = ($lnz$065$i|0)<=($426|0);
         $477 = ($426|0)<(18);
         $or$cond3$i = $476 & $477;
         if ($or$cond3$i) {
          $478 = ($426|0)==(9);
          if ($478) {
           $479 = (+($sign$0|0));
           $480 = HEAP32[$x$i>>2]|0;
           $481 = (+($480>>>0));
           $482 = $479 * $481;
           $$1$i = $482;
           break;
          }
          $483 = ($426|0)<(9);
          if ($483) {
           $484 = (+($sign$0|0));
           $485 = HEAP32[$x$i>>2]|0;
           $486 = (+($485>>>0));
           $487 = $484 * $486;
           $488 = (8 - ($426))|0;
           $489 = (476 + ($488<<2)|0);
           $490 = HEAP32[$489>>2]|0;
           $491 = (+($490|0));
           $492 = $487 / $491;
           $$1$i = $492;
           break;
          }
          $$neg$i = Math_imul($426, -3)|0;
          $$neg40$i = (($bits$0$ph) + 27)|0;
          $493 = (($$neg40$i) + ($$neg$i))|0;
          $494 = ($493|0)>(30);
          $$pre$i17 = HEAP32[$x$i>>2]|0;
          $495 = $$pre$i17 >>> $493;
          $496 = ($495|0)==(0);
          $or$cond192$i = $494 | $496;
          if ($or$cond192$i) {
           $497 = (+($sign$0|0));
           $498 = (+($$pre$i17>>>0));
           $499 = $497 * $498;
           $500 = (($426) + -10)|0;
           $501 = (476 + ($500<<2)|0);
           $502 = HEAP32[$501>>2]|0;
           $503 = (+($502|0));
           $504 = $499 * $503;
           $$1$i = $504;
           break;
          }
         }
        }
        $505 = (($426|0) % 9)&-1;
        $506 = ($505|0)==(0);
        if ($506) {
         $a$2$ph46$i = 0;$e2$0$ph$i = 0;$rp$2$ph44$i = $426;$z$1$ph45$i = $k$3$i;
        } else {
         $507 = ($426|0)>(-1);
         $508 = (($505) + 9)|0;
         $509 = $507 ? $505 : $508;
         $510 = (8 - ($509))|0;
         $511 = (476 + ($510<<2)|0);
         $512 = HEAP32[$511>>2]|0;
         $513 = ($k$3$i|0)==(0);
         if ($513) {
          $a$0$lcssa161$i = 0;$rp$0$lcssa162$i = $426;$z$0$i = 0;
         } else {
          $514 = (1000000000 / ($512|0))&-1;
          $a$093$i = 0;$carry$095$i = 0;$k$494$i = 0;$rp$092$i = $426;
          while(1) {
           $515 = (($x$i) + ($k$494$i<<2)|0);
           $516 = HEAP32[$515>>2]|0;
           $517 = (($516>>>0) % ($512>>>0))&-1;
           $518 = (($516>>>0) / ($512>>>0))&-1;
           $519 = (($518) + ($carry$095$i))|0;
           HEAP32[$515>>2] = $519;
           $520 = Math_imul($517, $514)|0;
           $521 = ($k$494$i|0)==($a$093$i|0);
           $522 = ($519|0)==(0);
           $or$cond21$i = $521 & $522;
           $523 = (($k$494$i) + 1)|0;
           $524 = $523 & 127;
           $525 = (($rp$092$i) + -9)|0;
           $rp$1$i18 = $or$cond21$i ? $525 : $rp$092$i;
           $a$1$i = $or$cond21$i ? $524 : $a$093$i;
           $526 = ($523|0)==($k$3$i|0);
           if ($526) {
            $$lcssa266 = $520;$a$1$i$lcssa = $a$1$i;$rp$1$i18$lcssa = $rp$1$i18;
            break;
           } else {
            $a$093$i = $a$1$i;$carry$095$i = $520;$k$494$i = $523;$rp$092$i = $rp$1$i18;
           }
          }
          $527 = ($$lcssa266|0)==(0);
          if ($527) {
           $a$0$lcssa161$i = $a$1$i$lcssa;$rp$0$lcssa162$i = $rp$1$i18$lcssa;$z$0$i = $k$3$i;
          } else {
           $528 = (($k$3$i) + 1)|0;
           $529 = (($x$i) + ($k$3$i<<2)|0);
           HEAP32[$529>>2] = $$lcssa266;
           $a$0$lcssa161$i = $a$1$i$lcssa;$rp$0$lcssa162$i = $rp$1$i18$lcssa;$z$0$i = $528;
          }
         }
         $530 = (9 - ($509))|0;
         $531 = (($530) + ($rp$0$lcssa162$i))|0;
         $a$2$ph46$i = $a$0$lcssa161$i;$e2$0$ph$i = 0;$rp$2$ph44$i = $531;$z$1$ph45$i = $z$0$i;
        }
        L284: while(1) {
         $532 = ($rp$2$ph44$i|0)<(18);
         $533 = ($rp$2$ph44$i|0)==(18);
         $534 = (($x$i) + ($a$2$ph46$i<<2)|0);
         $e2$0$i19 = $e2$0$ph$i;$z$1$i = $z$1$ph45$i;
         while(1) {
          if (!($532)) {
           if (!($533)) {
            $a$4$ph$i = $a$2$ph46$i;$e2$1$ph$i = $e2$0$i19;$rp$4$ph42$i = $rp$2$ph44$i;$z$6$ph$i = $z$1$i;
            break L284;
           }
           $535 = HEAP32[$534>>2]|0;
           $536 = ($535>>>0)<(9007199);
           if (!($536)) {
            $a$4$ph$i = $a$2$ph46$i;$e2$1$ph$i = $e2$0$i19;$rp$4$ph42$i = 18;$z$6$ph$i = $z$1$i;
            break L284;
           }
          }
          $537 = (($z$1$i) + 127)|0;
          $carry1$0$i = 0;$k$5$in$i = $537;$z$2$i = $z$1$i;
          while(1) {
           $k$5$i = $k$5$in$i & 127;
           $538 = (($x$i) + ($k$5$i<<2)|0);
           $539 = HEAP32[$538>>2]|0;
           $540 = (_bitshift64Shl(($539|0),0,29)|0);
           $541 = tempRet0;
           $542 = (_i64Add(($540|0),($541|0),($carry1$0$i|0),0)|0);
           $543 = tempRet0;
           $544 = ($543>>>0)>(0);
           $545 = ($542>>>0)>(1000000000);
           $546 = ($543|0)==(0);
           $547 = $546 & $545;
           $548 = $544 | $547;
           if ($548) {
            $549 = (___udivdi3(($542|0),($543|0),1000000000,0)|0);
            $550 = tempRet0;
            $551 = (___uremdi3(($542|0),($543|0),1000000000,0)|0);
            $552 = tempRet0;
            $$sink$off0$i = $551;$carry1$1$i = $549;
           } else {
            $$sink$off0$i = $542;$carry1$1$i = 0;
           }
           HEAP32[$538>>2] = $$sink$off0$i;
           $553 = (($z$2$i) + 127)|0;
           $554 = $553 & 127;
           $555 = ($k$5$i|0)!=($554|0);
           $556 = ($k$5$i|0)==($a$2$ph46$i|0);
           $or$cond22$i = $555 | $556;
           $557 = ($$sink$off0$i|0)==(0);
           $k$5$z$2$i = $557 ? $k$5$i : $z$2$i;
           $z$3$i = $or$cond22$i ? $z$2$i : $k$5$z$2$i;
           $558 = (($k$5$i) + -1)|0;
           if ($556) {
            $carry1$1$i$lcssa = $carry1$1$i;$z$3$i$lcssa = $z$3$i;
            break;
           } else {
            $carry1$0$i = $carry1$1$i;$k$5$in$i = $558;$z$2$i = $z$3$i;
           }
          }
          $559 = (($e2$0$i19) + -29)|0;
          $560 = ($carry1$1$i$lcssa|0)==(0);
          if ($560) {
           $e2$0$i19 = $559;$z$1$i = $z$3$i$lcssa;
          } else {
           $$lcssa265 = $559;$carry1$1$i$lcssa$lcssa = $carry1$1$i$lcssa;$z$3$i$lcssa$lcssa = $z$3$i$lcssa;
           break;
          }
         }
         $561 = (($rp$2$ph44$i) + 9)|0;
         $562 = (($a$2$ph46$i) + 127)|0;
         $563 = $562 & 127;
         $564 = ($563|0)==($z$3$i$lcssa$lcssa|0);
         if ($564) {
          $565 = (($z$3$i$lcssa$lcssa) + 127)|0;
          $566 = $565 & 127;
          $567 = (($x$i) + ($566<<2)|0);
          $568 = HEAP32[$567>>2]|0;
          $569 = (($z$3$i$lcssa$lcssa) + 126)|0;
          $570 = $569 & 127;
          $571 = (($x$i) + ($570<<2)|0);
          $572 = HEAP32[$571>>2]|0;
          $573 = $572 | $568;
          HEAP32[$571>>2] = $573;
          $z$4$i = $566;
         } else {
          $z$4$i = $z$3$i$lcssa$lcssa;
         }
         $574 = (($x$i) + ($563<<2)|0);
         HEAP32[$574>>2] = $carry1$1$i$lcssa$lcssa;
         $a$2$ph46$i = $563;$e2$0$ph$i = $$lcssa265;$rp$2$ph44$i = $561;$z$1$ph45$i = $z$4$i;
        }
        L302: while(1) {
         $605 = (($z$6$ph$i) + 1)|0;
         $602 = $605 & 127;
         $606 = (($z$6$ph$i) + 127)|0;
         $607 = $606 & 127;
         $608 = (($x$i) + ($607<<2)|0);
         $a$4$ph167$i = $a$4$ph$i;$e2$1$ph166$i = $e2$1$ph$i;$rp$4$ph$i = $rp$4$ph42$i;
         while(1) {
          $609 = ($rp$4$ph$i|0)==(18);
          $610 = ($rp$4$ph$i|0)>(27);
          $$24$i = $610 ? 9 : 1;
          $$not$i = $609 ^ 1;
          $a$4$i = $a$4$ph167$i;$e2$1$i = $e2$1$ph166$i;
          while(1) {
           $575 = $a$4$i & 127;
           $576 = ($575|0)==($z$6$ph$i|0);
           do {
            if ($576) {
             label = 219;
            } else {
             $577 = (($x$i) + ($575<<2)|0);
             $578 = HEAP32[$577>>2]|0;
             $579 = ($578>>>0)<(9007199);
             if ($579) {
              label = 219;
              break;
             }
             $580 = ($578>>>0)>(9007199);
             if ($580) {
              break;
             }
             $581 = (($a$4$i) + 1)|0;
             $582 = $581 & 127;
             $583 = ($582|0)==($z$6$ph$i|0);
             if ($583) {
              label = 219;
              break;
             }
             $689 = (($x$i) + ($582<<2)|0);
             $690 = HEAP32[$689>>2]|0;
             $691 = ($690>>>0)<(254740991);
             if ($691) {
              label = 219;
              break;
             }
             $692 = ($690>>>0)>(254740991);
             $brmerge$i28 = $692 | $$not$i;
             if (!($brmerge$i28)) {
              $616 = $575;$a$4$i251 = $a$4$i;$e2$1$i248 = $e2$1$i;$z$10$i = $z$6$ph$i;
              break L302;
             }
            }
           } while(0);
           if ((label|0) == 219) {
            label = 0;
            if ($609) {
             label = 220;
             break L302;
            }
           }
           $584 = (($e2$1$i) + ($$24$i))|0;
           $585 = ($a$4$i|0)==($z$6$ph$i|0);
           if ($585) {
            $a$4$i = $z$6$ph$i;$e2$1$i = $584;
           } else {
            $$lcssa258 = $584;$a$4$i$lcssa250 = $a$4$i;
            break;
           }
          }
          $586 = 1 << $$24$i;
          $587 = (($586) + -1)|0;
          $588 = 1000000000 >>> $$24$i;
          $a$586$i = $a$4$i$lcssa250;$carry4$089$i = 0;$k$687$i = $a$4$i$lcssa250;$rp$585$i = $rp$4$ph$i;
          while(1) {
           $589 = (($x$i) + ($k$687$i<<2)|0);
           $590 = HEAP32[$589>>2]|0;
           $591 = $590 & $587;
           $592 = $590 >>> $$24$i;
           $593 = (($592) + ($carry4$089$i))|0;
           HEAP32[$589>>2] = $593;
           $594 = Math_imul($591, $588)|0;
           $595 = ($k$687$i|0)==($a$586$i|0);
           $596 = ($593|0)==(0);
           $or$cond25$i = $595 & $596;
           $597 = (($k$687$i) + 1)|0;
           $598 = $597 & 127;
           $599 = (($rp$585$i) + -9)|0;
           $rp$6$i = $or$cond25$i ? $599 : $rp$585$i;
           $a$6$i = $or$cond25$i ? $598 : $a$586$i;
           $600 = ($598|0)==($z$6$ph$i|0);
           if ($600) {
            $$lcssa259 = $594;$a$6$i$lcssa = $a$6$i;$rp$6$i$lcssa = $rp$6$i;
            break;
           } else {
            $a$586$i = $a$6$i;$carry4$089$i = $594;$k$687$i = $598;$rp$585$i = $rp$6$i;
           }
          }
          $601 = ($$lcssa259|0)==(0);
          if ($601) {
           $a$4$ph167$i = $a$6$i$lcssa;$e2$1$ph166$i = $$lcssa258;$rp$4$ph$i = $rp$6$i$lcssa;
           continue;
          }
          $603 = ($602|0)==($a$6$i$lcssa|0);
          if (!($603)) {
           $$lcssa258$lcssa = $$lcssa258;$$lcssa259$lcssa = $$lcssa259;$a$6$i$lcssa$lcssa = $a$6$i$lcssa;$rp$6$i$lcssa$lcssa = $rp$6$i$lcssa;
           break;
          }
          $611 = HEAP32[$608>>2]|0;
          $612 = $611 | 1;
          HEAP32[$608>>2] = $612;
          $a$4$ph167$i = $a$6$i$lcssa;$e2$1$ph166$i = $$lcssa258;$rp$4$ph$i = $rp$6$i$lcssa;
         }
         $604 = (($x$i) + ($z$6$ph$i<<2)|0);
         HEAP32[$604>>2] = $$lcssa259$lcssa;
         $a$4$ph$i = $a$6$i$lcssa$lcssa;$e2$1$ph$i = $$lcssa258$lcssa;$rp$4$ph42$i = $rp$6$i$lcssa$lcssa;$z$6$ph$i = $602;
        }
        if ((label|0) == 220) {
         if ($576) {
          $613 = (($602) + -1)|0;
          $614 = (($x$i) + ($613<<2)|0);
          HEAP32[$614>>2] = 0;
          $616 = $z$6$ph$i;$a$4$i251 = $a$4$i;$e2$1$i248 = $e2$1$i;$z$10$i = $602;
         } else {
          $616 = $575;$a$4$i251 = $a$4$i;$e2$1$i248 = $e2$1$i;$z$10$i = $z$6$ph$i;
         }
        }
        $615 = (($x$i) + ($616<<2)|0);
        $617 = HEAP32[$615>>2]|0;
        $618 = (+($617>>>0));
        $619 = (($a$4$i251) + 1)|0;
        $620 = $619 & 127;
        $621 = ($620|0)==($z$10$i|0);
        if ($621) {
         $678 = (($a$4$i251) + 2)|0;
         $679 = $678 & 127;
         $680 = (($679) + -1)|0;
         $681 = (($x$i) + ($680<<2)|0);
         HEAP32[$681>>2] = 0;
         $z$10$1$i = $679;
        } else {
         $z$10$1$i = $z$10$i;
        }
        $682 = $618 * 1.0E+9;
        $683 = (($x$i) + ($620<<2)|0);
        $684 = HEAP32[$683>>2]|0;
        $685 = (+($684>>>0));
        $686 = $682 + $685;
        $642 = (+($sign$0|0));
        $624 = $642 * $686;
        $662 = (($e2$1$i248) + 53)|0;
        $668 = (($662) - ($emin$0$ph))|0;
        $669 = ($668|0)<($bits$0$ph|0);
        $687 = ($668|0)<(0);
        $$$i = $687 ? 0 : $668;
        $denormal$0$i = $669&1;
        $$012$i = $669 ? $$$i : $bits$0$ph;
        $688 = ($$012$i|0)<(53);
        if ($688) {
         $622 = (105 - ($$012$i))|0;
         $623 = (+_scalbn(1.0,$622));
         $625 = (+_copysignl($623,$624));
         $626 = (53 - ($$012$i))|0;
         $627 = (+_scalbn(1.0,$626));
         $628 = (+_fmodl($624,$627));
         $629 = $624 - $628;
         $630 = $625 + $629;
         $bias$0$i25 = $625;$frac$0$i = $628;$y$1$i24 = $630;
        } else {
         $bias$0$i25 = 0.0;$frac$0$i = 0.0;$y$1$i24 = $624;
        }
        $631 = (($a$4$i251) + 2)|0;
        $632 = $631 & 127;
        $633 = ($632|0)==($z$10$1$i|0);
        do {
         if ($633) {
          $frac$3$i = $frac$0$i;
         } else {
          $634 = (($x$i) + ($632<<2)|0);
          $635 = HEAP32[$634>>2]|0;
          $636 = ($635>>>0)<(500000000);
          do {
           if ($636) {
            $637 = ($635|0)==(0);
            if ($637) {
             $638 = (($a$4$i251) + 3)|0;
             $639 = $638 & 127;
             $640 = ($639|0)==($z$10$1$i|0);
             if ($640) {
              $frac$1$i = $frac$0$i;
              break;
             }
            }
            $641 = $642 * 0.25;
            $643 = $641 + $frac$0$i;
            $frac$1$i = $643;
           } else {
            $644 = ($635>>>0)>(500000000);
            if ($644) {
             $645 = $642 * 0.75;
             $646 = $645 + $frac$0$i;
             $frac$1$i = $646;
             break;
            }
            $647 = (($a$4$i251) + 3)|0;
            $648 = $647 & 127;
            $649 = ($648|0)==($z$10$1$i|0);
            if ($649) {
             $650 = $642 * 0.5;
             $651 = $650 + $frac$0$i;
             $frac$1$i = $651;
             break;
            } else {
             $652 = $642 * 0.75;
             $653 = $652 + $frac$0$i;
             $frac$1$i = $653;
             break;
            }
           }
          } while(0);
          $654 = (53 - ($$012$i))|0;
          $655 = ($654|0)>(1);
          if (!($655)) {
           $frac$3$i = $frac$1$i;
           break;
          }
          $656 = (+_fmodl($frac$1$i,1.0));
          $657 = $656 != 0.0;
          if ($657) {
           $frac$3$i = $frac$1$i;
           break;
          }
          $658 = $frac$1$i + 1.0;
          $frac$3$i = $658;
         }
        } while(0);
        $659 = $y$1$i24 + $frac$3$i;
        $660 = $659 - $bias$0$i25;
        $661 = $662 & 2147483647;
        $663 = (-2 - ($sum$i))|0;
        $664 = ($661|0)>($663|0);
        do {
         if ($664) {
          $665 = (+Math_abs((+$660)));
          $666 = !($665 >= 9007199254740992.0);
          if ($666) {
           $denormal$2$i = $denormal$0$i;$e2$3$i = $e2$1$i248;$y$2$i26 = $660;
          } else {
           $667 = ($$012$i|0)==($668|0);
           $or$cond26$i = $669 & $667;
           $denormal$1$i = $or$cond26$i ? 0 : $denormal$0$i;
           $670 = $660 * 0.5;
           $671 = (($e2$1$i248) + 1)|0;
           $denormal$2$i = $denormal$1$i;$e2$3$i = $671;$y$2$i26 = $670;
          }
          $672 = (($e2$3$i) + 50)|0;
          $673 = ($672|0)>($330|0);
          if (!($673)) {
           $674 = ($denormal$2$i|0)!=(0);
           $675 = $frac$3$i != 0.0;
           $or$cond9$i27 = $675 & $674;
           if (!($or$cond9$i27)) {
            $e2$4$i = $e2$3$i;$y$3$i = $y$2$i26;
            break;
           }
          }
          $676 = (___errno_location()|0);
          HEAP32[$676>>2] = 34;
          $e2$4$i = $e2$3$i;$y$3$i = $y$2$i26;
         } else {
          $e2$4$i = $e2$1$i248;$y$3$i = $660;
         }
        } while(0);
        $677 = (+_scalbnl($y$3$i,$e2$4$i));
        $$1$i = $677;
       }
      } while(0);
      $$0 = $$1$i;
      break L4;
      break;
     }
     default: {
      $109 = HEAP32[$1>>2]|0;
      $110 = ($109|0)==(0|0);
      if (!($110)) {
       $111 = HEAP32[$0>>2]|0;
       $112 = ((($111)) + -1|0);
       HEAP32[$0>>2] = $112;
      }
      $113 = (___errno_location()|0);
      HEAP32[$113>>2] = 22;
      ___shlim($f,0);
      $$0 = 0.0;
      break L4;
     }
     }
    }
    }
   } while(0);
   if ((label|0) == 23) {
    $41 = HEAP32[$1>>2]|0;
    $42 = ($41|0)==(0|0);
    if (!($42)) {
     $43 = HEAP32[$0>>2]|0;
     $44 = ((($43)) + -1|0);
     HEAP32[$0>>2] = $44;
    }
    $45 = ($pok|0)!=(0);
    $46 = ($i$0$lcssa>>>0)>(3);
    $or$cond9 = $45 & $46;
    if ($or$cond9) {
     $i$1 = $i$0$lcssa;
     while(1) {
      if (!($42)) {
       $47 = HEAP32[$0>>2]|0;
       $48 = ((($47)) + -1|0);
       HEAP32[$0>>2] = $48;
      }
      $49 = (($i$1) + -1)|0;
      $$old8 = ($49>>>0)>(3);
      if ($$old8) {
       $i$1 = $49;
      } else {
       break;
      }
     }
    }
   }
   $50 = (+($sign$0|0));
   $51 = $50 * inf;
   $52 = $51;
   $$0 = $52;
  }
 } while(0);
 STACKTOP = sp;return (+$$0);
}
function _scanexp($f,$pok) {
 $f = $f|0;
 $pok = $pok|0;
 var $$lcssa22 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $c$0 = 0, $c$1$be = 0, $c$1$be$lcssa = 0, $c$112 = 0, $c$2$be = 0, $c$2$lcssa = 0, $c$27 = 0, $c$3$be = 0, $neg$0 = 0, $or$cond3 = 0, $x$013 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($f)) + 100|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($1>>>0)<($3>>>0);
 if ($4) {
  $5 = ((($1)) + 1|0);
  HEAP32[$0>>2] = $5;
  $6 = HEAP8[$1>>0]|0;
  $7 = $6&255;
  $9 = $7;
 } else {
  $8 = (___shgetc($f)|0);
  $9 = $8;
 }
 $10 = ($9|0)==(45);
 switch ($9|0) {
 case 43: case 45:  {
  $11 = $10&1;
  $12 = HEAP32[$0>>2]|0;
  $13 = HEAP32[$2>>2]|0;
  $14 = ($12>>>0)<($13>>>0);
  if ($14) {
   $15 = ((($12)) + 1|0);
   HEAP32[$0>>2] = $15;
   $16 = HEAP8[$12>>0]|0;
   $17 = $16&255;
   $20 = $17;
  } else {
   $18 = (___shgetc($f)|0);
   $20 = $18;
  }
  $19 = (($20) + -48)|0;
  $21 = ($19>>>0)>(9);
  $22 = ($pok|0)!=(0);
  $or$cond3 = $22 & $21;
  if ($or$cond3) {
   $23 = HEAP32[$2>>2]|0;
   $24 = ($23|0)==(0|0);
   if ($24) {
    $c$0 = $20;$neg$0 = $11;
   } else {
    $25 = HEAP32[$0>>2]|0;
    $26 = ((($25)) + -1|0);
    HEAP32[$0>>2] = $26;
    $c$0 = $20;$neg$0 = $11;
   }
  } else {
   $c$0 = $20;$neg$0 = $11;
  }
  break;
 }
 default: {
  $c$0 = $9;$neg$0 = 0;
 }
 }
 $27 = (($c$0) + -48)|0;
 $28 = ($27>>>0)>(9);
 if ($28) {
  $29 = HEAP32[$2>>2]|0;
  $30 = ($29|0)==(0|0);
  if ($30) {
   $98 = -2147483648;$99 = 0;
  } else {
   $31 = HEAP32[$0>>2]|0;
   $32 = ((($31)) + -1|0);
   HEAP32[$0>>2] = $32;
   $98 = -2147483648;$99 = 0;
  }
 } else {
  $c$112 = $c$0;$x$013 = 0;
  while(1) {
   $33 = ($x$013*10)|0;
   $34 = (($c$112) + -48)|0;
   $35 = (($34) + ($33))|0;
   $36 = HEAP32[$0>>2]|0;
   $37 = HEAP32[$2>>2]|0;
   $38 = ($36>>>0)<($37>>>0);
   if ($38) {
    $39 = ((($36)) + 1|0);
    HEAP32[$0>>2] = $39;
    $40 = HEAP8[$36>>0]|0;
    $41 = $40&255;
    $c$1$be = $41;
   } else {
    $42 = (___shgetc($f)|0);
    $c$1$be = $42;
   }
   $43 = (($c$1$be) + -48)|0;
   $44 = ($43>>>0)<(10);
   $45 = ($35|0)<(214748364);
   $46 = $44 & $45;
   if ($46) {
    $c$112 = $c$1$be;$x$013 = $35;
   } else {
    $$lcssa22 = $35;$c$1$be$lcssa = $c$1$be;
    break;
   }
  }
  $47 = ($$lcssa22|0)<(0);
  $48 = $47 << 31 >> 31;
  $49 = (($c$1$be$lcssa) + -48)|0;
  $50 = ($49>>>0)<(10);
  if ($50) {
   $53 = $$lcssa22;$54 = $48;$c$27 = $c$1$be$lcssa;
   while(1) {
    $55 = (___muldi3(($53|0),($54|0),10,0)|0);
    $56 = tempRet0;
    $57 = ($c$27|0)<(0);
    $58 = $57 << 31 >> 31;
    $59 = (_i64Add(($c$27|0),($58|0),-48,-1)|0);
    $60 = tempRet0;
    $61 = (_i64Add(($59|0),($60|0),($55|0),($56|0))|0);
    $62 = tempRet0;
    $63 = HEAP32[$0>>2]|0;
    $64 = HEAP32[$2>>2]|0;
    $65 = ($63>>>0)<($64>>>0);
    if ($65) {
     $66 = ((($63)) + 1|0);
     HEAP32[$0>>2] = $66;
     $67 = HEAP8[$63>>0]|0;
     $68 = $67&255;
     $c$2$be = $68;
    } else {
     $69 = (___shgetc($f)|0);
     $c$2$be = $69;
    }
    $70 = (($c$2$be) + -48)|0;
    $71 = ($70>>>0)<(10);
    $72 = ($62|0)<(21474836);
    $73 = ($61>>>0)<(2061584302);
    $74 = ($62|0)==(21474836);
    $75 = $74 & $73;
    $76 = $72 | $75;
    $77 = $71 & $76;
    if ($77) {
     $53 = $61;$54 = $62;$c$27 = $c$2$be;
    } else {
     $92 = $61;$93 = $62;$c$2$lcssa = $c$2$be;
     break;
    }
   }
  } else {
   $92 = $$lcssa22;$93 = $48;$c$2$lcssa = $c$1$be$lcssa;
  }
  $51 = (($c$2$lcssa) + -48)|0;
  $52 = ($51>>>0)<(10);
  if ($52) {
   while(1) {
    $78 = HEAP32[$0>>2]|0;
    $79 = HEAP32[$2>>2]|0;
    $80 = ($78>>>0)<($79>>>0);
    if ($80) {
     $81 = ((($78)) + 1|0);
     HEAP32[$0>>2] = $81;
     $82 = HEAP8[$78>>0]|0;
     $83 = $82&255;
     $c$3$be = $83;
    } else {
     $84 = (___shgetc($f)|0);
     $c$3$be = $84;
    }
    $85 = (($c$3$be) + -48)|0;
    $86 = ($85>>>0)<(10);
    if (!($86)) {
     break;
    }
   }
  }
  $87 = HEAP32[$2>>2]|0;
  $88 = ($87|0)==(0|0);
  if (!($88)) {
   $89 = HEAP32[$0>>2]|0;
   $90 = ((($89)) + -1|0);
   HEAP32[$0>>2] = $90;
  }
  $91 = ($neg$0|0)!=(0);
  $94 = (_i64Subtract(0,0,($92|0),($93|0))|0);
  $95 = tempRet0;
  $96 = $91 ? $94 : $92;
  $97 = $91 ? $95 : $93;
  $98 = $97;$99 = $96;
 }
 tempRet0 = ($98);
 return ($99|0);
}
function _scalbn($x,$n) {
 $x = +$x;
 $n = $n|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $0 = 0, $1 = 0.0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0.0, $2 = 0, $3 = 0, $4 = 0.0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0.0, $9 = 0, $y$0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($n|0)>(1023);
 if ($0) {
  $1 = $x * 8.9884656743115795E+307;
  $2 = (($n) + -1023)|0;
  $3 = ($2|0)>(1023);
  if ($3) {
   $4 = $1 * 8.9884656743115795E+307;
   $5 = (($n) + -2046)|0;
   $6 = ($5|0)>(1023);
   $$ = $6 ? 1023 : $5;
   $$0 = $$;$y$0 = $4;
  } else {
   $$0 = $2;$y$0 = $1;
  }
 } else {
  $7 = ($n|0)<(-1022);
  if ($7) {
   $8 = $x * 2.2250738585072014E-308;
   $9 = (($n) + 1022)|0;
   $10 = ($9|0)<(-1022);
   if ($10) {
    $11 = $8 * 2.2250738585072014E-308;
    $12 = (($n) + 2044)|0;
    $13 = ($12|0)<(-1022);
    $$1 = $13 ? -1022 : $12;
    $$0 = $$1;$y$0 = $11;
   } else {
    $$0 = $9;$y$0 = $8;
   }
  } else {
   $$0 = $n;$y$0 = $x;
  }
 }
 $14 = (($$0) + 1023)|0;
 $15 = (_bitshift64Shl(($14|0),0,52)|0);
 $16 = tempRet0;
 HEAP32[tempDoublePtr>>2] = $15;HEAP32[tempDoublePtr+4>>2] = $16;$17 = +HEAPF64[tempDoublePtr>>3];
 $18 = $y$0 * $17;
 return (+$18);
}
function _copysignl($x,$y) {
 $x = +$x;
 $y = +$y;
 var $0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (+_copysign($x,$y));
 return (+$0);
}
function _scalbnl($x,$n) {
 $x = +$x;
 $n = $n|0;
 var $0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (+_scalbn($x,$n));
 return (+$0);
}
function _fmodl($x,$y) {
 $x = +$x;
 $y = +$y;
 var $0 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (+_fmod($x,$y));
 return (+$0);
}
function _fmod($x,$y) {
 $x = +$x;
 $y = +$y;
 var $$0 = 0.0, $$lcssa7 = 0, $$x = 0.0, $0 = 0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0.0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0.0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0.0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $ex$0$lcssa = 0, $ex$026 = 0, $ex$1 = 0, $ex$2$lcssa = 0, $ex$212 = 0, $ex$3$lcssa = 0, $ex$39 = 0, $ey$0$lcssa = 0, $ey$020 = 0, $ey$1$ph = 0, $fabs = 0.0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $x;$0 = HEAP32[tempDoublePtr>>2]|0;
 $1 = HEAP32[tempDoublePtr+4>>2]|0;
 HEAPF64[tempDoublePtr>>3] = $y;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($0|0),($1|0),52)|0);
 $5 = tempRet0;
 $6 = $4 & 2047;
 $7 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $8 = tempRet0;
 $9 = $7 & 2047;
 $10 = $1 & -2147483648;
 $11 = (_bitshift64Shl(($2|0),($3|0),1)|0);
 $12 = tempRet0;
 $13 = ($11|0)==(0);
 $14 = ($12|0)==(0);
 $15 = $13 & $14;
 L1: do {
  if ($15) {
   label = 3;
  } else {
   $fabs = (+Math_abs((+$y)));
   HEAPF64[tempDoublePtr>>3] = $fabs;$16 = HEAP32[tempDoublePtr>>2]|0;
   $17 = HEAP32[tempDoublePtr+4>>2]|0;
   $18 = ($17>>>0)>(2146435072);
   $19 = ($16>>>0)>(0);
   $20 = ($17|0)==(2146435072);
   $21 = $20 & $19;
   $22 = $18 | $21;
   $23 = ($6|0)==(2047);
   $or$cond = $22 | $23;
   if ($or$cond) {
    label = 3;
   } else {
    $26 = (_bitshift64Shl(($0|0),($1|0),1)|0);
    $27 = tempRet0;
    $28 = ($27>>>0)>($12>>>0);
    $29 = ($26>>>0)>($11>>>0);
    $30 = ($27|0)==($12|0);
    $31 = $30 & $29;
    $32 = $28 | $31;
    if (!($32)) {
     $33 = ($26|0)==($11|0);
     $34 = ($27|0)==($12|0);
     $35 = $33 & $34;
     $36 = $x * 0.0;
     $$x = $35 ? $36 : $x;
     return (+$$x);
    }
    $37 = ($6|0)==(0);
    if ($37) {
     $38 = (_bitshift64Shl(($0|0),($1|0),12)|0);
     $39 = tempRet0;
     $40 = ($39|0)>(-1);
     $41 = ($38>>>0)>(4294967295);
     $42 = ($39|0)==(-1);
     $43 = $42 & $41;
     $44 = $40 | $43;
     if ($44) {
      $46 = $38;$47 = $39;$ex$026 = 0;
      while(1) {
       $45 = (($ex$026) + -1)|0;
       $48 = (_bitshift64Shl(($46|0),($47|0),1)|0);
       $49 = tempRet0;
       $50 = ($49|0)>(-1);
       $51 = ($48>>>0)>(4294967295);
       $52 = ($49|0)==(-1);
       $53 = $52 & $51;
       $54 = $50 | $53;
       if ($54) {
        $46 = $48;$47 = $49;$ex$026 = $45;
       } else {
        $ex$0$lcssa = $45;
        break;
       }
      }
     } else {
      $ex$0$lcssa = 0;
     }
     $55 = (1 - ($ex$0$lcssa))|0;
     $56 = (_bitshift64Shl(($0|0),($1|0),($55|0))|0);
     $57 = tempRet0;
     $84 = $56;$85 = $57;$ex$1 = $ex$0$lcssa;
    } else {
     $58 = $1 & 1048575;
     $59 = $58 | 1048576;
     $84 = $0;$85 = $59;$ex$1 = $6;
    }
    $60 = ($9|0)==(0);
    if ($60) {
     $61 = (_bitshift64Shl(($2|0),($3|0),12)|0);
     $62 = tempRet0;
     $63 = ($62|0)>(-1);
     $64 = ($61>>>0)>(4294967295);
     $65 = ($62|0)==(-1);
     $66 = $65 & $64;
     $67 = $63 | $66;
     if ($67) {
      $69 = $61;$70 = $62;$ey$020 = 0;
      while(1) {
       $68 = (($ey$020) + -1)|0;
       $71 = (_bitshift64Shl(($69|0),($70|0),1)|0);
       $72 = tempRet0;
       $73 = ($72|0)>(-1);
       $74 = ($71>>>0)>(4294967295);
       $75 = ($72|0)==(-1);
       $76 = $75 & $74;
       $77 = $73 | $76;
       if ($77) {
        $69 = $71;$70 = $72;$ey$020 = $68;
       } else {
        $ey$0$lcssa = $68;
        break;
       }
      }
     } else {
      $ey$0$lcssa = 0;
     }
     $78 = (1 - ($ey$0$lcssa))|0;
     $79 = (_bitshift64Shl(($2|0),($3|0),($78|0))|0);
     $80 = tempRet0;
     $86 = $79;$87 = $80;$ey$1$ph = $ey$0$lcssa;
    } else {
     $81 = $3 & 1048575;
     $82 = $81 | 1048576;
     $86 = $2;$87 = $82;$ey$1$ph = $9;
    }
    $83 = ($ex$1|0)>($ey$1$ph|0);
    $88 = (_i64Subtract(($84|0),($85|0),($86|0),($87|0))|0);
    $89 = tempRet0;
    $90 = ($89|0)>(-1);
    $91 = ($88>>>0)>(4294967295);
    $92 = ($89|0)==(-1);
    $93 = $92 & $91;
    $94 = $90 | $93;
    L23: do {
     if ($83) {
      $153 = $94;$154 = $88;$155 = $89;$95 = $84;$97 = $85;$ex$212 = $ex$1;
      while(1) {
       if ($153) {
        $96 = ($95|0)==($86|0);
        $98 = ($97|0)==($87|0);
        $99 = $96 & $98;
        if ($99) {
         break;
        } else {
         $101 = $154;$102 = $155;
        }
       } else {
        $101 = $95;$102 = $97;
       }
       $103 = (_bitshift64Shl(($101|0),($102|0),1)|0);
       $104 = tempRet0;
       $105 = (($ex$212) + -1)|0;
       $106 = ($105|0)>($ey$1$ph|0);
       $107 = (_i64Subtract(($103|0),($104|0),($86|0),($87|0))|0);
       $108 = tempRet0;
       $109 = ($108|0)>(-1);
       $110 = ($107>>>0)>(4294967295);
       $111 = ($108|0)==(-1);
       $112 = $111 & $110;
       $113 = $109 | $112;
       if ($106) {
        $153 = $113;$154 = $107;$155 = $108;$95 = $103;$97 = $104;$ex$212 = $105;
       } else {
        $$lcssa7 = $113;$114 = $103;$116 = $104;$156 = $107;$157 = $108;$ex$2$lcssa = $105;
        break L23;
       }
      }
      $100 = $x * 0.0;
      $$0 = $100;
      break L1;
     } else {
      $$lcssa7 = $94;$114 = $84;$116 = $85;$156 = $88;$157 = $89;$ex$2$lcssa = $ex$1;
     }
    } while(0);
    if ($$lcssa7) {
     $115 = ($114|0)==($86|0);
     $117 = ($116|0)==($87|0);
     $118 = $115 & $117;
     if ($118) {
      $126 = $x * 0.0;
      $$0 = $126;
      break;
     } else {
      $119 = $157;$121 = $156;
     }
    } else {
     $119 = $116;$121 = $114;
    }
    $120 = ($119>>>0)<(1048576);
    $122 = ($121>>>0)<(0);
    $123 = ($119|0)==(1048576);
    $124 = $123 & $122;
    $125 = $120 | $124;
    if ($125) {
     $127 = $121;$128 = $119;$ex$39 = $ex$2$lcssa;
     while(1) {
      $129 = (_bitshift64Shl(($127|0),($128|0),1)|0);
      $130 = tempRet0;
      $131 = (($ex$39) + -1)|0;
      $132 = ($130>>>0)<(1048576);
      $133 = ($129>>>0)<(0);
      $134 = ($130|0)==(1048576);
      $135 = $134 & $133;
      $136 = $132 | $135;
      if ($136) {
       $127 = $129;$128 = $130;$ex$39 = $131;
      } else {
       $138 = $129;$139 = $130;$ex$3$lcssa = $131;
       break;
      }
     }
    } else {
     $138 = $121;$139 = $119;$ex$3$lcssa = $ex$2$lcssa;
    }
    $137 = ($ex$3$lcssa|0)>(0);
    if ($137) {
     $140 = (_i64Add(($138|0),($139|0),0,-1048576)|0);
     $141 = tempRet0;
     $142 = (_bitshift64Shl(($ex$3$lcssa|0),0,52)|0);
     $143 = tempRet0;
     $144 = $140 | $142;
     $145 = $141 | $143;
     $150 = $145;$152 = $144;
    } else {
     $146 = (1 - ($ex$3$lcssa))|0;
     $147 = (_bitshift64Lshr(($138|0),($139|0),($146|0))|0);
     $148 = tempRet0;
     $150 = $148;$152 = $147;
    }
    $149 = $150 | $10;
    HEAP32[tempDoublePtr>>2] = $152;HEAP32[tempDoublePtr+4>>2] = $149;$151 = +HEAPF64[tempDoublePtr>>3];
    $$0 = $151;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $24 = $x * $y;
  $25 = $24 / $24;
  $$0 = $25;
 }
 return (+$$0);
}
function _fflush($f) {
 $f = $f|0;
 var $$0 = 0, $$01 = 0, $$012 = 0, $$014 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, $r$0$lcssa = 0, $r$03 = 0, $r$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($f|0)==(0|0);
 do {
  if ($0) {
   $7 = HEAP32[90]|0;
   $8 = ($7|0)==(0|0);
   if ($8) {
    $27 = 0;
   } else {
    $9 = HEAP32[90]|0;
    $10 = (_fflush($9)|0);
    $27 = $10;
   }
   ___lock(((3300)|0));
   $$012 = HEAP32[(3296)>>2]|0;
   $11 = ($$012|0)==(0|0);
   if ($11) {
    $r$0$lcssa = $27;
   } else {
    $$014 = $$012;$r$03 = $27;
    while(1) {
     $12 = ((($$014)) + 76|0);
     $13 = HEAP32[$12>>2]|0;
     $14 = ($13|0)>(-1);
     if ($14) {
      $15 = (___lockfile($$014)|0);
      $23 = $15;
     } else {
      $23 = 0;
     }
     $16 = ((($$014)) + 20|0);
     $17 = HEAP32[$16>>2]|0;
     $18 = ((($$014)) + 28|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ($17>>>0)>($19>>>0);
     if ($20) {
      $21 = (___fflush_unlocked($$014)|0);
      $22 = $21 | $r$03;
      $r$1 = $22;
     } else {
      $r$1 = $r$03;
     }
     $24 = ($23|0)==(0);
     if (!($24)) {
      ___unlockfile($$014);
     }
     $25 = ((($$014)) + 56|0);
     $$01 = HEAP32[$25>>2]|0;
     $26 = ($$01|0)==(0|0);
     if ($26) {
      $r$0$lcssa = $r$1;
      break;
     } else {
      $$014 = $$01;$r$03 = $r$1;
     }
    }
   }
   ___unlock(((3300)|0));
   $$0 = $r$0$lcssa;
  } else {
   $1 = ((($f)) + 76|0);
   $2 = HEAP32[$1>>2]|0;
   $3 = ($2|0)>(-1);
   if (!($3)) {
    $4 = (___fflush_unlocked($f)|0);
    $$0 = $4;
    break;
   }
   $5 = (___lockfile($f)|0);
   $phitmp = ($5|0)==(0);
   $6 = (___fflush_unlocked($f)|0);
   if ($phitmp) {
    $$0 = $6;
   } else {
    ___unlockfile($f);
    $$0 = $6;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($f) {
 $f = $f|0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($f)) + 20|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($f)) + 28|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($1>>>0)>($3>>>0);
 if ($4) {
  $5 = ((($f)) + 36|0);
  $6 = HEAP32[$5>>2]|0;
  (FUNCTION_TABLE_iiii[$6 & 7]($f,0,0)|0);
  $7 = HEAP32[$0>>2]|0;
  $8 = ($7|0)==(0|0);
  if ($8) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $9 = ((($f)) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ((($f)) + 8|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = ($10>>>0)<($12>>>0);
  if ($13) {
   $14 = ((($f)) + 40|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = $10;
   $17 = $12;
   $18 = (($16) - ($17))|0;
   (FUNCTION_TABLE_iiii[$15 & 7]($f,$18,1)|0);
  }
  $19 = ((($f)) + 16|0);
  HEAP32[$19>>2] = 0;
  HEAP32[$2>>2] = 0;
  HEAP32[$0>>2] = 0;
  HEAP32[$11>>2] = 0;
  HEAP32[$9>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function ___overflow($f,$_c) {
 $f = $f|0;
 $_c = $_c|0;
 var $$0 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $c = sp;
 $0 = $_c&255;
 HEAP8[$c>>0] = $0;
 $1 = ((($f)) + 16|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0|0);
 if ($3) {
  $4 = (___towrite($f)|0);
  $5 = ($4|0)==(0);
  if ($5) {
   $$pre = HEAP32[$1>>2]|0;
   $9 = $$pre;
   label = 4;
  } else {
   $$0 = -1;
  }
 } else {
  $9 = $2;
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $6 = ((($f)) + 20|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = ($7>>>0)<($9>>>0);
   if ($8) {
    $10 = $_c & 255;
    $11 = ((($f)) + 75|0);
    $12 = HEAP8[$11>>0]|0;
    $13 = $12 << 24 >> 24;
    $14 = ($10|0)==($13|0);
    if (!($14)) {
     $15 = ((($7)) + 1|0);
     HEAP32[$6>>2] = $15;
     HEAP8[$7>>0] = $0;
     $$0 = $10;
     break;
    }
   }
   $16 = ((($f)) + 36|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = (FUNCTION_TABLE_iiii[$17 & 7]($f,$c,1)|0);
   $19 = ($18|0)==(1);
   if ($19) {
    $20 = HEAP8[$c>>0]|0;
    $21 = $20&255;
    $$0 = $21;
   } else {
    $$0 = -1;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function _puts($s) {
 $s = $s|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[61]|0;
 $1 = ((($0)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  $4 = (___lockfile($0)|0);
  $19 = $4;
 } else {
  $19 = 0;
 }
 $5 = (_fputs($s,$0)|0);
 $6 = ($5|0)<(0);
 do {
  if ($6) {
   $18 = 1;
  } else {
   $7 = ((($0)) + 75|0);
   $8 = HEAP8[$7>>0]|0;
   $9 = ($8<<24>>24)==(10);
   if (!($9)) {
    $10 = ((($0)) + 20|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ((($0)) + 16|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = ($11>>>0)<($13>>>0);
    if ($14) {
     $15 = ((($11)) + 1|0);
     HEAP32[$10>>2] = $15;
     HEAP8[$11>>0] = 10;
     $18 = 0;
     break;
    }
   }
   $16 = (___overflow($0,10)|0);
   $phitmp = ($16|0)<(0);
   $18 = $phitmp;
  }
 } while(0);
 $17 = $18 << 31 >> 31;
 $20 = ($19|0)==(0);
 if (!($20)) {
  ___unlockfile($0);
 }
 return ($17|0);
}
function _fputs($s,$f) {
 $s = $s|0;
 $f = $f|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_strlen($s)|0);
 $1 = (_fwrite($s,$0,1,$f)|0);
 $2 = (($1) + -1)|0;
 return ($2|0);
}
function _fwrite($src,$size,$nmemb,$f) {
 $src = $src|0;
 $size = $size|0;
 $nmemb = $nmemb|0;
 $f = $f|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = Math_imul($nmemb, $size)|0;
 $1 = ((($f)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  $5 = (___lockfile($f)|0);
  $phitmp = ($5|0)==(0);
  $6 = (___fwritex($src,$0,$f)|0);
  if ($phitmp) {
   $7 = $6;
  } else {
   ___unlockfile($f);
   $7 = $6;
  }
 } else {
  $4 = (___fwritex($src,$0,$f)|0);
  $7 = $4;
 }
 $8 = ($7|0)==($0|0);
 if ($8) {
  $10 = $nmemb;
 } else {
  $9 = (($7>>>0) / ($size>>>0))&-1;
  $10 = $9;
 }
 return ($10|0);
}
function _printf($fmt,$varargs) {
 $fmt = $fmt|0;
 $varargs = $varargs|0;
 var $0 = 0, $1 = 0, $ap = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $ap = sp;
 HEAP32[$ap>>2] = $varargs;
 $0 = HEAP32[61]|0;
 $1 = (_vfprintf($0,$fmt,$ap)|0);
 STACKTOP = sp;return ($1|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i13 = 0, $$pre$i16$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0;
 var $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre71 = 0, $$pre9$i$i = 0, $$rsize$0$i = 0, $$rsize$4$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0;
 var $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0;
 var $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0;
 var $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0;
 var $1062 = 0, $1063 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0;
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0;
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0;
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0;
 var $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0;
 var $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0;
 var $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0;
 var $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0;
 var $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0;
 var $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0;
 var $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0;
 var $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0;
 var $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0;
 var $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0;
 var $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0;
 var $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0;
 var $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0;
 var $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0;
 var $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0;
 var $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0;
 var $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0;
 var $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0;
 var $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0;
 var $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0;
 var $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0;
 var $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0;
 var $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0;
 var $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0;
 var $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0;
 var $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0;
 var $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0;
 var $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0;
 var $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0;
 var $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0;
 var $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0;
 var $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0;
 var $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0;
 var $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0;
 var $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0;
 var $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0, $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i12 = 0, $exitcond$i$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $nb$0 = 0, $not$$i$i = 0, $not$$i20$i = 0, $not$7$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0;
 var $or$cond$i17 = 0, $or$cond1$i = 0, $or$cond1$i16 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond48$i = 0, $or$cond5$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0;
 var $rst$1$i = 0, $sizebits$0$$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0;
 var $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   $2 = (($bytes) + 11)|0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[831]|0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($5))|0;
    $13 = $12 << 1;
    $14 = (3364 + ($13<<2)|0);
    $15 = ((($14)) + 8|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[831] = $22;
     } else {
      $23 = HEAP32[(3340)>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = ((($18)) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = ((($16)) + 4|0);
    HEAP32[$30>>2] = $29;
    $31 = (($16) + ($28)|0);
    $32 = ((($31)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = $33 | 1;
    HEAP32[$32>>2] = $34;
    $$0 = $17;
    return ($$0|0);
   }
   $35 = HEAP32[(3332)>>2]|0;
   $36 = ($4>>>0)>($35>>>0);
   if ($36) {
    $37 = ($7|0)==(0);
    if (!($37)) {
     $38 = $7 << $5;
     $39 = 2 << $5;
     $40 = (0 - ($39))|0;
     $41 = $39 | $40;
     $42 = $38 & $41;
     $43 = (0 - ($42))|0;
     $44 = $42 & $43;
     $45 = (($44) + -1)|0;
     $46 = $45 >>> 12;
     $47 = $46 & 16;
     $48 = $45 >>> $47;
     $49 = $48 >>> 5;
     $50 = $49 & 8;
     $51 = $50 | $47;
     $52 = $48 >>> $50;
     $53 = $52 >>> 2;
     $54 = $53 & 4;
     $55 = $51 | $54;
     $56 = $52 >>> $54;
     $57 = $56 >>> 1;
     $58 = $57 & 2;
     $59 = $55 | $58;
     $60 = $56 >>> $58;
     $61 = $60 >>> 1;
     $62 = $61 & 1;
     $63 = $59 | $62;
     $64 = $60 >>> $62;
     $65 = (($63) + ($64))|0;
     $66 = $65 << 1;
     $67 = (3364 + ($66<<2)|0);
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ($67|0)==($71|0);
     do {
      if ($72) {
       $73 = 1 << $65;
       $74 = $73 ^ -1;
       $75 = $6 & $74;
       HEAP32[831] = $75;
       $89 = $35;
      } else {
       $76 = HEAP32[(3340)>>2]|0;
       $77 = ($71>>>0)<($76>>>0);
       if ($77) {
        _abort();
        // unreachable;
       }
       $78 = ((($71)) + 12|0);
       $79 = HEAP32[$78>>2]|0;
       $80 = ($79|0)==($69|0);
       if ($80) {
        HEAP32[$78>>2] = $67;
        HEAP32[$68>>2] = $71;
        $$pre = HEAP32[(3332)>>2]|0;
        $89 = $$pre;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $81 = $65 << 3;
     $82 = (($81) - ($4))|0;
     $83 = $4 | 3;
     $84 = ((($69)) + 4|0);
     HEAP32[$84>>2] = $83;
     $85 = (($69) + ($4)|0);
     $86 = $82 | 1;
     $87 = ((($85)) + 4|0);
     HEAP32[$87>>2] = $86;
     $88 = (($85) + ($82)|0);
     HEAP32[$88>>2] = $82;
     $90 = ($89|0)==(0);
     if (!($90)) {
      $91 = HEAP32[(3344)>>2]|0;
      $92 = $89 >>> 3;
      $93 = $92 << 1;
      $94 = (3364 + ($93<<2)|0);
      $95 = HEAP32[831]|0;
      $96 = 1 << $92;
      $97 = $95 & $96;
      $98 = ($97|0)==(0);
      if ($98) {
       $99 = $95 | $96;
       HEAP32[831] = $99;
       $$pre71 = ((($94)) + 8|0);
       $$pre$phiZ2D = $$pre71;$F4$0 = $94;
      } else {
       $100 = ((($94)) + 8|0);
       $101 = HEAP32[$100>>2]|0;
       $102 = HEAP32[(3340)>>2]|0;
       $103 = ($101>>>0)<($102>>>0);
       if ($103) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $100;$F4$0 = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $91;
      $104 = ((($F4$0)) + 12|0);
      HEAP32[$104>>2] = $91;
      $105 = ((($91)) + 8|0);
      HEAP32[$105>>2] = $F4$0;
      $106 = ((($91)) + 12|0);
      HEAP32[$106>>2] = $94;
     }
     HEAP32[(3332)>>2] = $82;
     HEAP32[(3344)>>2] = $85;
     $$0 = $70;
     return ($$0|0);
    }
    $107 = HEAP32[(3328)>>2]|0;
    $108 = ($107|0)==(0);
    if ($108) {
     $nb$0 = $4;
    } else {
     $109 = (0 - ($107))|0;
     $110 = $107 & $109;
     $111 = (($110) + -1)|0;
     $112 = $111 >>> 12;
     $113 = $112 & 16;
     $114 = $111 >>> $113;
     $115 = $114 >>> 5;
     $116 = $115 & 8;
     $117 = $116 | $113;
     $118 = $114 >>> $116;
     $119 = $118 >>> 2;
     $120 = $119 & 4;
     $121 = $117 | $120;
     $122 = $118 >>> $120;
     $123 = $122 >>> 1;
     $124 = $123 & 2;
     $125 = $121 | $124;
     $126 = $122 >>> $124;
     $127 = $126 >>> 1;
     $128 = $127 & 1;
     $129 = $125 | $128;
     $130 = $126 >>> $128;
     $131 = (($129) + ($130))|0;
     $132 = (3628 + ($131<<2)|0);
     $133 = HEAP32[$132>>2]|0;
     $134 = ((($133)) + 4|0);
     $135 = HEAP32[$134>>2]|0;
     $136 = $135 & -8;
     $137 = (($136) - ($4))|0;
     $rsize$0$i = $137;$t$0$i = $133;$v$0$i = $133;
     while(1) {
      $138 = ((($t$0$i)) + 16|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0|0);
      if ($140) {
       $141 = ((($t$0$i)) + 20|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        $rsize$0$i$lcssa = $rsize$0$i;$v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $145 = $142;
       }
      } else {
       $145 = $139;
      }
      $144 = ((($145)) + 4|0);
      $146 = HEAP32[$144>>2]|0;
      $147 = $146 & -8;
      $148 = (($147) - ($4))|0;
      $149 = ($148>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $149 ? $148 : $rsize$0$i;
      $$v$0$i = $149 ? $145 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $145;$v$0$i = $$v$0$i;
     }
     $150 = HEAP32[(3340)>>2]|0;
     $151 = ($v$0$i$lcssa>>>0)<($150>>>0);
     if ($151) {
      _abort();
      // unreachable;
     }
     $152 = (($v$0$i$lcssa) + ($4)|0);
     $153 = ($v$0$i$lcssa>>>0)<($152>>>0);
     if (!($153)) {
      _abort();
      // unreachable;
     }
     $154 = ((($v$0$i$lcssa)) + 24|0);
     $155 = HEAP32[$154>>2]|0;
     $156 = ((($v$0$i$lcssa)) + 12|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==($v$0$i$lcssa|0);
     do {
      if ($158) {
       $168 = ((($v$0$i$lcssa)) + 20|0);
       $169 = HEAP32[$168>>2]|0;
       $170 = ($169|0)==(0|0);
       if ($170) {
        $171 = ((($v$0$i$lcssa)) + 16|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($172|0)==(0|0);
        if ($173) {
         $R$3$i = 0;
         break;
        } else {
         $R$1$i = $172;$RP$1$i = $171;
        }
       } else {
        $R$1$i = $169;$RP$1$i = $168;
       }
       while(1) {
        $174 = ((($R$1$i)) + 20|0);
        $175 = HEAP32[$174>>2]|0;
        $176 = ($175|0)==(0|0);
        if (!($176)) {
         $R$1$i = $175;$RP$1$i = $174;
         continue;
        }
        $177 = ((($R$1$i)) + 16|0);
        $178 = HEAP32[$177>>2]|0;
        $179 = ($178|0)==(0|0);
        if ($179) {
         $R$1$i$lcssa = $R$1$i;$RP$1$i$lcssa = $RP$1$i;
         break;
        } else {
         $R$1$i = $178;$RP$1$i = $177;
        }
       }
       $180 = ($RP$1$i$lcssa>>>0)<($150>>>0);
       if ($180) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$1$i$lcssa>>2] = 0;
        $R$3$i = $R$1$i$lcssa;
        break;
       }
      } else {
       $159 = ((($v$0$i$lcssa)) + 8|0);
       $160 = HEAP32[$159>>2]|0;
       $161 = ($160>>>0)<($150>>>0);
       if ($161) {
        _abort();
        // unreachable;
       }
       $162 = ((($160)) + 12|0);
       $163 = HEAP32[$162>>2]|0;
       $164 = ($163|0)==($v$0$i$lcssa|0);
       if (!($164)) {
        _abort();
        // unreachable;
       }
       $165 = ((($157)) + 8|0);
       $166 = HEAP32[$165>>2]|0;
       $167 = ($166|0)==($v$0$i$lcssa|0);
       if ($167) {
        HEAP32[$162>>2] = $157;
        HEAP32[$165>>2] = $160;
        $R$3$i = $157;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $181 = ($155|0)==(0|0);
     do {
      if (!($181)) {
       $182 = ((($v$0$i$lcssa)) + 28|0);
       $183 = HEAP32[$182>>2]|0;
       $184 = (3628 + ($183<<2)|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($v$0$i$lcssa|0)==($185|0);
       if ($186) {
        HEAP32[$184>>2] = $R$3$i;
        $cond$i = ($R$3$i|0)==(0|0);
        if ($cond$i) {
         $187 = 1 << $183;
         $188 = $187 ^ -1;
         $189 = HEAP32[(3328)>>2]|0;
         $190 = $189 & $188;
         HEAP32[(3328)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(3340)>>2]|0;
        $192 = ($155>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($155)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($v$0$i$lcssa|0);
        if ($195) {
         HEAP32[$193>>2] = $R$3$i;
        } else {
         $196 = ((($155)) + 20|0);
         HEAP32[$196>>2] = $R$3$i;
        }
        $197 = ($R$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(3340)>>2]|0;
       $199 = ($R$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($R$3$i)) + 24|0);
       HEAP32[$200>>2] = $155;
       $201 = ((($v$0$i$lcssa)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($R$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $R$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($v$0$i$lcssa)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(3340)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($R$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $R$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($rsize$0$i$lcssa>>>0)<(16);
     if ($214) {
      $215 = (($rsize$0$i$lcssa) + ($4))|0;
      $216 = $215 | 3;
      $217 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($v$0$i$lcssa) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $4 | 3;
      $223 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $rsize$0$i$lcssa | 1;
      $225 = ((($152)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($152) + ($rsize$0$i$lcssa)|0);
      HEAP32[$226>>2] = $rsize$0$i$lcssa;
      $227 = HEAP32[(3332)>>2]|0;
      $228 = ($227|0)==(0);
      if (!($228)) {
       $229 = HEAP32[(3344)>>2]|0;
       $230 = $227 >>> 3;
       $231 = $230 << 1;
       $232 = (3364 + ($231<<2)|0);
       $233 = HEAP32[831]|0;
       $234 = 1 << $230;
       $235 = $233 & $234;
       $236 = ($235|0)==(0);
       if ($236) {
        $237 = $233 | $234;
        HEAP32[831] = $237;
        $$pre$i = ((($232)) + 8|0);
        $$pre$phi$iZ2D = $$pre$i;$F1$0$i = $232;
       } else {
        $238 = ((($232)) + 8|0);
        $239 = HEAP32[$238>>2]|0;
        $240 = HEAP32[(3340)>>2]|0;
        $241 = ($239>>>0)<($240>>>0);
        if ($241) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $238;$F1$0$i = $239;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $229;
       $242 = ((($F1$0$i)) + 12|0);
       HEAP32[$242>>2] = $229;
       $243 = ((($229)) + 8|0);
       HEAP32[$243>>2] = $F1$0$i;
       $244 = ((($229)) + 12|0);
       HEAP32[$244>>2] = $232;
      }
      HEAP32[(3332)>>2] = $rsize$0$i$lcssa;
      HEAP32[(3344)>>2] = $152;
     }
     $245 = ((($v$0$i$lcssa)) + 8|0);
     $$0 = $245;
     return ($$0|0);
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $246 = ($bytes>>>0)>(4294967231);
   if ($246) {
    $nb$0 = -1;
   } else {
    $247 = (($bytes) + 11)|0;
    $248 = $247 & -8;
    $249 = HEAP32[(3328)>>2]|0;
    $250 = ($249|0)==(0);
    if ($250) {
     $nb$0 = $248;
    } else {
     $251 = (0 - ($248))|0;
     $252 = $247 >>> 8;
     $253 = ($252|0)==(0);
     if ($253) {
      $idx$0$i = 0;
     } else {
      $254 = ($248>>>0)>(16777215);
      if ($254) {
       $idx$0$i = 31;
      } else {
       $255 = (($252) + 1048320)|0;
       $256 = $255 >>> 16;
       $257 = $256 & 8;
       $258 = $252 << $257;
       $259 = (($258) + 520192)|0;
       $260 = $259 >>> 16;
       $261 = $260 & 4;
       $262 = $261 | $257;
       $263 = $258 << $261;
       $264 = (($263) + 245760)|0;
       $265 = $264 >>> 16;
       $266 = $265 & 2;
       $267 = $262 | $266;
       $268 = (14 - ($267))|0;
       $269 = $263 << $266;
       $270 = $269 >>> 15;
       $271 = (($268) + ($270))|0;
       $272 = $271 << 1;
       $273 = (($271) + 7)|0;
       $274 = $248 >>> $273;
       $275 = $274 & 1;
       $276 = $275 | $272;
       $idx$0$i = $276;
      }
     }
     $277 = (3628 + ($idx$0$i<<2)|0);
     $278 = HEAP32[$277>>2]|0;
     $279 = ($278|0)==(0|0);
     L123: do {
      if ($279) {
       $rsize$3$i = $251;$t$2$i = 0;$v$3$i = 0;
       label = 86;
      } else {
       $280 = ($idx$0$i|0)==(31);
       $281 = $idx$0$i >>> 1;
       $282 = (25 - ($281))|0;
       $283 = $280 ? 0 : $282;
       $284 = $248 << $283;
       $rsize$0$i5 = $251;$rst$0$i = 0;$sizebits$0$i = $284;$t$0$i4 = $278;$v$0$i6 = 0;
       while(1) {
        $285 = ((($t$0$i4)) + 4|0);
        $286 = HEAP32[$285>>2]|0;
        $287 = $286 & -8;
        $288 = (($287) - ($248))|0;
        $289 = ($288>>>0)<($rsize$0$i5>>>0);
        if ($289) {
         $290 = ($287|0)==($248|0);
         if ($290) {
          $rsize$412$i = $288;$t$411$i = $t$0$i4;$v$413$i = $t$0$i4;
          label = 90;
          break L123;
         } else {
          $rsize$1$i = $288;$v$1$i = $t$0$i4;
         }
        } else {
         $rsize$1$i = $rsize$0$i5;$v$1$i = $v$0$i6;
        }
        $291 = ((($t$0$i4)) + 20|0);
        $292 = HEAP32[$291>>2]|0;
        $293 = $sizebits$0$i >>> 31;
        $294 = (((($t$0$i4)) + 16|0) + ($293<<2)|0);
        $295 = HEAP32[$294>>2]|0;
        $296 = ($292|0)==(0|0);
        $297 = ($292|0)==($295|0);
        $or$cond1$i = $296 | $297;
        $rst$1$i = $or$cond1$i ? $rst$0$i : $292;
        $298 = ($295|0)==(0|0);
        $299 = $298&1;
        $300 = $299 ^ 1;
        $sizebits$0$$i = $sizebits$0$i << $300;
        if ($298) {
         $rsize$3$i = $rsize$1$i;$t$2$i = $rst$1$i;$v$3$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i5 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $sizebits$0$$i;$t$0$i4 = $295;$v$0$i6 = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $301 = ($t$2$i|0)==(0|0);
      $302 = ($v$3$i|0)==(0|0);
      $or$cond$i = $301 & $302;
      if ($or$cond$i) {
       $303 = 2 << $idx$0$i;
       $304 = (0 - ($303))|0;
       $305 = $303 | $304;
       $306 = $249 & $305;
       $307 = ($306|0)==(0);
       if ($307) {
        $nb$0 = $248;
        break;
       }
       $308 = (0 - ($306))|0;
       $309 = $306 & $308;
       $310 = (($309) + -1)|0;
       $311 = $310 >>> 12;
       $312 = $311 & 16;
       $313 = $310 >>> $312;
       $314 = $313 >>> 5;
       $315 = $314 & 8;
       $316 = $315 | $312;
       $317 = $313 >>> $315;
       $318 = $317 >>> 2;
       $319 = $318 & 4;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 2;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = $325 >>> 1;
       $327 = $326 & 1;
       $328 = $324 | $327;
       $329 = $325 >>> $327;
       $330 = (($328) + ($329))|0;
       $331 = (3628 + ($330<<2)|0);
       $332 = HEAP32[$331>>2]|0;
       $t$4$ph$i = $332;
      } else {
       $t$4$ph$i = $t$2$i;
      }
      $333 = ($t$4$ph$i|0)==(0|0);
      if ($333) {
       $rsize$4$lcssa$i = $rsize$3$i;$v$4$lcssa$i = $v$3$i;
      } else {
       $rsize$412$i = $rsize$3$i;$t$411$i = $t$4$ph$i;$v$413$i = $v$3$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $334 = ((($t$411$i)) + 4|0);
       $335 = HEAP32[$334>>2]|0;
       $336 = $335 & -8;
       $337 = (($336) - ($248))|0;
       $338 = ($337>>>0)<($rsize$412$i>>>0);
       $$rsize$4$i = $338 ? $337 : $rsize$412$i;
       $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
       $339 = ((($t$411$i)) + 16|0);
       $340 = HEAP32[$339>>2]|0;
       $341 = ($340|0)==(0|0);
       if (!($341)) {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $340;$v$413$i = $t$4$v$4$i;
        label = 90;
        continue;
       }
       $342 = ((($t$411$i)) + 20|0);
       $343 = HEAP32[$342>>2]|0;
       $344 = ($343|0)==(0|0);
       if ($344) {
        $rsize$4$lcssa$i = $$rsize$4$i;$v$4$lcssa$i = $t$4$v$4$i;
        break;
       } else {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $343;$v$413$i = $t$4$v$4$i;
        label = 90;
       }
      }
     }
     $345 = ($v$4$lcssa$i|0)==(0|0);
     if ($345) {
      $nb$0 = $248;
     } else {
      $346 = HEAP32[(3332)>>2]|0;
      $347 = (($346) - ($248))|0;
      $348 = ($rsize$4$lcssa$i>>>0)<($347>>>0);
      if ($348) {
       $349 = HEAP32[(3340)>>2]|0;
       $350 = ($v$4$lcssa$i>>>0)<($349>>>0);
       if ($350) {
        _abort();
        // unreachable;
       }
       $351 = (($v$4$lcssa$i) + ($248)|0);
       $352 = ($v$4$lcssa$i>>>0)<($351>>>0);
       if (!($352)) {
        _abort();
        // unreachable;
       }
       $353 = ((($v$4$lcssa$i)) + 24|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ((($v$4$lcssa$i)) + 12|0);
       $356 = HEAP32[$355>>2]|0;
       $357 = ($356|0)==($v$4$lcssa$i|0);
       do {
        if ($357) {
         $367 = ((($v$4$lcssa$i)) + 20|0);
         $368 = HEAP32[$367>>2]|0;
         $369 = ($368|0)==(0|0);
         if ($369) {
          $370 = ((($v$4$lcssa$i)) + 16|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if ($372) {
           $R$3$i11 = 0;
           break;
          } else {
           $R$1$i9 = $371;$RP$1$i8 = $370;
          }
         } else {
          $R$1$i9 = $368;$RP$1$i8 = $367;
         }
         while(1) {
          $373 = ((($R$1$i9)) + 20|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if (!($375)) {
           $R$1$i9 = $374;$RP$1$i8 = $373;
           continue;
          }
          $376 = ((($R$1$i9)) + 16|0);
          $377 = HEAP32[$376>>2]|0;
          $378 = ($377|0)==(0|0);
          if ($378) {
           $R$1$i9$lcssa = $R$1$i9;$RP$1$i8$lcssa = $RP$1$i8;
           break;
          } else {
           $R$1$i9 = $377;$RP$1$i8 = $376;
          }
         }
         $379 = ($RP$1$i8$lcssa>>>0)<($349>>>0);
         if ($379) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$1$i8$lcssa>>2] = 0;
          $R$3$i11 = $R$1$i9$lcssa;
          break;
         }
        } else {
         $358 = ((($v$4$lcssa$i)) + 8|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359>>>0)<($349>>>0);
         if ($360) {
          _abort();
          // unreachable;
         }
         $361 = ((($359)) + 12|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($v$4$lcssa$i|0);
         if (!($363)) {
          _abort();
          // unreachable;
         }
         $364 = ((($356)) + 8|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==($v$4$lcssa$i|0);
         if ($366) {
          HEAP32[$361>>2] = $356;
          HEAP32[$364>>2] = $359;
          $R$3$i11 = $356;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $380 = ($354|0)==(0|0);
       do {
        if (!($380)) {
         $381 = ((($v$4$lcssa$i)) + 28|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = (3628 + ($382<<2)|0);
         $384 = HEAP32[$383>>2]|0;
         $385 = ($v$4$lcssa$i|0)==($384|0);
         if ($385) {
          HEAP32[$383>>2] = $R$3$i11;
          $cond$i12 = ($R$3$i11|0)==(0|0);
          if ($cond$i12) {
           $386 = 1 << $382;
           $387 = $386 ^ -1;
           $388 = HEAP32[(3328)>>2]|0;
           $389 = $388 & $387;
           HEAP32[(3328)>>2] = $389;
           break;
          }
         } else {
          $390 = HEAP32[(3340)>>2]|0;
          $391 = ($354>>>0)<($390>>>0);
          if ($391) {
           _abort();
           // unreachable;
          }
          $392 = ((($354)) + 16|0);
          $393 = HEAP32[$392>>2]|0;
          $394 = ($393|0)==($v$4$lcssa$i|0);
          if ($394) {
           HEAP32[$392>>2] = $R$3$i11;
          } else {
           $395 = ((($354)) + 20|0);
           HEAP32[$395>>2] = $R$3$i11;
          }
          $396 = ($R$3$i11|0)==(0|0);
          if ($396) {
           break;
          }
         }
         $397 = HEAP32[(3340)>>2]|0;
         $398 = ($R$3$i11>>>0)<($397>>>0);
         if ($398) {
          _abort();
          // unreachable;
         }
         $399 = ((($R$3$i11)) + 24|0);
         HEAP32[$399>>2] = $354;
         $400 = ((($v$4$lcssa$i)) + 16|0);
         $401 = HEAP32[$400>>2]|0;
         $402 = ($401|0)==(0|0);
         do {
          if (!($402)) {
           $403 = ($401>>>0)<($397>>>0);
           if ($403) {
            _abort();
            // unreachable;
           } else {
            $404 = ((($R$3$i11)) + 16|0);
            HEAP32[$404>>2] = $401;
            $405 = ((($401)) + 24|0);
            HEAP32[$405>>2] = $R$3$i11;
            break;
           }
          }
         } while(0);
         $406 = ((($v$4$lcssa$i)) + 20|0);
         $407 = HEAP32[$406>>2]|0;
         $408 = ($407|0)==(0|0);
         if (!($408)) {
          $409 = HEAP32[(3340)>>2]|0;
          $410 = ($407>>>0)<($409>>>0);
          if ($410) {
           _abort();
           // unreachable;
          } else {
           $411 = ((($R$3$i11)) + 20|0);
           HEAP32[$411>>2] = $407;
           $412 = ((($407)) + 24|0);
           HEAP32[$412>>2] = $R$3$i11;
           break;
          }
         }
        }
       } while(0);
       $413 = ($rsize$4$lcssa$i>>>0)<(16);
       do {
        if ($413) {
         $414 = (($rsize$4$lcssa$i) + ($248))|0;
         $415 = $414 | 3;
         $416 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$416>>2] = $415;
         $417 = (($v$4$lcssa$i) + ($414)|0);
         $418 = ((($417)) + 4|0);
         $419 = HEAP32[$418>>2]|0;
         $420 = $419 | 1;
         HEAP32[$418>>2] = $420;
        } else {
         $421 = $248 | 3;
         $422 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$422>>2] = $421;
         $423 = $rsize$4$lcssa$i | 1;
         $424 = ((($351)) + 4|0);
         HEAP32[$424>>2] = $423;
         $425 = (($351) + ($rsize$4$lcssa$i)|0);
         HEAP32[$425>>2] = $rsize$4$lcssa$i;
         $426 = $rsize$4$lcssa$i >>> 3;
         $427 = ($rsize$4$lcssa$i>>>0)<(256);
         if ($427) {
          $428 = $426 << 1;
          $429 = (3364 + ($428<<2)|0);
          $430 = HEAP32[831]|0;
          $431 = 1 << $426;
          $432 = $430 & $431;
          $433 = ($432|0)==(0);
          if ($433) {
           $434 = $430 | $431;
           HEAP32[831] = $434;
           $$pre$i13 = ((($429)) + 8|0);
           $$pre$phi$i14Z2D = $$pre$i13;$F5$0$i = $429;
          } else {
           $435 = ((($429)) + 8|0);
           $436 = HEAP32[$435>>2]|0;
           $437 = HEAP32[(3340)>>2]|0;
           $438 = ($436>>>0)<($437>>>0);
           if ($438) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i14Z2D = $435;$F5$0$i = $436;
           }
          }
          HEAP32[$$pre$phi$i14Z2D>>2] = $351;
          $439 = ((($F5$0$i)) + 12|0);
          HEAP32[$439>>2] = $351;
          $440 = ((($351)) + 8|0);
          HEAP32[$440>>2] = $F5$0$i;
          $441 = ((($351)) + 12|0);
          HEAP32[$441>>2] = $429;
          break;
         }
         $442 = $rsize$4$lcssa$i >>> 8;
         $443 = ($442|0)==(0);
         if ($443) {
          $I7$0$i = 0;
         } else {
          $444 = ($rsize$4$lcssa$i>>>0)>(16777215);
          if ($444) {
           $I7$0$i = 31;
          } else {
           $445 = (($442) + 1048320)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 8;
           $448 = $442 << $447;
           $449 = (($448) + 520192)|0;
           $450 = $449 >>> 16;
           $451 = $450 & 4;
           $452 = $451 | $447;
           $453 = $448 << $451;
           $454 = (($453) + 245760)|0;
           $455 = $454 >>> 16;
           $456 = $455 & 2;
           $457 = $452 | $456;
           $458 = (14 - ($457))|0;
           $459 = $453 << $456;
           $460 = $459 >>> 15;
           $461 = (($458) + ($460))|0;
           $462 = $461 << 1;
           $463 = (($461) + 7)|0;
           $464 = $rsize$4$lcssa$i >>> $463;
           $465 = $464 & 1;
           $466 = $465 | $462;
           $I7$0$i = $466;
          }
         }
         $467 = (3628 + ($I7$0$i<<2)|0);
         $468 = ((($351)) + 28|0);
         HEAP32[$468>>2] = $I7$0$i;
         $469 = ((($351)) + 16|0);
         $470 = ((($469)) + 4|0);
         HEAP32[$470>>2] = 0;
         HEAP32[$469>>2] = 0;
         $471 = HEAP32[(3328)>>2]|0;
         $472 = 1 << $I7$0$i;
         $473 = $471 & $472;
         $474 = ($473|0)==(0);
         if ($474) {
          $475 = $471 | $472;
          HEAP32[(3328)>>2] = $475;
          HEAP32[$467>>2] = $351;
          $476 = ((($351)) + 24|0);
          HEAP32[$476>>2] = $467;
          $477 = ((($351)) + 12|0);
          HEAP32[$477>>2] = $351;
          $478 = ((($351)) + 8|0);
          HEAP32[$478>>2] = $351;
          break;
         }
         $479 = HEAP32[$467>>2]|0;
         $480 = ($I7$0$i|0)==(31);
         $481 = $I7$0$i >>> 1;
         $482 = (25 - ($481))|0;
         $483 = $480 ? 0 : $482;
         $484 = $rsize$4$lcssa$i << $483;
         $K12$0$i = $484;$T$0$i = $479;
         while(1) {
          $485 = ((($T$0$i)) + 4|0);
          $486 = HEAP32[$485>>2]|0;
          $487 = $486 & -8;
          $488 = ($487|0)==($rsize$4$lcssa$i|0);
          if ($488) {
           $T$0$i$lcssa = $T$0$i;
           label = 148;
           break;
          }
          $489 = $K12$0$i >>> 31;
          $490 = (((($T$0$i)) + 16|0) + ($489<<2)|0);
          $491 = $K12$0$i << 1;
          $492 = HEAP32[$490>>2]|0;
          $493 = ($492|0)==(0|0);
          if ($493) {
           $$lcssa157 = $490;$T$0$i$lcssa156 = $T$0$i;
           label = 145;
           break;
          } else {
           $K12$0$i = $491;$T$0$i = $492;
          }
         }
         if ((label|0) == 145) {
          $494 = HEAP32[(3340)>>2]|0;
          $495 = ($$lcssa157>>>0)<($494>>>0);
          if ($495) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$$lcssa157>>2] = $351;
           $496 = ((($351)) + 24|0);
           HEAP32[$496>>2] = $T$0$i$lcssa156;
           $497 = ((($351)) + 12|0);
           HEAP32[$497>>2] = $351;
           $498 = ((($351)) + 8|0);
           HEAP32[$498>>2] = $351;
           break;
          }
         }
         else if ((label|0) == 148) {
          $499 = ((($T$0$i$lcssa)) + 8|0);
          $500 = HEAP32[$499>>2]|0;
          $501 = HEAP32[(3340)>>2]|0;
          $502 = ($500>>>0)>=($501>>>0);
          $not$7$i = ($T$0$i$lcssa>>>0)>=($501>>>0);
          $503 = $502 & $not$7$i;
          if ($503) {
           $504 = ((($500)) + 12|0);
           HEAP32[$504>>2] = $351;
           HEAP32[$499>>2] = $351;
           $505 = ((($351)) + 8|0);
           HEAP32[$505>>2] = $500;
           $506 = ((($351)) + 12|0);
           HEAP32[$506>>2] = $T$0$i$lcssa;
           $507 = ((($351)) + 24|0);
           HEAP32[$507>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $508 = ((($v$4$lcssa$i)) + 8|0);
       $$0 = $508;
       return ($$0|0);
      } else {
       $nb$0 = $248;
      }
     }
    }
   }
  }
 } while(0);
 $509 = HEAP32[(3332)>>2]|0;
 $510 = ($509>>>0)<($nb$0>>>0);
 if (!($510)) {
  $511 = (($509) - ($nb$0))|0;
  $512 = HEAP32[(3344)>>2]|0;
  $513 = ($511>>>0)>(15);
  if ($513) {
   $514 = (($512) + ($nb$0)|0);
   HEAP32[(3344)>>2] = $514;
   HEAP32[(3332)>>2] = $511;
   $515 = $511 | 1;
   $516 = ((($514)) + 4|0);
   HEAP32[$516>>2] = $515;
   $517 = (($514) + ($511)|0);
   HEAP32[$517>>2] = $511;
   $518 = $nb$0 | 3;
   $519 = ((($512)) + 4|0);
   HEAP32[$519>>2] = $518;
  } else {
   HEAP32[(3332)>>2] = 0;
   HEAP32[(3344)>>2] = 0;
   $520 = $509 | 3;
   $521 = ((($512)) + 4|0);
   HEAP32[$521>>2] = $520;
   $522 = (($512) + ($509)|0);
   $523 = ((($522)) + 4|0);
   $524 = HEAP32[$523>>2]|0;
   $525 = $524 | 1;
   HEAP32[$523>>2] = $525;
  }
  $526 = ((($512)) + 8|0);
  $$0 = $526;
  return ($$0|0);
 }
 $527 = HEAP32[(3336)>>2]|0;
 $528 = ($527>>>0)>($nb$0>>>0);
 if ($528) {
  $529 = (($527) - ($nb$0))|0;
  HEAP32[(3336)>>2] = $529;
  $530 = HEAP32[(3348)>>2]|0;
  $531 = (($530) + ($nb$0)|0);
  HEAP32[(3348)>>2] = $531;
  $532 = $529 | 1;
  $533 = ((($531)) + 4|0);
  HEAP32[$533>>2] = $532;
  $534 = $nb$0 | 3;
  $535 = ((($530)) + 4|0);
  HEAP32[$535>>2] = $534;
  $536 = ((($530)) + 8|0);
  $$0 = $536;
  return ($$0|0);
 }
 $537 = HEAP32[949]|0;
 $538 = ($537|0)==(0);
 do {
  if ($538) {
   $539 = (_sysconf(30)|0);
   $540 = (($539) + -1)|0;
   $541 = $540 & $539;
   $542 = ($541|0)==(0);
   if ($542) {
    HEAP32[(3804)>>2] = $539;
    HEAP32[(3800)>>2] = $539;
    HEAP32[(3808)>>2] = -1;
    HEAP32[(3812)>>2] = -1;
    HEAP32[(3816)>>2] = 0;
    HEAP32[(3768)>>2] = 0;
    $543 = (_time((0|0))|0);
    $544 = $543 & -16;
    $545 = $544 ^ 1431655768;
    HEAP32[949] = $545;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $546 = (($nb$0) + 48)|0;
 $547 = HEAP32[(3804)>>2]|0;
 $548 = (($nb$0) + 47)|0;
 $549 = (($547) + ($548))|0;
 $550 = (0 - ($547))|0;
 $551 = $549 & $550;
 $552 = ($551>>>0)>($nb$0>>>0);
 if (!($552)) {
  $$0 = 0;
  return ($$0|0);
 }
 $553 = HEAP32[(3764)>>2]|0;
 $554 = ($553|0)==(0);
 if (!($554)) {
  $555 = HEAP32[(3756)>>2]|0;
  $556 = (($555) + ($551))|0;
  $557 = ($556>>>0)<=($555>>>0);
  $558 = ($556>>>0)>($553>>>0);
  $or$cond1$i16 = $557 | $558;
  if ($or$cond1$i16) {
   $$0 = 0;
   return ($$0|0);
  }
 }
 $559 = HEAP32[(3768)>>2]|0;
 $560 = $559 & 4;
 $561 = ($560|0)==(0);
 L257: do {
  if ($561) {
   $562 = HEAP32[(3348)>>2]|0;
   $563 = ($562|0)==(0|0);
   L259: do {
    if ($563) {
     label = 173;
    } else {
     $sp$0$i$i = (3772);
     while(1) {
      $564 = HEAP32[$sp$0$i$i>>2]|0;
      $565 = ($564>>>0)>($562>>>0);
      if (!($565)) {
       $566 = ((($sp$0$i$i)) + 4|0);
       $567 = HEAP32[$566>>2]|0;
       $568 = (($564) + ($567)|0);
       $569 = ($568>>>0)>($562>>>0);
       if ($569) {
        $$lcssa153 = $sp$0$i$i;$$lcssa155 = $566;
        break;
       }
      }
      $570 = ((($sp$0$i$i)) + 8|0);
      $571 = HEAP32[$570>>2]|0;
      $572 = ($571|0)==(0|0);
      if ($572) {
       label = 173;
       break L259;
      } else {
       $sp$0$i$i = $571;
      }
     }
     $595 = HEAP32[(3336)>>2]|0;
     $596 = (($549) - ($595))|0;
     $597 = $596 & $550;
     $598 = ($597>>>0)<(2147483647);
     if ($598) {
      $599 = (_sbrk(($597|0))|0);
      $600 = HEAP32[$$lcssa153>>2]|0;
      $601 = HEAP32[$$lcssa155>>2]|0;
      $602 = (($600) + ($601)|0);
      $603 = ($599|0)==($602|0);
      if ($603) {
       $604 = ($599|0)==((-1)|0);
       if (!($604)) {
        $tbase$746$i = $599;$tsize$745$i = $597;
        label = 193;
        break L257;
       }
      } else {
       $br$2$ph$i = $599;$ssize$2$ph$i = $597;
       label = 183;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 173) {
     $573 = (_sbrk(0)|0);
     $574 = ($573|0)==((-1)|0);
     if (!($574)) {
      $575 = $573;
      $576 = HEAP32[(3800)>>2]|0;
      $577 = (($576) + -1)|0;
      $578 = $577 & $575;
      $579 = ($578|0)==(0);
      if ($579) {
       $ssize$0$i = $551;
      } else {
       $580 = (($577) + ($575))|0;
       $581 = (0 - ($576))|0;
       $582 = $580 & $581;
       $583 = (($551) - ($575))|0;
       $584 = (($583) + ($582))|0;
       $ssize$0$i = $584;
      }
      $585 = HEAP32[(3756)>>2]|0;
      $586 = (($585) + ($ssize$0$i))|0;
      $587 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $588 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i17 = $587 & $588;
      if ($or$cond$i17) {
       $589 = HEAP32[(3764)>>2]|0;
       $590 = ($589|0)==(0);
       if (!($590)) {
        $591 = ($586>>>0)<=($585>>>0);
        $592 = ($586>>>0)>($589>>>0);
        $or$cond2$i = $591 | $592;
        if ($or$cond2$i) {
         break;
        }
       }
       $593 = (_sbrk(($ssize$0$i|0))|0);
       $594 = ($593|0)==($573|0);
       if ($594) {
        $tbase$746$i = $573;$tsize$745$i = $ssize$0$i;
        label = 193;
        break L257;
       } else {
        $br$2$ph$i = $593;$ssize$2$ph$i = $ssize$0$i;
        label = 183;
       }
      }
     }
    }
   } while(0);
   L279: do {
    if ((label|0) == 183) {
     $605 = (0 - ($ssize$2$ph$i))|0;
     $606 = ($br$2$ph$i|0)!=((-1)|0);
     $607 = ($ssize$2$ph$i>>>0)<(2147483647);
     $or$cond7$i = $607 & $606;
     $608 = ($546>>>0)>($ssize$2$ph$i>>>0);
     $or$cond8$i = $608 & $or$cond7$i;
     do {
      if ($or$cond8$i) {
       $609 = HEAP32[(3804)>>2]|0;
       $610 = (($548) - ($ssize$2$ph$i))|0;
       $611 = (($610) + ($609))|0;
       $612 = (0 - ($609))|0;
       $613 = $611 & $612;
       $614 = ($613>>>0)<(2147483647);
       if ($614) {
        $615 = (_sbrk(($613|0))|0);
        $616 = ($615|0)==((-1)|0);
        if ($616) {
         (_sbrk(($605|0))|0);
         break L279;
        } else {
         $617 = (($613) + ($ssize$2$ph$i))|0;
         $ssize$5$i = $617;
         break;
        }
       } else {
        $ssize$5$i = $ssize$2$ph$i;
       }
      } else {
       $ssize$5$i = $ssize$2$ph$i;
      }
     } while(0);
     $618 = ($br$2$ph$i|0)==((-1)|0);
     if (!($618)) {
      $tbase$746$i = $br$2$ph$i;$tsize$745$i = $ssize$5$i;
      label = 193;
      break L257;
     }
    }
   } while(0);
   $619 = HEAP32[(3768)>>2]|0;
   $620 = $619 | 4;
   HEAP32[(3768)>>2] = $620;
   label = 190;
  } else {
   label = 190;
  }
 } while(0);
 if ((label|0) == 190) {
  $621 = ($551>>>0)<(2147483647);
  if ($621) {
   $622 = (_sbrk(($551|0))|0);
   $623 = (_sbrk(0)|0);
   $624 = ($622|0)!=((-1)|0);
   $625 = ($623|0)!=((-1)|0);
   $or$cond5$i = $624 & $625;
   $626 = ($622>>>0)<($623>>>0);
   $or$cond10$i = $626 & $or$cond5$i;
   if ($or$cond10$i) {
    $627 = $623;
    $628 = $622;
    $629 = (($627) - ($628))|0;
    $630 = (($nb$0) + 40)|0;
    $$not$i = ($629>>>0)>($630>>>0);
    if ($$not$i) {
     $tbase$746$i = $622;$tsize$745$i = $629;
     label = 193;
    }
   }
  }
 }
 if ((label|0) == 193) {
  $631 = HEAP32[(3756)>>2]|0;
  $632 = (($631) + ($tsize$745$i))|0;
  HEAP32[(3756)>>2] = $632;
  $633 = HEAP32[(3760)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(3760)>>2] = $632;
  }
  $635 = HEAP32[(3348)>>2]|0;
  $636 = ($635|0)==(0|0);
  do {
   if ($636) {
    $637 = HEAP32[(3340)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($tbase$746$i>>>0)<($637>>>0);
    $or$cond11$i = $638 | $639;
    if ($or$cond11$i) {
     HEAP32[(3340)>>2] = $tbase$746$i;
    }
    HEAP32[(3772)>>2] = $tbase$746$i;
    HEAP32[(3776)>>2] = $tsize$745$i;
    HEAP32[(3784)>>2] = 0;
    $640 = HEAP32[949]|0;
    HEAP32[(3360)>>2] = $640;
    HEAP32[(3356)>>2] = -1;
    $i$01$i$i = 0;
    while(1) {
     $641 = $i$01$i$i << 1;
     $642 = (3364 + ($641<<2)|0);
     $643 = ((($642)) + 12|0);
     HEAP32[$643>>2] = $642;
     $644 = ((($642)) + 8|0);
     HEAP32[$644>>2] = $642;
     $645 = (($i$01$i$i) + 1)|0;
     $exitcond$i$i = ($645|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$01$i$i = $645;
     }
    }
    $646 = (($tsize$745$i) + -40)|0;
    $647 = ((($tbase$746$i)) + 8|0);
    $648 = $647;
    $649 = $648 & 7;
    $650 = ($649|0)==(0);
    $651 = (0 - ($648))|0;
    $652 = $651 & 7;
    $653 = $650 ? 0 : $652;
    $654 = (($tbase$746$i) + ($653)|0);
    $655 = (($646) - ($653))|0;
    HEAP32[(3348)>>2] = $654;
    HEAP32[(3336)>>2] = $655;
    $656 = $655 | 1;
    $657 = ((($654)) + 4|0);
    HEAP32[$657>>2] = $656;
    $658 = (($654) + ($655)|0);
    $659 = ((($658)) + 4|0);
    HEAP32[$659>>2] = 40;
    $660 = HEAP32[(3812)>>2]|0;
    HEAP32[(3352)>>2] = $660;
   } else {
    $sp$068$i = (3772);
    while(1) {
     $661 = HEAP32[$sp$068$i>>2]|0;
     $662 = ((($sp$068$i)) + 4|0);
     $663 = HEAP32[$662>>2]|0;
     $664 = (($661) + ($663)|0);
     $665 = ($tbase$746$i|0)==($664|0);
     if ($665) {
      $$lcssa147 = $661;$$lcssa149 = $662;$$lcssa151 = $663;$sp$068$i$lcssa = $sp$068$i;
      label = 203;
      break;
     }
     $666 = ((($sp$068$i)) + 8|0);
     $667 = HEAP32[$666>>2]|0;
     $668 = ($667|0)==(0|0);
     if ($668) {
      break;
     } else {
      $sp$068$i = $667;
     }
    }
    if ((label|0) == 203) {
     $669 = ((($sp$068$i$lcssa)) + 12|0);
     $670 = HEAP32[$669>>2]|0;
     $671 = $670 & 8;
     $672 = ($671|0)==(0);
     if ($672) {
      $673 = ($635>>>0)>=($$lcssa147>>>0);
      $674 = ($635>>>0)<($tbase$746$i>>>0);
      $or$cond48$i = $674 & $673;
      if ($or$cond48$i) {
       $675 = (($$lcssa151) + ($tsize$745$i))|0;
       HEAP32[$$lcssa149>>2] = $675;
       $676 = HEAP32[(3336)>>2]|0;
       $677 = ((($635)) + 8|0);
       $678 = $677;
       $679 = $678 & 7;
       $680 = ($679|0)==(0);
       $681 = (0 - ($678))|0;
       $682 = $681 & 7;
       $683 = $680 ? 0 : $682;
       $684 = (($635) + ($683)|0);
       $685 = (($tsize$745$i) - ($683))|0;
       $686 = (($685) + ($676))|0;
       HEAP32[(3348)>>2] = $684;
       HEAP32[(3336)>>2] = $686;
       $687 = $686 | 1;
       $688 = ((($684)) + 4|0);
       HEAP32[$688>>2] = $687;
       $689 = (($684) + ($686)|0);
       $690 = ((($689)) + 4|0);
       HEAP32[$690>>2] = 40;
       $691 = HEAP32[(3812)>>2]|0;
       HEAP32[(3352)>>2] = $691;
       break;
      }
     }
    }
    $692 = HEAP32[(3340)>>2]|0;
    $693 = ($tbase$746$i>>>0)<($692>>>0);
    if ($693) {
     HEAP32[(3340)>>2] = $tbase$746$i;
     $757 = $tbase$746$i;
    } else {
     $757 = $692;
    }
    $694 = (($tbase$746$i) + ($tsize$745$i)|0);
    $sp$167$i = (3772);
    while(1) {
     $695 = HEAP32[$sp$167$i>>2]|0;
     $696 = ($695|0)==($694|0);
     if ($696) {
      $$lcssa144 = $sp$167$i;$sp$167$i$lcssa = $sp$167$i;
      label = 211;
      break;
     }
     $697 = ((($sp$167$i)) + 8|0);
     $698 = HEAP32[$697>>2]|0;
     $699 = ($698|0)==(0|0);
     if ($699) {
      $sp$0$i$i$i = (3772);
      break;
     } else {
      $sp$167$i = $698;
     }
    }
    if ((label|0) == 211) {
     $700 = ((($sp$167$i$lcssa)) + 12|0);
     $701 = HEAP32[$700>>2]|0;
     $702 = $701 & 8;
     $703 = ($702|0)==(0);
     if ($703) {
      HEAP32[$$lcssa144>>2] = $tbase$746$i;
      $704 = ((($sp$167$i$lcssa)) + 4|0);
      $705 = HEAP32[$704>>2]|0;
      $706 = (($705) + ($tsize$745$i))|0;
      HEAP32[$704>>2] = $706;
      $707 = ((($tbase$746$i)) + 8|0);
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709|0)==(0);
      $711 = (0 - ($708))|0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = (($tbase$746$i) + ($713)|0);
      $715 = ((($694)) + 8|0);
      $716 = $715;
      $717 = $716 & 7;
      $718 = ($717|0)==(0);
      $719 = (0 - ($716))|0;
      $720 = $719 & 7;
      $721 = $718 ? 0 : $720;
      $722 = (($694) + ($721)|0);
      $723 = $722;
      $724 = $714;
      $725 = (($723) - ($724))|0;
      $726 = (($714) + ($nb$0)|0);
      $727 = (($725) - ($nb$0))|0;
      $728 = $nb$0 | 3;
      $729 = ((($714)) + 4|0);
      HEAP32[$729>>2] = $728;
      $730 = ($722|0)==($635|0);
      do {
       if ($730) {
        $731 = HEAP32[(3336)>>2]|0;
        $732 = (($731) + ($727))|0;
        HEAP32[(3336)>>2] = $732;
        HEAP32[(3348)>>2] = $726;
        $733 = $732 | 1;
        $734 = ((($726)) + 4|0);
        HEAP32[$734>>2] = $733;
       } else {
        $735 = HEAP32[(3344)>>2]|0;
        $736 = ($722|0)==($735|0);
        if ($736) {
         $737 = HEAP32[(3332)>>2]|0;
         $738 = (($737) + ($727))|0;
         HEAP32[(3332)>>2] = $738;
         HEAP32[(3344)>>2] = $726;
         $739 = $738 | 1;
         $740 = ((($726)) + 4|0);
         HEAP32[$740>>2] = $739;
         $741 = (($726) + ($738)|0);
         HEAP32[$741>>2] = $738;
         break;
        }
        $742 = ((($722)) + 4|0);
        $743 = HEAP32[$742>>2]|0;
        $744 = $743 & 3;
        $745 = ($744|0)==(1);
        if ($745) {
         $746 = $743 & -8;
         $747 = $743 >>> 3;
         $748 = ($743>>>0)<(256);
         L331: do {
          if ($748) {
           $749 = ((($722)) + 8|0);
           $750 = HEAP32[$749>>2]|0;
           $751 = ((($722)) + 12|0);
           $752 = HEAP32[$751>>2]|0;
           $753 = $747 << 1;
           $754 = (3364 + ($753<<2)|0);
           $755 = ($750|0)==($754|0);
           do {
            if (!($755)) {
             $756 = ($750>>>0)<($757>>>0);
             if ($756) {
              _abort();
              // unreachable;
             }
             $758 = ((($750)) + 12|0);
             $759 = HEAP32[$758>>2]|0;
             $760 = ($759|0)==($722|0);
             if ($760) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $761 = ($752|0)==($750|0);
           if ($761) {
            $762 = 1 << $747;
            $763 = $762 ^ -1;
            $764 = HEAP32[831]|0;
            $765 = $764 & $763;
            HEAP32[831] = $765;
            break;
           }
           $766 = ($752|0)==($754|0);
           do {
            if ($766) {
             $$pre9$i$i = ((($752)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $767 = ($752>>>0)<($757>>>0);
             if ($767) {
              _abort();
              // unreachable;
             }
             $768 = ((($752)) + 8|0);
             $769 = HEAP32[$768>>2]|0;
             $770 = ($769|0)==($722|0);
             if ($770) {
              $$pre$phi10$i$iZ2D = $768;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $771 = ((($750)) + 12|0);
           HEAP32[$771>>2] = $752;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $750;
          } else {
           $772 = ((($722)) + 24|0);
           $773 = HEAP32[$772>>2]|0;
           $774 = ((($722)) + 12|0);
           $775 = HEAP32[$774>>2]|0;
           $776 = ($775|0)==($722|0);
           do {
            if ($776) {
             $786 = ((($722)) + 16|0);
             $787 = ((($786)) + 4|0);
             $788 = HEAP32[$787>>2]|0;
             $789 = ($788|0)==(0|0);
             if ($789) {
              $790 = HEAP32[$786>>2]|0;
              $791 = ($790|0)==(0|0);
              if ($791) {
               $R$3$i$i = 0;
               break;
              } else {
               $R$1$i$i = $790;$RP$1$i$i = $786;
              }
             } else {
              $R$1$i$i = $788;$RP$1$i$i = $787;
             }
             while(1) {
              $792 = ((($R$1$i$i)) + 20|0);
              $793 = HEAP32[$792>>2]|0;
              $794 = ($793|0)==(0|0);
              if (!($794)) {
               $R$1$i$i = $793;$RP$1$i$i = $792;
               continue;
              }
              $795 = ((($R$1$i$i)) + 16|0);
              $796 = HEAP32[$795>>2]|0;
              $797 = ($796|0)==(0|0);
              if ($797) {
               $R$1$i$i$lcssa = $R$1$i$i;$RP$1$i$i$lcssa = $RP$1$i$i;
               break;
              } else {
               $R$1$i$i = $796;$RP$1$i$i = $795;
              }
             }
             $798 = ($RP$1$i$i$lcssa>>>0)<($757>>>0);
             if ($798) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$1$i$i$lcssa>>2] = 0;
              $R$3$i$i = $R$1$i$i$lcssa;
              break;
             }
            } else {
             $777 = ((($722)) + 8|0);
             $778 = HEAP32[$777>>2]|0;
             $779 = ($778>>>0)<($757>>>0);
             if ($779) {
              _abort();
              // unreachable;
             }
             $780 = ((($778)) + 12|0);
             $781 = HEAP32[$780>>2]|0;
             $782 = ($781|0)==($722|0);
             if (!($782)) {
              _abort();
              // unreachable;
             }
             $783 = ((($775)) + 8|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==($722|0);
             if ($785) {
              HEAP32[$780>>2] = $775;
              HEAP32[$783>>2] = $778;
              $R$3$i$i = $775;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $799 = ($773|0)==(0|0);
           if ($799) {
            break;
           }
           $800 = ((($722)) + 28|0);
           $801 = HEAP32[$800>>2]|0;
           $802 = (3628 + ($801<<2)|0);
           $803 = HEAP32[$802>>2]|0;
           $804 = ($722|0)==($803|0);
           do {
            if ($804) {
             HEAP32[$802>>2] = $R$3$i$i;
             $cond$i$i = ($R$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $805 = 1 << $801;
             $806 = $805 ^ -1;
             $807 = HEAP32[(3328)>>2]|0;
             $808 = $807 & $806;
             HEAP32[(3328)>>2] = $808;
             break L331;
            } else {
             $809 = HEAP32[(3340)>>2]|0;
             $810 = ($773>>>0)<($809>>>0);
             if ($810) {
              _abort();
              // unreachable;
             }
             $811 = ((($773)) + 16|0);
             $812 = HEAP32[$811>>2]|0;
             $813 = ($812|0)==($722|0);
             if ($813) {
              HEAP32[$811>>2] = $R$3$i$i;
             } else {
              $814 = ((($773)) + 20|0);
              HEAP32[$814>>2] = $R$3$i$i;
             }
             $815 = ($R$3$i$i|0)==(0|0);
             if ($815) {
              break L331;
             }
            }
           } while(0);
           $816 = HEAP32[(3340)>>2]|0;
           $817 = ($R$3$i$i>>>0)<($816>>>0);
           if ($817) {
            _abort();
            // unreachable;
           }
           $818 = ((($R$3$i$i)) + 24|0);
           HEAP32[$818>>2] = $773;
           $819 = ((($722)) + 16|0);
           $820 = HEAP32[$819>>2]|0;
           $821 = ($820|0)==(0|0);
           do {
            if (!($821)) {
             $822 = ($820>>>0)<($816>>>0);
             if ($822) {
              _abort();
              // unreachable;
             } else {
              $823 = ((($R$3$i$i)) + 16|0);
              HEAP32[$823>>2] = $820;
              $824 = ((($820)) + 24|0);
              HEAP32[$824>>2] = $R$3$i$i;
              break;
             }
            }
           } while(0);
           $825 = ((($819)) + 4|0);
           $826 = HEAP32[$825>>2]|0;
           $827 = ($826|0)==(0|0);
           if ($827) {
            break;
           }
           $828 = HEAP32[(3340)>>2]|0;
           $829 = ($826>>>0)<($828>>>0);
           if ($829) {
            _abort();
            // unreachable;
           } else {
            $830 = ((($R$3$i$i)) + 20|0);
            HEAP32[$830>>2] = $826;
            $831 = ((($826)) + 24|0);
            HEAP32[$831>>2] = $R$3$i$i;
            break;
           }
          }
         } while(0);
         $832 = (($722) + ($746)|0);
         $833 = (($746) + ($727))|0;
         $oldfirst$0$i$i = $832;$qsize$0$i$i = $833;
        } else {
         $oldfirst$0$i$i = $722;$qsize$0$i$i = $727;
        }
        $834 = ((($oldfirst$0$i$i)) + 4|0);
        $835 = HEAP32[$834>>2]|0;
        $836 = $835 & -2;
        HEAP32[$834>>2] = $836;
        $837 = $qsize$0$i$i | 1;
        $838 = ((($726)) + 4|0);
        HEAP32[$838>>2] = $837;
        $839 = (($726) + ($qsize$0$i$i)|0);
        HEAP32[$839>>2] = $qsize$0$i$i;
        $840 = $qsize$0$i$i >>> 3;
        $841 = ($qsize$0$i$i>>>0)<(256);
        if ($841) {
         $842 = $840 << 1;
         $843 = (3364 + ($842<<2)|0);
         $844 = HEAP32[831]|0;
         $845 = 1 << $840;
         $846 = $844 & $845;
         $847 = ($846|0)==(0);
         do {
          if ($847) {
           $848 = $844 | $845;
           HEAP32[831] = $848;
           $$pre$i16$i = ((($843)) + 8|0);
           $$pre$phi$i17$iZ2D = $$pre$i16$i;$F4$0$i$i = $843;
          } else {
           $849 = ((($843)) + 8|0);
           $850 = HEAP32[$849>>2]|0;
           $851 = HEAP32[(3340)>>2]|0;
           $852 = ($850>>>0)<($851>>>0);
           if (!($852)) {
            $$pre$phi$i17$iZ2D = $849;$F4$0$i$i = $850;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $726;
         $853 = ((($F4$0$i$i)) + 12|0);
         HEAP32[$853>>2] = $726;
         $854 = ((($726)) + 8|0);
         HEAP32[$854>>2] = $F4$0$i$i;
         $855 = ((($726)) + 12|0);
         HEAP32[$855>>2] = $843;
         break;
        }
        $856 = $qsize$0$i$i >>> 8;
        $857 = ($856|0)==(0);
        do {
         if ($857) {
          $I7$0$i$i = 0;
         } else {
          $858 = ($qsize$0$i$i>>>0)>(16777215);
          if ($858) {
           $I7$0$i$i = 31;
           break;
          }
          $859 = (($856) + 1048320)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 8;
          $862 = $856 << $861;
          $863 = (($862) + 520192)|0;
          $864 = $863 >>> 16;
          $865 = $864 & 4;
          $866 = $865 | $861;
          $867 = $862 << $865;
          $868 = (($867) + 245760)|0;
          $869 = $868 >>> 16;
          $870 = $869 & 2;
          $871 = $866 | $870;
          $872 = (14 - ($871))|0;
          $873 = $867 << $870;
          $874 = $873 >>> 15;
          $875 = (($872) + ($874))|0;
          $876 = $875 << 1;
          $877 = (($875) + 7)|0;
          $878 = $qsize$0$i$i >>> $877;
          $879 = $878 & 1;
          $880 = $879 | $876;
          $I7$0$i$i = $880;
         }
        } while(0);
        $881 = (3628 + ($I7$0$i$i<<2)|0);
        $882 = ((($726)) + 28|0);
        HEAP32[$882>>2] = $I7$0$i$i;
        $883 = ((($726)) + 16|0);
        $884 = ((($883)) + 4|0);
        HEAP32[$884>>2] = 0;
        HEAP32[$883>>2] = 0;
        $885 = HEAP32[(3328)>>2]|0;
        $886 = 1 << $I7$0$i$i;
        $887 = $885 & $886;
        $888 = ($887|0)==(0);
        if ($888) {
         $889 = $885 | $886;
         HEAP32[(3328)>>2] = $889;
         HEAP32[$881>>2] = $726;
         $890 = ((($726)) + 24|0);
         HEAP32[$890>>2] = $881;
         $891 = ((($726)) + 12|0);
         HEAP32[$891>>2] = $726;
         $892 = ((($726)) + 8|0);
         HEAP32[$892>>2] = $726;
         break;
        }
        $893 = HEAP32[$881>>2]|0;
        $894 = ($I7$0$i$i|0)==(31);
        $895 = $I7$0$i$i >>> 1;
        $896 = (25 - ($895))|0;
        $897 = $894 ? 0 : $896;
        $898 = $qsize$0$i$i << $897;
        $K8$0$i$i = $898;$T$0$i18$i = $893;
        while(1) {
         $899 = ((($T$0$i18$i)) + 4|0);
         $900 = HEAP32[$899>>2]|0;
         $901 = $900 & -8;
         $902 = ($901|0)==($qsize$0$i$i|0);
         if ($902) {
          $T$0$i18$i$lcssa = $T$0$i18$i;
          label = 281;
          break;
         }
         $903 = $K8$0$i$i >>> 31;
         $904 = (((($T$0$i18$i)) + 16|0) + ($903<<2)|0);
         $905 = $K8$0$i$i << 1;
         $906 = HEAP32[$904>>2]|0;
         $907 = ($906|0)==(0|0);
         if ($907) {
          $$lcssa = $904;$T$0$i18$i$lcssa139 = $T$0$i18$i;
          label = 278;
          break;
         } else {
          $K8$0$i$i = $905;$T$0$i18$i = $906;
         }
        }
        if ((label|0) == 278) {
         $908 = HEAP32[(3340)>>2]|0;
         $909 = ($$lcssa>>>0)<($908>>>0);
         if ($909) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$lcssa>>2] = $726;
          $910 = ((($726)) + 24|0);
          HEAP32[$910>>2] = $T$0$i18$i$lcssa139;
          $911 = ((($726)) + 12|0);
          HEAP32[$911>>2] = $726;
          $912 = ((($726)) + 8|0);
          HEAP32[$912>>2] = $726;
          break;
         }
        }
        else if ((label|0) == 281) {
         $913 = ((($T$0$i18$i$lcssa)) + 8|0);
         $914 = HEAP32[$913>>2]|0;
         $915 = HEAP32[(3340)>>2]|0;
         $916 = ($914>>>0)>=($915>>>0);
         $not$$i20$i = ($T$0$i18$i$lcssa>>>0)>=($915>>>0);
         $917 = $916 & $not$$i20$i;
         if ($917) {
          $918 = ((($914)) + 12|0);
          HEAP32[$918>>2] = $726;
          HEAP32[$913>>2] = $726;
          $919 = ((($726)) + 8|0);
          HEAP32[$919>>2] = $914;
          $920 = ((($726)) + 12|0);
          HEAP32[$920>>2] = $T$0$i18$i$lcssa;
          $921 = ((($726)) + 24|0);
          HEAP32[$921>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1052 = ((($714)) + 8|0);
      $$0 = $1052;
      return ($$0|0);
     } else {
      $sp$0$i$i$i = (3772);
     }
    }
    while(1) {
     $922 = HEAP32[$sp$0$i$i$i>>2]|0;
     $923 = ($922>>>0)>($635>>>0);
     if (!($923)) {
      $924 = ((($sp$0$i$i$i)) + 4|0);
      $925 = HEAP32[$924>>2]|0;
      $926 = (($922) + ($925)|0);
      $927 = ($926>>>0)>($635>>>0);
      if ($927) {
       $$lcssa142 = $926;
       break;
      }
     }
     $928 = ((($sp$0$i$i$i)) + 8|0);
     $929 = HEAP32[$928>>2]|0;
     $sp$0$i$i$i = $929;
    }
    $930 = ((($$lcssa142)) + -47|0);
    $931 = ((($930)) + 8|0);
    $932 = $931;
    $933 = $932 & 7;
    $934 = ($933|0)==(0);
    $935 = (0 - ($932))|0;
    $936 = $935 & 7;
    $937 = $934 ? 0 : $936;
    $938 = (($930) + ($937)|0);
    $939 = ((($635)) + 16|0);
    $940 = ($938>>>0)<($939>>>0);
    $941 = $940 ? $635 : $938;
    $942 = ((($941)) + 8|0);
    $943 = ((($941)) + 24|0);
    $944 = (($tsize$745$i) + -40)|0;
    $945 = ((($tbase$746$i)) + 8|0);
    $946 = $945;
    $947 = $946 & 7;
    $948 = ($947|0)==(0);
    $949 = (0 - ($946))|0;
    $950 = $949 & 7;
    $951 = $948 ? 0 : $950;
    $952 = (($tbase$746$i) + ($951)|0);
    $953 = (($944) - ($951))|0;
    HEAP32[(3348)>>2] = $952;
    HEAP32[(3336)>>2] = $953;
    $954 = $953 | 1;
    $955 = ((($952)) + 4|0);
    HEAP32[$955>>2] = $954;
    $956 = (($952) + ($953)|0);
    $957 = ((($956)) + 4|0);
    HEAP32[$957>>2] = 40;
    $958 = HEAP32[(3812)>>2]|0;
    HEAP32[(3352)>>2] = $958;
    $959 = ((($941)) + 4|0);
    HEAP32[$959>>2] = 27;
    ;HEAP32[$942>>2]=HEAP32[(3772)>>2]|0;HEAP32[$942+4>>2]=HEAP32[(3772)+4>>2]|0;HEAP32[$942+8>>2]=HEAP32[(3772)+8>>2]|0;HEAP32[$942+12>>2]=HEAP32[(3772)+12>>2]|0;
    HEAP32[(3772)>>2] = $tbase$746$i;
    HEAP32[(3776)>>2] = $tsize$745$i;
    HEAP32[(3784)>>2] = 0;
    HEAP32[(3780)>>2] = $942;
    $p$0$i$i = $943;
    while(1) {
     $960 = ((($p$0$i$i)) + 4|0);
     HEAP32[$960>>2] = 7;
     $961 = ((($960)) + 4|0);
     $962 = ($961>>>0)<($$lcssa142>>>0);
     if ($962) {
      $p$0$i$i = $960;
     } else {
      break;
     }
    }
    $963 = ($941|0)==($635|0);
    if (!($963)) {
     $964 = $941;
     $965 = $635;
     $966 = (($964) - ($965))|0;
     $967 = HEAP32[$959>>2]|0;
     $968 = $967 & -2;
     HEAP32[$959>>2] = $968;
     $969 = $966 | 1;
     $970 = ((($635)) + 4|0);
     HEAP32[$970>>2] = $969;
     HEAP32[$941>>2] = $966;
     $971 = $966 >>> 3;
     $972 = ($966>>>0)<(256);
     if ($972) {
      $973 = $971 << 1;
      $974 = (3364 + ($973<<2)|0);
      $975 = HEAP32[831]|0;
      $976 = 1 << $971;
      $977 = $975 & $976;
      $978 = ($977|0)==(0);
      if ($978) {
       $979 = $975 | $976;
       HEAP32[831] = $979;
       $$pre$i$i = ((($974)) + 8|0);
       $$pre$phi$i$iZ2D = $$pre$i$i;$F$0$i$i = $974;
      } else {
       $980 = ((($974)) + 8|0);
       $981 = HEAP32[$980>>2]|0;
       $982 = HEAP32[(3340)>>2]|0;
       $983 = ($981>>>0)<($982>>>0);
       if ($983) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $980;$F$0$i$i = $981;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $984 = ((($F$0$i$i)) + 12|0);
      HEAP32[$984>>2] = $635;
      $985 = ((($635)) + 8|0);
      HEAP32[$985>>2] = $F$0$i$i;
      $986 = ((($635)) + 12|0);
      HEAP32[$986>>2] = $974;
      break;
     }
     $987 = $966 >>> 8;
     $988 = ($987|0)==(0);
     if ($988) {
      $I1$0$i$i = 0;
     } else {
      $989 = ($966>>>0)>(16777215);
      if ($989) {
       $I1$0$i$i = 31;
      } else {
       $990 = (($987) + 1048320)|0;
       $991 = $990 >>> 16;
       $992 = $991 & 8;
       $993 = $987 << $992;
       $994 = (($993) + 520192)|0;
       $995 = $994 >>> 16;
       $996 = $995 & 4;
       $997 = $996 | $992;
       $998 = $993 << $996;
       $999 = (($998) + 245760)|0;
       $1000 = $999 >>> 16;
       $1001 = $1000 & 2;
       $1002 = $997 | $1001;
       $1003 = (14 - ($1002))|0;
       $1004 = $998 << $1001;
       $1005 = $1004 >>> 15;
       $1006 = (($1003) + ($1005))|0;
       $1007 = $1006 << 1;
       $1008 = (($1006) + 7)|0;
       $1009 = $966 >>> $1008;
       $1010 = $1009 & 1;
       $1011 = $1010 | $1007;
       $I1$0$i$i = $1011;
      }
     }
     $1012 = (3628 + ($I1$0$i$i<<2)|0);
     $1013 = ((($635)) + 28|0);
     HEAP32[$1013>>2] = $I1$0$i$i;
     $1014 = ((($635)) + 20|0);
     HEAP32[$1014>>2] = 0;
     HEAP32[$939>>2] = 0;
     $1015 = HEAP32[(3328)>>2]|0;
     $1016 = 1 << $I1$0$i$i;
     $1017 = $1015 & $1016;
     $1018 = ($1017|0)==(0);
     if ($1018) {
      $1019 = $1015 | $1016;
      HEAP32[(3328)>>2] = $1019;
      HEAP32[$1012>>2] = $635;
      $1020 = ((($635)) + 24|0);
      HEAP32[$1020>>2] = $1012;
      $1021 = ((($635)) + 12|0);
      HEAP32[$1021>>2] = $635;
      $1022 = ((($635)) + 8|0);
      HEAP32[$1022>>2] = $635;
      break;
     }
     $1023 = HEAP32[$1012>>2]|0;
     $1024 = ($I1$0$i$i|0)==(31);
     $1025 = $I1$0$i$i >>> 1;
     $1026 = (25 - ($1025))|0;
     $1027 = $1024 ? 0 : $1026;
     $1028 = $966 << $1027;
     $K2$0$i$i = $1028;$T$0$i$i = $1023;
     while(1) {
      $1029 = ((($T$0$i$i)) + 4|0);
      $1030 = HEAP32[$1029>>2]|0;
      $1031 = $1030 & -8;
      $1032 = ($1031|0)==($966|0);
      if ($1032) {
       $T$0$i$i$lcssa = $T$0$i$i;
       label = 307;
       break;
      }
      $1033 = $K2$0$i$i >>> 31;
      $1034 = (((($T$0$i$i)) + 16|0) + ($1033<<2)|0);
      $1035 = $K2$0$i$i << 1;
      $1036 = HEAP32[$1034>>2]|0;
      $1037 = ($1036|0)==(0|0);
      if ($1037) {
       $$lcssa141 = $1034;$T$0$i$i$lcssa140 = $T$0$i$i;
       label = 304;
       break;
      } else {
       $K2$0$i$i = $1035;$T$0$i$i = $1036;
      }
     }
     if ((label|0) == 304) {
      $1038 = HEAP32[(3340)>>2]|0;
      $1039 = ($$lcssa141>>>0)<($1038>>>0);
      if ($1039) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$lcssa141>>2] = $635;
       $1040 = ((($635)) + 24|0);
       HEAP32[$1040>>2] = $T$0$i$i$lcssa140;
       $1041 = ((($635)) + 12|0);
       HEAP32[$1041>>2] = $635;
       $1042 = ((($635)) + 8|0);
       HEAP32[$1042>>2] = $635;
       break;
      }
     }
     else if ((label|0) == 307) {
      $1043 = ((($T$0$i$i$lcssa)) + 8|0);
      $1044 = HEAP32[$1043>>2]|0;
      $1045 = HEAP32[(3340)>>2]|0;
      $1046 = ($1044>>>0)>=($1045>>>0);
      $not$$i$i = ($T$0$i$i$lcssa>>>0)>=($1045>>>0);
      $1047 = $1046 & $not$$i$i;
      if ($1047) {
       $1048 = ((($1044)) + 12|0);
       HEAP32[$1048>>2] = $635;
       HEAP32[$1043>>2] = $635;
       $1049 = ((($635)) + 8|0);
       HEAP32[$1049>>2] = $1044;
       $1050 = ((($635)) + 12|0);
       HEAP32[$1050>>2] = $T$0$i$i$lcssa;
       $1051 = ((($635)) + 24|0);
       HEAP32[$1051>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1053 = HEAP32[(3336)>>2]|0;
  $1054 = ($1053>>>0)>($nb$0>>>0);
  if ($1054) {
   $1055 = (($1053) - ($nb$0))|0;
   HEAP32[(3336)>>2] = $1055;
   $1056 = HEAP32[(3348)>>2]|0;
   $1057 = (($1056) + ($nb$0)|0);
   HEAP32[(3348)>>2] = $1057;
   $1058 = $1055 | 1;
   $1059 = ((($1057)) + 4|0);
   HEAP32[$1059>>2] = $1058;
   $1060 = $nb$0 | 3;
   $1061 = ((($1056)) + 4|0);
   HEAP32[$1061>>2] = $1060;
   $1062 = ((($1056)) + 8|0);
   $$0 = $1062;
   return ($$0|0);
  }
 }
 $1063 = (___errno_location()|0);
 HEAP32[$1063>>2] = 12;
 $$0 = 0;
 return ($$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $$pre40 = 0, $$pre42 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0;
 var $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0;
 var $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0;
 var $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0;
 var $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $cond20 = 0, $cond21 = 0, $not$ = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  return;
 }
 $1 = ((($mem)) + -8|0);
 $2 = HEAP32[(3340)>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = ((($mem)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $9 = (($1) + ($8)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    return;
   }
   $14 = (0 - ($12))|0;
   $15 = (($1) + ($14)|0);
   $16 = (($12) + ($8))|0;
   $17 = ($15>>>0)<($2>>>0);
   if ($17) {
    _abort();
    // unreachable;
   }
   $18 = HEAP32[(3344)>>2]|0;
   $19 = ($15|0)==($18|0);
   if ($19) {
    $104 = ((($9)) + 4|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = $105 & 3;
    $107 = ($106|0)==(3);
    if (!($107)) {
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    HEAP32[(3332)>>2] = $16;
    $108 = $105 & -2;
    HEAP32[$104>>2] = $108;
    $109 = $16 | 1;
    $110 = ((($15)) + 4|0);
    HEAP32[$110>>2] = $109;
    $111 = (($15) + ($16)|0);
    HEAP32[$111>>2] = $16;
    return;
   }
   $20 = $12 >>> 3;
   $21 = ($12>>>0)<(256);
   if ($21) {
    $22 = ((($15)) + 8|0);
    $23 = HEAP32[$22>>2]|0;
    $24 = ((($15)) + 12|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = $20 << 1;
    $27 = (3364 + ($26<<2)|0);
    $28 = ($23|0)==($27|0);
    if (!($28)) {
     $29 = ($23>>>0)<($2>>>0);
     if ($29) {
      _abort();
      // unreachable;
     }
     $30 = ((($23)) + 12|0);
     $31 = HEAP32[$30>>2]|0;
     $32 = ($31|0)==($15|0);
     if (!($32)) {
      _abort();
      // unreachable;
     }
    }
    $33 = ($25|0)==($23|0);
    if ($33) {
     $34 = 1 << $20;
     $35 = $34 ^ -1;
     $36 = HEAP32[831]|0;
     $37 = $36 & $35;
     HEAP32[831] = $37;
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    $38 = ($25|0)==($27|0);
    if ($38) {
     $$pre42 = ((($25)) + 8|0);
     $$pre$phi43Z2D = $$pre42;
    } else {
     $39 = ($25>>>0)<($2>>>0);
     if ($39) {
      _abort();
      // unreachable;
     }
     $40 = ((($25)) + 8|0);
     $41 = HEAP32[$40>>2]|0;
     $42 = ($41|0)==($15|0);
     if ($42) {
      $$pre$phi43Z2D = $40;
     } else {
      _abort();
      // unreachable;
     }
    }
    $43 = ((($23)) + 12|0);
    HEAP32[$43>>2] = $25;
    HEAP32[$$pre$phi43Z2D>>2] = $23;
    $p$1 = $15;$psize$1 = $16;
    break;
   }
   $44 = ((($15)) + 24|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = ((($15)) + 12|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = ($47|0)==($15|0);
   do {
    if ($48) {
     $58 = ((($15)) + 16|0);
     $59 = ((($58)) + 4|0);
     $60 = HEAP32[$59>>2]|0;
     $61 = ($60|0)==(0|0);
     if ($61) {
      $62 = HEAP32[$58>>2]|0;
      $63 = ($62|0)==(0|0);
      if ($63) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $62;$RP$1 = $58;
      }
     } else {
      $R$1 = $60;$RP$1 = $59;
     }
     while(1) {
      $64 = ((($R$1)) + 20|0);
      $65 = HEAP32[$64>>2]|0;
      $66 = ($65|0)==(0|0);
      if (!($66)) {
       $R$1 = $65;$RP$1 = $64;
       continue;
      }
      $67 = ((($R$1)) + 16|0);
      $68 = HEAP32[$67>>2]|0;
      $69 = ($68|0)==(0|0);
      if ($69) {
       $R$1$lcssa = $R$1;$RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $68;$RP$1 = $67;
      }
     }
     $70 = ($RP$1$lcssa>>>0)<($2>>>0);
     if ($70) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1$lcssa>>2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $49 = ((($15)) + 8|0);
     $50 = HEAP32[$49>>2]|0;
     $51 = ($50>>>0)<($2>>>0);
     if ($51) {
      _abort();
      // unreachable;
     }
     $52 = ((($50)) + 12|0);
     $53 = HEAP32[$52>>2]|0;
     $54 = ($53|0)==($15|0);
     if (!($54)) {
      _abort();
      // unreachable;
     }
     $55 = ((($47)) + 8|0);
     $56 = HEAP32[$55>>2]|0;
     $57 = ($56|0)==($15|0);
     if ($57) {
      HEAP32[$52>>2] = $47;
      HEAP32[$55>>2] = $50;
      $R$3 = $47;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $71 = ($45|0)==(0|0);
   if ($71) {
    $p$1 = $15;$psize$1 = $16;
   } else {
    $72 = ((($15)) + 28|0);
    $73 = HEAP32[$72>>2]|0;
    $74 = (3628 + ($73<<2)|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($15|0)==($75|0);
    if ($76) {
     HEAP32[$74>>2] = $R$3;
     $cond20 = ($R$3|0)==(0|0);
     if ($cond20) {
      $77 = 1 << $73;
      $78 = $77 ^ -1;
      $79 = HEAP32[(3328)>>2]|0;
      $80 = $79 & $78;
      HEAP32[(3328)>>2] = $80;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    } else {
     $81 = HEAP32[(3340)>>2]|0;
     $82 = ($45>>>0)<($81>>>0);
     if ($82) {
      _abort();
      // unreachable;
     }
     $83 = ((($45)) + 16|0);
     $84 = HEAP32[$83>>2]|0;
     $85 = ($84|0)==($15|0);
     if ($85) {
      HEAP32[$83>>2] = $R$3;
     } else {
      $86 = ((($45)) + 20|0);
      HEAP32[$86>>2] = $R$3;
     }
     $87 = ($R$3|0)==(0|0);
     if ($87) {
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
    $88 = HEAP32[(3340)>>2]|0;
    $89 = ($R$3>>>0)<($88>>>0);
    if ($89) {
     _abort();
     // unreachable;
    }
    $90 = ((($R$3)) + 24|0);
    HEAP32[$90>>2] = $45;
    $91 = ((($15)) + 16|0);
    $92 = HEAP32[$91>>2]|0;
    $93 = ($92|0)==(0|0);
    do {
     if (!($93)) {
      $94 = ($92>>>0)<($88>>>0);
      if ($94) {
       _abort();
       // unreachable;
      } else {
       $95 = ((($R$3)) + 16|0);
       HEAP32[$95>>2] = $92;
       $96 = ((($92)) + 24|0);
       HEAP32[$96>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $97 = ((($91)) + 4|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = ($98|0)==(0|0);
    if ($99) {
     $p$1 = $15;$psize$1 = $16;
    } else {
     $100 = HEAP32[(3340)>>2]|0;
     $101 = ($98>>>0)<($100>>>0);
     if ($101) {
      _abort();
      // unreachable;
     } else {
      $102 = ((($R$3)) + 20|0);
      HEAP32[$102>>2] = $98;
      $103 = ((($98)) + 24|0);
      HEAP32[$103>>2] = $R$3;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
   }
  } else {
   $p$1 = $1;$psize$1 = $8;
  }
 } while(0);
 $112 = ($p$1>>>0)<($9>>>0);
 if (!($112)) {
  _abort();
  // unreachable;
 }
 $113 = ((($9)) + 4|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = $114 & 1;
 $116 = ($115|0)==(0);
 if ($116) {
  _abort();
  // unreachable;
 }
 $117 = $114 & 2;
 $118 = ($117|0)==(0);
 if ($118) {
  $119 = HEAP32[(3348)>>2]|0;
  $120 = ($9|0)==($119|0);
  if ($120) {
   $121 = HEAP32[(3336)>>2]|0;
   $122 = (($121) + ($psize$1))|0;
   HEAP32[(3336)>>2] = $122;
   HEAP32[(3348)>>2] = $p$1;
   $123 = $122 | 1;
   $124 = ((($p$1)) + 4|0);
   HEAP32[$124>>2] = $123;
   $125 = HEAP32[(3344)>>2]|0;
   $126 = ($p$1|0)==($125|0);
   if (!($126)) {
    return;
   }
   HEAP32[(3344)>>2] = 0;
   HEAP32[(3332)>>2] = 0;
   return;
  }
  $127 = HEAP32[(3344)>>2]|0;
  $128 = ($9|0)==($127|0);
  if ($128) {
   $129 = HEAP32[(3332)>>2]|0;
   $130 = (($129) + ($psize$1))|0;
   HEAP32[(3332)>>2] = $130;
   HEAP32[(3344)>>2] = $p$1;
   $131 = $130 | 1;
   $132 = ((($p$1)) + 4|0);
   HEAP32[$132>>2] = $131;
   $133 = (($p$1) + ($130)|0);
   HEAP32[$133>>2] = $130;
   return;
  }
  $134 = $114 & -8;
  $135 = (($134) + ($psize$1))|0;
  $136 = $114 >>> 3;
  $137 = ($114>>>0)<(256);
  do {
   if ($137) {
    $138 = ((($9)) + 8|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = ((($9)) + 12|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $136 << 1;
    $143 = (3364 + ($142<<2)|0);
    $144 = ($139|0)==($143|0);
    if (!($144)) {
     $145 = HEAP32[(3340)>>2]|0;
     $146 = ($139>>>0)<($145>>>0);
     if ($146) {
      _abort();
      // unreachable;
     }
     $147 = ((($139)) + 12|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($148|0)==($9|0);
     if (!($149)) {
      _abort();
      // unreachable;
     }
    }
    $150 = ($141|0)==($139|0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[831]|0;
     $154 = $153 & $152;
     HEAP32[831] = $154;
     break;
    }
    $155 = ($141|0)==($143|0);
    if ($155) {
     $$pre40 = ((($141)) + 8|0);
     $$pre$phi41Z2D = $$pre40;
    } else {
     $156 = HEAP32[(3340)>>2]|0;
     $157 = ($141>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     }
     $158 = ((($141)) + 8|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = ($159|0)==($9|0);
     if ($160) {
      $$pre$phi41Z2D = $158;
     } else {
      _abort();
      // unreachable;
     }
    }
    $161 = ((($139)) + 12|0);
    HEAP32[$161>>2] = $141;
    HEAP32[$$pre$phi41Z2D>>2] = $139;
   } else {
    $162 = ((($9)) + 24|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ((($9)) + 12|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ($165|0)==($9|0);
    do {
     if ($166) {
      $177 = ((($9)) + 16|0);
      $178 = ((($177)) + 4|0);
      $179 = HEAP32[$178>>2]|0;
      $180 = ($179|0)==(0|0);
      if ($180) {
       $181 = HEAP32[$177>>2]|0;
       $182 = ($181|0)==(0|0);
       if ($182) {
        $R8$3 = 0;
        break;
       } else {
        $R8$1 = $181;$RP10$1 = $177;
       }
      } else {
       $R8$1 = $179;$RP10$1 = $178;
      }
      while(1) {
       $183 = ((($R8$1)) + 20|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($184|0)==(0|0);
       if (!($185)) {
        $R8$1 = $184;$RP10$1 = $183;
        continue;
       }
       $186 = ((($R8$1)) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)==(0|0);
       if ($188) {
        $R8$1$lcssa = $R8$1;$RP10$1$lcssa = $RP10$1;
        break;
       } else {
        $R8$1 = $187;$RP10$1 = $186;
       }
      }
      $189 = HEAP32[(3340)>>2]|0;
      $190 = ($RP10$1$lcssa>>>0)<($189>>>0);
      if ($190) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP10$1$lcssa>>2] = 0;
       $R8$3 = $R8$1$lcssa;
       break;
      }
     } else {
      $167 = ((($9)) + 8|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = HEAP32[(3340)>>2]|0;
      $170 = ($168>>>0)<($169>>>0);
      if ($170) {
       _abort();
       // unreachable;
      }
      $171 = ((($168)) + 12|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==($9|0);
      if (!($173)) {
       _abort();
       // unreachable;
      }
      $174 = ((($165)) + 8|0);
      $175 = HEAP32[$174>>2]|0;
      $176 = ($175|0)==($9|0);
      if ($176) {
       HEAP32[$171>>2] = $165;
       HEAP32[$174>>2] = $168;
       $R8$3 = $165;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $191 = ($163|0)==(0|0);
    if (!($191)) {
     $192 = ((($9)) + 28|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = (3628 + ($193<<2)|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = ($9|0)==($195|0);
     if ($196) {
      HEAP32[$194>>2] = $R8$3;
      $cond21 = ($R8$3|0)==(0|0);
      if ($cond21) {
       $197 = 1 << $193;
       $198 = $197 ^ -1;
       $199 = HEAP32[(3328)>>2]|0;
       $200 = $199 & $198;
       HEAP32[(3328)>>2] = $200;
       break;
      }
     } else {
      $201 = HEAP32[(3340)>>2]|0;
      $202 = ($163>>>0)<($201>>>0);
      if ($202) {
       _abort();
       // unreachable;
      }
      $203 = ((($163)) + 16|0);
      $204 = HEAP32[$203>>2]|0;
      $205 = ($204|0)==($9|0);
      if ($205) {
       HEAP32[$203>>2] = $R8$3;
      } else {
       $206 = ((($163)) + 20|0);
       HEAP32[$206>>2] = $R8$3;
      }
      $207 = ($R8$3|0)==(0|0);
      if ($207) {
       break;
      }
     }
     $208 = HEAP32[(3340)>>2]|0;
     $209 = ($R8$3>>>0)<($208>>>0);
     if ($209) {
      _abort();
      // unreachable;
     }
     $210 = ((($R8$3)) + 24|0);
     HEAP32[$210>>2] = $163;
     $211 = ((($9)) + 16|0);
     $212 = HEAP32[$211>>2]|0;
     $213 = ($212|0)==(0|0);
     do {
      if (!($213)) {
       $214 = ($212>>>0)<($208>>>0);
       if ($214) {
        _abort();
        // unreachable;
       } else {
        $215 = ((($R8$3)) + 16|0);
        HEAP32[$215>>2] = $212;
        $216 = ((($212)) + 24|0);
        HEAP32[$216>>2] = $R8$3;
        break;
       }
      }
     } while(0);
     $217 = ((($211)) + 4|0);
     $218 = HEAP32[$217>>2]|0;
     $219 = ($218|0)==(0|0);
     if (!($219)) {
      $220 = HEAP32[(3340)>>2]|0;
      $221 = ($218>>>0)<($220>>>0);
      if ($221) {
       _abort();
       // unreachable;
      } else {
       $222 = ((($R8$3)) + 20|0);
       HEAP32[$222>>2] = $218;
       $223 = ((($218)) + 24|0);
       HEAP32[$223>>2] = $R8$3;
       break;
      }
     }
    }
   }
  } while(0);
  $224 = $135 | 1;
  $225 = ((($p$1)) + 4|0);
  HEAP32[$225>>2] = $224;
  $226 = (($p$1) + ($135)|0);
  HEAP32[$226>>2] = $135;
  $227 = HEAP32[(3344)>>2]|0;
  $228 = ($p$1|0)==($227|0);
  if ($228) {
   HEAP32[(3332)>>2] = $135;
   return;
  } else {
   $psize$2 = $135;
  }
 } else {
  $229 = $114 & -2;
  HEAP32[$113>>2] = $229;
  $230 = $psize$1 | 1;
  $231 = ((($p$1)) + 4|0);
  HEAP32[$231>>2] = $230;
  $232 = (($p$1) + ($psize$1)|0);
  HEAP32[$232>>2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 $234 = ($psize$2>>>0)<(256);
 if ($234) {
  $235 = $233 << 1;
  $236 = (3364 + ($235<<2)|0);
  $237 = HEAP32[831]|0;
  $238 = 1 << $233;
  $239 = $237 & $238;
  $240 = ($239|0)==(0);
  if ($240) {
   $241 = $237 | $238;
   HEAP32[831] = $241;
   $$pre = ((($236)) + 8|0);
   $$pre$phiZ2D = $$pre;$F18$0 = $236;
  } else {
   $242 = ((($236)) + 8|0);
   $243 = HEAP32[$242>>2]|0;
   $244 = HEAP32[(3340)>>2]|0;
   $245 = ($243>>>0)<($244>>>0);
   if ($245) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $242;$F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$1;
  $246 = ((($F18$0)) + 12|0);
  HEAP32[$246>>2] = $p$1;
  $247 = ((($p$1)) + 8|0);
  HEAP32[$247>>2] = $F18$0;
  $248 = ((($p$1)) + 12|0);
  HEAP32[$248>>2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 $250 = ($249|0)==(0);
 if ($250) {
  $I20$0 = 0;
 } else {
  $251 = ($psize$2>>>0)>(16777215);
  if ($251) {
   $I20$0 = 31;
  } else {
   $252 = (($249) + 1048320)|0;
   $253 = $252 >>> 16;
   $254 = $253 & 8;
   $255 = $249 << $254;
   $256 = (($255) + 520192)|0;
   $257 = $256 >>> 16;
   $258 = $257 & 4;
   $259 = $258 | $254;
   $260 = $255 << $258;
   $261 = (($260) + 245760)|0;
   $262 = $261 >>> 16;
   $263 = $262 & 2;
   $264 = $259 | $263;
   $265 = (14 - ($264))|0;
   $266 = $260 << $263;
   $267 = $266 >>> 15;
   $268 = (($265) + ($267))|0;
   $269 = $268 << 1;
   $270 = (($268) + 7)|0;
   $271 = $psize$2 >>> $270;
   $272 = $271 & 1;
   $273 = $272 | $269;
   $I20$0 = $273;
  }
 }
 $274 = (3628 + ($I20$0<<2)|0);
 $275 = ((($p$1)) + 28|0);
 HEAP32[$275>>2] = $I20$0;
 $276 = ((($p$1)) + 16|0);
 $277 = ((($p$1)) + 20|0);
 HEAP32[$277>>2] = 0;
 HEAP32[$276>>2] = 0;
 $278 = HEAP32[(3328)>>2]|0;
 $279 = 1 << $I20$0;
 $280 = $278 & $279;
 $281 = ($280|0)==(0);
 do {
  if ($281) {
   $282 = $278 | $279;
   HEAP32[(3328)>>2] = $282;
   HEAP32[$274>>2] = $p$1;
   $283 = ((($p$1)) + 24|0);
   HEAP32[$283>>2] = $274;
   $284 = ((($p$1)) + 12|0);
   HEAP32[$284>>2] = $p$1;
   $285 = ((($p$1)) + 8|0);
   HEAP32[$285>>2] = $p$1;
  } else {
   $286 = HEAP32[$274>>2]|0;
   $287 = ($I20$0|0)==(31);
   $288 = $I20$0 >>> 1;
   $289 = (25 - ($288))|0;
   $290 = $287 ? 0 : $289;
   $291 = $psize$2 << $290;
   $K21$0 = $291;$T$0 = $286;
   while(1) {
    $292 = ((($T$0)) + 4|0);
    $293 = HEAP32[$292>>2]|0;
    $294 = $293 & -8;
    $295 = ($294|0)==($psize$2|0);
    if ($295) {
     $T$0$lcssa = $T$0;
     label = 130;
     break;
    }
    $296 = $K21$0 >>> 31;
    $297 = (((($T$0)) + 16|0) + ($296<<2)|0);
    $298 = $K21$0 << 1;
    $299 = HEAP32[$297>>2]|0;
    $300 = ($299|0)==(0|0);
    if ($300) {
     $$lcssa = $297;$T$0$lcssa48 = $T$0;
     label = 127;
     break;
    } else {
     $K21$0 = $298;$T$0 = $299;
    }
   }
   if ((label|0) == 127) {
    $301 = HEAP32[(3340)>>2]|0;
    $302 = ($$lcssa>>>0)<($301>>>0);
    if ($302) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$$lcssa>>2] = $p$1;
     $303 = ((($p$1)) + 24|0);
     HEAP32[$303>>2] = $T$0$lcssa48;
     $304 = ((($p$1)) + 12|0);
     HEAP32[$304>>2] = $p$1;
     $305 = ((($p$1)) + 8|0);
     HEAP32[$305>>2] = $p$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $306 = ((($T$0$lcssa)) + 8|0);
    $307 = HEAP32[$306>>2]|0;
    $308 = HEAP32[(3340)>>2]|0;
    $309 = ($307>>>0)>=($308>>>0);
    $not$ = ($T$0$lcssa>>>0)>=($308>>>0);
    $310 = $309 & $not$;
    if ($310) {
     $311 = ((($307)) + 12|0);
     HEAP32[$311>>2] = $p$1;
     HEAP32[$306>>2] = $p$1;
     $312 = ((($p$1)) + 8|0);
     HEAP32[$312>>2] = $307;
     $313 = ((($p$1)) + 12|0);
     HEAP32[$313>>2] = $T$0$lcssa;
     $314 = ((($p$1)) + 24|0);
     HEAP32[$314>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $315 = HEAP32[(3356)>>2]|0;
 $316 = (($315) + -1)|0;
 HEAP32[(3356)>>2] = $316;
 $317 = ($316|0)==(0);
 if ($317) {
  $sp$0$in$i = (3780);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $318 = ($sp$0$i|0)==(0|0);
  $319 = ((($sp$0$i)) + 8|0);
  if ($318) {
   break;
  } else {
   $sp$0$in$i = $319;
  }
 }
 HEAP32[(3356)>>2] = -1;
 return;
}
function _realloc($oldmem,$bytes) {
 $oldmem = $oldmem|0;
 $bytes = $bytes|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $mem$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($oldmem|0)==(0|0);
 if ($0) {
  $1 = (_malloc($bytes)|0);
  $mem$1 = $1;
  return ($mem$1|0);
 }
 $2 = ($bytes>>>0)>(4294967231);
 if ($2) {
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = 12;
  $mem$1 = 0;
  return ($mem$1|0);
 }
 $4 = ($bytes>>>0)<(11);
 $5 = (($bytes) + 11)|0;
 $6 = $5 & -8;
 $7 = $4 ? 16 : $6;
 $8 = ((($oldmem)) + -8|0);
 $9 = (_try_realloc_chunk($8,$7)|0);
 $10 = ($9|0)==(0|0);
 if (!($10)) {
  $11 = ((($9)) + 8|0);
  $mem$1 = $11;
  return ($mem$1|0);
 }
 $12 = (_malloc($bytes)|0);
 $13 = ($12|0)==(0|0);
 if ($13) {
  $mem$1 = 0;
  return ($mem$1|0);
 }
 $14 = ((($oldmem)) + -4|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = $15 & -8;
 $17 = $15 & 3;
 $18 = ($17|0)==(0);
 $19 = $18 ? 8 : 4;
 $20 = (($16) - ($19))|0;
 $21 = ($20>>>0)<($bytes>>>0);
 $22 = $21 ? $20 : $bytes;
 _memcpy(($12|0),($oldmem|0),($22|0))|0;
 _free($oldmem);
 $mem$1 = $12;
 return ($mem$1|0);
}
function _try_realloc_chunk($p,$nb) {
 $p = $p|0;
 $nb = $nb|0;
 var $$pre = 0, $$pre$phiZ2D = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0;
 var $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0;
 var $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0;
 var $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0;
 var $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $R$1 = 0, $R$1$lcssa = 0;
 var $R$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $cond = 0, $newp$2 = 0, $notlhs = 0, $notrhs = 0, $or$cond$not = 0, $or$cond3 = 0, $storemerge = 0, $storemerge1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($p)) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = $1 & -8;
 $3 = (($p) + ($2)|0);
 $4 = HEAP32[(3340)>>2]|0;
 $5 = $1 & 3;
 $notlhs = ($p>>>0)>=($4>>>0);
 $notrhs = ($5|0)!=(1);
 $or$cond$not = $notrhs & $notlhs;
 $6 = ($p>>>0)<($3>>>0);
 $or$cond3 = $or$cond$not & $6;
 if (!($or$cond3)) {
  _abort();
  // unreachable;
 }
 $7 = ((($3)) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = $8 & 1;
 $10 = ($9|0)==(0);
 if ($10) {
  _abort();
  // unreachable;
 }
 $11 = ($5|0)==(0);
 if ($11) {
  $12 = ($nb>>>0)<(256);
  if ($12) {
   $newp$2 = 0;
   return ($newp$2|0);
  }
  $13 = (($nb) + 4)|0;
  $14 = ($2>>>0)<($13>>>0);
  if (!($14)) {
   $15 = (($2) - ($nb))|0;
   $16 = HEAP32[(3804)>>2]|0;
   $17 = $16 << 1;
   $18 = ($15>>>0)>($17>>>0);
   if (!($18)) {
    $newp$2 = $p;
    return ($newp$2|0);
   }
  }
  $newp$2 = 0;
  return ($newp$2|0);
 }
 $19 = ($2>>>0)<($nb>>>0);
 if (!($19)) {
  $20 = (($2) - ($nb))|0;
  $21 = ($20>>>0)>(15);
  if (!($21)) {
   $newp$2 = $p;
   return ($newp$2|0);
  }
  $22 = (($p) + ($nb)|0);
  $23 = $1 & 1;
  $24 = $23 | $nb;
  $25 = $24 | 2;
  HEAP32[$0>>2] = $25;
  $26 = ((($22)) + 4|0);
  $27 = $20 | 3;
  HEAP32[$26>>2] = $27;
  $28 = (($22) + ($20)|0);
  $29 = ((($28)) + 4|0);
  $30 = HEAP32[$29>>2]|0;
  $31 = $30 | 1;
  HEAP32[$29>>2] = $31;
  _dispose_chunk($22,$20);
  $newp$2 = $p;
  return ($newp$2|0);
 }
 $32 = HEAP32[(3348)>>2]|0;
 $33 = ($3|0)==($32|0);
 if ($33) {
  $34 = HEAP32[(3336)>>2]|0;
  $35 = (($34) + ($2))|0;
  $36 = ($35>>>0)>($nb>>>0);
  if (!($36)) {
   $newp$2 = 0;
   return ($newp$2|0);
  }
  $37 = (($35) - ($nb))|0;
  $38 = (($p) + ($nb)|0);
  $39 = $1 & 1;
  $40 = $39 | $nb;
  $41 = $40 | 2;
  HEAP32[$0>>2] = $41;
  $42 = ((($38)) + 4|0);
  $43 = $37 | 1;
  HEAP32[$42>>2] = $43;
  HEAP32[(3348)>>2] = $38;
  HEAP32[(3336)>>2] = $37;
  $newp$2 = $p;
  return ($newp$2|0);
 }
 $44 = HEAP32[(3344)>>2]|0;
 $45 = ($3|0)==($44|0);
 if ($45) {
  $46 = HEAP32[(3332)>>2]|0;
  $47 = (($46) + ($2))|0;
  $48 = ($47>>>0)<($nb>>>0);
  if ($48) {
   $newp$2 = 0;
   return ($newp$2|0);
  }
  $49 = (($47) - ($nb))|0;
  $50 = ($49>>>0)>(15);
  if ($50) {
   $51 = (($p) + ($nb)|0);
   $52 = (($51) + ($49)|0);
   $53 = $1 & 1;
   $54 = $53 | $nb;
   $55 = $54 | 2;
   HEAP32[$0>>2] = $55;
   $56 = ((($51)) + 4|0);
   $57 = $49 | 1;
   HEAP32[$56>>2] = $57;
   HEAP32[$52>>2] = $49;
   $58 = ((($52)) + 4|0);
   $59 = HEAP32[$58>>2]|0;
   $60 = $59 & -2;
   HEAP32[$58>>2] = $60;
   $storemerge = $51;$storemerge1 = $49;
  } else {
   $61 = $1 & 1;
   $62 = $61 | $47;
   $63 = $62 | 2;
   HEAP32[$0>>2] = $63;
   $64 = (($p) + ($47)|0);
   $65 = ((($64)) + 4|0);
   $66 = HEAP32[$65>>2]|0;
   $67 = $66 | 1;
   HEAP32[$65>>2] = $67;
   $storemerge = 0;$storemerge1 = 0;
  }
  HEAP32[(3332)>>2] = $storemerge1;
  HEAP32[(3344)>>2] = $storemerge;
  $newp$2 = $p;
  return ($newp$2|0);
 }
 $68 = $8 & 2;
 $69 = ($68|0)==(0);
 if (!($69)) {
  $newp$2 = 0;
  return ($newp$2|0);
 }
 $70 = $8 & -8;
 $71 = (($70) + ($2))|0;
 $72 = ($71>>>0)<($nb>>>0);
 if ($72) {
  $newp$2 = 0;
  return ($newp$2|0);
 }
 $73 = (($71) - ($nb))|0;
 $74 = $8 >>> 3;
 $75 = ($8>>>0)<(256);
 do {
  if ($75) {
   $76 = ((($3)) + 8|0);
   $77 = HEAP32[$76>>2]|0;
   $78 = ((($3)) + 12|0);
   $79 = HEAP32[$78>>2]|0;
   $80 = $74 << 1;
   $81 = (3364 + ($80<<2)|0);
   $82 = ($77|0)==($81|0);
   if (!($82)) {
    $83 = ($77>>>0)<($4>>>0);
    if ($83) {
     _abort();
     // unreachable;
    }
    $84 = ((($77)) + 12|0);
    $85 = HEAP32[$84>>2]|0;
    $86 = ($85|0)==($3|0);
    if (!($86)) {
     _abort();
     // unreachable;
    }
   }
   $87 = ($79|0)==($77|0);
   if ($87) {
    $88 = 1 << $74;
    $89 = $88 ^ -1;
    $90 = HEAP32[831]|0;
    $91 = $90 & $89;
    HEAP32[831] = $91;
    break;
   }
   $92 = ($79|0)==($81|0);
   if ($92) {
    $$pre = ((($79)) + 8|0);
    $$pre$phiZ2D = $$pre;
   } else {
    $93 = ($79>>>0)<($4>>>0);
    if ($93) {
     _abort();
     // unreachable;
    }
    $94 = ((($79)) + 8|0);
    $95 = HEAP32[$94>>2]|0;
    $96 = ($95|0)==($3|0);
    if ($96) {
     $$pre$phiZ2D = $94;
    } else {
     _abort();
     // unreachable;
    }
   }
   $97 = ((($77)) + 12|0);
   HEAP32[$97>>2] = $79;
   HEAP32[$$pre$phiZ2D>>2] = $77;
  } else {
   $98 = ((($3)) + 24|0);
   $99 = HEAP32[$98>>2]|0;
   $100 = ((($3)) + 12|0);
   $101 = HEAP32[$100>>2]|0;
   $102 = ($101|0)==($3|0);
   do {
    if ($102) {
     $112 = ((($3)) + 16|0);
     $113 = ((($112)) + 4|0);
     $114 = HEAP32[$113>>2]|0;
     $115 = ($114|0)==(0|0);
     if ($115) {
      $116 = HEAP32[$112>>2]|0;
      $117 = ($116|0)==(0|0);
      if ($117) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $116;$RP$1 = $112;
      }
     } else {
      $R$1 = $114;$RP$1 = $113;
     }
     while(1) {
      $118 = ((($R$1)) + 20|0);
      $119 = HEAP32[$118>>2]|0;
      $120 = ($119|0)==(0|0);
      if (!($120)) {
       $R$1 = $119;$RP$1 = $118;
       continue;
      }
      $121 = ((($R$1)) + 16|0);
      $122 = HEAP32[$121>>2]|0;
      $123 = ($122|0)==(0|0);
      if ($123) {
       $R$1$lcssa = $R$1;$RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $122;$RP$1 = $121;
      }
     }
     $124 = ($RP$1$lcssa>>>0)<($4>>>0);
     if ($124) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1$lcssa>>2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $103 = ((($3)) + 8|0);
     $104 = HEAP32[$103>>2]|0;
     $105 = ($104>>>0)<($4>>>0);
     if ($105) {
      _abort();
      // unreachable;
     }
     $106 = ((($104)) + 12|0);
     $107 = HEAP32[$106>>2]|0;
     $108 = ($107|0)==($3|0);
     if (!($108)) {
      _abort();
      // unreachable;
     }
     $109 = ((($101)) + 8|0);
     $110 = HEAP32[$109>>2]|0;
     $111 = ($110|0)==($3|0);
     if ($111) {
      HEAP32[$106>>2] = $101;
      HEAP32[$109>>2] = $104;
      $R$3 = $101;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $125 = ($99|0)==(0|0);
   if (!($125)) {
    $126 = ((($3)) + 28|0);
    $127 = HEAP32[$126>>2]|0;
    $128 = (3628 + ($127<<2)|0);
    $129 = HEAP32[$128>>2]|0;
    $130 = ($3|0)==($129|0);
    if ($130) {
     HEAP32[$128>>2] = $R$3;
     $cond = ($R$3|0)==(0|0);
     if ($cond) {
      $131 = 1 << $127;
      $132 = $131 ^ -1;
      $133 = HEAP32[(3328)>>2]|0;
      $134 = $133 & $132;
      HEAP32[(3328)>>2] = $134;
      break;
     }
    } else {
     $135 = HEAP32[(3340)>>2]|0;
     $136 = ($99>>>0)<($135>>>0);
     if ($136) {
      _abort();
      // unreachable;
     }
     $137 = ((($99)) + 16|0);
     $138 = HEAP32[$137>>2]|0;
     $139 = ($138|0)==($3|0);
     if ($139) {
      HEAP32[$137>>2] = $R$3;
     } else {
      $140 = ((($99)) + 20|0);
      HEAP32[$140>>2] = $R$3;
     }
     $141 = ($R$3|0)==(0|0);
     if ($141) {
      break;
     }
    }
    $142 = HEAP32[(3340)>>2]|0;
    $143 = ($R$3>>>0)<($142>>>0);
    if ($143) {
     _abort();
     // unreachable;
    }
    $144 = ((($R$3)) + 24|0);
    HEAP32[$144>>2] = $99;
    $145 = ((($3)) + 16|0);
    $146 = HEAP32[$145>>2]|0;
    $147 = ($146|0)==(0|0);
    do {
     if (!($147)) {
      $148 = ($146>>>0)<($142>>>0);
      if ($148) {
       _abort();
       // unreachable;
      } else {
       $149 = ((($R$3)) + 16|0);
       HEAP32[$149>>2] = $146;
       $150 = ((($146)) + 24|0);
       HEAP32[$150>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $151 = ((($145)) + 4|0);
    $152 = HEAP32[$151>>2]|0;
    $153 = ($152|0)==(0|0);
    if (!($153)) {
     $154 = HEAP32[(3340)>>2]|0;
     $155 = ($152>>>0)<($154>>>0);
     if ($155) {
      _abort();
      // unreachable;
     } else {
      $156 = ((($R$3)) + 20|0);
      HEAP32[$156>>2] = $152;
      $157 = ((($152)) + 24|0);
      HEAP32[$157>>2] = $R$3;
      break;
     }
    }
   }
  }
 } while(0);
 $158 = ($73>>>0)<(16);
 if ($158) {
  $159 = $1 & 1;
  $160 = $71 | $159;
  $161 = $160 | 2;
  HEAP32[$0>>2] = $161;
  $162 = (($p) + ($71)|0);
  $163 = ((($162)) + 4|0);
  $164 = HEAP32[$163>>2]|0;
  $165 = $164 | 1;
  HEAP32[$163>>2] = $165;
  $newp$2 = $p;
  return ($newp$2|0);
 } else {
  $166 = (($p) + ($nb)|0);
  $167 = $1 & 1;
  $168 = $167 | $nb;
  $169 = $168 | 2;
  HEAP32[$0>>2] = $169;
  $170 = ((($166)) + 4|0);
  $171 = $73 | 3;
  HEAP32[$170>>2] = $171;
  $172 = (($166) + ($73)|0);
  $173 = ((($172)) + 4|0);
  $174 = HEAP32[$173>>2]|0;
  $175 = $174 | 1;
  HEAP32[$173>>2] = $175;
  _dispose_chunk($166,$73);
  $newp$2 = $p;
  return ($newp$2|0);
 }
 return (0)|0;
}
function _dispose_chunk($p,$psize) {
 $p = $p|0;
 $psize = $psize|0;
 var $$1 = 0, $$14 = 0, $$2 = 0, $$lcssa = 0, $$pre = 0, $$pre$phi22Z2D = 0, $$pre$phi24Z2D = 0, $$pre$phiZ2D = 0, $$pre21 = 0, $$pre23 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0;
 var $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0;
 var $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0;
 var $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0;
 var $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0;
 var $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0;
 var $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F17$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0;
 var $R$3 = 0, $R7$1 = 0, $R7$1$lcssa = 0, $R7$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP9$1 = 0, $RP9$1$lcssa = 0, $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa30 = 0, $cond = 0, $cond16 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (($p) + ($psize)|0);
 $1 = ((($p)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 & 1;
 $4 = ($3|0)==(0);
 do {
  if ($4) {
   $5 = HEAP32[$p>>2]|0;
   $6 = $2 & 3;
   $7 = ($6|0)==(0);
   if ($7) {
    return;
   }
   $8 = (0 - ($5))|0;
   $9 = (($p) + ($8)|0);
   $10 = (($5) + ($psize))|0;
   $11 = HEAP32[(3340)>>2]|0;
   $12 = ($9>>>0)<($11>>>0);
   if ($12) {
    _abort();
    // unreachable;
   }
   $13 = HEAP32[(3344)>>2]|0;
   $14 = ($9|0)==($13|0);
   if ($14) {
    $99 = ((($0)) + 4|0);
    $100 = HEAP32[$99>>2]|0;
    $101 = $100 & 3;
    $102 = ($101|0)==(3);
    if (!($102)) {
     $$1 = $9;$$14 = $10;
     break;
    }
    HEAP32[(3332)>>2] = $10;
    $103 = $100 & -2;
    HEAP32[$99>>2] = $103;
    $104 = $10 | 1;
    $105 = ((($9)) + 4|0);
    HEAP32[$105>>2] = $104;
    $106 = (($9) + ($10)|0);
    HEAP32[$106>>2] = $10;
    return;
   }
   $15 = $5 >>> 3;
   $16 = ($5>>>0)<(256);
   if ($16) {
    $17 = ((($9)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($9)) + 12|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = $15 << 1;
    $22 = (3364 + ($21<<2)|0);
    $23 = ($18|0)==($22|0);
    if (!($23)) {
     $24 = ($18>>>0)<($11>>>0);
     if ($24) {
      _abort();
      // unreachable;
     }
     $25 = ((($18)) + 12|0);
     $26 = HEAP32[$25>>2]|0;
     $27 = ($26|0)==($9|0);
     if (!($27)) {
      _abort();
      // unreachable;
     }
    }
    $28 = ($20|0)==($18|0);
    if ($28) {
     $29 = 1 << $15;
     $30 = $29 ^ -1;
     $31 = HEAP32[831]|0;
     $32 = $31 & $30;
     HEAP32[831] = $32;
     $$1 = $9;$$14 = $10;
     break;
    }
    $33 = ($20|0)==($22|0);
    if ($33) {
     $$pre23 = ((($20)) + 8|0);
     $$pre$phi24Z2D = $$pre23;
    } else {
     $34 = ($20>>>0)<($11>>>0);
     if ($34) {
      _abort();
      // unreachable;
     }
     $35 = ((($20)) + 8|0);
     $36 = HEAP32[$35>>2]|0;
     $37 = ($36|0)==($9|0);
     if ($37) {
      $$pre$phi24Z2D = $35;
     } else {
      _abort();
      // unreachable;
     }
    }
    $38 = ((($18)) + 12|0);
    HEAP32[$38>>2] = $20;
    HEAP32[$$pre$phi24Z2D>>2] = $18;
    $$1 = $9;$$14 = $10;
    break;
   }
   $39 = ((($9)) + 24|0);
   $40 = HEAP32[$39>>2]|0;
   $41 = ((($9)) + 12|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = ($42|0)==($9|0);
   do {
    if ($43) {
     $53 = ((($9)) + 16|0);
     $54 = ((($53)) + 4|0);
     $55 = HEAP32[$54>>2]|0;
     $56 = ($55|0)==(0|0);
     if ($56) {
      $57 = HEAP32[$53>>2]|0;
      $58 = ($57|0)==(0|0);
      if ($58) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $57;$RP$1 = $53;
      }
     } else {
      $R$1 = $55;$RP$1 = $54;
     }
     while(1) {
      $59 = ((($R$1)) + 20|0);
      $60 = HEAP32[$59>>2]|0;
      $61 = ($60|0)==(0|0);
      if (!($61)) {
       $R$1 = $60;$RP$1 = $59;
       continue;
      }
      $62 = ((($R$1)) + 16|0);
      $63 = HEAP32[$62>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $R$1$lcssa = $R$1;$RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $63;$RP$1 = $62;
      }
     }
     $65 = ($RP$1$lcssa>>>0)<($11>>>0);
     if ($65) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1$lcssa>>2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $44 = ((($9)) + 8|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = ($45>>>0)<($11>>>0);
     if ($46) {
      _abort();
      // unreachable;
     }
     $47 = ((($45)) + 12|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = ($48|0)==($9|0);
     if (!($49)) {
      _abort();
      // unreachable;
     }
     $50 = ((($42)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51|0)==($9|0);
     if ($52) {
      HEAP32[$47>>2] = $42;
      HEAP32[$50>>2] = $45;
      $R$3 = $42;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $66 = ($40|0)==(0|0);
   if ($66) {
    $$1 = $9;$$14 = $10;
   } else {
    $67 = ((($9)) + 28|0);
    $68 = HEAP32[$67>>2]|0;
    $69 = (3628 + ($68<<2)|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($9|0)==($70|0);
    if ($71) {
     HEAP32[$69>>2] = $R$3;
     $cond = ($R$3|0)==(0|0);
     if ($cond) {
      $72 = 1 << $68;
      $73 = $72 ^ -1;
      $74 = HEAP32[(3328)>>2]|0;
      $75 = $74 & $73;
      HEAP32[(3328)>>2] = $75;
      $$1 = $9;$$14 = $10;
      break;
     }
    } else {
     $76 = HEAP32[(3340)>>2]|0;
     $77 = ($40>>>0)<($76>>>0);
     if ($77) {
      _abort();
      // unreachable;
     }
     $78 = ((($40)) + 16|0);
     $79 = HEAP32[$78>>2]|0;
     $80 = ($79|0)==($9|0);
     if ($80) {
      HEAP32[$78>>2] = $R$3;
     } else {
      $81 = ((($40)) + 20|0);
      HEAP32[$81>>2] = $R$3;
     }
     $82 = ($R$3|0)==(0|0);
     if ($82) {
      $$1 = $9;$$14 = $10;
      break;
     }
    }
    $83 = HEAP32[(3340)>>2]|0;
    $84 = ($R$3>>>0)<($83>>>0);
    if ($84) {
     _abort();
     // unreachable;
    }
    $85 = ((($R$3)) + 24|0);
    HEAP32[$85>>2] = $40;
    $86 = ((($9)) + 16|0);
    $87 = HEAP32[$86>>2]|0;
    $88 = ($87|0)==(0|0);
    do {
     if (!($88)) {
      $89 = ($87>>>0)<($83>>>0);
      if ($89) {
       _abort();
       // unreachable;
      } else {
       $90 = ((($R$3)) + 16|0);
       HEAP32[$90>>2] = $87;
       $91 = ((($87)) + 24|0);
       HEAP32[$91>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $92 = ((($86)) + 4|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    if ($94) {
     $$1 = $9;$$14 = $10;
    } else {
     $95 = HEAP32[(3340)>>2]|0;
     $96 = ($93>>>0)<($95>>>0);
     if ($96) {
      _abort();
      // unreachable;
     } else {
      $97 = ((($R$3)) + 20|0);
      HEAP32[$97>>2] = $93;
      $98 = ((($93)) + 24|0);
      HEAP32[$98>>2] = $R$3;
      $$1 = $9;$$14 = $10;
      break;
     }
    }
   }
  } else {
   $$1 = $p;$$14 = $psize;
  }
 } while(0);
 $107 = HEAP32[(3340)>>2]|0;
 $108 = ($0>>>0)<($107>>>0);
 if ($108) {
  _abort();
  // unreachable;
 }
 $109 = ((($0)) + 4|0);
 $110 = HEAP32[$109>>2]|0;
 $111 = $110 & 2;
 $112 = ($111|0)==(0);
 if ($112) {
  $113 = HEAP32[(3348)>>2]|0;
  $114 = ($0|0)==($113|0);
  if ($114) {
   $115 = HEAP32[(3336)>>2]|0;
   $116 = (($115) + ($$14))|0;
   HEAP32[(3336)>>2] = $116;
   HEAP32[(3348)>>2] = $$1;
   $117 = $116 | 1;
   $118 = ((($$1)) + 4|0);
   HEAP32[$118>>2] = $117;
   $119 = HEAP32[(3344)>>2]|0;
   $120 = ($$1|0)==($119|0);
   if (!($120)) {
    return;
   }
   HEAP32[(3344)>>2] = 0;
   HEAP32[(3332)>>2] = 0;
   return;
  }
  $121 = HEAP32[(3344)>>2]|0;
  $122 = ($0|0)==($121|0);
  if ($122) {
   $123 = HEAP32[(3332)>>2]|0;
   $124 = (($123) + ($$14))|0;
   HEAP32[(3332)>>2] = $124;
   HEAP32[(3344)>>2] = $$1;
   $125 = $124 | 1;
   $126 = ((($$1)) + 4|0);
   HEAP32[$126>>2] = $125;
   $127 = (($$1) + ($124)|0);
   HEAP32[$127>>2] = $124;
   return;
  }
  $128 = $110 & -8;
  $129 = (($128) + ($$14))|0;
  $130 = $110 >>> 3;
  $131 = ($110>>>0)<(256);
  do {
   if ($131) {
    $132 = ((($0)) + 8|0);
    $133 = HEAP32[$132>>2]|0;
    $134 = ((($0)) + 12|0);
    $135 = HEAP32[$134>>2]|0;
    $136 = $130 << 1;
    $137 = (3364 + ($136<<2)|0);
    $138 = ($133|0)==($137|0);
    if (!($138)) {
     $139 = ($133>>>0)<($107>>>0);
     if ($139) {
      _abort();
      // unreachable;
     }
     $140 = ((($133)) + 12|0);
     $141 = HEAP32[$140>>2]|0;
     $142 = ($141|0)==($0|0);
     if (!($142)) {
      _abort();
      // unreachable;
     }
    }
    $143 = ($135|0)==($133|0);
    if ($143) {
     $144 = 1 << $130;
     $145 = $144 ^ -1;
     $146 = HEAP32[831]|0;
     $147 = $146 & $145;
     HEAP32[831] = $147;
     break;
    }
    $148 = ($135|0)==($137|0);
    if ($148) {
     $$pre21 = ((($135)) + 8|0);
     $$pre$phi22Z2D = $$pre21;
    } else {
     $149 = ($135>>>0)<($107>>>0);
     if ($149) {
      _abort();
      // unreachable;
     }
     $150 = ((($135)) + 8|0);
     $151 = HEAP32[$150>>2]|0;
     $152 = ($151|0)==($0|0);
     if ($152) {
      $$pre$phi22Z2D = $150;
     } else {
      _abort();
      // unreachable;
     }
    }
    $153 = ((($133)) + 12|0);
    HEAP32[$153>>2] = $135;
    HEAP32[$$pre$phi22Z2D>>2] = $133;
   } else {
    $154 = ((($0)) + 24|0);
    $155 = HEAP32[$154>>2]|0;
    $156 = ((($0)) + 12|0);
    $157 = HEAP32[$156>>2]|0;
    $158 = ($157|0)==($0|0);
    do {
     if ($158) {
      $168 = ((($0)) + 16|0);
      $169 = ((($168)) + 4|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = ($170|0)==(0|0);
      if ($171) {
       $172 = HEAP32[$168>>2]|0;
       $173 = ($172|0)==(0|0);
       if ($173) {
        $R7$3 = 0;
        break;
       } else {
        $R7$1 = $172;$RP9$1 = $168;
       }
      } else {
       $R7$1 = $170;$RP9$1 = $169;
      }
      while(1) {
       $174 = ((($R7$1)) + 20|0);
       $175 = HEAP32[$174>>2]|0;
       $176 = ($175|0)==(0|0);
       if (!($176)) {
        $R7$1 = $175;$RP9$1 = $174;
        continue;
       }
       $177 = ((($R7$1)) + 16|0);
       $178 = HEAP32[$177>>2]|0;
       $179 = ($178|0)==(0|0);
       if ($179) {
        $R7$1$lcssa = $R7$1;$RP9$1$lcssa = $RP9$1;
        break;
       } else {
        $R7$1 = $178;$RP9$1 = $177;
       }
      }
      $180 = ($RP9$1$lcssa>>>0)<($107>>>0);
      if ($180) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP9$1$lcssa>>2] = 0;
       $R7$3 = $R7$1$lcssa;
       break;
      }
     } else {
      $159 = ((($0)) + 8|0);
      $160 = HEAP32[$159>>2]|0;
      $161 = ($160>>>0)<($107>>>0);
      if ($161) {
       _abort();
       // unreachable;
      }
      $162 = ((($160)) + 12|0);
      $163 = HEAP32[$162>>2]|0;
      $164 = ($163|0)==($0|0);
      if (!($164)) {
       _abort();
       // unreachable;
      }
      $165 = ((($157)) + 8|0);
      $166 = HEAP32[$165>>2]|0;
      $167 = ($166|0)==($0|0);
      if ($167) {
       HEAP32[$162>>2] = $157;
       HEAP32[$165>>2] = $160;
       $R7$3 = $157;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $181 = ($155|0)==(0|0);
    if (!($181)) {
     $182 = ((($0)) + 28|0);
     $183 = HEAP32[$182>>2]|0;
     $184 = (3628 + ($183<<2)|0);
     $185 = HEAP32[$184>>2]|0;
     $186 = ($0|0)==($185|0);
     if ($186) {
      HEAP32[$184>>2] = $R7$3;
      $cond16 = ($R7$3|0)==(0|0);
      if ($cond16) {
       $187 = 1 << $183;
       $188 = $187 ^ -1;
       $189 = HEAP32[(3328)>>2]|0;
       $190 = $189 & $188;
       HEAP32[(3328)>>2] = $190;
       break;
      }
     } else {
      $191 = HEAP32[(3340)>>2]|0;
      $192 = ($155>>>0)<($191>>>0);
      if ($192) {
       _abort();
       // unreachable;
      }
      $193 = ((($155)) + 16|0);
      $194 = HEAP32[$193>>2]|0;
      $195 = ($194|0)==($0|0);
      if ($195) {
       HEAP32[$193>>2] = $R7$3;
      } else {
       $196 = ((($155)) + 20|0);
       HEAP32[$196>>2] = $R7$3;
      }
      $197 = ($R7$3|0)==(0|0);
      if ($197) {
       break;
      }
     }
     $198 = HEAP32[(3340)>>2]|0;
     $199 = ($R7$3>>>0)<($198>>>0);
     if ($199) {
      _abort();
      // unreachable;
     }
     $200 = ((($R7$3)) + 24|0);
     HEAP32[$200>>2] = $155;
     $201 = ((($0)) + 16|0);
     $202 = HEAP32[$201>>2]|0;
     $203 = ($202|0)==(0|0);
     do {
      if (!($203)) {
       $204 = ($202>>>0)<($198>>>0);
       if ($204) {
        _abort();
        // unreachable;
       } else {
        $205 = ((($R7$3)) + 16|0);
        HEAP32[$205>>2] = $202;
        $206 = ((($202)) + 24|0);
        HEAP32[$206>>2] = $R7$3;
        break;
       }
      }
     } while(0);
     $207 = ((($201)) + 4|0);
     $208 = HEAP32[$207>>2]|0;
     $209 = ($208|0)==(0|0);
     if (!($209)) {
      $210 = HEAP32[(3340)>>2]|0;
      $211 = ($208>>>0)<($210>>>0);
      if ($211) {
       _abort();
       // unreachable;
      } else {
       $212 = ((($R7$3)) + 20|0);
       HEAP32[$212>>2] = $208;
       $213 = ((($208)) + 24|0);
       HEAP32[$213>>2] = $R7$3;
       break;
      }
     }
    }
   }
  } while(0);
  $214 = $129 | 1;
  $215 = ((($$1)) + 4|0);
  HEAP32[$215>>2] = $214;
  $216 = (($$1) + ($129)|0);
  HEAP32[$216>>2] = $129;
  $217 = HEAP32[(3344)>>2]|0;
  $218 = ($$1|0)==($217|0);
  if ($218) {
   HEAP32[(3332)>>2] = $129;
   return;
  } else {
   $$2 = $129;
  }
 } else {
  $219 = $110 & -2;
  HEAP32[$109>>2] = $219;
  $220 = $$14 | 1;
  $221 = ((($$1)) + 4|0);
  HEAP32[$221>>2] = $220;
  $222 = (($$1) + ($$14)|0);
  HEAP32[$222>>2] = $$14;
  $$2 = $$14;
 }
 $223 = $$2 >>> 3;
 $224 = ($$2>>>0)<(256);
 if ($224) {
  $225 = $223 << 1;
  $226 = (3364 + ($225<<2)|0);
  $227 = HEAP32[831]|0;
  $228 = 1 << $223;
  $229 = $227 & $228;
  $230 = ($229|0)==(0);
  if ($230) {
   $231 = $227 | $228;
   HEAP32[831] = $231;
   $$pre = ((($226)) + 8|0);
   $$pre$phiZ2D = $$pre;$F17$0 = $226;
  } else {
   $232 = ((($226)) + 8|0);
   $233 = HEAP32[$232>>2]|0;
   $234 = HEAP32[(3340)>>2]|0;
   $235 = ($233>>>0)<($234>>>0);
   if ($235) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $232;$F17$0 = $233;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $236 = ((($F17$0)) + 12|0);
  HEAP32[$236>>2] = $$1;
  $237 = ((($$1)) + 8|0);
  HEAP32[$237>>2] = $F17$0;
  $238 = ((($$1)) + 12|0);
  HEAP32[$238>>2] = $226;
  return;
 }
 $239 = $$2 >>> 8;
 $240 = ($239|0)==(0);
 if ($240) {
  $I20$0 = 0;
 } else {
  $241 = ($$2>>>0)>(16777215);
  if ($241) {
   $I20$0 = 31;
  } else {
   $242 = (($239) + 1048320)|0;
   $243 = $242 >>> 16;
   $244 = $243 & 8;
   $245 = $239 << $244;
   $246 = (($245) + 520192)|0;
   $247 = $246 >>> 16;
   $248 = $247 & 4;
   $249 = $248 | $244;
   $250 = $245 << $248;
   $251 = (($250) + 245760)|0;
   $252 = $251 >>> 16;
   $253 = $252 & 2;
   $254 = $249 | $253;
   $255 = (14 - ($254))|0;
   $256 = $250 << $253;
   $257 = $256 >>> 15;
   $258 = (($255) + ($257))|0;
   $259 = $258 << 1;
   $260 = (($258) + 7)|0;
   $261 = $$2 >>> $260;
   $262 = $261 & 1;
   $263 = $262 | $259;
   $I20$0 = $263;
  }
 }
 $264 = (3628 + ($I20$0<<2)|0);
 $265 = ((($$1)) + 28|0);
 HEAP32[$265>>2] = $I20$0;
 $266 = ((($$1)) + 16|0);
 $267 = ((($$1)) + 20|0);
 HEAP32[$267>>2] = 0;
 HEAP32[$266>>2] = 0;
 $268 = HEAP32[(3328)>>2]|0;
 $269 = 1 << $I20$0;
 $270 = $268 & $269;
 $271 = ($270|0)==(0);
 if ($271) {
  $272 = $268 | $269;
  HEAP32[(3328)>>2] = $272;
  HEAP32[$264>>2] = $$1;
  $273 = ((($$1)) + 24|0);
  HEAP32[$273>>2] = $264;
  $274 = ((($$1)) + 12|0);
  HEAP32[$274>>2] = $$1;
  $275 = ((($$1)) + 8|0);
  HEAP32[$275>>2] = $$1;
  return;
 }
 $276 = HEAP32[$264>>2]|0;
 $277 = ($I20$0|0)==(31);
 $278 = $I20$0 >>> 1;
 $279 = (25 - ($278))|0;
 $280 = $277 ? 0 : $279;
 $281 = $$2 << $280;
 $K21$0 = $281;$T$0 = $276;
 while(1) {
  $282 = ((($T$0)) + 4|0);
  $283 = HEAP32[$282>>2]|0;
  $284 = $283 & -8;
  $285 = ($284|0)==($$2|0);
  if ($285) {
   $T$0$lcssa = $T$0;
   label = 127;
   break;
  }
  $286 = $K21$0 >>> 31;
  $287 = (((($T$0)) + 16|0) + ($286<<2)|0);
  $288 = $K21$0 << 1;
  $289 = HEAP32[$287>>2]|0;
  $290 = ($289|0)==(0|0);
  if ($290) {
   $$lcssa = $287;$T$0$lcssa30 = $T$0;
   label = 124;
   break;
  } else {
   $K21$0 = $288;$T$0 = $289;
  }
 }
 if ((label|0) == 124) {
  $291 = HEAP32[(3340)>>2]|0;
  $292 = ($$lcssa>>>0)<($291>>>0);
  if ($292) {
   _abort();
   // unreachable;
  }
  HEAP32[$$lcssa>>2] = $$1;
  $293 = ((($$1)) + 24|0);
  HEAP32[$293>>2] = $T$0$lcssa30;
  $294 = ((($$1)) + 12|0);
  HEAP32[$294>>2] = $$1;
  $295 = ((($$1)) + 8|0);
  HEAP32[$295>>2] = $$1;
  return;
 }
 else if ((label|0) == 127) {
  $296 = ((($T$0$lcssa)) + 8|0);
  $297 = HEAP32[$296>>2]|0;
  $298 = HEAP32[(3340)>>2]|0;
  $299 = ($297>>>0)>=($298>>>0);
  $not$ = ($T$0$lcssa>>>0)>=($298>>>0);
  $300 = $299 & $not$;
  if (!($300)) {
   _abort();
   // unreachable;
  }
  $301 = ((($297)) + 12|0);
  HEAP32[$301>>2] = $$1;
  HEAP32[$296>>2] = $$1;
  $302 = ((($$1)) + 8|0);
  HEAP32[$302>>2] = $297;
  $303 = ((($$1)) + 12|0);
  HEAP32[$303>>2] = $T$0$lcssa;
  $304 = ((($$1)) + 24|0);
  HEAP32[$304>>2] = 0;
  return;
 }
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
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
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
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
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
  }
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
  }

// ======== compiled code from system/lib/compiler-rt , see readme therein
function ___muldsi3($a, $b) {
  $a = $a | 0;
  $b = $b | 0;
  var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
  $1 = $a & 65535;
  $2 = $b & 65535;
  $3 = Math_imul($2, $1) | 0;
  $6 = $a >>> 16;
  $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
  $11 = $b >>> 16;
  $12 = Math_imul($11, $1) | 0;
  return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___divdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $7$0 = 0, $7$1 = 0, $8$0 = 0, $10$0 = 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0 | 0, $1$1 ^ $a$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0 | 0, $2$1 ^ $b$1 | 0, $2$0 | 0, $2$1 | 0) | 0;
  $7$0 = $2$0 ^ $1$0;
  $7$1 = $2$1 ^ $1$1;
  $8$0 = ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, 0) | 0;
  $10$0 = _i64Subtract($8$0 ^ $7$0 | 0, tempRet0 ^ $7$1 | 0, $7$0 | 0, $7$1 | 0) | 0;
  return $10$0 | 0;
}
function ___remdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $10$0 = 0, $10$1 = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0 | 0, $1$1 ^ $a$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0 | 0, $2$1 ^ $b$1 | 0, $2$0 | 0, $2$1 | 0) | 0;
  ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, $rem) | 0;
  $10$0 = _i64Subtract(HEAP32[$rem >> 2] ^ $1$0 | 0, HEAP32[$rem + 4 >> 2] ^ $1$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $10$1 = tempRet0;
  STACKTOP = __stackBase__;
  return (tempRet0 = $10$1, $10$0) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
  $x_sroa_0_0_extract_trunc = $a$0;
  $y_sroa_0_0_extract_trunc = $b$0;
  $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
  $1$1 = tempRet0;
  $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
  return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0;
  $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
  return $1$0 | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
  STACKTOP = __stackBase__;
  return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  $rem = $rem | 0;
  var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
  $n_sroa_0_0_extract_trunc = $a$0;
  $n_sroa_1_4_extract_shift$0 = $a$1;
  $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
  $d_sroa_0_0_extract_trunc = $b$0;
  $d_sroa_1_4_extract_shift$0 = $b$1;
  $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
  if (($n_sroa_1_4_extract_trunc | 0) == 0) {
    $4 = ($rem | 0) != 0;
    if (($d_sroa_1_4_extract_trunc | 0) == 0) {
      if ($4) {
        HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
        HEAP32[$rem + 4 >> 2] = 0;
      }
      $_0$1 = 0;
      $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$4) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    }
  }
  $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
  do {
    if (($d_sroa_0_0_extract_trunc | 0) == 0) {
      if ($17) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      if (($n_sroa_0_0_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0;
          HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
      if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
        }
        $_0$1 = 0;
        $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
      $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
      if ($51 >>> 0 <= 30) {
        $57 = $51 + 1 | 0;
        $58 = 31 - $51 | 0;
        $sr_1_ph = $57;
        $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
        $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
        $q_sroa_0_1_ph = 0;
        $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
        break;
      }
      if (($rem | 0) == 0) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = 0 | $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$17) {
        $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($119 >>> 0 <= 31) {
          $125 = $119 + 1 | 0;
          $126 = 31 - $119 | 0;
          $130 = $119 - 31 >> 31;
          $sr_1_ph = $125;
          $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
      if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
        $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
        $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        $89 = 64 - $88 | 0;
        $91 = 32 - $88 | 0;
        $92 = $91 >> 31;
        $95 = $88 - 32 | 0;
        $105 = $95 >> 31;
        $sr_1_ph = $88;
        $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
        $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
        $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
        $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
        break;
      }
      if (($rem | 0) != 0) {
        HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
        HEAP32[$rem + 4 >> 2] = 0;
      }
      if (($d_sroa_0_0_extract_trunc | 0) == 1) {
        $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$0 = 0 | $a$0 & -1;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
        $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
        $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
  } while (0);
  if (($sr_1_ph | 0) == 0) {
    $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
    $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
    $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
    $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = 0;
  } else {
    $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
    $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
    $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
    $137$1 = tempRet0;
    $q_sroa_1_1198 = $q_sroa_1_1_ph;
    $q_sroa_0_1199 = $q_sroa_0_1_ph;
    $r_sroa_1_1200 = $r_sroa_1_1_ph;
    $r_sroa_0_1201 = $r_sroa_0_1_ph;
    $sr_1202 = $sr_1_ph;
    $carry_0203 = 0;
    while (1) {
      $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
      $149 = $carry_0203 | $q_sroa_0_1199 << 1;
      $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
      $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
      _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
      $150$1 = tempRet0;
      $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
      $152 = $151$0 & 1;
      $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
      $r_sroa_0_0_extract_trunc = $154$0;
      $r_sroa_1_4_extract_trunc = tempRet0;
      $155 = $sr_1202 - 1 | 0;
      if (($155 | 0) == 0) {
        break;
      } else {
        $q_sroa_1_1198 = $147;
        $q_sroa_0_1199 = $149;
        $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
        $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
        $sr_1202 = $155;
        $carry_0203 = $152;
      }
    }
    $q_sroa_1_1_lcssa = $147;
    $q_sroa_0_1_lcssa = $149;
    $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
    $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = $152;
  }
  $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
  $q_sroa_0_0_insert_ext75$1 = 0;
  $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
  if (($rem | 0) != 0) {
    HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
    HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
  }
  $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
  $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
}
// =======================================================================



  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&1](a1|0);
}

function b0(p0) {
 p0 = p0|0; abort(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(1);return 0;
}
function b2(p0) {
 p0 = p0|0; abort(2);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdout_write,___stdio_seek,_sn_write,___stdio_write,_do_read,b1,b1];
var FUNCTION_TABLE_vi = [b2,_cleanup_314];

  return { _i64Subtract: _i64Subtract, _free: _free, _i64Add: _i64Add, _memset: _memset, _mine: _mine, _malloc: _malloc, _memcpy: _memcpy, _llvm_bswap_i32: _llvm_bswap_i32, _bitshift64Lshr: _bitshift64Lshr, _fflush: _fflush, ___errno_location: ___errno_location, _bitshift64Shl: _bitshift64Shl, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memset = Module["_memset"] = asm["_memset"];
var _mine = Module["_mine"] = asm["_mine"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===




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
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
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
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
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



