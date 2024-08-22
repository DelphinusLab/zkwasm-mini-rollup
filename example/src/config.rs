use crate::{game::Monster, settlement::SettlementInfo, state::STATE};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Config {
    cards: Vec<u32>,
}

lazy_static::lazy_static! {
    pub static ref CONFIG: Config = Config {
        cards: vec![0,1,2,3],
    };
}

impl Config {
    pub fn to_json_string() -> String {
        serde_json::to_string(&CONFIG.clone()).unwrap()
    }

    pub fn autotick() -> bool {
        false
    }
}

static MONSTERS: [Monster; 1] = [
    Monster {
        health: 10000,
        rewards: 100,
        buf:vec![]
    }];

pub fn get_monster_health(id: usize) -> u64 {
    return MONSTERS[id].health;
}

pub fn get_monster_rewards (id: usize) -> u64 {
    return MONSTERS[id].rewards;
}
