use zkwasm_rest_abi::{Player, StorageData, enforce};
use zkwasm_rest_abi::WithdrawInfo;
use crate::SettlementInfo;
use crate::err::ErrorEncoder;

pub trait WithBalance {
    fn cost_balance(&mut self, amount: u64) -> Result<(), u32>;
    fn inc_balance(&mut self, amount: u64);
}

pub trait SubCommand: Sized {
    fn decode(command: u64, params: &[u64]) -> Option<Self>;
}

pub trait PlayerData: StorageData + WithBalance + Default {}

pub trait CommandHandler {
    fn handle<P: StorageData + WithBalance + Default>(&self, pid: &[u64; 2], nonce: u64, rand: &[u64; 4], counter: u64) -> Result<(), u32>;
}

#[derive (Clone)]
pub enum Command<Activity: SubCommand> {
    // standard activities
    Activity(Activity),
    // standard withdraw and deposit
    Withdraw(Withdraw),
    Deposit(Deposit),
    // standard player install and timer
    InstallPlayer,
    Tick,
}

pub struct TransactionData<Activity: SubCommand> {
    pub command: Command<Activity>,
    pub nonce: u64,
}

/* 0 for tick
 * 1 for InstallPlayer
 * 2 for Withdraw
 * 3 for Deposit
 * 4 customize commands
 */
const TICK: u64 = 0;
const INSTALL_PLAYER: u64 = 1;
const WITHDRAW: u64 = 2;
const DEPOSIT: u64 = 3;
pub const COMMAND_BASE:u64 = 4;

#[derive (Clone)]
pub struct Withdraw {
    pub data: [u64; 3],
}

const PLAYER_MODULE: u32 = 1;
const PLAYER_ERROR: [&'static str; 2] = ["PlayerAlreadyExist", "PlayerNotExist"];
pub struct PlayerError ();


impl ErrorEncoder for PlayerError {
    const MODULE_ID: u32 = PLAYER_MODULE;
    const ERROR_STR: &'static [&'static str] = &PLAYER_ERROR;
}

impl PlayerError {
    pub const ERROR_PLAYER_ALREADY_EXIST: u32 = 0;
    pub const ERROR_PLAYER_NOT_EXIST: u32 = 1;
}

impl CommandHandler for Withdraw {
    fn handle<P: StorageData + WithBalance + Default>(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut player = Player::<P>::get_from_pid(pid);
        match player.as_mut() {
            None => Err(PlayerError::encode(PlayerError::ERROR_PLAYER_NOT_EXIST)),
            Some(player) => {
                player.check_and_inc_nonce(nonce);
                let amount = self.data[0] & 0xffffffff;
                player.data.cost_balance(amount)?;
                let withdrawinfo =
                    WithdrawInfo::new(&[self.data[0], self.data[1], self.data[2]], 0);
                SettlementInfo::append_settlement(withdrawinfo);
                player.store();
                Ok(())
            }
        }
    }
}

#[derive (Clone)]
pub struct Deposit {
    pub data: [u64; 3],
}

impl CommandHandler for Deposit {
    fn handle<P: StorageData + WithBalance + Default>(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut admin = Player::<P>::get_from_pid(pid).unwrap();
        admin.check_and_inc_nonce(nonce);
        let mut player = Player::<P>::get_from_pid(&[self.data[0], self.data[1]]);
        match player.as_mut() {
            None => Err(PlayerError::encode(PlayerError::ERROR_PLAYER_NOT_EXIST)),
            Some(player) => {
                player.data.inc_balance(self.data[2]);
                player.store();
                admin.store();
                Ok(())
            }
        }
    }
}

impl<Activity: SubCommand> TransactionData<Activity> {
    pub fn decode(params: &[u64]) -> Self {
        let command = params[0] & 0xff;
        let nonce = params[0] >> 16;
        let command = if command == WITHDRAW {
            Command::Withdraw (Withdraw {
                data: [params[2], params[3], params[4]]
            })
        } else if command == DEPOSIT {
            enforce(params[3] == 0, "check deposit index"); // only token index 0 is supported
            Command::Deposit (Deposit {
                data: [params[1], params[2], params[4]]
            })
        } else if command == INSTALL_PLAYER {
            Command::InstallPlayer
        } else if let Some(activity) = Activity::decode(command, &params[1..]) {
            Command::Activity(activity)
        } else {
            unsafe {zkwasm_rust_sdk::require(command == TICK)};
            Command::Tick
        };
        TransactionData {
            command,
            nonce,
        }
    }
}
