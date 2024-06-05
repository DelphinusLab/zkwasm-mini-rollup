use crate::state::Modifier;
use crate::state::Attributes;
use serde::Serialize;
const ENTITY_ATTRIBUTES_SIZE:usize = 5;
const LOCAL_ATTRIBUTES_SIZE:usize = 5;

#[derive (Serialize, Clone)]
pub struct Config {
    entity_attributes: [&'static str; ENTITY_ATTRIBUTES_SIZE],
    local_attributes: [&'static str; LOCAL_ATTRIBUTES_SIZE],
    modifiers: Vec<(usize, [i64; ENTITY_ATTRIBUTES_SIZE], [i64; LOCAL_ATTRIBUTES_SIZE], &'static str)>
}
pub fn default_entities() -> [i64; ENTITY_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10]
}
pub fn default_local() -> [i64; LOCAL_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10]
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        entity_attributes: ["hp", "mp", "stamina", "luck", "power"],
        local_attributes: ["food", "resource", "mineral", "water", "treasure"],
        modifiers: vec![
            (3, [1,1,0,0,0], [-1,0,0,0,0], "eat"),
            (12, [1,1,0,0,0], [0,0,-1,0,0], "sleep"),
            (80, [-1,-1,0,0,0], [0,0,1,0,0], "explorer"),
            (20, [-1,-1,0,0,0], [0,0,0,1,0], "farm"),
            (10, [-1,-1,0,0,0], [0,0,0,0,1],  "dig"),
        ],
    };
}

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }
}

pub fn get_modifier(index: u64) -> (usize, Modifier) {
    let (d, e, l, _) = CONFIG.modifiers[index as usize];
    (d, Modifier {
        entity: Attributes (e.to_vec()),
        local: Attributes (l.to_vec()),
        global: Attributes (vec![])
    })
}
