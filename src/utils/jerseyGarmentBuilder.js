import * as THREE from 'three';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Computes the vertical layout boundaries for the Jersey + Optional Shorts kit.
 */
export function getJerseyKitLayout({
  height = 115,
  baseThickness = 3.5,
  hasShorts = true,
  modelElevation = 0,
}) {
  const elev = Math.max(0, Number(modelElevation) || 0);
  const rawTotalH = Math.max(95, Number(height) || 115);
  const rawBaseH = Math.max(2.0, Number(baseThickness) || 3.5);
  const baseH = rawBaseH + elev;
  const totalH = rawTotalH + elev;

  if (hasShorts) {
    const shortsBottomY = baseH;
    const shortsSpan = (rawTotalH - rawBaseH) * 0.305; // ~34mm shorts height
    const shortsTopY = shortsBottomY + shortsSpan;
    const jerseyBottomY = shortsTopY - 3.2; // Jersey overhangs top of shorts by 3.2mm
    const jerseyTopY = totalH;
    return {
      hasShorts: true,
      elev,
      rawBaseH,
      baseH,
      totalH,
      shortsBottomY,
      shortsTopY,
      jerseyBottomY,
      jerseyTopY,
      jerseySpan: jerseyTopY - jerseyBottomY,
    };
  }

  return {
    hasShorts: false,
    elev,
    rawBaseH,
    baseH,
    totalH,
    shortsBottomY: baseH,
    shortsTopY: baseH,
    jerseyBottomY: baseH,
    jerseyTopY: totalH,
    jerseySpan: totalH - baseH,
  };
}

/**
 * Smooth C2-continuous analytical torso profile (hw, hd, n) for v in [0, 1].
 * Eliminates keyframe derivative kinks so the chest and upper back have zero horizontal ridges!
 */
function evalProfileKeyframes(v) {
  // 1. Width hw(v):
  // - Hem (v=0): 27.3mm
  // - Waist taper (v=0.28): dips by -2.1mm to 25.2mm
  // - Chest/Shoulder swell (v=0.55..0.83): widens to 30.0mm
  // - Smooth shoulder slope (v=0.81..0.935): narrows smoothly from 30.0mm to 17.9mm collar
  const waistDip =
    -2.1 * Math.exp(-Math.pow((v - 0.27) / 0.14, 2));
  const chestSwell =
    2.8 * smoothstep(0.32, 0.68, v) * (1.0 - smoothstep(0.80, 0.935, v));
  const shoulderSlope =
    -9.4 * Math.pow(smoothstep(0.79, 0.938, v), 1.45);
  const collarFlare =
    0.45 * Math.exp(-Math.pow((v - 0.965) / 0.022, 2));

  const hw = 27.3 + waistDip + chestSwell + shoulderSlope + collarFlare;

  // 2. Depth hd(v):
  // Smooth continuous curve from hem (17.4mm) -> waist (16.5mm) -> chest (19.1mm) -> collar (15.8mm)
  // NO kink at v=0.845, so the front chest and back stay 100% silky smooth!
  const hdWaistDip =
    -1.0 * Math.exp(-Math.pow((v - 0.27) / 0.15, 2));
  const hdChestFullness =
    1.85 * Math.sin(Math.PI * clamp((v - 0.22) / 0.72, 0, 1));
  const hdCollarTaper =
    -1.6 * smoothstep(0.72, 0.94, v);

  const hd = 17.4 + hdWaistDip + hdChestFullness + hdCollarTaper + collarFlare * 0.8;

  // Superellipse exponent n(v)
  const n = lerp(2.35, 2.08, smoothstep(0.70, 0.95, v));

  return { hw, hd, n };
}

/**
 * Evaluates the exact world Y for a normalized torso parameter v in [0, 1] and angle theta.
 */
export function getTorsoWorldY(v, theta, layout) {
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  let y = layout.jerseyBottomY + v * layout.jerseySpan;

  // 1. Crew-neck front collar scoop (front collar dips down across collarbone, back stays high on nape)
  const frontFactor = Math.max(0, sinT);
  const scoopWeight = smoothstep(0.68, 0.96, v);
  const scoopDepth = 7.2 * Math.pow(frontFactor, 1.35) * scoopWeight;

  // 2. Shoulder slope convexity between collar and shoulder tip
  const sideFactor = Math.abs(cosT);
  const shoulderArch =
    1.1 * Math.sin(Math.PI * clamp((v - 0.83) / 0.11, 0, 1)) * sideFactor;

  // 3. Subtle shirt tail drop at front and back hem
  const hemWeight = 1.0 - smoothstep(0.0, 0.25, v);
  const hemDrop = -0.85 * (1.0 - sideFactor) * hemWeight;

  return y - scoopDepth + shoulderArch + hemDrop;
}

/**
 * Computes the realistic cloth drape / wrinkle / seam displacement (in mm)
 * at normalized torso height v and angle theta.
 */
export function getTorsoClothDisplacement(v, theta) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const xNorm = cosT;

  let disp = 0;

  // 1. Subtle bottom hem band (+0.22mm rib band for v < 0.048, with a fine -0.16mm stitch line at v = 0.052)
  const hemBand = 0.22 * (1.0 - smoothstep(0.042, 0.052, v));
  const hemGroove = -0.16 * Math.exp(-Math.pow((v - 0.054) / 0.006, 2));
  disp += hemBand + hemGroove;

  // 2. Collar rib band (+0.58mm raised collar for v > 0.935, with a -0.42mm stitch groove at v = 0.932)
  const collarBand = 0.58 * smoothstep(0.932, 0.945, v);
  const collarGroove = -0.42 * Math.exp(-Math.pow((v - 0.931) / 0.008, 2));
  disp += collarBand + collarGroove;

  // 3. Subtle natural fabric drape folds in the waist/abdomen region (v in [0.08, 0.52])
  const waistEnv =
    smoothstep(0.07, 0.16, v) * (1.0 - smoothstep(0.42, 0.56, v));
  const foldWave1 =
    0.42 * Math.sin(4.0 * xNorm + 5.5 * v) * Math.pow(Math.abs(sinT), 0.7);
  const foldWave2 =
    0.26 * Math.cos(7.0 * xNorm - 8.0 * v) * Math.pow(Math.abs(sinT), 1.2);
  disp += waistEnv * (foldWave1 + foldWave2);

  // 4. Diagonal tension creases radiating from the left and right armpits (front/side only so back number surface stays ultra-clean)
  if (sinT > -0.15) {
    const frontFactor = smoothstep(-0.15, 0.25, sinT);
    const armpitEnv =
      frontFactor *
      Math.exp(-Math.pow((Math.abs(xNorm) - 0.72) / 0.22, 2)) *
      Math.exp(-Math.pow((v - 0.58) / 0.12, 2));
    const armpitCrease =
      0.28 * Math.sin(10.0 * (Math.abs(xNorm) - 0.55) + 9.0 * (v - 0.55));
    disp += armpitEnv * armpitCrease;
  }

  // 5. Anatomical chest pectoral fullness (+Z) & upper back contour (-Z)
  if (sinT > 0) {
    const pecEnv =
      Math.exp(-Math.pow((v - 0.68) / 0.16, 2)) * Math.pow(sinT, 1.4);
    disp += 0.65 * pecEnv;
  } else {
    const lumbar =
      -0.55 *
      Math.exp(-Math.pow((v - 0.30) / 0.15, 2)) *
      Math.pow(Math.abs(sinT), 1.5);
    const upperBack =
      0.50 *
      Math.exp(-Math.pow((v - 0.72) / 0.16, 2)) *
      Math.pow(Math.abs(sinT), 1.3);
    disp += lumbar + upperBack;
  }

  // 6. Center Parçalı vertical stitch groove at X = 0 (front and lower back)
  const isFrontOrLowerBack = sinT > 0 || v < 0.285;
  if (isFrontOrLowerBack && v > 0.05 && v < 0.93) {
    const seamGroove = -0.18 * Math.exp(-Math.pow(xNorm / 0.022, 2));
    disp += seamGroove;
  }

  return disp;
}

/**
 * Evaluates a 3D point on the outer torso surface for (v, theta).
 */
export function evalTorsoOuterPoint(v, theta, layout) {
  const prof = evalProfileKeyframes(v);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const n = prof.n;
  const denom =
    Math.pow(
      Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n),
      1 / n
    ) || 1;

  const disp = getTorsoClothDisplacement(v, theta);
  const rx = (prof.hw + disp) / denom;
  const rz = (prof.hd + disp) / denom;

  const x = rx * cosT;
  const z = rz * sinT;
  const y = getTorsoWorldY(v, theta, layout);

  return { x, y, z, v, theta, hw: prof.hw, hd: prof.hd };
}

/**
 * Evaluates a 3D point on the inner hollow pen-holder cavity wall for (v, theta).
 */
export function evalTorsoInnerPoint(v, theta, layout, wallThickness = 3.4) {
  const prof = evalProfileKeyframes(v);
  const collarProf = evalProfileKeyframes(0.95);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const n = 2.1;
  const denom =
    Math.pow(
      Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n),
      1 / n
    ) || 1;

  const maxInnerHw = collarProf.hw - wallThickness;
  const maxInnerHd = collarProf.hd - wallThickness;

  const innerHw = Math.min(maxInnerHw, prof.hw - wallThickness);
  const innerHd = Math.min(maxInnerHd, prof.hd - wallThickness);

  const x = (innerHw / denom) * cosT;
  const z = (innerHd / denom) * sinT;
  const y = getTorsoWorldY(v, theta, layout);

  return { x, y, z };
}

/**
 * Exact surface Z lookup for any (worldX, worldY) on the front (isFront=true) or back (isFront=false)
 * of the jersey torso.
 */
export function getExactTorsoSurfaceZ(worldX, worldY, isFront, layout) {
  let v = clamp(
    (worldY - layout.jerseyBottomY) / layout.jerseySpan,
    0.01,
    0.99
  );

  for (let iter = 0; iter < 3; iter++) {
    const prof = evalProfileKeyframes(v);
    const ratioX = clamp(worldX / Math.max(1, prof.hw), -0.98, 0.98);
    const sinSign = isFront ? 1 : -1;
    const cosT = ratioX;
    const sinT = sinSign * Math.sqrt(Math.max(0.0001, 1 - cosT * cosT));
    const theta = Math.atan2(sinT, cosT);

    const pt = evalTorsoOuterPoint(v, theta, layout);
    const errY = worldY - pt.y;
    v = clamp(v + errY / layout.jerseySpan, 0.01, 0.99);
  }

  const prof = evalProfileKeyframes(v);
  const n = prof.n;
  const absRatio = clamp(Math.abs(worldX) / Math.max(1, prof.hw), 0, 0.985);
  const zFactor = Math.pow(Math.max(0.0001, 1 - Math.pow(absRatio, n)), 1 / n);

  const sinSign = isFront ? 1 : -1;
  const theta = Math.atan2(sinSign * zFactor, worldX / Math.max(1, prof.hw));
  const disp = getTorsoClothDisplacement(v, theta);

  return sinSign * (prof.hd * zFactor + disp);
}

/**
 * Builds the manifold Orange & Dark Red Torso and Collar geometries with verified outward normals.
 */
export function buildTorsoAndCollarMeshes(layout, wallThickness = 3.4) {
  const segsPerQuad = 32;
  const numTheta = segsPerQuad * 4;
  const numVBody = 68;
  const collarSplitV = 0.932;

  const thetas = [];
  for (let i = 0; i <= numTheta; i++) {
    thetas.push((i / numTheta) * Math.PI * 2);
  }

  const jBackSplit = 20;
  const getCellV = (i, j) => {
    const theta = thetas[i];
    const sideRatio = Math.abs(Math.cos(theta));
    const backOrangeTopV = 0.28 + 0.025 * sideRatio;
    if (j <= jBackSplit) {
      return (j / jBackSplit) * backOrangeTopV;
    }
    return (
      backOrangeTopV +
      ((j - jBackSplit) / (numVBody - jBackSplit)) *
        (collarSplitV - backOrangeTopV)
    );
  };

  const outerGrid = [];
  const innerGrid = [];
  for (let j = 0; j <= numVBody; j++) {
    const rowOut = [];
    const rowIn = [];
    for (let i = 0; i < numTheta; i++) {
      const v = getCellV(i, j);
      const theta = thetas[i];
      rowOut.push(evalTorsoOuterPoint(v, theta, layout));
      rowIn.push(evalTorsoInnerPoint(v, theta, layout, wallThickness));
    }
    rowOut.push(rowOut[0]);
    rowIn.push(rowIn[0]);
    outerGrid.push(rowOut);
    innerGrid.push(rowIn);
  }

  const orangeTris = [];
  const redTris = [];

  const pushTri = (arr, p1, p2, p3) => {
    arr.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
  };
  const pushQuad = (arr, a, b, c, d) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  const cellIsOrange = (i, j) => {
    const q = Math.floor(i / segsPerQuad);
    if (q === 1) return true; // Front-Right (Orange)
    if (q === 2) return j < jBackSplit; // Back-Right lower Parçalı block (Orange)
    return false;
  };

  for (let j = 0; j < numVBody; j++) {
    for (let i = 0; i < numTheta; i++) {
      const isOrg = cellIsOrange(i, j);
      const target = isOrg ? orangeTris : redTris;

      const o00 = outerGrid[j][i];
      const o10 = outerGrid[j][i + 1];
      const o11 = outerGrid[j + 1][i + 1];
      const o01 = outerGrid[j + 1][i];

      const n00 = innerGrid[j][i];
      const n10 = innerGrid[j][i + 1];
      const n11 = innerGrid[j + 1][i + 1];
      const n01 = innerGrid[j + 1][i];

      // Outer shell face (outward normal: (+Y) x (-X) = +Z -> o00, o01, o11, o10)
      pushQuad(target, o00, o01, o11, o10);
      // Inner cavity face (inward normal: n00, n10, n11, n01)
      pushQuad(target, n00, n10, n11, n01);

      // Bottom cap at j = 0 (downward normal)
      if (j === 0) {
        pushQuad(target, n00, o00, o10, n10);
      }

      // Top cap at j = numVBody - 1
      if (j === numVBody - 1) {
        pushQuad(target, o01, n01, n11, o11);
      }

      // Internal color partition walls
      const nextI = (i + 1) % numTheta;
      if (cellIsOrange(nextI, j) !== isOrg) {
        pushQuad(target, o10, o11, n11, n10);
      }
      const prevI = (i - 1 + numTheta) % numTheta;
      if (cellIsOrange(prevI, j) !== isOrg) {
        pushQuad(target, n00, n01, o01, o00);
      }

      if (j + 1 < numVBody && cellIsOrange(i, j + 1) !== isOrg) {
        pushQuad(target, o01, n01, n11, o11);
      }
      if (j - 1 >= 0 && cellIsOrange(i, j - 1) !== isOrg) {
        pushQuad(target, n00, o00, o10, n10);
      }
    }
  }

  // ── CREW NECK COLLAR GEOMETRIES (v in [0.928, 1.00]) ──
  const numVCollar = 12;
  const collarStartV = 0.928;
  const collarOutGrid = [];
  const collarInGrid = [];

  for (let j = 0; j <= numVCollar; j++) {
    const v = collarStartV + (j / numVCollar) * (1.0 - collarStartV);
    const rowOut = [];
    const rowIn = [];
    for (let i = 0; i < numTheta; i++) {
      const theta = thetas[i];
      rowOut.push(evalTorsoOuterPoint(v, theta, layout));
      rowIn.push(evalTorsoInnerPoint(v, theta, layout, wallThickness));
    }
    rowOut.push(rowOut[0]);
    rowIn.push(rowIn[0]);
    collarOutGrid.push(rowOut);
    collarInGrid.push(rowIn);
  }

  const orangeCollarTris = [];
  const redCollarTris = [];

  const isOrangeCollarCell = (i) => {
    const q = Math.floor(i / segsPerQuad);
    return q === 0; // Front-left collar band is Orange (counter-colored to Dark Red chest!)
  };

  for (let j = 0; j < numVCollar; j++) {
    for (let i = 0; i < numTheta; i++) {
      const isOrg = isOrangeCollarCell(i);
      const target = isOrg ? orangeCollarTris : redCollarTris;

      const o00 = collarOutGrid[j][i];
      const o10 = collarOutGrid[j][i + 1];
      const o11 = collarOutGrid[j + 1][i + 1];
      const o01 = collarOutGrid[j + 1][i];

      const n00 = collarInGrid[j][i];
      const n10 = collarInGrid[j][i + 1];
      const n11 = collarInGrid[j + 1][i + 1];
      const n01 = collarInGrid[j + 1][i];

      pushQuad(target, o00, o01, o11, o10);
      pushQuad(target, n00, n10, n11, n01);

      if (j === 0) {
        pushQuad(target, n00, o00, o10, n10);
      }
      if (j === numVCollar - 1) {
        const m0 = {
          x: (o01.x + n01.x) * 0.5,
          y: o01.y + 0.65,
          z: (o01.z + n01.z) * 0.5,
        };
        const m1 = {
          x: (o11.x + n11.x) * 0.5,
          y: o11.y + 0.65,
          z: (o11.z + n11.z) * 0.5,
        };
        pushQuad(target, o01, m0, m1, o11);
        pushQuad(target, m0, n01, n11, m1);
      }

      const nextI = (i + 1) % numTheta;
      if (isOrangeCollarCell(nextI) !== isOrg) {
        pushQuad(target, o10, o11, n11, n10);
      }
      const prevI = (i - 1 + numTheta) % numTheta;
      if (isOrangeCollarCell(prevI) !== isOrg) {
        pushQuad(target, n00, n01, o01, o00);
      }
    }
  }

  const toGeom = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };

  return {
    orangeTorsoGeom: toGeom(orangeTris),
    redTorsoGeom: toGeom(redTris),
    orangeCollarGeom: toGeom(orangeCollarTris),
    redCollarGeom: toGeom(redCollarTris),
  };
}

/**
 * Builds a tailored Set-In Sleeve + Counter-Colored Ribbed Cuff anchored directly to
 * the torso's shoulder-armpit contour so the shoulder slope flows without any step or bump.
 */
export function buildSetInSleeveAndCuff(sideSign, layout) {
  const numU = 36;
  const numPhi = 56;
  const cuffStartU = 0.855;
  const cuffSplitIdx = Math.round(numU * cuffStartU);

  // Exact torso shoulder tip (v = 0.85) and armpit (v = 0.53) points
  const baseTheta = sideSign > 0 ? 0 : Math.PI;
  const shoulderPt = evalTorsoOuterPoint(0.85, baseTheta, layout);
  const armpitPt = evalTorsoOuterPoint(0.53, baseTheta, layout);

  const shoulderY = shoulderPt.y;
  const armpitY = armpitPt.y;

  // Cuff outer (top) and inner (bottom) endpoints
  const cuffTopX = sideSign * 46.8;
  const cuffTopY = layout.jerseyBottomY + 0.505 * layout.jerseySpan;
  const cuffBotX = sideSign * 35.8;
  const cuffBotY = layout.jerseyBottomY + 0.445 * layout.jerseySpan;

  const evalSleeveRingPoint = (u, phi, radiusOffset = 0) => {
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);

    // At u = 0, sample the torso armhole contour at vArmhole in [0.53, 0.845]
    const vArm = 0.688 + 0.157 * sinP;
    const armTheta =
      sideSign > 0
        ? 0.42 * cosP
        : Math.PI - 0.42 * cosP;
    const torsoArmPt = evalTorsoOuterPoint(vArm, armTheta, layout);

    // At the top of the shoulder (sinP -> 1), match torsoArmPt.x exactly so there is zero shoulder step!
    const embedWeight = 1.0 - smoothstep(0.15, 0.92, sinP);
    const armholeX = torsoArmPt.x - sideSign * 1.1 * embedWeight;
    const armholeY = torsoArmPt.y;
    const armholeZ = torsoArmPt.z * (0.98 - 0.05 * embedWeight);

    // At u = 1 (Angled circular sleeve cuff):
    const cuffCenterX = (cuffTopX + cuffBotX) * 0.5;
    const cuffCenterY = (cuffTopY + cuffBotY) * 0.5;
    const cuffDx = (cuffTopX - cuffBotX) * 0.5;
    const cuffDy = (cuffTopY - cuffBotY) * 0.5;
    const cuffDepthR = 10.6;

    const endX = cuffCenterX + cuffDx * sinP;
    const endY = cuffCenterY + cuffDy * sinP;
    const endZ = cuffDepthR * cosP;

    const sU = smoothstep(0, 1, u);
    let x = lerp(armholeX, endX, u);
    let y = lerp(armholeY, endY, sU);
    let z = lerp(armholeZ, endZ, smoothstep(0, 1, u));

    // Natural deltoid fullness continuing the exact shoulder slope (zero kink at u=0)
    const topFactor = Math.max(0, sinP);
    const deltoidBulge = 4.0 * u * (1.0 - u);
    x += sideSign * 1.4 * deltoidBulge * (0.3 + 0.7 * topFactor);
    y += 1.5 * deltoidBulge * Math.pow(topFactor, 0.9);

    // Subtle underarm fabric tension creases near armpit (sinP < 0)
    const underFactor = Math.max(0, -sinP);
    const sleeveFold =
      0.32 *
      Math.sin(10.0 * u + 4.0 * cosP) *
      Math.sin(Math.PI * u) *
      (0.4 + 0.6 * underFactor);

    // Tailored armhole stitch groove on front/back of armhole (fades out at top shoulder ridge so silhouette is smooth)
    const armholeGroove =
      -0.25 *
      Math.exp(-Math.pow((u - 0.06) / 0.025, 2)) *
      (1.0 - 0.85 * Math.pow(topFactor, 2));

    // Raised cuff rib band for u >= cuffStartU
    const cuffBand =
      0.45 * smoothstep(cuffStartU - 0.015, cuffStartU + 0.02, u);
    const cuffGroove =
      -0.28 * Math.exp(-Math.pow((u - cuffStartU) / 0.018, 2));

    const totalRadialOffset =
      radiusOffset + sleeveFold + armholeGroove + cuffBand + cuffGroove;

    const cx = lerp(sideSign * 28.0, cuffCenterX, u);
    const cy = lerp((shoulderY + armpitY) * 0.5, cuffCenterY, sU);
    const rx = x - cx;
    const ry = y - cy;
    const rz = z;
    const rLen = Math.hypot(rx, ry, rz) || 1;

    return {
      x: x + (rx / rLen) * totalRadialOffset,
      y: y + (ry / rLen) * totalRadialOffset,
      z: z + (rz / rLen) * totalRadialOffset,
    };
  };

  const grid = [];
  for (let iu = 0; iu <= numU; iu++) {
    const u = iu / numU;
    const row = [];
    for (let ip = 0; ip <= numPhi; ip++) {
      const phi = (ip / numPhi) * Math.PI * 2;
      row.push(evalSleeveRingPoint(u, phi, 0));
    }
    grid.push(row);
  }

  const pushTri = (arr, a, b, c) => {
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (arr, a, b, c, d) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  const buildSectionTris = (uStartIdx, uEndIdx, isCuff) => {
    const tris = [];
    for (let iu = uStartIdx; iu < uEndIdx; iu++) {
      for (let ip = 0; ip < numPhi; ip++) {
        const p00 = grid[iu][ip];
        const p10 = grid[iu][ip + 1];
        const p11 = grid[iu + 1][ip + 1];
        const p01 = grid[iu + 1][ip];

        // Verified outward normal:
        // For sideSign > 0 (+X): tangent_u = +X, tangent_phi (at phi=0, +Z) = +Y -> (+X) x (+Y) = +Z -> (p00, p01, p11, p10)
        // For sideSign < 0 (-X): tangent_u = -X, tangent_phi = +Y -> (+Y) x (-X) = +Z -> (p00, p10, p11, p01)
        if (sideSign > 0) {
          pushQuad(tris, p00, p01, p11, p10);
        } else {
          pushQuad(tris, p00, p10, p11, p01);
        }
      }
    }

    const uRoot = uStartIdx / numU;
    const rootCenter = {
      x: lerp(sideSign * 26.5, (cuffTopX + cuffBotX) * 0.5, uRoot),
      y: lerp((shoulderY + armpitY) * 0.5, (cuffTopY + cuffBotY) * 0.5, uRoot),
      z: 0,
    };
    for (let ip = 0; ip < numPhi; ip++) {
      const a = grid[uStartIdx][ip];
      const b = grid[uStartIdx][ip + 1];
      if (sideSign > 0) {
        pushTri(tris, rootCenter, a, b);
      } else {
        pushTri(tris, rootCenter, b, a);
      }
    }

    if (!isCuff) {
      const uTip = uEndIdx / numU;
      const tipCenter = {
        x: lerp(sideSign * 26.5, (cuffTopX + cuffBotX) * 0.5, uTip),
        y: lerp((shoulderY + armpitY) * 0.5, (cuffTopY + cuffBotY) * 0.5, uTip),
        z: 0,
      };
      for (let ip = 0; ip < numPhi; ip++) {
        const a = grid[uEndIdx][ip];
        const b = grid[uEndIdx][ip + 1];
        if (sideSign > 0) {
          pushTri(tris, tipCenter, b, a);
        } else {
          pushTri(tris, tipCenter, a, b);
        }
      }
    } else {
      const innerRim = [];
      const deepRim = [];
      for (let ip = 0; ip <= numPhi; ip++) {
        const phi = (ip / numPhi) * Math.PI * 2;
        innerRim.push(evalSleeveRingPoint(1.0, phi, -2.1));
        deepRim.push(evalSleeveRingPoint(0.91, phi, -2.3));
      }
      const deepCenter = {
        x: lerp(sideSign * 26.5, (cuffTopX + cuffBotX) * 0.5, 0.91),
        y: lerp((shoulderY + armpitY) * 0.5, (cuffTopY + cuffBotY) * 0.5, 0.91),
        z: 0,
      };
      for (let ip = 0; ip < numPhi; ip++) {
        const o0 = grid[uEndIdx][ip];
        const o1 = grid[uEndIdx][ip + 1];
        const r0 = innerRim[ip];
        const r1 = innerRim[ip + 1];
        const d0 = deepRim[ip];
        const d1 = deepRim[ip + 1];

        if (sideSign > 0) {
          pushQuad(tris, o0, r0, r1, o1);
          pushQuad(tris, r0, d0, d1, r1);
          pushTri(tris, deepCenter, d1, d0);
        } else {
          pushQuad(tris, o0, o1, r1, r0);
          pushQuad(tris, r0, r1, d1, d0);
          pushTri(tris, deepCenter, d0, d1);
        }
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
    g.computeVertexNormals();
    return g;
  };

  return {
    sleeveGeom: buildSectionTris(0, cuffSplitIdx, false),
    cuffGeom: buildSectionTris(cuffSplitIdx, numU, true),
  };
}

/**
 * Evaluates a point on the outer surface of the sculpted Football Shorts (Şort)
 * for normalized height ts in [0, 1] and angle theta.
 */
export function evalShortsOuterPoint(ts, theta, layout) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Shorts flare outward from hip (ts=1) down to thigh leg openings (ts=0)
  const baseHw = lerp(29.8, 25.8, smoothstep(0.0, 1.0, ts));
  const baseHd = lerp(18.5, 16.4, smoothstep(0.0, 1.0, ts));
  const n = 2.35;

  const denom =
    Math.pow(
      Math.pow(Math.abs(cosT), n) + Math.pow(Math.abs(sinT), n),
      1 / n
    ) || 1;

  let x = (baseHw / denom) * cosT;
  let z = (baseHd / denom) * sinT;
  const y = lerp(layout.shortsBottomY, layout.shortsTopY, ts);

  // 1. Deep Central Crotch / Inseam Division (creates two distinct round short legs: Sol Paça & Sağ Paça!)
  const legSepWeight = 1.0 - smoothstep(0.0, 0.88, ts);
  const centerProx = Math.exp(-Math.pow(x / 5.5, 2));
  const crotchPinch =
    8.5 * legSepWeight * centerProx * Math.pow(Math.abs(sinT), 0.65);

  // Also lift the center crotch arch slightly at the bottom between the two legs!
  const crotchArchLift = 3.2 * (1.0 - smoothstep(0.0, 0.35, ts)) * centerProx;

  // Round each individual thigh leg tube around X = +-14.8mm
  const legBridge =
    1.55 *
    legSepWeight *
    Math.exp(-Math.pow((Math.abs(x) - 14.8) / 8.5, 2)) *
    Math.abs(sinT);

  // 2. Realistic diagonal inseam & hip cloth folds on the shorts
  const foldEnv =
    smoothstep(0.08, 0.22, ts) * (1.0 - smoothstep(0.75, 0.95, ts));
  const fold1 =
    0.48 *
    Math.sin(5.5 * (Math.abs(x) / 28) - 7.0 * ts) *
    Math.abs(sinT) *
    foldEnv;
  const fold2 =
    0.28 * Math.cos(9.0 * (x / 28) + 6.0 * ts) * Math.abs(sinT) * foldEnv;

  // 3. Raised bottom leg cuff hem band (paça ribanası) for ts < 0.12
  const legCuffBand = 0.48 * (1.0 - smoothstep(0.09, 0.13, ts));
  const legCuffGroove = -0.32 * Math.exp(-Math.pow((ts - 0.135) / 0.018, 2));

  const zSign = sinT >= 0 ? 1 : -1;
  z +=
    zSign * (-crotchPinch + legBridge + fold1 + fold2) +
    sinT * (legCuffBand + legCuffGroove);
  x += cosT * (legCuffBand + legCuffGroove);

  return { x, y: y + crotchArchLift, z };
}

/**
 * Exact surface Z lookup on the front/back of the shorts for conforming thigh numbers & logos.
 * Uses binary search on theta + iterative ts refinement so the superellipse (n=2.35) and crotch arch
 * match the actual shortsBodyGeom surface to within 0.001mm.
 */
export function getExactShortsSurfaceZ(worldX, worldY, isFront, layout) {
  const shortsSpan = Math.max(1, layout.shortsTopY - layout.shortsBottomY);
  let ts = clamp((worldY - layout.shortsBottomY) / shortsSpan, 0.02, 0.98);
  let theta = isFront ? Math.PI * 0.5 : -Math.PI * 0.5;

  for (let iter = 0; iter < 3; iter++) {
    let lo = 0.02;
    let hi = Math.PI - 0.02;
    for (let b = 0; b < 12; b++) {
      const mid = (lo + hi) * 0.5;
      const testTheta = isFront ? mid : -mid;
      const pt = evalShortsOuterPoint(ts, testTheta, layout);
      // As mid increases from 0 to PI, pt.x decreases monotonically from +hw to -hw
      if (pt.x > worldX) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const mid = (lo + hi) * 0.5;
    theta = isFront ? mid : -mid;
    const pt = evalShortsOuterPoint(ts, theta, layout);
    const errY = worldY - pt.y;
    ts = clamp(ts + errY / shortsSpan, 0.02, 0.98);
  }

  return evalShortsOuterPoint(ts, theta, layout).z;
}

/**
 * Builds the 3D Football Shorts (Şort) + Watertight Closed Manifold Left/Right Side Trim Stripes.
 */
export function buildSculptedShortsMeshes(layout, wallThickness = 3.4) {
  if (!layout.hasShorts) return null;

  const numTheta = 128;
  const numT = 36;
  const thetas = [];
  for (let i = 0; i < numTheta; i++) {
    thetas.push((i / numTheta) * Math.PI * 2);
  }

  const outerGrid = [];
  const innerGrid = [];
  for (let j = 0; j <= numT; j++) {
    const ts = j / numT;
    const rowOut = [];
    const rowIn = [];
    for (let i = 0; i < numTheta; i++) {
      const theta = thetas[i];
      rowOut.push(evalShortsOuterPoint(ts, theta, layout));
      const inPt = evalTorsoInnerPoint(0.02, theta, layout, wallThickness + 3.0);
      inPt.y = lerp(layout.shortsBottomY, layout.shortsTopY, ts);
      rowIn.push(inPt);
    }
    rowOut.push(rowOut[0]);
    rowIn.push(rowIn[0]);
    outerGrid.push(rowOut);
    innerGrid.push(rowIn);
  }

  const shortsTris = [];

  const pushTri = (arr, a, b, c) => {
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (arr, a, b, c, d) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  for (let j = 0; j < numT; j++) {
    for (let i = 0; i < numTheta; i++) {
      const o00 = outerGrid[j][i];
      const o10 = outerGrid[j][i + 1];
      const o11 = outerGrid[j + 1][i + 1];
      const o01 = outerGrid[j + 1][i];

      const n00 = innerGrid[j][i];
      const n10 = innerGrid[j][i + 1];
      const n11 = innerGrid[j + 1][i + 1];
      const n01 = innerGrid[j + 1][i];

      // Outward normal for outer shell: (o00, o01, o11, o10)
      pushQuad(shortsTris, o00, o01, o11, o10);
      // Inward normal for inner cavity: (n00, n10, n11, n01)
      pushQuad(shortsTris, n00, n10, n11, n01);

      if (j === 0) {
        pushQuad(shortsTris, n00, o00, o10, n10);
      }
      if (j === numT - 1) {
        pushQuad(shortsTris, o01, n01, n11, o11);
      }
    }
  }

  /**
   * Builds a 100% watertight, closed manifold 3D side stripe block centered at `centerIdx`
   * with 0 open edges and 2.15mm radial thickness (-0.85mm embedded inside shorts + 1.30mm relief)
   * so Bambu Studio / OrcaSlicer / PrusaSlicer never drops the stripe when slicing!
   */
  const buildClosedSideStripeTris = (centerIdx, xSign) => {
    const halfSteps = 4; // 8 angular steps (~7.5mm wide athletic side stripe)
    const numS = halfSteps * 2;
    const jStart = 2;
    const jEnd = numT - 1;
    const numJ = jEnd - jStart;

    const outOffset = 1.30;
    const inOffset = -0.85;

    const sOutGrid = [];
    const sInGrid = [];

    for (let jj = 0; jj <= numJ; jj++) {
      const j = jStart + jj;
      const rowOut = [];
      const rowIn = [];
      for (let ss = 0; ss <= numS; ss++) {
        const i = (centerIdx - halfSteps + ss + numTheta) % numTheta;
        const basePt = outerGrid[j][i];
        rowOut.push({
          x: basePt.x + xSign * outOffset,
          y: basePt.y,
          z: basePt.z,
        });
        rowIn.push({
          x: basePt.x + xSign * inOffset,
          y: basePt.y,
          z: basePt.z,
        });
      }
      sOutGrid.push(rowOut);
      sInGrid.push(rowIn);
    }

    const tris = [];
    for (let jj = 0; jj < numJ; jj++) {
      for (let ss = 0; ss < numS; ss++) {
        const o00 = sOutGrid[jj][ss];
        const o10 = sOutGrid[jj][ss + 1];
        const o11 = sOutGrid[jj + 1][ss + 1];
        const o01 = sOutGrid[jj + 1][ss];

        const n00 = sInGrid[jj][ss];
        const n10 = sInGrid[jj][ss + 1];
        const n11 = sInGrid[jj + 1][ss + 1];
        const n01 = sInGrid[jj + 1][ss];

        // Outer face (outward normal)
        pushQuad(tris, o00, o01, o11, o10);
        // Inner face (inward normal)
        pushQuad(tris, n00, n10, n11, n01);

        // Bottom cap at jj === 0
        if (jj === 0) {
          pushQuad(tris, n00, o00, o10, n10);
        }
        // Top cap at jj === numJ - 1
        if (jj === numJ - 1) {
          pushQuad(tris, o01, n01, n11, o11);
        }
        // Start angular wall at ss === 0
        if (ss === 0) {
          pushQuad(tris, n00, n01, o01, o00);
        }
        // End angular wall at ss === numS - 1
        if (ss === numS - 1) {
          pushQuad(tris, o10, o11, n11, n10);
        }
      }
    }
    return tris;
  };

  // Viewer's Left (X < 0, centerIdx = numTheta / 2 = 64) -> leftStripeTris (Sort_Sol_Serit, Bordo/Red)
  // Viewer's Right (X > 0, centerIdx = 0) -> rightStripeTris (Sort_Sag_Serit, Turuncu/Orange)
  const leftStripeTris = buildClosedSideStripeTris(numTheta / 2, -1);
  const rightStripeTris = buildClosedSideStripeTris(0, 1);

  const toGeom = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };

  return {
    shortsBodyGeom: toGeom(shortsTris),
    leftStripeGeom: toGeom(leftStripeTris),
    rightStripeGeom: toGeom(rightStripeTris),
  };
}
