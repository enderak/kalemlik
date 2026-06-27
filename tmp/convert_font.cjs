const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

function convertFont(inputPath, outputPath) {
  console.log(`Converting ${inputPath} to ${outputPath}...`);
  try {
    const buffer = fs.readFileSync(inputPath);
    // Convert Node Buffer to ArrayBuffer
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const font = opentype.parse(arrayBuffer);
    const glyphs = {};

    for (let i = 0; i < font.numGlyphs; i++) {
      const glyph = font.glyphs.get(i);
      // Ensure we have a valid unicode code point
      if (glyph.unicode !== undefined) {
        const char = String.fromCharCode(glyph.unicode);
        const pathObj = glyph.getPath(0, 0, font.unitsPerEm);
        
        let o = '';
        pathObj.commands.forEach(cmd => {
          if (cmd.type === 'M') {
            o += `m ${Math.round(cmd.x)} ${Math.round(-cmd.y)} `;
          } else if (cmd.type === 'L') {
            o += `l ${Math.round(cmd.x)} ${Math.round(-cmd.y)} `;
          } else if (cmd.type === 'Q') {
            o += `q ${Math.round(cmd.x1)} ${Math.round(-cmd.y1)} ${Math.round(cmd.x)} ${Math.round(-cmd.y)} `;
          } else if (cmd.type === 'C') {
            o += `c ${Math.round(cmd.x1)} ${Math.round(-cmd.y1)} ${Math.round(cmd.x2)} ${Math.round(-cmd.y2)} ${Math.round(cmd.x)} ${Math.round(-cmd.y)} `;
          } else if (cmd.type === 'Z') {
            o += 'z ';
          }
        });

        glyphs[char] = {
          ha: Math.round(glyph.advanceWidth),
          o: o.trim()
        };
      }
    }

    // Safely extract family name
    const familyNameObj = font.names.fontFamily;
    const familyName = familyNameObj 
      ? (familyNameObj.en || Object.values(familyNameObj)[0]) 
      : path.basename(inputPath, path.extname(inputPath));

    const typeface = {
      glyphs: glyphs,
      familyName: familyName,
      ascender: Math.round(font.ascender),
      descender: Math.round(font.descender),
      underlinePosition: Math.round(font.tables.post.underlinePosition || -100),
      underlineThickness: Math.round(font.tables.post.underlineThickness || 50),
      boundingBox: {
        yMin: Math.round(font.tables.head.yMin),
        xMin: Math.round(font.tables.head.xMin),
        yMax: Math.round(font.tables.head.yMax),
        xMax: Math.round(font.tables.head.xMax)
      },
      resolution: font.unitsPerEm,
      original_font_information: font.names
    };

    fs.writeFileSync(outputPath, JSON.stringify(typeface, null, 2), 'utf8');
    console.log(`Success! Extracted ${Object.keys(glyphs).length} glyphs.`);
  } catch (err) {
    console.error(`Error converting font:`, err);
  }
}

// Get arguments
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.log('Usage: node convert_font.cjs <input.ttf> <output.json>');
  process.exit(1);
}

convertFont(input, output);
