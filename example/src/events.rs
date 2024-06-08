use std::collections::LinkedList;

use crate::{config::get_modifier, state::{Modifier, Object, Player}};


#[derive (Clone)]
pub struct Event {
    pub object: [u64; 4],
    pub owner: [u64; 4],
    pub delta: usize,
    pub modifier_index: usize,
}

pub struct EventQueue {
    pub list: std::collections::LinkedList<Event>
}

pub fn apply_modifier(player: &mut Player, object: &mut Object, modifier: Modifier) -> bool {
    //zkwasm_rust_sdk::dbg!("apply modifier");
    if player.apply_modifier(&modifier) {
        object.apply_modifier(&modifier)
    } else {
        false
    }
}

fn apply_object_modifier(obj_id: &[u64; 4], owner_id: &[u64; 4], modifier_index: usize) -> Option<(usize, usize)> {
    let mut object = Object::get(obj_id).unwrap();
    let (_, modifier) = get_modifier(object.modifiers[modifier_index]);
    let mut player = Player::get(owner_id).unwrap();
    let applied = apply_modifier(&mut player, &mut object, modifier);
    if applied {
        zkwasm_rust_sdk::dbg!("object after: {:?}\n", object);
        zkwasm_rust_sdk::dbg!("player after: {:?}\n", player);

        let next_index = (modifier_index + 1) % object.modifiers.len();
        let modifier_id = object.modifiers[next_index];
        object.current_modifier_index = next_index as u64;
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

pub fn restart_object_modifier(obj_id: &[u64; 4]) -> Option<(usize, usize)> {
    let mut object = Object::get(obj_id).unwrap();
    let halted = object.is_halted();
    if halted {
        let modifier_index = object.current_modifier_index | 0xffff ;
        let (delay, _) = get_modifier(object.modifiers[modifier_index as usize]);
        object.restart();
        object.store();
        zkwasm_rust_sdk::dbg!("object restarted\n");
        Some((delay, modifier_index as usize))
    } else {
        zkwasm_rust_sdk::dbg!("restart modifier failed\n");
        None
    }
}



impl EventQueue {
    pub fn new() -> Self {
        EventQueue {
            list: LinkedList::new()
        }
    }
    pub fn dump(&self) {
        zkwasm_rust_sdk::dbg!("=-=-= dump queue =-=-=\n");
        for m in self.list.iter() {
            let delta = m.delta;
            let obj = m.object;
            let midx = m.modifier_index;
            zkwasm_rust_sdk::dbg!("[{}] - {:?} - {}\n",  delta, obj, midx);
        }
        zkwasm_rust_sdk::dbg!("=-=-= end =-=-=\n");
    }
    pub fn tick(&mut self) {
        self.dump();
        if self.list.is_empty() {()}
        else {
            let head = self.list.front_mut().unwrap();
            if head.delta == 1 {
                let obj_id = head.object;
                let owner_id = head.owner;
                let m = apply_object_modifier(&obj_id, &owner_id, head.modifier_index);
                self.list.pop_front();
                if let Some ((delta, modifier)) = m {
                    self.insert(&obj_id, &owner_id, delta, modifier);
                }
            } else {
                head.delta -= 1;
            }
        }
    }

    pub fn insert(&mut self, object: &[u64; 4], owner: &[u64; 4], delta: usize, modifier_index: usize) {
        let mut delta = delta;
        let mut list = LinkedList::new();
        let mut tail = self.list.pop_front();
        while tail.is_some() && tail.as_ref().unwrap().delta <= delta {
            delta = delta - tail.as_ref().unwrap().delta;
            list.push_back(tail.unwrap());
            tail = self.list.pop_front();
        }
        let node = Event {
            object: object.clone(),
            owner: owner.clone(),
            delta,
            modifier_index,
        };
        list.push_back(node);
        match tail.as_mut() {
            Some(t) => {
                t.delta = t.delta - delta;
                list.push_back(t.clone());
            },
            None => ()
        };
        list.append(&mut self.list);
        self.list = list;
    }
}
