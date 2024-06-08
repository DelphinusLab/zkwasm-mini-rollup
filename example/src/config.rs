use crate::settlement::SettleMentInfo;
use crate::state::Modifier;
use crate::state::Attributes;
use serde::Serialize;
const ENTITY_ATTRIBUTES_SIZE:usize = 6;
const LOCAL_ATTRIBUTES_SIZE:usize = 8;

#[derive (Serialize, Clone)]
pub struct Config {
    entity_attributes: [&'static str; ENTITY_ATTRIBUTES_SIZE],
    local_attributes: [&'static str; LOCAL_ATTRIBUTES_SIZE],
    modifiers: Vec<(usize, [i64; ENTITY_ATTRIBUTES_SIZE], [i64; LOCAL_ATTRIBUTES_SIZE], &'static str)>
}
pub fn default_entities() -> [i64; ENTITY_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10, 10]
}
pub fn default_local() -> [i64; LOCAL_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10, 0, 0, 10]
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        entity_attributes: ["hp", "mp", "stamina", "luck", "power", "AB"],
        local_attributes: ["food", "resource", "mineral", "water", "treasure", "D", "E", "F"],
        modifiers: vec![
            (2,[0,0,0,0,0,0],[-1,-1,1,0,0,0,0,0,],"1"),
            (3,[0,0,0,0,0,0],[3,0,-1,0,0,0,0,0,],"2"),
            (2,[0,0,0,0,0,0],[0,3,-1,0,0,0,0,0],"3"),
            (2,[6,0,0,0,0,0],[-1,-2,-2,0,0,0,0,0],"4"),
            (2,[-1,0,0,0,0,0],[-2,-2,-1,6,0,0,0,0],"5"),
            (3,[6,0,0,0,0,0],[-6,-1,3,-1,0,0,0,0],"6"),
            (4,[-3,1,0,0,0,0],[3,3,4,-2,0,0,0,0],"7"),
            (5,[-3,0,0,0,0,0],[-8,4,-1,-1,3,0,0,0],"8"),
            (10,[-2,-3,0,0,0,0],[-4,-6,-3,-1,-3,0,0,5],"9"),
            (3,[-1,-2,0,0,0,0],[-5,0,-3,0,0,8,0,0],"10"),
            (5,[1,-2,0,0,0,0],[2,4,2,3,-1,-3,0,2],"11"),
            (5,[-2,3,0,0,0,0],[0,0,0,0,0,0,0,-1],"12"),
            (5,[-1,-2,3,0,0,0],[0,0,-2,0,-4,-2,0,0],"13"),
            (3,[-3,4,-2,0,0,0],[0,-2,0,0,-3,0,0,0],"14"),
            (5,[-1,0,0,0,0,0],[-2,-2,-3,6,6,0,0,0],"15"),
            (10,[-1,0,-2,0,0,0],[-10,10,6,2,5,7,0,0],"16"),
            (8,[-7,-5,-2,0,0,0],[-3,-9,-1,-3,-5,-2,0,32],"17"),
            (4,[-1,-2,0,0,0,0],[0,0,-5,0,0,0,3,0],"18"),
            (3,[3,-1,-1,0,0,0],[2,3,4,3,6,8,-2,0],"19"),
        ],
    };
}

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }
    pub fn flush_settlement() -> [u64; 4] {
        SettleMentInfo::flush_settlement()
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
