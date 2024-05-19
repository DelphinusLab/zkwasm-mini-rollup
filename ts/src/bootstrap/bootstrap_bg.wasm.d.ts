/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function cache_set_mode(a: number): void;
export function cache_set_hash(a: number): void;
export function cache_store_data(a: number): void;
export function cache_fetch_data(): number;
export function poseidon_new(a: number): void;
export function poseidon_push(a: number): void;
export function poseidon_finalize(): number;
export function babyjubjub_sum_new(a: number): void;
export function babyjubjub_sum_push(a: number): void;
export function babyjubjub_sum_finalize(): number;
export function merkle_setroot(a: number): void;
export function merkle_getroot(): number;
export function merkle_address(a: number): void;
export function merkle_set(a: number): void;
export function merkle_get(): number;
export function check(): number;
export function __wbindgen_free(a: number, b: number, c: number): void;
