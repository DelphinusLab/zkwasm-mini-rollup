use wasm_bindgen::prelude::*;
use zkwasm_rest_abi::*;
pub mod config;
pub mod state;

use crate::config::Config;
use crate::state::{State, Transaction};
use zkwasm_rest_convention::CommonState;
zkwasm_rest_abi::create_zkwasm_apis!(Transaction, State, Config);
