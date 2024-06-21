use sha2::{Sha256, Digest};
use zkwasm_rust_sdk::jubjub::BabyJubjubPoint;
use zkwasm_rust_sdk::jubjub::JubjubSignature;
use zkwasm_rust_sdk::kvpair::KeyValueMap;
use zkwasm_rust_sdk::Merkle;
use primitive_types::U256;
use wasm_bindgen::prelude::*;

pub static mut MERKLE_MAP: KeyValueMap<Merkle> = KeyValueMap { merkle: Merkle {
    root: [
        14789582351289948625,
        10919489180071018470,
        10309858136294505219,
        2839580074036780766,
    ]}
};

#[wasm_bindgen]
pub fn query_root() -> Vec<u64> {
    unsafe {
        let root = 
            MERKLE_MAP.merkle.root.clone();
        zkwasm_rust_sdk::dbg!("query root: {:?}\n",  root);
        MERKLE_MAP.merkle.root.to_vec()
    }
}

#[wasm_bindgen]
pub fn verify_tx_signature(inputs: Vec<u64>) {
    let pk = BabyJubjubPoint {
        x: U256([
                inputs[4],
                inputs[5],
                inputs[6],
                inputs[7],
        ]),
        y: U256([
                inputs[8],
                inputs[9],
                inputs[10],
                inputs[11],
        ]),
    };

    let sig = JubjubSignature {
        sig_r: BabyJubjubPoint {
            x: U256([
                inputs[12],
                inputs[13],
                inputs[14],
                inputs[15],
            ]),
            y: U256([
                inputs[16],
                inputs[17],
                inputs[18],
                inputs[19],
            ]),
        },
        sig_s: [
            inputs[20],
            inputs[21],
            inputs[22],
            inputs[23],
        ]
    };
    sig.verify(&pk, &[inputs[0], inputs[1], inputs[2], inputs[3]]);
}

/// encode bytes into wasm output
pub fn conclude_tx_info(data: &[u8]) -> [u64;4] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher
        .finalize()
        .chunks_exact(8)
        .map(|x| {
            u64::from_be_bytes(x.try_into().unwrap())
        }).collect::<Vec<_>>();
    result.try_into().unwrap()
}

#[macro_export]
macro_rules! create_zkwasm_apis {
    ($T: ident, $S: ident, $C: ident) => {
    #[wasm_bindgen]
        pub fn handle_tx(params: Vec<u64>) {
            let user_address = [params[4], params[5], params[6], params[7]];
            let command = [params[0], params[1], params[2], params[3]];
            let transaction = $T::decode(command);
            transaction.process(&user_address);
        }

    #[wasm_bindgen]
        pub fn get_state(pid: Vec<u64>) -> String {
            $S::get_state(pid)
        }

    #[wasm_bindgen]
        pub fn get_config() -> String {
            $C::to_json_string()
        }

    #[wasm_bindgen]
    pub fn initialize(root: Vec<u64>) {
        unsafe {
            let merkle = zkwasm_rust_sdk::Merkle::load([root[0], root[1], root[2], root[3]]);
            MERKLE_MAP.merkle = merkle;
            $S::initialize();
        };
    }

    #[wasm_bindgen]
    pub fn finalize() -> Vec<u8> {
        unsafe {
            $C::flush_settlement()
        }
    }


    #[wasm_bindgen]
        pub fn zkmain() {
            use zkwasm_rust_sdk::wasm_input;
            use zkwasm_rust_sdk::wasm_output;
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

            let bytes = $C::flush_settlement();
            let txdata = conclude_tx_info(bytes.as_slice());

            let root = merkle_ref.merkle.root;
            unsafe {
                wasm_output(root[0]);
                wasm_output(root[1]);
                wasm_output(root[2]);
                wasm_output(root[3]);
            }

            unsafe {
                wasm_output(txdata[0]);
                wasm_output(txdata[1]);
                wasm_output(txdata[2]);
                wasm_output(txdata[3]);
            }
        }
    }
}


#[wasm_bindgen]
pub fn test_merkle() {
    let merkle = zkwasm_rust_sdk::Merkle::new();
    let mut kvpair = KeyValueMap::new(merkle);
    kvpair.set(&[0,0,0,0], &[123]);
    let data = kvpair.get(&[0,0,0,0]);
    unsafe {zkwasm_rust_sdk::require(data == [123])};
}
