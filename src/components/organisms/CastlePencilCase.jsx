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

function makeCylinderCupBody(outerR, innerR, height, bottomThick, baseExt) {
  const hh = height / 2;
  const innerH = height - bottomThick;
  const outerTube = new THREE.CylinderGeometry(outerR, outerR, height, SEG, 1, true);
  outerTube.translate(0, hh, 0);
  const innerTube = new THREE.CylinderGeometry(innerR, innerR, innerH, SEG, 1, true);
  innerTube.translate(0, innerH / 2 + bottomThick, 0);
  const bottomR = outerR + baseExt;
  const bottom = new THREE.RingGeometry(innerR, bottomR, SEG);
  bottom.rotateX(-Math.PI / 2);
  return mergeGeoms([outerTube, innerTube, bottom]);
}

function makeCylinderCrenGeoms(outerR, innerR, height, numCren, crenH) {
  const midR = (outerR + innerR) / 2;
  const wallT = outerR - innerR;
  const gapA = (Math.PI * 2) / numCren;
  const crenW = midR * gapA * 0.5;
  const boxes = [];
  for (let i = 0; i < numCren; i++) {
    const a = i * gapA;
    const g = new THREE.BoxGeometry(crenW, crenH, wallT);
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

function makeSquareCupBody(outerSize, wallThick, height, bottomThick, cornerR, baseExt) {
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

  const sb = s + baseExt;
  const rb = Math.min(cornerR, sb);
  const cap = new THREE.Shape();
  cap.moveTo(-sb + rb, -sb);
  cap.lineTo(sb - rb, -sb).quadraticCurveTo(sb, -sb, sb, -sb + rb);
  cap.lineTo(sb, sb - rb).quadraticCurveTo(sb, sb, sb - rb, sb);
  cap.lineTo(-sb + rb, sb).quadraticCurveTo(-sb, sb, -sb, sb - rb);
  cap.lineTo(-sb, -sb + rb).quadraticCurveTo(-sb, -sb, -sb + rb, -sb);
  const bottomGeom = new THREE.ExtrudeGeometry(cap, { depth: bottomThick, bevelEnabled: false });
  bottomGeom.rotateX(-Math.PI / 2);
  bottomGeom.translate(0, -height / 2, 0);

  return mergeGeoms([wallGeom, innerGeom, bottomGeom]);
}

function makeSquareCrenGeoms(outerSize, wallThick, height, numCren, crenH) {
  const s = outerSize / 2;
  const hh = height / 2;
  const wallCenter = s - wallThick / 2;
  const crenW = (outerSize / numCren) * 0.55;
  const boxes = [];
  const sides = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
  ];
  const perSide = Math.max(1, Math.floor(numCren / 4));
  sides.forEach((side) => {
    for (let i = 0; i < perSide; i++) {
      const t = (i - (perSide - 1) / 2) * ((outerSize - wallThick * 2) / perSide);
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

/* ============ KEMERLI KAPI (duguk, ice gomulu) ============ */

function makeArchedOpeningGeom(w, h, depth) {
  const hw = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, -h);
  shape.lineTo(hw, -h);
  shape.lineTo(hw, 0);
  shape.absarc(0, 0, hw, 0, Math.PI, false);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, 0);
  g.computeVertexNormals();
  return g;
}

function makeWindowGeom(w, h, depth, arched = true) {
  const hw = w / 2;
  const shape = new THREE.Shape();
  if (arched) {
    shape.moveTo(-hw, 0);
    shape.lineTo(-hw, -h);
    shape.lineTo(hw, -h);
    shape.lineTo(hw, 0);
    shape.absarc(0, 0, hw, 0, Math.PI, false);
    shape.closePath();
  } else {
    shape.moveTo(-hw, 0);
    shape.lineTo(-hw, -h);
    shape.lineTo(hw, -h);
    shape.lineTo(hw, 0);
    shape.closePath();
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, 0);
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
  baseExtension = 5,
  numCrenellations = 8,
  crenellationHeight = 20,
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
  groupRef,
}) => {
  const isCylinder = shape === 'cylinder';

  const brickTexture = useMemo(() => (showBrickTexture ? createBrickTexture() : null), [showBrickTexture]);

  /* --- body --- */
  const bodyGeom = useMemo(() => {
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const innerR = Math.max(0.5, outerR - wallThickness);
      return makeCylinderCupBody(outerR, innerR, height, bottomThickness, baseExtension);
    } else {
      return makeSquareCupBody(outerSize, wallThickness, height, bottomThickness, cornerRadius, baseExtension);
    }
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, bottomThickness, cornerRadius, baseExtension]);

  /* --- crenellations --- */
  const crenMeshes = useMemo(() => {
    if (isCylinder) {
      const outerR = outerDiameter / 2;
      const innerR = Math.max(0.5, outerR - wallThickness);
      const geoms = makeCylinderCrenGeoms(outerR, innerR, height, numCrenellations, crenellationHeight);
      return geoms.map((g, i) => (
        <mesh key={`cren-c-${i}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTexture} />
        </mesh>
      ));
    } else {
      const geoms = makeSquareCrenGeoms(outerSize, wallThickness, height, numCrenellations, crenellationHeight);
      return geoms.map((g, i) => (
        <mesh key={`cren-s-${i}`} geometry={g} name={`Crenellation_${i}`} receiveShadow castShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} map={brickTexture} />
        </mesh>
      ));
    }
  }, [isCylinder, outerDiameter, outerSize, wallThickness, height, numCrenellations, crenellationHeight, materialColor, brickTexture]);

  /* --- towers --- */
  const towerMeshes = useMemo(() => {
    if (isCylinder || !hasTowers) return null;
    const geoms = makeSquareTowerGeoms(outerSize, height, towerRadius, towerHeight);
    return geoms.map((g, i) => (
      <mesh key={`tower-${i}`} geometry={g} name={`Tower_${i}`} receiveShadow castShadow>
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTexture} />
      </mesh>
    ));
  }, [isCylinder, hasTowers, outerSize, height, towerRadius, towerHeight, materialColor, brickTexture]);

  /* --- door (recessed) --- */
  const doorMesh = useMemo(() => {
    if (!hasDoor) return null;
    const depth = wallThickness + 2;
    const g = makeArchedOpeningGeom(doorWidth, doorHeight, depth);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = isCylinder ? 0 : -height / 2;
    return (
      <mesh
        geometry={g}
        name="CastleDoor"
        position={[0, bottomY + bottomThickness + doorHeight, frontZ - 0.01]}
        rotation={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={doorColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    );
  }, [hasDoor, doorWidth, doorHeight, wallThickness, isCylinder, outerDiameter, outerSize, bottomThickness, height, doorColor]);

  /* --- windows --- */
  const windowMeshes = useMemo(() => {
    if (!hasWindows) return null;
    const depth = wallThickness + 1;
    const wGeom = makeWindowGeom(windowWidth, windowHeight, depth, windowArched);
    const frontZ = isCylinder ? outerDiameter / 2 : outerSize / 2;
    const bottomY = isCylinder ? 0 : -height / 2;
    const winY = bottomY + height * 0.6;

    const meshes = [];

    if (isCylinder) {
      for (let i = 0; i < numWindows; i++) {
        const a = (i / numWindows) * Math.PI * 2;
        const g = wGeom.clone();
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        );
        g.applyQuaternion(q);
        g.translate(Math.sin(a) * frontZ, winY + windowHeight, Math.cos(a) * frontZ);
        meshes.push(
          <mesh key={`win-${i}`} geometry={g} name={`Window_${i}`} receiveShadow>
            <meshStandardMaterial color={windowColor} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        );
      }
    } else {
      const half = outerSize / 2 - wallThickness / 2;
      const sides = [
        { x: 0, z: 1 },
        { x: 1, z: 0 },
        { x: 0, z: -1 },
        { x: -1, z: 0 },
      ];
      sides.forEach((s, si) => {
        const perSide = Math.max(1, Math.floor(numWindows / 4));
        for (let i = 0; i < perSide; i++) {
          const t = (i - (perSide - 1) / 2) * ((outerSize * 0.6) / perSide);
          const g = wGeom.clone();
          let px, pz;
          if (s.x !== 0) {
            px = s.x * half;
            pz = t;
            g.rotateY(s.x > 0 ? Math.PI / 2 : -Math.PI / 2);
          } else {
            px = t;
            pz = s.z * half;
          }
          g.translate(px, winY + windowHeight, pz);
          meshes.push(
            <mesh key={`win-${si}-${i}`} geometry={g} name={`Window_${si}_${i}`} receiveShadow>
              <meshStandardMaterial color={windowColor} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          );
        }
      });
    }
    return meshes;
  }, [hasWindows, numWindows, windowWidth, windowHeight, windowArched, wallThickness, isCylinder, outerDiameter, outerSize, height, windowColor]);

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
        <meshStandardMaterial color={materialColor} roughness={0.85} side={THREE.DoubleSide} map={brickTexture} />
      </mesh>
    );
  }, [isCylinder, outerDiameter, wallThickness, height, materialColor, brickTexture]);

  const wallMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.9,
      side: THREE.DoubleSide,
      map: brickTexture,
    });
  }, [materialColor, brickTexture]);

  return (
    <group ref={groupRef} name="CastlePencilCase">
      <mesh geometry={bodyGeom} name="CastleBody" material={wallMat} receiveShadow castShadow />
      {topRing}
      {towerMeshes}
      {doorMesh}
      {windowMeshes}
      {crenMeshes}
    </group>
  );
};

export default CastlePencilCase;
