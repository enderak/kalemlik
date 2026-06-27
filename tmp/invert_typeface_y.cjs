const fs = require('fs');
const path = require('path');

function invertTypefaceY(filePath) {
  console.log(`Inverting Y coordinates in ${filePath}...`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const typeface = JSON.parse(content);
    const glyphs = typeface.glyphs;
    let count = 0;

    for (const char in glyphs) {
      const glyph = glyphs[char];
      if (glyph && glyph.o) {
        const tokens = glyph.o.trim().split(/\s+/);
        let i = 0;
        while (i < tokens.length) {
          const cmd = tokens[i];
          if (cmd === 'm' || cmd === 'l') {
            // Negate Y
            if (i + 2 < tokens.length) {
              const yVal = parseFloat(tokens[i + 2]);
              tokens[i + 2] = String(-yVal);
            }
            i += 3;
          } else if (cmd === 'q') {
            // Negate Y1 and Y
            if (i + 2 < tokens.length) {
              const y1Val = parseFloat(tokens[i + 2]);
              tokens[i + 2] = String(-y1Val);
            }
            if (i + 4 < tokens.length) {
              const yVal = parseFloat(tokens[i + 4]);
              tokens[i + 4] = String(-yVal);
            }
            i += 5;
          } else if (cmd === 'c') {
            // Negate Y1, Y2, and Y
            if (i + 2 < tokens.length) {
              const y1Val = parseFloat(tokens[i + 2]);
              tokens[i + 2] = String(-y1Val);
            }
            if (i + 4 < tokens.length) {
              const y2Val = parseFloat(tokens[i + 4]);
              tokens[i + 4] = String(-y2Val);
            }
            if (i + 6 < tokens.length) {
              const yVal = parseFloat(tokens[i + 6]);
              tokens[i + 6] = String(-yVal);
            }
            i += 7;
          } else if (cmd === 'z') {
            i += 1;
          } else {
            // Unknown token, skip
            i += 1;
          }
        }
        glyph.o = tokens.join(' ');
        count++;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(typeface, null, 2), 'utf8');
    console.log(`Successfully inverted Y coordinates for ${count} glyphs in ${filePath}.`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

// Process command line args
const targetFile = process.argv[2];
if (!targetFile) {
  console.log("Usage: node invert_typeface_y.cjs <path_to_json_file>");
  process.exit(1);
}
invertTypefaceY(targetFile);
