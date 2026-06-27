import fs from 'fs';
import https from 'https';
import path from 'path';
import opentype from 'opentype.js';

const FONT_URL = 'https://raw.githubusercontent.com/BootleggersROM/vendor_shishufied/tirimbino/prebuilt/fontagev2/din1451alt.ttf';
const TTF_PATH = 'tmp/din1451alt.ttf';
const JSON_PATH = 'public/fonts/DIN1451.json';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download font: status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function convertFont() {
  try {
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp', { recursive: true });
    }
    
    console.log(`Downloading font from ${FONT_URL}...`);
    await downloadFile(FONT_URL, TTF_PATH);
    console.log('Font downloaded successfully.');

    console.log('Parsing font using opentype.js...');
    const font = opentype.loadSync(TTF_PATH);

    const result = {
      glyphs: {},
      familyName: font.names.fontFamily.en || 'DIN 1451 Mittelschrift',
      ascender: font.ascender,
      descender: font.descender,
      underlineThickness: font.tables.post.underlineThickness || 50,
      underlinePosition: font.tables.post.underlinePosition || -100,
      boundingBox: {
        yMin: font.tables.head.yMin,
        xMin: font.tables.head.xMin,
        yMax: font.tables.head.yMax,
        xMax: font.tables.head.xMax
      },
      resolution: font.unitsPerEm,
      original_font_information: font.names
    };

    console.log(`Processing glyphs... (Total: ${font.glyphs.length})`);
    
    for (let i = 0; i < font.glyphs.length; i++) {
      const glyph = font.glyphs.get(i);
      
      // We process both unicode characters and glyph name (for compatibility)
      let charKey = null;
      if (glyph.unicode) {
        charKey = String.fromCharCode(glyph.unicode);
      } else if (glyph.name) {
        // Fallback or special glyphs
        continue;
      }

      if (!charKey) continue;

      const pathObj = glyph.path;
      const parts = [];
      for (const cmd of pathObj.commands) {
        switch (cmd.type) {
          case 'M':
            parts.push(`m ${Math.round(cmd.x)} ${Math.round(cmd.y)}`);
            break;
          case 'L':
            parts.push(`l ${Math.round(cmd.x)} ${Math.round(cmd.y)}`);
            break;
          case 'Q':
            parts.push(`q ${Math.round(cmd.x1)} ${Math.round(cmd.y1)} ${Math.round(cmd.x)} ${Math.round(cmd.y)}`);
            break;
          case 'C':
            parts.push(`c ${Math.round(cmd.x1)} ${Math.round(cmd.y1)} ${Math.round(cmd.x2)} ${Math.round(cmd.y2)} ${Math.round(cmd.x)} ${Math.round(cmd.y)}`);
            break;
          case 'Z':
            parts.push('z');
            break;
        }
      }

      result.glyphs[charKey] = {
        ha: Math.round(glyph.advanceWidth),
        o: parts.join(' ')
      };
    }

    console.log(`Writing typeface JSON to ${JSON_PATH}...`);
    fs.writeFileSync(JSON_PATH, JSON.stringify(result));
    console.log('Font converted and saved successfully!');

  } catch (error) {
    console.error('Error during font conversion:', error);
  }
}

convertFont();
