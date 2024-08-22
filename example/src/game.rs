use serde::Serialize;
use crate::config::get_monster_health;
use crate::config::get_monster_rewards;


#[derive(Clone)]
pub struct CommitmentInfo ([u64; 2]);

#[derive(Serialize, Clone)]
pub struct Monster {
    pub health: u64,
    pub rewards: u64,
    pub buf: Vec<u8>
}

impl CommitmentInfo {
    pub fn new(c0: u64, c1: u64) -> Self {
        CommitmentInfo([c0, c1])
    }
}

#[derive(Serialize, Clone)]
pub struct RoundInfo {
    pub locked_dps: u64,
    pub locked_rewards: u64,
}

#[derive(Serialize, Clone)]
pub struct Game {
    pub total_dps: u64,
    pub progress: u64,
    pub target: usize, // the target monster id
    pub last_round_info: RoundInfo,
}

impl Game {
    pub fn settle(&mut self) {
        self.progress += self.total_dps;
        if self.progress >= get_monster_health(self.target as usize) {
            self.last_round_info = RoundInfo {
                locked_dps: self.total_dps,
                locked_rewards: get_monster_rewards(self.target as usize)
            };
            self.progress = 0;
            self.target += 1;
        }
    }
}
