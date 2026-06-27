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
    const lower = line.toLowerCase();
    if (lower.includes('write_to_file') && (lower.includes('fonts/') || lower.includes('fonts\\\\'))) {
      console.log(`Line ${lineNumber}:`);
      try {
        const obj = JSON.parse(line);
        console.log('Type:', obj.type);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            if (tc.name === 'write_to_file') {
              console.log('TargetFile:', tc.args.TargetFile);
              if (tc.args.CodeContent) {
                console.log('CodeContent length:', tc.args.CodeContent.length);
                console.log('CodeContent snippet:', tc.args.CodeContent.substring(0, 200));
              }
            }
          }
        }
      } catch (err) {
        console.log('Raw snippet:', line.substring(0, 300));
      }
      console.log('--------------------------------------------------');
    }
  }
}

searchLogs();
