import { update_leaf, get_leaf, update_record, get_record } from './rpcbind.js';

let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

function isLikeNone(x) {
    return x === undefined || x === null;
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
    if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
        cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64Memory0;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}

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

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
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
* @param {bigint} arg
*/
export function merkle_setroot(arg) {
    wasm.merkle_setroot(arg);
}

/**
* @returns {bigint}
*/
export function merkle_getroot() {
    const ret = wasm.merkle_getroot();
    return BigInt.asUintN(64, ret);
}

/**
* @param {bigint} arg
*/
export function merkle_address(arg) {
    wasm.merkle_address(arg);
}

/**
* @param {bigint} arg
*/
export function merkle_set(arg) {
    wasm.merkle_set(arg);
}

/**
* @returns {bigint}
*/
export function merkle_get() {
    const ret = wasm.merkle_get();
    return BigInt.asUintN(64, ret);
}

/**
* @returns {BigUint64Array}
*/
export function check() {
    const ret = wasm.check();
    return takeObject(ret);
}

export function __wbindgen_number_get(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
    getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
};

export function __wbindgen_object_drop_ref(arg0) {
    takeObject(arg0);
};

export function __wbg_updateleaf_c52d6903ac400a66(arg0, arg1, arg2, arg3, arg4) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    var v1 = getArrayU8FromWasm0(arg3, arg4).slice();
    wasm.__wbindgen_free(arg3, arg4 * 1, 1);
    const ret = update_leaf(v0, BigInt.asUintN(64, arg2), v1);
    return addHeapObject(ret);
};

export function __wbg_getleaf_dc1011d3abd689e9(arg0, arg1, arg2) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    const ret = get_leaf(v0, BigInt.asUintN(64, arg2));
    return addHeapObject(ret);
};

export function __wbg_getrecord_9b375b736bbeb572(arg0, arg1) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    const ret = get_record(v0);
    return addHeapObject(ret);
};

export function __wbg_updaterecord_0ea13efa10ca9772(arg0, arg1, arg2, arg3) {
    var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
    wasm.__wbindgen_free(arg0, arg1 * 1, 1);
    var v1 = getArrayU64FromWasm0(arg2, arg3).slice();
    wasm.__wbindgen_free(arg2, arg3 * 8, 8);
    update_record(v0, v1);
};

export function __wbg_get_bd8e338fbd5f5cc8(arg0, arg1) {
    const ret = getObject(arg0)[arg1 >>> 0];
    return addHeapObject(ret);
};

export function __wbg_length_cd7af8117672b8b8(arg0) {
    const ret = getObject(arg0).length;
    return ret;
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

