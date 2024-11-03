use std::cell::{RefMut, Ref};
use serde::Serialize;
use zkwasm_rest_abi::{Player, StorageData, MERKLE_MAP};

pub trait CommonState: Serialize + StorageData + Sized {
    type PlayerData: StorageData + Default + Serialize;

    fn get_global<'a>() -> Ref<'a, Self>;
    fn get_global_mut<'a>() -> RefMut<'a, Self>;

    fn get_state(pkey: Vec<u64>) -> String {
        let player = Player::<Self::PlayerData>::get_from_pid(&Player::<Self::PlayerData>::pkey_to_pid(&pkey.try_into().unwrap()));
        serde_json::to_string(&player).unwrap()
    }

    fn rand_seed() -> u64 {
        0
    }

    fn snapshot() -> String {
        let state = Self::get_global();
        serde_json::to_string(&*state).unwrap()
    }

    fn preempt() -> bool {
        return false;
    }

    fn store(&self) {
        let mut data = vec![];
        self.to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&[0, 0, 0, 0], data.as_slice());
    }

    fn initialize() {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let mut data = kvpair.get(&[0, 0, 0, 0]);
        if !data.is_empty() {
            let mut u64data = data.iter_mut();
            *Self::get_global_mut() = Self::from_data(&mut u64data);
        }
    }

}
