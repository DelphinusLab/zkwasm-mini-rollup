use crate::state::State;

const WITHDRAW:u64 = 1;

pub struct SettleMentInfo (Vec<WithdrawInfo>);

pub static mut SETTLEMENT: SettleMentInfo = SettleMentInfo(vec![]);

impl SettleMentInfo {
    pub fn append_settlement(info: WithdrawInfo) {
        unsafe {SETTLEMENT.0.push(info)};
    }
    pub fn flush_settlement() -> Vec<u8> {
        let sinfo = unsafe {&mut SETTLEMENT};
        let mut bytes: Vec<u8> = Vec::with_capacity(sinfo.0.len() * 80);
        for settlement in &sinfo.0 {
            settlement.to_be_bytes(&mut bytes);
        }
        //zkwasm_rust_sdk::dbg!("settlement: {:?}\n", bytes);
        sinfo.0 = vec![];
        State::store();
        bytes
    }
}

pub struct WithdrawInfo {
    pub opinfo: u64,
    pub account_index: u32,
    pub object_index: u32,
    pub amount: [u64; 4],
    pub sender: [u8; 32],
}

pub fn encode_address(v: &Vec<u64>) -> [u8; 32] {
    let mut bytes = Vec::with_capacity(32);
    for i in 0..4 {
        bytes.append(&mut v[i].to_le_bytes().to_vec());
    }
    bytes.try_into().unwrap()

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
            opinfo: (WITHDRAW as u64) + (nounce << 8),
            account_index,
            object_index,
            amount,
            sender,
        }
    }
    /// change everything to big endian that should fits solidity's format
    pub fn to_be_bytes(&self, bytes: &mut Vec<u8>) {
        bytes.append(&mut self.opinfo.to_be_bytes().to_vec());
        bytes.append(&mut self.account_index.to_be_bytes().to_vec());
        bytes.append(&mut self.object_index.to_be_bytes().to_vec());
        for i in 0..4 {
            bytes.append(&mut self.amount[3-i].to_be_bytes().to_vec());
        }
        bytes.append(&mut self.sender.to_vec());
    }
}


