use bytes_helper::Reduce;
use bytes_helper::ReduceRule;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

const FETCH_MODE: u64 = 0;
const STORE_MODE: u64 = 1;

#[wasm_bindgen(raw_module = "./rpcbind.js")]
extern "C" {
    pub fn update_record(hash: Vec<u8>, data: Vec<u64>);
    pub fn get_record(hash: Vec<u8>) -> js_sys::BigUint64Array;
}

pub struct CacheContext {
    pub mode: u64,
    pub hash: Reduce,
    pub data: Vec<u64>,
    pub fetch: bool,
}

fn new_reduce(rules: Vec<ReduceRule>) -> Reduce {
    Reduce { cursor: 0, rules }
}

fn array_from_js_to_u64(js_array: js_sys::BigUint64Array) -> Vec<u64> {
    let mut rust_vec = Vec::with_capacity(js_array.length() as usize);
    for i in 0..js_array.length() {
        rust_vec.push(js_array.get_index(i));
    }
    rust_vec
}

pub fn array_from_u8_to_js(data: &[u8; 32]) -> JsValue {
    JsValue::from(js_sys::Uint8Array::from(&data[..]))
}

impl CacheContext {
    pub fn new() -> Self {
        CacheContext {
            mode: 0,
            hash: new_reduce(vec![ReduceRule::Bytes(vec![], 4)]),
            fetch: false,
            data: vec![],
        }
    }

    pub fn set_mode(&mut self, v: u64) {
        self.mode = v;
        self.data = vec![];
    }

    pub fn set_data_hash(&mut self, v: u64) {
        self.hash.reduce(v);
        if self.hash.cursor == 0 {
            let hash: [u8; 32] = self.hash.rules[0]
                .bytes_value()
                .unwrap()
                .try_into()
                .unwrap();
            if self.mode == FETCH_MODE {
                //let data = get_record(array_from_u8_to_js(&hash.clone()));
                let data = get_record(hash.to_vec());
                self.data = array_from_js_to_u64(data);
                self.fetch = false;
            } else if self.mode == STORE_MODE {
                // put data and hash into mongo_datahash
                if !self.data.is_empty() {
                    update_record(
                        hash.to_vec(),
                        self.data.clone()
                    )
                }
            }
        }
    }

    pub fn fetch_data(&mut self) -> u64 {
        if self.fetch == false {
            self.fetch = true;
            self.data.reverse();
            self.data.len() as u64
        } else {
            self.data.pop().unwrap()
        }
    }

    pub fn store_data(&mut self, v: u64) {
        self.data.push(v);
    }
}

impl CacheContext {}
