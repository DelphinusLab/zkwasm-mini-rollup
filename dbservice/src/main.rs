use jsonrpc_http_server::jsonrpc_core::{ErrorCode, Result, IoHandler};
use jsonrpc_derive::rpc;
use jsonrpc_http_server::ServerBuilder;
use zkwasm_host_circuits::host::datahash::DataHashRecord;
use zkwasm_host_circuits::host::datahash::MongoDataHash;
use zkwasm_host_circuits::host::merkle::MerkleTree;
use zkwasm_host_circuits::host::mongomerkle::MongoMerkle;
use zkwasm_host_circuits::proof::MERKLE_DEPTH;
use serde::Serialize;
use serde::Deserialize;
//use tokio::runtime::Runtime;

/*
lazy_static::lazy_static! {
    pub static ref MONGO_MERKLE: Mutex<MongoMerkle<MERKLE_DEPTH>> = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], DEFAULT_HASH_VEC[MERKLE_DEPTH].clone(), None);
}
*/

#[derive (Clone, Deserialize, Serialize)]
pub struct UpdateLeafRequest {
    root: [u8;32],
    data: [u8;32],
    index: String, // u64 encoding
}
#[derive (Clone, Deserialize, Serialize)]
pub struct GetLeafRequest {
    root: [u8;32],
    index: String,
}

#[derive (Clone, Deserialize, Serialize)]
pub struct UpdateRecordRequest {
    hash: [u8;32],
    data: Vec<String> // vec u64 string
}
#[derive (Clone, Deserialize, Serialize)]
pub struct GetRecordRequest {
    hash: [u8;32],
}

#[rpc]
pub trait Rpc {
	/// Adds two numbers and returns a result
	#[rpc(name = "update_leaf")]
    fn update_leaf(&self, request: UpdateLeafRequest) -> Result<[u8; 32]>;
	#[rpc(name = "get_leaf")]
    fn get_leaf(&self, request: GetLeafRequest) -> Result<[u8; 32]>;
	#[rpc(name = "get_record")]
    fn get_record(&self, request: GetRecordRequest) -> Result<Vec<u64>>;
	#[rpc(name = "update_record")]
    fn update_record(&self, request: UpdateRecordRequest) -> Result<()>;
}

pub struct RpcImpl;
impl Rpc for RpcImpl {
    fn update_leaf(&self, request: UpdateLeafRequest) -> Result<[u8; 32]> {
        let index = u64::from_str_radix(request.index.as_str(), 10).unwrap();
        let mut mt = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], request.root, None);
        mt.update_leaf_data_with_proof(index, &request.data.to_vec()).map_err(|_| jsonrpc_core::Error::new(ErrorCode::InternalError))?;
        Ok(mt.get_root_hash())
	}
    fn get_leaf(&self, request: GetLeafRequest) -> Result<[u8; 32]> {
        /*
        let index = u64::from_str_radix(request.index.as_str(), 10).map_err(|_| {
            jsonrpc_core::Error::new(ErrorCode::InternalError)
        })?;
        */
        let index = u64::from_str_radix(request.index.as_str(), 10).unwrap();
        let mt = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], request.root, None);
        let (leaf, _) = mt.get_leaf_with_proof(index)
            .map_err(|e| {
                println!("error is {:?}", e);
                jsonrpc_core::Error::new(ErrorCode::InternalError)
            })?;
        Ok(leaf.data)
    }
    fn update_record(&self, request: UpdateRecordRequest) -> Result<()> {
        let mut mongo_datahash = MongoDataHash::construct([0; 32], None);
        mongo_datahash.update_record({
                DataHashRecord {
                    hash: request.hash,
                    data: request
                        .data
                        .iter()
                        .map(|x| {
                            let x = u64::from_str_radix(x, 10).unwrap();
                             x.to_le_bytes()
                        })
                        .flatten()
                        .collect::<Vec<u8>>(),
                }
            })
        .unwrap();
        Ok(())
	}
    fn get_record(&self, request: GetRecordRequest) -> Result<Vec<u64>> {
        let mongo_datahash = MongoDataHash::construct([0; 32], None);
        let datahashrecord = mongo_datahash.get_record(&request.hash).unwrap();
        let data = datahashrecord.map_or(vec![], |r| {
            r.data
                .chunks_exact(8)
                .into_iter()
                .into_iter()
                .map(|x| u64::from_le_bytes(x.try_into().unwrap()))
                .collect::<Vec<u64>>()
        });
        Ok(data)
    }

}

//#[tokio::main]
//async fn main() {
fn main() {
	let mut io = IoHandler::default();
    io.extend_with(RpcImpl.to_delegate());

	let server = ServerBuilder::new(io)
		.threads(3)
		.start_http(&"127.0.0.1:3030".parse().unwrap())
		.unwrap();

	server.wait();
}

#[test]
fn client_server_roundtrip() {
    use jsonrpc_core_client::transports::local;
    use zkwasm_host_circuits::host::mongomerkle::DEFAULT_HASH_VEC;
    use jsonrpc_core::futures::{self, TryFutureExt};
    let mut handler = IoHandler::new();
    handler.extend_with(RpcImpl.to_delegate());
    let (client, rpc_client) = local::connect::<gen_client::Client, _, _>(handler);
    let fut = client
        .clone()
        .get_leaf(GetLeafRequest {
            root: DEFAULT_HASH_VEC[MERKLE_DEPTH],
            index: "0".to_string()
        })
        .map_ok(move |res| {
            println!("res is {:?}", res);
        });
    futures::executor::block_on(async move { futures::join!(fut, rpc_client) })
        .0
        .unwrap();
}
