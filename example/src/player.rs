use crate::config::get_monster_health;
use crate::config::get_monster_rewards;
use crate::StorageData;
use serde::{ser::SerializeSeq, Serialize, Serializer};
use crate::MERKLE_MAP;
use crate::Player;
use core::slice::IterMut;

// Custom serializer for `[u64; 4]` as an array of strings.
pub fn bigint_array_serializer<S>(array: &Vec<u64>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let mut seq = serializer.serialize_seq(Some(array.len()))?;
    for &element in array {
        seq.serialize_element(&element.to_string())?;
    }
    seq.end()
}

#[derive(Clone, Serialize)]
pub struct PlayerData {
    #[serde(serialize_with = "bigint_array_serializer")]
    pub inventory: Vec<u64>,
    pub energe: u64,
    pub target: u64,
    pub remain: u64,
    pub dps: u64,
    pub time_stamp: u64,
    pub balance: u64,
}

impl Default for PlayerData {
    fn default() -> Self {
        Self {
            inventory: vec![],
            energe: 0,
            target: 0,
            remain: 0,
            dps: 0,
            time_stamp: 0,
            balance: 0,
        }
    }
}

impl StorageData for PlayerData {
    fn from_data(u64data: &mut IterMut<u64>) -> Self {
        let objects_size = *u64data.next().unwrap();
        let mut inventory = Vec::with_capacity(objects_size as usize);
        for _ in 0..objects_size {
            inventory.push(*u64data.next().unwrap());
        }
        PlayerData {
            inventory,
            energe: *u64data.next().unwrap(),
            target: *u64data.next().unwrap(),
            remain: *u64data.next().unwrap(),
            dps: *u64data.next().unwrap(),
            time_stamp: (*u64data.next().unwrap()),
            balance: (*u64data.next().unwrap())
        }
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.inventory.len() as u64);
        for c in self.inventory.iter() {
            data.push(*c as u64);
        }
        data.push(self.energe);
        data.push(self.target);
        data.push(self.remain);
        data.push(self.dps);
        data.push(self.time_stamp);
        data.push(self.balance);
    }
}

trait SettleDps {
    fn settle_dps(&mut self, time: u64);
}


pub type CombatPlayer = Player<PlayerData>;

impl SettleDps for CombatPlayer {
    fn settle_dps(&mut self, time: u64) {
        let dmg = (time - self.data.time_stamp) * self.data.dps + self.data.remain;
        let total = dmg / get_monster_health(self.data.target as usize);
        self.data.remain = dmg - total * self.data.target;
        self.data.energe += total * get_monster_rewards(self.data.target as usize);
        self.data.time_stamp = time;
    }
}
