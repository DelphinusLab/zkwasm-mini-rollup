use wasm_bindgen::prelude::*;
use zkwasm_rest_abi::*;
pub mod events;
pub mod state;
pub mod config;

use crate::state::{Transaction, State};
use crate::config::Config;
zkwasm_rest_abi::create_zkwasm_apis!(Transaction, State, Config);
