import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { Text3D } from '@react-three/drei';

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
  autoRepeat = true, // Default to true to wrap completely around the cylinder
}) => {
  const outerR = outerDiameter / 2;
  const innerR = Math.max(1, outerR - wallThickness);
  const letterHeight = height - baseHeight - topRingHeight;
  const fontPath = `/fonts/${fontName}`;

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
  const fontSize = letterHeight + 2; // vertical overlap

  // Calculate repeated text and final rendering string
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
        finalBarsCount: 0, // No bars needed when text covers 360 degrees
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
    
    const startAngle = Math.PI / 2 + finalOccupiedAngleRad / 2 + 0.15; // 0.15 rad safety gap
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

  const mat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
  }, [materialColor]);

  // Handler to center, scale and wrap the text geometry around the cylinder
  const handleTextGeometryUpdate = (self) => {
    const geom = self.geometry;
    if (!geom) return;

    // 1. Center the flat text geometry
    geom.center();
    geom.computeBoundingBox();
    
    // 2. Measure the original flat width
    const box = geom.boundingBox;
    const width = box.max.x - box.min.x;
    if (width <= 0) return;

    const circumference = Math.PI * 2 * R_mid;

    if (autoRepeat) {
      // For autoRepeat, scale X to stretch/compress to exactly fit the full circumference
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

    // 3. Wrap each vertex around the cylinder of radius R_mid
    const posAttr = geom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);

      // Angle wraps counter-clockwise: as x increases (reading left to right),
      // theta decreases, which places the letters clockwise on the cylinder
      // so looking from the front it is read left-to-right (counter-clockwise around).
      const theta = Math.PI / 2 - x / R_mid;
      
      const newX = (R_mid + z) * Math.cos(theta);
      const newZ = (R_mid + z) * Math.sin(theta);
      const newY = y;

      posAttr.setXYZ(i, newX, newY, newZ);
    }
    
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  };

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
      {renderedText && renderedText.trim().length > 0 && (
        <mesh position={[0, posY, 0]} castShadow receiveShadow>
          <Text3D
            font={fontPath}
            size={fontSize}
            height={wallThickness}
            curveSegments={12} // smooth curves
            bevelEnabled={false}
            onUpdate={handleTextGeometryUpdate}
          >
            {renderedText}
            <meshStandardMaterial color={materialColor} roughness={0.85} />
          </Text3D>
        </mesh>
      )}

      {/* 5. Vertical Grate Bars */}
      {verticalBarComponents}

      {/* 6. Compartment Dividers */}
      {dividerComponents}
    </group>
  );
};

export default NamePencilCase;
