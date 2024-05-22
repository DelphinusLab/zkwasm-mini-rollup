use zkwasm_rust_sdk::jubjub::BabyJubjubPoint;
use zkwasm_rust_sdk::jubjub::JubjubSignature;
use zkwasm_rust_sdk::wasm_input;
use zkwasm_rust_sdk::wasm_output;
use sha2::{Sha256, Digest};
use primitive_types::U256;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn handle_tx(inputs: Vec<u64>) {
    let pk = unsafe {BabyJubjubPoint {
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
    }};
    zkwasm_rust_sdk::dbg!("process sig\n");
    let sig = unsafe {JubjubSignature {
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
    }};

    zkwasm_rust_sdk::dbg!("verifying signature ...\n");
    sig.verify(&pk, &[inputs[0], inputs[1], inputs[2], inputs[3]]);
}

pub fn process_inputs(step: &mut impl FnMut(u64)) -> [u64; 4] {
    let mut hasher = Sha256::new();

    let commands_len = unsafe {wasm_input(0)};
    for _ in 0..commands_len {
        let command = unsafe {wasm_input(0)};
        hasher.update(command.to_le_bytes());
        step(command);
    }

    let msghash = hasher.finalize();

    zkwasm_rust_sdk::dbg!("command hash is {:?}\n", msghash);

    let pk = unsafe {BabyJubjubPoint {
        x: U256([
                wasm_input(0),
                wasm_input(0),
                wasm_input(0),
                wasm_input(0),
        ]),
        y: U256([
                wasm_input(0),
                wasm_input(0),
                wasm_input(0),
                wasm_input(0),
        ]),
    }};
    zkwasm_rust_sdk::dbg!("process sig\n");
    let sig = unsafe {JubjubSignature {
        sig_r: BabyJubjubPoint {
            x: U256([
                    wasm_input(0),
                    wasm_input(0),
                    wasm_input(0),
                    wasm_input(0),
            ]),
            y: U256([
                    wasm_input(0),
                    wasm_input(0),
                    wasm_input(0),
                    wasm_input(0),
            ]),
        },
        sig_s: [
            wasm_input(0),
            wasm_input(0),
            wasm_input(0),
            wasm_input(0),
        ]
    }};
    zkwasm_rust_sdk::dbg!("start verifying ...\n");

    let msghash_u64 = [
        u64::from_be_bytes(msghash[24..32].try_into().unwrap()),
        u64::from_be_bytes(msghash[16..24].try_into().unwrap()),
        u64::from_be_bytes(msghash[8..16].try_into().unwrap()),
        u64::from_be_bytes(msghash[0..8].try_into().unwrap()),
    ];

    sig.verify(&pk, &msghash_u64);
    pk.x.0
}

pub const DEPOSIT: u8 = 0x0;
pub const WITHDRAW: u8 = 0x1;

pub struct TxInfo {
    pub opinfo: u64,
    pub account_index: u32,
    pub object_index: u32,
    pub args: [u64; 8],
}

pub struct DepositInfo {
    pub opinfo: u64,
    pub account_index: u32,
    pub object_index: u32,
    pub amount: [u64; 4],
    pub sender: [u8; 32],
}

pub struct WithdrawInfo {
    pub opinfo: u64,
    pub account_index: u32,
    pub object_index: u32,
    pub amount: [u64; 4],
    pub sender: [u8; 32],
}

/// encode bytes into wasm output
pub fn output_tx_info(data: &[u8; 80]) {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    for c in result.chunks_exact(8) {
        zkwasm_rust_sdk::dbg!("c is {:?}", c);
        unsafe { wasm_output(u64::from_le_bytes(c.try_into().unwrap())) }
    }
}

impl DepositInfo {
    pub fn new(
        nounce: u64,
        account_index: u32,
        object_index: u32,
        amount: [u64; 4],
        sender: [u8; 32],
    ) -> Self {
        DepositInfo {
            opinfo: (DEPOSIT as u64) + (nounce << 8),
            account_index,
            object_index,
            amount,
            sender,
        }
    }
    /// change everything to big endian that should fits solidity's format
    pub fn to_be_bytes(&self) -> [u8; 80] {
        let mut bytes = vec![];
        bytes.append(&mut self.opinfo.to_be_bytes().to_vec());
        bytes.append(&mut self.account_index.to_be_bytes().to_vec());
        bytes.append(&mut self.object_index.to_be_bytes().to_vec());
        for i in 0..4 {
            bytes.append(&mut self.amount[3-i].to_be_bytes().to_vec());
        }
        bytes.append(&mut self.sender.to_vec());
        bytes.try_into().unwrap()
    }
}

impl WithdrawInfo {
    pub fn new(
        nounce: u64,
        account_index: u32,
        object_index: u32,
        amount: [u64; 4],
        sender: [u8; 32],
    ) -> Self {
        WithdrawInfo {
            opinfo: (DEPOSIT as u64) + (nounce << 8),
            account_index,
            object_index,
            amount,
            sender,
        }
    }
    /// change everything to big endian that should fits solidity's format
    pub fn to_be_bytes(&self) -> [u8; 80] {
        let mut bytes = vec![];
        bytes.append(&mut self.opinfo.to_be_bytes().to_vec());
        bytes.append(&mut self.account_index.to_be_bytes().to_vec());
        bytes.append(&mut self.object_index.to_be_bytes().to_vec());
        for i in 0..4 {
            bytes.append(&mut self.amount[3-i].to_be_bytes().to_vec());
        }
        bytes.append(&mut self.sender.to_vec());
        bytes.try_into().unwrap()

    }
}

#[cfg(feature = "local")]
mod test;
