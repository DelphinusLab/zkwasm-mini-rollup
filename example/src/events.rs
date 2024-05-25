use std::collections::LinkedList;

#[derive (Clone, Default)]
pub struct Entity {
    pub energy: i64,
    pub hp: i64,
    pub mp: i64,
    pub strength: i64,
    pub magic: i64,
}

#[derive (Clone, Default)]
pub struct Local {
    pub food: i64,
    pub coal: i64,
    pub wood: i64,
    pub steel: i64,
    pub gold: i64,
    pub silver: i64,
    pub gem: i64
}

#[derive (Clone, Default)]
pub struct Global {
    pub regeneration: i64,
    pub pollution: i64,
    pub resource: i64,
    pub mine: i64,
    pub treasure: i64,
}

#[derive (Clone, Default)]
pub struct Modifier {
    pub entity: Entity,
    pub local: Local,
    pub global: Global,
}



#[derive (Clone)]
pub struct Event {
    pub object: u64,
    pub delta: usize,
    pub modifier_index: usize,
}

pub struct EventQueue {
    pub list: std::collections::LinkedList<Event>
}

pub struct Object {
    object_id: u64,
    owner: u64,
    entity: Entity,
    modifiers: Vec<u64>,
    current_modifier_index: u64,
}

impl Object {
    fn interrupted(&mut self) {
        todo!()
    }
    fn store(&self) {
        todo!()
    }
}

pub struct Player {
    player_id: u64,
    local: Local,
}

impl Player {
    fn store(&self) {
        todo!()
    }
}

pub struct State {}

fn get_object(obj: u64) -> Object {
    todo!()
}

fn get_player(player_id: u64) -> Player {
    todo!()
}

pub fn apply_modifier(player: &mut Player, object: &mut Object, modifier: Modifier) -> bool {
    //zkwasm_rust_sdk::dbg!("apply modifier");
    return true
}

fn get_modifier(index: u64) -> (usize, Modifier) {
    (10, Modifier::default())
}

fn apply_object_modifier(obj_id: u64, modifier_index: usize) -> Option<(usize, usize)> {
    let mut object = get_object(obj_id);
    let (_, modifier) = get_modifier(object.modifiers[modifier_index]);
    let mut player = get_player(object.owner);
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
        println!("=-=-= dump queue =-=-=");
        for m in self.list.iter() {
            println!("[{}] - {} - {}",  m.delta, m.object, m.modifier_index);
        }
        println!("=-=-= end =-=-=");
    }
    pub fn tick(&mut self) {
        if self.list.is_empty() { ()}
        else {
            let head = self.list.front_mut().unwrap();
            if head.delta == 1 {
                let obj_id = head.object;
                let m = apply_object_modifier(obj_id, head.modifier_index);
                if let Some ((delta, modifier)) = m {
                    self.insert(obj_id, delta, modifier);
                }
            } else {
                head.delta -= 1;
            }
        }
    }
    pub fn insert(&mut self, object: u64, delta: usize, modifier_index: usize) {
        let mut delta = delta;
        let mut list = LinkedList::new();
        let mut tail = self.list.pop_front();
        while tail.is_some() && tail.as_ref().unwrap().delta <= delta {
            delta = delta - tail.as_ref().unwrap().delta;
            list.push_back(tail.unwrap());
            tail = self.list.pop_front();
        }
        let node = Event {
            object,
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_insert() {
        let mut queue = EventQueue::new();
        queue.insert(1, 10, 0);
        queue.dump();
        queue.tick();
        queue.dump();
        queue.insert(1, 10, 0);
        queue.dump();
        queue.insert(1, 10, 0);
        queue.insert(1, 10, 0);
        queue.insert(1, 10, 0);
        queue.dump();
        queue.tick();
        queue.tick();
        queue.tick();
        queue.insert(1, 10, 0);
        queue.dump();
    }
}
