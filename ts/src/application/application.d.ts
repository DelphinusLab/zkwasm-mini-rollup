/* tslint:disable */
/* eslint-disable */
/**
* @param {BigUint64Array} inputs
*/
export function verify_tx_signature(inputs: BigUint64Array): void;
/**
* @param {BigUint64Array} params
*/
export function handle_tx(params: BigUint64Array): void;
/**
* @param {BigUint64Array} root
*/
export function initialize(root: BigUint64Array): void;
/**
* @returns {BigUint64Array}
*/
export function query_root(): BigUint64Array;
/**
* @param {BigUint64Array} pid
* @returns {string}
*/
export function query_account(pid: BigUint64Array): string;
/**
*/
export function zkmain(): void;
/**
*/
export function test_merkle(): void;
/**
*/
export function test_insert(): void;
