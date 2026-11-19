import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { ensureTurkishFontGlyphs } from '../../utils/fontUtils';
import {
  getJerseyKitLayout,
  getExactTorsoSurfaceZ,
  getExactShortsSurfaceZ,
  buildTorsoAndCollarMeshes,
  buildSetInSleeveAndCuff,
  buildSculptedShortsMeshes,
} from '../../utils/jerseyGarmentBuilder';
import {
  buildConformedPumaLogo,
  buildConformedGalatasarayCrest,
  subdivideExtrudedGeometry,
  resampleShapesForCleanExtrusion,
} from '../../utils/jerseyVectorAssets';

export const TEAM_PRESETS = {
  sari_kirmizi: {
    id: 'sari_kirmizi',
    name: 'Sarı Kırmızı',
    pattern: 'parcali',
    primaryColor: '#82001C', // Parçalı Koyu Kırmızı
    secondaryColor: '#F37021', // Parçalı Sıcak Sarı/Turuncu
    accentColor: '#1A1A1A',
    shortsColor: '#FFFFFF',
    textColor: '#FFFFFF',
    defaultFrontText: 'ŞAMPİYON',
    defaultFrontNumber: '10',
    defaultBackName: 'TARAFTAR',
    defaultBackNumber: '10',
    badgeText: 'SK',
    stars: 5,
  },
  sari_lacivert: {
    id: 'sari_lacivert',
    name: 'Sarı Lacivert',
    pattern: 'cubuklu',
    primaryColor: '#002D72',
    secondaryColor: '#FFED00',
    accentColor: '#FFFFFF',
    shortsColor: '#FFFFFF',
    textColor: '#FFFFFF',
    defaultFrontText: 'EFSANE',
    defaultFrontNumber: '10',
    defaultBackName: 'KAPTAN',
    defaultBackNumber: '10',
    badgeText: 'SL',
    stars: 3,
  },
  siyah_beyaz: {
    id: 'siyah_beyaz',
    name: 'Siyah Beyaz',
    pattern: 'solid',
    primaryColor: '#1A1A1A',
    secondaryColor: '#E5E5E5',
    accentColor: '#E30613',
    shortsColor: '#1A1A1A',
    textColor: '#FFFFFF',
    defaultFrontText: 'KARA KARTAL',
    defaultFrontNumber: '9',
    defaultBackName: 'FORMA',
    defaultBackNumber: '9',
    badgeText: 'SB',
    stars: 3,
  },
  bordo_mavi: {
    id: 'bordo_mavi',
    name: 'Bordo Mavi',
    pattern: 'cubuklu',
    primaryColor: '#7A0026',
    secondaryColor: '#00A3E0',
    accentColor: '#FFFFFF',
    shortsColor: '#7A0026',
    textColor: '#FFFFFF',
    defaultFrontText: 'FIRTINA',
    defaultFrontNumber: '1',
    defaultBackName: 'TARAFTAR',
    defaultBackNumber: '1',
    badgeText: 'BM',
    stars: 1,
  },
  kirmizi_beyaz: {
    id: 'kirmizi_beyaz',
    name: 'Kırmızı Beyaz',
    pattern: 'solid',
    primaryColor: '#E30A17',
    secondaryColor: '#FFFFFF',
    accentColor: '#FFFFFF',
    shortsColor: '#FFFFFF',
    textColor: '#FFFFFF',
    defaultFrontText: 'MİLLİ TAKIM',
    defaultFrontNumber: '10',
    defaultBackName: 'YILDIZ',
    defaultBackNumber: '10',
    badgeText: 'TR',
    stars: 0,
  },
  custom: {
    id: 'custom',
    name: 'Özel Tasarım',
    pattern: 'parcali',
    primaryColor: '#82001C',
    secondaryColor: '#F37021',
    accentColor: '#1A1A1A',
    shortsColor: '#FFFFFF',
    textColor: '#FFFFFF',
    defaultFrontText: 'ÖZEL FORMA',
    defaultFrontNumber: '10',
    defaultBackName: 'İSİM',
    defaultBackNumber: '10',
    badgeText: '★',
    stars: 0,
  },
};

// Geriye dönük uyumluluk aliasları (gizli/non-enumerable - buton listesinde yinelenmez)
['galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor', 'turkiye'].forEach((oldKey, idx) => {
  const newKey = ['sari_kirmizi', 'sari_lacivert', 'siyah_beyaz', 'bordo_mavi', 'kirmizi_beyaz'][idx];
  Object.defineProperty(TEAM_PRESETS, oldKey, {
    value: TEAM_PRESETS[newKey],
    enumerable: false,
    configurable: true,
  });
});

/**
 * Creates a cap-height dotted 'İ' shape (where the stem + dot sit cleanly within [0, charH])
 * so multi-line chest sponsors like "PASİFİK / HOLDİNG" align into tight, crisp blocks
 * just like the official jersey sponsor print.
 */
function createCapHeightDottedIShapes(charH, strokeW) {
  const hw = strokeW * 0.5;
  const stemTop = charH * 0.72;
  const dotBot = charH * 0.81;
  const dotTop = charH * 1.0;

  const stem = new THREE.Shape();
  stem.moveTo(-hw, 0);
  stem.lineTo(hw, 0);
  stem.lineTo(hw, stemTop);
  stem.lineTo(-hw, stemTop);
  stem.closePath();

  const dot = new THREE.Shape();
  dot.moveTo(-hw, dotBot);
  dot.lineTo(hw, dotBot);
  dot.lineTo(hw, dotTop);
  dot.lineTo(-hw, dotTop);
  dot.closePath();

  return [stem, dot];
}

const JerseyPencilCase = ({
  // Boyutlar
  torsoWidth = 76,
  torsoDepth = 46,
  height = 118,
  wallThickness = 3.4,
  bottomThickness = 3.5,
  cornerRadius = 12,

  // Alt Tabla (Taban Plakası) ve Yükselti Ayarları
  baseShape = 'rectangle',
  baseWidth = 64,
  baseDepth = 40,
  baseThickness = 3.5,
  baseCornerRadius = 14,
  baseColor = '#18181B',
  modelElevation = 0,

  // Şort (Alt Kısım) Ayarları
  hasShorts = true,
  shortsColor = '#FFFFFF',
  hasShortsNumber = true,

  // Renk ve Desen
  teamPreset = 'sari_kirmizi',
  pattern = 'parcali',
  primaryColor = '#82001C',
  secondaryColor = '#F37021',
  accentColor = '#1A1A1A',
  textColor = '#FFFFFF',

  // Ön Detaylar (Göğüs)
  frontText = 'ŞAMPİYON',
  frontTextHeight = 7.2,
  frontTextDepth = 0.8,
  frontTextElevation = 55,

  hasFrontNumber = false,
  frontNumber = '10',
  frontNumberHeight = 13,

  // Arma & Yıldızlar
  hasBadge = true,
  badgeText = 'SK',
  badgeStars = 5,
  badgeElevation = 85,

  // Arka Detaylar (Sırt)
  backName = 'TARAFTAR',
  backNameHeight = 7.8,
  backNameDepth = 0.8,
  backNameElevation = 94,
  backNameArched = false,

  backNumber = '10',
  backNumberHeight = 36,
  backNumberDepth = 1.0,
  backNumberElevation = 63,

  // Font & Stil
  fontName = 'DINMittelschriftStd.json',
  hasDivider = false,

  groupRef,
}) => {
  // Load athletic font (for back name/number) and bold geometric font (for chest sponsor)
  const fontPath = `/fonts/${fontName || 'DINMittelschriftStd.json'}`;
  const rawMainFont = useLoader(FontLoader, fontPath);
  const rawSponsorFont = useLoader(
    FontLoader,
    '/fonts/helvetiker_bold.typeface.json'
  );

  const font = useMemo(() => {
    if (!rawMainFont) return null;
    return ensureTurkishFontGlyphs(rawMainFont);
  }, [rawMainFont]);

  const sponsorFont = useMemo(() => {
    if (!rawSponsorFont) return font;
    return ensureTurkishFontGlyphs(rawSponsorFont);
  }, [rawSponsorFont, font]);

  const effectiveBaseThickness = Math.max(
    2.0,
    Number(baseThickness) || Number(bottomThickness) || 3.5
  );

  // 1. Vertical Layout (Jersey + Optional Sculpted Shorts + Optional Elevation Riser)
  const layout = useMemo(() => {
    return getJerseyKitLayout({
      height: hasShorts ? Math.max(118, Number(height) || 118) : Number(height) || 115,
      baseThickness: effectiveBaseThickness,
      hasShorts,
      modelElevation,
    });
  }, [height, effectiveBaseThickness, hasShorts, modelElevation]);

  // Helper to map elevation slider values (calibrated on [4..115]) onto the active jersey torso span
  const mapJerseyY = (sliderY) => {
    const t = Math.max(0.05, Math.min(0.95, (Number(sliderY) - 4.0) / 111.0));
    return layout.jerseyBottomY + t * layout.jerseySpan;
  };

  // 2. Base Plate + Riser Pedestal (Dikdörtgen / Kare / Yuvarlak / Elips)
  const baseGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const rawW = Math.max(52, Number(baseWidth) || 64);
    const rawD = Math.max(34, Number(baseDepth) || 40);
    const isSquareOrCircle = baseShape === 'square' || baseShape === 'circle';
    const bw = isSquareOrCircle ? Math.max(rawW, rawD) : rawW;
    const bd = isSquareOrCircle ? Math.max(rawW, rawD) : rawD;
    const totalBaseHeight = layout.baseH;
    const bevel = Math.min(0.7, effectiveBaseThickness * 0.2);
    const hw = bw / 2 - bevel;
    const hd = bd / 2 - bevel;

    if (baseShape === 'circle') {
      shape.absarc(0, 0, hw, 0, Math.PI * 2, false);
    } else if (baseShape === 'ellipse') {
      shape.absellipse(0, 0, hw, hd, 0, Math.PI * 2, false, 0);
    } else {
      const defaultR = baseShape === 'square' ? 8 : 12;
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
      depth: Math.max(0.4, totalBaseHeight - 2 * bevel),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 64,
    });
    geom.translate(0, 0, bevel);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, [baseShape, baseWidth, baseDepth, effectiveBaseThickness, baseCornerRadius, layout.baseH]);

  // 3. Sculpted Torso Panels & Counter-Colored Crew Collar
  const {
    orangeTorsoGeom,
    redTorsoGeom,
    orangeCollarGeom,
    redCollarGeom,
  } = useMemo(() => {
    return buildTorsoAndCollarMeshes(layout, wallThickness);
  }, [layout, wallThickness]);

  // 4. Tailored Set-In Sleeves & Ribbed Cuffs (Left & Right)
  const { sleeveGeom: leftSleeveGeom, cuffGeom: leftCuffGeom } = useMemo(() => {
    return buildSetInSleeveAndCuff(-1, layout);
  }, [layout]);

  const { sleeveGeom: rightSleeveGeom, cuffGeom: rightCuffGeom } = useMemo(() => {
    return buildSetInSleeveAndCuff(1, layout);
  }, [layout]);

  // 5. Sculpted Football Shorts (Şort) Underneath the Jersey
  const shortsMeshes = useMemo(() => {
    if (!hasShorts) return null;
    return buildSculptedShortsMeshes(layout, wallThickness);
  }, [hasShorts, layout, wallThickness]);

  // 6. Optional Internal Pen Divider
  const dividerGeom = useMemo(() => {
    if (!hasDivider) return null;
    const h = layout.totalH - layout.baseH - 16;
    const geom = new THREE.BoxGeometry(2.2, h, 24);
    geom.translate(0, layout.baseH + h / 2, 0);
    return geom;
  }, [hasDivider, layout.totalH, layout.baseH]);

  // 7. Authentic Leaping Puma Cat on Right Chest (Viewer's Left, X < 0)
  const mappedBadgeY = mapJerseyY(badgeElevation);
  const pumaGeom = useMemo(() => {
    const pumaX = -15.4;
    const pumaY = mappedBadgeY - 3.6;
    return buildConformedPumaLogo(
      pumaX,
      pumaY,
      (wx, wy) => getExactTorsoSurfaceZ(wx, wy, true, layout),
      0.86,
      1.35
    );
  }, [mappedBadgeY, layout]);

  // 8. Authentic 5-Star Galatasaray Crest on Left Chest (Viewer's Right, X > 0)
  // Positioned with generous clearance below the collar so the 5 stars never touch the collar!
  const isGalatasaray =
    teamPreset === 'galatasaray' ||
    (badgeText && badgeText.trim().toUpperCase() === 'GS');

  const crestData = useMemo(() => {
    if (!hasBadge) return null;
    const crestX = 14.6;
    const crestY = mappedBadgeY - 8.2;
    return buildConformedGalatasarayCrest(
      crestX,
      crestY,
      (wx, wy) => getExactTorsoSurfaceZ(wx, wy, true, layout),
      badgeStars,
      0.78
    );
  }, [hasBadge, mappedBadgeY, badgeStars, layout]);

  // 9. Front Sponsor Text ("PASİFİK HOLDİNG" or user custom text like "FANATİK ENDER")
  // Wide geometric sans-serif letters, 100% upright in XY, vertex-conformed to exact chest surface & cloth folds!
  const mappedFrontTextY = mapJerseyY(Math.max(22, Number(frontTextElevation) - 12.5));
  const frontTextMeshes = useMemo(() => {
    const activeFont = sponsorFont || font;
    if (!frontText || !frontText.trim() || !activeFont) return [];

    const normalized = frontText.replace(/\//g, '\n');
    const rawLines = normalized
      .trim()
      .toLocaleUpperCase('tr-TR')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!rawLines.length) return [];

    const baseH = Number(frontTextHeight) || (rawLines.length > 1 ? 6.6 : 8.0);
    const widthStretch = 1.24; // Wide corporate/athletic sponsor letter proportion (matches reference PASiFiK HOLDiNG)
    const relief = 1.32;
    const embed = 0.22;
    const lineSpacing = baseH * 1.22;
    const maxAllowedWidth = 46.5; // Spans cleanly across the chest without spilling into armholes

    const meshes = [];

    for (let l = 0; l < rawLines.length; l++) {
      const lineStr = rawLines[l];
      const lineWorldY =
        mappedFrontTextY +
        (rawLines.length - 1) * (lineSpacing * 0.5) -
        l * lineSpacing;
      const chars = Array.from(lineStr);

      let charH = baseH;
      const charInfos = chars.map((ch) => {
        if (ch === ' ') {
          return { ch, isSpace: true, width: charH * 0.42 };
        }
        if (ch === 'İ') {
          const strokeW = charH * 0.24 * widthStretch;
          const shapes = createCapHeightDottedIShapes(charH, strokeW);
          return {
            ch,
            isSpace: false,
            shapes,
            rawW: strokeW,
            minX: -strokeW * 0.5,
            minY: 0,
            maxY: charH,
            width: strokeW + charH * 0.16 * widthStretch,
          };
        }
        const shapes = activeFont.generateShapes(ch, charH);
        const sg = new THREE.ShapeGeometry(shapes);
        sg.computeBoundingBox();
        const box = sg.boundingBox;
        const rawW = (box.max.x - box.min.x) * widthStretch;
        return {
          ch,
          isSpace: false,
          shapes,
          rawW,
          minX: box.min.x * widthStretch,
          minY: box.min.y,
          maxY: box.max.y,
          width: rawW + charH * 0.15 * widthStretch,
        };
      });

      let totalLineW = charInfos.reduce((s, c) => s + c.width, 0);
      let fitScale = 1.0;
      if (totalLineW > maxAllowedWidth) {
        fitScale = maxAllowedWidth / totalLineW;
        totalLineW = maxAllowedWidth;
      }

      let curX = -totalLineW * 0.5;
      for (let i = 0; i < charInfos.length; i++) {
        const info = charInfos[i];
        const w = info.width * fitScale;
        const midX = curX + w * 0.5;
        curX += w;

        if (info.isSpace) continue;

        const cleanShapes = resampleShapesForCleanExtrusion(
          info.shapes,
          0.55,
          28,
          info.ch === 'İ' ? 0.05 : 0.10
        );
        let geom = new THREE.ExtrudeGeometry(cleanShapes, {
          depth: relief + embed,
          bevelEnabled: false,
        });

        // Apply wide sponsor horizontal stretch + fitScale
        geom.scale(
          info.ch === 'İ' ? fitScale : widthStretch * fitScale,
          fitScale,
          1
        );
        geom.computeBoundingBox();
        const box = geom.boundingBox;
        const cx = (box.min.x + box.max.x) * 0.5;
        const cy = (box.min.y + box.max.y) * 0.5;
        geom.translate(-cx, -cy, 0);

        geom = subdivideExtrudedGeometry(geom, 1.35);

        const pos = geom.attributes.position;
        for (let j = 0; j < pos.count; j++) {
          const wx = midX + pos.getX(j);
          const wy = lineWorldY + pos.getY(j);
          const lz = pos.getZ(j);
          const surfZ = getExactTorsoSurfaceZ(wx, wy, true, layout);
          pos.setX(j, wx);
          pos.setY(j, wy);
          pos.setZ(j, lz + surfZ - embed);
        }
        pos.needsUpdate = true;
        geom.computeVertexNormals();

        meshes.push({ geom, lineIdx: l });
      }
    }

    return meshes;
  }, [
    frontText,
    sponsorFont,
    font,
    frontTextHeight,
    mappedFrontTextY,
    layout,
  ]);

  // 10. Back Player Name ("OSIMHEN") - Straight horizontal across upper back (or arched if toggled)
  const mappedBackNameY = mapJerseyY(backNameElevation);
  const backNameMeshes = useMemo(() => {
    if (!backName || !backName.trim() || !font) return [];
    const cleanName = backName.trim().toLocaleUpperCase('tr-TR');
    let fontSize = Math.min(10.5, Number(backNameHeight) || 7.8);
    const relief = 1.35;
    const embed = 0.22;

    const chars = Array.from(cleanName);
    const charInfos = chars.map((ch) => {
      if (ch === ' ') return { ch, isSpace: true, width: fontSize * 0.38 };
      const sh = font.generateShapes(ch, fontSize);
      const sg = new THREE.ShapeGeometry(sh);
      sg.computeBoundingBox();
      const rawW = sg.boundingBox.max.x - sg.boundingBox.min.x;
      return {
        ch,
        isSpace: false,
        shapes: sh,
        width: rawW + fontSize * 0.16,
      };
    });

    let totalW = charInfos.reduce((s, c) => s + c.width, 0);
    const maxW = 43.0;
    let fitScale = 1.0;
    if (totalW > maxW) {
      fitScale = maxW / totalW;
      totalW = maxW;
    }

    let curX = -totalW * 0.5;
    const meshes = [];

    for (let i = 0; i < charInfos.length; i++) {
      const info = charInfos[i];
      const w = info.width * fitScale;
      const midX = curX + w * 0.5;
      curX += w;

      if (info.isSpace) continue;

      const cleanShapes = resampleShapesForCleanExtrusion(
        info.shapes,
        0.55,
        28,
        0.10
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
      const cx = (box.min.x + box.max.x) * 0.5;
      const cy = (box.min.y + box.max.y) * 0.5;
      geom.translate(-cx, -cy, 0);

      if (backNameArched) {
        const arcR = 56;
        const ang = midX / arcR;
        geom.rotateZ(-ang);
      }

      geom = subdivideExtrudedGeometry(geom, 1.35);

      const arcOffsetY = backNameArched
        ? Math.cos(midX / 56) * 56 - 56
        : 0;

      // Transform directly into Back World Coordinates (viewing from -Z: left-to-right means +X to -X)
      const pos = geom.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const lx = pos.getX(j);
        const ly = pos.getY(j);
        const lz = pos.getZ(j);

        const worldX = -(midX + lx);
        const worldY = mappedBackNameY + arcOffsetY + ly;
        const surfZ = getExactTorsoSurfaceZ(worldX, worldY, false, layout); // negative Z
        const worldZ = surfZ + embed - lz;

        pos.setX(j, worldX);
        pos.setY(j, worldY);
        pos.setZ(j, worldZ);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();

      meshes.push({ geom });
    }

    return meshes;
  }, [backName, font, backNameHeight, mappedBackNameY, backNameArched, layout]);

  // 11. Huge Back Number ("45") - Burr-free resampled contour conformed to exact back surface
  const mappedBackNumY = mapJerseyY(
    Math.max(56, Number(backNumberElevation) - 4 || 59)
  );
  const backNumMeshes = useMemo(() => {
    if (!backNumber || !backNumber.trim() || !font) return [];
    const cleanNum = backNumber.trim();
    const rawH = Math.min(48, Number(backNumberHeight) || 38);
    const numSize = rawH * (layout.jerseySpan / 88);
    const widthStretch = 1.12;
    const relief = 1.40;
    const embed = 0.25;

    const chars = Array.from(cleanNum);
    const charInfos = chars.map((ch) => {
      const sh = font.generateShapes(ch, numSize);
      const sg = new THREE.ShapeGeometry(sh);
      sg.computeBoundingBox();
      const rawW = (sg.boundingBox.max.x - sg.boundingBox.min.x) * widthStretch;
      return {
        ch,
        shapes: sh,
        width: rawW + numSize * 0.11,
      };
    });

    const totalW = charInfos.reduce((s, c) => s + c.width, 0);
    let curX = -totalW * 0.5;
    const meshes = [];

    for (let i = 0; i < charInfos.length; i++) {
      const info = charInfos[i];
      const midX = curX + info.width * 0.5;
      curX += info.width;

      const cleanShapes = resampleShapesForCleanExtrusion(info.shapes, 0.60, 48);
      let geom = new THREE.ExtrudeGeometry(cleanShapes, {
        depth: relief + embed,
        bevelEnabled: false,
      });
      geom.scale(widthStretch, 1, 1);
      geom.computeBoundingBox();
      const box = geom.boundingBox;
      const cx = (box.min.x + box.max.x) * 0.5;
      const cy = (box.min.y + box.max.y) * 0.5;
      geom.translate(-cx, -cy, 0);

      geom = subdivideExtrudedGeometry(geom, 1.45);

      const pos = geom.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const lx = pos.getX(j);
        const ly = pos.getY(j);
        const lz = pos.getZ(j);

        const worldX = -(midX + lx);
        const worldY = mappedBackNumY + ly;
        const surfZ = getExactTorsoSurfaceZ(worldX, worldY, false, layout);
        const worldZ = surfZ + embed - lz;

        pos.setX(j, worldX);
        pos.setY(j, worldY);
        pos.setZ(j, worldZ);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();

      meshes.push({ geom, char: info.ch });
    }

    return meshes;
  }, [backNumber, font, backNumberHeight, mappedBackNumY, layout]);

  // 12. Shorts Thigh Number ("45" on Right Thigh) & Mini Puma Cat (on Left Thigh)
  const shortsDecorMeshes = useMemo(() => {
    if (!hasShorts || !layout.hasShorts) return null;
    const shortsMidY =
      layout.shortsBottomY +
      (layout.shortsTopY - layout.shortsBottomY) * 0.44;

    // Mini Puma Cat on Left Thigh (Viewer's Right, X > 0)
    const miniPumaGeom = buildConformedPumaLogo(
      14.5,
      shortsMidY,
      (wx, wy) => getExactShortsSurfaceZ(wx, wy, true, layout),
      0.62,
      1.55
    );

    // Player Number on Right Thigh (Viewer's Left, X < 0)
    // Sized and stroke-dilated (>= 1.55mm stroke width, 1.65mm relief + 0.65mm embed)
    // so 0.4mm nozzles in Bambu Studio / OrcaSlicer slice 3-4 solid walls without ever dropping the red number!
    const numGeoms = [];
    if (hasShortsNumber && backNumber && backNumber.trim() && font) {
      const cleanNum = backNumber.trim();
      const numH = 11.2;
      const relief = 1.65;
      const embed = 0.65;
      const chars = Array.from(cleanNum);
      const infos = chars.map((ch) => {
        const sh = font.generateShapes(ch, numH);
        const sg = new THREE.ShapeGeometry(sh);
        sg.computeBoundingBox();
        const rw = sg.boundingBox.max.x - sg.boundingBox.min.x;
        return { ch, shapes: sh, width: rw + numH * 0.14 };
      });
      const totalW = infos.reduce((s, c) => s + c.width, 0);
      let curX = -14.5 - totalW * 0.5;

      for (const info of infos) {
        const midX = curX + info.width * 0.5;
        curX += info.width;
        const cleanShapes = resampleShapesForCleanExtrusion(
          info.shapes,
          0.45,
          24,
          0.16
        );
        let g = new THREE.ExtrudeGeometry(cleanShapes, {
          depth: relief + embed,
          bevelEnabled: false,
        });
        g.computeBoundingBox();
        const box = g.boundingBox;
        g.translate(
          -(box.min.x + box.max.x) * 0.5,
          -(box.min.y + box.max.y) * 0.5,
          0
        );
        g = subdivideExtrudedGeometry(g, 1.25);

        const pos = g.attributes.position;
        for (let j = 0; j < pos.count; j++) {
          const wx = midX + pos.getX(j);
          const wy = shortsMidY + pos.getY(j);
          const lz = pos.getZ(j);
          const surfZ = getExactShortsSurfaceZ(wx, wy, true, layout);
          pos.setX(j, wx);
          pos.setY(j, wy);
          pos.setZ(j, lz + surfZ - embed);
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
        numGeoms.push(g);
      }
    }

    return { miniPumaGeom, numGeoms };
  }, [hasShorts, hasShortsNumber, backNumber, font, layout]);

  // Authentic Galatasaray Parçalı Color Assignment
  const isParcali = pattern === 'parcali';
  const orangeColor = isParcali ? secondaryColor : primaryColor;
  const darkRedColor = primaryColor;

  // Contrast color for shorts numbers/logos (if shorts are white/light, use Dark Red; if shorts are dark, use White/Gold)
  const isLightShorts =
    shortsColor &&
    (shortsColor.toUpperCase() === '#FFFFFF' ||
      shortsColor.toUpperCase() === '#F4F4F6' ||
      shortsColor.toUpperCase() === '#F8FAFC' ||
      shortsColor.toUpperCase() === '#E5E5E5');
  const shortsDetailColor = isLightShorts ? darkRedColor : '#FFFFFF';

  return (
    <group ref={groupRef} dispose={null}>
      {/* ── Taban Plakası ── */}
      <mesh name="Taban_Plakasi" geometry={baseGeom} castShadow receiveShadow>
        <meshStandardMaterial color={baseColor} roughness={0.35} metalness={0.08} />
      </mesh>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── ALT KISIM: FUTBOL ŞORTU (Aktifse) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {hasShorts && shortsMeshes && (
        <group name="Futbol_Sortu_Grubu">
          <mesh
            name="Sort_Govde"
            geometry={shortsMeshes.shortsBodyGeom}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={isLightShorts ? '#FFFFFF' : shortsColor || '#FFFFFF'}
              roughness={0.42}
              metalness={0.04}
            />
          </mesh>
          <mesh
            name="Sort_Sol_Serit"
            geometry={shortsMeshes.leftStripeGeom}
            castShadow
          >
            <meshStandardMaterial
              color={darkRedColor}
              roughness={0.38}
              metalness={0.05}
            />
          </mesh>
          <mesh
            name="Sort_Sag_Serit"
            geometry={shortsMeshes.rightStripeGeom}
            castShadow
          >
            <meshStandardMaterial
              color={orangeColor}
              roughness={0.38}
              metalness={0.05}
            />
          </mesh>

          {/* Şort Sol Paça Mini Puma Logosu */}
          {shortsDecorMeshes?.miniPumaGeom && (
            <mesh
              name="Sort_Logo"
              geometry={shortsDecorMeshes.miniPumaGeom}
              castShadow
            >
              <meshStandardMaterial
                color={isLightShorts ? orangeColor : '#FFFFFF'}
                roughness={0.28}
                metalness={0.08}
              />
            </mesh>
          )}

          {/* Şort Sağ Paça Numarası (45) */}
          {shortsDecorMeshes?.numGeoms?.map((ng, idx) => (
            <mesh
              key={idx}
              name={`Sort_Numara_${idx + 1}`}
              geometry={ng}
              castShadow
            >
              <meshStandardMaterial
                color={shortsDetailColor}
                roughness={0.28}
                metalness={0.08}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── FORMA GÖVDESİ (Ön Parçalı + Arka Orijinal Parçalı Blok) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {/* Turuncu Gövde Bölgesi (Ön Sol + Arka Sağ Alt Parçalı Blok) */}
      <mesh name="Sol_Govde" geometry={orangeTorsoGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={orangeColor}
          roughness={0.38}
          metalness={0.04}
        />
      </mesh>

      {/* Bordo/Kırmızı Gövde Bölgesi (Ön Sağ + Arka Ana Gövde) */}
      <mesh name="Sag_Govde" geometry={redTorsoGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={darkRedColor}
          roughness={0.38}
          metalness={0.04}
        />
      </mesh>

      {/* ── İç Bölme (Opsiyonel Ayraç) ── */}
      {dividerGeom && (
        <mesh name="Ic_Bolme_Ayrac" geometry={dividerGeom} castShadow receiveShadow>
          <meshStandardMaterial color="#18181B" roughness={0.45} />
        </mesh>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── SET-IN KOLLAR & MANŞETLER (Yekpare Omuz Dikişli) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {/* İzleyiciye göre Sol Kol (Bordo Kol + Turuncu Manşet) */}
      <mesh name="Sol_Kol" geometry={leftSleeveGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={darkRedColor}
          roughness={0.38}
          metalness={0.04}
        />
      </mesh>
      <mesh name="Sol_Manset" geometry={leftCuffGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={orangeColor}
          roughness={0.35}
          metalness={0.04}
        />
      </mesh>

      {/* İzleyiciye göre Sağ Kol (Turuncu Kol + Bordo Manşet) */}
      <mesh name="Sag_Kol" geometry={rightSleeveGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={orangeColor}
          roughness={0.38}
          metalness={0.04}
        />
      </mesh>
      <mesh name="Sag_Manset" geometry={rightCuffGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={darkRedColor}
          roughness={0.35}
          metalness={0.04}
        />
      </mesh>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── BİSİKLET YAKA RİBANASI (Karşıt Renkli) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <mesh name="Sol_Yaka" geometry={redCollarGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={isParcali ? darkRedColor : accentColor}
          roughness={0.34}
        />
      </mesh>
      <mesh name="Sag_Yaka" geometry={orangeCollarGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={isParcali ? orangeColor : accentColor}
          roughness={0.34}
        />
      </mesh>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── ÖN TARAF: 5 YILDIZLI GALATASARAY ARMASI ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {hasBadge && crestData && (
        <group name="Arma_ve_Yildizlar">
          {/* Beyaz Oval Kalkan */}
          <mesh
            name="Arma_Beyaz_Oval"
            geometry={crestData.shieldGeom}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#FFFFFF"
              roughness={0.26}
              metalness={0.04}
            />
          </mesh>

          {/* Bordo 'G' Harfi + İç İçe Geçen Sağ Kuşak */}
          {isGalatasaray && (
            <>
              <mesh
                name="Arma_G_Yay"
                geometry={crestData.gArcGeom}
                castShadow
              >
                <meshStandardMaterial
                  color={darkRedColor}
                  roughness={0.28}
                  metalness={0.12}
                />
              </mesh>
              <mesh
                name="Arma_G_Kusak"
                geometry={crestData.gBarGeom}
                castShadow
              >
                <meshStandardMaterial
                  color={darkRedColor}
                  roughness={0.28}
                  metalness={0.12}
                />
              </mesh>
              {/* Turuncu-Altın 'S' Harfi */}
              <mesh
                name="Arma_S_Harfi"
                geometry={crestData.sGeom}
                castShadow
              >
                <meshStandardMaterial
                  color={orangeColor}
                  roughness={0.24}
                  metalness={0.18}
                />
              </mesh>
            </>
          )}

          {/* 5 Adet 3 Boyutlu Piramit Kesimli Şampiyonluk Yıldızı */}
          {crestData.starGeoms.map((sg, idx) => (
            <mesh
              key={idx}
              name={`Arma_Yildiz_${idx + 1}`}
              geometry={sg}
              castShadow
            >
              <meshStandardMaterial
                color="#FFB800"
                roughness={0.22}
                metalness={0.38}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── ÖN TARAF: SIÇRAYAN PUMA LOGOSU ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {pumaGeom && !hasFrontNumber && (
        <mesh
          name="On_Uretici_Logo"
          geometry={pumaGeom}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#FFFFFF"
            roughness={0.25}
            metalness={0.06}
          />
        </mesh>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── ÖN TARAF: GÖĞÜS SPONSORU (PASİFİK HOLDİNG / ÖZEL YAZI) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {frontTextMeshes.length > 0 && (
        <group name="On_Yazi_Sponsor">
          {frontTextMeshes.map((item, idx) => (
            <mesh
              key={idx}
              name={`On_Yazi_Karakter_${idx + 1}`}
              geometry={item.geom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor}
                roughness={0.26}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── ARKA TARAF: FUTBOLCU İSMİ (OSIMHEN) & BÜYÜK NUMARA (45) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      {backNameMeshes.length > 0 && (
        <group name="Arka_Isim">
          {backNameMeshes.map((item, idx) => (
            <mesh
              key={idx}
              name={`Arka_Isim_Harf_${idx + 1}`}
              geometry={item.geom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor}
                roughness={0.26}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}

      {backNumMeshes.length > 0 && (
        <group name="Arka_Numara">
          {backNumMeshes.map((item, idx) => (
            <mesh
              key={idx}
              name={`Arka_Numara_Rakam_${idx + 1}`}
              geometry={item.geom}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={textColor}
                roughness={0.26}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

export default JerseyPencilCase;
