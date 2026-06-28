import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

const SEG = 48;

// Helper to create a mathematically hollow tube (cylinder with a hole) without CSG,
// which prevents the STLExporter from exporting extra hidden solid geometries.
function makeHollowCylinderGeometry(outerRadius, innerRadius, height, segments) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: Math.max(4, segments / 4),
  });
  geom.rotateX(-Math.PI / 2); // align with Y-axis
  return geom;
}

// Helper function to subdivide a geometry's triangles.
// This increases vertex density so the flat faces bend smoothly around the cylinder without creases.
function subdivideGeometry(geom, levels = 2) {
  // Convert to non-indexed geometry so we can easily split individual triangles
  let currentGeom = geom.index ? geom.toNonIndexed() : geom.clone();

  for (let l = 0; l < levels; l++) {
    const posAttr = currentGeom.attributes.position;
    const normAttr = currentGeom.attributes.normal;
    const uvAttr = currentGeom.attributes.uv;

    const count = posAttr.count;
    const newPos = [];
    const newNorm = [];
    const newUv = [];

    for (let i = 0; i < count; i += 3) {
      // Get the 3 vertices of the current triangle
      const p0 = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const p1 = new THREE.Vector3(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      const p2 = new THREE.Vector3(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));

      const n0 = new THREE.Vector3(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      const n1 = new THREE.Vector3(normAttr.getX(i + 1), normAttr.getY(i + 1), normAttr.getZ(i + 1));
      const n2 = new THREE.Vector3(normAttr.getX(i + 2), normAttr.getY(i + 2), normAttr.getZ(i + 2));

      let u0, u1, u2;
      if (uvAttr) {
        u0 = new THREE.Vector2(uvAttr.getX(i), uvAttr.getY(i));
        u1 = new THREE.Vector2(uvAttr.getX(i + 1), uvAttr.getY(i + 1));
        u2 = new THREE.Vector2(uvAttr.getX(i + 2), uvAttr.getY(i + 2));
      }

      // Calculate edge midpoints
      const p01 = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const p12 = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const p20 = new THREE.Vector3().addVectors(p2, p0).multiplyScalar(0.5);

      const n01 = new THREE.Vector3().addVectors(n0, n1).normalize();
      const n12 = new THREE.Vector3().addVectors(n1, n2).normalize();
      const n20 = new THREE.Vector3().addVectors(n2, n0).normalize();

      let u01, u12, u20;
      if (uvAttr) {
        u01 = new THREE.Vector2().addVectors(u0, u1).multiplyScalar(0.5);
        u12 = new THREE.Vector2().addVectors(u1, u2).multiplyScalar(0.5);
        u20 = new THREE.Vector2().addVectors(u2, u0).multiplyScalar(0.5);
      }

      // Helper to push a new subdivided triangle
      const addTriangle = (va, vb, vc, na, nb, nc, ua, ub, uc) => {
        newPos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
        newNorm.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
        if (uvAttr) {
          newUv.push(ua.x, ua.y, ub.x, ub.y, uc.x, uc.y);
        }
      };

      // Split 1 triangle into 4 smaller triangles
      addTriangle(p0, p01, p20, n0, n01, n20, u0, u01, u20);
      addTriangle(p1, p12, p01, n1, n12, n01, u1, u12, u01);
      addTriangle(p2, p20, p12, n2, n20, n12, u2, u20, u12);
      addTriangle(p01, p12, p20, n01, n12, n20, u01, u12, u20);
    }

    const nextGeom = new THREE.BufferGeometry();
    nextGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPos), 3));
    nextGeom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(newNorm), 3));
    if (uvAttr) {
      nextGeom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(newUv), 2));
    }
    currentGeom = nextGeom;
  }

  return currentGeom;
}

const NamePencilCase = ({
  text = 'ENDER',
  fontName = 'Plus_Jakarta_Sans_Bold.json',
  outerDiameter = 100,
  height = 150,
  wallThickness = 4,
  baseHeight = 8,
  baseExtension = 6,
  topRingHeight = 8,
  textArcAngle = 120,
  numVerticalBars = 12,
  hasCentralColumn = true,
  centralColumnDiameter = 30,
  dividerMode = 'support',
  numDividers = 3,
  materialColor = '#a8a29e',
  groupRef,
  autoRepeat = true,
}) => {
  const outerR = outerDiameter / 2;
  const innerR = Math.max(1, outerR - wallThickness);
  const letterHeight = height - baseHeight - topRingHeight;
  const fontPath = `/fonts/${fontName}`;

  // Load font synchronously using suspense
  const font = useLoader(FontLoader, fontPath);

  // 1. Base Plate Geometry
  const baseGeom = useMemo(() => {
    if (baseHeight <= 0) return null;
    const r = outerR + baseExtension;
    const g = new THREE.CylinderGeometry(r, r, baseHeight, SEG);
    g.translate(0, baseHeight / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [outerR, baseExtension, baseHeight]);

  // 2. Top Ring Geometry (Native Hollow Cylinder)
  const topRingGeom = useMemo(() => {
    const g = makeHollowCylinderGeometry(outerR, innerR, topRingHeight, SEG);
    g.translate(0, height - topRingHeight, 0);
    g.computeVertexNormals();
    return g;
  }, [outerR, innerR, topRingHeight, height]);

  // 3. Central Column Geometry (Native Hollow Cylinder)
  const centralColumnGeom = useMemo(() => {
    if (!hasCentralColumn) return null;
    const rOuter = centralColumnDiameter / 2;
    const rInner = Math.max(1, rOuter - wallThickness);
    const h = height - baseHeight;
    const g = makeHollowCylinderGeometry(rOuter, rInner, h, SEG);
    g.translate(0, baseHeight, 0);
    g.computeVertexNormals();
    return g;
  }, [hasCentralColumn, centralColumnDiameter, wallThickness, height, baseHeight]);

  const R_mid = outerR - wallThickness / 2;
  const posY = baseHeight + letterHeight / 2;
  const fontSize = letterHeight; // base font size

  // Calculate repeated text and final rendering parameters
  const { renderedText, finalBarsCount, finalOccupiedAngleRad } = useMemo(() => {
    if (!text || text.trim().length === 0) {
      return { renderedText: '', finalBarsCount: numVerticalBars, finalOccupiedAngleRad: 0 };
    }

    const cleanText = text.trim();

    if (autoRepeat) {
      // Estimate width of a single name copy (character width ~0.65 of height + spaces)
      const approxSingleWidth = cleanText.length * letterHeight * 0.65 + (letterHeight * 0.5);
      const circumference = Math.PI * 2 * R_mid;
      const repetitions = Math.max(1, Math.round(circumference / approxSingleWidth));
      
      // Build repeated string with double space separation
      const repeated = Array(repetitions).fill(cleanText).join('  ') + '  ';
      return {
        renderedText: repeated,
        finalBarsCount: 0,
        finalOccupiedAngleRad: Math.PI * 2,
      };
    } else {
      const approxWidth = cleanText.length * letterHeight * 0.65;
      const maxAngleRad = (textArcAngle * Math.PI) / 180;
      const occupied = Math.min(maxAngleRad, approxWidth / R_mid);
      return {
        renderedText: cleanText,
        finalBarsCount: numVerticalBars,
        finalOccupiedAngleRad: occupied,
      };
    }
  }, [text, autoRepeat, letterHeight, R_mid, numVerticalBars, textArcAngle]);

  const mat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.95, // matte finish
      metalness: 0.1,  // subtle plastic reflection
      side: THREE.DoubleSide,
    });
  }, [materialColor]);

  // 4. Wrapped & Subdivided Text Geometry
  const textGeom = useMemo(() => {
    if (!renderedText || renderedText.trim().length === 0) return null;

    // Generate flat shapes from text using three.js font
    const shapes = font.generateShapes(renderedText, fontSize);
    
    // Extrude flat shapes to get 3D geometry
    let geom = new THREE.ExtrudeGeometry(shapes, {
      depth: wallThickness,
      bevelEnabled: false,
      curveSegments: 12,
    });

    // Subdivide the geometry to increase vertex density.
    // This allows the cap faces to bend smoothly around the cylinder.
    geom = subdivideGeometry(geom, 2);

    // Center the geometry (positions origin at geometric center)
    geom.center();
    geom.computeBoundingBox();

    let box = geom.boundingBox;
    let width = box.max.x - box.min.x;
    let currentHeight = box.max.y - box.min.y;
    if (width <= 0 || currentHeight <= 0) return geom;

    // Scale X and Y uniformly first to make the visual height of capital letters
    // exactly equal to targetHeight, preserving font proportions and ensuring 1mm overlap
    // at both the top ring and the bottom base.
    const targetHeight = letterHeight + 2.0;
    const scaleFactor = targetHeight / currentHeight;
    geom.scale(scaleFactor, scaleFactor, 1);
    
    // Recompute bounding box and width
    geom.computeBoundingBox();
    box = geom.boundingBox;
    width = box.max.x - box.min.x;

    const circumference = Math.PI * 2 * R_mid;

    if (autoRepeat) {
      // Scale X to stretch/compress to exactly fit the full circumference
      geom.scale(circumference / width, 1, 1);
      geom.computeBoundingBox();
    } else {
      // Compress X scale if it exceeds max allowed angle
      const maxAngleRad = (textArcAngle * Math.PI) / 180;
      const W_max = R_mid * maxAngleRad;
      if (width > W_max) {
        const scaleX = W_max / width;
        geom.scale(scaleX, 1, 1);
        geom.computeBoundingBox();
      }
    }

    // Wrap flat geometry vertices around the cylinder
    const posAttr = geom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);

      // Angle wraps counter-clockwise: as x increases, theta decreases.
      const theta = Math.PI / 2 - x / R_mid;
      
      const newX = (R_mid + z) * Math.cos(theta);
      const newZ = (R_mid + z) * Math.sin(theta);
      const newY = y;

      posAttr.setXYZ(i, newX, newY, newZ);
    }
    
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();

    return geom;
  }, [renderedText, font, fontSize, wallThickness, R_mid, autoRepeat, textArcAngle, letterHeight]);

  // 5. Vertical Grate Bars (distributed in the remaining angle)
  const verticalBarComponents = useMemo(() => {
    if (finalBarsCount <= 0) return [];
    
    const startAngle = Math.PI / 2 + finalOccupiedAngleRad / 2 + 0.15;
    const endAngle = Math.PI / 2 - finalOccupiedAngleRad / 2 + Math.PI * 2 - 0.15;
    const barHeight = letterHeight + 2;

    const g = new THREE.CylinderGeometry(wallThickness / 2, wallThickness / 2, barHeight, 12);
    g.computeVertexNormals();

    const bars = [];
    const step = (endAngle - startAngle) / (finalBarsCount + 1);
    for (let j = 1; j <= finalBarsCount; j++) {
      const theta = startAngle + j * step;
      const px = R_mid * Math.cos(theta);
      const pz = R_mid * Math.sin(theta);
      bars.push(
        <mesh key={`bar-${j}`} geometry={g} position={[px, posY, pz]} castShadow receiveShadow>
          <meshStandardMaterial color={materialColor} roughness={0.85} />
        </mesh>
      );
    }
    return bars;
  }, [finalBarsCount, finalOccupiedAngleRad, R_mid, posY, letterHeight, wallThickness, materialColor]);

  // 6. Dividers / Connector Spokes
  const dividerComponents = useMemo(() => {
    if (dividerMode === 'none' || numDividers <= 0) return [];
    const R_cent_out = hasCentralColumn ? centralColumnDiameter / 2 : 0;
    const R_out_in = outerR - wallThickness;
    const L = R_out_in - R_cent_out;
    if (L <= 0) return [];

    const R_spoke_mid = R_cent_out + L / 2;
    const spokes = [];
    const heightSpoke = dividerMode === 'support' ? 6 : letterHeight + 2;

    for (let k = 0; k < numDividers; k++) {
      const phi = k * ((Math.PI * 2) / numDividers);
      const px = R_spoke_mid * Math.cos(phi);
      const pz = R_spoke_mid * Math.sin(phi);

      const g = new THREE.BoxGeometry(L, heightSpoke, wallThickness);
      g.computeVertexNormals();

      if (dividerMode === 'support') {
        const yBottom = baseHeight + 3;
        spokes.push(
          <mesh
            key={`spoke-b-${k}`}
            geometry={g}
            position={[px, yBottom, pz]}
            rotation={[0, -phi, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={materialColor} roughness={0.85} />
          </mesh>
        );

        const yTop = height - topRingHeight - 3;
        spokes.push(
          <mesh
            key={`spoke-t-${k}`}
            geometry={g}
            position={[px, yTop, pz]}
            rotation={[0, -phi, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={materialColor} roughness={0.85} />
          </mesh>
        );
      } else {
        const yCenter = baseHeight + letterHeight / 2;
        spokes.push(
          <mesh
            key={`spoke-f-${k}`}
            geometry={g}
            position={[px, yCenter, pz]}
            rotation={[0, -phi, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={materialColor} roughness={0.85} />
          </mesh>
        );
      }
    }
    return spokes;
  }, [dividerMode, numDividers, hasCentralColumn, centralColumnDiameter, outerR, wallThickness, baseHeight, letterHeight, height, topRingHeight, materialColor]);

  return (
    <group ref={groupRef} name="NamePencilCase">
      {/* 1. Base Plate */}
      {baseGeom && (
        <mesh geometry={baseGeom} name="NameBase" material={mat} receiveShadow castShadow />
      )}

      {/* 2. Top Ring */}
      {topRingGeom && (
        <mesh geometry={topRingGeom} name="NameTopRing" material={mat} receiveShadow castShadow />
      )}

      {/* 3. Central Column */}
      {hasCentralColumn && centralColumnGeom && (
        <mesh geometry={centralColumnGeom} name="NameCentralColumn" material={mat} receiveShadow castShadow />
      )}

      {/* 4. Wrapped & Subdivided Text */}
      {textGeom && (
        <mesh geometry={textGeom} position={[0, posY, 0]} material={mat} castShadow receiveShadow />
      )}

      {/* 5. Vertical Grate Bars */}
      {verticalBarComponents}

      {/* 6. Compartment Dividers */}
      {dividerComponents}
    </group>
  );
};

export default NamePencilCase;
