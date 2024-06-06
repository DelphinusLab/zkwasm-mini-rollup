struct SettleMentInfo (Vec<WithdrawInfo>)

pub static SETTLEMENT: SettleMentInfo = SettleMentInfo(vec![])

impl SettleMentInfo {
    pub fn append_settlement(info: WithdrawInfo) {
        SETTLEMENT.append(info);
    }
    pub fn flush_settlement(info: WithdrawInfo) {
        let sinfo = SETTLEMENT;
        let mut bytes: Vec<u8> = Vec::with_capacity(sinfo.0.length * 80);
        for settlement in SETTLEMENT.0 {
            settlement.to_be_bytes(bytes);
        }
        output_tx_info(bytes.as_slice());
    }
}

pub struct WithdrawInfo {
    pub opinfo: u64,
    pub account_index: u32,
    pub object_index: u32,
    pub amount: [u64; 4],
    pub sender: [u8; 32],
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
    pub fn to_be_bytes(&self, bytes: &mut Vec<u8>) {
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

/// encode bytes into wasm output
pub fn output_tx_info(data: &[u8]) {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    for c in result.chunks_exact(8) {
        unsafe { wasm_output(u64::from_le_bytes(c.try_into().unwrap())) }
    }
    zkwasm_rust_sdk::dbg!("settlement data is {:?}", result);
}
