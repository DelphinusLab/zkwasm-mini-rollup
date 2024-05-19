import { update_record, get_record } from './rpcbind.js';

let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

let cachedBigUint64Memory0 = null;

function getBigUint64Memory0() {
    if (cachedBigUint64Memory0 === null || cachedBigUint64Memory0.byteLength === 0) {
        cachedBigUint64Memory0 = new BigUint64Array(wasm.memory.buffer);
    }
    return cachedBigUint64Memory0;
}

function getArrayU64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getBigUint64Memory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
* @param {bigint} mode
*/
export function cache_set_mode(mode) {
    wasm.cache_set_mode(mode);
}

/**
* @param {bigint} arg
*/
export function cache_set_hash(arg) {
    wasm.cache_set_hash(arg);
}

/**
* @param {bigint} data
*/
export function cache_store_data(data) {
    wasm.cache_store_data(data);
}

/**
* @returns {bigint}
*/
export function cache_fetch_data() {
    const ret = wasm.cache_fetch_data();
    return BigInt.asUintN(64, ret);
}

/**
* @param {bigint} arg
*/
export function poseidon_new(arg) {
    wasm.poseidon_new(arg);
}

/**
* @param {bigint} arg
*/
export function poseidon_push(arg) {
    wasm.poseidon_push(arg);
}

/**
* @returns {bigint}
*/
export function poseidon_finalize() {
    const ret = wasm.poseidon_finalize();
    return BigInt.asUintN(64, ret);
}

/**
* @param {bigint} arg
*/
export function babyjubjub_sum_new(arg) {
    wasm.babyjubjub_sum_new(arg);
}

/**
* @param {bigint} arg
*/
export function babyjubjub_sum_push(arg) {
    wasm.babyjubjub_sum_push(arg);
}

/**
* @returns {bigint}
*/
export function babyjubjub_sum_finalize() {
    const ret = wasm.babyjubjub_sum_finalize();
    return BigInt.asUintN(64, ret);
}

/**
*/
export function check() {
    wasm.check();
}

export function __wbindgen_object_drop_ref(arg0) {
    takeObject(arg0);
};

export function __wbg_getrecord_4c730ffdc5ac97a0(arg0, arg1) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    const ret = get_record(v0);
    return addHeapObject(ret);
};

export function __wbg_updaterecord_9efc2e1d014d3f6a(arg0, arg1, arg2) {
    var v0 = getArrayU64FromWasm0(arg1, arg2).slice();
    wasm.__wbindgen_free(arg1, arg2 * 8, 8);
    update_record(takeObject(arg0), v0);
};

export function __wbg_buffer_12d079cc21e14bdb(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
};

export function __wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
};

export function __wbg_new_63b92bc8671ed464(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
};

export function __wbg_length_a641162bc8055216(arg0) {
    const ret = getObject(arg0).length;
    return ret;
};

export function __wbg_getindex_26a23bb6676e7d33(arg0, arg1) {
    const ret = getObject(arg0)[arg1 >>> 0];
    return ret;
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return addHeapObject(ret);
};

