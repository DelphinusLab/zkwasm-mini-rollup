use std::sync::Mutex;
use context::{datacache::{array_from_u8_to_js, CacheContext}, jubjub::sum::BabyJubjubSumContext, merkle::MerkleContext, poseidon::PoseidonContext};
use wasm_bindgen::prelude::*;

pub mod poseidon;
pub mod context;
pub mod jubjub;


lazy_static::lazy_static! {
    pub static ref DATACACHE_CONTEXT: Mutex<CacheContext> = Mutex::new(CacheContext::new());
    pub static ref MERKLE_CONTEXT: Mutex<MerkleContext> = Mutex::new(MerkleContext::new(0));
    pub static ref POSEIDON_CONTEXT: Mutex<PoseidonContext> = Mutex::new(PoseidonContext::default(0));
    pub static ref JUBJUB_CONTEXT: Mutex<BabyJubjubSumContext> = Mutex::new(BabyJubjubSumContext::default(0));
}


#[wasm_bindgen]
pub fn cache_set_mode(mode: u64) {
    DATACACHE_CONTEXT.lock().unwrap().set_mode(mode);
}

#[wasm_bindgen]
pub fn cache_set_hash(arg: u64) {
    DATACACHE_CONTEXT.lock().unwrap().set_data_hash(arg);
}

#[wasm_bindgen]
pub fn cache_store_data(data: u64) {
    DATACACHE_CONTEXT.lock().unwrap().store_data(data);
}

#[wasm_bindgen]
pub fn cache_fetch_data() -> u64 {
    DATACACHE_CONTEXT.lock().unwrap().fetch_data()
}

#[wasm_bindgen]
pub fn poseidon_new(arg: u64) {
    POSEIDON_CONTEXT.lock().unwrap().poseidon_new(arg as usize);
}

#[wasm_bindgen]
pub fn poseidon_push(arg: u64) {
    POSEIDON_CONTEXT.lock().unwrap().poseidon_push(arg);
}

#[wasm_bindgen]
pub fn poseidon_finalize() -> u64 {
    POSEIDON_CONTEXT.lock().unwrap().poseidon_finalize()
}

#[wasm_bindgen]
pub fn babyjubjub_sum_new(arg: u64) {
    JUBJUB_CONTEXT.lock().unwrap().babyjubjub_sum_new(arg as usize);
}

#[wasm_bindgen]
pub fn babyjubjub_sum_push(arg: u64) {
    JUBJUB_CONTEXT.lock().unwrap().babyjubjub_sum_push(arg);
}

#[wasm_bindgen]
pub fn babyjubjub_sum_finalize() -> u64 {
    JUBJUB_CONTEXT.lock().unwrap().babyjubjub_sum_finalize()
}

//#[wasm_bindgen]
pub fn merkle_setroot(arg: u64) {
    MERKLE_CONTEXT.lock().unwrap().merkle_setroot(arg);
}

//#[wasm_bindgen]
pub fn merkle_getroot() -> u64 {
    MERKLE_CONTEXT.lock().unwrap().merkle_getroot()
}

//#[wasm_bindgen]
pub fn merkle_address(arg: u64) {
    MERKLE_CONTEXT.lock().unwrap().merkle_address(arg);
}

//#[wasm_bindgen]
pub fn merkle_set(arg: u64) {
    MERKLE_CONTEXT.lock().unwrap().merkle_set(arg);
}

//#[wasm_bindgen]
pub fn merkle_get() -> u64 {
    MERKLE_CONTEXT.lock().unwrap().merkle_get()
}


#[wasm_bindgen]
pub fn check() {
    unsafe {
        crate::context::datacache::get_record([10;32].to_vec())
    };
}
