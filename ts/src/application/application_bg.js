let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


let cachedBigUint64Memory0 = null;

function getBigUint64Memory0() {
    if (cachedBigUint64Memory0 === null || cachedBigUint64Memory0.byteLength === 0) {
        cachedBigUint64Memory0 = new BigUint64Array(wasm.memory.buffer);
    }
    return cachedBigUint64Memory0;
}

let WASM_VECTOR_LEN = 0;

function passArray64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getBigUint64Memory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
* @param {BigUint64Array} inputs
*/
export function handle_tx(inputs) {
    const ptr0 = passArray64ToWasm0(inputs, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.handle_tx(ptr0, len0);
}

/**
*/
export function zkmain() {
    wasm.zkmain();
}

/**
*/
export function test_merkle() {
    wasm.test_merkle();
}

