use wasm_bindgen::prelude::*;
use zkwasm_rust_sdk::kvpair::KeyValueMap;
use zkwasm_rust_sdk::{
    wasm_input,
    wasm_output,
    Merkle,
    require,
};
use crate::events::EventQueue;
use crate::state::{Transaction, MERKLE_MAP, Object, Player};
use crate::verify_tx_signature;

#[wasm_bindgen]
pub fn handle_tx(params: Vec<u64>) {
    let kvpair = unsafe {&mut MERKLE_MAP};
    let balance = params[0];
    let user_address = [params[4], params[5], params[6], params[7]];
    let command = [params[0], params[1], params[2], params[3]];
    let transaction = Transaction::decode(command);
    transaction.process(&user_address);
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
pub fn query_account(pid: Vec<u64>) -> String {
    zkwasm_rust_sdk::dbg!("query account {:?}", pid);
    let player = Player::get(&pid.try_into().unwrap()).unwrap();
    let mut objs = vec![];
    for (index, _) in player.objects.iter().enumerate() {
        let oid = player.get_obj_id(index);
        let obj = Object::get(&oid).unwrap();
        objs.push(obj);
    };
    serde_json::to_string(&(player, objs)).unwrap()
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

#[wasm_bindgen]
pub fn test_insert() {
        let pid = [1,1,1,1];
        let t1 = Transaction {
            command: 0,
            objindex: 1,
            modifiers: vec![0,1]
        };

        t1.install_player(&pid);
        t1.install_object(&pid);

        /*
        zkwasm_rust_sdk::dbg!("test load\n");
        let object = Object::get(&oid);
        zkwasm_rust_sdk::dbg!("test load obj done\n");
        let player = Player::get(&pid);
        zkwasm_rust_sdk::dbg!("test load player done\n");
        */
        for _ in 0..30 {
            Transaction::automaton()
        }
}
