use std::cell::RefCell;

use zkwasm_rust_sdk::kvpair::KeyValueMap;
use zkwasm_rust_sdk::Merkle;

use crate::config::get_modifier;
use crate::events::EventQueue;

pub static mut MERKLE_MAP: KeyValueMap<Merkle> = KeyValueMap { merkle: Merkle {
    root: [
        14789582351289948625,
        10919489180071018470,
        10309858136294505219,
        2839580074036780766,
    ]}
};

#[derive (Clone, Debug)]
pub struct Attributes (Vec<i64>);

impl Attributes {
    pub fn apply_modifier(&mut self, m: &Attributes) -> bool {
        for (a, b) in self.0.iter().zip(m.0.iter()) {
            if *a < *b {
                return false;
            }
        }
        for (a, b) in self.0.iter_mut().zip(m.0.iter()) {
            *a += *b;
        }
        return true;
    }
}

impl Attributes {
    fn default_entities() -> Self {
        Attributes (vec![1])
    }
    fn default_local() -> Self {
        Attributes (vec![1])
    }
}

#[derive (Debug)]
pub struct Object {
    pub object_id: [u64; 4],
    pub current_modifier_index: u64,
    pub modifiers: Vec<u64>,
    pub entity: Attributes,
}

#[derive (Clone)]
pub struct Modifier {
    pub entity: Attributes,
    pub local: Attributes,
    pub global: Attributes,
}

impl Modifier {
    pub fn default() -> Self {
        Modifier {
            entity: Attributes::default_entities(),
            local: Attributes::default_local(),
            global: Attributes (vec![]),
        }
    }
}

impl Object {
    pub fn new(object_id: &[u64; 4], modifiers: Vec<u64>) -> Self {
        Self {
            object_id: object_id.clone(),
            current_modifier_index: 0,
            modifiers,
            entity: Attributes::default_entities()
        }

    }
    pub fn store(&self) {
        let oid = self.object_id;
        zkwasm_rust_sdk::dbg!("store object {:?}\n", oid);
        let mut data = Vec::with_capacity(3 + self.entity.0.len() + self.modifiers.len() + 2);
        data.push(self.current_modifier_index);
        data.push(self.modifiers.len() as u64);
        for c in self.modifiers.iter() {
            data.push(*c as u64);
        }
        data.push(self.entity.0.len() as u64);
        for c in self.entity.0.iter() {
            data.push(*c as u64);
        }

        let kvpair = unsafe {&mut MERKLE_MAP};
        kvpair.set(&self.object_id, data.as_slice());
        zkwasm_rust_sdk::dbg!("end store object\n");
    }
    pub fn apply_modifier(&mut self, m: &Modifier) -> bool {
        self.entity.apply_modifier(&m.entity)
    }

    pub fn get(object_id: &[u64; 4]) -> Option<Self> {
        let kvpair = unsafe {&mut MERKLE_MAP};
        zkwasm_rust_sdk::dbg!("get object with oid {:?}\n", object_id);
        let data = kvpair.get(&object_id);
        zkwasm_rust_sdk::dbg!("get object with {:?}\n", data);
        if data.is_empty() {
            None
        } else {
            let current_modifier_index = data[0].clone();
            let entity_size = data[1].clone();
            let (_, rest) = data.split_at(2);
            let (modifiers, entity) = rest.split_at(entity_size as usize);
            let entity = entity.into_iter().skip(1).map(|x| *x as i64).collect::<Vec<_>>();
            let p = Object {
                object_id: object_id.clone(),
                current_modifier_index,
                modifiers: modifiers.to_vec(),
                entity: Attributes (entity)
            };
            Some (p)
        }
    }

}

#[derive (Debug)]
pub struct Player {
    player_id: [u64; 4],
    objects: Vec<u64>,
    local: Attributes,
}

impl Player {
    pub fn store(&self) {
        zkwasm_rust_sdk::dbg!("store player\n");
        let mut data = Vec::with_capacity(1 + self.objects.len() + self.local.0.len() + 2);
        data.push(self.objects.len() as u64);
        for c in self.objects.iter() {
            data.push(*c as u64);
        }
        data.push(self.local.0.len() as u64);
        for c in self.local.0.iter() {
            data.push(*c as u64);
        }

        let kvpair = unsafe {&mut MERKLE_MAP};
        kvpair.set(&self.player_id, data.as_slice());
        zkwasm_rust_sdk::dbg!("end store player\n");
    }
    pub fn new(player_id: &[u64; 4]) -> Self {
        Self {
            player_id: player_id.clone(),
            objects: vec![0],
            local: Attributes::default_local()
        }
    }

    pub fn get_obj_id(&self, index: usize) -> [u64; 4] {
        let mut id = self.player_id;
        id[0] = (1 << 32) | (self.objects[index] << 16) | (id[0] & 0xffff00000000ffff);
        return id
    }

    pub fn apply_modifier(&mut self, m: &Modifier) -> bool {
        self.local.apply_modifier(&m.local)
    }
    pub fn get(player_id: &[u64; 4]) -> Option<Self> {
        let kvpair = unsafe {&mut MERKLE_MAP};
        let data = kvpair.get(&player_id);
        if data.is_empty() {
            None
        } else {
            let objects_size = data[0].clone();
            let (_, rest) = data.split_at(1);
            let (objects, local) = rest.split_at(objects_size as usize);
            let local = local.into_iter().skip(1).map(|x| *x as i64).collect::<Vec<_>>();
            let p = Player {
                player_id: player_id.clone(),
                objects: objects.to_vec(),
                local: Attributes (local)
            };
            Some (p)
        }
    }
}

pub struct State {}

pub struct SafeEventQueue (RefCell<EventQueue>);
unsafe impl Sync for SafeEventQueue {}

lazy_static::lazy_static! {
    pub static ref QUEUE: SafeEventQueue = SafeEventQueue (RefCell::new(EventQueue::new()));
}



pub struct Transaction {
    pub command: u64,
    pub objindex: usize,
    pub modifiers: Vec<u64>
}

impl Transaction {
    pub fn decode(params: [u64; 4]) -> Self {
        let command = (params[0] >> 32) & 0xff;
        let objindex = (params[0] & 0xff) as usize;
        let mut modifiers = vec![];
        for b in params[1].to_le_bytes() {
            if b!=0 {
                modifiers.push(b as u64);
            }
        };
        Transaction {
            command,
            objindex,
            modifiers
        }
    }
    pub fn install_player(&self, pid: &[u64; 4]) -> bool {
        let player = Player::get(pid);
        match player {
            Some(_) => false,
            None => {
                let player = Player::new(&pid);
                player.store();
                true
            }
        }
    }
    pub fn install_object(&self, pid: &[u64; 4]) -> bool {
        let mut player = Player::get(pid);
        match player.as_mut() {
            None => false,
            Some (player) => {
                player.objects.push(self.objindex as u64);
                let mid = self.modifiers[0];
                let oid = player.get_obj_id(player.objects.len()-1);
                let (delay, _)  = get_modifier(mid);
                let object = Object::new(&oid,  self.modifiers.clone());
                object.store();
                player.store();
                QUEUE.0.borrow_mut().insert(&oid, pid, delay, 0);
                true
            }
        }
    }

    pub fn process(&self, pid: &[u64; 4]) -> bool {
        match self.command {
            1 => self.install_player(pid),
            2 => self.install_object(pid),
            _ => { QUEUE.0.borrow_mut().tick(); true }
        }
    }

    pub fn automaton() {
        QUEUE.0.borrow_mut().tick();
    }
}
