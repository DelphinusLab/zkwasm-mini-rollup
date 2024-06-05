import {
  ProvingParams,
  WithSignature,
  ZkWasmUtil,
  ProofSubmitMode,
  ZkWasmServiceHelper
} from "zkwasm-service-helper";

export interface TxWitness {
  msg: string,
  pkx: string,
  pky: string,
  sigx: string,
  sigy: string,
  sigr: string,
}

const merkle_init = [
    14789582351289948625n,
    10919489180071018470n,
    10309858136294505219n,
    2839580074036780766n,
]

const priv = "2763537251e2f27dc6a30179e7bf1747239180f45b92db059456b7da8194995a"
const endpoint = "https://rpc.zkwasmhub.com:8090";
//const image_md5 = "53CB557282A36E0677FD925D17C1ADE0";
const image_md5 = "4BC2B4A217F75ED17EB757F18C5D7DD1";
const user_addr = "0xd8f157Cc95Bc40B4F0B58eb48046FebedbF26Bde";

export async function submit_proof(merkle: BigUint64Array, txs: Array<TxWitness>) {
  const helper = new ZkWasmServiceHelper(endpoint, "", "");
  const pub_inputs: Array<string> = [merkle[0], merkle[1], merkle[2], merkle[3]].map((x) => {return `${x}:i64`});
  const priv_inputs: Array<string> = [];
  priv_inputs.push(`${txs.length}:i64`);
  for (const tx of txs) {
    priv_inputs.push(`0x${tx.msg}:bytes-packed`);
    priv_inputs.push(`0x${tx.pkx}:bytes-packed`);
    priv_inputs.push(`0x${tx.pky}:bytes-packed`);
    priv_inputs.push(`0x${tx.sigx}:bytes-packed`);
    priv_inputs.push(`0x${tx.sigy}:bytes-packed`);
    priv_inputs.push(`0x${tx.sigr}:bytes-packed`);
  };

  console.log(priv_inputs);
  
  let proofSubmitMode = ProofSubmitMode.Manual;
  let info: ProvingParams = {
    user_address: user_addr.toLowerCase(),
    md5: image_md5,
    public_inputs: pub_inputs,
    private_inputs: priv_inputs,
    proof_submit_mode: proofSubmitMode, // default is manual
    //input_context_type:: ImageCurrent // default is image current
  };
  
  let msgString = ZkWasmUtil.createProvingSignMessage(info);
  
  let signature: string;
  try {
    signature = await ZkWasmUtil.signMessage(msgString, priv);
  } catch (e: unknown) {
    console.log("error signing message", e);
    return;
  }
  
  let task: WithSignature<ProvingParams> = {
    ...info,
    signature: signature,
  };
  let response = await helper.addProvingTask(task);
}

