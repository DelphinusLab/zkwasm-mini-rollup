use crate::state::Modifier;
use crate::state::Attributes;
const ENTITY_ATTRIBUTES_SIZE:usize = 5;
const LOCAL_ATTRIBUTES_SIZE:usize = 5;
pub fn default_entities() -> [i64; ENTITY_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10]
}
pub fn default_local() -> [i64; LOCAL_ATTRIBUTES_SIZE] {
    [10, 10, 10, 10, 10]
}

struct ModifierEntry<'a> {
    delta: usize,
    entity: [i64; ENTITY_ATTRIBUTES_SIZE],
    local: [i64; LOCAL_ATTRIBUTES_SIZE],
    name: &'a str
}


pub const MODIFIERS:[(usize, [i64; ENTITY_ATTRIBUTES_SIZE], [i64; LOCAL_ATTRIBUTES_SIZE], &str); 5] = [
    (10, [1,1,0,0,0], [0,0,1,0,0], "eat"),
    (10, [1,1,0,0,0], [0,0,1,0,0], "sleep"),
    (10, [1,1,0,0,0], [0,0,1,0,0], "explorer"),
    (10, [1,1,0,0,0], [0,0,1,0,0], "farm"),
    (10, [1,1,0,0,0], [0,0,1,0,0],  "dig"),
];




pub fn get_modifier(index: u64) -> (usize, Modifier) {
    let (d, e, l, _) = MODIFIERS[index as usize];
    (d, Modifier {
        entity: Attributes (e.to_vec()),
        local: Attributes (l.to_vec()),
        global: Attributes (vec![])
    })
}
