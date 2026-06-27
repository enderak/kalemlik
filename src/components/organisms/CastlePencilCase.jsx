import React, { useMemo } from 'react';
import * as THREE from 'three';

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
  const bottom = new THREE.RingGeometry(innerR, outerR, SEG);
  bottom.rotateX(-Math.PI / 2);
  return mergeGeoms([outerTube, innerTube, bottom]);
}

function makeCylinderBaseGeom(outerR, baseExt, baseH) {
  const r = outerR + baseExt;
  const g = new THREE.CylinderGeometry(r, r, baseH, SEG);
  g.translate(0, -baseH / 2, 0);
  g.computeVertexNormals();
  return g;
}

function makeCylinderCrenGeoms(outerR, innerR, height, numCren, crenH, crenWRatio) {
  const midR = (outerR + innerR) / 2;
  const wallT = outerR - innerR;
  const gapA = (Math.PI * 2) / numCren;
  const w = midR * gapA * THREE.MathUtils.clamp(crenWRatio, 0.1, 0.95);
  const boxes = [];
  for (let i = 0; i < numCren; i++) {
    const a = i * gapA;
    const g = new THREE.BoxGeometry(w, crenH, wallT);
    g.translate(0, height + crenH / 2, midR);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
    );
    g.applyQuaternion(q);
    boxes.push(g);
  }
  return boxes;
}

/* ============ KARE GEOMETRY ============ */

function makeSquareCupBody(outerSize, wallThick, height, bottomThick, cornerR) {
  const s = outerSize / 2;
  const r = Math.min(cornerR, s);
  const outer = new THREE.Shape();
  outer.moveTo(-s + r, -s);
  outer.lineTo(s - r, -s).quadraticCurveTo(s, -s, s, -s + r);
  outer.lineTo(s, s - r).quadraticCurveTo(s, s, s - r, s);
  outer.lineTo(-s + r, s).quadraticCurveTo(-s, s, -s, s - r);
  outer.lineTo(-s, -s + r).quadraticCurveTo(-s, -s, -s + r, -s);

  const innerSize = outerSize - 2 * wallThick;
  if (innerSize > 2) {
    const si = innerSize / 2;
    const ri = Math.max(0.5, r - wallThick);
    const hole = new THREE.Path();
    hole.moveTo(-si + ri, -si);
    hole.lineTo(si - ri, -si).quadraticCurveTo(si, -si, si, -si + ri);
    hole.lineTo(si, si - ri).quadraticCurveTo(si, si, si - ri, si);
    hole.lineTo(-si + ri, si).quadraticCurveTo(-si, si, -si, si - ri);
    hole.lineTo(-si, -si + ri).quadraticCurveTo(-si, -si, -si + ri, -si);
    outer.holes.push(hole);
  }

  const wallGeom = new THREE.ExtrudeGeometry(outer, { depth: height, bevelEnabled: false });
  wallGeom.translate(0, 0, -height / 2);
  wallGeom.rotateX(-Math.PI / 2);

  const innerGeom = new THREE.ExtrudeGeometry(outer, { depth: height - bottomThick, bevelEnabled: false });
  innerGeom.translate(0, 0, -(height - bottomThick) / 2);
  innerGeom.rotateX(-Math.PI / 2);
  innerGeom.translate(0, bottomThick, 0);

  const cap = new THREE.Shape();
  cap.moveTo(-s + r, -s);
  cap.lineTo(s - r, -s).quadraticCurveTo(s, -s, s, -s + r);
  cap.lineTo(s, s - r).quadraticCurveTo(s, s, s - r, s);
  cap.lineTo(-s + r, s).quadraticCurveTo(-s, s, -s, s - r);
  cap.lineTo(-s, -s + r).quadraticCurveTo(-s, -s, -s + r, -s);
  const bottomGeom = new THREE.ExtrudeGeometry(cap, { depth: bottomThick, bevelEnabled: false });
  bottomGeom.rotateX(-Math.PI / 2);
  bottomGeom.translate(0, -height / 2, 0);

  return mergeGeoms([wallGeom, innerGeom, bottomGeom]);
}

function makeSquareBaseGeom(outerSize, baseExt, baseH, cornerR, wallHeight) {
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
  g.translate(0, -wallHeight / 2 - baseH, 0);
  g.computeVertexNormals();
  return g;
}

function makeSquareCrenGeoms(outerSize, wallThick, height, numCren, crenH, crenWRatio) {
  const s = outerSize / 2;
  const hh = height / 2;
  const wallCenter = s - wallThick / 2;
  const boxes = [];
  const sides = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
  ];
  const perSide = Math.max(1, Math.floor(numCren / 4));
  const segLen = (outerSize - wallThick * 2) / perSide;
  const crenW = segLen * THREE.MathUtils.clamp(crenWRatio, 0.1, 0.95);
  sides.forEach((side) => {
    for (let i = 0; i < perSide; i++) {
      const t = (i - (perSide - 1) / 2) * segLen;
      const g = new THREE.BoxGeometry(wallThick, crenH, crenW);
      let px, pz;
      if (side.x !== 0) {
        px = side.x * wallCenter;
        pz = t;
        g.rotateY(side.x > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        px = t;
        pz = side.z * wallCenter;
      }
      g.translate(px, hh + crenH / 2, pz);
      boxes.push(g);
    }
  });
  return boxes;
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

function makeCylinderBrickGeoms(outerR, height, brickDepth, brickW, brickH, gap) {
  const bricks = [];
  const rows = Math.floor(height / (brickH + gap));
  const circ = Math.PI * 2 * outerR;
  const cols = Math.floor(circ / (brickW + gap));
  const aStep = (Math.PI * 2) / cols;
  for (let r = 0; r < rows; r++) {
    const y = r * (brickH + gap) + brickH / 2;
    const off = (r % 2) * (aStep / 2);
    for (let c = 0; c < cols; c++) {
      const a = c * aStep + off;
      const g = new THREE.BoxGeometry(brickW * (outerR / 50), brickH, brickDepth);
      g.translate(0, y, outerR);
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
      );
      g.applyQuaternion(q);
      bricks.push(g);
    }
  }
  return bricks;
}

function makeSquareBrickGeoms(outerSize, wallThick, height, brickDepth, brickW, brickH, gap) {
  const s = outerSize / 2;
  const wallCenter = s - wallThick / 2;
  const rows = Math.floor(height / (brickH + gap));
  const cols = Math.floor((outerSize - wallThick) / (brickW + gap));
  const bricks = [];
  const sides = [
    { x: 0, z: 1 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
  ];
  sides.forEach((side) => {
    for (let r = 0; r < rows; r++) {
      const y = -height / 2 + r * (brickH + gap) + brickH / 2;
      const off = (r % 2) * ((brickW + gap) / 2);
      for (let c = 0; c < cols; c++) {
        const t = -(outerSize - wallThick) / 2 + c * (brickW + gap) + brickW / 2 + off;
        const g = new THREE.BoxGeometry(brickW, brickH, brickDepth);
        let px, pz;
        if (side.x !== 0) {
          px = side.x * wallCenter;
          pz = t;
          g.rotateY(side.x > 0 ? Math.PI / 2 : -Math.PI / 2);
        } else {
          px = t;
          pz = side.z * wallCenter;
        }
        g.translate(px, y, pz);
        bricks.push(g);
      }
    }
  });
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
  hasWindows = true,
  numWindows = 3,
  windowWidth = 16,
  windowHeight = 24,
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
  groupRef,
}) => {
  const isCylinder = shape === 'cylinder';
  const brickTex = useMemo(() => (showBrickTexture ? createBrickTexture() : null), [showBrickTexture]);
  const texProps = brickTex ? { map: brickTex } : {};

  /* --- body --- */
  const bodyGeom = useMemo(() => {
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const innerR = Math.max(0.5, outerR - wallThickness);
      return makeCylinderCupBody(outerR, innerR, height, bottomThickness);
    } else {
      return makeSquareCupBody(outerSize, wallThickness, height, bottomThickness, cornerRadius);
    }
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, bottomThickness, cornerRadius]);

  /* --- base --- */
  const baseGeom = useMemo(() => {
    if (baseHeight <= 0) return null;
    if (isCylinder) {
      return makeCylinderBaseGeom(outerDiameter / 2, baseExtension, baseHeight);
    } else {
      return makeSquareBaseGeom(outerSize, baseExtension, baseHeight, cornerRadius, height);
    }
  }, [isCylinder, outerDiameter, outerSize, baseExtension, baseHeight, cornerRadius, height]);

  /* --- crenellations --- */
  const crenMeshes = useMemo(() => {
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const innerR = Math.max(0.5, outerR - wallThickness);
      const geoms = makeCylinderCrenGeoms(outerR, innerR, height, numCrenellations, crenellationHeight, crenellationWidth);
      return geoms.map((g, i) => (
        <mesh key={`cren-c-${i}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
        </mesh>
      ));
    } else {
      const geoms = makeSquareCrenGeoms(outerSize, wallThickness, height, numCrenellations, crenellationHeight, crenellationWidth);
      return geoms.map((g, i) => (
        <mesh key={`cren-s-${i}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
        </mesh>
      ));
    }
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, numCrenellations, crenellationHeight, crenellationWidth, materialColor, texProps]);

  /* --- towers --- */
  const towerMeshes = useMemo(() => {
    if (isCylinder || !hasTowers) return null;
    const geoms = makeSquareTowerGeoms(outerSize, height, towerRadius, towerHeight);
    return geoms.map((g, i) => (
      <mesh key={`tower-${i}`} geometry={g} name={`Tower_${i}`} receiveShadow castShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} {...texProps} />
      </mesh>
    ));
  }, [isCylinder, hasTowers, outerSize, height, towerRadius, towerHeight, materialColor, texProps]);

  /* --- 3D embossed bricks --- */
  const brickMeshes = useMemo(() => {
    if (!embossedBricks) return null;
    const bw = 20, bh = 8, gap = 1;
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const geoms = makeCylinderBrickGeoms(outerR, height, brickDepth, bw, bh, gap);
      return geoms.map((g, i) => (
        <mesh key={`brick-c-${i}`} geometry={g} name={`Brick_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
        </mesh>
      ));
    } else {
      const geoms = makeSquareBrickGeoms(outerSize, wallThickness, height, brickDepth, bw, bh, gap);
      return geoms.map((g, i) => (
        <mesh key={`brick-s-${i}`} geometry={g} name={`Brick_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
        </mesh>
      ));
    }
  }, [embossedBricks, isCylinder, outerDiameter, outerSize, wallThickness, height, brickDepth, materialColor, texProps]);

  /* --- door (recessed, with frame) --- */
  const doorMesh = useMemo(() => {
    if (!hasDoor) return null;
    const depth = wallThickness + 2;
    const openGeom = makeArchedGeom(doorWidth, doorHeight, depth);
    const frameGeom = makeFrameGeom(doorWidth, doorHeight, 3, depth, true);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = isCylinder ? 0 : -height / 2;
    const posY = bottomY + bottomThickness + doorHeight;
    return (
      <group position={[0, posY, frontZ - 0.01]}>
        <mesh geometry={openGeom} name="CastleDoor" receiveShadow>
          <meshStandardMaterial color={doorColor} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={frameGeom} name="CastleDoorFrame" receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
        </mesh>
      </group>
    );
  }, [hasDoor, doorWidth, doorHeight, wallThickness, isCylinder, outerDiameter, outerSize, bottomThickness, height, doorColor, materialColor, texProps]);

  /* --- windows --- */
  const windowMeshes = useMemo(() => {
    if (!hasWindows) return null;
    const depth = wallThickness + 1;
    const makeOpen = windowArched ? makeArchedGeom : makeRectGeom;
    const openBase = makeOpen(windowWidth, windowHeight, depth);
    const frameBase = makeFrameGeom(windowWidth, windowHeight, 2.5, depth, windowArched);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = isCylinder ? 0 : -height / 2;
    const winY = bottomY + height * 0.6;
    const meshes = [];

    const addPair = (key, go, gf) => {
      meshes.push(
        <mesh key={`wo-${key}`} geometry={go} receiveShadow>
          <meshStandardMaterial color={windowColor} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>,
        <mesh key={`wf-${key}`} geometry={gf} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} {...texProps} />
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
      const half = outerSize / 2 - wallThickness / 2;
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
          }
          go.translate(px, winY + windowHeight, pz);
          gf.translate(px, winY + windowHeight, pz);
          addPair(`s-${s.x}-${s.z}-${i}`, go, gf);
        }
      });
    }
    return meshes;
  }, [hasWindows, numWindows, windowWidth, windowHeight, windowArched, wallThickness, isCylinder, outerDiameter, outerSize, height, windowColor, materialColor, texProps]);

  /* --- top ring (cylinder only) --- */
  const topRing = useMemo(() => {
    if (!isCylinder) return null;
    const outerR = outerDiameter / 2;
    const innerR = Math.max(0.5, outerR - wallThickness);
    const g = new THREE.RingGeometry(innerR, outerR, SEG);
    g.rotateX(Math.PI / 2);
    g.translate(0, height, 0);
    g.computeVertexNormals();
    return (
      <mesh geometry={g} name="CastleTopRing" receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} {...texProps} />
      </mesh>
    );
  }, [isCylinder, outerDiameter, wallThickness, height, materialColor, texProps]);

  const wallMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.9,
      side: THREE.DoubleSide,
      ...texProps,
    });
  }, [materialColor, brickTex]);

  return (
    <group ref={groupRef} name="CastlePencilCase">
      <mesh geometry={bodyGeom} name="CastleBody" material={wallMat} receiveShadow castShadow />
      {topRing}
      {towerMeshes}
      {brickMeshes}
      {doorMesh}
      {windowMeshes}
      {crenMeshes}
    </group>
  );
};

export default CastlePencilCase;
