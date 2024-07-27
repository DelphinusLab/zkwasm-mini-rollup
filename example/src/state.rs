use crate::config::{default_entities, default_local, get_modifier};
use crate::events::restart_object_modifier;
use crate::events::EventQueue;
use crate::StorageData;
use crate::settlement::{encode_address, SettleMentInfo, WithdrawInfo};
use crate::MERKLE_MAP;
use serde::{Serialize, Serializer, ser::SerializeSeq};
use std::cell::RefCell;
use crate::Player;
use core::slice::IterMut; 

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
pub struct PlayerData {
    pub objects: Vec<u64>,
    pub local: Attributes,
}

impl Default for PlayerData {
    fn default() -> Self {
        Self {
            objects: vec![],
            local: Attributes::default_local(),
        }
    }
}

impl StorageData for PlayerData {
    fn from_data(u64data: &mut IterMut<u64>) -> Self {
        let objects_size = *u64data.next().unwrap();
        let mut objects = Vec::with_capacity(objects_size as usize);
        for _ in 0..objects_size {
            objects.push(*u64data.next().unwrap());
        }
        let local = u64data
            .into_iter()
            .skip(1)
            .map(|x| *x as i64)
            .collect::<Vec<_>>();
        PlayerData {
            objects,
            local: Attributes(local),
        }
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.objects.len() as u64);
        for c in self.objects.iter() {
            data.push(*c as u64);
        }
        data.push(self.local.0.len() as u64);
        for c in self.local.0.iter() {
            data.push(*c as u64);
        }
    }
}

pub type AutomataPlayer = Player<PlayerData>;

pub trait Owner: Sized {
    fn obj_id_from_pid(pid: &[u64; 2], index: usize) -> [u64; 4];
    fn generate_obj_id(pkey: &[u64; 4], index: usize) -> [u64; 4];
    fn get_obj_id(&self, index: usize) -> [u64; 4];
    fn store(&self);
    fn new(pkey: &[u64; 4]) -> Self;
    fn apply_modifier(&mut self, m: &Modifier) -> bool;
    fn get(pkey: &[u64; 4]) -> Option<Self>;
}

impl Owner for AutomataPlayer {
    fn obj_id_from_pid(pid: &[u64; 2], index: usize) -> [u64; 4] {
        let key = (1 << 32) | ((index as u64) << 16) | (pid[0] & 0xffff00000000ffff);
        return [key, pid[1], pid[0], 0xff03];
    }
    fn generate_obj_id(pkey: &[u64; 4], index: usize) -> [u64; 4] {
        // zkwasm_rust_sdk::dbg!("\n ----> generate obj id\n");
        Player::obj_id_from_pid(&Self::pkey_to_pid(pkey), index)
    }
    fn store(&self) {
        zkwasm_rust_sdk::dbg!("store player\n");
        let mut data = Vec::new();
        self.data.to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&Self::to_key(&self.player_id), data.as_slice());
        zkwasm_rust_sdk::dbg!("end store player\n");
    }
    fn new(pkey: &[u64; 4]) -> Self {
        Self::new_from_pid(Self::pkey_to_pid(pkey))
    }

    fn get_obj_id(&self, index: usize) -> [u64; 4] {
        // zkwasm_rust_sdk::dbg!("\n ----> get obj with id: {}\n", index);
        Player::obj_id_from_pid(&self.player_id, index)
    }

    fn apply_modifier(&mut self, m: &Modifier) -> bool {
        self.data.local.apply_modifier(&m.local)
    }

    fn get(pkey: &[u64; 4]) -> Option<Self> {
        Self::get_from_pid(&Self::pkey_to_pid(pkey))
    }
}

pub struct State {}

impl State {
    pub fn get_state(pid: Vec<u64>) -> String {
        let player = AutomataPlayer::get(&pid.try_into().unwrap()).unwrap();
        let mut objs = vec![];
        for (index, _) in player.data.objects.iter().enumerate() {
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
const DEPOSIT: u64 = 5;

const ERROR_PLAYER_ALREADY_EXIST:u32 = 1;
const ERROR_PLAYER_NOT_EXIST:u32 = 2;

impl Transaction {
    pub fn decode_error(e: u32) -> &'static str {
        match e {
           ERROR_PLAYER_NOT_EXIST => "PlayerNotExist",
           ERROR_PLAYER_ALREADY_EXIST => "PlayerAlreadyExist",
           _ => "Unknown"
        }
    }
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
        } else if command == DEPOSIT {
            data = vec![params[1], params[2], params[3]] // pkey[0], pkey[1], amount
        };
        Transaction {
            command,
            objindex,
            data,
        }
    }
    pub fn install_player(&self, pkey: &[u64; 4]) -> u32 {
        let player = AutomataPlayer::get(pkey);
        match player {
            Some(_) => ERROR_PLAYER_ALREADY_EXIST,
            None => {
                let player = Player::new(&pkey);
                player.store();
                0
            }
        }
    }
    pub fn install_object(&self, pkey: &[u64; 4]) -> u32 {
        let mut player = AutomataPlayer::get(pkey);
        match player.as_mut() {
            None => ERROR_PLAYER_NOT_EXIST,
            Some(player) => {
                let objindex = player.data.objects.len();
                player.data.objects.push(0);
                let mid = self.data[0];
                let oid = player.get_obj_id(objindex);
                let (delay, _) = get_modifier(mid);
                let mut object = Object::new(&oid, self.data.clone());
                object.start_new_modifier(0, QUEUE.0.borrow().counter);
                object.store();
                player.store();
                QUEUE.0.borrow_mut().insert(self.objindex, pkey, delay, 0);
                0 // no error occurred
            }
        }
    }

    pub fn restart_object(&self, pkey: &[u64; 4]) -> u32 {
        let mut player = AutomataPlayer::get(pkey);
        match player.as_mut() {
            None => ERROR_PLAYER_ALREADY_EXIST,
            Some(player) => {
                let oid = player.get_obj_id(self.objindex);
                let counter = QUEUE.0.borrow().counter;
                let data = &self.data;
                if let Some((delay, modifier)) = restart_object_modifier(&oid, /*QUEUE.0.borrow().*/counter, data) {
                    QUEUE
                        .0
                        .borrow_mut()
                        .insert(self.objindex, pkey, delay, modifier);
                }
                0 // no error occurred
            }
        }
    }

    pub fn withdraw(&self, pkey: &[u64; 4]) -> u32 {
        let mut player = AutomataPlayer::get(pkey);
        match player.as_mut() {
            None => ERROR_PLAYER_NOT_EXIST,
            Some(player) => {
                if let Some(treasure) = player.data.local.0.last_mut() {
                    let withdraw = WithdrawInfo::new(
                        0,
                        0,
                        0,
                        [*treasure as u64, 0, 0, 0],
                        encode_address(&self.data),
                    );
                    SettleMentInfo::append_settlement(withdraw);
                    *treasure = 0;
                    //let t = player.data.local.0.last().unwrap();
                    //zkwasm_rust_sdk::dbg!("treasure is {}", t);
                    player.store();
                } else {
                    unreachable!();
                }
                0
            }
        }
    }

    pub fn deposit(&self, _pkey: &[u64; 4]) -> u32 {
        let mut player = AutomataPlayer::get_from_pid(&[self.data[0], self.data[1]]);
        match player.as_mut() {
            None => {
                let mut player = AutomataPlayer::new_from_pid([self.data[0], self.data[1]]);
                if let Some (treasure) = player.data.local.0.last_mut() {
                    *treasure += self.data[2] as i64;
                    player.store();
                } else {
                    unreachable!();
                }
            },
            Some(player) => {
                if let Some(treasure) = player.data.local.0.last_mut() {
                    *treasure += self.data[2] as i64;
                    let t = player.data.local.0.last().unwrap();
                    zkwasm_rust_sdk::dbg!("treasure is {}", t);
                    player.store();
                } else {
                    unreachable!();
                }
            }
        }
        0 // no error occurred
    }


    pub fn process(&self, pkey: &[u64; 4]) -> u32 {
        let b = match self.command {
            INSTALL_PLAYER => self.install_player(pkey),
            INSTALL_OBJECT => self.install_object(pkey),
            RESTART_OBJECT => self.restart_object(pkey),
            WITHDRAW => self.withdraw(pkey),
            DEPOSIT => self.deposit(pkey),
            _ => {
                QUEUE.0.borrow_mut().tick();
                0
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
