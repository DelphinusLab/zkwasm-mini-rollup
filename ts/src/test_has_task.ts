import { ZkWasmServiceHelper } from 'zkwasm-service-helper';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = "https://rpc.zkwasmhub.com:443";

//usage: npm run test:task <MD5>
//or: IMAGE=<MD5> npm run test:task
//or: node src/test_has_task.ts <MD5>
//or: IMAGE=<MD5> node src/test_has_task.ts

/**
 * Test has_task functionality with a given MD5
 * @param md5 - The image MD5 to check for tasks
 * @returns boolean - true if tasks exist, false otherwise
 */
async function testHasTask(md5: string): Promise<boolean> {
  if (md5 === "unspecified" || !md5) {
    console.log("❌ MD5 is unspecified or empty");
    return false;
  }

  console.log(`\n🔍 Testing has_task for MD5: ${md5}`);
  console.log(`📡 Endpoint: ${endpoint}\n`);

  const helper = new ZkWasmServiceHelper(endpoint, "", "");

  // Check for successfully completed tasks (Done status)
  // This matches the logic in prover.ts has_task() function
  // This excludes failed tasks like DryRunFailed, Fail, Unprovable, Stale
  let query = {
    md5: md5,
    user_address: null,
    id: null,
    tasktype: "Prove",
    taskstatus: "Done",
    total: 1,
  };

  try {
    console.log("⏳ Querying ZkWasm service...");
    let tasks = await helper.loadTasks(query);

    console.log("\n📊 Query Result:");
    console.log("─".repeat(50));
    console.log(`Total tasks found: ${tasks.data.length}`);

    if (tasks.data.length > 0) {
      console.log(`\n✅ Tasks exist for MD5: ${md5}\n`);

      // Display detailed information about tasks
      console.log("📝 Task Details:");
      console.log("─".repeat(50));
      tasks.data.forEach((task, index) => {
        console.log(`\nTask #${index + 1}:`);
        console.log(`  ID: ${task._id}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Type: ${task.task_type}`);
        console.log(`  MD5: ${task.md5}`);
        if (task.user_address) {
          console.log(`  User Address: ${task.user_address}`);
        }
        if (task.submit_time) {
          console.log(`  Submit Time: ${new Date(task.submit_time).toLocaleString()}`);
        }
        if (task.process_started) {
          console.log(`  Process Started: ${new Date(task.process_started).toLocaleString()}`);
        }
        if (task.process_finished) {
          console.log(`  Process Finished: ${new Date(task.process_finished).toLocaleString()}`);
        }
      });

      return true;
    } else {
      console.log(`\n❌ No tasks found for MD5: ${md5}\n`);
      return false;
    }
  } catch (error) {
    console.error("\n❌ Error querying ZkWasm service:");
    console.error(error);
    return false;
  }
}


// Main execution
async function main() {
  // Get MD5 from command line argument or environment variable
  const md5 = process.argv[2] || process.env.IMAGE || "unspecified";

  console.log("\n" + "=".repeat(60));
  console.log("🧪 ZkWasm Task Checker");
  console.log("=".repeat(60));

  if (md5 === "unspecified") {
    console.log("\n⚠️  No MD5 specified!");
    console.log("\nUsage:");
    console.log("  npm run test:task <MD5>");
    console.log("  or");
    console.log("  IMAGE=<MD5> npm run test:task");
    console.log("\nExample:");
    console.log("  npm run test:task abc123def456");
    console.log("  IMAGE=abc123def456 npm run test:task\n");
    process.exit(1);
  }

  // Test has_task functionality
  const hasTask = await testHasTask(md5);

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Final Result: ${hasTask ? "✅ Has Tasks (Done)" : "❌ No Tasks (Done)"}`);
  console.log("=".repeat(60) + "\n");

  process.exit(hasTask ? 0 : 1);
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
