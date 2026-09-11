import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';

const SEG = 48;

/* ============ TUGLA DOKUSU ============ */

function createBrickTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const bw = 48, bh = 20, mw = 3;
  ctx.fillStyle = '#c4a882';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#b8956e';
  const cols = Math.ceil(256 / (bw + mw));
  const rows = Math.ceil(256 / (bh + mw));
  for (let r = 0; r < rows; r++) {
    const ox = (r % 2) * (bw / 2);
    for (let c = 0; c < cols; c++) {
      const x = c * (bw + mw) + ox + mw / 2;
      const y = r * (bh + mw) + mw / 2;
      ctx.fillRect(x, y, bw, bh);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = 4;
  return t;
}

/* ============ SILINDIR GEOMETRY ============ */

function makeCylinderCupBody(outerR, innerR, height, bottomThick) {
  const hh = height / 2;
  const innerH = height - bottomThick;
  const outerTube = new THREE.CylinderGeometry(outerR, outerR, height, SEG, 1, true);
  outerTube.translate(0, hh, 0);
  const innerTube = new THREE.CylinderGeometry(innerR, innerR, innerH, SEG, 1, true);
  innerTube.translate(0, innerH / 2 + bottomThick, 0);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const bottom = new THREE.ExtrudeGeometry(shape, { depth: bottomThick, bevelEnabled: false });
  bottom.rotateX(-Math.PI / 2);
  return mergeGeoms([outerTube, innerTube, bottom]);
}

function makeCorniceGeom(outerR, topExt, height, seg) {
  const topR = outerR + topExt;
  const flareH = Math.min(topExt, height * 0.75);
  const pts = [
    new THREE.Vector2(outerR, 0),
    new THREE.Vector2(topR, 0),
    new THREE.Vector2(topR, -height + flareH),
    new THREE.Vector2(outerR, -height),
  ];
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

function makeCylinderBaseGeom(outerR, baseExt, baseH) {
  const r = outerR + baseExt;
  const g = new THREE.CylinderGeometry(r, r, baseH, SEG);
  g.translate(0, -baseH / 2, 0);
  g.computeVertexNormals();
  return g;
}

function makeCylinderCrenGeoms(outerR, innerR, height, numCren, crenH, crenWRatio) {
  const gapA = (Math.PI * 2) / numCren;
  const crenA = gapA * THREE.MathUtils.clamp(crenWRatio, 0.1, 0.95);
  const arcSegs = 6;
  const geoms = [];
  for (let i = 0; i < numCren; i++) {
    const a = i * gapA;
    const sA = a - crenA / 2 - Math.PI / 2;
    const eA = a + crenA / 2 - Math.PI / 2;
    const shape = new THREE.Shape();
    for (let j = 0; j <= arcSegs; j++) {
      const t = sA + (eA - sA) * (j / arcSegs);
      const x = outerR * Math.cos(t);
      const y = outerR * Math.sin(t);
      if (j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let j = arcSegs; j >= 0; j--) {
      const t = sA + (eA - sA) * (j / arcSegs);
      const x = innerR * Math.cos(t);
      const y = innerR * Math.sin(t);
      shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: crenH, bevelEnabled: false });
    g.translate(0, 0, height);
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    geoms.push(g);
  }
  return geoms;
}

/* ============ KARE GEOMETRY ============ */

function makeSquareCorniceGeom(outerSize, topExt, corniceH) {
  if (topExt <= 0 || corniceH <= 0) return null;
  const s = outerSize / 2;
  const sTop = s + topExt;
  const flareH = Math.min(topExt, corniceH * 0.75);
  const yBot = -corniceH;
  const yFlare = -corniceH + flareH;
  const yTop = 0;

  const vertices = [
    // Outer bottom: 0-3
    -s, yBot, s,
    s, yBot, s,
    s, yBot, -s,
    -s, yBot, -s,
    // Outer flare: 4-7
    -sTop, yFlare, sTop,
    sTop, yFlare, sTop,
    sTop, yFlare, -sTop,
    -sTop, yFlare, -sTop,
    // Outer top: 8-11
    -sTop, yTop, sTop,
    sTop, yTop, sTop,
    sTop, yTop, -sTop,
    -sTop, yTop, -sTop,
    // Inner top: 12-15
    -s, yTop, s,
    s, yTop, s,
    s, yTop, -s,
    -s, yTop, -s,
  ];

  const indices = [];
  const addQuad = (a, b, c, d) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // 45 deg chamfer flare
    addQuad(i, j, 4 + j, 4 + i);
    // Outer vertical band
    addQuad(4 + i, 4 + j, 8 + j, 8 + i);
    // Top flat rim
    addQuad(12 + i, 8 + i, 8 + j, 12 + j);
    // Inner vertical wall
    addQuad(12 + j, 12 + i, i, j);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function makeSquareBaseGeom(outerSize, baseExt, baseH, cornerR) {
  const s = outerSize / 2 + baseExt;
  const r = Math.min(cornerR, s);
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s).quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r).quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s).quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r).quadraticCurveTo(-s, -s, -s + r, -s);
  const g = new THREE.ExtrudeGeometry(shape, { depth: baseH, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -baseH, 0);
  g.computeVertexNormals();
  return g;
}

function makeSquareCrenGeoms(outerSize, wallThick, height, numCren, crenH, crenWRatio, topExt = 0) {
  const s = outerSize / 2;
  const sTop = s + (topExt > 0 ? topExt : 0);
  const sInner = s - wallThick;
  const parapetThick = sTop - sInner;
  const dCoping = Math.min(crenH * 0.4, parapetThick * 0.45, 4.0);

  const numMid = Math.max(1, Math.floor(numCren / 4));
  const rRatio = THREE.MathUtils.clamp(crenWRatio, 0.2, 0.85);

  const totalLen = 2 * sTop;
  let lCorner = Math.max((totalLen * rRatio) / (2 + numMid), parapetThick + 2.5);
  lCorner = Math.min(lCorner, sTop - 4);
  const remaining = totalLen - 2 * lCorner;
  const lMerlon = (remaining * rRatio) / numMid;
  const wGap = (remaining * (1 - rRatio)) / (numMid + 1);

  const geoms = [];

  // 1. Build L-Corner merlon at (+sTop, +sTop) with 45° coping chamfer
  const xOut = sTop, zOut = sTop;
  const xIn = sInner, zIn = sInner;
  const xEnd = sTop - lCorner, zEnd = sTop - lCorner;
  const xCh = sTop - dCoping, zCh = sTop - dCoping;
  const y0 = height;
  const y1 = height + crenH - dCoping;
  const y2 = height + crenH;

  const cornerVerts = [
    // Bottom (y0): 0..5
    xEnd, y0, zIn,    // 0
    xIn,  y0, zIn,    // 1
    xIn,  y0, zEnd,   // 2
    xOut, y0, zEnd,   // 3
    xOut, y0, zOut,   // 4
    xEnd, y0, zOut,   // 5
    // Top flat (y2): 6..11
    xEnd, y2, zIn,    // 6
    xIn,  y2, zIn,    // 7
    xIn,  y2, zEnd,   // 8
    xCh,  y2, zEnd,   // 9
    xCh,  y2, zCh,    // 10
    xEnd, y2, zCh,    // 11
    // Chamfer lower edge (y1): 12..14
    xEnd, y1, zOut,   // 12
    xOut, y1, zOut,   // 13
    xOut, y1, zEnd,   // 14
  ];

  const cornerIndices = [
    // Bottom (normal -Y):
    0, 1, 5,   1, 4, 5,   1, 3, 4,   1, 2, 3,
    // Top flat (normal +Y):
    6, 11, 7,  11, 10, 7, 7, 10, 8,  10, 9, 8,
    // Inner vertical face 1 (z = zIn, normal -Z):
    0, 6, 1,   1, 6, 7,
    // Inner vertical face 2 (x = xIn, normal -X):
    2, 1, 8,   1, 7, 8,
    // Gap end face 1 (x = xEnd, normal -X):
    0, 5, 6,   5, 11, 6,  5, 12, 11,
    // Gap end face 2 (z = zEnd, normal -Z):
    2, 8, 3,   3, 8, 9,   3, 9, 14,
    // Outer vertical face 1 (z = zOut, normal +Z):
    5, 4, 12,  4, 13, 12,
    // Outer vertical face 2 (x = xOut, normal +X):
    4, 3, 13,  3, 14, 13,
    // Chamfer face 1 (sloping along outer Z):
    11, 12, 10,  10, 12, 13,
    // Chamfer face 2 (sloping along outer X):
    10, 13, 9,   9, 13, 14,
  ];

  const baseCornerGeom = new THREE.BufferGeometry();
  baseCornerGeom.setAttribute('position', new THREE.Float32BufferAttribute(cornerVerts, 3));
  baseCornerGeom.setIndex(cornerIndices);
  baseCornerGeom.computeVertexNormals();

  for (let c = 0; c < 4; c++) {
    const angle = (c * Math.PI) / 2;
    const g = baseCornerGeom.clone();
    g.rotateY(angle);
    geoms.push(g);
  }

  // 2. Build intermediate straight merlons with 45° coping
  for (let k = 0; k < numMid; k++) {
    const xStart = -sTop + lCorner + (k + 1) * wGap + k * lMerlon;
    const xEndM = xStart + lMerlon;

    const midVerts = [
      xStart, y0, sInner,
      xStart, y0, sTop,
      xStart, y1, sTop,
      xStart, y2, sTop - dCoping,
      xStart, y2, sInner,
      xEndM,  y0, sInner,
      xEndM,  y0, sTop,
      xEndM,  y1, sTop,
      xEndM,  y2, sTop - dCoping,
      xEndM,  y2, sInner,
    ];

    const midIndices = [
      0, 1, 4,   1, 3, 4,   1, 2, 3,
      5, 9, 6,   6, 9, 8,   6, 8, 7,
      0, 5, 1,   1, 5, 6,
      1, 6, 2,   2, 6, 7,
      2, 7, 3,   3, 7, 8,
      3, 8, 4,   4, 8, 9,
      4, 9, 0,   0, 9, 5,
    ];

    const baseMidGeom = new THREE.BufferGeometry();
    baseMidGeom.setAttribute('position', new THREE.Float32BufferAttribute(midVerts, 3));
    baseMidGeom.setIndex(midIndices);
    baseMidGeom.computeVertexNormals();

    for (let c = 0; c < 4; c++) {
      const angle = (c * Math.PI) / 2;
      const g = baseMidGeom.clone();
      g.rotateY(angle);
      geoms.push(g);
    }
  }

  return geoms;
}

function makeSquareTowerGeoms(outerSize, height, towerR, towerH) {
  const s = outerSize / 2;
  const hh = height / 2;
  const positions = [
    [s, s],
    [-s, s],
    [-s, -s],
    [s, -s],
  ];
  return positions.map(([x, z]) => {
    const g = new THREE.CylinderGeometry(towerR, towerR, towerH, SEG, 1, true);
    g.translate(x, hh + towerH / 2, z);
    g.computeVertexNormals();
    return g;
  });
}

/* ============ 3D KABARTMALI TUGLA ============ */

function makeCylinderBrickGeoms(outerR, height, wallThick, brickDepth, brickW, brickH, gap) {
  const bricks = [];
  const rows = Math.floor(height / (brickH + gap));
  const circ = Math.PI * 2 * outerR;
  const cols = Math.floor(circ / (brickW + gap));
  const aStep = (Math.PI * 2) / cols;
  const brickRatio = brickW / (brickW + gap);
  const brickA = aStep * brickRatio;
  const arcSegs = 4;
  const centerR = outerR - wallThick * 0.25;
  const innerR = centerR - brickDepth / 2;
  const outerR_brick = centerR + brickDepth / 2;
  for (let r = 0; r < rows; r++) {
    const y = r * (brickH + gap);
    const off = (r % 2) * (aStep / 2);
    for (let c = 0; c < cols; c++) {
      const aCenter = c * aStep + off;
      const sA = aCenter - brickA / 2 - Math.PI / 2;
      const eA = aCenter + brickA / 2 - Math.PI / 2;
      const shape = new THREE.Shape();
      for (let j = 0; j <= arcSegs; j++) {
        const t = sA + (eA - sA) * (j / arcSegs);
        const x = outerR_brick * Math.cos(t);
        const y2 = outerR_brick * Math.sin(t);
        if (j === 0) shape.moveTo(x, y2); else shape.lineTo(x, y2);
      }
      for (let j = arcSegs; j >= 0; j--) {
        const t = sA + (eA - sA) * (j / arcSegs);
        const x = innerR * Math.cos(t);
        const y2 = innerR * Math.sin(t);
        shape.lineTo(x, y2);
      }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: brickH, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      g.computeVertexNormals();
      bricks.push(g);
    }
  }
  return bricks;
}

/* ============ AT RÖLYEF & ŞEKİL YARDIMCILARI ============ */

function getHorseShapes(w, h) {
  // Shape 1: Head
  const head = new THREE.Shape();
  head.moveTo(-w * 0.10, h * 0.47);
  head.quadraticCurveTo(-w * 0.13, h * 0.35, -w * 0.35, h * 0.29);
  head.quadraticCurveTo(-w * 0.39, h * 0.26, -w * 0.37, h * 0.23);
  head.lineTo(-w * 0.32, h * 0.19);
  head.quadraticCurveTo(-w * 0.28, h * 0.17, -w * 0.22, h * 0.18);
  head.quadraticCurveTo(-w * 0.16, h * 0.20, -w * 0.14, h * 0.22);
  head.quadraticCurveTo(-w * 0.08, h * 0.20, -w * 0.04, h * 0.21);
  head.quadraticCurveTo(w * 0.04, h * 0.25, w * 0.04, h * 0.29);
  head.quadraticCurveTo(w * 0.02, h * 0.37, 0, h * 0.42);
  head.closePath();

  // Shape 2: Throat
  const throat = new THREE.Shape();
  throat.moveTo(-w * 0.20, h * 0.15);
  throat.quadraticCurveTo(-w * 0.27, -h * 0.04, -w * 0.30, -h * 0.23);
  throat.lineTo(-w * 0.24, -h * 0.23);
  throat.quadraticCurveTo(-w * 0.21, -h * 0.04, -w * 0.14, h * 0.15);
  throat.closePath();

  // Shape 3: Slot 1
  const slot1 = new THREE.Shape();
  slot1.moveTo(w * 0.02, h * 0.12);
  slot1.quadraticCurveTo(w * 0.07, -h * 0.06, w * 0.12, -h * 0.23);
  slot1.lineTo(w * 0.16, -h * 0.23);
  slot1.quadraticCurveTo(w * 0.11, -h * 0.06, w * 0.06, h * 0.12);
  slot1.closePath();

  // Shape 4: Slot 2
  const slot2 = new THREE.Shape();
  slot2.moveTo(w * 0.09, h * 0.15);
  slot2.quadraticCurveTo(w * 0.14, -h * 0.02, w * 0.19, -h * 0.18);
  slot2.lineTo(w * 0.23, -h * 0.18);
  slot2.quadraticCurveTo(w * 0.18, -h * 0.02, w * 0.13, h * 0.15);
  slot2.closePath();

  // Shape 5: Slot 3
  const slot3 = new THREE.Shape();
  slot3.moveTo(w * 0.16, h * 0.18);
  slot3.quadraticCurveTo(w * 0.21, h * 0.03, w * 0.26, -h * 0.13);
  slot3.lineTo(w * 0.30, -h * 0.13);
  slot3.quadraticCurveTo(w * 0.25, h * 0.03, w * 0.20, h * 0.18);
  slot3.closePath();

  return [head, throat, slot1, slot2, slot3];
}

function makeHorseReliefGeom(w, h, depth) {
  const shapes = getHorseShapes(w, h);
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
  g.computeVertexNormals();
  return g;
}

function transformPoint2D(p, sx, sy, tx, ty) {
  return new THREE.Vector2(p.x * sx + tx, p.y * sy + ty);
}

function transformCurve2D(c, sx, sy, tx, ty) {
  if (c.isLineCurve || c instanceof THREE.LineCurve) {
    return new THREE.LineCurve(transformPoint2D(c.v1, sx, sy, tx, ty), transformPoint2D(c.v2, sx, sy, tx, ty));
  } else if (c.isQuadraticBezierCurve || c instanceof THREE.QuadraticBezierCurve) {
    return new THREE.QuadraticBezierCurve(
      transformPoint2D(c.v0, sx, sy, tx, ty),
      transformPoint2D(c.v1, sx, sy, tx, ty),
      transformPoint2D(c.v2, sx, sy, tx, ty)
    );
  } else if (c.isCubicBezierCurve || c instanceof THREE.CubicBezierCurve) {
    return new THREE.CubicBezierCurve(
      transformPoint2D(c.v0, sx, sy, tx, ty),
      transformPoint2D(c.v1, sx, sy, tx, ty),
      transformPoint2D(c.v2, sx, sy, tx, ty),
      transformPoint2D(c.v3, sx, sy, tx, ty)
    );
  } else {
    const pts = c.getPoints(12).map((p) => transformPoint2D(p, sx, sy, tx, ty));
    const curves = [];
    for (let i = 0; i < pts.length - 1; i++) {
      curves.push(new THREE.LineCurve(pts[i], pts[i + 1]));
    }
    return curves;
  }
}

function transformShape2D(shape, sx, sy, tx, ty) {
  const s = new THREE.Shape();
  const curves = [];
  shape.curves.forEach((c) => {
    const r = transformCurve2D(c, sx, sy, tx, ty);
    if (Array.isArray(r)) curves.push(...r);
    else curves.push(r);
  });
  s.curves = curves;
  if (shape.holes && shape.holes.length > 0) {
    s.holes = shape.holes.map((h) => {
      const p = new THREE.Path();
      const hc = [];
      h.curves.forEach((c) => {
        const r = transformCurve2D(c, sx, sy, tx, ty);
        if (Array.isArray(r)) hc.push(...r);
        else hc.push(r);
      });
      p.curves = hc;
      return p;
    });
  }
  return s;
}

function makeSquareBrickGeoms(outerSize, wallThick, height, corniceH, baseH, brickDepth) {
  const s = outerSize / 2;
  const Hwall = height - (corniceH > 0 ? corniceH : 0);
  const Ystart = baseH > 0 ? baseH : 0;
  const Hbricks = Hwall - Ystart;
  if (Hbricks <= 10) return [];

  const Nrows = Math.max(4, Math.round(Hbricks / 13));
  const gap = 1.5;
  const hRow = Hbricks / Nrows;
  const hBrick = Math.max(2, hRow - gap);
  const d = THREE.MathUtils.clamp(brickDepth, 0.5, 3.0);
  const tBrick = d + 0.5;

  const Nb = Math.max(2, Math.round((2 * s) / 26));
  const lBrick = (2 * s - (Nb + 1) * gap) / Nb;
  const halfL = Math.max(2, (lBrick - gap) / 2);

  const bricks = [];

  for (let r = 0; r < Nrows; r++) {
    const yCenter = Ystart + r * hRow + gap / 2 + hBrick / 2;
    const isEven = r % 2 === 0;

    // Symmetric face spans along face tangential axis (-s to +s):
    const spans = [];
    if (isEven) {
      // Nb full bricks
      for (let i = 0; i < Nb; i++) {
        const u0 = -s + gap + i * (lBrick + gap);
        const u1 = u0 + lBrick;
        spans.push({ w: u1 - u0, center: (u0 + u1) / 2 });
      }
    } else {
      // Staggered by half-brick (half brick at start, Nb-1 full bricks, half brick at end)
      const uStart = -s + gap;
      spans.push({ w: halfL, center: uStart + halfL / 2 });
      for (let i = 0; i < Nb - 1; i++) {
        const u0 = uStart + halfL + gap + i * (lBrick + gap);
        const u1 = u0 + lBrick;
        spans.push({ w: lBrick, center: (u0 + u1) / 2 });
      }
      const uEnd = s - gap;
      spans.push({ w: halfL, center: uEnd - halfL / 2 });
    }

    // Apply the exact same pattern to all 4 faces with 90° rotational symmetry:
    spans.forEach((sp) => {
      // Face 0 (+Z):
      const g0 = new THREE.BoxGeometry(sp.w, hBrick, tBrick);
      g0.translate(sp.center, yCenter, s - tBrick / 2);
      bricks.push(g0);

      // Face 1 (+X):
      const g1 = new THREE.BoxGeometry(tBrick, hBrick, sp.w);
      g1.translate(s - tBrick / 2, yCenter, -sp.center);
      bricks.push(g1);

      // Face 2 (-Z):
      const g2 = new THREE.BoxGeometry(sp.w, hBrick, tBrick);
      g2.translate(-sp.center, yCenter, -s + tBrick / 2);
      bricks.push(g2);

      // Face 3 (-X):
      const g3 = new THREE.BoxGeometry(tBrick, hBrick, sp.w);
      g3.translate(-s + tBrick / 2, yCenter, sp.center);
      bricks.push(g3);
    });
  }

  return bricks;
}

/* ============ KAPI / PENCERE ============ */

function makeArchedGeom(w, h, depth) {
  const hw = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, -h);
  shape.lineTo(hw, -h);
  shape.lineTo(hw, 0);
  shape.absarc(0, 0, hw, 0, Math.PI, false);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.computeVertexNormals();
  return g;
}

function makeRectGeom(w, h, depth) {
  const hw = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, -h);
  shape.lineTo(hw, -h);
  shape.lineTo(hw, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.computeVertexNormals();
  return g;
}

function makeFrameGeom(w, h, fw, depth, arched) {
  const hw = w / 2 + fw;
  const hh = h + fw;
  const outerS = new THREE.Shape();
  outerS.moveTo(-hw, 0);
  if (arched) {
    outerS.lineTo(-hw, -hh);
    outerS.lineTo(hw, -hh);
    outerS.lineTo(hw, 0);
    outerS.absarc(0, 0, hw, 0, Math.PI, false);
  } else {
    outerS.lineTo(-hw, -hh);
    outerS.lineTo(hw, -hh);
    outerS.lineTo(hw, 0);
  }
  outerS.closePath();
  const innerS = new THREE.Path();
  const iw = w / 2;
  innerS.moveTo(-iw, 0);
  if (arched) {
    innerS.lineTo(-iw, -h);
    innerS.lineTo(iw, -h);
    innerS.lineTo(iw, 0);
    innerS.absarc(0, 0, iw, 0, Math.PI, true);
  } else {
    innerS.lineTo(-iw, -h);
    innerS.lineTo(iw, -h);
    innerS.lineTo(iw, 0);
  }
  innerS.closePath();
  outerS.holes.push(innerS);
  const g = new THREE.ExtrudeGeometry(outerS, { depth, bevelEnabled: false });
  g.computeVertexNormals();
  return g;
}

/* ============ BIRLESTIR ============ */

function mergeGeoms(geoms) {
  let totalVerts = 0;
  const lists = geoms.map((g) => {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const u = g.getAttribute('uv');
    const idx = g.index;
    totalVerts += p.count;
    return { pos: p, norm: n, uv: u, idx, count: p.count };
  });
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = [];
  let offset = 0;
  let hasUV = false;
  for (const l of lists) {
    positions.set(l.pos.array, offset * 3);
    normals.set(l.norm.array, offset * 3);
    if (l.uv) {
      uvs.set(l.uv.array, offset * 2);
      hasUV = true;
    }
    if (l.idx) {
      for (let i = 0; i < l.idx.count; i++) indices.push(l.idx.getX(i) + offset);
    } else {
      for (let i = 0; i < l.count; i++) indices.push(offset + i);
    }
    offset += l.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (hasUV) geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

/* ============ BILESEN ============ */

const CastlePencilCase = ({
  shape = 'cylinder',
  outerDiameter = 100,
  outerSize = 100,
  height = 150,
  wallThickness = 4,
  bottomThickness = 4,
  baseHeight = 8,
  baseExtension = 6,
  numCrenellations = 8,
  crenellationHeight = 20,
  crenellationWidth = 0.5,
  hasDoor = true,
  doorWidth = 24,
  doorHeight = 50,
  doorRecess = 2,
  hasWindows = true,
  numWindows = 3,
  windowWidth = 16,
  windowHeight = 24,
  windowRecess = 1,
  windowArched = true,
  hasTowers = true,
  towerRadius = 8,
  towerHeight = 30,
  cornerRadius = 5,
  materialColor = '#a8a29e',
  doorColor = '#1c1917',
  windowColor = '#1c1917',
  showBrickTexture = true,
  embossedBricks = false,
  brickDepth = 1.5,
  showCastleRelief = false,
  reliefSource = 'preset_horse', // 'preset_horse' | 'custom_svg'
  customSvgText = '',
  castleReliefDepth = 1,
  reliefMode = 'emboss',
  reliefScale = 1.0,
  topExtension = 6,
  corniceHeight = 12,
  // Text props
  castleText = '',
  castleFont = 'Plus_Jakarta_Sans_Bold.json',
  castleTextHeight = 20,
  castleTextDepth = 2,
  castleTextPosition = 'cornice', // 'cornice' | 'body'
  castleTextSpacing = 1,
  castleTextArc = 360,
  groupRef,
}) => {
  const isCylinder = shape === 'cylinder';
  const brickTex = useMemo(() => (showBrickTexture ? createBrickTexture() : null), [showBrickTexture]);
  const texProps = useMemo(() => ({ map: brickTex }), [brickTex]);

  // Font loading for castle text
  const fontPath = `/fonts/${castleFont}`;
  const font = useLoader(FontLoader, fontPath);

  // Generate castle text geometry
  const castleTextGeom = useMemo(() => {
    if (!castleText || !castleText.trim() || !font) return null;
    const text = castleText.trim().toLocaleUpperCase('tr-TR');
    
    // Calculate radius for text placement
    let radius, yPos;
    if (isCylinder) {
      if (castleTextPosition === 'cornice') {
        radius = outerDiameter / 2 + topExtension + castleTextDepth / 2 + 0.1;
      } else {
        radius = outerDiameter / 2 + castleTextDepth / 2 + 0.1;
      }
      yPos = castleTextPosition === 'cornice' ? height - corniceHeight / 2 : height / 2;
    } else {
      const s = outerSize / 2;
      if (castleTextPosition === 'cornice') {
        radius = s + topExtension + castleTextDepth / 2 + 0.1;
        yPos = height - corniceHeight / 2;
      } else {
        radius = s + castleTextDepth / 2 + 0.1;
        yPos = height / 2;
      }
    }

    // Helper: 45° cantilevered chamfer transition from wall surface to text face (like castle cornice flare)
    // Eliminates 90° horizontal overhangs so text prints cleanly without supports
    const apply45DegreeChamfer = (geometry, depth) => {
      const pos = geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const y = pos.getY(i);
        // z runs from -depth / 2 (wall surface) to +depth / 2 (front face)
        // factor: 1 at wall (back), 0 at front tip
        const factor = THREE.MathUtils.clamp((depth / 2 - z) / depth, 0, 1);
        pos.setY(i, y - factor * depth);
      }
      geometry.computeVertexNormals();
    };

    if (isCylinder) {
      // Per-character geometries wrapped around the cylinder
      const charData = [];
      let totalWidth = 0;
      for (let i = 0; i < text.length; i++) {
        const shapes = font.generateShapes(text[i], castleTextHeight);
        const geom = new THREE.ExtrudeGeometry(shapes, {
          depth: castleTextDepth,
          bevelEnabled: false,
        });
        geom.computeBoundingBox();
        const box = geom.boundingBox;
        const charWidth = box.max.x - box.min.x;
        geom.translate(-box.min.x - charWidth / 2, 0, -castleTextDepth / 2);

        // Apply 45° self-supporting chamfer transition on body wall
        if (castleTextPosition === 'body') {
          apply45DegreeChamfer(geom, castleTextDepth);
        } else {
          geom.computeVertexNormals();
        }

        charData.push({ geom, width: charWidth });
        totalWidth += charWidth;
      }
      const spacing = castleTextSpacing;
      const totalWithSpacing = totalWidth + spacing * (text.length - 1);
      let currentX = -totalWithSpacing / 2;
      return charData.map((cd) => {
        const angle = currentX / radius;
        currentX += cd.width + spacing;
        return {
          geom: cd.geom,
          position: [
            radius * Math.sin(angle),
            yPos,
            radius * Math.cos(angle),
          ],
          rotation: [0, angle, 0],
        };
      });
    }

    const shapes = font.generateShapes(text, castleTextHeight);
    const geom = new THREE.ExtrudeGeometry(shapes, {
      depth: castleTextDepth,
      bevelEnabled: false,
    });
    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const textWidth = box.max.x - box.min.x;

    geom.translate(-box.min.x - textWidth / 2, 0, -castleTextDepth / 2);

    // Apply 45° self-supporting chamfer transition on body wall
    if (castleTextPosition === 'body') {
      apply45DegreeChamfer(geom, castleTextDepth);
    } else {
      geom.computeVertexNormals();
    }

    return { geom, radius, yPos, textWidth };
  }, [castleText, castleFont, castleTextHeight, castleTextDepth, castleTextSpacing, castleTextPosition, 
      isCylinder, outerDiameter, outerSize, height, topExtension, corniceHeight, wallThickness, font]);

  /* --- body (manifold hollow geometry) --- */
  const bodyGeom = useMemo(() => {
    const wallH = height - bottomThickness;
    let allGeoms = [];
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const innerR = Math.max(0.5, outerR - wallThickness);

      // Floor: solid circle extruded from Y=0 to Y=bottomThickness
      const floorShape = new THREE.Shape();
      floorShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      const floorGeom = new THREE.ExtrudeGeometry(floorShape, { depth: bottomThickness, bevelEnabled: false });
      floorGeom.rotateX(-Math.PI / 2);

      // Walls: ring (outer circle with inner hole) extruded from Y=bottomThickness to Y=height
      const wallShape = new THREE.Shape();
      wallShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      const holePath = new THREE.Path();
      holePath.absarc(0, 0, innerR, 0, Math.PI * 2, true);
      wallShape.holes.push(holePath);
      const wallGeom = new THREE.ExtrudeGeometry(wallShape, { depth: wallH, bevelEnabled: false });
      wallGeom.rotateX(-Math.PI / 2);
      wallGeom.translate(0, bottomThickness, 0);

      allGeoms = [floorGeom, wallGeom];
    } else {
      const s = outerSize / 2;
      const si = Math.max(1, s - wallThickness);
      const r = Math.min(cornerRadius, s);
      const ri = Math.max(0, r - wallThickness);

      // Floor: solid rounded square extruded from Y=0 to Y=bottomThickness
      const floorShape = new THREE.Shape();
      floorShape.moveTo(-s + r, -s);
      floorShape.lineTo(s - r, -s).quadraticCurveTo(s, -s, s, -s + r);
      floorShape.lineTo(s, s - r).quadraticCurveTo(s, s, s - r, s);
      floorShape.lineTo(-s + r, s).quadraticCurveTo(-s, s, -s, s - r);
      floorShape.lineTo(-s, -s + r).quadraticCurveTo(-s, -s, -s + r, -s);
      const floorGeom = new THREE.ExtrudeGeometry(floorShape, { depth: bottomThickness, bevelEnabled: false });
      floorGeom.rotateX(-Math.PI / 2);

      // Wall profile: if embossedBricks is true, core wall acts as mortar bed of size s - brickDepth
      const bOffset = embossedBricks ? Math.min(brickDepth, 2.5) : 0;
      const cH = topExtension > 0 ? corniceHeight : 0;
      const lowerWallH = Math.max(10, wallH - cH);

      const wallShapeLower = new THREE.Shape();
      const sLow = s - bOffset;
      const rLow = Math.min(r, sLow);
      wallShapeLower.moveTo(-sLow + rLow, -sLow);
      wallShapeLower.lineTo(sLow - rLow, -sLow).quadraticCurveTo(sLow, -sLow, sLow, -sLow + rLow);
      wallShapeLower.lineTo(sLow, sLow - rLow).quadraticCurveTo(sLow, sLow, sLow - rLow, sLow);
      wallShapeLower.lineTo(-sLow + rLow, sLow).quadraticCurveTo(-sLow, sLow, -sLow, sLow - rLow);
      wallShapeLower.lineTo(-sLow, -sLow + rLow).quadraticCurveTo(-sLow, -sLow, -sLow + rLow, -sLow);

      const holePath = new THREE.Path();
      holePath.moveTo(-si + ri, -si);
      holePath.lineTo(si - ri, -si).quadraticCurveTo(si, -si, si, -si + ri);
      holePath.lineTo(si, si - ri).quadraticCurveTo(si, si, si - ri, si);
      holePath.lineTo(-si + ri, si).quadraticCurveTo(-si, si, -si, si - ri);
      holePath.lineTo(-si, -si + ri).quadraticCurveTo(-si, -si, -si + ri, -si);
      wallShapeLower.holes.push(holePath);

      const wallGeomLower = new THREE.ExtrudeGeometry(wallShapeLower, { depth: lowerWallH, bevelEnabled: false });
      wallGeomLower.rotateX(-Math.PI / 2);
      wallGeomLower.translate(0, bottomThickness, 0);

      allGeoms = [floorGeom, wallGeomLower];

      // Upper wall section under cornice (if cornice height > 0)
      if (cH > 0) {
        const wallShapeUpper = new THREE.Shape();
        wallShapeUpper.moveTo(-s + r, -s);
        wallShapeUpper.lineTo(s - r, -s).quadraticCurveTo(s, -s, s, -s + r);
        wallShapeUpper.lineTo(s, s - r).quadraticCurveTo(s, s, s - r, s);
        wallShapeUpper.lineTo(-s + r, s).quadraticCurveTo(-s, s, -s, s - r);
        wallShapeUpper.lineTo(-s, -s + r).quadraticCurveTo(-s, -s, -s + r, -s);
        wallShapeUpper.holes.push(holePath);

        const wallGeomUpper = new THREE.ExtrudeGeometry(wallShapeUpper, { depth: cH, bevelEnabled: false });
        wallGeomUpper.rotateX(-Math.PI / 2);
        wallGeomUpper.translate(0, bottomThickness + lowerWallH, 0);
        allGeoms.push(wallGeomUpper);
      }
    }
    return mergeGeoms(allGeoms);
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, bottomThickness, cornerRadius, topExtension, corniceHeight, embossedBricks, brickDepth]);

  /* --- base --- */
  const baseGeom = useMemo(() => {
    if (baseHeight <= 0) return null;
    if (isCylinder) {
      return makeCylinderBaseGeom(outerDiameter / 2, baseExtension, baseHeight);
    } else {
      return makeSquareBaseGeom(outerSize, baseExtension, baseHeight, cornerRadius);
    }
  }, [isCylinder, outerDiameter, outerSize, baseExtension, baseHeight, cornerRadius]);

  /* --- cornice ledge (both cylinder and square) --- */
  const corniceGeom = useMemo(() => {
    if (topExtension <= 0 || corniceHeight <= 0) return null;
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      return makeCorniceGeom(outerR, topExtension, corniceHeight, SEG);
    } else {
      return makeSquareCorniceGeom(outerSize, topExtension, corniceHeight);
    }
  }, [isCylinder, outerDiameter, outerSize, topExtension, corniceHeight]);

  const corniceMesh = useMemo(() => {
    if (!corniceGeom) return null;
    return (
      <mesh key={`cornice-${showBrickTexture}`} geometry={corniceGeom} name="CastleCornice" position={[0, height, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTex} />
      </mesh>
    );
  }, [corniceGeom, height, showBrickTexture, materialColor, brickTex]);

  /* --- crenellations --- */
  const crenMeshes = useMemo(() => {
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const topR = outerR + topExtension;
      const innerR = Math.max(0.5, outerR - wallThickness);
      const geoms = makeCylinderCrenGeoms(topR, innerR, height, numCrenellations, crenellationHeight, crenellationWidth);
      return geoms.map((g, i) => (
        <mesh key={`cren-c-${i}-${showBrickTexture}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTex} />
        </mesh>
      ));
    } else {
      const geoms = makeSquareCrenGeoms(outerSize, wallThickness, height, numCrenellations, crenellationHeight, crenellationWidth, topExtension);
      return geoms.map((g, i) => (
        <mesh key={`cren-s-${i}-${showBrickTexture}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTex} />
        </mesh>
      ));
    }
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, numCrenellations, crenellationHeight, crenellationWidth, topExtension, materialColor, showBrickTexture, texProps]);

  /* --- towers --- */
  const towerMeshes = useMemo(() => {
    if (isCylinder || !hasTowers) return null;
    const geoms = makeSquareTowerGeoms(outerSize, height, towerRadius, towerHeight);
    return geoms.map((g, i) => (
      <mesh key={`tower-${i}-${showBrickTexture}`} geometry={g} name={`Tower_${i}`} receiveShadow castShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTex} />
      </mesh>
    ));
  }, [isCylinder, hasTowers, outerSize, height, towerRadius, towerHeight, showBrickTexture, materialColor, texProps]);

  /* --- 3D embossed bricks --- */
  const brickMeshes = useMemo(() => {
    if (!embossedBricks) return null;
    const bw = 20, bh = 8, gap = 1;
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const geoms = makeCylinderBrickGeoms(outerR, height, wallThickness, brickDepth, bw, bh, gap);
      return geoms.map((g, i) => (
        <mesh key={`brick-c-${i}-${showBrickTexture}`} geometry={g} name={`Brick_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTex} />
        </mesh>
      ));
    } else {
      const geoms = makeSquareBrickGeoms(outerSize, wallThickness, height, corniceHeight, baseHeight, brickDepth);
      if (!geoms || geoms.length === 0) return null;
      const merged = mergeGeoms(geoms);
      return (
        <mesh key={`brick-s-${outerSize}-${height}`} geometry={merged} name="CastleBricks" receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTex} />
        </mesh>
      );
    }
  }, [embossedBricks, isCylinder, outerDiameter, outerSize, wallThickness, height, corniceHeight, baseHeight, brickDepth, showBrickTexture, materialColor, texProps]);

  // Prepared 2D shapes for relief (both preset horse and custom SVG):
  const reliefShapesData = useMemo(() => {
    if (!showCastleRelief) return null;

    let shapes = [];
    if (reliefSource === 'custom_svg' && customSvgText && customSvgText.trim()) {
      try {
        const loader = new SVGLoader();
        const svgData = loader.parse(customSvgText);
        svgData.paths.forEach((path) => {
          const pathShapes = SVGLoader.createShapes(path);
          shapes.push(...pathShapes);
        });
      } catch (err) {
        console.error('Failed to parse custom SVG relief:', err);
      }
    }

    if (!shapes || shapes.length === 0) {
      // Fallback to horse shapes normalized around 0,0
      const horseRaw = getHorseShapes(30, 42);
      shapes = horseRaw;
    }

    try {
      const tempGeom = new THREE.ShapeGeometry(shapes);
      tempGeom.computeBoundingBox();
      const box = tempGeom.boundingBox;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y);
      if (maxDim <= 0) return null;

      const targetH = Math.min(height * 0.35, 60) * reliefScale;
      const scale = targetH / maxDim;

      // Normalize shapes so they are centered at (0, 0) and oriented right side up
      // Note: SVG Y is downwards, so we flip Y by using -scale for SVG or when height > 0
      const sy = (reliefSource === 'custom_svg') ? -scale : scale;
      const normalizedShapes = shapes.map((sh) =>
        transformShape2D(sh, scale, sy, -center.x * scale, -center.y * sy)
      );

      // Recalculate normalized bounds
      const normGeom = new THREE.ShapeGeometry(normalizedShapes);
      normGeom.computeBoundingBox();
      const normBox = normGeom.boundingBox;
      const normSize = normBox.getSize(new THREE.Vector3());

      return {
        shapes: normalizedShapes,
        bounds: normBox,
        width: normSize.x,
        height: normSize.y,
      };
    } catch (e) {
      console.error('Error normalizing relief shapes:', e);
      return null;
    }
  }, [showCastleRelief, reliefSource, customSvgText, height, reliefScale]);

  /* --- relief geometry (emboss vs engrave) --- */
  const reliefGeomData = useMemo(() => {
    if (!showCastleRelief || !reliefShapesData) return null;

    const { shapes, width, height: rH } = reliefShapesData;
    const depth = Math.max(0.3, castleReliefDepth);

    if (reliefMode === 'emboss') {
      // Protruding solid relief extruded forward
      const geom = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
      geom.computeVertexNormals();
      return { mode: 'emboss', geom };
    } else {
      // 'engrave' -> Real physical carved pocket/recess in the wall
      const padX = Math.max(width * 0.22, 6);
      const padY = Math.max(rH * 0.22, 6);
      const pw = width + padX * 2;
      const ph = rH + padY * 2;
      const pr = Math.min(4, pw / 6, ph / 6);

      // Create outer plate with rounded corners
      const plateShape = new THREE.Shape();
      plateShape.moveTo(-pw / 2 + pr, -ph / 2);
      plateShape.lineTo(pw / 2 - pr, -ph / 2);
      plateShape.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + pr);
      plateShape.lineTo(pw / 2, ph / 2 - pr);
      plateShape.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - pr, ph / 2);
      plateShape.lineTo(-pw / 2 + pr, ph / 2);
      plateShape.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - pr);
      plateShape.lineTo(-pw / 2, -ph / 2 + pr);
      plateShape.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + pr, -ph / 2);
      plateShape.closePath();

      // Add relief shapes as cutout holes in the plate
      plateShape.holes.push(...shapes);

      const frameGeom = new THREE.ExtrudeGeometry(plateShape, { depth, bevelEnabled: false, steps: 1 });
      frameGeom.computeVertexNormals();

      return {
        mode: 'engrave',
        frameGeom,
        depth,
        pw,
        ph,
      };
    }
  }, [showCastleRelief, reliefShapesData, reliefMode, castleReliefDepth]);

  /* --- castle relief mesh --- */
  const castleReliefMesh = useMemo(() => {
    if (!showCastleRelief || !reliefGeomData) return null;

    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const posY = height * 0.48;

    if (reliefGeomData.mode === 'emboss') {
      return (
        <group key={`relief-emboss-${showBrickTexture}-${reliefSource}`} position={[0, posY, frontZ + 0.05]}>
          <mesh geometry={reliefGeomData.geom} name="CastleReliefEmboss" receiveShadow castShadow>
            <meshStandardMaterial color={materialColor} roughness={0.75} map={brickTex} />
          </mesh>
        </group>
      );
    } else {
      // True Physical Engraving: Carved pocket directly recessed into the wall surface
      return (
        <group key={`relief-engrave-${showBrickTexture}-${reliefSource}`} position={[0, posY, frontZ]}>
          {/* Wall plate with cutout silhouette creating authentic engraved pocket */}
          <mesh
            geometry={reliefGeomData.frameGeom}
            position={[0, 0, 0]}
            name="CastleEngravedFrame"
            receiveShadow
            castShadow
          >
            <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTex} />
          </mesh>
        </group>
      );
    }
  }, [showCastleRelief, reliefGeomData, isCylinder, outerDiameter, outerSize, height, materialColor, showBrickTexture, brickTex, reliefSource]);

  /* --- door (recessed, with frame) --- */
  const doorMesh = useMemo(() => {
    if (!hasDoor) return null;
    const openDepth = -(wallThickness + doorRecess);
    const frameDepth = -Math.max(doorRecess, 1);
    const openGeom = makeArchedGeom(doorWidth, doorHeight, openDepth);
    const frameGeom = makeFrameGeom(doorWidth, doorHeight, 3, frameDepth, true);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = 0;
    const posY = bottomY + bottomThickness + doorHeight;
    return (
      <group key={`door-${showBrickTexture}`} position={[0, posY, frontZ]}>
        <mesh geometry={openGeom} name="CastleDoor" receiveShadow>
          <meshStandardMaterial color={doorColor} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={frameGeom} name="CastleDoorFrame" receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTex} />
        </mesh>
      </group>
    );
  }, [hasDoor, doorWidth, doorHeight, doorRecess, wallThickness, isCylinder, outerDiameter, outerSize, bottomThickness, height, showBrickTexture, doorColor, materialColor, texProps]);

  /* --- windows --- */
  const windowMeshes = useMemo(() => {
    if (!hasWindows) return null;
    const openDepth = -(wallThickness + windowRecess);
    const frameDepth = -Math.max(windowRecess, 1);
    const makeOpen = windowArched ? makeArchedGeom : makeRectGeom;
    const openBase = makeOpen(windowWidth, windowHeight, openDepth);
    const frameBase = makeFrameGeom(windowWidth, windowHeight, 2.5, frameDepth, windowArched);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = 0;
    const winY = bottomY + height * 0.6;
    const meshes = [];

    const addPair = (key, go, gf) => {
      meshes.push(
        <mesh key={`wo-${key}-${showBrickTexture}`} geometry={go} receiveShadow>
          <meshStandardMaterial color={windowColor} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>,
        <mesh key={`wf-${key}-${showBrickTexture}`} geometry={gf} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTex} />
        </mesh>
      );
    };

    if (isCylinder) {
      for (let i = 0; i < numWindows; i++) {
        const a = (i / numWindows) * Math.PI * 2;
        const px = Math.sin(a) * frontZ;
        const pz = Math.cos(a) * frontZ;
        const go = openBase.clone();
        const gf = frameBase.clone();
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        );
        go.applyQuaternion(q);
        gf.applyQuaternion(q);
        go.translate(px, winY + windowHeight, pz);
        gf.translate(px, winY + windowHeight, pz);
        addPair(`c-${i}`, go, gf);
      }
    } else {
      const half = outerSize / 2;
      const sides = [
        { x: 0, z: 1 },
        { x: 1, z: 0 },
        { x: 0, z: -1 },
        { x: -1, z: 0 },
      ];
      sides.forEach((s) => {
        const perSide = Math.max(1, Math.floor(numWindows / 4));
        for (let i = 0; i < perSide; i++) {
          const t = (i - (perSide - 1) / 2) * ((outerSize * 0.6) / perSide);
          const go = openBase.clone();
          const gf = frameBase.clone();
          let px, pz;
          if (s.x !== 0) {
            px = s.x * half;
            pz = t;
            go.rotateY(s.x > 0 ? Math.PI / 2 : -Math.PI / 2);
            gf.rotateY(s.x > 0 ? Math.PI / 2 : -Math.PI / 2);
          } else {
            px = t;
            pz = s.z * half;
            if (s.z < 0) {
              go.rotateY(Math.PI);
              gf.rotateY(Math.PI);
            }
          }
          go.translate(px, winY + windowHeight, pz);
          gf.translate(px, winY + windowHeight, pz);
          addPair(`s-${s.x}-${s.z}-${i}`, go, gf);
        }
      });
    }
    return meshes;
  }, [hasWindows, numWindows, windowWidth, windowHeight, windowRecess, windowArched, wallThickness, isCylinder, outerDiameter, outerSize, height, showBrickTexture, windowColor, materialColor, texProps]);

  /* --- top ring (closes the body's top annulus) --- */
  const topRing = useMemo(() => {
    if (!isCylinder) return null;
    const outerR = outerDiameter / 2;
    const innerR = Math.max(0.5, outerR - wallThickness);
    const g = new THREE.RingGeometry(innerR, outerR, SEG);
    g.rotateX(Math.PI / 2);
    g.translate(0, height, 0);
    g.computeVertexNormals();
    return (
      <mesh key={`topring-${showBrickTexture}`} geometry={g} name="CastleTopRing" receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTex} />
      </mesh>
    );
  }, [isCylinder, outerDiameter, wallThickness, height, showBrickTexture, materialColor, texProps]);

  const wallMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.9,
      side: THREE.DoubleSide,
      map: brickTex,
    });
  }, [materialColor, brickTex]);

  const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
  const bottomY = isCylinder ? 0 : -height / 2;

  return (
    <group ref={groupRef} name="CastlePencilCase">
      <mesh name="CastleBody" geometry={bodyGeom} material={wallMat} receiveShadow castShadow />
      {baseHeight > 0 && baseGeom && (
        <mesh geometry={baseGeom} name="CastleBase" material={wallMat} receiveShadow castShadow />
      )}
      {corniceMesh}
      {crenMeshes}
      {topRing}
      {towerMeshes}
      {brickMeshes}
      {castleReliefMesh}
      {doorMesh}
      {windowMeshes}
      {castleTextGeom && isCylinder && Array.isArray(castleTextGeom) && castleTextGeom.map((charData, i) => (
        <mesh
          key={`castle-text-${i}`}
          geometry={charData.geom}
          name="CastleText"
          position={charData.position}
          rotation={charData.rotation}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {castleTextGeom && !isCylinder && (
        <group key={`castle-text-sq-${showBrickTexture}`} name="CastleText">
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
            <mesh
              key={`txt-${i}`}
              geometry={castleTextGeom.geom}
              position={[
                Math.sin(angle) * castleTextGeom.radius,
                castleTextGeom.yPos,
                Math.cos(angle) * castleTextGeom.radius
              ]}
              rotation={[0, angle, 0]}
              receiveShadow
              castShadow
            >
              <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

export default CastlePencilCase;
