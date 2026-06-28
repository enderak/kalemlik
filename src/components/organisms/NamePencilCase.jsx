import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

const SEG = 48;

const NamePencilCase = ({
  text = 'SEMİH',
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

  // Load the font synchronously using Suspense
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

  // 2. Top Ring Geometry (CSG subtraction)
  const topRingOuterGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(outerR, outerR, topRingHeight, SEG);
    g.translate(0, height - topRingHeight / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [outerR, topRingHeight, height]);

  const topRingInnerGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(innerR, innerR, topRingHeight + 2, SEG);
    g.translate(0, height - topRingHeight / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [innerR, topRingHeight, height]);

  // 3. Central Column Geometry
  const centralColumnOuterGeom = useMemo(() => {
    if (!hasCentralColumn) return null;
    const r = centralColumnDiameter / 2;
    const h = height - baseHeight;
    const g = new THREE.CylinderGeometry(r, r, h, SEG);
    g.translate(0, baseHeight + h / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [hasCentralColumn, centralColumnDiameter, height, baseHeight]);

  const centralColumnInnerGeom = useMemo(() => {
    if (!hasCentralColumn) return null;
    const r = Math.max(1, centralColumnDiameter / 2 - wallThickness);
    const h = height - baseHeight + 2;
    const g = new THREE.CylinderGeometry(r, r, h, SEG);
    g.translate(0, baseHeight + (height - baseHeight) / 2, 0);
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

  // 5. Vertical Grate Bars (distributed in the remaining angle)
  const verticalBarComponents = useMemo(() => {
    if (finalBarsCount <= 0) return [];
    
    const startAngle = Math.PI / 2 + finalOccupiedAngleRad / 2 + 0.15;
    const endAngle = Math.PI / 2 - finalOccupiedAngleRad / 2 + Math.PI * 2 - 0.15;
    const barHeight = letterHeight + 2; // 2mm vertical overlap

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

  const mat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.95, // matte finish to hide triangulation facets
      metalness: 0.1,  // subtle plastic reflection
      side: THREE.DoubleSide,
    });
  }, [materialColor]);

  // 4. Wrapped Text Geometry (Generated synchronously and wrapped)
  const textGeom = useMemo(() => {
    if (!renderedText || renderedText.trim().length === 0) return null;

    // Generate flat shapes from text using three.js font
    const shapes = font.generateShapes(renderedText, fontSize);
    
    // Extrude flat shapes to get 3D geometry
    const geom = new THREE.ExtrudeGeometry(shapes, {
      depth: wallThickness,
      bevelEnabled: false,
      curveSegments: 12,
    });

    // Center the flat geometry (positions origin at geometric center)
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

  return (
    <group ref={groupRef} name="NamePencilCase">
      {/* 1. Base Plate */}
      {baseGeom && (
        <mesh geometry={baseGeom} name="NameBase" material={mat} receiveShadow castShadow />
      )}

      {/* 2. Top Ring */}
      <mesh name="NameTopRing" material={mat} receiveShadow castShadow>
        <Geometry>
          <Base geometry={topRingOuterGeom} />
          <Subtraction geometry={topRingInnerGeom} />
        </Geometry>
      </mesh>

      {/* 3. Central Column */}
      {hasCentralColumn && centralColumnOuterGeom && centralColumnInnerGeom && (
        <mesh name="NameCentralColumn" material={mat} receiveShadow castShadow>
          <Geometry>
            <Base geometry={centralColumnOuterGeom} />
            <Subtraction geometry={centralColumnInnerGeom} />
          </Geometry>
        </mesh>
      )}

      {/* 4. Wrapped Text */}
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
