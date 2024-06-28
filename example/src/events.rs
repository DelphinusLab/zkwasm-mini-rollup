use std::collections::LinkedList;

use zkwasm_rest_abi::MERKLE_MAP;

use crate::{
    config::get_modifier,
    state::{Modifier, Object, Player},
};

#[derive(Clone)]
pub struct Event {
    pub owner: [u64; 4],
    pub object_index: usize,
    pub modifier_index: usize,
    pub delta: usize,
}

impl Event {
    fn compact(&self, buf: &mut Vec<u64>) {
        buf.push(self.owner[0]);
        buf.push(self.owner[1]);
        buf.push(self.owner[2]);
        buf.push(self.owner[3]);
        buf.push(
            ((self.object_index as u64) << 48)
                | ((self.modifier_index as u64) << 32)
                | self.delta as u64,
        );
        zkwasm_rust_sdk::dbg!("compact {:?}", buf);
    }
    fn fetch(buf: &mut Vec<u64>) -> Event {
        zkwasm_rust_sdk::dbg!("fetch{:?}", buf);
        let f = buf.pop().unwrap();
        let mut owner = [
            buf.pop().unwrap(),
            buf.pop().unwrap(),
            buf.pop().unwrap(),
            buf.pop().unwrap(),
        ];
        owner.reverse();
        Event {
            owner,
            object_index: (f >> 48) as usize,
            delta: (f & 0xffffffff) as usize,
            modifier_index: ((f >> 48) & 0x7f) as usize,
        }
    }
}

pub struct EventQueue {
    pub counter: u64,
    pub list: std::collections::LinkedList<Event>,
}

pub fn apply_modifier(player: &mut Player, object: &mut Object, modifier: Modifier) -> bool {
    //zkwasm_rust_sdk::dbg!("apply modifier");
    if player.apply_modifier(&modifier) {
        object.apply_modifier(&modifier)
    } else {
        false
    }
}

fn apply_object_modifier(
    obj_id: &[u64; 4],
    owner_id: &[u64; 4],
    modifier_index: usize,
    counter: u64,
) -> Option<(usize, usize)> {
    let mut object = Object::get(obj_id).unwrap();
    let (_, modifier) = get_modifier(object.modifiers[modifier_index]);
    let mut player = Player::get(owner_id).unwrap();

    // Check if the most Significant 8 Bits of modifier_info is restart
    if object.modifier_info >> 56 == 2 {
        let next_index = (7usize + 1) % object.modifiers.len();
        object.start_new_modifier(next_index, counter);
        object.store();
        player.store();
        Some((delay, next_index))
    } else {
        let applied = apply_modifier(&mut player, &mut object, modifier);
        if applied {
            //zkwasm_rust_sdk::dbg!("object after: {:?}\n", object);
            //zkwasm_rust_sdk::dbg!("player after: {:?}\n", player);
            let next_index = (modifier_index + 1) % object.modifiers.len();
            let modifier_id = object.modifiers[next_index];
            object.start_new_modifier(next_index, counter);
            object.store();
            player.store();
            let (delay, _) = get_modifier(modifier_id);
            Some((delay, next_index))
        } else {
            object.halt();
            object.store();
            zkwasm_rust_sdk::dbg!("apply modifier failed\n");
            None
        }
    }
}

pub fn restart_object_modifier(obj_id: &[u64; 4], counter: u64, data: &Vec<u64>) -> Option<(usize, usize)> {
    let mut object = Object::get(obj_id).unwrap();
    let halted = object.is_halted();
    if halted {
        // modify object with new modifiers
        object.reset_modifier(data.clone());

        let modifier_index = object.get_modifier_index();
        let (delay, _) = get_modifier(object.modifiers[modifier_index as usize]);
        object.restart(counter);
        object.store();
        zkwasm_rust_sdk::dbg!("object restarted\n");
        Some((delay, modifier_index as usize))
    } else {
        zkwasm_rust_sdk::dbg!("restart modifier failed, start reset modifier index... \n");
        object.reset_halt_bit_to_restart();
        object.store();

        None
    }
}

impl EventQueue {
    pub fn new() -> Self {
        EventQueue {
            counter: 0,
            list: LinkedList::new(),
        }
    }
    pub fn store(&self) {
        let n = self.list.len();
        let mut v = Vec::with_capacity(n * 5 + 1);
        for e in self.list.iter() {
            e.compact(&mut v);
        }
        v.push(self.counter);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&[0, 0, 0, 0], v.as_slice());
        let root = kvpair.merkle.root.clone();
        zkwasm_rust_sdk::dbg!("root after store: {:?}\n", root);
    }
    pub fn fetch(&mut self) {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let mut data = kvpair.get(&[0, 0, 0, 0]);
        if !data.is_empty() {
            let counter = data.pop().unwrap();
            let mut list = LinkedList::new();
            while !data.is_empty() {
                list.push_back(Event::fetch(&mut data))
            }
            self.counter = counter;
            self.list = list;
        }
    }
    pub fn dump(&self) {
        zkwasm_rust_sdk::dbg!("=-=-= dump queue =-=-=\n");
        for m in self.list.iter() {
            let delta = m.delta;
            let obj = m.object_index;
            let midx = m.modifier_index;
            zkwasm_rust_sdk::dbg!("[{}] - {:?} - {}\n", delta, obj, midx);
        }
        zkwasm_rust_sdk::dbg!("=-=-= end =-=-=\n");
    }
    pub fn tick(&mut self) {
        self.dump();
        let counter = self.counter;
        while let Some(head) = self.list.front_mut() {
            if head.delta == 0 {
                let owner_id = head.owner;
                let objindex = head.object_index;
                let obj_id = Player::generate_obj_id(&owner_id, objindex);
                let m = apply_object_modifier(&obj_id, &owner_id, head.modifier_index, counter);
                self.list.pop_front();
                if let Some((delta, modifier)) = m {
                    self.insert(objindex, &owner_id, delta, modifier);
                }
            } else {
                head.delta -= 1;
                break;
            }
        }
        self.counter += 1;
    }

    pub fn insert(
        &mut self,
        object_index: usize,
        owner: &[u64; 4],
        delta: usize,
        modifier_index: usize,
    ) {
        let mut delta = delta;
        let mut list = LinkedList::new();
        let mut tail = self.list.pop_front();
        while tail.is_some() && tail.as_ref().unwrap().delta <= delta {
            delta = delta - tail.as_ref().unwrap().delta;
            list.push_back(tail.unwrap());
            tail = self.list.pop_front();
        }
        let node = Event {
            object_index,
            owner: owner.clone(),
            delta,
            modifier_index,
        };
        list.push_back(node);
        match tail.as_mut() {
            Some(t) => {
                t.delta = t.delta - delta;
                list.push_back(t.clone());
            }
            None => (),
        };
        list.append(&mut self.list);
        self.list = list;
    }
}
