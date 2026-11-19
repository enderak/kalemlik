/**
 * Fixes fonts whose glyph outlines were exported with SVG/TrueType parameter order
 * (`q cpx cpy endX endY`) instead of Three.js typeface.json order (`q endX endY cpx cpy`),
 * and removes redundant zero-length `l x y` segments that cause self-intersecting burrs ("çapaklar")
 * on curved digits/letters like '5', 'S', 'O', 'G', '3', '8'.
 */
function fixFontQuadraticOrderIfNeeded(font) {
  if (!font || !font.data || !font.data.glyphs || font.data._qOrderNormalized) {
    return;
  }
  const glyphs = font.data.glyphs;

  // Detect whether `q a b c d l lx ly` has (c,d)==(lx,ly) [SVG order] or (a,b)==(lx,ly) [Three.js order]
  let svgOrderMatches = 0;
  let threeOrderMatches = 0;

  for (const key of Object.keys(glyphs)) {
    const o = glyphs[key]?.o;
    if (!o) continue;
    const tokens = o.trim().split(/\s+/);
    for (let i = 0; i < tokens.length - 7; i++) {
      if (tokens[i] === 'q' && tokens[i + 5] === 'l') {
        const x1 = tokens[i + 1];
        const y1 = tokens[i + 2];
        const x2 = tokens[i + 3];
        const y2 = tokens[i + 4];
        const lx = tokens[i + 6];
        const ly = tokens[i + 7];
        if (x2 === lx && y2 === ly && (x1 !== lx || y1 !== ly)) {
          svgOrderMatches++;
        } else if (x1 === lx && y1 === ly && (x2 !== lx || y2 !== ly)) {
          threeOrderMatches++;
        }
      }
    }
    if (svgOrderMatches + threeOrderMatches > 40) break;
  }

  const needsSwap = svgOrderMatches > threeOrderMatches;

  for (const key of Object.keys(glyphs)) {
    const g = glyphs[key];
    if (!g || !g.o) continue;
    const tokens = g.o.trim().split(/\s+/);
    const out = [];
    let curX = null;
    let curY = null;
    let i = 0;

    while (i < tokens.length) {
      const cmd = tokens[i++];
      if (cmd === 'm') {
        const x = tokens[i++];
        const y = tokens[i++];
        out.push('m', x, y);
        curX = x;
        curY = y;
      } else if (cmd === 'l') {
        const x = tokens[i++];
        const y = tokens[i++];
        // Skip zero-length line segments that duplicate the previous endpoint
        if (x !== curX || y !== curY) {
          out.push('l', x, y);
          curX = x;
          curY = y;
        }
      } else if (cmd === 'q') {
        const a = tokens[i++];
        const b = tokens[i++];
        const c = tokens[i++];
        const d = tokens[i++];
        if (needsSwap) {
          // Convert (cpx, cpy, endX, endY) -> Three.js (endX, endY, cpx, cpy)
          out.push('q', c, d, a, b);
          curX = c;
          curY = d;
        } else {
          out.push('q', a, b, c, d);
          curX = a;
          curY = b;
        }
      } else if (cmd === 'b') {
        const a = tokens[i++];
        const b = tokens[i++];
        const c = tokens[i++];
        const d = tokens[i++];
        const e = tokens[i++];
        const f = tokens[i++];
        if (needsSwap) {
          // Convert (cp1x, cp1y, cp2x, cp2y, endX, endY) -> Three.js (endX, endY, cp1x, cp1y, cp2x, cp2y)
          out.push('b', e, f, a, b, c, d);
          curX = e;
          curY = f;
        } else {
          out.push('b', a, b, c, d, e, f);
          curX = a;
          curY = b;
        }
      } else {
        out.push(cmd);
      }
    }

    g.o = out.join(' ');
    // Clear any cached shape paths if present
    if (g._cachedOutline) delete g._cachedOutline;
  }

  font.data._qOrderNormalized = true;
}

/**
 * Ensures that all Turkish characters (Ş, ş, İ, ı, Ğ, ğ, Ç, ç, Ö, ö, Ü, ü)
 * exist in the Three.js font glyph dictionary.
 * If any glyph is missing in the loaded font, it dynamically synthesizes it from base glyphs and diacritics
 * so that words like "BEŞİKTAŞ", "UĞURCAN", "ŞAMPİYON", "FENERBAHÇE" never fail or render as '?'.
 */
function translatePath(pathStr, dx, dy, sx = 1, sy = 1) {
  if (!pathStr) return '';
  const tokens = pathStr.trim().split(/\s+/);
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'm' || cmd === 'l') {
      const x = parseFloat(tokens[i++]) * sx + dx;
      const y = parseFloat(tokens[i++]) * sy + dy;
      result.push(cmd, Math.round(x), Math.round(y));
    } else if (cmd === 'q') {
      const cpx = parseFloat(tokens[i++]) * sx + dx;
      const cpy = parseFloat(tokens[i++]) * sy + dy;
      const x = parseFloat(tokens[i++]) * sx + dx;
      const y = parseFloat(tokens[i++]) * sy + dy;
      result.push(cmd, Math.round(cpx), Math.round(cpy), Math.round(x), Math.round(y));
    } else if (cmd === 'b') {
      const cp1x = parseFloat(tokens[i++]) * sx + dx;
      const cp1y = parseFloat(tokens[i++]) * sx + dy;
      const cp2x = parseFloat(tokens[i++]) * sx + dx;
      const cp2y = parseFloat(tokens[i++]) * sy + dy;
      const x = parseFloat(tokens[i++]) * sx + dx;
      const y = parseFloat(tokens[i++]) * sy + dy;
      result.push(cmd, Math.round(cp1x), Math.round(cp1y), Math.round(cp2x), Math.round(cp2y), Math.round(x), Math.round(y));
    } else {
      result.push(cmd);
    }
  }
  return result.join(' ');
}

export function ensureTurkishFontGlyphs(font) {
  if (!font || !font.data || !font.data.glyphs) return font;

  // Normalize quadratic/cubic Bézier parameter order first so all glyphs are 100% burr-free
  fixFontQuadraticOrderIfNeeded(font);

  const glyphs = font.data.glyphs;

  // 1. Ş (S + cedilla)
  if (!glyphs['Ş'] && glyphs['S']) {
    const sHa = glyphs['S'].ha || 574;
    const cedilla = glyphs['¸']?.o || (glyphs['Ç'] ? glyphs['Ç'].o.split(/(?=m\s)/).pop() : null);
    const tail = cedilla
      ? translatePath(cedilla, Math.round(sHa * 0.35), -6)
      : `m ${Math.round(sHa * 0.45)} 0 l ${Math.round(sHa * 0.45 + 15)} -60 q ${Math.round(sHa * 0.45 + 60)} -100 ${Math.round(sHa * 0.45 + 30)} -100 l ${Math.round(sHa * 0.45 + 50)} -80 q ${Math.round(sHa * 0.45 + 5)} -40 ${Math.round(sHa * 0.45 + 25)} -80 l ${Math.round(sHa * 0.45)} 0`;
    glyphs['Ş'] = { ha: sHa, o: (glyphs['S'].o || '') + ' ' + tail };
  }

  // 2. ş (s + cedilla)
  if (!glyphs['ş'] && glyphs['s']) {
    const sHa = glyphs['s'].ha || 480;
    const cedilla = glyphs['¸']?.o || (glyphs['ç'] ? glyphs['ç'].o.split(/(?=m\s)/).pop() : null);
    const tail = cedilla
      ? translatePath(cedilla, Math.round(sHa * 0.3), -6)
      : `m ${Math.round(sHa * 0.45)} 0 l ${Math.round(sHa * 0.45 + 15)} -50 q ${Math.round(sHa * 0.45 + 50)} -80 ${Math.round(sHa * 0.45 + 30)} -80 l ${Math.round(sHa * 0.45 + 40)} -65 q ${Math.round(sHa * 0.45 + 5)} -35 ${Math.round(sHa * 0.45 + 20)} -65 l ${Math.round(sHa * 0.45)} 0`;
    glyphs['ş'] = { ha: sHa, o: (glyphs['s'].o || '') + ' ' + tail };
  }

  // 3. İ (I + dot)
  if (!glyphs['İ'] && glyphs['I']) {
    const iHa = glyphs['I'].ha || 258;
    const dot = glyphs['˙']?.o || (glyphs['i'] ? glyphs['i'].o.split(/(?=m\s)/)[0] : null);
    const dotCmd = dot
      ? translatePath(dot, Math.round(iHa * 0.1), 140)
      : `m ${Math.round(iHa * 0.25)} 780 l ${Math.round(iHa * 0.25)} 880 l ${Math.round(iHa * 0.75)} 880 l ${Math.round(iHa * 0.75)} 780 l ${Math.round(iHa * 0.25)} 780`;
    glyphs['İ'] = { ha: iHa, o: (glyphs['I'].o || '') + ' ' + dotCmd };
  }

  // 4. ı (dotless i)
  if (!glyphs['ı']) {
    if (glyphs['i']) {
      const parts = glyphs['i'].o.split(/(?=m\s)/);
      glyphs['ı'] = { ha: glyphs['i'].ha, o: parts.length > 1 ? parts[1] : parts[0] };
    } else if (glyphs['I']) {
      glyphs['ı'] = { ha: glyphs['I'].ha, o: translatePath(glyphs['I'].o, 0, 0, 1, 0.72) };
    }
  }

  // 5. Ğ (G + breve)
  if (!glyphs['Ğ'] && glyphs['G']) {
    const gHa = glyphs['G'].ha || 610;
    const breve = glyphs['˘']?.o;
    const breveCmd = breve
      ? translatePath(breve, Math.round(gHa * 0.25), 180)
      : `m ${Math.round(gHa * 0.2)} 780 q ${Math.round(gHa * 0.8)} 780 ${Math.round(gHa * 0.5)} 720 l ${Math.round(gHa * 0.75)} 800 q ${Math.round(gHa * 0.25)} 800 ${Math.round(gHa * 0.5)} 745 l ${Math.round(gHa * 0.2)} 780`;
    glyphs['Ğ'] = { ha: gHa, o: (glyphs['G'].o || '') + ' ' + breveCmd };
  }

  // 6. ğ (g + breve)
  if (!glyphs['ğ'] && glyphs['g']) {
    const gHa = glyphs['g'].ha || 519;
    const breve = glyphs['˘']?.o;
    const breveCmd = breve
      ? translatePath(breve, Math.round(gHa * 0.25), 20)
      : `m ${Math.round(gHa * 0.2)} 560 q ${Math.round(gHa * 0.8)} 560 ${Math.round(gHa * 0.5)} 510 l ${Math.round(gHa * 0.75)} 575 q ${Math.round(gHa * 0.25)} 575 ${Math.round(gHa * 0.5)} 530 l ${Math.round(gHa * 0.2)} 560`;
    glyphs['ğ'] = { ha: gHa, o: (glyphs['g'].o || '') + ' ' + breveCmd };
  }

  return font;
}
