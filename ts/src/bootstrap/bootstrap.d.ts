/* tslint:disable */
/* eslint-disable */
/**
* @param {bigint} mode
*/
export function cache_set_mode(mode: bigint): void;
/**
* @param {bigint} arg
*/
export function cache_set_hash(arg: bigint): void;
/**
* @param {bigint} data
*/
export function cache_store_data(data: bigint): void;
/**
* @returns {bigint}
*/
export function cache_fetch_data(): bigint;
/**
* @param {bigint} arg
*/
export function poseidon_new(arg: bigint): void;
/**
* @param {bigint} arg
*/
export function poseidon_push(arg: bigint): void;
/**
* @returns {bigint}
*/
export function poseidon_finalize(): bigint;
/**
* @param {bigint} arg
*/
export function babyjubjub_sum_new(arg: bigint): void;
/**
* @param {bigint} arg
*/
export function babyjubjub_sum_push(arg: bigint): void;
/**
* @returns {bigint}
*/
export function babyjubjub_sum_finalize(): bigint;
/**
* @param {bigint} arg
*/
export function merkle_setroot(arg: bigint): void;
/**
* @returns {bigint}
*/
export function merkle_getroot(): bigint;
/**
* @param {bigint} arg
*/
export function merkle_address(arg: bigint): void;
/**
* @param {bigint} arg
*/
export function merkle_set(arg: bigint): void;
/**
* @returns {bigint}
*/
export function merkle_get(): bigint;
/**
* @returns {BigUint64Array}
*/
export function check(): BigUint64Array;

export default function __wbg_init(): Promise<void>;
