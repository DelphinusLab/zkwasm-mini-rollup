import { ZkWasmServiceHelper, ZkWasmUtil } from "zkwasm-service-helper";

export const endpoint = "https://rpc.zkwasmhub.com:443";

export function commitmentHexToHexString(x: string, y: string): string[] {
    const hexString1 = "0x" + x.slice(12, 66);
    const hexString2 = "0x" + y.slice(39) + "00000000000000000" + x.slice(2, 12);
    const hexString3 = "0x" + y.slice(2, 39);
    return [hexString1, hexString2, hexString3];
}


export async function getImageCommitmentHexStrings(imageHash: string): Promise<string[]> {
    const helper = new ZkWasmServiceHelper(endpoint, "", "");
    const imageInfo = await helper.queryImage(imageHash);
    
    if (!imageInfo || !imageInfo.checksum) {
        throw new Error(`Image not found: ${imageHash}`);
    }
    
    const { x, y } = imageInfo.checksum;
    const xHexString = ZkWasmUtil.bytesToHexStrings(x);
    const yHexString = ZkWasmUtil.bytesToHexStrings(y);
    
    return commitmentHexToHexString(
        "0x" + xHexString[0].slice(2).padStart(64, "0"),
        "0x" + yHexString[0].slice(2).padStart(64, "0")
    );
}
