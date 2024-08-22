/* tslint:disable */
/* eslint-disable */
/**
* @param {BigUint64Array} params
* @returns {number}
*/
export function handle_tx(params: BigUint64Array): number;
/**
* @param {BigUint64Array} pid
* @returns {string}
*/
export function get_state(pid: BigUint64Array): string;
/**
* @param {number} e
* @returns {string}
*/
export function decode_error(e: number): string;
/**
* @returns {string}
*/
export function get_config(): string;
/**
* @returns {boolean}
*/
export function preempt(): boolean;
/**
* @returns {boolean}
*/
export function autotick(): boolean;
/**
* @param {BigUint64Array} root
*/
export function initialize(root: BigUint64Array): void;
/**
* @returns {Uint8Array}
*/
export function finalize(): Uint8Array;
/**
*/
export function zkmain(): void;
/**
* @returns {BigUint64Array}
*/
export function query_root(): BigUint64Array;
/**
* @param {BigUint64Array} inputs
*/
export function verify_tx_signature(inputs: BigUint64Array): void;
/**
*/
export function test_merkle(): void;
