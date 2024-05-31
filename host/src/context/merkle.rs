use bytes_helper::Reduce;
use bytes_helper::ReduceRule;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(module = "rpcbind.js")]
extern "C" {
    pub fn update_leaf(root: Vec<u8>, index: u64, leafdata: Vec<u8>) -> js_sys::Array; // root and leaf data is [u8; 32]
    pub fn get_leaf(root: Vec<u8>, index: u64) -> js_sys::Array; // result needs to be [u8; 32]
}

pub const MERKLE_TREE_HEIGHT: usize = 32;

pub struct MerkleContext {
    pub k: u32,
    pub set_root: Reduce,
    pub get_root: Reduce,
    pub address: Reduce,
    pub set: Reduce,
    pub data: [u64; 4],
    pub data_cursor: usize,
    pub fetch: bool,
    pub root: [u8; 32],
    pub used_round: usize,
}

fn new_reduce(rules: Vec<ReduceRule>) -> Reduce {
    Reduce { cursor: 0, rules }
}

impl MerkleContext {
    pub fn new(k: u32) -> Self {
        MerkleContext {
            k,
            set_root: new_reduce(vec![ReduceRule::Bytes(vec![], 4)]),
            get_root: new_reduce(vec![ReduceRule::Bytes(vec![], 4)]),
            address: new_reduce(vec![ReduceRule::U64(0)]),
            set: new_reduce(vec![ReduceRule::Bytes(vec![], 4)]),
            fetch: false,
            data: [0; 4],
            data_cursor: 0,
            root: [0; 32],
            used_round: 0,
        }
    }

    pub fn merkle_setroot(&mut self, v: u64) {
        self.set_root.reduce(v);
        if self.set_root.cursor == 0 {
            self.root = self.set_root.rules[0].bytes_value().unwrap().try_into().unwrap()
        }
    }

    pub fn merkle_getroot(&mut self) -> u64 {
        let hash = self.root;
        let values = hash
            .chunks(8)
            .into_iter()
            .map(|x| u64::from_le_bytes(x.to_vec().try_into().unwrap()))
            .collect::<Vec<u64>>();
        let cursor = self.get_root.cursor;
        self.get_root.reduce(values[self.get_root.cursor]);
        values[cursor]
    }

    /// reset the address of merkle op together with the data and data_cursor
    pub fn merkle_address(&mut self, v: u64) {
        if self.address.cursor == 0 {
            self.used_round += 1;
        }
        self.data = [0; 4];
        self.fetch = false;
        self.data_cursor = 0;
        self.address.reduce(v);
    }

    pub fn merkle_set(&mut self, v: u64) {
        self.set.reduce(v);
        if self.set.cursor == 0 {
            let address = self.address.rules[0].u64_value().unwrap() as u32;
            let index = (address as u64) + (1u64 << MERKLE_TREE_HEIGHT) - 1;
            let hash = self.set.rules[0].bytes_value().unwrap();
            self.root = update_leaf(self.root.to_vec(), index, hash)
                    .into_iter()
                    .map(|v| v.as_f64().unwrap() as u8)
                    .collect::<Vec<_>>()
                    .try_into()
                    .unwrap();
        }
    }

    pub fn merkle_get(&mut self) -> u64 {
        let address = self.address.rules[0].u64_value().unwrap() as u32;
        let index = (address as u64) + (1u64 << MERKLE_TREE_HEIGHT) - 1;
        if self.data_cursor == 0 {
            let leaf = get_leaf(self.root.to_vec(), index)
                .into_iter()
                .map(|v| v.as_f64().unwrap() as u8)
                .collect::<Vec<_>>();
            let values = leaf
                .chunks(8)
                .into_iter()
                .map(|x| u64::from_le_bytes(x.try_into().unwrap()))
                .collect::<Vec<u64>>();
            self.data = values.clone().try_into().unwrap();
        }
        let v = self.data[self.data_cursor];
        self.data_cursor += 1;
        return v;
    }
}

impl MerkleContext {}
