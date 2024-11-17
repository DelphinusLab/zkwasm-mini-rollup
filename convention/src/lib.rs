#![feature(linked_list_cursors)]
use core::slice::IterMut;
use serde::Serialize;
use std::cell::{Ref, RefMut};
use std::collections::LinkedList;
use zkwasm_rest_abi::{Player, StorageData, MERKLE_MAP};

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

    fn dump(&self, counter: u64) {
        zkwasm_rust_sdk::dbg!("dump queue: {}, ", counter);
        for m in self.list.iter() {
            let delta = m.get_delta();
            zkwasm_rust_sdk::dbg!(" {}", delta);
        }
        zkwasm_rust_sdk::dbg!("\n");
    }

    /// Perform tick:
    /// 1. get old entries and peform event handlers on each event
    /// 2. insert new generated events into the event queue
    /// 3. handle all events whose counter are zero
    /// 4. insert new generated envets into the event queue
    pub fn tick(&mut self) {
        let counter = self.counter;
        self.dump(counter);
        let mut entries_data = self.get_old_entries(counter);
        let entries_nb = entries_data.len() / E::u64size();
        let mut dataiter = entries_data.iter_mut();
        let mut entries = Vec::with_capacity(entries_nb);
        for _ in 0..entries_nb {
            entries.push(E::from_data(&mut dataiter));
        }

        // zkwasm_rust_sdk::dbg!("entries from storage: {} at counter {}\n", entries_nb, {
        //     self.counter
        // });
        // perform activities from existing entries
        for mut e in entries {
            let m = e.handle(counter);

            if let Some(event) = m {
                self.insert(event);
            }
        }

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
