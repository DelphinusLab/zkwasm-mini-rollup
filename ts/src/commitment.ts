import { ethers } from "ethers";
import { ZkWasmServiceHelper, ZkWasmUtil, ProofSubmitMode } from "zkwasm-service-helper";

// Types and interfaces
export interface ProveCredentials {
    USER_ADDRESS: string;
    USER_PRIVATE_KEY: string;
    IMAGE_HASH: string;
    CLOUD_RPC_URL: string;
}

export interface SegmentData {
    initial_states: bigint[];
    player_action_inputs: bigint[];
    final_state: bigint[];
}

// Constants
export const EMPTY_STATE_HASH = "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// Utility functions for type conversion and data handling
export function convertToBigInts(input: any[]): bigint[] {
    try {
        if (Array.isArray(input)) {
            return input.map((i) => BigInt(i));
        } else {
            return [BigInt(input)];
        }
    } catch (e) {
        throw new Error(`Invalid input: ${e}`);
    }
}

export function bytes32ToU64Array(bytes32: string): [bigint, bigint, bigint, bigint] {
    return [
        BigInt("0x" + bytes32.slice(2, 18)),
        BigInt("0x" + bytes32.slice(18, 34)),
        BigInt("0x" + bytes32.slice(34, 50)),
        BigInt("0x" + bytes32.slice(50, 66)),
    ];
}

export function decodeBytesToU64Array(bytes: string, uintLength: number): bigint[] {
    if (bytes === "0x") {
        return new Array(uintLength).fill(BigInt(0));
    }
    return ethers.AbiCoder.defaultAbiCoder().decode(
        new Array(uintLength).fill("uint64"),
        bytes
    );
}

export function encodeU64ArrayToBytes(uint64Array: bigint[]): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        new Array(uint64Array.length).fill("uint64"),
        uint64Array
    );
}

// Hash computation functions
export function computeHashInBytes32(gameInputs: bigint[] | BigUint64Array): string {
    if (gameInputs instanceof BigUint64Array) {
        gameInputs = Array.from(gameInputs);
    }
    const _rawBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        gameInputs.map((x) => "uint256"),
        gameInputs
    );
    return ethers.sha256(_rawBytes);
}

export function computeHashInU64Array(
    gameInputs: bigint[] | BigUint64Array
): [bigint, bigint, bigint, bigint] {
    const _hash = computeHashInBytes32(gameInputs);
    return bytes32ToU64Array(_hash);
}

export function computeSegmentHash(params: {
    gameID: bigint;
    onChainGameStateHash: [bigint, bigint, bigint, bigint];
    gameInputHash: [bigint, bigint, bigint, bigint];
}): [bigint, bigint, bigint, bigint] {
    const _hash = ethers.sha256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint64", "uint64", "uint64", "uint64", "uint64", "uint64", "uint64", "uint64"],
            [params.gameID, ...params.onChainGameStateHash, ...params.gameInputHash]
        )
    );
    return bytes32ToU64Array(_hash);
}

// Encoding functions
export function encodeInitialStatesToBytes32(
    initialStates: bigint[][],
    finalState: bigint[],
    uninitializedOnchainState: boolean
): string[] {
    return [
        ...initialStates.map((x, i) =>
            i == 0 && uninitializedOnchainState && x.every((x) => x === BigInt(0))
                ? EMPTY_STATE_HASH
                : computeHashInBytes32(x)
        ),
        computeHashInBytes32(finalState),
    ];
}

export function encodePlayerActionToBytes32(playerAction: bigint[][]): string[] {
    return playerAction.map((x) => computeHashInBytes32(x));
}

// Address handling
function reverseBytes(input: bigint): bigint {
    let reversed = BigInt(0);
    for (let i = 0; i < 8; i++) {
        reversed = (reversed << BigInt(8)) | ((input >> BigInt(8 * i)) & BigInt(0xff));
    }
    return reversed;
}

export function splitAddress(address: string): bigint[] {
    const fullAddress = BigInt(address);
    const mask64Bits = BigInt("0xFFFFFFFFFFFFFFFF");
    const part3 = reverseBytes((fullAddress << BigInt(32)) & mask64Bits);
    const part2 = reverseBytes((fullAddress >> BigInt(32)) & mask64Bits);
    const part1 = reverseBytes((fullAddress >> BigInt(96)) & mask64Bits);
    return [part1, part2, part3];
}

// ZK Proof related functions
export function computeOPZKSubmissionHash(submissionData: {
    game_id: bigint;
    submission_nonce: bigint;
    segments: SegmentData[];
    uninitializedOnchainState: boolean;
}): string {
    const initialStateHashes = encodeInitialStatesToBytes32(
        submissionData.segments.map((x) => x.initial_states),
        submissionData.segments[submissionData.segments.length - 1].final_state,
        submissionData.uninitializedOnchainState
    );
    const playerActionHashes = encodePlayerActionToBytes32(
        submissionData.segments.map((x) => x.player_action_inputs)
    );
    
    return ethers.sha256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256", "uint256", "bytes32[]", "bytes32[]"],
            [submissionData.game_id, submissionData.submission_nonce, initialStateHashes, playerActionHashes]
        )
    );
}

export async function getImageCommitmentBigInts(cloudCredentials: ProveCredentials): Promise<bigint[]> {
    const helper = new ZkWasmServiceHelper(cloudCredentials.CLOUD_RPC_URL, "", "");
    const imageInfo = await helper.queryImage(cloudCredentials.IMAGE_HASH);
    
    if (!imageInfo || !imageInfo.checksum) {
        throw new Error(`Image not found: ${cloudCredentials.IMAGE_HASH}`);
    }
    
    const { x, y } = imageInfo.checksum;
    return commitmentUint8ArrayToVerifyInstanceBigInts(x, y);
}

// Helper functions for ZKProver
function commitmentHexToHexString(x: string, y: string): string[] {
    const hexString1 = "0x" + x.slice(12, 66);
    const hexString2 = "0x" + y.slice(39) + "00000000000000000" + x.slice(2, 12);
    const hexString3 = "0x" + y.slice(2, 39);
    return [hexString1, hexString2, hexString3];
}

function commitmentUint8ArrayToVerifyInstanceBigInts(xUint8Array: Uint8Array, yUint8Array: Uint8Array): bigint[] {
    const xHexString = ZkWasmUtil.bytesToHexStrings(xUint8Array);
    const yHexString = ZkWasmUtil.bytesToHexStrings(yUint8Array);
    const verifyInstances = commitmentHexToHexString(
        "0x" + xHexString[0].slice(2).padStart(64, "0"),
        "0x" + yHexString[0].slice(2).padStart(64, "0")
    );
    const verifyingBytes = ZkWasmUtil.hexStringsToBytes(verifyInstances, 32);
    const verifyingBigInts = ZkWasmUtil.bytesToBigIntArray(verifyingBytes);
    return verifyingBigInts.map((v: number | bigint) => BigInt(v.toString()));
}

// ZKProver class
export class ZKProver {
    private cloudCredentials: ProveCredentials;
    private zkwasmHelper: ZkWasmServiceHelper;

    constructor(cloudCredentials: ProveCredentials) {
        this.cloudCredentials = cloudCredentials;
        this.zkwasmHelper = new ZkWasmServiceHelper(cloudCredentials.CLOUD_RPC_URL, "", "");
    }

    public async prove(inputs: string[], witness: string[]): Promise<{
        proof: bigint[];
        verify_instance: bigint[];
        aux: bigint[];
        instances: bigint[];
        status: string;
    } | null> {
        const taskInfo = await this.add_proving_taks(inputs, witness);
        const task_id = taskInfo.id;
        return this.load_proving_taks_util_result(task_id);
    }

    private async _add_proving_taks(inputs: string[], witness: string[]) {
        const info = {
            user_address: this.cloudCredentials.USER_ADDRESS,
            md5: this.cloudCredentials.IMAGE_HASH,
            public_inputs: inputs,
            private_inputs: witness,
            proof_submit_mode: ProofSubmitMode.Manual,
        };
        
        const msgString = ZkWasmUtil.createProvingSignMessage(info);
        const signature = await ZkWasmUtil.signMessage(
            msgString,
            this.cloudCredentials.USER_PRIVATE_KEY
        );
        
        return this.zkwasmHelper.addProvingTask({
            ...info,
            signature: signature,
        });
    }

    private async load_proving_taks_util_result(
        task_id: string,
        retry_interval = 10000
    ) {
        let INITIAL_RETRY_INTERVAL = 50000;
        let init_flag = true;
        
        while (true) {
            const result = await this.load_proving_taks(task_id);
            if (!result) continue;
            
            if (result.status === "Done") {
                return result;
            }
            
            if (!["Pending", "Processing", "DryRunSuccess"].includes(result.status)) {
                throw new Error(`Proof generation failed, ${result.status}`);
            }
            
            const sleep_time = init_flag ? INITIAL_RETRY_INTERVAL : retry_interval;
            init_flag = false;
            
            console.log(`waiting for proof generation... sleeping for ${sleep_time}ms`);
            await new Promise((resolve) => setTimeout(resolve, sleep_time));
        }
    }

    public async load_proving_taks(task_id: string) {
        const query = {
            md5: this.cloudCredentials.IMAGE_HASH,
            id: task_id,
            user_address: this.cloudCredentials.USER_ADDRESS,
            tasktype: "Prove",
            taskstatus: "",
        };
        
        const tasksInfo = (await this.zkwasmHelper.loadTasks(query)).data;
        if (!tasksInfo?.length) return null;
        
        const task = tasksInfo[0];
        return {
            proof: ZkWasmUtil.bytesToBigIntArray(task.proof).map((v: number | bigint) => BigInt(v.toString())),
            verify_instance: ZkWasmUtil.bytesToBigIntArray(task.shadow_instances).map((v: number | bigint) => BigInt(v.toString())),
            aux: ZkWasmUtil.bytesToBigIntArray(task.aux).map((v: number | bigint) => BigInt(v.toString())),
            instances: ZkWasmUtil.bytesToBigIntArray(task.instances).map((v: number | bigint) => BigInt(v.toString())),
            status: task.status,
        };
    }

    public async add_proving_taks(inputs: string[], witness: string[]): Promise<any> {
        return this.asyncErrorHandler(this._add_proving_taks.bind(this))(inputs, witness);
    }

    private asyncErrorHandler<T extends Array<any>, U>(
        fn: (...args: T) => Promise<U>
    ): (...args: T) => Promise<U> {
        return async (...args: T) => {
            let retryCount = 0;
            while (retryCount < 3) {
                try {
                    return await fn(...args);
                } catch (error: any) {
                    if ((error.response?.status === 429) ||
                        error.code === 429 ||
                        error.message.includes("Too many requests")
                    ) {
                        console.log(`Caught 429 error. Retrying in 5 seconds...`);
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                        retryCount++;
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error("Too many retries");
        };
    }
}

export async function getImageCommitmentHexStrings(cloudCredentials: ProveCredentials): Promise<string[]> {
    const helper = new ZkWasmServiceHelper(cloudCredentials.CLOUD_RPC_URL, "", "");
    const imageInfo = await helper.queryImage(cloudCredentials.IMAGE_HASH);
    
    if (!imageInfo || !imageInfo.checksum) {
        throw new Error(`Image not found: ${cloudCredentials.IMAGE_HASH}`);
    }
    
    const { x, y } = imageInfo.checksum;cloudCredentials
    const xHexString = ZkWasmUtil.bytesToHexStrings(x);
    const yHexString = ZkWasmUtil.bytesToHexStrings(y);
    
    return commitmentHexToHexString(
        "0x" + xHexString[0].slice(2).padStart(64, "0"),
        "0x" + yHexString[0].slice(2).padStart(64, "0")
    );
}