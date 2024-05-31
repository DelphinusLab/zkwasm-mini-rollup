use zkwasm_host_circuits::host::datahash::DataHashRecord;
use zkwasm_host_circuits::host::datahash::MongoDataHash;
use zkwasm_host_circuits::host::merkle::MerkleTree;
use zkwasm_host_circuits::host::mongomerkle::MongoMerkle;
use zkwasm_host_circuits::proof::MERKLE_DEPTH;
use serde::Serialize;
use serde::Deserialize;
use jsonrpc_v2::{Data, Error, Params, Server};
//use tokio::runtime::Runtime;

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

async fn update_leaf(Params(request): Params<UpdateLeafRequest>) -> Result<[u8; 32], Error> {
    let index = u64::from_str_radix(request.index.as_str(), 10).unwrap();
    let hash = actix_web::web::block(move || {
        let mut mt = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], request.root, None);
        mt.update_leaf_data_with_proof(index, &request.data.to_vec())
            .map_err(|e|{
                println!("error {:?}", e);
                Error::INTERNAL_ERROR
            })?;
        Ok(mt.get_root_hash())
    }).await
    .map_err(|_| Error::INTERNAL_ERROR)?;
    hash
}

async fn get_leaf(Params(request): Params<GetLeafRequest>) -> Result<[u8; 32], Error> {
    let index = u64::from_str_radix(request.index.as_str(), 10).unwrap();
    let leaf = actix_web::web::block(move || {
        let mt = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], request.root, None);
        let (leaf, _) = mt.get_leaf_with_proof(index)
            .map_err(|e| {
                println!("error is {:?}", e);
                Error::INTERNAL_ERROR
            })?;
        Ok(leaf)
    }).await
    .map_err(|_| Error::INTERNAL_ERROR)?;
    leaf.map(|l| {
        println!("get leaf {:?}", l.data);
        l.data
    })
}
async fn update_record(Params(request): Params<UpdateRecordRequest>) -> Result<(), Error> {
    println!("update reacord with hash {:?}...", request.hash);
    println!("update reacord with data {:?}...", request.data);
    let _ = actix_web::web::block(move || {
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
    }).await
    .map_err(|_| Error::INTERNAL_ERROR)?;
    Ok(())
}

async fn get_record(Params(request): Params<GetRecordRequest>) -> Result<Vec<String>, Error> {
    println!("get reacord with hash {:?}...", request.hash);
    let datahashrecord =
        actix_web::web::block(move || {
            let mongo_datahash = MongoDataHash::construct([0; 32], None);
            mongo_datahash.get_record(&request.hash).unwrap()
        }).await
    .map_err(|_| Error::INTERNAL_ERROR)?;
    let data = datahashrecord.map_or(vec![], |r| {
        r.data
            .chunks_exact(8)
            .into_iter()
            .into_iter()
            .map(|x| u64::from_le_bytes(x.try_into().unwrap()).to_string())
            .collect::<Vec<String>>()
    });
    println!("get reacord with data {:?}...", data);
    Ok(data)
}

fn main() -> std::io::Result<()> {
    let rpc = Server::new()
        .with_data(Data::new(String::from("Hello!")))
        .with_method("update_leaf", update_leaf)
        .with_method("get_leaf", get_leaf)
        .with_method("update_record", update_record)
        .with_method("get_record", get_record)
        .finish();

    actix_web::rt::System::new().block_on(
        actix_web::HttpServer::new(move || {
            let rpc = rpc.clone();
            actix_web::App::new().service(
                actix_web::web::service("/")
                .guard(actix_web::guard::Post())
                .finish(rpc.into_web_service()),
                )
        })
        .bind("127.0.0.1:3030")?
        .run()
    )
}

#[test]
fn update_leaf_test() {
    let request = UpdateLeafRequest {
        root: [208, 107, 182, 47, 101, 239, 49, 228, 249, 118, 179, 167, 239, 211, 131, 101, 81, 103, 108, 174, 203, 236, 108, 251, 125, 22, 81, 58, 216, 86, 46, 1],
        data: [46, 49, 43, 246, 232, 24, 211, 241, 73, 195, 156, 126, 82, 150, 152, 41, 162, 86, 181, 181, 123, 175, 165, 155, 192, 168, 58, 5, 211, 77, 237, 5],
        index: "4294967296".to_string(),
    };
    println!("update leaf {:?} {:?} {:?}", request.root, request.data, request.index);
    let index = u64::from_str_radix(request.index.as_str(), 10).unwrap();
    let mut mt = MongoMerkle::<MERKLE_DEPTH>::construct([0;32], request.root, None);
    println!("update leaf processing ");
    mt.update_leaf_data_with_proof(index, &request.data.to_vec()).unwrap();
    println!("update leaf done");
}


