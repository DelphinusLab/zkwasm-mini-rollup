# A typescript mini server for ZKWASM server side application

This repo is a sample REST service in RUST which is compiled to WASM and runs in nodejs. The external running environment is described in the following picture where the left most component is our mini-rest-server.
![alt text](./images/mini-rest-service-rollup.png)

The trustless part are the transaction handling part whose execution is proved using the ZKWASM proving service (the middle component in the graph) and the final proofs are verified onchain with settlement callbacks.

## Dependency

- Redis
```
sudo add-apt-repository ppa:redislabs/redis
sudo apt-get update
redis-server
```

- Mongodb
```
mongodb --dbpath db
```

- Node js
```
./ts >>> npm install
./ts >>> npm run server
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

