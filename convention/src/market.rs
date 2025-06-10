/// The standard market template
use zkwasm_rest_abi::{Player, StorageData};
use crate::player::WithBalance;
use crate::objects::BidInfo;
use crate::objects::BidObject;
use crate::objects::MarketInfo;
use crate::objects::IndexedObject;
use crate::objects::Wrapped;
use crate::player::PlayerData;
use std::marker::PhantomData;
use core::slice::IterMut;
use crate::err::ErrorEncoder;

pub trait TradeObject: StorageData + Clone {
    fn get_market_id(&self) -> u64;
    fn get_id(&self) -> u64;
    fn set_market_id(&mut self, id: u64);
}

impl<T: TradeObject, P: PlayerData> BidObject<P> for MarketInfo<T, P> {
    const INSUFF:u32 = 0;
    const NOBID: u32 = 1;
    fn get_bidder(&self) -> Option<BidInfo> {
        self.bid
    }

    fn set_bidder(&mut self, bidder: Option<BidInfo>) {
        self.bid = bidder;
    }

    fn get_owner(&self) -> [u64; 2] {
        self.owner
    }

    fn set_owner(&mut self, pid: [u64; 2]) { 
        self.owner = pid 
    }

}


pub struct MarketObject<T: TradeObject, P: PlayerData> (pub MarketInfo<T, P>);

impl<T: TradeObject, P: PlayerData> MarketObject<T, P> {
    pub fn new(marketid: u64, askprice: u64, settleinfo: u64, bid: Option<BidInfo>, object: T, owner: [u64; 2]) -> Self {
        MarketObject (MarketInfo {
            marketid,
            askprice,
            settleinfo,
            bid,
            object,
            owner,
            user: PhantomData
        })
    }
}

const MARKET_MODULE: u32 = 4;
const MARKET_ERROR: [&'static str; 3] = ["InvalidBidder", "InvalidMarketIndex", "NoBidder"];
pub struct MarketError ();


impl ErrorEncoder for MarketError {
    const MODULE_ID: u32 = MARKET_MODULE;
    const ERROR_STR: &'static [&'static str] = &MARKET_ERROR;
}

impl MarketError {
    pub const INVALID_BIDDER: u32 = 0;
    pub const INVALID_MARKET_INDEX: u32 = 1;
    pub const NO_BIDDER: u32 = 2;
}

impl<T: TradeObject, P: PlayerData> StorageData for MarketObject<T, P> {
    fn from_data(u64data: &mut IterMut<u64>) -> Self {
        MarketObject (MarketInfo::<T, P>::from_data(u64data))
    }
    fn to_data(&self, data: &mut Vec<u64>) {
        self.0.to_data(data)
    }
}

impl<T: TradeObject, P: PlayerData> IndexedObject<MarketObject<T, P>> for MarketObject<T, P> {
    const PREFIX: u64 = 0x1ee3;
    const POSTFIX: u64 = 0xfee3;
    const EVENT_NAME: u64 = 0x03;
}

pub trait HasInventory<T: TradeObject> {
    fn add_inventory(&mut self, object: &T);
}

impl<T: TradeObject + IndexedObject<T>, P: PlayerData + HasInventory<T>> MarketObject<T, P> {
    /// 1. bid for a target market object. 
    /// 2. replase the current bidder with the new bidder: player
    /// 3. player.store() is not called and needs to be called external
    pub fn bid(&mut self, player: &mut Player<P>, price: u64, counter: u64) -> Result<(), u32> {
        let lastbidder = self.0.replace_bidder(player, price)?;
        let owner = self.0.get_owner();
        if player.player_id == owner {
            Err(MarketError::INVALID_BIDDER)
        } else {
            if price >= self.0.askprice {
                self.0.settleinfo = 2;
                let owner = self.0.deal()?;
                player.data.add_inventory(&self.0.object);
                let mut n = T::get_object(self.0.object.get_id()).unwrap();
                n.data.set_market_id(0);
                n.store();
                owner.store();
                T::emit_event(n.data.get_id(), &n.data);
            } else {
                self.0.settleinfo = 1 + (counter << 16);
            }
            lastbidder.map(|p| p.store());
            MarketObject::<T, P>::emit_event(self.0.marketid, &self);
            Ok(())
        }
    }

    /// 1. owner can settle the deal
    /// 2. the buyer can settle the deal if certain amount of time has passed
    /// 3. Do not call player.store() as player might be the owner or bidder that has already been stored
    ///    in this function
    pub fn settle(&mut self, player: &Player<P>, counter: u64, deal_delay: u64) -> Result<(), u32> {
        if self.0.settleinfo == 0 || self.0.settleinfo == 2 {
            Err(MarketError::INVALID_MARKET_INDEX)
        } else {
            let owner = self.0.get_owner();
            // calculate the time that has passed
            let delay = counter - (self.0.settleinfo >> 16);
            if player.player_id == owner || delay > deal_delay {
                let owner = self.0.deal()?;
                let mut n = T::get_object(self.0.object.get_id()).unwrap();
                self.0.settleinfo = 2;
                n.data.set_market_id(0);
                let bidder_id = self.0.get_bidder().unwrap().bidder;
                let mut bidder = Player::<P>::get_from_pid(&bidder_id).unwrap();
                bidder.data.add_inventory(&self.0.object);
                n.store();
                bidder.store();
                owner.store();
                MarketObject::<T, P>::emit_event(self.0.marketid, &self);
                T::emit_event(n.data.get_id(), &n.data);
                Ok(())
            } else {
                Err(MarketError::INVALID_MARKET_INDEX)
            }
        }
    }

    /// List the object in the market. The listing price should be handled external
    pub fn list(player: &mut Player<P>, n: &mut Wrapped<T>, askprice: u64, marketid: u64) -> Result<(), u32> {
        // we should not fail after this point
        n.data.set_market_id(marketid);
        let market_object = MarketObject::new(marketid, askprice, 0, None, n.data.clone(), player.player_id);
        let marketinfo = MarketObject::new_object(market_object, marketid);
        marketinfo.store();
        n.store();
        T::emit_event(n.data.get_id(), &n.data);
        MarketObject::<T, P>::emit_event(marketinfo.data.0.marketid, &marketinfo.data);
        Ok(())
    }
}




