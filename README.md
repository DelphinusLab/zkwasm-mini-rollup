# A typescript mini server for ZKWASM server side application

This repo is a sample REST service in Rust which is compiled to WASM and runs in nodejs. The external running environment is described in the following picture where the left most component is our mini-rest-server.
![alt text](./images/mini-rest-service-rollup.png)

The trustless part is the transaction handling part whose execution is proved using the ZKWASM proving service (the middle component in the graph) and the final proofs are verified onchain with settlement callbacks.

## Put the endless REST server login written in typescript into ZKWASM

1. The nature logic:
![alt text](./images/minirollup-nature.png)

2. The bundled logic:
![alt text](./images/minirollup-bundled.png)



## Rest service ABI convention
The convention between the sequencer (implemented in typescript) and the provable application contains three parts.
1. The transaction handlers
2. The state initializer and querying APIs
3. The configuration APIs

Once all related interfaces are defined, we use the following macro to generate the zkmain function which is supposed to run in the ZKWASM virtual machine (more details can be found in abi/src/lib.rs). After the WASM is compiled, it exposes a set of interfaces (verify_tx_signature, handle_tx, initialize, flush_settlement, etc) for the sequencer (A sketch of the sequencer can be found in ts/service.rs).

The WASM is bootstrap by implementing ZKWASM's host interfaces which are another WASM image that is preloaded before loading the main WASM image. The implementation of these host APIs can be found in ts/src/bootstrap/ which is compiled from the rust bootstrap code in host directory. The sketch of the bootstraping looks like the following:
```
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";

......
// initialize the bootstrap wasm image
await (initBootstrap as any)();

// initialize the application wasm which relies on the host interfaces from bootstrap image.
await (initApplication as any)(bootstrap);

......

```

## Quick Start of an example application
1. Start Redis & mongodb
```
sudo add-apt-repository ppa:redislabs/redis
sudo apt-get update
redis-server
mkdir $DBDIR
mongod --dbpath $DBDIR
```

2. Start dbservice
This is the Merkle DB service which handles witness generation and storage of Merkle trees.
```
./dbservice >>> cargo run --release
```

3. Compiling the bootstrap WASM image.
The bootstrap WASM image provides the host APIs that are supported in ZKWASM. These are precompiled functions that can be called in our ZKWASM application.
```
./host >>> make build
```

4. Compiling the application WASM image.
```
./example >>> make build
```

5. Start service
```
./ts >>> npm install
./ts >>> npx tsc
./ts >>> node src/service.js
```

## Application ABI convertion
1. State ABI:
```
pub fn get_state(pid: Vec<u64>) -> String; // query the user state of a given user id
pub fn preempt() -> bool; // whether to generate proof at this stage
pub fn randSeed() -> u64; // get the current hash of the random seed
pub fn initialize(); // initialize the state at beginning
pub fn flush_settlement() -> Vec<u8>; // get the settlement info (see: zkwasm onchain settlement protocol)
```

2. Config ABI:
```
pub fn autotick() -> bool
pub fn to_json_string() -> String
```

3. Transaction ABI:
```
fn decode_error(e) // decode error code to description
fn decode(command) -> Transaction // decode transaction inputs into Transactio
fn process(&user_address, &sig_r) // handle transaction
```

## Architecture
![alt text](./images/zkwasm-ts-service.png)

## Invoke ZKWASM cloud
All the transactions are recorded in the **transactions_witness** pool in *service.ts*. The **install_transactions** function is called everytime a job is processed in the workder
```
  const worker = new Worker('sequencer', async job => {
      try {
        // processing the transaction
        application.verify_tx_signature(u64array);
        application.handle_tx(u64array);
        // if no execption is caught by now, record the transaction witness
        await install_transactions(value);
      } catch (error) {
        console.log("handling tx error");
        console.log(error);
      }
  }, {connection});
```

Once the **transaction_witness** pool is full, we will generate a proof as follows.
```
async function install_transactions(tx: TxWitness) {
  transactions_witness.push(tx);
  if (transactions_witness.length == TRANSACTION_NUMBER) {
    // rollup pool is full, generating proof.
    await submit_proof(transactions_witness);
    // You can insert DA related stuff here
    // reset the transaction pool here
    transactions_witness = new Array();
  }
}
```

In the above code segment, we will invoke the ZKWASM cloud service (www.zkwasmhub.com) to generate the ZKWASM proof with **transactions_witness**. Please refer to the ZKWASM typescript service helper https://github.com/DelphinusLab/zkWasm-service-helper for more information.

## Rollup Monitor
Once the proof have been created, we can use the proof and its related transaction calldata to trigger the settlement by calling the settlement contract in our target blockchain. The settlement protocol can be designed in different ways. Here we provid a basic protocol.

1. The settlement contract stores a merkle root
2. The settlement contract provides a verify API

```
function verify(
  bytes calldata tx_data,
  uint256[] calldata proof,
  uint256[] calldata verify_instance,
  uint256[] calldata aux,
  uint256[][] calldata instances,
) public {

  // Saninty Check

  uint256 sha_pack = uint256(sha256(tx_data));
  require(
      sha_pack ==
          (instances[0][8] << 192) +
              (instances[0][9] << 128) +
              (instances[0][10] << 64) +
              instances[0][11],
      "Inconstant: Sha data inconsistant"
  );

  require(
      merkle_root ==
          (instances[0][0] << 192) +
              (instances[0][1] << 128) +
              (instances[0][2] << 64) +
              instances[0][3],
      "Inconstant: Merkle root dismatch"
  );

  // Verify Proof

  verifier.verify(proof, verify_instance, aux, instances);

  // Perform settlement
  .....
}
```

We see that the verify instances contains the data of the merkle root before and after the execution. Thus the proof can only be settled on chain if the merkel root of the proof instances is equal to the merkle root in the contract. Thank means the proofs are settled in an order implied by the merkle root before and after the execution.

We thus introduce a rollup monitor to settle the proofs based on the merkle root in the contract.
![alt text](./images/monitor-architecture.png)

## Run Local Server
1. mongod --dbpath XXX
2. redis-server 
3. dbservice >> run.sh 
4. ts >> npm run server
