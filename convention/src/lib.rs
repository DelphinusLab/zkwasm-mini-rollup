#![feature(linked_list_cursors)]
use core::slice::IterMut;
use serde::Serialize;
use std::cell::{Ref, RefMut};
use std::collections::LinkedList;
use zkwasm_rest_abi::{Player, StorageData, MERKLE_MAP, enforce};
use std::marker::PhantomData;

pub trait SubCommand: Sized {
    fn decode(command: u64, params: &[u64]) -> Option<Self>;
}

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

pub const ERROR_PLAYER_ALREADY_EXIST: u32 = 1;
pub const ERROR_PLAYER_NOT_EXIST: u32 = 2;

#[derive (Clone)]
pub struct Withdraw {
    pub data: [u64; 3],
}

impl CommandHandler for Withdraw {
    fn handle<P: StorageData + WithBalance + Default>(&self, pid: &[u64; 2], nonce: u64, _rand: &[u64; 4], _counter: u64) -> Result<(), u32> {
        let mut player = Player::<P>::get_from_pid(pid);
        match player.as_mut() {
            None => Err(ERROR_PLAYER_NOT_EXIST),
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
            None => Err(ERROR_PLAYER_NOT_EXIST),
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



pub trait CommonState: Serialize + StorageData + Sized {
    type PlayerData: StorageData + Default + Serialize;

    fn get_global<'a>() -> Ref<'a, Self>;
    fn get_global_mut<'a>() -> RefMut<'a, Self>;

    fn get_state(pkey: Vec<u64>) -> String {
        let player = Player::<Self::PlayerData>::get_from_pid(
            &Player::<Self::PlayerData>::pkey_to_pid(&pkey.try_into().unwrap()),
        );
        serde_json::to_string(&player).unwrap()
    }

    fn rand_seed() -> u64 {
        0
    }

    fn snapshot() -> String {
        let state = Self::get_global();
        serde_json::to_string(&*state).unwrap()
    }

    fn preempt() -> bool {
        return false;
    }

    fn store(&self) {
        let mut data = vec![];
        self.to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&[0, 0, 0, 0], data.as_slice());
    }

    fn initialize() {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let mut data = kvpair.get(&[0, 0, 0, 0]);
        if !data.is_empty() {
            let mut u64data = data.iter_mut();
            *Self::get_global_mut() = Self::from_data(&mut u64data);
        }
    }
}

/* Settlement is flushed at the end of each bundle
 * 1. The application transactions will push withdraw into settlement
 * 2. All withdraw will get flushed at the end of each bundle (at the preemption point)
 */
use zkwasm_rest_abi::WithdrawInfo;

pub struct SettlementInfo(Vec<WithdrawInfo>);
pub static mut SETTLEMENT: SettlementInfo = SettlementInfo(vec![]);

impl SettlementInfo {
    pub fn append_settlement(info: WithdrawInfo) {
        unsafe { SETTLEMENT.0.push(info) };
    }
    pub fn flush_settlement() -> Vec<u8> {
        zkwasm_rust_sdk::dbg!("flush settlement\n");
        let sinfo = unsafe { &mut SETTLEMENT };
        let mut bytes: Vec<u8> = Vec::with_capacity(sinfo.0.len() * 32);
        for s in &sinfo.0 {
            s.flush(&mut bytes);
        }
        sinfo.0 = vec![];
        bytes
    }
}

pub trait EventHandler: Clone + StorageData {
    fn get_delta(&self) -> usize;
    fn progress(&mut self, d: usize);
    fn handle(&mut self, counter: u64) -> Option<Self>;
    fn u64size() -> usize;
}

pub struct EventQueue<T: EventHandler + Sized> {
    pub counter: u64,
    pub list: std::collections::LinkedList<T>,
}

impl<E: EventHandler> EventQueue<E> {
    pub fn new() -> Self {
        EventQueue {
            counter: 0,
            list: LinkedList::new(),
        }
    }

    pub fn dump(&self, counter: u64) {
        zkwasm_rust_sdk::dbg!("dump queue: {}, ", counter);
        for m in self.list.iter() {
            let delta = m.get_delta();
            zkwasm_rust_sdk::dbg!(" {}", delta);
        }
        zkwasm_rust_sdk::dbg!("\n");
    }

    /// Perform tick:
    /// 1. get old entries and perform event handlers on each event
    /// 2. insert new generated events into the event queue
    /// 3. handle all events whose counter are zero
    /// 4. insert new generated envets into the event queue
    pub fn tick(&mut self) {
        let trace = unsafe { zkwasm_rust_sdk::wasm_trace_size() };
        let counter = self.counter;
        //self.dump(counter);
        let mut entries_data = self.get_old_entries(counter);
        let entries_nb = entries_data.len() / E::u64size();
        let mut dataiter = entries_data.iter_mut();
        let mut entries = Vec::with_capacity(entries_nb);
        for _ in 0..entries_nb {
            entries.push(E::from_data(&mut dataiter));
        }

        zkwasm_rust_sdk::dbg!("trace: {}\n", trace);
        zkwasm_rust_sdk::dbg!("entries from storage: {} at counter {}\n", entries_nb, {
             self.counter
        });
        // perform activities from existing entries
        for mut e in entries {
            let m = e.handle(counter);

            if let Some(event) = m {
                self.insert(event);
            }
        }

        let trace = unsafe { zkwasm_rust_sdk::wasm_trace_size() };
        zkwasm_rust_sdk::dbg!("trace after handle loaded event: {}\n", trace);

        while let Some(head) = self.list.front_mut() {
            if head.get_delta() == 0 {
                let m = head.handle(counter);
                self.list.pop_front();
                if let Some(event) = m {
                    self.insert(event);
                }
            } else {
                head.progress(1);
                break;
            }
        }

        let trace = unsafe { zkwasm_rust_sdk::wasm_trace_size() };
        zkwasm_rust_sdk::dbg!("trace after handle queued event: {}\n", trace);
        self.counter += 1;
    }

    /// Insert a event into the event queue
    /// The event queue is a differential time queue (DTQ) and the event will
    /// be inserted into its proper position based on its delta time
    pub fn insert(&mut self, node: E) {
        let mut event = node.clone();
        let mut cursor = self.list.cursor_front_mut();
        while cursor.current().is_some()
            && cursor.current().as_ref().unwrap().get_delta() <= event.get_delta()
        {
            event.progress(cursor.current().as_ref().unwrap().get_delta());
            cursor.move_next();
        }
        match cursor.current() {
            Some(t) => {
                t.progress(event.get_delta());
            }
            None => (),
        };

        cursor.insert_before(event);
    }
}

impl<T: EventHandler + Sized> StorageData for EventQueue<T> {
    fn to_data(&self, buf: &mut Vec<u64>) {
        buf.push(self.counter);
    }

    fn from_data(u64data: &mut IterMut<u64>) -> Self {
        let counter = *u64data.next().unwrap();
        let list = LinkedList::new();
        EventQueue { counter, list }
    }
}

const EVENTS_LEAF_INDEX: u64 = 0xfffffffe;

impl<T: EventHandler + Sized> EventQueue<T> {
    fn get_old_entries(&self, counter: u64) -> Vec<u64> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.get(&[counter & 0xeffffff, EVENTS_LEAF_INDEX, 0, EVENTS_LEAF_INDEX])
    }
    fn set_entries(&self, entries: &Vec<u64>, counter: u64) {
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(
            &[counter & 0xeffffff, EVENTS_LEAF_INDEX, 0, EVENTS_LEAF_INDEX],
            entries.as_slice(),
        );
        zkwasm_rust_sdk::dbg!("store {} entries at counter {}", { entries.len() }, counter);
    }
    pub fn store(&mut self) {
        let mut tail = self.list.pop_front();
        let mut store = vec![];
        let mut current_delta = 0u64;
        while tail.is_some() {
            let delta = tail.as_ref().unwrap().get_delta();
            if delta as u64 > 0 {
                if !store.is_empty() {
                    let mut entries = self.get_old_entries(current_delta + self.counter);
                    entries.append(&mut store);
                    self.set_entries(&entries, current_delta + self.counter);
                    store.clear();
                }
            }
            current_delta += delta as u64;
            tail.as_ref().unwrap().to_data(&mut store);
            tail = self.list.pop_front();
        }
        if !store.is_empty() {
            let mut entries = self.get_old_entries(current_delta + self.counter);
            entries.append(&mut store);
            self.set_entries(&entries, current_delta + self.counter);
            store.clear();
        }
    }
}

pub struct Wrapped<P: StorageData> {
    key: [u64; 4],
    pub data: P,
}

impl<P: StorageData> Wrapped<P> {
    pub fn store(&self) {
        let mut data = Vec::new();
        self.data.to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&self.key, data.as_slice());
    }
}

pub trait IndexedObject<P: StorageData> {
    const PREFIX: u64;
    const POSTFIX: u64;
    const EVENT_NAME:u64;
    fn new_object(p: P, index: u64) -> Wrapped<P> {
        let key = [Self::PREFIX + (index << 16), Self::POSTFIX, Self::POSTFIX, Self::POSTFIX];
        Wrapped {
            key,
            data: p
        }
    }

    fn get_object(index: u64) -> Option<Wrapped<P>> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (index << 16), Self::POSTFIX, Self::POSTFIX, Self::POSTFIX];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            None
        } else {
            let mut dataslice = data.iter_mut();
            Some(Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            })
        }
    }
    fn emit_event(index: u64, p: &P) {
        let mut data = vec![index];
        p.to_data(&mut data);
        insert_event(Self::EVENT_NAME, &mut data);
    }
}

pub trait Position<P: StorageData> {
    const PREFIX: u64;
    const POSTFIX: u64;
    const EVENT_NAME: u64;
    fn new_position(pid: &[u64; 2], p: P, index: u64) -> Wrapped<P> {
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        Wrapped {
            key,
            data: p
        }
    }

    fn get_position(pid: &[u64; 2], index: u64) -> Option<Wrapped<P>> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            None
        } else {
            let mut dataslice = data.iter_mut();
            Some(Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            })
        }
    }

    fn get_or_new_position(pid: &[u64; 2], index: u64, default: P) -> Wrapped<P> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            Wrapped {
                key,
                data: default
            }
        } else {
            let mut dataslice = data.iter_mut();
            Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            }
        }
    }
    fn emit_event(pid: &[u64; 2], index: u64, p: &P) {
        let mut data = vec![pid[0], pid[1], index];
        p.to_data(&mut data);
        insert_event(Self::EVENT_NAME, &mut data);
    }
}

pub static mut EVENTS: Vec<u64> = vec![];

pub fn clear_events(a: Vec<u64>) -> Vec<u64> {
    let mut c = a;
    unsafe {
        c.append(&mut EVENTS);
    }
    return c;
}

pub fn insert_event(typ: u64, data: &mut Vec<u64>) {
    unsafe {
        EVENTS.push((typ << 32) + data.len() as u64);
        EVENTS.append(data);
    }
}

pub trait WithBalance {
    fn cost_balance(&mut self, amount: u64) -> Result<(), u32>;
    fn inc_balance(&mut self, amount: u64);
}

#[derive(Clone, Serialize, Default, Copy)]
pub struct MarketInfo<Object: StorageData, PlayerData: StorageData + Default + WithBalance> {
    pub marketid: u64, 
    pub askprice: u64,
    pub settleinfo: u64,
    pub bid: Option<BidInfo>,
    pub owner: [u64; 2],
    pub object: Object,
    pub user: PhantomData<PlayerData>,
}

impl<O: StorageData, Player: StorageData + Default + WithBalance> StorageData for MarketInfo<O, Player> {
    fn from_data(u64data: &mut IterMut<u64>) -> MarketInfo<O, Player> {
        let marketid= *u64data.next().unwrap();
        let askprice = *u64data.next().unwrap();
        let settleinfo = *u64data.next().unwrap();
        let mut bidder = None;
        if settleinfo != 0 {
            let bidprice = *u64data.next().unwrap();
            bidder = Some(BidInfo {
                bidprice,
                bidder: [*u64data.next().unwrap(), *u64data.next().unwrap()]
            })
        }
        let owner = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let object = O::from_data(u64data);
        MarketInfo {
            marketid,
            askprice,
            settleinfo,
            bid: bidder,
            owner,
            object,
            user: PhantomData
        }
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.marketid);
        data.push(self.askprice);
        data.push(self.settleinfo);
        if self.settleinfo != 0 {
            let bid = self.bid.unwrap();
            data.push(bid.bidprice);
            data.push(bid.bidder[0]);
            data.push(bid.bidder[1]);
        }
        data.push(self.owner[0]);
        data.push(self.owner[1]);
        self.object.to_data(data)
    }
}

#[derive(Clone, Serialize, Default, Copy)]
pub struct BidInfo {
    pub bidprice: u64,
    pub bidder: [u64; 2]
}

impl<O: StorageData, PlayerData: StorageData + Default + WithBalance> MarketInfo<O, PlayerData> {
    pub fn get_bidder(&self) -> Option<BidInfo> {
        self.bid
    }
    pub fn set_bidder(&mut self, bidder: Option<BidInfo>) {
        self.bid = bidder
    }
    pub fn get_owner(&self) -> [u64; 2] {
        self.owner
    }
    pub fn set_owner(&mut self, owner: [u64; 2]) {
        self.owner = owner;
    }
}

pub trait BidObject<PlayerData: StorageData + Default + WithBalance> {
    const INSUFF: u32;
    const NOBID: u32;
    fn get_bidder(&self) -> Option<BidInfo>;
    fn set_bidder(&mut self, bidder: Option<BidInfo>);
    fn get_owner(&self) -> [u64; 2];
    fn set_owner(&mut self, owner: [u64; 2]);
    fn clear_bidder(&mut self) -> Option<Player<PlayerData>> {
        let player = self.get_bidder().map(|c| {
            let mut player = Player::<PlayerData>::get_from_pid(&c.bidder).unwrap();
            player.data.inc_balance(c.bidprice);
            player
        });
        self.set_bidder(None); 
        player
    }
    fn deal(&mut self) -> Result<Player<PlayerData>, u32> {
        let bidder = self.get_bidder();
        match bidder {
            Some(c) => {
                let pid = &c.bidder;
                let mut owner = Player::<PlayerData>::get_from_pid(&self.get_owner()).unwrap();
                owner.data.inc_balance(c.bidprice);
                self.set_owner(pid.clone());
                Ok(owner)
            },
            None => {
                Err(Self::NOBID)
            }
        }

    }
    fn replace_bidder(&mut self, player: &mut Player<PlayerData>, amount: u64) -> Result<Option<Player<PlayerData>>, u32> {
        self.get_bidder().map_or(Ok(()), |x| {
            let bidprice = x.bidprice;
            if bidprice >= amount {
                Err(Self::INSUFF)
            } else {
                Ok(())
            }
        })?;
        let old_bidder = self.clear_bidder();
        self.set_bidder(Some (BidInfo {
            bidprice: amount,
            bidder: player.player_id.clone(),
        }));
        player.data.cost_balance(amount)?;
        Ok(old_bidder)
    }
}

