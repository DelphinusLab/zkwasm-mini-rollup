use wasm_bindgen::prelude::*;
use zkwasm_rust_sdk::kvpair::KeyValueMap;
use zkwasm_rust_sdk::{
    wasm_input,
    wasm_output,
    Merkle,
    require,
};
use crate::{verify_tx_signature, DepositInfo};
use crate::output_tx_info;

struct State {
    balance: u64
}

static mut MERKLE_MAP: KeyValueMap<Merkle> = KeyValueMap { merkle: Merkle {
    root: [
        14789582351289948625,
        10919489180071018470,
        10309858136294505219,
        2839580074036780766,
    ]}
};

#[wasm_bindgen]
pub fn handle_tx(params: Vec<u64>) {
    let kvpair = unsafe {&mut MERKLE_MAP};
    let balance = params[0];
    let user_address = [params[4], params[5], params[6], params[7]];

    //let state_buf = kvpair.get([0; 4]); // store the global state at [0; 4]
    let user_data = kvpair.get(&user_address);

    let mut state = if user_data.len() == 0 {
        State {
            balance: 0
        }
    } else {
        State {
            balance: user_data[0]
        }
    };

    state.balance += balance; // charge
    kvpair.set(&user_address, &[state.balance]);
}

#[wasm_bindgen]
pub fn initialize(root: Vec<u64>) {
    unsafe {
        let merkle = Merkle::load([root[0], root[1], root[2], root[3]]);
        MERKLE_MAP.merkle = merkle;
    };
}

#[wasm_bindgen]
pub fn query_root() -> Vec<u64> {
    unsafe {
        MERKLE_MAP.merkle.root.to_vec()
    }
}

#[wasm_bindgen]
pub fn zkmain() {

    let merkle_ref = unsafe {&mut MERKLE_MAP};
    let tx_length = unsafe {wasm_input(0)};

    unsafe {
        initialize([wasm_input(1), wasm_input(1), wasm_input(1), wasm_input(1)].to_vec())
    }

    for _ in 0..tx_length {
        let mut params = Vec::with_capacity(24);
        for _ in 0..24 {
            params.push(unsafe {wasm_input(0)});
        }
        verify_tx_signature(params.clone());
        handle_tx(params);
    }

    let root = merkle_ref.merkle.root;
    unsafe {
            wasm_output(root[0]);
            wasm_output(root[1]);
            wasm_output(root[2]);
            wasm_output(root[3]);
    }

}

#[wasm_bindgen]
pub fn test_merkle() {
    let merkle = Merkle::new();
    let mut kvpair = KeyValueMap::new(merkle);
    kvpair.set(&[0,0,0,0], &[123]);
    let data = kvpair.get(&[0,0,0,0]);
    unsafe {require(data == [123])};
}
