use crate::config::{default_entities, default_local, get_modifier};
use crate::events::restart_object_modifier;
use crate::events::EventQueue;
use crate::settlement::{encode_address, SettleMentInfo, WithdrawInfo};
use crate::MERKLE_MAP;
use serde::{Serialize, Serializer, ser::SerializeSeq};
use std::cell::RefCell;

// Custom serializer for `[u64; 4]` as a [String; 4].
fn serialize_u64_array_as_string<S>(value: &[u64; 4], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(value.len()))?;
        for e in value.iter() {
            seq.serialize_element(&e.to_string())?;
        }
        seq.end()
    }

// Custom serializer for `u64` as a string.
fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&value.to_string())
    }

#[derive(Clone, Debug, Serialize)]
pub struct Attributes(pub Vec<i64>);

impl Attributes {
    pub fn apply_modifier(&mut self, m: &Attributes) -> bool {
        for (a, b) in self.0.iter().zip(m.0.iter()) {
            if *a + *b < 0 {
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
        Attributes(default_entities().to_vec())
    }
    fn default_local() -> Self {
        Attributes(default_local().to_vec())
    }
}

#[derive(Debug, Serialize)]
pub struct Object {
    #[serde(serialize_with="serialize_u64_array_as_string")]
    pub object_id: [u64; 4],
    #[serde(serialize_with="serialize_u64_as_string")]
    pub modifier_info: u64, // running << 56 + (modifier index << 48) + counter
    pub modifiers: Vec<u64>,
    pub entity: Attributes,
}

#[derive(Clone)]
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
            global: Attributes(vec![]),
        }
    }
}

impl Object {
    pub fn new(object_id: &[u64; 4], modifiers: Vec<u64>) -> Self {
        Self {
            object_id: object_id.clone(),
            modifier_info: 0,
            modifiers,
            entity: Attributes::default_entities(),
        }
    }
    pub fn halt(&mut self) {
        self.modifier_info = (self.modifier_info & 0xFFFFFFFFFFFFFF) | 1 << 56;
    }

    pub fn is_halted(&mut self) -> bool {
        (self.modifier_info >> 56) == 1
    }

    pub fn get_modifier_index(&self) -> u64 {
        return (self.modifier_info >> 48) & 0x7f;
    }

    pub fn start_new_modifier(&mut self, modifier_index: usize, counter: u64) {
        self.modifier_info = ((modifier_index as u64) << 48) | counter;
    }

    pub fn restart(&mut self, counter: u64) {
        self.modifier_info = (0u64 << 48) + counter;
    }

    pub fn store(&self) {
        let oid = self.object_id;
        zkwasm_rust_sdk::dbg!("store object {:?}\n", oid);
        let mut data = Vec::with_capacity(3 + self.entity.0.len() + self.modifiers.len() + 2);
        data.push(self.modifier_info);
        data.push(self.modifiers.len() as u64);
        for c in self.modifiers.iter() {
            data.push(*c as u64);
        }
        data.push(self.entity.0.len() as u64);
        for c in self.entity.0.iter() {
            data.push(*c as u64);
        }

        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&self.object_id, data.as_slice());
        zkwasm_rust_sdk::dbg!("end store object\n");
    }
    pub fn apply_modifier(&mut self, m: &Modifier) -> bool {
        self.entity.apply_modifier(&m.entity)
    }

    pub fn get(object_id: &[u64; 4]) -> Option<Self> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        //zkwasm_rust_sdk::dbg!("get object with oid {:?}\n", object_id);
        let data = kvpair.get(&object_id);
        //zkwasm_rust_sdk::dbg!("get object with {:?}\n", data);
        if data.is_empty() {
            None
        } else {
            let modifier_info = data[0].clone();
            let entity_size = data[1].clone();
            let (_, rest) = data.split_at(2);
            let (modifiers, entity) = rest.split_at(entity_size as usize);
            let entity = entity
                .into_iter()
                .skip(1)
                .map(|x| *x as i64)
                .collect::<Vec<_>>();
            let p = Object {
                object_id: object_id.clone(),
                modifier_info,
                modifiers: modifiers.to_vec(),
                entity: Attributes(entity),
            };
            Some(p)
        }
    }

    pub fn reset_modifier(&mut self, modifiers: Vec<u64>) {
        self.modifiers = modifiers;
    }

    pub fn reset_halt_bit_to_restart(&mut self) {
        self.modifier_info = (self.modifier_info & 0xFFFFFFFFFFFFFF) | 1 << 57;
    }
}

#[derive(Debug, Serialize)]
pub struct Player {
    #[serde(skip_serializing)]
    pub player_id: [u64; 4],
    pub objects: Vec<u64>,
    pub local: Attributes,
}

impl Player {
    pub fn generate_obj_id(pid: &[u64; 4], index: usize) -> [u64; 4] {
        let mut id = pid.clone();
        id[0] = (1 << 32) | ((index as u64) << 16) | (id[0] & 0xffff00000000ffff);
        id
    }
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

        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&self.player_id, data.as_slice());
        zkwasm_rust_sdk::dbg!("end store player\n");
    }
    pub fn new(player_id: &[u64; 4]) -> Self {
        Self {
            player_id: player_id.clone(),
            objects: vec![],
            local: Attributes::default_local(),
        }
    }

    pub fn get_obj_id(&self, index: usize) -> [u64; 4] {
        zkwasm_rust_sdk::dbg!("\n ----> get obj with id: {}\n", index);
        let mut id = self.player_id;
        id[0] = (1 << 32) | ((index as u64) << 16) | (id[0] & 0xffff00000000ffff);
        return id;
    }

    pub fn apply_modifier(&mut self, m: &Modifier) -> bool {
        self.local.apply_modifier(&m.local)
    }
    pub fn get(player_id: &[u64; 4]) -> Option<Self> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let data = kvpair.get(&player_id);
        if data.is_empty() {
            None
        } else {
            let objects_size = data[0].clone();
            let (_, rest) = data.split_at(1);
            let (objects, local) = rest.split_at(objects_size as usize);
            let local = local
                .into_iter()
                .skip(1)
                .map(|x| *x as i64)
                .collect::<Vec<_>>();
            let p = Player {
                player_id: player_id.clone(),
                objects: objects.to_vec(),
                local: Attributes(local),
            };
            Some(p)
        }
    }
}

pub struct State {}

impl State {
    pub fn get_state(pid: Vec<u64>) -> String {
        zkwasm_rust_sdk::dbg!("get state {:?}", pid);
        let player = Player::get(&pid.try_into().unwrap()).unwrap();
        zkwasm_rust_sdk::dbg!("get state {:?}", player);
        let mut objs = vec![];
        for (index, _) in player.objects.iter().enumerate() {
            let oid = player.get_obj_id(index);
            let obj = Object::get(&oid).unwrap();
            objs.push(obj);
        }
        let counter = QUEUE.0.borrow().counter;
        serde_json::to_string(&(player, objs, counter)).unwrap()
    }
    pub fn store() {
        QUEUE.0.borrow_mut().store();
    }
    pub fn initialize() {
        QUEUE.0.borrow_mut().fetch();
    }
}

pub struct SafeEventQueue(RefCell<EventQueue>);
unsafe impl Sync for SafeEventQueue {}

lazy_static::lazy_static! {
    pub static ref QUEUE: SafeEventQueue = SafeEventQueue (RefCell::new(EventQueue::new()));
}

pub struct Transaction {
    pub command: u64,
    pub objindex: usize,
    pub data: Vec<u64>,
}

const INSTALL_PLAYER: u64 = 1;
const INSTALL_OBJECT: u64 = 2;
const RESTART_OBJECT: u64 = 3;
const WITHDRAW: u64 = 4;

impl Transaction {
    pub fn decode(params: [u64; 4]) -> Self {
        let command = (params[0] >> 32) & 0xff;
        let objindex = (params[0] & 0xff) as usize;
        let mut data = vec![];
        if command == WITHDRAW {
            data = vec![0, params[1], params[2], params[3]] // address of withdraw
        } else if command == INSTALL_OBJECT || command == RESTART_OBJECT {
            for b in params[1].to_le_bytes() {
                data.push(b as u64);
            }
        };
        Transaction {
            command,
            objindex,
            data,
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
            Some(player) => {
                if self.objindex > player.objects.len() {
                    return false;
                } else if self.objindex == player.objects.len() {
                    player.objects.push(0);
                }
                let mid = self.data[0];
                let oid = player.get_obj_id(self.objindex);
                let (delay, _) = get_modifier(mid);
                let mut object = Object::new(&oid, self.data.clone());
                object.start_new_modifier(0, QUEUE.0.borrow().counter);
                object.store();
                player.store();

                QUEUE.0.borrow_mut().insert(self.objindex, pid, delay, 0);
                true
            }
        }
    }

    pub fn restart_object(&self, pid: &[u64; 4]) -> bool {
        let mut player = Player::get(pid);
        match player.as_mut() {
            None => false,
            Some(player) => {
                let oid = player.get_obj_id(self.objindex);
                let counter = QUEUE.0.borrow().counter;
                let data = &self.data;
                if let Some((delay, modifier)) = restart_object_modifier(&oid, /*QUEUE.0.borrow().*/counter, data) {
                    QUEUE
                        .0
                        .borrow_mut()
                        .insert(self.objindex, pid, delay, modifier);
                    true
                } else {
                    false
                }
            }
        }
    }

    pub fn withdraw(&self, pid: &[u64; 4]) -> bool {
        let mut player = Player::get(pid);
        match player.as_mut() {
            None => false,
            Some(player) => {
                if let Some(treasure) = player.local.0.last_mut() {
                    let withdraw = WithdrawInfo::new(
                        0,
                        0,
                        0,
                        [*treasure as u64, 0, 0, 0],
                        encode_address(&self.data),
                    );
                    SettleMentInfo::append_settlement(withdraw);
                    *treasure = 0;
                    let t = player.local.0.last().unwrap();
                    zkwasm_rust_sdk::dbg!("treasure is {}", t);
                    player.store();
                } else {
                    unreachable!();
                }
                true
            }
        }
    }

    pub fn process(&self, pid: &[u64; 4]) -> bool {
        let b = match self.command {
            INSTALL_PLAYER => self.install_player(pid),
            INSTALL_OBJECT => self.install_object(pid),
            RESTART_OBJECT => self.restart_object(pid),
            WITHDRAW => self.withdraw(pid),
            _ => {
                QUEUE.0.borrow_mut().tick();
                true
            }
        };
        let kvpair = unsafe { &mut MERKLE_MAP.merkle.root };
        zkwasm_rust_sdk::dbg!("root after process {:?}\n", kvpair);
        b
    }

    pub fn automaton() {
        QUEUE.0.borrow_mut().tick();
    }
}
