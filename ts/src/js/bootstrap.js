import { __wbg_set_wasm, __wbindgen_throw } from "./bootstrap_bg.js";
import * as gb1 from "./bootstrap_bg.js";
import fs from "fs";

let _print_buf = [];

function print_result() {
  // Convert the array of numbers to a string
  const result = String.fromCharCode(..._print_buf);

  _print_buf = [];
  console.log("Wasm_dbg_char result",result);
}

const __wbg_star0 = {
  abort: () => {
    console.error("abort in wasm!");
    throw new Error("Unsupported wasm api: abort");
  },
  get_record: (obj, c) => {
    console.log(obj);
    console.log(obj, c);
    throw new Error("get record");
  },
  update_record: () => {
    throw new Error("get record");
  },
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get('Content-Type') != 'application/wasm') {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports['env'] = __wbg_star0;
  imports["./bootstrap_bg.js"] = gb1;
  return imports;
}

function __wbg_init_memory(imports, maybe_memory) {
}

let wasm = null;

function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  return wasm;
}

function initSync(module) {
  if (wasm !== undefined) return wasm;
  const imports = __wbg_get_imports();
  __wbg_init_memory(imports);

  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }

  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(input) {
  if (wasm !== null) return wasm;

  if (typeof input === 'undefined') {
    input = new URL('bootstrap_bg.wasm', import.meta.url);
  }

  const imports = __wbg_get_imports();

  if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
    input = fs.readFileSync(input, function (err) {
      if (err) {
        return console.error(err);
      }
    });
  }

  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  let w = __wbg_finalize_init(instance, module);
  __wbg_set_wasm(w);
  return wasm;
}

export { initSync }
export default __wbg_init;
export * from "./bootstrap_bg.js";
