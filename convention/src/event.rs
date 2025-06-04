use core::slice::IterMut;
use std::collections::LinkedList;
use zkwasm_rest_abi::{StorageData, MERKLE_MAP};

/// There are two different events convention in ZKWASM app, one is the scheduled event that can be
/// tracked in the global state and triggerred by the ticker.
/// The other is the transaction event that is emitted and handled by external handlers such as
/// external database.

// Leaf Indicator
const EVENTS_LEAF_INDEX: u64 = 0xfffffffe;

/// Event Handler that will get called once an event is triggerred
pub trait EventHandler: Clone + StorageData {
    fn get_delta(&self) -> usize;
    fn progress(&mut self, d: usize);
    fn handle(&mut self, counter: u64) -> Option<Self>;
    fn u64size() -> usize;
}

/// The event queue is a differential time queue (DTQ)
/// Each tick will cause the head to progress(1)
/// If the head events.get_delta() == 0, the event is triggerred and the handle function of the
/// event will be called.
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


/// External Events that are handled by external handler
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
