use crate::StorageData;
use crate::MERKLE_MAP;
use core::slice::IterMut;
use serde::Serialize;
use std::cell::{Ref, RefCell, RefMut};
use zkwasm_rest_abi::Player;
use zkwasm_rest_convention::CommonState;
use zkwasm_rest_convention::SettlementInfo;

#[derive(Debug, Serialize)]
pub struct PlayerData {
    pub counter: u64,
}

impl Default for PlayerData {
    fn default() -> Self {
        Self { counter: 0 }
    }
}

impl StorageData for PlayerData {
    fn from_data(u64data: &mut IterMut<u64>) -> Self {
        let counter = *u64data.next().unwrap();
        PlayerData { counter }
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.counter);
    }
}

pub type HelloWorldPlayer = Player<PlayerData>;

#[derive(Serialize, Default)]
pub struct State {}

pub struct SafeState(pub RefCell<State>);
unsafe impl Sync for SafeState {}

lazy_static::lazy_static! {
    pub static ref GLOBAL_STATE: SafeState = SafeState(RefCell::new(State::new()));
}

impl CommonState for State {
    type PlayerData = PlayerData;

    fn get_global<'a>() -> Ref<'a, State> {
        GLOBAL_STATE.0.borrow()
    }
    fn get_global_mut<'a>() -> RefMut<'a, State> {
        GLOBAL_STATE.0.borrow_mut()
    }
}

impl StorageData for State {
    fn from_data(_u64data: &mut IterMut<u64>) -> Self {
        State {}
    }
    fn to_data(&self, _data: &mut Vec<u64>) {}
}

impl State {
    pub fn flush_settlement() -> Vec<u8> {
        let data = SettlementInfo::flush_settlement();
        data
    }
    pub fn new() -> Self {
        State {}
    }

    pub fn store() {
        unsafe { STATE.store() };
    }
}

pub static mut STATE: State = State {};

pub struct Transaction {
    pub command: u64,
    pub data: Vec<u64>,
}

const INSTALL_PLAYER: u64 = 1;
const INC_COUNTER: u64 = 2;

const ERROR_PLAYER_ALREADY_EXIST: u32 = 1;
const ERROR_PLAYER_NOT_EXIST: u32 = 2;

impl Transaction {
    pub fn decode_error(e: u32) -> &'static str {
        match e {
            ERROR_PLAYER_NOT_EXIST => "PlayerNotExist",
            ERROR_PLAYER_ALREADY_EXIST => "PlayerAlreadyExist",
            _ => "Unknown",
        }
    }
    pub fn decode(params: &[u64]) -> Self {
        let command = params[0] & 0xff;
        //let nonce = params[0] >> 16;
        let data = vec![params[1], params[2], params[3]]; // pkey[0], pkey[1], amount
        Transaction { command, data }
    }
    pub fn install_player(&self, pkey: &[u64; 4]) -> u32 {
        zkwasm_rust_sdk::dbg!("install \n");
        let pid = HelloWorldPlayer::pkey_to_pid(pkey);
        let player = HelloWorldPlayer::get_from_pid(&pid);
        match player {
            Some(_) => ERROR_PLAYER_ALREADY_EXIST,
            None => {
                let player = HelloWorldPlayer::new_from_pid(pid);
                player.store();
                0
            }
        }
    }

    pub fn inc_counter(&self, _pkey: &[u64; 4]) -> u32 {
        //let player = HelloWorldPlayer::get(pkey);
        todo!()
    }

    pub fn process(&self, pkey: &[u64; 4], _rand: &[u64; 4]) -> Vec<u64> {
        let b = match self.command {
            INSTALL_PLAYER => self.install_player(pkey),
            INC_COUNTER => self.inc_counter(pkey),
            _ => 0,
        };
        let kvpair = unsafe { &mut MERKLE_MAP.merkle.root };
        zkwasm_rust_sdk::dbg!("root after process {:?}\n", kvpair);
        vec![b as u64]
    }
}
