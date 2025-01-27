
import { getTaskByStateAndImage } from "./settle.js";
import { U8ArrayUtil } from './lib.js';

async function testQueryImage() {
    const md5 = "44C30F5C676F2D460BFC5577A1E4AEC8";
    
    console.log("Testing queryImage with MD5:", md5);
            
            // 使用 getTask 获取任务信息
    const task = await getTaskByStateAndImage(md5, "Done");
    console.log("Task info:", task);
    // 从 instances 中获取 merkle root
    if (task && task.instances) {
        const instances = new U8ArrayUtil(task.instances).toNumber();
        // instances[0-3] represent the old root in 64-bit chunks
        const merkleRoot = (BigInt(instances[0]) << 192n) +
                            (BigInt(instances[1]) << 128n) +
                            (BigInt(instances[2]) << 64n) +
                            BigInt(instances[3]);
        
        console.log("Merkle root:", merkleRoot.toString());
    }
        
}

// 运行测试
testQueryImage().catch(console.error); 