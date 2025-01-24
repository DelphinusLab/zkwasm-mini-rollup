import { queryImage } from "./settle.js";
import { ServiceHelper } from "./config.js";
import { getTaskWithMD5 } from "./settle.js";
import { U8ArrayUtil } from './lib.js';
import { Image } from "zkwasm-service-helper";

async function testQueryImage() {
    const md5 = "705D9EDF2732971F9580FA74C3329E1A";
    
    console.log("Testing queryImage with MD5:", md5);
    
    try {
        // 查询镜像
        const result = await queryImage(md5);
        console.log("Query result:", result);

        // 类型断言，因为我们从实际结果看到确实有这个字段
        const imageResult = result as Image & { proof_task_id?: string };
        
        if (imageResult.proof_task_id) {
            console.log("Proof task ID:", imageResult.proof_task_id);
            
            // 使用 getTask 获取任务信息
            const task = await getTaskWithMD5(imageResult.proof_task_id, md5, "Done");
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
    } catch (error) {
        console.error("Test failed:", error);
    }
}

// 运行测试
testQueryImage().catch(console.error); 