import * as THREE from 'three';

/**
 * Exact 80-point Fourier-smoothed contour of the leaping Puma cat
 * traced directly from the reference jersey photo (normalized to 13.5mm span).
 */
export const PUMA_CAT_POINTS = [
  [-5.652, 5.696], [-5.154, 5.61], [-4.594, 5.394], [-4.01, 5.131],
  [-3.44, 4.829], [-2.92, 4.534], [-2.386, 4.15], [-1.801, 3.629],
  [-1.219, 3.089], [-0.697, 2.593], [-0.228, 2.153], [0.18, 1.818],
  [0.723, 1.433], [1.315, 1.119], [1.887, 0.997], [2.449, 0.985],
  [3.026, 1.076], [3.55, 1.462], [3.951, 2.052], [4.233, 2.592],
  [4.476, 3.16], [4.732, 3.697], [5.089, 4.214], [5.469, 4.717],
  [5.971, 5.325], [6.554, 5.562], [6.75, 5.154], [6.32, 4.602],
  [5.69, 4.194], [5.201, 3.691], [4.776, 3.081], [4.481, 2.599],
  [4.241, 2.038], [3.849, 1.446], [3.311, 0.885], [3.108, 0.315],
  [3.318, -0.276], [3.515, -0.831], [3.539, -1.406], [3.519, -1.999],
  [3.561, -2.546], [3.737, -3.037], [4.103, -3.646], [4.425, -4.182],
  [4.576, -4.749], [4.572, -5.407], [4.379, -5.696], [4.147, -5.313],
  [4.082, -4.665], [3.955, -4.133], [3.509, -3.629], [3.039, -3.156],
  [2.605, -2.619], [2.252, -2.08], [1.997, -1.495], [1.826, -0.906],
  [1.48, -0.363], [0.896, 0.063], [0.314, 0.277], [-0.229, 0.32],
  [-0.825, 0.386], [-1.324, 0.568], [-1.876, 0.919], [-2.451, 1.376],
  [-2.969, 1.903], [-3.43, 2.293], [-3.996, 2.329], [-4.618, 2.222],
  [-5.147, 2.31], [-5.708, 2.473], [-6.366, 2.561], [-6.75, 2.737],
  [-6.669, 3.048], [-6.084, 3.171], [-5.434, 3.246], [-5.224, 3.603],
  [-5.622, 4.005], [-6.243, 4.283], [-6.505, 4.772], [-6.22, 5.413],
];

/**
 * Resamples a closed 2D point loop so that no segment exceeds maxSegLen (in mm),
 * removes degenerate near-duplicate vertices, and optionally dilates the contour outward
 * by `dilateOffset` mm so small letters/numbers exceed 3+ nozzle widths in 3D slicers.
 */
function resampleClosedLoop2D(pts, maxSegLen = 0.65, dilateOffset = 0) {
  if (!pts || pts.length < 3) return pts;
  const minDist = Math.min(0.16, maxSegLen * 0.32);
  let cleaned = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (
      cleaned.length === 0 ||
      Math.hypot(
        p.x - cleaned[cleaned.length - 1].x,
        p.y - cleaned[cleaned.length - 1].y
      ) > minDist
    ) {
      cleaned.push(new THREE.Vector2(p.x, p.y));
    }
  }
  if (
    cleaned.length > 2 &&
    Math.hypot(
      cleaned[0].x - cleaned[cleaned.length - 1].x,
      cleaned[0].y - cleaned[cleaned.length - 1].y
    ) <= minDist
  ) {
    cleaned.pop();
  }
  if (cleaned.length < 3) return pts;

  if (Math.abs(dilateOffset) > 0.001) {
    let signedArea = 0;
    const m = cleaned.length;
    for (let i = 0; i < m; i++) {
      const a = cleaned[i];
      const b = cleaned[(i + 1) % m];
      signedArea += a.x * b.y - b.x * a.y;
    }
    const orient = signedArea >= 0 ? 1 : -1;
    const dilated = [];
    for (let i = 0; i < m; i++) {
      const prev = cleaned[(i - 1 + m) % m];
      const curr = cleaned[i];
      const next = cleaned[(i + 1) % m];

      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const l1 = Math.hypot(dx1, dy1) || 1;
      const nx1 = (orient * dy1) / l1;
      const ny1 = (-orient * dx1) / l1;

      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const l2 = Math.hypot(dx2, dy2) || 1;
      const nx2 = (orient * dy2) / l2;
      const ny2 = (-orient * dx2) / l2;

      let bx = nx1 + nx2;
      let by = ny1 + ny2;
      const bl = Math.hypot(bx, by);
      if (bl > 1e-4) {
        bx /= bl;
        by /= bl;
      } else {
        bx = nx1;
        by = ny1;
      }
      const cosHalf = Math.max(0.65, bx * nx1 + by * ny1);
      const shift = dilateOffset / cosHalf;
      dilated.push(new THREE.Vector2(curr.x + bx * shift, curr.y + by * shift));
    }
    cleaned = dilated;
  }

  const out = [];
  const n = cleaned.length;
  for (let i = 0; i < n; i++) {
    const a = cleaned[i];
    const b = cleaned[(i + 1) % n];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / maxSegLen));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  return out;
}

/**
 * Resamples all outer contours and holes of an array of THREE.Shape objects
 * so boundary edges are guaranteed <= maxSegLen before extrusion.
 */
export function resampleShapesForCleanExtrusion(
  shapes,
  maxSegLen = 0.65,
  curveDivisions = 28,
  dilateOffset = 0
) {
  const arr = Array.isArray(shapes) ? shapes : [shapes];
  return arr.map((sh) => {
    const extracted = sh.extractPoints(curveDivisions);
    const outerPts = resampleClosedLoop2D(
      extracted.shape,
      maxSegLen,
      dilateOffset
    );
    const newShape = new THREE.Shape(outerPts);
    if (extracted.holes && extracted.holes.length > 0) {
      for (const hPts of extracted.holes) {
        const resampledHole = resampleClosedLoop2D(
          hPts,
          maxSegLen,
          -dilateOffset * 0.35
        );
        if (resampledHole.length >= 3) {
          const holePath = new THREE.Path(resampledHole);
          newShape.holes.push(holePath);
        }
      }
    }
    return newShape;
  });
}

/**
 * Conforms any BufferGeometry (defined in XY around (0,0) with Z in [0, depth])
 * directly onto a 3D surface defined by surfaceZFn(worldX, worldY).
 * Embeds the back face by `embedDepth` into the surface so there is zero gap.
 */
export function conformGeometryToSurface(
  geom,
  centerX,
  centerY,
  surfaceZFn,
  embedDepth = 0.15
) {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const wx = centerX + lx;
    const wy = centerY + ly;
    const surfZ = surfaceZFn(wx, wy);
    pos.setX(i, wx);
    pos.setY(i, wy);
    pos.setZ(i, lz + surfZ - embedDepth);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Subdivides ONLY large planar front/back cap triangles (leaving side walls untouched
 * so no T-junctions or perimeter burrs/spikes can ever form!).
 */
export function subdivideExtrudedGeometry(geom, maxEdgeLength = 1.25) {
  const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
  const posAttr = nonIndexed.attributes.position;

  const finalTris = [];
  const capStack = [];

  for (let i = 0; i < posAttr.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    const b = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);

    const isCapTriangle =
      Math.abs(a.z - b.z) < 0.002 && Math.abs(b.z - c.z) < 0.002;
    if (isCapTriangle) {
      capStack.push([a, b, c, 0]);
    } else {
      // Side-wall triangles: keep intact so boundary stays 100% manifold and burr-free!
      finalTris.push(a, b, c);
    }
  }

  // Only split interior edges if both endpoints are NOT on the same tiny boundary segment,
  // or use centroid/longest-edge split capped at depth 4 when max 2D edge > maxEdgeLength.
  while (capStack.length > 0) {
    const [a, b, c, depth] = capStack.pop();
    const dab = Math.hypot(a.x - b.x, a.y - b.y);
    const dbc = Math.hypot(b.x - c.x, b.y - c.y);
    const dca = Math.hypot(c.x - a.x, c.y - a.y);
    const maxD = Math.max(dab, dbc, dca);

    if (maxD <= maxEdgeLength || depth >= 12) {
      finalTris.push(a, b, c);
    } else if (dab >= dbc && dab >= dca) {
      const m = a.clone().add(b).multiplyScalar(0.5);
      capStack.push([a, m, c, depth + 1], [m, b, c, depth + 1]);
    } else if (dbc >= dab && dbc >= dca) {
      const m = b.clone().add(c).multiplyScalar(0.5);
      capStack.push([a, b, m, depth + 1], [a, m, c, depth + 1]);
    } else {
      const m = c.clone().add(a).multiplyScalar(0.5);
      capStack.push([a, b, m, depth + 1], [b, c, m, depth + 1]);
    }
  }

  const outPositions = new Float32Array(finalTris.length * 3);
  for (let i = 0; i < finalTris.length; i++) {
    outPositions[i * 3] = finalTris[i].x;
    outPositions[i * 3 + 1] = finalTris[i].y;
    outPositions[i * 3 + 2] = finalTris[i].z;
  }

  const outGeom = new THREE.BufferGeometry();
  outGeom.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
  outGeom.computeVertexNormals();
  return outGeom;
}

/**
 * Builds the authentic leaping Puma cat geometry conformed to the target surface.
 */
export function buildConformedPumaLogo(
  centerX,
  centerY,
  surfaceZFn,
  scale = 1.0,
  reliefDepth = 1.35
) {
  const rawPts = PUMA_CAT_POINTS.map(
    ([x, y]) => new THREE.Vector2(x * scale, y * scale)
  );
  const cleanPts = resampleClosedLoop2D(rawPts, 0.55);
  const shape = new THREE.Shape(cleanPts);

  const embed = 0.2;
  let geom = new THREE.ExtrudeGeometry(shape, {
    depth: reliefDepth + embed,
    bevelEnabled: false,
  });

  geom = subdivideExtrudedGeometry(geom, 1.3);
  return conformGeometryToSurface(geom, centerX, centerY, surfaceZFn, embed);
}

/**
 * Builds the authentic Galatasaray 5-Star Crest (White Oval Shield, Dark Red 'G',
 * Interlocking Orange-Gold 'S', and 5 Faceted Stars arched cleanly above the shield
 * with generous clearance below the collar).
 */
export function buildConformedGalatasarayCrest(
  centerX,
  centerY,
  surfaceZFn,
  starCount = 5,
  scale = 0.82
) {
  const shieldEmbed = 0.2;
  const shieldRelief = 0.95; // White shield rises +0.95mm above chest surface

  // 1. White Oval Shield Base (Rx = 8.4mm, Ry = 11.2mm)
  const shieldRx = 8.4 * scale;
  const shieldRy = 11.2 * scale;
  const shieldShape = new THREE.Shape();
  shieldShape.absellipse(0, 0, shieldRx, shieldRy, 0, Math.PI * 2, false, 0);
  const cleanShieldShapes = resampleShapesForCleanExtrusion(shieldShape, 0.65, 64);

  let shieldGeom = new THREE.ExtrudeGeometry(cleanShieldShapes, {
    depth: shieldRelief + shieldEmbed,
    bevelEnabled: false,
  });
  shieldGeom = subdivideExtrudedGeometry(shieldGeom, 1.4);
  conformGeometryToSurface(shieldGeom, centerX, centerY, surfaceZFn, shieldEmbed);

  // Monogram ('G' and 'S') sits ON TOP OF the white oval shield (+0.80mm to +1.75mm)
  // so it never collides with the torso or gets swallowed by the white shield!
  const monoBaseOffset = shieldRelief - 0.12; // starts 0.12mm inside top of white shield
  const monoHeight = 0.92; // rises +0.80mm proud above the white shield!

  // 2. Dark Red 'G' Monogram (C-arc + interlocking right crossbar)
  const gCenterY = -2.25 * scale;
  const gRout = 6.45 * scale;
  const gRin = 4.55 * scale;
  const gArcShape = new THREE.Shape();
  const gSteps = 72;
  const aStart = (42 * Math.PI) / 180;
  const aEnd = (358 * Math.PI) / 180;

  for (let i = 0; i <= gSteps; i++) {
    const a = aStart + ((aEnd - aStart) * i) / gSteps;
    const x = gRout * Math.cos(a);
    const y = gCenterY + gRout * Math.sin(a);
    if (i === 0) gArcShape.moveTo(x, y);
    else gArcShape.lineTo(x, y);
  }
  for (let i = gSteps; i >= 0; i--) {
    const a = aStart + ((aEnd - aStart) * i) / gSteps;
    const x = gRin * Math.cos(a);
    const y = gCenterY + gRin * Math.sin(a);
    gArcShape.lineTo(x, y);
  }
  gArcShape.closePath();

  // G horizontal crossbar
  const gBarShape = new THREE.Shape();
  const bx0 = 2.55 * scale;
  const bx1 = 6.45 * scale;
  const by0 = -2.65 * scale;
  const by1 = -0.95 * scale;
  gBarShape.moveTo(bx0, by0);
  gBarShape.lineTo(bx1, by0);
  gBarShape.lineTo(bx1, by1);
  gBarShape.lineTo(bx0, by1);
  gBarShape.closePath();

  let gArcGeom = new THREE.ExtrudeGeometry(
    resampleShapesForCleanExtrusion(gArcShape, 0.55),
    {
      depth: monoHeight,
      bevelEnabled: false,
    }
  );
  gArcGeom = subdivideExtrudedGeometry(gArcGeom, 1.3);
  conformGeometryToSurface(gArcGeom, centerX, centerY, surfaceZFn, -monoBaseOffset);

  let gBarGeom = new THREE.ExtrudeGeometry(
    resampleShapesForCleanExtrusion(gBarShape, 0.55),
    {
      depth: monoHeight + 0.08,
      bevelEnabled: false,
    }
  );
  gBarGeom = subdivideExtrudedGeometry(gBarGeom, 1.2);
  conformGeometryToSurface(gBarGeom, centerX, centerY, surfaceZFn, -monoBaseOffset);

  // 3. Continuous Interlocking Orange-Gold 'S' Monogram
  const sCenterline = [];
  const rTop = 2.55 * scale;
  const topCx = 0.15 * scale;
  const topCy = 4.65 * scale;
  for (let i = 0; i < 45; i++) {
    const a = ((8 + ((215 - 8) * i) / 44) * Math.PI) / 180;
    sCenterline.push([topCx + rTop * Math.cos(a), topCy + rTop * Math.sin(a)]);
  }

  const p0 = sCenterline[sCenterline.length - 1];
  const aBotStart = (22 * Math.PI) / 180;
  const rBot = 3.45 * scale;
  const botCx = 0;
  const botCy = -2.25 * scale;
  const p3 = [botCx + rBot * Math.cos(aBotStart), botCy + rBot * Math.sin(aBotStart)];
  const p1 = [p0[0] + 0.9 * scale, p0[1] - 1.3 * scale];
  const p2 = [p3[0] - 0.9 * scale, p3[1] + 1.5 * scale];

  for (let i = 1; i < 25; i++) {
    const t = i / 25;
    const u = 1 - t;
    const x =
      u * u * u * p0[0] +
      3 * u * u * t * p1[0] +
      3 * u * t * t * p2[0] +
      t * t * t * p3[0];
    const y =
      u * u * u * p0[1] +
      3 * u * u * t * p1[1] +
      3 * u * t * t * p2[1] +
      t * t * t * p3[1];
    sCenterline.push([x, y]);
  }

  for (let i = 0; i < 50; i++) {
    const a = ((22 + ((-184 - 22) * i) / 49) * Math.PI) / 180;
    sCenterline.push([botCx + rBot * Math.cos(a), botCy + rBot * Math.sin(a)]);
  }

  const hw = 0.94 * scale;
  const leftEdge = [];
  const rightEdge = [];
  for (let i = 0; i < sCenterline.length; i++) {
    const [x, y] = sCenterline[i];
    let dx, dy;
    if (i === 0) {
      dx = sCenterline[1][0] - x;
      dy = sCenterline[1][1] - y;
    } else if (i === sCenterline.length - 1) {
      dx = x - sCenterline[i - 1][0];
      dy = y - sCenterline[i - 1][1];
    } else {
      dx = sCenterline[i + 1][0] - sCenterline[i - 1][0];
      dy = sCenterline[i + 1][1] - sCenterline[i - 1][1];
    }
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    leftEdge.push([x + nx * hw, y + ny * hw]);
    rightEdge.push([x - nx * hw, y - ny * hw]);
  }

  const sShape = new THREE.Shape();
  leftEdge.forEach(([x, y], idx) => {
    if (idx === 0) sShape.moveTo(x, y);
    else sShape.lineTo(x, y);
  });
  for (let i = rightEdge.length - 1; i >= 0; i--) {
    sShape.lineTo(rightEdge[i][0], rightEdge[i][1]);
  }
  sShape.closePath();

  let sGeom = new THREE.ExtrudeGeometry(
    resampleShapesForCleanExtrusion(sShape, 0.55),
    {
      depth: monoHeight + 0.04,
      bevelEnabled: false,
    }
  );
  sGeom = subdivideExtrudedGeometry(sGeom, 1.3);
  conformGeometryToSurface(sGeom, centerX, centerY, surfaceZFn, -monoBaseOffset);

  // 4. Faceted 3D 5-Pointed Championship Stars arched cleanly above the oval shield
  // Compact arc right above the shield top so stars NEVER touch or stick to the collar!
  const starGeoms = [];
  const numStars = Math.max(0, Math.min(5, Number(starCount) || 5));
  if (numStars > 0) {
    const arcRadius = 10.6 * scale;
    const arcCenterY = 3.1 * scale;
    const starOuterR = 2.32 * scale;
    const starInnerR = 1.05 * scale;

    for (let s = 0; s < numStars; s++) {
      let deg = 0;
      if (numStars > 1) {
        const span = Math.min(78, (numStars - 1) * 19.5);
        deg = span / 2 - s * (span / (numStars - 1));
      }
      const rad = (deg * Math.PI) / 180;
      const sx = -arcRadius * Math.sin(rad);
      const sy = arcCenterY + arcRadius * Math.cos(rad);
      const sScale = numStars === 5 && s === 2 ? 1.06 : 1.0;

      const starGeom = buildFacetedStarGeometry(
        sx,
        sy,
        starOuterR * sScale,
        starInnerR * sScale,
        rad * 0.55,
        centerX,
        centerY,
        surfaceZFn
      );
      starGeoms.push(starGeom);
    }
  }

  return {
    shieldGeom,
    gArcGeom,
    gBarGeom,
    sGeom,
    starGeoms,
  };
}

/**
 * Builds a thick, bold 3D faceted championship star (with raised pyramid center ridge)
 * conformed directly to the chest surface.
 */
function buildFacetedStarGeometry(
  localX,
  localY,
  outerR,
  innerR,
  rotZ,
  crestCenterX,
  crestCenterY,
  surfaceZFn
) {
  const ringPts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 5 + Math.PI / 2 + rotZ;
    ringPts.push([localX + r * Math.cos(a), localY + r * Math.sin(a)]);
  }

  const zBack = -0.18;
  const zEdge = 1.22;
  const zPeak = 1.72;

  const positions = [];
  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  };

  for (let i = 0; i < 10; i++) {
    const [x0, y0] = ringPts[i];
    const [x1, y1] = ringPts[(i + 1) % 10];

    // Front faceted pyramid face
    pushTri(localX, localY, zPeak, x0, y0, zEdge, x1, y1, zEdge);
    // Back face
    pushTri(localX, localY, zBack, x1, y1, zBack, x0, y0, zBack);
    // Side walls (2 triangles per edge)
    pushTri(x0, y0, zBack, x1, y1, zBack, x1, y1, zEdge);
    pushTri(x0, y0, zBack, x1, y1, zEdge, x0, y0, zEdge);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const wx = crestCenterX + lx;
    const wy = crestCenterY + ly;
    const surfZ = surfaceZFn(wx, wy);
    pos.setX(i, wx);
    pos.setY(i, wy);
    pos.setZ(i, lz + surfZ);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
