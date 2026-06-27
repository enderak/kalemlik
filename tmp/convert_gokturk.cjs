const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

const nameToChar = {
  "space": " ",
  "exclam": "!",
  "quotedbl": "\"",
  "numbersign": "#",
  "dollar": "$",
  "percent": "%",
  "ampersand": "&",
  "quotesingle": "'",
  "parenleft": "(",
  "parenright": ")",
  "asterisk": "*",
  "plus": "+",
  "comma": ",",
  "hyphen": "-",
  "period": ".",
  "slash": "/",
  "zero": "0",
  "one": "1",
  "two": "2",
  "three": "3",
  "four": "4",
  "five": "5",
  "six": "6",
  "seven": "7",
  "eight": "8",
  "nine": "9",
  "colon": ":",
  "semicolon": ";",
  "less": "<",
  "equal": "=",
  "greater": ">",
  "question": "?",
  "at": "@",
  "bracketleft": "[",
  "backslash": "\\",
  "bracketright": "]",
  "asciicircum": "^",
  "underscore": "_",
  "grave": "`",
  "braceleft": "{",
  "bar": "|",
  "braceright": "}",
  "asciitilde": "~",
  "ccedilla": "ç",
  "Ccedilla": "Ç",
  "gbreve": "ğ",
  "Gbreve": "Ğ",
  "odieresis": "ö",
  "Odieresis": "Ö",
  "scedilla": "ş",
  "Scedilla": "Ş",
  "udieresis": "ü",
  "Udieresis": "Ü",
  "Adieresis": "Ä",
  "adieresis": "ä",
  "Idotaccent": "İ",
  "dotlessi": "ı",
  "percent": "%"
};

function convertGokturk(inputPath, outputPath) {
  console.log(`Converting Gokturk font ${inputPath} to ${outputPath}...`);
  try {
    const buffer = fs.readFileSync(inputPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const font = opentype.parse(arrayBuffer);
    const glyphs = {};

    let mappedCount = 0;
    for (let i = 0; i < font.numGlyphs; i++) {
      const glyph = font.glyphs.get(i);
      let char = null;

      // 1. If opentype has unicode, use it
      if (glyph.unicode !== undefined) {
        char = String.fromCharCode(glyph.unicode);
      } 
      // 2. Otherwise try name mapping
      else if (glyph.name) {
        if (glyph.name.length === 1) {
          char = glyph.name;
        } else if (nameToChar[glyph.name] !== undefined) {
          char = nameToChar[glyph.name];
        }
      }

      if (char !== null) {
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
        mappedCount++;
      }
    }

    const familyName = "Gokturk";

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
    console.log(`Success! Extracted ${mappedCount} glyphs. Mapped keys: ${Object.keys(glyphs).length}`);
  } catch (err) {
    console.error(`Error converting font:`, err);
  }
}

convertGokturk('gokturk.ttf', 'public/fonts/gokturk.json');
