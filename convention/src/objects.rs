use std::marker::PhantomData;
use core::slice::IterMut;
use serde::Serialize;

use zkwasm_rest_abi::{Player, StorageData, MERKLE_MAP};

use crate::player::WithBalance;
use crate::event::insert_event;

pub struct Wrapped<P: StorageData> {
    pub key: [u64; 4],
    pub data: P,
}

impl<P: StorageData> Wrapped<P> {
    pub fn store(&self) {
        let mut data = Vec::new();
        self.data.to_data(&mut data);
        let kvpair = unsafe { &mut MERKLE_MAP };
        kvpair.set(&self.key, data.as_slice());
    }
}

pub trait IndexedObject<P: StorageData> {
    const PREFIX: u64;
    const POSTFIX: u64;
    const EVENT_NAME:u64;
    fn new_object(p: P, index: u64) -> Wrapped<P> {
        let key = [Self::PREFIX + (index << 16), Self::POSTFIX, Self::POSTFIX, Self::POSTFIX];
        Wrapped {
            key,
            data: p
        }
    }

    fn get_object(index: u64) -> Option<Wrapped<P>> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (index << 16), Self::POSTFIX, Self::POSTFIX, Self::POSTFIX];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            None
        } else {
            let mut dataslice = data.iter_mut();
            Some(Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            })
        }
    }
    fn emit_event(index: u64, p: &P) {
        let mut data = vec![index];
        p.to_data(&mut data);
        insert_event(Self::EVENT_NAME, &mut data);
    }
}

pub trait Position<P: StorageData> {
    const PREFIX: u64;
    const POSTFIX: u64;
    const EVENT_NAME: u64;
    fn new_position(pid: &[u64; 2], p: P, index: u64) -> Wrapped<P> {
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        Wrapped {
            key,
            data: p
        }
    }

    fn get_position(pid: &[u64; 2], index: u64) -> Option<Wrapped<P>> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            None
        } else {
            let mut dataslice = data.iter_mut();
            Some(Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            })
        }
    }

    fn get_or_new_position(pid: &[u64; 2], index: u64, default: P) -> Wrapped<P> {
        let kvpair = unsafe { &mut MERKLE_MAP };
        let key = [Self::PREFIX + (pid[0]<<16) + (index << 32), (pid[0] >> 48) + (pid[1] << 16), (pid[1] >> 48) + (Self::POSTFIX << 16), 0];
        let mut data = kvpair.get(&key);
        if data.is_empty() {
            Wrapped {
                key,
                data: default
            }
        } else {
            let mut dataslice = data.iter_mut();
            Wrapped {
                key,
                data: P::from_data(&mut dataslice),
            }
        }
    }
    fn emit_event(pid: &[u64; 2], index: u64, p: &P) {
        let mut data = vec![pid[0], pid[1], index];
        p.to_data(&mut data);
        insert_event(Self::EVENT_NAME, &mut data);
    }
}

#[derive(Clone, Serialize, Default, Copy)]
pub struct MarketInfo<Object: StorageData, PlayerData: StorageData + Default + WithBalance> {
    pub marketid: u64, 
    pub askprice: u64,
    pub settleinfo: u64,
    pub bid: Option<BidInfo>,
    pub owner: [u64; 2],
    pub object: Object,
    pub user: PhantomData<PlayerData>,
}

impl<O: StorageData, Player: StorageData + Default + WithBalance> StorageData for MarketInfo<O, Player> {
    fn from_data(u64data: &mut IterMut<u64>) -> MarketInfo<O, Player> {
        let marketid= *u64data.next().unwrap();
        let askprice = *u64data.next().unwrap();
        let settleinfo = *u64data.next().unwrap();
        let mut bidder = None;
        if settleinfo != 0 {
            let bidprice = *u64data.next().unwrap();
            bidder = Some(BidInfo {
                bidprice,
                bidder: [*u64data.next().unwrap(), *u64data.next().unwrap()]
            })
        }
        let owner = [*u64data.next().unwrap(), *u64data.next().unwrap()];
        let object = O::from_data(u64data);
        MarketInfo {
            marketid,
            askprice,
            settleinfo,
            bid: bidder,
            owner,
            object,
            user: PhantomData
        }
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        data.push(self.marketid);
        data.push(self.askprice);
        data.push(self.settleinfo);
        if self.settleinfo != 0 {
            let bid = self.bid.unwrap();
            data.push(bid.bidprice);
            data.push(bid.bidder[0]);
            data.push(bid.bidder[1]);
        }
        data.push(self.owner[0]);
        data.push(self.owner[1]);
        self.object.to_data(data)
    }
}

#[derive(Clone, Serialize, Default, Copy)]
pub struct BidInfo {
    pub bidprice: u64,
    pub bidder: [u64; 2]
}

impl<O: StorageData, PlayerData: StorageData + Default + WithBalance> MarketInfo<O, PlayerData> {
    pub fn get_bidder(&self) -> Option<BidInfo> {
        self.bid
    }
    pub fn set_bidder(&mut self, bidder: Option<BidInfo>) {
        self.bid = bidder
    }
    pub fn get_owner(&self) -> [u64; 2] {
        self.owner
    }
    pub fn set_owner(&mut self, owner: [u64; 2]) {
        self.owner = owner;
    }
}

pub trait BidObject<PlayerData: StorageData + Default + WithBalance> {
    const INSUFF: u32;
    const NOBID: u32;
    fn get_bidder(&self) -> Option<BidInfo>;
    fn set_bidder(&mut self, bidder: Option<BidInfo>);
    fn get_owner(&self) -> [u64; 2];
    fn set_owner(&mut self, owner: [u64; 2]);

    /// clear the bidder of the object, the bidding amount will be returned to the current bidder
    /// the previous bidder is returned if exists
    fn clear_bidder(&mut self) -> Option<Player<PlayerData>> {
        let player = self.get_bidder().map(|c| {
            let mut player = Player::<PlayerData>::get_from_pid(&c.bidder).unwrap();
            player.data.inc_balance(c.bidprice);
            player
        });
        self.set_bidder(None); 
        player
    }

    /// settle the current bid the owner of the object will receive the bidding price and the
    /// winnder of the bidding will become the owner
    /// the winning bidder is returned
    fn deal(&mut self) -> Result<Player<PlayerData>, u32> {
        let bidder = self.get_bidder();
        match bidder {
            Some(c) => {
                let pid = &c.bidder;
                let mut owner = Player::<PlayerData>::get_from_pid(&self.get_owner()).unwrap();
                owner.data.inc_balance(c.bidprice);
                self.set_owner(pid.clone());
                Ok(owner)
            },
            None => {
                Err(Self::NOBID)
            }
        }

    }

    /// replace the current with a new bidder.
    /// the bidding fund will return to the previous bidder if exists
    /// the new bidder will lock its bidding fund in the bidding object
    /// the previous bidder is returned if exists
    fn replace_bidder(&mut self, player: &mut Player<PlayerData>, amount: u64) -> Result<Option<Player<PlayerData>>, u32> {
        self.get_bidder().map_or(Ok(()), |x| {
            let bidprice = x.bidprice;
            if bidprice >= amount {
                Err(Self::INSUFF)
            } else {
                Ok(())
            }
        })?;
        let old_bidder = self.clear_bidder();
        self.set_bidder(Some (BidInfo {
            bidprice: amount,
            bidder: player.player_id.clone(),
        }));
        player.data.cost_balance(amount)?;
        Ok(old_bidder)
    }
}

