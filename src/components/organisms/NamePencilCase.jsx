import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { Text3D } from '@react-three/drei';

const SEG = 48;

const NamePencilCase = ({
  text = 'SEMİH',
  fontName = 'DINMittelschriftStd.json',
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

  // 2. Top Ring Geometry (Outer Cylinder minus Inner Cylinder using CSG)
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
    const h = height - baseHeight + 2; // extended for clean cut
    const g = new THREE.CylinderGeometry(r, r, h, SEG);
    g.translate(0, baseHeight + (height - baseHeight) / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [hasCentralColumn, centralColumnDiameter, wallThickness, height, baseHeight]);

  // 4. Letters (positioned around a circle)
  const letterComponents = useMemo(() => {
    if (!text || text.trim().length === 0) return [];
    const chars = text.split('');
    const N = chars.length;
    const arcAngleRad = (textArcAngle * Math.PI) / 180;
    const startAngle = Math.PI / 2 - arcAngleRad / 2;
    const R_mid = outerR - wallThickness / 2;
    const posY = baseHeight + letterHeight / 2;
    const fontSize = letterHeight + 2; // 2mm overlap total (1mm top, 1mm bottom)

    return chars.map((char, i) => {
      let theta = Math.PI / 2;
      if (N > 1) {
        theta = startAngle + i * (arcAngleRad / (N - 1));
      }
      const px = R_mid * Math.cos(theta);
      const pz = R_mid * Math.sin(theta);
      const rotY = Math.PI / 2 - theta;

      return (
        <group key={`char-${i}-${char}`} position={[px, posY, pz]} rotation={[0, rotY, 0]}>
          <Text3D
            font={fontPath}
            size={fontSize}
            height={wallThickness}
            curveSegments={6}
            bevelEnabled={false}
            onUpdate={(self) => {
              self.geometry.center();
            }}
          >
            {char}
            <meshStandardMaterial color={materialColor} roughness={0.85} />
          </Text3D>
        </group>
      );
    });
  }, [text, textArcAngle, outerR, wallThickness, baseHeight, letterHeight, fontPath, materialColor]);

  // 5. Vertical Grate Bars (filling the remaining arc)
  const verticalBarComponents = useMemo(() => {
    if (numVerticalBars <= 0) return [];
    const arcAngleRad = (textArcAngle * Math.PI) / 180;
    const startAngle = Math.PI / 2 + arcAngleRad / 2;
    const endAngle = Math.PI / 2 - arcAngleRad / 2 + Math.PI * 2;
    const R_mid = outerR - wallThickness / 2;
    const posY = baseHeight + letterHeight / 2;
    const barHeight = letterHeight + 2; // 2mm overlap total

    const g = new THREE.CylinderGeometry(wallThickness / 2, wallThickness / 2, barHeight, 12);
    g.computeVertexNormals();

    const bars = [];
    const step = (endAngle - startAngle) / (numVerticalBars + 1);
    for (let j = 1; j <= numVerticalBars; j++) {
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
  }, [numVerticalBars, textArcAngle, outerR, wallThickness, baseHeight, letterHeight, materialColor]);

  // 6. Dividers / Connector Spokes
  const dividerComponents = useMemo(() => {
    if (dividerMode === 'none' || numDividers <= 0) return [];
    const R_cent_out = hasCentralColumn ? centralColumnDiameter / 2 : 0;
    const R_out_in = outerR - wallThickness;
    const L = R_out_in - R_cent_out;
    if (L <= 0) return [];

    const R_mid = R_cent_out + L / 2;
    const spokes = [];

    const heightSpoke = dividerMode === 'support' ? 6 : letterHeight + 2; // 2mm overlap total

    for (let k = 0; k < numDividers; k++) {
      const phi = k * ((Math.PI * 2) / numDividers);
      const px = R_mid * Math.cos(phi);
      const pz = R_mid * Math.sin(phi);

      const g = new THREE.BoxGeometry(L, heightSpoke, wallThickness);
      g.computeVertexNormals();

      if (dividerMode === 'support') {
        // Bottom support spoke (just above base)
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

        // Top support spoke (just below top ring)
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
        // Full height divider spoke
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

  return (
    <group ref={groupRef} name="NamePencilCase">
      {/* 1. Base Plate */}
      {baseGeom && (
        <mesh geometry={baseGeom} name="NameBase" material={mat} receiveShadow castShadow />
      )}

      {/* 2. Top Ring (using CSG Subtraction) */}
      <mesh name="NameTopRing" material={mat} receiveShadow castShadow>
        <Geometry>
          <Base geometry={topRingOuterGeom} />
          <Subtraction geometry={topRingInnerGeom} />
        </Geometry>
      </mesh>

      {/* 3. Central Column (using CSG Subtraction) */}
      {hasCentralColumn && centralColumnOuterGeom && centralColumnInnerGeom && (
        <mesh name="NameCentralColumn" material={mat} receiveShadow castShadow>
          <Geometry>
            <Base geometry={centralColumnOuterGeom} />
            <Subtraction geometry={centralColumnInnerGeom} />
          </Geometry>
        </mesh>
      )}

      {/* 4. Custom Text Letters */}
      {letterComponents}

      {/* 5. Vertical Grate Bars */}
      {verticalBarComponents}

      {/* 6. Compartment Dividers */}
      {dividerComponents}
    </group>
  );
};

export default NamePencilCase;
