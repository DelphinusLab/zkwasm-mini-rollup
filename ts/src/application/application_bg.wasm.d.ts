/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function handle_tx(a: number, b: number, c: number): void;
export function get_state(a: number, b: number, c: number): void;
export function snapshot(a: number): void;
export function decode_error(a: number, b: number): void;
export function get_config(a: number): void;
export function preempt(): number;
export function autotick(): number;
export function randSeed(): number;
export function initialize(a: number, b: number): void;
export function finalize(a: number): void;
export function zkmain(): void;
export function query_root(a: number): void;
export function verify_tx_signature(a: number, b: number): void;
export function test_merkle(): void;
export function __wbindgen_add_to_stack_pointer(a: number): number;
export function __wbindgen_malloc(a: number, b: number): number;
export function __wbindgen_free(a: number, b: number, c: number): void;
