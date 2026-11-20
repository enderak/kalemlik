import * as THREE from 'three';
import {
  resampleShapesForCleanExtrusion,
  subdivideExtrudedGeometry,
} from './jerseyVectorAssets.js';

/**
 * Clamps a number between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation between a and b.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Smooth Hermite interpolation between edge0 and edge1.
 */
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Computes crease-preserving smooth vertex normals on non-indexed subdivided BufferGeometry
 * so curved projected lapels and pockets shade smoothly while keeping sharp bevels crisp.
 */
function computeSmoothCreasedNormals(geom, cosThreshold = 0.65) {
  geom.computeVertexNormals();
  const pos = geom.attributes.position;
  const nrm = geom.attributes.normal;
  if (!pos || !nrm) return;

  const buckets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 20)},${Math.round(
      pos.getY(i) * 20
    )},${Math.round(pos.getZ(i) * 20)}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(i);
  }

  const outNormals = new Float32Array(nrm.array.length);
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      const ia = list[a];
      const ax = nrm.getX(ia);
      const ay = nrm.getY(ia);
      const az = nrm.getZ(ia);

      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let b = 0; b < list.length; b++) {
        const ib = list[b];
        const bx = nrm.getX(ib);
        const by = nrm.getY(ib);
        const bz = nrm.getZ(ib);
        if (ax * bx + ay * by + az * bz >= cosThreshold) {
          sx += bx;
          sy += by;
          sz += bz;
        }
      }
      const len = Math.hypot(sx, sy, sz) || 1;
      outNormals[ia * 3] = sx / len;
      outNormals[ia * 3 + 1] = sy / len;
      outNormals[ia * 3 + 2] = sz / len;
    }
  }
  nrm.array.set(outNormals);
  nrm.needsUpdate = true;
}

/**
 * Evaluates the outer profile (half-width, half-depth, superellipse n)
 * for normalized height v in [0, 1] for the medical coat.
 * v = 0: Bottom hem (waist/hip)
 * v = 1: Top collar/neck opening
 *
 * Tailored anatomical silhouette matching the physical print reference:
 * - Balanced trunk width so sleeves have full volume beside the torso
 * - Gentle waist/chest tailoring across v in [0, 0.76]
 * - Smooth sloped shoulders tapering into the central collar opening for v in [0.76, 1.0]
 */
export function evalCoatProfile(
  v,
  coatWidth = 82,
  coatDepth = 50,
  collarOpeningWidth = 28
) {
  const wScale = coatWidth / 82;
  const dScale = coatDepth / 50;
  const trunkHwBase = coatWidth * 0.368;
  const trunkHdBase = coatDepth * 0.468;

  const waistTaper = 1.0 - 0.035 * Math.exp(-Math.pow((v - 0.42) / 0.24, 2));
  const chestFlare = 1.0 + 0.04 * Math.exp(-Math.pow((v - 0.72) / 0.16, 2));

  const torsoHw = trunkHwBase * waistTaper * chestFlare;
  const torsoHd =
    trunkHdBase *
    waistTaper *
    (1.0 + 0.025 * Math.exp(-Math.pow((v - 0.70) / 0.18, 2)));

  // Neck outer radius determined by user's collar opening width slider
  const neckOuterHw = clamp(
    (collarOpeningWidth * 0.5 + 3.2) * wScale,
    13.0 * wScale,
    trunkHwBase - 4.8 * wScale
  );
  const neckOuterHd = clamp(
    neckOuterHw * 0.98 * (dScale / Math.max(0.5, wScale)),
    13.5 * dScale,
    trunkHdBase - 2.0 * dScale
  );

  let hw = torsoHw;
  let hd = torsoHd;
  let n = 2.22;

  if (v > 0.75) {
    const uW = clamp((v - 0.75) / 0.25, 0, 1);
    const sbW = smoothstep(0.0, 1.0, uW);
    hw = lerp(torsoHw, neckOuterHw, sbW);

    const uD = clamp((v - 0.85) / 0.15, 0, 1);
    const sbD = smoothstep(0.0, 1.0, uD);
    hd = lerp(torsoHd, neckOuterHd, sbD);

    n = lerp(2.22, 2.05, sbW);
  }

  return { hw, hd, n, trunkHwBase, neckOuterHw, neckOuterHd, torsoHw, torsoHd };
}

/**
 * Computes front center V-neck dip strictly inside |x| < neckOuterHw - 1.5
 * so the open collar matches the lapel inner edges cleanly.
 */
function getVNeckDropByX(v, absX, sinT, layout, neckOuterHw) {
  if (sinT <= 0.0 || v <= 0.65) return 0;
  const vWidth = Math.max(4.0, neckOuterHw - 1.5);
  if (absX >= vWidth) return 0;
  const xRatio = clamp(absX / vWidth, 0, 1);
  const vShape = 1.0 - Math.pow(xRatio, 1.45);
  const frontMask = smoothstep(0.0, 0.32, sinT);
  const maxDrop = layout.coatSpan * 0.145;
  const vMask = Math.pow(smoothstep(0.65, 1.0, v), 1.35);
  return maxDrop * vShape * frontMask * vMask;
}

/**
 * Evaluates a 3D point on the outer surface of the medical coat for (v, theta).
 * theta = 0: Right side (+X)
 * theta = PI/2: Front center (+Z)
 * theta = PI: Left side (-X)
 * theta = 3*PI/2: Back center (-Z)
 */
export function evalCoatOuterPoint(v, theta, layout, wallThickness = 2.2) {
  const collarOpeningWidth = layout.collarOpeningWidth ?? 28;
  const prof0 = evalCoatProfile(
    v,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const n0 = prof0.n;
  const denom0 =
    Math.pow(
      Math.pow(Math.abs(cosT), n0) + Math.pow(Math.abs(sinT), n0),
      1 / n0
    ) || 1;
  let x = (prof0.hw / denom0) * cosT;

  // Deep front V-neck opening between lapels (symmetric with inner wall)
  const vNeckDrop = getVNeckDropByX(
    v,
    Math.abs(x),
    sinT,
    layout,
    prof0.neckOuterHw
  );
  const y = layout.coatBottomY + v * layout.coatSpan - vNeckDrop;

  // Evaluate coat section at effective vertical height vEff so V-neck edges retain true chest depth
  const vEff = clamp((y - layout.coatBottomY) / Math.max(1, layout.coatSpan), 0, 1);
  const prof = evalCoatProfile(
    vEff,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const n = prof.n;
  const ratioX = clamp(x / Math.max(1e-4, prof.hw), -1.0, 1.0);
  const zFactor = Math.pow(
    Math.max(0.0, 1.0 - Math.pow(Math.abs(ratioX), n)),
    1.0 / n
  );
  let z = (sinT >= 0 ? 1 : -1) * prof.hd * zFactor;

  // Subtle fabric drape details (supportless friendly)
  const hemBand = 0.32 * (1.0 - smoothstep(0.03, 0.07, vEff));
  const isFront = sinT > 0;
  if (isFront) {
    const placketFade =
      smoothstep(0.01, 0.05, vEff) * (1.0 - smoothstep(0.52, 0.58, vEff));
    if (layout?.hasButtons !== false && placketFade > 0.001 && Math.abs(x) < 10) {
      const overlap =
        0.55 * smoothstep(-2.4, -1.0, x) * Math.exp(-Math.pow(x / 7.5, 2));
      z += overlap * placketFade;
    }
    if (vEff > 0.535) {
      const vLapelS = clamp((vEff - 0.54) / 0.457, 0, 1);
      const innerTopX = Math.max(8.5, prof0.neckOuterHw - 4.2);
      const vLapelHalfW = Math.max(0.6, innerTopX * vLapelS + 0.35);
      if (Math.abs(x) < vLapelHalfW) {
        const inVMask =
          (1.0 - smoothstep(Math.max(0, vLapelHalfW - 1.1), vLapelHalfW, Math.abs(x))) *
          smoothstep(0.535, 0.565, vEff);
        const vRecess = Math.min(0.80, Math.max(0.8, Number(wallThickness) || 2.2) * 0.25);
        z -= vRecess * inVMask;
      }
    }
  } else {
    const backSeamGroove =
      -0.2 * Math.exp(-Math.pow(x / 2.2, 2)) * smoothstep(0.06, 0.85, vEff);
    z -= backSeamGroove;
  }

  if (hemBand > 0.001) {
    x += (cosT >= 0 ? 1 : -1) * hemBand * Math.abs(cosT);
    z += (sinT >= 0 ? 1 : -1) * hemBand * Math.abs(sinT);
  }

  return { x, y, z };
}

/**
 * Evaluates a 3D point on the inner pencil cavity surface.
 * Respects user-defined cavityWidth & cavityDepth while safely remaining >= wallThickness
 * inside the sloped shoulder & neck geometry.
 */
export function evalCoatInnerPoint(
  v,
  theta,
  layout,
  wallThickness = 2.2,
  cavityWidth = null,
  cavityDepth = null
) {
  const wt = Math.max(0.8, Number(wallThickness) || 2.2);
  const collarOpeningWidth = layout.collarOpeningWidth ?? 28;
  const prof0 = evalCoatProfile(
    v,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const n0 = prof0.n;
  const outerDenom0 =
    Math.pow(
      Math.pow(Math.abs(cosT), n0) + Math.pow(Math.abs(sinT), n0),
      1 / n0
    ) || 1;
  const outerAbsX = Math.abs((prof0.hw / outerDenom0) * cosT);
  const vNeckDrop = getVNeckDropByX(
    v,
    outerAbsX,
    sinT,
    layout,
    prof0.neckOuterHw
  );
  const y = layout.coatBottomY + v * layout.coatSpan - vNeckDrop;

  const vEff = clamp((y - layout.coatBottomY) / Math.max(1, layout.coatSpan), 0, 1);
  const prof = evalCoatProfile(
    vEff,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );

  const n = 2.05;
  const denom =
    Math.pow(
      Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n),
      1 / n
    ) || 1;

  const computeInnerAxes = (p, vVal) => {
    const maxSafeHw = Math.max(4.0, p.hw - wt);
    const maxSafeHd = Math.max(4.0, p.hd - wt);
    const bodyReqHw = cavityWidth
      ? Math.min(p.torsoHw - wt, Number(cavityWidth) * 0.5)
      : p.torsoHw - wt;
    const bodyReqHd = cavityDepth
      ? Math.min(p.torsoHd - wt, Number(cavityDepth) * 0.5)
      : p.torsoHd - wt;
    const neckReqHw = Math.min(
      maxSafeHw,
      Math.max(4.0, p.neckOuterHw - wt)
    );
    const neckReqHd = Math.min(
      maxSafeHd,
      Math.max(4.0, p.neckOuterHd - wt)
    );
    let iHw = Math.min(maxSafeHw, Math.max(4.5, bodyReqHw));
    let iHd = Math.min(maxSafeHd, Math.max(4.5, bodyReqHd));
    if (vVal > 0.75) {
      const uW = clamp((vVal - 0.75) / 0.25, 0, 1);
      const sbW = smoothstep(0.0, 1.0, uW);
      iHw = Math.min(maxSafeHw, lerp(bodyReqHw, neckReqHw, sbW));
      const uD = clamp((vVal - 0.85) / 0.15, 0, 1);
      const sbD = smoothstep(0.0, 1.0, uD);
      iHd = Math.min(maxSafeHd, lerp(bodyReqHd, neckReqHd, sbD));
    }
    return { iHw, iHd };
  };

  const axes0 = computeInnerAxes(prof0, v);
  const vNeckFront =
    vNeckDrop > 0 && sinT > 0 ? smoothstep(0.0, 8.0, vNeckDrop) : 0.0;
  const effInnerHw0 = lerp(
    axes0.iHw,
    Math.max(axes0.iHw, prof0.hw - Math.min(1.1, wt * 0.45)),
    vNeckFront
  );
  const x = (effInnerHw0 / denom) * cosT;

  const axesEff = computeInnerAxes(prof, vEff);
  const effInnerHw = Math.max(effInnerHw0, axesEff.iHw);
  const ratioX = clamp(x / Math.max(1e-4, effInnerHw), -1.0, 1.0);
  const zFactor = Math.pow(
    Math.max(0.0, 1.0 - Math.pow(Math.abs(ratioX), n)),
    1.0 / n
  );
  const z = (sinT >= 0 ? 1 : -1) * axesEff.iHd * zFactor;

  return { x, y, z };
}

/**
 * Analytic smooth surface Z lookup on the coat outer surface for any (worldX, worldY)
 * evaluated cleanly at effective vertical height vEff (matching evalCoatOuterPoint with zero steps).
 * isFront = true (+Z), isFront = false (-Z).
 */
export function getExactCoatSurfaceZ(worldX, worldY, isFront, layout) {
  const collarOpeningWidth = layout.collarOpeningWidth ?? 28;
  const vEff = clamp(
    (worldY - layout.coatBottomY) / Math.max(1, layout.coatSpan),
    0.01,
    0.99
  );
  const prof = evalCoatProfile(
    vEff,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const hw = Math.max(1, prof.hw);
  const ratioX = clamp(worldX / hw, -0.985, 0.985);
  const n = prof.n;
  const zFactor = Math.pow(
    Math.max(0.0001, 1 - Math.pow(Math.abs(ratioX), n)),
    1 / n
  );
  const sinSign = isFront ? 1 : -1;
  const theta = Math.atan2(sinSign * zFactor, ratioX);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const denom =
    Math.pow(
      Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n),
      1 / n
    ) || 1;

  let z = (prof.hd / denom) * sinT;
  const hemBand = 0.32 * (1.0 - smoothstep(0.03, 0.07, vEff));

  if (isFront) {
    const placketFade =
      smoothstep(0.01, 0.05, vEff) * (1.0 - smoothstep(0.52, 0.58, vEff));
    if (layout?.hasButtons !== false && placketFade > 0.001 && Math.abs(worldX) < 10) {
      z +=
        0.55 *
        smoothstep(-2.4, -1.0, worldX) *
        Math.exp(-Math.pow(worldX / 7.5, 2)) *
        placketFade;
    }
  } else {
    const backSeamGroove =
      -0.2 * Math.exp(-Math.pow(worldX / 2.2, 2)) * smoothstep(0.06, 0.85, vEff);
    z -= backSeamGroove;
  }

  if (hemBand > 0.001) {
    z += (sinT >= 0 ? 1 : -1) * hemBand * Math.abs(sinT);
  }

  return z;
}

/**
 * Builds the complete watertight main coat body (outer shell, inner cavity, top & bottom rims).
 * Uses consistent outward CCW winding for clean Bambu Studio / OrcaSlicer manifold STL export.
 */
export function buildCoatBodyGeometry(
  layout,
  wallThickness = 2.2,
  cavityWidth = null,
  cavityDepth = null
) {
  const numTheta = 128;
  const numV = 64;
  const thetas = [];
  for (let i = 0; i < numTheta; i++) {
    thetas.push((i / numTheta) * Math.PI * 2);
  }

  const outerGrid = [];
  const innerGrid = [];

  for (let j = 0; j <= numV; j++) {
    const v = j / numV;
    const rowOut = [];
    const rowIn = [];
    for (let i = 0; i < numTheta; i++) {
      const th = thetas[i];
      rowOut.push(evalCoatOuterPoint(v, th, layout, wallThickness));
      rowIn.push(
        evalCoatInnerPoint(v, th, layout, wallThickness, cavityWidth, cavityDepth)
      );
    }
    rowOut.push(rowOut[0]);
    rowIn.push(rowIn[0]);
    outerGrid.push(rowOut);
    innerGrid.push(rowIn);
  }

  const tris = [];
  const pushTri = (a, b, c) => {
    tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  for (let j = 0; j < numV; j++) {
    for (let i = 0; i < numTheta; i++) {
      const o00 = outerGrid[j][i];
      const o10 = outerGrid[j][i + 1];
      const o11 = outerGrid[j + 1][i + 1];
      const o01 = outerGrid[j + 1][i];

      const n00 = innerGrid[j][i];
      const n10 = innerGrid[j][i + 1];
      const n11 = innerGrid[j + 1][i + 1];
      const n01 = innerGrid[j + 1][i];

      pushQuad(o00, o01, o11, o10);
      pushQuad(n00, n10, n11, n01);

      if (j === 0) {
        pushQuad(n00, n10, o10, o00);
      }
      if (j === numV - 1) {
        pushQuad(o01, n01, n11, o11);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the Separate Printable Nameplate (Sırt İsimlik Plakası) for supportless / zero-waste printing.
 */
export function mergeGeometries(geoms) {
  const valid = (geoms || []).filter(Boolean);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  let totalVerts = 0;
  const lists = valid.map((g) => {
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
    if (l.norm) normals.set(l.norm.array, offset * 3);
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
  geom.computeVertexNormals();
  return geom;
}

export function buildCoatBackPlateGeometry(
  layout,
  plateW,
  plateH,
  plateThickness = 1.6,
  elevation = 64,
  wallThickness = 2.2,
  holes = []
) {
  const shape = new THREE.Shape();
  const hw = plateW * 0.5;
  const hh = plateH * 0.5;
  const r = 3.5;

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  shape.closePath();

  const hasHoles = Boolean(holes && holes.length > 0);
  if (hasHoles) {
    shape.holes.push(...holes);
  }

  const extrudeSettings = {
    depth: plateThickness,
    bevelEnabled: !hasHoles,
    bevelThickness: 0.35,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 32,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.computeBoundingBox();

  const mappedY = layout.coatBottomY + (elevation / 100) * layout.coatSpan;
  const pos = geom.attributes.position;
  const embed = Math.min(0.45, Math.max(0.8, Number(wallThickness) || 2.2) * 0.35);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);

    const worldX = lx;
    const worldY = mappedY + ly;
    const surfZ = getExactCoatSurfaceZ(worldX, worldY, false, layout);
    const worldZ = surfZ + embed - lz;

    pos.setX(i, worldX);
    pos.setY(i, worldY);
    pos.setZ(i, worldZ);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function buildCoatBackIslandsGeometry(
  layout,
  islandShapes,
  plateThickness = 1.6,
  elevation = 64,
  wallThickness = 2.2
) {
  if (!islandShapes || islandShapes.length === 0) return null;

  const extrudeSettings = {
    depth: plateThickness,
    bevelEnabled: false,
    curveSegments: 24,
  };

  const geom = new THREE.ExtrudeGeometry(islandShapes, extrudeSettings);
  geom.computeBoundingBox();

  const mappedY = layout.coatBottomY + (elevation / 100) * layout.coatSpan;
  const pos = geom.attributes.position;
  const embed = Math.min(0.45, Math.max(0.8, Number(wallThickness) || 2.2) * 0.35);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);

    const worldX = lx;
    const worldY = mappedY + ly;
    const surfZ = getExactCoatSurfaceZ(worldX, worldY, false, layout);
    const worldZ = surfZ + embed - lz;

    pos.setX(i, worldX);
    pos.setY(i, worldY);
    pos.setZ(i, worldZ);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function buildCoatBackInlaysGeometry(
  layout,
  inlayShapes,
  elevation = 64,
  wallThickness = 2.2,
  inlayDepth = 0.3
) {
  if (!inlayShapes || inlayShapes.length === 0) return null;

  const extrudeSettings = {
    depth: inlayDepth,
    bevelEnabled: false,
    curveSegments: 24,
  };

  const geom = new THREE.ExtrudeGeometry(inlayShapes, extrudeSettings);
  geom.computeBoundingBox();

  const mappedY = layout.coatBottomY + (elevation / 100) * layout.coatSpan;
  const pos = geom.attributes.position;
  const embed = Math.min(0.45, Math.max(0.8, Number(wallThickness) || 2.2) * 0.35);

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);

    const worldX = lx;
    const worldY = mappedY + ly;
    const surfZ = getExactCoatSurfaceZ(worldX, worldY, false, layout);
    const worldZ = surfZ + embed * 0.5 - lz;

    pos.setX(i, worldX);
    pos.setY(i, worldY);
    pos.setZ(i, worldZ);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Converts a Three.js ExtrudeGeometry (built with bevelSegments: 1) into a support-free
 * relief mesh by flattening any negative-Z back undercut bevel onto z = 0 so lz in [0, depth + bevelThickness].
 */
function prepareSupportlessExtrude(geom, bevelThickness = 0) {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < 0) pos.setZ(i, 0);
  }
  pos.needsUpdate = true;
  geom.computeBoundingBox();
  return geom;
}

/**
 * Removes strictly zero-area needle sliver triangles (area < 1e-6) from flat extruded caps
 * without punching non-manifold holes in valid cap surface geometry.
 */
function cleanSubdividedCapSlivers(geom, minArea2D = 1e-6) {
  const pos = geom.attributes.position;
  const out = [];
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
    const cx = pos.getX(i + 2), cy = pos.getY(i + 2), cz = pos.getZ(i + 2);
    const isCap = Math.abs(az - bz) < 0.002 && Math.abs(bz - cz) < 0.002;
    if (isCap) {
      const area2D = 0.5 * Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay));
      if (area2D < minArea2D) continue;
    }
    out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  const cleanGeom = new THREE.BufferGeometry();
  cleanGeom.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  cleanGeom.computeVertexNormals();
  return cleanGeom;
}

/**
 * Builds the Wrap-Around Rolled Neck Collar Stand (Part A) and Crisp Front Notched Lapels (Part B).
 * Matches the open V-neck collar geometry in the physical 3D print reference with support-free (<= 40 deg) overhangs.
 */
export function buildNotchedLapelGeometry(
  layout,
  collarOpeningWidth = 28,
  wallThickness = 2.2
) {
  const wt = Math.max(0.8, Number(wallThickness) || 2.2);
  const thickScale = clamp(wt / 3.0, 0.38, 1.15);
  const maxYCap = layout.totalH ?? layout.coatTopY + 1.45;
  const geoms = [];
  const topY = layout.coatTopY;
  const botY = layout.coatBottomY;
  const coatSpan = layout.coatSpan;

  const profTop = evalCoatProfile(
    1.0,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const neckOuterHw = profTop.neckOuterHw;

  // Part A: Rolled Back & Side Collar Stand extending around to chest corners (alpha in [-0.68*PI, +0.68*PI])
  const numU = 84;
  const numV = 12;
  const gridO = [];
  const gridI = [];

  for (let j = 0; j <= numV; j++) {
    const s = j / numV;
    const vBand = lerp(0.90, 1.0, s);
    const rowO = [];
    const rowI = [];
    for (let i = 0; i <= numU; i++) {
      const u = i / numU;
      const alpha = lerp(-Math.PI * 0.68, Math.PI * 0.68, u);
      const th = Math.PI * 1.5 + alpha;
      const pt = evalCoatOuterPoint(vBand, th, layout, wt);
      const endFade = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
      const baseEmbed = -0.65 * thickScale * (1.0 - smoothstep(0.0, 0.35, s));
      const outThick =
        2.0 * thickScale * Math.sin(s * Math.PI * 0.8 + 0.15) * endFade + baseEmbed;
      const yLift = 1.45 * smoothstep(0.45, 1.0, s) * endFade;
      const nx = Math.cos(th);
      const nz = Math.sin(th);

      const ox = pt.x + nx * outThick;
      const oy = Math.min(maxYCap, pt.y + yLift);
      const oz = pt.z + nz * outThick;

      const dropFactor = 1.0 - smoothstep(0.0, 0.25, s);
      const approxSpan = wt * 0.55;
      const iy = oy - approxSpan * 1.28 * dropFactor;
      const vInner = clamp((iy - botY) / Math.max(1, coatSpan), 0.01, 1.0);
      const ptI = evalCoatOuterPoint(vInner, th, layout, wt);
      const inPtI = evalCoatInnerPoint(vInner, th, layout, wt, null, null);
      const ix = lerp(ptI.x, inPtI.x, 0.45);
      const iz = lerp(ptI.z, inPtI.z, 0.45);

      rowO.push({ x: ox, y: oy, z: oz });
      rowI.push({ x: ix, y: iy, z: iz });
    }
    gridO.push(rowO);
    gridI.push(rowI);
  }

  const cTris = [];
  const pushCTri = (a, b, c) =>
    cTris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const pushCQuad = (a, b, c, d) => {
    pushCTri(a, b, c);
    pushCTri(a, c, d);
  };

  for (let j = 0; j < numV; j++) {
    for (let i = 0; i < numU; i++) {
      pushCQuad(gridO[j][i], gridO[j + 1][i], gridO[j + 1][i + 1], gridO[j][i + 1]);
      pushCQuad(gridI[j][i], gridI[j][i + 1], gridI[j + 1][i + 1], gridI[j + 1][i]);
      if (j === 0) pushCQuad(gridI[0][i], gridI[0][i + 1], gridO[0][i + 1], gridO[0][i]);
      if (j === numV - 1)
        pushCQuad(gridO[numV][i], gridI[numV][i], gridI[numV][i + 1], gridO[numV][i + 1]);
      if (i === 0)
        pushCQuad(gridO[j][0], gridI[j][0], gridI[j + 1][0], gridO[j + 1][0]);
      if (i === numU - 1)
        pushCQuad(gridI[j][numU], gridO[j][numU], gridO[j + 1][numU], gridI[j + 1][numU]);
    }
  }

  const collarBandGeom = new THREE.BufferGeometry();
  collarBandGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(cTris, 3)
  );
  collarBandGeom.computeVertexNormals();
  geoms.push(collarBandGeom);

  // Part B: Crisp Front Notched Lapels conformed tightly onto exact chest & neck curvature
  const vBottomY = botY + coatSpan * 0.54;
  const vTopY = topY - 0.3;
  const vSpan = vTopY - vBottomY;
  const innerEdgeTopX = Math.max(8.5, neckOuterHw - 4.2);
  const lapelMidHw = lerp(16.0, neckOuterHw, 0.45);
  const backEmbed = Math.min(1.05, wt * 0.45);
  const bevelThick = 0.28 * thickScale;
  const maxLz = 1.20 + backEmbed + bevelThick;

  const x3Abs = lapelMidHw * 0.63;
  const x4Abs = Math.min(
    neckOuterHw - 0.55,
    lerp(lapelMidHw, neckOuterHw, 0.46) * 0.90
  );
  const dxNotch = Math.abs(x4Abs - x3Abs);
  const y4Val = Math.min(
    vBottomY + vSpan * 0.70,
    Math.max(vBottomY + vSpan * 0.62, vBottomY + vSpan * 0.505 + dxNotch * 1.22)
  );

  for (const side of [-1, 1]) {
    const rawShape = new THREE.Shape();
    const pts = [
      [side * 1.1, vBottomY],
      [side * (lapelMidHw * 0.44), vBottomY + vSpan * 0.24],
      [side * (lapelMidHw * 0.82), vBottomY + vSpan * 0.45], // Lower lapel outer peak
      [side * x3Abs, vBottomY + vSpan * 0.505], // Notch inner vertex
      [side * x4Abs, y4Val], // Upper collar leaf outer corner
      [side * (neckOuterHw - 0.15), vBottomY + vSpan * 0.84],  // Upper collar outer shoulder edge
      [side * (neckOuterHw - 0.95), vTopY],                   // Top outer shoulder join flush with Part A
      [side * innerEdgeTopX, vTopY],                          // Top inner neck corner flush with Part A
      [side * (innerEdgeTopX * 0.75), vBottomY + vSpan * 0.75],
      [side * (innerEdgeTopX * 0.50), vBottomY + vSpan * 0.50],
      [side * (innerEdgeTopX * 0.25), vBottomY + vSpan * 0.25],
      [0, vBottomY + 1.4],
    ];
    if (side > 0) pts.reverse();

    rawShape.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) rawShape.lineTo(pts[k][0], pts[k][1]);
    rawShape.closePath();

    const [shape] = resampleShapesForCleanExtrusion(rawShape, 0.9);

    let g = new THREE.ExtrudeGeometry(shape, {
      depth: 1.20 + backEmbed,
      bevelEnabled: true,
      bevelThickness: bevelThick,
      bevelSize: 0.32 * thickScale,
      bevelSegments: 1,
      curveSegments: 8,
    });
    g = prepareSupportlessExtrude(g, bevelThick);
    // Subdivide lapel mesh prior to conformal Z projection and prune collinear cap slivers
    g = cleanSubdividedCapSlivers(subdivideExtrudedGeometry(g, 1.3), 0.025);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const lz = pos.getZ(i);
      const topFade = 1.0 - smoothstep(vBottomY + vSpan * 0.88, vTopY - 0.2, y);
      const yDrafted = Math.min(maxYCap, y - (maxLz - lz) * 1.32 * topFade);
      const surfZ = getExactCoatSurfaceZ(x, yDrafted, true, layout);
      pos.setX(i, x);
      pos.setY(i, yDrafted);
      pos.setZ(i, surfZ - backEmbed + lz);
    }
    pos.needsUpdate = true;
    computeSmoothCreasedNormals(g, 0.65);
    geoms.push(g);
  }

  return geoms;
}

/**
 * Builds the sculpted 3D Inner Shirt & Collarbone Crew-Neck Ribbing (Ic_Gomlek_Yakasi)
 * filling the lower/mid V-neck between the lapels so the chest is never open like a decollete.
 */
export function buildInnerShirtGeometry(
  layout,
  collarOpeningWidth = 28,
  wallThickness = 2.2
) {
  const wt = Math.max(0.8, Number(wallThickness) || 2.2);
  const vRecess = Math.min(0.80, wt * 0.25);
  const topY = layout.coatTopY;
  const botY = layout.coatBottomY;
  const coatSpan = layout.coatSpan;

  const profTop = evalCoatProfile(
    1.0,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const neckOuterHw = profTop.neckOuterHw;
  const innerEdgeTopX = Math.max(8.5, neckOuterHw - 4.2);

  const vBottomY = botY + coatSpan * 0.54;
  const vTopY = topY - 0.3;
  const vSpan = vTopY - vBottomY;

  const centerTopY = topY - coatSpan * 0.145;
  const sideTopY = Math.min(topY - 2.2, centerTopY + 6.8);

  const numU = 36;
  const numV = 24;
  const gridO = [];
  const gridI = [];

  for (let j = 0; j <= numV; j++) {
    const s = j / numV;
    const rowO = [];
    const rowI = [];

    // Evaluate width at row s so left/right edges tuck 1.5mm under the lapels
    const yApproxSide = lerp(vBottomY + 0.4, sideTopY, s);
    const sLapel = clamp((yApproxSide - vBottomY) / Math.max(1, vSpan), 0, 1);
    const halfW = innerEdgeTopX * sLapel + 1.5;

    const isCollarRib = s >= 0.82;
    const ribPhase = isCollarRib ? (s - 0.82) / 0.18 : 0;
    const ribBump = isCollarRib ? 0.52 * Math.sin(ribPhase * Math.PI) : 0;
    const ribSeam =
      s >= 0.77 && s < 0.82
        ? -0.22 * Math.sin(((s - 0.77) / 0.05) * Math.PI)
        : 0;

    for (let i = 0; i <= numU; i++) {
      const u = (i / numU) * 2 - 1; // [-1, +1]
      const x = u * halfW;
      const yTopAtX = lerp(centerTopY, sideTopY, u * u);
      const y = lerp(vBottomY + 0.4, yTopAtX, s);
      const surfZ = getExactCoatSurfaceZ(x, y, true, layout);

      // Subtle center vertical shirt seam detail
      const centerCrease =
        !isCollarRib ? -0.14 * Math.exp(-Math.pow(x / 1.1, 2)) : 0;

      const frontZ = surfZ - vRecess * 0.4 + ribBump + ribSeam + centerCrease;
      const backZ = surfZ - Math.min(1.25, wt * 0.65);
      const bottomDrop =
        Math.max(0.15, frontZ - backZ) * 1.28 * (1.0 - smoothstep(0.0, 0.16, s));

      rowO.push({ x, y, z: frontZ });
      rowI.push({ x, y: y - bottomDrop, z: backZ });
    }
    gridO.push(rowO);
    gridI.push(rowI);
  }

  const tris = [];
  const pushTri = (a, b, c) =>
    tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  for (let j = 0; j < numV; j++) {
    for (let i = 0; i < numU; i++) {
      pushQuad(gridO[j][i], gridO[j][i + 1], gridO[j + 1][i + 1], gridO[j + 1][i]);
      pushQuad(gridI[j][i], gridI[j + 1][i], gridI[j + 1][i + 1], gridI[j][i + 1]);
      if (j === 0)
        pushQuad(gridI[0][i], gridI[0][i + 1], gridO[0][i + 1], gridO[0][i]);
      if (j === numV - 1)
        pushQuad(
          gridO[numV][i],
          gridO[numV][i + 1],
          gridI[numV][i + 1],
          gridI[numV][i]
        );
      if (i === 0)
        pushQuad(gridI[j][0], gridO[j][0], gridO[j + 1][0], gridI[j + 1][0]);
      if (i === numU - 1)
        pushQuad(
          gridI[j][numU],
          gridI[j + 1][numU],
          gridO[j + 1][numU],
          gridO[j][numU]
        );
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the 4 realistic cupped Coat Buttons (rimmed perimeter + concave center dish).
 */
export function buildCoatButtonsGeometry(layout) {
  const buttonGeoms = [];
  const startY = layout.coatBottomY + layout.coatSpan * 0.125;
  const endY = layout.coatBottomY + layout.coatSpan * 0.495;
  const numButtons = 4;
  const buttonR = 2.55;

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(buttonR * 1.04, 0.0),
    new THREE.Vector2(buttonR * 1.04, 0.55),
    new THREE.Vector2(buttonR * 0.92, 1.35),
    new THREE.Vector2(buttonR * 0.66, 1.35),
    new THREE.Vector2(buttonR * 0.52, 0.88),
    new THREE.Vector2(0.0, 0.85),
  ];

  for (let b = 0; b < numButtons; b++) {
    const t = b / (numButtons - 1);
    const by = lerp(startY, endY, t);
    const bx = -1.2;
    const surfZ = getExactCoatSurfaceZ(bx, by, true, layout);

    const g = new THREE.LatheGeometry(pts, 28);
    g.rotateX(Math.PI / 2);
    g.translate(bx, by, surfZ - 0.15);
    buttonGeoms.push(g);
  }

  return buttonGeoms;
}

/**
 * Computes responsive Chest Pocket position and width so widening the collar opening
 * smoothly shifts the left chest pocket & chest title outward with guaranteed lapel clearance.
 */
export function getChestPocketLayout(layout) {
  const collarW = layout.collarOpeningWidth ?? 28;
  const coatW = layout.coatWidth ?? 82;
  const coatD = layout.coatDepth ?? 50;
  const botY = layout.coatBottomY;
  const topY = layout.coatTopY;
  const span = layout.coatSpan;

  const profTop = evalCoatProfile(1.0, coatW, coatD, collarW);
  const profChest = evalCoatProfile(0.61, coatW, coatD, collarW);
  const neckOuterHw = profTop.neckOuterHw;
  const lapelMidHw = lerp(16.0, neckOuterHw, 0.45);

  const vBottomY = botY + span * 0.54;
  const vTopY = topY - 0.3;
  const vSpan = vTopY - vBottomY;
  const peakY = vBottomY + vSpan * 0.45;
  const peakX = lapelMidHw * 0.82;
  const x4Abs = Math.min(
    neckOuterHw - 0.55,
    lerp(lapelMidHw, neckOuterHw, 0.46) * 0.90
  );

  // Maximum outer reach of the lapel at/near the chest pocket height
  const lapelMaxX = Math.max(peakX, x4Abs, neckOuterHw * 0.72);

  const extraCollar = Math.max(0, collarW - 22);
  const widthScale = coatW / 82;

  // Pocket width scales naturally with coat width, slightly slimmer when collar is extra wide
  const chestW = clamp((13.2 - extraCollar * 0.08) * widthScale, 11.2, 15.0);
  const chestH = 14.2;
  const chestY = botY + span * 0.61;

  // Clearance from the lapel outer edge (yaka yaklaştıkça cebi kenara kaydıran dinamik pay)
  const clearance = 2.8 * widthScale;
  const minClearChestX = lapelMaxX + clearance + chestW * 0.5;
  const targetChestX = (15.5 + extraCollar * 0.35) * widthScale + chestW * 0.5;

  const maxSafeChestX = profChest.hw - chestW * 0.5 - 2.5 * widthScale;
  const chestX = clamp(Math.max(targetChestX, minClearChestX), 14.0, maxSafeChestX);

  return { chestX, chestY, chestW, chestH };
}

/**
 * Builds a 100% watertight, manifold 3D curved patch pocket that perfectly conforms
 * to the outer garment surface with supportless (<= 40 deg) bottom chamfer,
 * integrated top welt hem band, and zero degenerate/overlapping faces.
 */
function buildWatertightCurvedPocketGeometry(
  layout,
  centerX,
  centerY,
  w,
  h,
  cornerR = 3.0,
  depth = 1.35,
  embed = 0.35,
  weltH = 2.4,
  nx = 14,
  ny = 16
) {
  const hw = w * 0.5;
  const hh = h * 0.5;

  const xs = [];
  for (let i = 0; i <= nx; i++) xs.push(-hw + (2 * hw) * (i / nx));
  const ys = [];
  for (let j = 0; j <= ny; j++) ys.push(-hh + (2 * hh) * (j / ny));

  const mapCorner = (x, y) => {
    if (y < -hh + cornerR && Math.abs(x) > hw - cornerR) {
      const signX = x > 0 ? 1.0 : -1.0;
      const cx = signX * (hw - cornerR);
      const cy = -hh + cornerR;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > cornerR && dist > 1e-6) {
        return [cx + dx * (cornerR / dist), cy + dy * (cornerR / dist)];
      }
    }
    return [x, y];
  };

  const grid2D = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) row.push(mapCorner(xs[i], ys[j]));
    grid2D.push(row);
  }

  const positions = [];
  const indices = [];

  // 1. Front cap vertices
  const frontIndices = [];
  for (let j = 0; j <= ny; j++) {
    const rowIdx = [];
    for (let i = 0; i <= nx; i++) {
      const [lx, ly] = grid2D[j][i];
      const idx = positions.length / 3;

      // Support-free bottom draft (<= 40 deg overhang for clean 3D printing without supports)
      const bottomDraftT = Math.max(0.0, Math.min(1.0, (-hh + 3.2 - ly) / 3.2));

      // Raised top welt hem band detail (+0.25mm)
      const weltT = Math.max(0.0, Math.min(1.0, (ly - (hh - weltH)) / 0.8));

      // Subtle side bevel towards boundary
      const edgeDistX = hw - Math.abs(lx);
      const sideBevelT = Math.max(0.0, Math.min(1.0, edgeDistX / 0.8));

      const frontZOffset =
        (depth + weltT * 0.28) * (0.82 + 0.18 * sideBevelT) -
        bottomDraftT * (depth * 0.70);

      const wx = centerX + lx;
      const wy = centerY + ly;
      const surfZ = getExactCoatSurfaceZ(wx, wy, true, layout);
      const wz = surfZ + frontZOffset;

      positions.push(wx, wy, wz);
      rowIdx.push(idx);
    }
    frontIndices.push(rowIdx);
  }

  // 1b. Front cap faces (normal pointing outward +Z)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = frontIndices[j][i];
      const v10 = frontIndices[j][i + 1];
      const v11 = frontIndices[j + 1][i + 1];
      const v01 = frontIndices[j + 1][i];
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  // 2. Back cap vertices (embedded cleanly into the coat body wall)
  const backIndices = [];
  for (let j = 0; j <= ny; j++) {
    const rowIdx = [];
    for (let i = 0; i <= nx; i++) {
      const [lx, ly] = grid2D[j][i];
      const idx = positions.length / 3;

      const wx = centerX + lx;
      const wy = centerY + ly;
      const surfZ = getExactCoatSurfaceZ(wx, wy, true, layout);
      const wz = surfZ - embed;

      positions.push(wx, wy, wz);
      rowIdx.push(idx);
    }
    backIndices.push(rowIdx);
  }

  // 2b. Back cap faces (normal pointing inward into coat wall)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = backIndices[j][i];
      const v10 = backIndices[j][i + 1];
      const v11 = backIndices[j + 1][i + 1];
      const v01 = backIndices[j + 1][i];
      indices.push(v00, v11, v10);
      indices.push(v00, v01, v11);
    }
  }

  // 3. Side wall quads connecting front boundary to back boundary
  const boundary = [];
  for (let i = 0; i < nx; i++) boundary.push([i, 0, i + 1, 0]);
  for (let j = 0; j < ny; j++) boundary.push([nx, j, nx, j + 1]);
  for (let i = nx; i > 0; i--) boundary.push([i, ny, i - 1, ny]);
  for (let j = ny; j > 0; j--) boundary.push([0, j, 0, j - 1]);

  for (const [i1, j1, i2, j2] of boundary) {
    const f1 = frontIndices[j1][i1];
    const f2 = frontIndices[j2][i2];
    const b1 = backIndices[j1][i1];
    const b2 = backIndices[j2][i2];
    indices.push(f1, f2, b2);
    indices.push(f1, b2, b1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the Chest Pocket (Left chest: X > 0) and the Two Lower Side Pockets
 * as 100% watertight, manifold 3D solids with integrated welt rims and support-free chamfers.
 */
export function buildCoatPocketsGeometry(layout, wallThickness = 2.2) {
  const pockets = [];
  const span = layout.coatSpan;
  const botY = layout.coatBottomY;
  const wScale = (layout.coatWidth ?? 82) / 82;
  const wt = Math.max(0.8, Number(wallThickness) || 2.2);
  const safeEmbed = Math.min(0.38, wt * 0.25);

  // 1. Left Chest Pocket (responsive to collarOpeningWidth)
  const { chestX, chestY, chestW, chestH } = getChestPocketLayout(layout);
  const gChest = buildWatertightCurvedPocketGeometry(
    layout,
    chestX,
    chestY,
    chestW,
    chestH,
    2.8,
    1.35,
    safeEmbed,
    2.4,
    14,
    16
  );
  pockets.push({ name: 'Gogus_Cebi', geom: gChest });

  // 2. Two Lower Side Pockets (scaled cleanly with coatWidth)
  const lowerW = 14.8 * wScale;
  const lowerH = 17.0;
  const lowerY = botY + span * 0.175;

  for (const side of [-1, 1]) {
    const px = side * 18.0 * wScale;
    const gLow = buildWatertightCurvedPocketGeometry(
      layout,
      px,
      lowerY,
      lowerW,
      lowerH,
      3.6,
      1.65,
      safeEmbed,
      2.7,
      14,
      18
    );
    pockets.push({
      name: side < 0 ? 'Alt_Sag_Cep' : 'Alt_Sol_Cep',
      geom: gLow,
    });
  }

  return pockets;
}

/**
 * Builds the Bent Coat Sleeves (Hands-in-Pockets Pose) matching the physical 3D print reference:
 * - Piecewise ruler-straight upper arm & forearm segments connected by quadratic Bezier shoulder & elbow fillets (zero S-curve noodle shape)
 * - Shoulder cap ceiling follows torso shoulder slope seamlessly
 * - Inner arm face merges cleanly into coat wall and NEVER enters inner pencil cavity
 * - Multi-fold elbow creases strictly on inner-front elbow bend
 * - Crisp engraved cuff seam line & flat cuff landing cleanly into lower pocket top corner + hand nub detail
 * - Watertight CCW winding with shoulder & pocket caps
 */
export function buildCoatArmsGeometry(
  layout,
  wallThickness = 2.2,
  cavityWidth = null,
  cavityDepth = null
) {
  const armGeoms = [];
  const span = layout.coatSpan;
  const botY = layout.coatBottomY;
  const collarOpeningWidth = layout.collarOpeningWidth ?? 28;
  const wScale = (layout.coatWidth ?? 82) / 82;
  const dScale = (layout.coatDepth ?? 50) / 50;
  const rScale = wScale * 0.892;
  const profShoulder = evalCoatProfile(
    0.76,
    layout.coatWidth,
    layout.coatDepth,
    collarOpeningWidth
  );
  const trunkHw = profShoulder.trunkHwBase;
  const neckHw = profShoulder.neckOuterHw;

  const ringsCount = 88;
  const segments = 44;

  for (const side of [-1, 1]) {
    const pCollar = new THREE.Vector3(
      side * (neckHw - 0.4 * wScale),
      botY + span * 0.88,
      0.2 * dScale
    );
    const pShoulder = new THREE.Vector3(
      side * (trunkHw * 0.88),
      botY + span * 0.80,
      0.8 * dScale
    );
    const pElbow = new THREE.Vector3(
      side * (trunkHw * 1.108),
      botY + span * 0.485,
      3.2 * dScale
    );
    const pCuff = new THREE.Vector3(
      side * 21.8 * wScale,
      botY + span * 0.252,
      17.0 * dScale
    );
    const pWristIn = new THREE.Vector3(
      side * 18.8 * wScale,
      botY + span * 0.195,
      16.5 * dScale
    );

    const evalArmSpine = (t) => {
      if (t <= 0.20) {
        const u = t / 0.20;
        const pUpperStart = new THREE.Vector3().lerpVectors(
          pShoulder,
          pElbow,
          0.14
        );
        const a = new THREE.Vector3().lerpVectors(pCollar, pShoulder, u);
        const b = new THREE.Vector3().lerpVectors(pShoulder, pUpperStart, u);
        return new THREE.Vector3().lerpVectors(a, b, u);
      } else if (t <= 0.44) {
        const u = (t - 0.20) / 0.24;
        const s = lerp(0.14, 0.85, u);
        return new THREE.Vector3().lerpVectors(pShoulder, pElbow, s);
      } else if (t <= 0.58) {
        const u = (t - 0.44) / 0.14;
        const pBefore = new THREE.Vector3().lerpVectors(
          pShoulder,
          pElbow,
          0.85
        );
        const pAfter = new THREE.Vector3().lerpVectors(pElbow, pCuff, 0.16);
        const a = new THREE.Vector3().lerpVectors(pBefore, pElbow, u);
        const b = new THREE.Vector3().lerpVectors(pElbow, pAfter, u);
        return new THREE.Vector3().lerpVectors(a, b, u);
      } else if (t <= 0.88) {
        const u = (t - 0.58) / 0.30;
        const s = lerp(0.16, 1.0, u);
        return new THREE.Vector3().lerpVectors(pElbow, pCuff, s);
      } else {
        const u = (t - 0.88) / 0.12;
        return new THREE.Vector3().lerpVectors(pCuff, pWristIn, u);
      }
    };

    const points = [];
    for (let i = 0; i <= ringsCount; i++) {
      points.push(evalArmSpine(i / ringsCount));
    }

    const tangents = [];
    for (let i = 0; i <= ringsCount; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(ringsCount, i + 1);
      tangents.push(
        new THREE.Vector3().subVectors(points[i1], points[i0]).normalize()
      );
    }

    // Parallel-transported smooth frames to guarantee zero twisting
    const normals = [];
    const binormals = [];
    const initN = new THREE.Vector3(side, 0, 0);
    initN
      .sub(tangents[0].clone().multiplyScalar(initN.dot(tangents[0])))
      .normalize();
    normals.push(initN);
    binormals.push(
      new THREE.Vector3().crossVectors(tangents[0], initN).normalize()
    );

    for (let i = 1; i <= ringsCount; i++) {
      const Tprev = tangents[i - 1];
      const Tcurr = tangents[i];
      const rotAxis = new THREE.Vector3().crossVectors(Tprev, Tcurr);
      let N = normals[i - 1].clone();
      if (rotAxis.lengthSq() > 1e-8) {
        rotAxis.normalize();
        const angle = Math.acos(clamp(Tprev.dot(Tcurr), -1, 1));
        N.applyAxisAngle(rotAxis, angle);
      }
      N.sub(Tcurr.clone().multiplyScalar(N.dot(Tcurr))).normalize();
      const B = new THREE.Vector3().crossVectors(Tcurr, N).normalize();
      normals.push(N);
      binormals.push(B);
    }

    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= ringsCount; i++) {
      const t = i / ringsCount;
      const pt = points[i];
      const N = normals[i];
      const B = binormals[i];

      let baseR;
      if (t < 0.18) {
        baseR = lerp(5.2, 9.6, smoothstep(0.0, 0.18, t));
      } else if (t <= 0.50) {
        baseR = lerp(9.6, 9.2, (t - 0.18) / 0.32);
      } else if (t <= 0.88) {
        baseR = lerp(9.2, 8.1, (t - 0.50) / 0.38);
      } else if (t <= 0.895) {
        // Crisp stepped cuff opening dropping from 8.1mm to tucked wrist 4.8mm
        baseR = lerp(8.1, 4.8, (t - 0.88) / 0.015);
      } else {
        baseR = lerp(4.8, 4.0, (t - 0.895) / 0.105);
      }

      // Crisp cuff seam groove (t in [0.80, 0.82]) & raised flat cuff band ([0.82, 0.88])
      let cuffMod = 0;
      if (t >= 0.80 && t < 0.82) {
        cuffMod = -0.38 * Math.sin(((t - 0.80) / 0.02) * Math.PI);
      } else if (t >= 0.82 && t <= 0.88) {
        cuffMod = 0.22;
      }

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const dirX = N.x * cos + B.x * sin;
        const dirY = N.y * cos + B.y * sin;
        const dirZ = N.z * cos + B.z * sin;

        const lateralOut = dirX * side;
        const forwardFace = dirZ;

        let r = (baseR + cuffMod) * rScale;

        // Armhole vertical crease groove where front of upper arm meets torso
        if (t >= 0.14 && t <= 0.42) {
          const seamEnv = Math.sin(((t - 0.14) / 0.28) * Math.PI);
          const seamDir =
            Math.exp(-Math.pow((lateralOut + 0.38) / 0.25, 2)) *
            smoothstep(0.15, 0.8, forwardFace);
          r -= 0.85 * rScale * seamEnv * seamDir;
        }

        // Realistic Inner-Front Elbow Creases (strictly inside front-inner bend, zero ripple on outer edge)
        if (t >= 0.42 && t <= 0.60) {
          const uRaw = (t - 0.42) / 0.18;
          const uFold = clamp(uRaw + 0.07 * lateralOut, 0, 1);
          const env = Math.pow(Math.sin(uFold * Math.PI), 1.2);
          const wave = -0.9 * rScale * Math.cos(uFold * Math.PI * 3.0);
          const innerFrontMask =
            smoothstep(0.15, 0.75, forwardFace) *
            (1.0 - smoothstep(0.05, 0.40, lateralOut));
          r += env * wave * innerFrontMask;
        }

        let vx = pt.x + dirX * r;
        let vy = pt.y + dirY * r;
        let vz = pt.z + dirZ * r;

        // Smooth shoulder slope ceiling so shoulder-to-sleeve transition forms one clean tailored curve
        if (t < 0.22) {
          const shoulderCeilY =
            botY +
            span * 0.965 -
            Math.max(0, Math.abs(vx) - (neckHw - 1.0)) * 0.44;
          if (vy > shoulderCeilY) {
            vy = shoulderCeilY;
          }
        }

        // Watertight Inner-Cavity Safety Clamp
        const vCheck = clamp((vy - botY) / Math.max(1, span), 0.01, 0.99);
        const thCheck = Math.atan2(vz, vx);
        const inPt = evalCoatInnerPoint(
          vCheck,
          thCheck,
          layout,
          wallThickness,
          cavityWidth,
          cavityDepth
        );
        const outPt = evalCoatOuterPoint(vCheck, thCheck, layout, wallThickness);

        const safeX = lerp(inPt.x, outPt.x, 0.48);
        const safeZ = lerp(inPt.z, outPt.z, 0.48);
        const rVert = Math.hypot(vx, vz);
        const rSafe = Math.hypot(safeX, safeZ);

        if (rVert < rSafe && rVert > 0.001) {
          const pushScale = rSafe / rVert;
          vx *= pushScale;
          vz *= pushScale;
        } else if (t < 0.34 && lateralOut < -0.40 && rVert > rSafe && rVert > 0.001) {
          // Weld strictly inner armpit sleeve face into torso wall without creasing upper shoulder dome
          const weldWeight =
            smoothstep(-0.40, -0.78, lateralOut) *
            (1.0 - smoothstep(0.20, 0.34, t));
          const rTarget = lerp(rVert, rSafe, weldWeight);
          const weldScale = rTarget / rVert;
          vx *= weldScale;
          vz *= weldScale;
        }

        vertices.push(vx, vy, vz);
        uvs.push(j / segments, t);
      }
    }

    for (let i = 1; i <= ringsCount; i++) {
      for (let j = 1; j <= segments; j++) {
        const a = (segments + 1) * (i - 1) + (j - 1);
        const b = (segments + 1) * i + (j - 1);
        const c = (segments + 1) * i + j;
        const d = (segments + 1) * (i - 1) + j;

        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    const clampPointOutsideCavity = (cx, cy, cz) => {
      const vc = clamp((cy - botY) / Math.max(1, span), 0.01, 0.99);
      const tc = Math.atan2(cz, cx);
      const inP = evalCoatInnerPoint(
        vc,
        tc,
        layout,
        wallThickness,
        cavityWidth,
        cavityDepth
      );
      const outP = evalCoatOuterPoint(vc, tc, layout, wallThickness);
      const sx = lerp(inP.x, outP.x, 0.48);
      const sz = lerp(inP.z, outP.z, 0.48);
      const rc = Math.hypot(cx, cz);
      const rs = Math.hypot(sx, sz);
      if (rc < rs && rc > 0.001) {
        return [cx * (rs / rc), cy, cz * (rs / rc)];
      }
      return [cx, cy, cz];
    };

    // Watertight top cap at shoulder (-T outward) safely clamped outside inner cavity
    let topX = 0;
    let topY = 0;
    let topZ = 0;
    for (let j = 0; j < segments; j++) {
      topX += vertices[j * 3];
      topY += vertices[j * 3 + 1];
      topZ += vertices[j * 3 + 2];
    }
    const [safeTopX, safeTopY, safeTopZ] = clampPointOutsideCavity(
      topX / segments,
      topY / segments,
      topZ / segments
    );
    const topCenterIdx = vertices.length / 3;
    vertices.push(safeTopX, safeTopY, safeTopZ);
    uvs.push(0.5, 0.5);
    for (let j = 1; j <= segments; j++) {
      indices.push(topCenterIdx, j, j - 1);
    }

    // Watertight bottom cap inside pocket (+T outward) safely clamped outside inner cavity
    const lastRingStart = ringsCount * (segments + 1);
    let botX = 0;
    let botYAvg = 0;
    let botZ = 0;
    for (let j = 0; j < segments; j++) {
      const baseIdx = (lastRingStart + j) * 3;
      botX += vertices[baseIdx];
      botYAvg += vertices[baseIdx + 1];
      botZ += vertices[baseIdx + 2];
    }
    const [safeBotX, safeBotY, safeBotZ] = clampPointOutsideCavity(
      botX / segments,
      botYAvg / segments,
      botZ / segments
    );
    const botCenterIdx = vertices.length / 3;
    vertices.push(safeBotX, safeBotY, safeBotZ);
    uvs.push(0.5, 0.5);
    for (let j = 1; j <= segments; j++) {
      indices.push(botCenterIdx, lastRingStart + (j - 1), lastRingStart + j);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    armGeoms.push({
      name: side < 0 ? 'Sag_Kol' : 'Sol_Kol',
      geom: geom,
    });

    // Subtle rounded hand/thumb corner bump right under outer cuff edge (matches ref photo!)
    const handNub = new THREE.SphereGeometry(1.22 * rScale, 16, 12);
    const nx = side * 23.4 * wScale;
    const ny = botY + span * 0.222;
    const nz = getExactCoatSurfaceZ(nx, ny, true, layout) + 0.85;
    handNub.translate(nx, ny, nz);
    armGeoms.push({
      name: side < 0 ? 'Sag_El_Detayi' : 'Sol_El_Detayi',
      geom: handNub,
    });
  }

  return armGeoms;
}

/**
 * Builds the 3D Stethoscope conformed cleanly onto the doctor's sloped neck & chest surface.
 */
export function buildStethoscopeGeometry(layout) {
  const botY = layout.coatBottomY;
  const span = layout.coatSpan;

  const ptOnChest = (x, v, zAdd = 0.85) => {
    const y = botY + span * v;
    const z = getExactCoatSurfaceZ(x, y, true, layout) + zAdd;
    return new THREE.Vector3(x, y, z);
  };

  const neckLeft = ptOnChest(-10.5, 0.9, 1.1);
  const midLeft = ptOnChest(-13.5, 0.7, 1.0);
  const junction = ptOnChest(-1.5, 0.54, 1.0);
  const midRight = ptOnChest(13.0, 0.71, 1.0);
  const neckRight = ptOnChest(10.5, 0.9, 1.1);
  const discCenter = ptOnChest(-6.0, 0.42, 0.9);

  const curveLeft = new THREE.CatmullRomCurve3([neckLeft, midLeft, junction]);
  const tubeLeft = new THREE.TubeGeometry(curveLeft, 24, 1.4, 12, false);

  const curveRight = new THREE.CatmullRomCurve3([neckRight, midRight, junction]);
  const tubeRight = new THREE.TubeGeometry(curveRight, 24, 1.4, 12, false);

  const curveLower = new THREE.CatmullRomCurve3([junction, discCenter]);
  const tubeLower = new THREE.TubeGeometry(curveLower, 16, 1.55, 12, false);

  const discGeom = new THREE.CylinderGeometry(4.4, 4.6, 2.0, 28);
  discGeom.rotateX(Math.PI / 2);
  discGeom.translate(discCenter.x, discCenter.y, discCenter.z + 1.0);

  return {
    tubeLeft,
    tubeRight,
    tubeLower,
    discGeom,
  };
}
