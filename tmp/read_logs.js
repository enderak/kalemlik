import fs from 'fs';
import readline from 'readline';

const LOG_PATH = 'C:/Users/Ender/.gemini/antigravity/brain/bfb7bca2-16b4-492a-87d6-270bfb4754ab/.system_generated/logs/transcript.jsonl';

async function searchLogs() {
  if (!fs.existsSync(LOG_PATH)) {
    console.error('Log file not found at:', LOG_PATH);
    return;
  }

  const fileStream = fs.createReadStream(LOG_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (line.toLowerCase().includes('segoescript.json')) {
      console.log(`Line ${lineNumber}:`);
      // Try to parse as JSON and print tool_calls or content
      try {
        const obj = JSON.parse(line);
        console.log('Type:', obj.type);
        if (obj.tool_calls) {
          console.log('Tool Calls:', JSON.stringify(obj.tool_calls, null, 2));
        } else if (obj.content) {
          console.log('Content snippet:', obj.content.substring(0, 500));
        } else {
          console.log('Line snippet:', line.substring(0, 300));
        }
      } catch (err) {
        console.log('Snippet:', line.substring(0, 300));
      }
      console.log('--------------------------------------------------');
    }
  }
}

searchLogs();
