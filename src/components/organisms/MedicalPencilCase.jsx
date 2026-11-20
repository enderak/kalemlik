import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { ensureTurkishFontGlyphs } from '../../utils/fontUtils';
import {
  evalCoatProfile,
  evalCoatOuterPoint,
  getExactCoatSurfaceZ,
  buildCoatBodyGeometry,
  buildCoatBackPlateGeometry,
  buildCoatBackIslandsGeometry,
  buildCoatBackInlaysGeometry,
  mergeGeometries,
  buildNotchedLapelGeometry,
  buildInnerShirtGeometry,
  getChestPocketLayout,
  buildCoatButtonsGeometry,
  buildCoatPocketsGeometry,
  buildCoatArmsGeometry,
  buildStethoscopeGeometry,
} from '../../utils/medicalGarmentBuilder';
import {
  resampleShapesForCleanExtrusion,
  subdivideExtrudedGeometry,
} from '../../utils/jerseyVectorAssets';

export const MEDICAL_ROLES = {
  secretary: {
    id: 'secretary',
    name: 'Tıbbi Sekreter',
    icon: '📋',
    coatColor: '#FFFFFF',
    collarColor: '#FFFFFF',
    innerShirtColor: '#E2E8F0', // Açık gri/mavi iç gömlek
    buttonColor: '#334155',    // Koyu şık düğmeler
    textColor: '#1E293B',      // Okunaklı lacivert/siyah yazı
    defaultFrontText: 'TIBBİ SEKRETER',
    defaultBackText: 'TIBBİ\nSEKRETER',
    hasStethoscope: false,
    hasButtons: true,
  },
  doctor: {
    id: 'doctor',
    name: 'Doktor',
    icon: '🩺',
    coatColor: '#FFFFFF',
    collarColor: '#FFFFFF',
    innerShirtColor: '#38BDF8', // Açık mavi klinik gömleği
    buttonColor: '#0F172A',
    textColor: '#0F172A',
    defaultFrontText: 'UZM. DR.',
    defaultBackText: 'DOKTOR',
    hasStethoscope: true,
    hasButtons: true,
  },
  nurse: {
    id: 'nurse',
    name: 'Hemşire',
    icon: '💉',
    coatColor: '#0284C7',     // Hastane scrubs mavisi (veya yeşili)
    collarColor: '#0369A1',
    innerShirtColor: '#FFFFFF',
    buttonColor: '#FFFFFF',
    textColor: '#FFFFFF',
    defaultFrontText: 'HEMŞİRE',
    defaultBackText: 'HEMŞİRE',
    hasStethoscope: false,
    hasButtons: true,
  },
};

const MedicalPencilCase = ({
  // Boyutlar
  coatWidth = 82,
  coatDepth = 50,
  height = 118,
  wallThickness = 2.2,
  bottomThickness = 4.0,

  // Alt Tabla (Taban Plakası)
  baseShape = 'rectangle',
  baseWidth = 88,
  baseDepth = 58,
  baseThickness = 3.8,
  baseCornerRadius = 18,
  modelElevation = 0,

  // Rol ve Stil
  medicalRole = 'secretary', // 'secretary' | 'doctor' | 'nurse'
  coatColor = '#FFFFFF',
  collarColor = '#FFFFFF',
  innerShirtColor = '#E2E8F0',
  buttonColor = '#334155',
  hasButtons = true,
  textColor = '#0F172A',
  stethoscopeColor = '#0F172A',
  baseColor = '#1E293B',

  // Sırt Yazısı (Satır satır: TIBBİ / SEKRETER)
  backText = 'TIBBİ\nSEKRETER',
  backTextStyle = 'plate', // 'plate' | 'engrave' | 'emboss'
  backTextHeight = 7.0,
  backTextDepth = 1.0,
  backTextElevation = 64,
  plateColor = '#FFFFFF',

  // Ön Yazı (Göğüs Cebi Üzeri İsim / Unvan)
  frontText = 'TIBBİ SEKRETER',
  frontTextHeight = 4.8,
  frontTextDepth = 0.8,
  frontTextElevation = 70,

  // Yaka Açıklığı & Kalem Hazne Genişliği
  collarOpeningWidth = 28,
  cavityWidth = 54,
  cavityDepth = 42,

  // Font
  fontName = 'DINMittelschriftStd.json',

  groupRef,
}) => {
  // Athletic & clear geometric font
  const fontPath = `/fonts/${fontName || 'DINMittelschriftStd.json'}`;
  const rawMainFont = useLoader(FontLoader, fontPath);

  const font = useMemo(() => {
    if (!rawMainFont) return null;
    return ensureTurkishFontGlyphs(rawMainFont);
  }, [rawMainFont]);

  // Vertical layout calculations
  const effectiveBaseThickness = Math.max(2.5, Number(baseThickness) || 3.8);
  const totalBaseH = effectiveBaseThickness + Math.max(0, Number(modelElevation) || 0);

  const layout = useMemo(() => {
    const totalH = Math.max(90, Number(height) || 118);
    const coatBottomY = totalBaseH;
    const coatTopY = totalH - 1.45;
    const coatSpan = coatTopY - coatBottomY;
    return {
      coatWidth: Math.max(60, Number(coatWidth) || 82),
      coatDepth: Math.max(40, Number(coatDepth) || 50),
      collarOpeningWidth: Math.max(16, Number(collarOpeningWidth) || 28),
      hasButtons: Boolean(hasButtons),
      coatBottomY,
      coatTopY,
      coatSpan,
      totalH,
      baseH: totalBaseH,
    };
  }, [height, totalBaseH, coatWidth, coatDepth, collarOpeningWidth, hasButtons]);

  // Helper for elevation mapping
  const mapCoatY = (sliderY) => {
    const t = Math.max(0.05, Math.min(0.95, (Number(sliderY) - 4.0) / 111.0));
    return layout.coatBottomY + t * layout.coatSpan;
  };

  // 1. Base Plate (Taban Plakası - Dikdörtgen / Kare / Yuvarlak / Elips)
  const baseGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const rawW = Math.max(60, Number(baseWidth) || 88);
    const rawD = Math.max(44, Number(baseDepth) || 58);
    const isSquareOrCircle = baseShape === 'square' || baseShape === 'circle';
    const bw = isSquareOrCircle ? Math.max(rawW, rawD) : rawW;
    const bd = isSquareOrCircle ? Math.max(rawW, rawD) : rawD;
    const bevel = Math.min(0.8, effectiveBaseThickness * 0.22);
    const hw = bw / 2 - bevel;
    const hd = bd / 2 - bevel;

    if (baseShape === 'circle') {
      shape.absarc(0, 0, hw, 0, Math.PI * 2, false);
    } else if (baseShape === 'ellipse') {
      shape.absellipse(0, 0, hw, hd, 0, Math.PI * 2, false, 0);
    } else {
      const defaultR = baseShape === 'square' ? 8 : 14;
      const rawR =
        baseCornerRadius !== undefined && baseCornerRadius !== null
          ? Number(baseCornerRadius)
          : defaultR;
      const br = Math.max(
        0,
        Math.min(
          Math.min(hw, hd) * 0.9,
          (Number.isNaN(rawR) ? defaultR : rawR) - bevel
        )
      );

      if (br <= 0.05) {
        shape.moveTo(-hw, hd);
        shape.lineTo(hw, hd);
        shape.lineTo(hw, -hd);
        shape.lineTo(-hw, -hd);
        shape.closePath();
      } else {
        shape.moveTo(-hw + br, hd);
        shape.lineTo(hw - br, hd);
        shape.quadraticCurveTo(hw, hd, hw, hd - br);
        shape.lineTo(hw, -hd + br);
        shape.quadraticCurveTo(hw, -hd, hw - br, -hd);
        shape.lineTo(-hw + br, -hd);
        shape.quadraticCurveTo(-hw, -hd, -hw, -hd + br);
        shape.lineTo(-hw, hd - br);
        shape.quadraticCurveTo(-hw, hd, -hw + br, hd);
      }
    }

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.4, totalBaseH - 2 * bevel),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 64,
    });
    geom.translate(0, 0, bevel);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, [baseShape, baseWidth, baseDepth, effectiveBaseThickness, baseCornerRadius, totalBaseH]);

  // 2. Watertight Main Coat Body (Outer Shell + Inner Pencil Cavity)
  const coatBodyGeom = useMemo(() => {
    return buildCoatBodyGeometry(layout, wallThickness, cavityWidth, cavityDepth);
  }, [layout, wallThickness, cavityWidth, cavityDepth]);

  // 3. Notched Lapel / Ceket Yaka (Ayarlanabilir Yaka Açıklığı ile)
  const lapelGeoms = useMemo(() => {
    return buildNotchedLapelGeometry(layout, collarOpeningWidth, wallThickness);
  }, [layout, collarOpeningWidth, wallThickness]);

  // 3b. Inner Shirt & Collarbone Crew-Neck Rib (Dekolte Önleyici Yaka İçi Kapama)
  const innerShirtGeom = useMemo(() => {
    return buildInnerShirtGeometry(layout, collarOpeningWidth, wallThickness);
  }, [layout, collarOpeningWidth, wallThickness]);

  // 4. Center Front Buttons (4 adet dikişli önlük düğmesi)
  const buttonGeoms = useMemo(() => {
    if (!hasButtons) return [];
    return buildCoatButtonsGeometry(layout);
  }, [hasButtons, layout]);

  // 5. Pockets (Chest pocket + Two lower pockets)
  const pocketItems = useMemo(() => {
    return buildCoatPocketsGeometry(layout, wallThickness);
  }, [layout, wallThickness]);

  // 6. Arms (Hands-in-pockets pose, supportless curve with inner cavity protection)
  const armItems = useMemo(() => {
    return buildCoatArmsGeometry(layout, wallThickness, cavityWidth, cavityDepth);
  }, [layout, wallThickness, cavityWidth, cavityDepth]);

  // 7. Stethoscope (Active for 'doctor' mode)
  const isDoctor = medicalRole === 'doctor';
  const stethGeoms = useMemo(() => {
    if (!isDoctor) return null;
    return buildStethoscopeGeometry(layout);
  }, [isDoctor, layout]);

  // 8. Back Hospital Text & Separate Nameplate (Sırt Yazısı ve Ayrı İsimlik Plakası)
  const isPlateMode = backTextStyle === 'plate';
  const isEngraveMode = backTextStyle === 'engrave';
  const isEmbossMode = backTextStyle === 'emboss';

  const mappedBackTextY = mapCoatY(backTextElevation);

  // Parse lines once for both plate and text calculations
  const parsedBackLines = useMemo(() => {
    if (!backText || !backText.trim() || !font) return null;
    const normalized = backText.replace(/\//g, '\n');
    const rawLines = normalized
      .trim()
      .toLocaleUpperCase('tr-TR')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!rawLines.length) return null;

    const baseH = Number(backTextHeight) || 6.8;
    const lineSpacing = baseH * 1.35;
    const totalLinesH = (rawLines.length - 1) * lineSpacing;
    const maxAllowedWidth = layout.coatWidth * 0.65;

    let maxLineW = 0;
    const linesData = rawLines.map((lineStr, l) => {
      const chars = Array.from(lineStr);
      const charInfos = chars.map((ch) => {
        if (ch === ' ') return { ch, isSpace: true, width: baseH * 0.36 };
        const sh = font.generateShapes(ch, baseH);
        const sg = new THREE.ShapeGeometry(sh);
        sg.computeBoundingBox();
        const rw = sg.boundingBox.max.x - sg.boundingBox.min.x;
        return { ch, isSpace: false, shapes: sh, width: rw + baseH * 0.12 };
      });
      let lineW = charInfos.reduce((s, c) => s + c.width, 0);
      let fitScale = 1.0;
      if (lineW > maxAllowedWidth) {
        fitScale = maxAllowedWidth / lineW;
        lineW = maxAllowedWidth;
      }
      if (lineW > maxLineW) maxLineW = lineW;
      const lineWorldY = mappedBackTextY + (totalLinesH * 0.5 - l * lineSpacing);
      return { lineStr, charInfos, lineW, fitScale, lineWorldY };
    });

    return { linesData, maxLineW, totalLinesH, baseH };
  }, [backText, font, backTextHeight, mappedBackTextY, layout]);

  // Ayrı İsimlik Plakası (Sıfır AMS atığı için ayrı basılabilen plaka)
  const backPlateGeom = useMemo(() => {
    if (!isPlateMode || !parsedBackLines) return null;
    const plateW = Math.max(44, Math.min(layout.coatWidth * 0.74, parsedBackLines.maxLineW + 10));
    const plateH = Math.max(22, parsedBackLines.totalLinesH + 11);
    return buildCoatBackPlateGeometry(layout, plateW, plateH, 1.6, backTextElevation, wallThickness);
  }, [isPlateMode, parsedBackLines, layout, backTextElevation, wallThickness]);

  // Gömme / Oyma Modu için Harf Şekilleri (Delikler, Adalar ve İç Taban)
  const engravedData = useMemo(() => {
    if (!isEngraveMode || !parsedBackLines || !font) return null;
    const { linesData, totalLinesH, baseH } = parsedBackLines;
    const lineSpacing = baseH * 1.35;

    const holes = [];
    const islands = [];
    const inlays = [];

    linesData.forEach((line, l) => {
      const lineLocalY = totalLinesH * 0.5 - l * lineSpacing;
      let curX = -line.lineW * 0.5;

      for (let i = 0; i < line.charInfos.length; i++) {
        const info = line.charInfos[i];
        const w = info.width * line.fitScale;
        const midX = curX + w * 0.5;
        curX += w;
        if (info.isSpace) continue;

        for (const sh of info.shapes) {
          const sg = new THREE.ShapeGeometry(sh);
          sg.computeBoundingBox();
          const box = sg.boundingBox;
          const cx = (box.min.x + box.max.x) * 0.5;
          const cy = (box.min.y + box.max.y) * 0.5;

          // Harf dış konturu (Plakadan oyulacak delik: Earcut gereği CW / negatif alan olmalı)
          const pts = sh.getPoints();
          const mappedPts = pts.map((pt) => {
            const lx = (pt.x - cx) * line.fitScale;
            const ly = (pt.y - cy) * line.fitScale;
            return new THREE.Vector2(-(midX + lx), lineLocalY + ly);
          });

          // Delik için alan negatif (CW) olmalıdır
          const holeArea = THREE.ShapeUtils.area(mappedPts);
          const finalHolePts = holeArea > 0 ? mappedPts.slice().reverse() : mappedPts.slice();
          const holePath = new THREE.Path(finalHolePts);
          holes.push(holePath);

          // Taban dolgusu için alan pozitif (CCW) olmalıdır
          const finalInlayPts = holeArea < 0 ? mappedPts.slice().reverse() : mappedPts.slice();
          const inlayShape = new THREE.Shape(finalInlayPts);

          // O, B, P, R gibi harflerin iç adaları (Plaka yüzeyinde kalan kısımlar)
          if (sh.holes && sh.holes.length > 0) {
            for (const ih of sh.holes) {
              const ipts = ih.getPoints();
              const mappedIslandPts = ipts.map((pt) => {
                const lx = (pt.x - cx) * line.fitScale;
                const ly = (pt.y - cy) * line.fitScale;
                return new THREE.Vector2(-(midX + lx), lineLocalY + ly);
              });

              // Ada katı poligon olduğu için alanı pozitif (CCW) olmalıdır
              const islandArea = THREE.ShapeUtils.area(mappedIslandPts);
              const finalIslandPts = islandArea < 0 ? mappedIslandPts.slice().reverse() : mappedIslandPts.slice();
              const islandShape = new THREE.Shape(finalIslandPts);
              islands.push(islandShape);

              // İnlay içindeki delik ise CW (negatif) olmalıdır
              const finalInlayHolePts = islandArea > 0 ? mappedIslandPts.slice().reverse() : mappedIslandPts.slice();
              const inlayHole = new THREE.Path(finalInlayHolePts);
              inlayShape.holes.push(inlayHole);
            }
          }
          inlays.push(inlayShape);
        }
      }
    });

    return { holes, islands, inlays };
  }, [isEngraveMode, parsedBackLines, font]);

  // Gömme / Oyma Geometrileri (Oyuk Plaka + İç Yuva Zemin Kontrastı)
  const engravedGeoms = useMemo(() => {
    if (!isEngraveMode || !engravedData || !parsedBackLines) return null;
    const { holes, islands, inlays } = engravedData;
    const plateW = Math.max(44, Math.min(layout.coatWidth * 0.76, parsedBackLines.maxLineW + 12));
    const plateH = Math.max(22, parsedBackLines.totalLinesH + 13);
    const engraveDepth = Math.max(0.8, Number(backTextDepth) || 1.2);

    const plateWithHoles = buildCoatBackPlateGeometry(
      layout,
      plateW,
      plateH,
      engraveDepth,
      backTextElevation,
      wallThickness,
      holes
    );
    const islandsGeom = buildCoatBackIslandsGeometry(
      layout,
      islands,
      engraveDepth,
      backTextElevation,
      wallThickness
    );
    const mergedPlate = islandsGeom
      ? mergeGeometries([plateWithHoles, islandsGeom])
      : plateWithHoles;

    const inlayGeom = buildCoatBackInlaysGeometry(
      layout,
      inlays,
      backTextElevation,
      wallThickness,
      0.3
    );

    return { plateGeom: mergedPlate, inlayGeom };
  }, [isEngraveMode, engravedData, parsedBackLines, layout, backTextDepth, backTextElevation, wallThickness]);

  // Yazı Harfleri Mesh'leri (Plaka Üstü veya Doğrudan Kabartma)
  const backTextMeshes = useMemo(() => {
    if (isEngraveMode || !parsedBackLines) return [];
    const { linesData, baseH } = parsedBackLines;
    const relief = Math.max(0.6, Number(backTextDepth) || 1.0);
    const embed = 0.35;
    const meshes = [];

    linesData.forEach((line, l) => {
      let curX = -line.lineW * 0.5;

      for (let i = 0; i < line.charInfos.length; i++) {
        const info = line.charInfos[i];
        const w = info.width * line.fitScale;
        const midX = curX + w * 0.5;
        curX += w;

        if (info.isSpace) continue;

        const cleanShapes = resampleShapesForCleanExtrusion(
          info.shapes,
          0.45,
          24,
          0.08
        );
        let geom = new THREE.ExtrudeGeometry(cleanShapes, {
          depth: relief + embed,
          bevelEnabled: false,
        });

        if (line.fitScale !== 1.0) {
          geom.scale(line.fitScale, line.fitScale, 1);
        }
        geom.computeBoundingBox();
        const box = geom.boundingBox;
        geom.translate(
          -(box.min.x + box.max.x) * 0.5,
          -(box.min.y + box.max.y) * 0.5,
          0
        );

        geom = subdivideExtrudedGeometry(geom, 1.25);

        const pos = geom.attributes.position;
        for (let j = 0; j < pos.count; j++) {
          const lx = pos.getX(j);
          const ly = pos.getY(j);
          const lz = pos.getZ(j);

          const worldX = -(midX + lx);
          const worldY = line.lineWorldY + ly;
          const surfZ = getExactCoatSurfaceZ(worldX, worldY, false, layout); // negative Z

          let worldZ;
          if (isPlateMode) {
            // Sits elevated on top of the 1.6mm backplate
            worldZ = surfZ + 0.4 - 1.6 + 0.15 - lz * 0.8;
          } else {
            // Classic outward emboss
            worldZ = surfZ + embed - lz;
          }

          pos.setX(j, worldX);
          pos.setY(j, worldY);
          pos.setZ(j, worldZ);
        }
        pos.needsUpdate = true;
        geom.computeVertexNormals();

        meshes.push({ geom, char: info.ch, lineIdx: l });
      }
    });

    return meshes;
  }, [parsedBackLines, isPlateMode, isEngraveMode, backTextDepth, layout]);

  // 9. Front Name / Title Text (on chest or above pocket)
  const mappedFrontTextY = mapCoatY(frontTextElevation);
  const frontTextMeshes = useMemo(() => {
    if (!frontText || !frontText.trim() || !font) return [];

    const textStr = frontText.trim().toLocaleUpperCase('tr-TR');
    const baseH = Number(frontTextHeight) || 4.8;
    const relief = Math.max(0.6, Number(frontTextDepth) || 0.8);
    const embed = 0.3;

    // Centered horizontally on the responsive chest pocket
    const { chestX: pocketCenterX, chestW } = getChestPocketLayout(layout);

    const chars = Array.from(textStr);
    const charInfos = chars.map((ch) => {
      if (ch === ' ') return { ch, isSpace: true, width: baseH * 0.36 };
      const sh = font.generateShapes(ch, baseH);
      const sg = new THREE.ShapeGeometry(sh);
      sg.computeBoundingBox();
      const rw = sg.boundingBox.max.x - sg.boundingBox.min.x;
      return { ch, isSpace: false, shapes: sh, width: rw + baseH * 0.12 };
    });

    let totalW = charInfos.reduce((s, c) => s + c.width, 0);
    const maxW = Math.max(10.2, chestW - 1.0);
    let fitScale = 1.0;
    if (totalW > maxW) {
      fitScale = maxW / totalW;
      totalW = maxW;
    }

    let curX = pocketCenterX - totalW * 0.5;
    const meshes = [];

    for (let i = 0; i < charInfos.length; i++) {
      const info = charInfos[i];
      const w = info.width * fitScale;
      const midX = curX + w * 0.5;
      curX += w;

      if (info.isSpace) continue;

      const cleanShapes = resampleShapesForCleanExtrusion(
        info.shapes,
        0.42,
        24,
        0.08
      );
      let geom = new THREE.ExtrudeGeometry(cleanShapes, {
        depth: relief + embed,
        bevelEnabled: false,
      });
      if (fitScale !== 1.0) {
        geom.scale(fitScale, fitScale, 1);
      }
      geom.computeBoundingBox();
      const box = geom.boundingBox;
      geom.translate(
        -(box.min.x + box.max.x) * 0.5,
        -(box.min.y + box.max.y) * 0.5,
        0
      );
      geom = subdivideExtrudedGeometry(geom, 1.25);

      const pos = geom.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const lx = pos.getX(j);
        const ly = pos.getY(j);
        const lz = pos.getZ(j);

        const wx = midX + lx;
        const wy = mappedFrontTextY + ly;
        const surfZ = getExactCoatSurfaceZ(wx, wy, true, layout);
        const wz = surfZ - embed + lz + 1.25; // Sits nicely on front of pocket

        pos.setX(j, wx);
        pos.setY(j, wy);
        pos.setZ(j, wz);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();

      meshes.push({ geom, char: info.ch });
    }

    return meshes;
  }, [frontText, font, frontTextHeight, frontTextDepth, mappedFrontTextY, layout]);

  return (
    <group ref={groupRef} dispose={null}>
      {/* ── Taban Plakası ── */}
      <mesh name="Taban_Plakasi" geometry={baseGeom} castShadow receiveShadow>
        <meshStandardMaterial color={baseColor} roughness={0.35} metalness={0.08} />
      </mesh>

      {/* ── Ana Önlük Gövdesi (Outer Shell + Inner Pencil Cavity) ── */}
      <mesh name="Onluk_Govdesi" geometry={coatBodyGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={coatColor}
          roughness={0.42}
          metalness={0.04}
        />
      </mesh>

      {/* ── Yaka İçi Gömlek / Kapama Paneli (Dekolte Önleyici Klinik İçlik) ── */}
      <mesh
        name="Ic_Gomlek_Yakasi"
        geometry={innerShirtGeom}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={innerShirtColor || coatColor}
          roughness={0.4}
          metalness={0.04}
        />
      </mesh>

      {/* ── Notched Lapel / Çentikli Ceket Yaka ── */}
      {lapelGeoms.map((g, idx) => (
        <mesh
          key={idx}
          name={`Onluk_Yaka_${idx + 1}`}
          geometry={g}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={collarColor || coatColor}
            roughness={0.38}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* ── Ön Düğmeler (4 Adet Dikey Dikişli Düğme) ── */}
      {hasButtons && buttonGeoms.map((bg, idx) => (
        <mesh
          key={idx}
          name={`Onluk_Dugme_${idx + 1}`}
          geometry={bg}
          castShadow
        >
          <meshStandardMaterial
            color={buttonColor}
            roughness={0.28}
            metalness={0.15}
          />
        </mesh>
      ))}

      {/* ── Cepler (Göğüs Cebi + İki Alt Yan Cep) ── */}
      {pocketItems.map((item, idx) => (
        <mesh
          key={idx}
          name={item.name}
          geometry={item.geom}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={coatColor}
            roughness={0.38}
            metalness={0.04}
          />
        </mesh>
      ))}

      {/* ── Kollar (Eller Ceplerde Duruşu) ── */}
      {armItems.map((item, idx) => (
        <mesh
          key={idx}
          name={item.name}
          geometry={item.geom}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={coatColor}
            roughness={0.42}
            metalness={0.04}
          />
        </mesh>
      ))}

      {/* ── Doktor Steteskobu (Aktifse) ── */}
      {isDoctor && stethGeoms && (
        <group name="Doktor_Steteskop">
          <mesh name="Steteskop_Sol_Hortum" geometry={stethGeoms.tubeLeft} castShadow>
            <meshStandardMaterial
              color={stethoscopeColor}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
          <mesh name="Steteskop_Sag_Hortum" geometry={stethGeoms.tubeRight} castShadow>
            <meshStandardMaterial
              color={stethoscopeColor}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
          <mesh name="Steteskop_Alt_Hortum" geometry={stethGeoms.tubeLower} castShadow>
            <meshStandardMaterial
              color={stethoscopeColor}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
          <mesh name="Steteskop_Zil_Diski" geometry={stethGeoms.discGeom} castShadow>
            <meshStandardMaterial
              color="#CBD5E1"
              roughness={0.18}
              metalness={0.85}
            />
          </mesh>
        </group>
      )}

      {/* ── Sırt Hastane Yazısı (Plaka / Gömme / Kabartma) ── */}
      {isPlateMode && backPlateGeom && (
        <mesh name="Sirt_Plakasi" geometry={backPlateGeom} castShadow receiveShadow>
          <meshStandardMaterial
            color={plateColor || '#FFFFFF'}
            roughness={0.35}
            metalness={0.05}
          />
        </mesh>
      )}

      {/* Gerçek Fiziksel Gömme / Oyma Modu (Oyuk Plaka + İç Zemin Kontrastı) */}
      {isEngraveMode && engravedGeoms && (
        <group name="Sirt_Gomme_Yazisi">
          <mesh
            name="Sirt_Gomme_Plakasi"
            geometry={engravedGeoms.plateGeom}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={coatColor}
              roughness={0.38}
              metalness={0.04}
            />
          </mesh>
          {engravedGeoms.inlayGeom && (
            <mesh
              name="Sirt_Gomme_Harf_Tabani"
              geometry={engravedGeoms.inlayGeom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor || '#1E293B'}
                roughness={0.32}
                metalness={0.05}
              />
            </mesh>
          )}
        </group>
      )}

      {!isEngraveMode && backTextMeshes.length > 0 && (
        <group
          name={isPlateMode ? 'Sirt_Plaka_Yazisi' : 'Arka_Hastane_Yazisi'}
        >
          {backTextMeshes.map((item, idx) => (
            <mesh
              key={idx}
              name={isPlateMode ? `Plaka_Harf_${idx + 1}` : `Arka_Yazi_Harf_${idx + 1}`}
              geometry={item.geom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor}
                roughness={0.28}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ── Ön Göğüs Cebi Üzeri İsimlik (TIBBİ SEKRETER / DR. ...) ── */}
      {frontTextMeshes.length > 0 && (
        <group name="On_Isimlik_Yazisi">
          {frontTextMeshes.map((item, idx) => (
            <mesh
              key={idx}
              name={`On_Isimlik_Harf_${idx + 1}`}
              geometry={item.geom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor}
                roughness={0.28}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

export default MedicalPencilCase;
