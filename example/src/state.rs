use crate::{game::RoundInfo, player::CombatPlayer, settlement::SettlementInfo};
use serde::Serialize;
use zkwasm_rest_abi::{WithdrawInfo, MERKLE_MAP};
use zkwasm_rust_sdk::require;
use crate::game::Game;

const TIMETICK: u32 = 0;
const WITHDRAW: u32 = 1;
const DEPOSIT: u32 = 2;

pub struct Transaction {
    pub command: u32,
    pub data: [u64; 3],
}

const ERROR_PLAYER_NOT_FOUND: u32 = 1;

impl Transaction {
    pub fn decode_error(e: u32) -> &'static str{
        match e {
            ERROR_PLAYER_NOT_FOUND => "PlayerNotFound",
            _ => "Unknown"
        }
    }

    pub fn decode(params: [u64; 4]) -> Self {
        let command = (params[0] & 0xffffffff) as u32;
        Transaction {
            command,
            data: [params[1], params[2], params[3]]
        }
    }

    pub fn deposit(&self) -> u32 {
        let pid = [self.data[0], self.data[1]];
        let mut player = CombatPlayer::get_from_pid(&pid);
        let balance = self.data[3];
        match player.as_mut() {
            None => {
                let player = CombatPlayer::new_from_pid(pid);
                player.store();
            },
            Some(player) => {
                player.data.balance += balance;
                player.store();
            }
        }
        0
    }

    pub fn withdraw(&self, pkey: &[u64; 4]) -> u32 {
        let mut player = CombatPlayer::get_from_pid(&CombatPlayer::pkey_to_pid(pkey));
        match player.as_mut() {
            None => ERROR_PLAYER_NOT_FOUND,
            Some(player) => {
                let amount = self.data[0] & 0xffffffff;
                unsafe {require(player.data.balance >= amount)};
                let withdrawinfo = WithdrawInfo::new(&self.data);
                SettlementInfo::append_settlement(withdrawinfo);
                player.data.balance -= amount;
                player.store();
                0
            }
        }
    }

    pub fn process(&self, pid: &[u64; 4], _sigr: &[u64; 4]) -> u32 {
        if self.command == TIMETICK {
            let state = unsafe { &mut STATE };
            state.counter += 1;
            state.game.settle();
            0
        } else if self.command == WITHDRAW {
            self.withdraw(pid)
        } else if self.command == DEPOSIT {
            self.deposit()
        } else {
            unreachable!()
        }
    }
}

#[derive (Serialize)]
pub struct State {
    counter: u64,
    game: Game
}

pub static mut STATE: State  = State {
    counter: 0,
    game: Game {
        total_dps: 0,
        progress: 0,
        target: 0,
        last_round_info: RoundInfo {
            locked_dps: 0,
            locked_rewards: 0
        }
    }
};

impl State {
    pub fn initialize() {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let mut data = kvpair.get(&[0, 0, 0, 0]);
        if !data.is_empty() {
            unsafe { STATE.counter =  data.pop().unwrap() };
        }
    }

    pub fn preempt() -> bool {
        return true;
    }

    pub fn rand_seed() -> u64 {
        return 0;
    }

    pub fn snapshot() -> String {
        serde_json::to_string(unsafe {&STATE}).unwrap()
    }

    pub fn get_state(_pid: Vec<u64>) -> String {
        "anonymous".to_string()
    }

    pub fn store(&self) {
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&[0, 0, 0, 0], &vec![self.counter]);
        let root = kvpair.merkle.root.clone();
        zkwasm_rust_sdk::dbg!("root after store: {:?}\n", root);
    }

    pub fn flush_settlement() -> Vec<u8> {
        let data = SettlementInfo::flush_settlement();
        unsafe {STATE.store()};
        data
    }

}
