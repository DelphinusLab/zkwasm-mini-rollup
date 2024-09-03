import { __wbg_set_wasm } from "./application_loader.js";
import fs from "fs";

let _print_buf = [];

function print_result() {
  // Convert the array of numbers to a string
  const result = String.fromCharCode(..._print_buf);

  _print_buf = [];
  console.log("wasmdbg:>>> ",result);
}

const __wbg_star0 = (env) => {
  return {
    ...env,
    abort: () => {
      console.error("abort in wasm!");
      throw new Error("Unsupported wasm api: abort");
    },
    require: (b) => {
      if (!b) {
        throw new Error("Require failed");
      } else {
        //console.log("require check success", b);
      }
    },
    wasm_dbg: (c) => {
      console.log("wasm_dbg", c);
    },
    wasm_trace_size: () => {
      return 0n;
    },
      /**
     * - Convert the number to a character
     * - Check if the character is a newline
     * - Print the accumulated result when encountering a newline
     * - Append the character to the print buffer
     */
    wasm_dbg_char: (data) =>
    String.fromCharCode(Number(data)) === "\n"
      ? print_result()
      : _print_buf.push(Number(data)),
    wasm_input: () => {
      console.error("wasm_input should not been called in non-zkwasm mode");
      throw new Error("Unsupported wasm api: wasm_input");
    },
    wasm_output: () => {
      console.error("wasm_input should not been called in non-zkwasm mode");
      throw new Error("Unsupported wasm api: wasm_input");
    },
  };
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

function __wbg_get_imports(env) {
  const imports = {};
  imports.wbg = {};
  imports['env'] = __wbg_star0(env);
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

async function __wbg_init(env, input) {
  if (wasm !== null) {
    console.log("reloading wasm application");
  };

  if (typeof input === 'undefined') {
    input = new URL('application_bg.wasm', import.meta.url);
  }

  const imports = __wbg_get_imports(env);

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

export default __wbg_init;
export * from "./application_loader.js";
