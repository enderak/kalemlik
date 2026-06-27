const opentype = require('opentype.js');
const fs = require('fs');

try {
  const buffer = fs.readFileSync('gokturk.ttf');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const font = opentype.parse(arrayBuffer);
  
  console.log('Number of glyphs:', font.numGlyphs);
  console.log('Font family name:', font.names.fontFamily);
  
  const sampleGlyphs = [];
  for (let i = 0; i < font.numGlyphs; i++) {
    const glyph = font.glyphs.get(i);
    sampleGlyphs.push({
      index: i,
      name: glyph.name,
      unicode: glyph.unicode,
      unicodes: glyph.unicodes
    });
  }
  
  console.log('Sample glyphs (all):');
  console.log(JSON.stringify(sampleGlyphs, null, 2));
} catch (err) {
  console.error('Error:', err);
}
