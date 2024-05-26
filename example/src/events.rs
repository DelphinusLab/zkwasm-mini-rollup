use std::collections::LinkedList;

use crate::state::{Modifier, Object, Player};


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

fn get_modifier(index: u64) -> (usize, Modifier) {
    (10, Modifier::default())
}

fn apply_object_modifier(obj_id: &[u64; 4], owner_id: &[u64; 4], modifier_index: usize) -> Option<(usize, usize)> {
    let mut object = Object::get(obj_id).unwrap();
    let (_, modifier) = get_modifier(object.modifiers[modifier_index]);
    let mut player = Player::get(owner_id).unwrap();
    let applied = apply_modifier(&mut player, &mut object, modifier);
    object.store();
    player.store();
    if applied {
        let next_index = (modifier_index + 1) % object.modifiers.len();
        let modifier_id = object.modifiers[next_index];
        let (delay, _) = get_modifier(modifier_id);
        Some((delay, next_index))
    } else {
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
        zkwasm_rust_sdk::dbg!("=-=-= dump queue =-=-=");
        for m in self.list.iter() {
            let delta = m.delta;
            let obj = m.object;
            let midx = m.modifier_index;
            zkwasm_rust_sdk::dbg!("[{}] - {:?} - {}",  delta, obj, midx);
        }
        zkwasm_rust_sdk::dbg!("=-=-= end =-=-=");
    }
    pub fn tick(&mut self) {
        if self.list.is_empty() { ()}
        else {
            let head = self.list.front_mut().unwrap();
            if head.delta == 1 {
                let obj_id = head.object;
                let owner_id = head.owner;
                let m = apply_object_modifier(&obj_id, &owner_id, head.modifier_index);
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
