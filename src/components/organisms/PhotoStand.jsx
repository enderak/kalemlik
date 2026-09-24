import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * PhotoStand – Vesikalık Fotoğraf Tutacağı
 *
 * 1) Öndeyse: Çerçevenin ARKA yüzeyi kalemliğin ön duvarına yaslanır. Fotoğraf öne (+Z) bakar.
 * 2) Yandaysa: Çerçevenin YAN tarafı (sol kenarı) kalemliğin yan duvarına yaslanır. Fotoğraf yine öne (+Z) bakar.
 * 3) Arkadaysa: Çerçevenin ARKA yüzeyi kalemliğin arka duvarına yaslanır. Fotoğraf arkaya (-Z) bakar.
 * 4) Kalem kutusuna olan mesafe (distance) ayarlanabilir (0 = tam yaslanmış).
 * 5) Fotoğraf üstten kaydırılan U ceptir (sol, sağ, alt çıta ve ön tutucu tırnaklar).
 */

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

// Kalemlikteki dünya koordinatlarına göre ExtrudeGeometry UV haritalamasıyla
// birebir milimetrik eşleşme sağlayan triplanar Box UV yardımcısı
function applyBoxWorldUV(geom, texUnitW = 25.5, texUnitH = 11.5) {
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  if (!pos || !norm) return;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    let u = 0, v = 0;
    if (nz >= nx && nz >= ny) {
      u = x / texUnitW;
      v = y / texUnitH;
    } else if (nx >= ny && nx >= nz) {
      u = z / texUnitW;
      v = y / texUnitH;
    } else {
      u = x / texUnitW;
      v = z / texUnitH;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

const PhotoStand = ({
  photoWidth = 35,       // mm – fotoğraf genişliği
  photoHeight = 45,      // mm – fotoğraf yüksekliği
  frameThickness = 2.5,  // mm – kenar çerçeve genişliği
  frameDepth = 5.0,      // mm – öne doğru toplam çıkıntı/kalınlık
  slotDepth = 1.0,       // mm – fotoğraf kanalı kalınlığı (1mm ve ayarlanabilir)
  backPlateThickness = 4.0, // mm – çerçevenin arka duvar kalınlığı (ayarlanabilir, sur gibi tok durur)
  onlyEdges = false,     // boolean – sadece kenarlıklar (arka panel içi boş, ortası açık pencere)
  hasTopEdge = false,    // boolean – üst kenarlık kapat (4 kenarlı kapalı çerçeve)
  distance = 0,          // mm – kalemliğe olan mesafe (0 = tam yaslanmış)
  offset = 0,            // mm – yandayken ön/arka (Z), öndeyken sağ/sol (X) kaydırma
  tilt = 10,             // derece – geriye doğru yatıklık açısı
  hasCrenellations = true, // üst surlar / mazgallar
  numCrenellations = 4,    // sur diş sayısı
  crenellationHeight = 6,  // sur yüksekliği (mm)
  crenellationAlignment = 'center', // 'front' | 'center' | 'back'
  position = 'front',    // 'side' | 'front' | 'back'
  outerDiameter = 100,   // mm – silindirik kalemlik dış çapı
  outerSize = 100,       // mm – kare kalemlik dış boyutu
  shape = 'cylinder',    // 'cylinder' | 'square'
  height = 150,          // mm – kalemlik yüksekliği
  baseHeight = 8,        // mm – taban yüksekliği
  topExtension = 6,
  corniceHeight = 12,
  showBrickTexture = false,
  embossedBricks = false,
  brickDepth = 1.5,
  materialColor = '#a8a29e',
  standRef,
}) => {
  const outerR = shape === 'cylinder' ? outerDiameter / 2 : outerSize / 2;

  // Fotoğraf kanalı (slot / U-groove) ve çıta boyut hesaplamaları
  const slotThick = Math.max(0.5, Number(slotDepth) || 1.0);
  // Çerçevenin toplam ön derinliği (kanal kalınlığı + ön tırnak payı)
  const effectiveFrameDepth = Math.max(frameDepth, slotThick + 1.0);
  const frontLipThick = effectiveFrameDepth - slotThick;

  // Fotoğraf yuvası toleransı ve çıta profili:
  const slotW = photoWidth + 0.6; // Fotoğrafın rahat kayması için 0.6mm boşluk
  const slotH = photoHeight + 0.6;
  const wallThick = Math.max(1.2, frameThickness * 0.45); // Dış taşıyıcı duvar kalınlığı
  const lipOverlap = Math.max(0.8, frameThickness - wallThick); // Fotoğrafı önden tutan tırnak payı
  const totalW = slotW + 2 * wallThick;
  const bottomWallThick = wallThick;
  const totalH = bottomWallThick + slotH + (hasTopEdge ? wallThick : 0);
  const lipWidth = frameThickness; // Ön çıta genişliği

  // Arka plaka kalınlığı (kullanıcının ayarladığı değer, min 1.5mm)
  const backPlateThick = Math.max(1.5, backPlateThickness);

  const brickTex = useMemo(() => (showBrickTexture ? createBrickTexture() : null), [showBrickTexture]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.95,
        metalness: 0.1,
        map: brickTex,
      }),
    [materialColor, brickTex]
  );

  // 1. Arka Destek Levhası (Z ekseninde 0'dan -backPlateThick yönüne doğru arkaya uzanır)
  // Böylece Z = 0 fotoğrafın arkasının dayandığı iç yüzey kalır.
  // 1. Arka Destek: Dolu Levha Modu (Z ekseninde 0'dan -backPlateThick yönüne doğru)
  const backGeom = useMemo(() => {
    if (onlyEdges) return null;
    const g = new THREE.BoxGeometry(totalW, totalH, backPlateThick);
    g.translate(0, totalH / 2, -backPlateThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [onlyEdges, totalW, totalH, backPlateThick]);

  // 1b. Arka Kenarlık Çıtaları (Sadece Kenarlıklar Modu: Ortası Açık / İçi Boş)
  const rearSideRailGeom = useMemo(() => {
    if (!onlyEdges) return null;
    const g = new THREE.BoxGeometry(frameThickness, totalH, backPlateThick);
    g.translate(0, totalH / 2, -backPlateThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [onlyEdges, frameThickness, totalH, backPlateThick]);

  const rearBottomRailGeom = useMemo(() => {
    if (!onlyEdges) return null;
    const g = new THREE.BoxGeometry(totalW, frameThickness, backPlateThick);
    g.translate(0, frameThickness / 2, -backPlateThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [onlyEdges, totalW, frameThickness, backPlateThick]);

  const rearTopRailGeom = useMemo(() => {
    if (!onlyEdges || !hasTopEdge) return null;
    const g = new THREE.BoxGeometry(totalW, frameThickness, backPlateThick);
    g.translate(0, totalH - frameThickness / 2, -backPlateThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [onlyEdges, hasTopEdge, totalW, frameThickness, totalH, backPlateThick]);

  // 2. Yan Dış Taşıyıcı Duvarlar (Fotoğraf kanalını dıştan sınırlayan çıta gövdeleri)
  // X = wallThick, Y = totalH, Z = 0'dan effectiveFrameDepth'e kadar
  const sideWallGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(wallThick, totalH, effectiveFrameDepth);
    g.translate(0, totalH / 2, effectiveFrameDepth / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [wallThick, totalH, effectiveFrameDepth]);

  // 3. Alt Taban Duvarı (Fotoğrafın üzerine oturduğu alt sınır desteği)
  // X = totalW, Y = bottomWallThick, Z = 0'dan effectiveFrameDepth'e kadar
  const bottomWallGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, bottomWallThick, effectiveFrameDepth);
    g.translate(0, bottomWallThick / 2, effectiveFrameDepth / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [totalW, bottomWallThick, effectiveFrameDepth]);

  // 4. Ön Tutucu Çıtalar / Tırnaklar (Z ekseninde slotThick'ten effectiveFrameDepth'e kadar uzanır)
  // [0, slotThick] arası tamamen boştur ve fotoğrafın çıtaların içine kayarak girdiği kanaldır.
  const frontLipSideGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(lipWidth, totalH, frontLipThick);
    g.translate(0, totalH / 2, slotThick + frontLipThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [lipWidth, totalH, frontLipThick, slotThick]);

  const frontLipBottomGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, lipWidth, frontLipThick);
    g.translate(0, lipWidth / 2, slotThick + frontLipThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [totalW, lipWidth, frontLipThick, slotThick]);

  const frontLipTopGeom = useMemo(() => {
    if (!hasTopEdge) return null;
    const g = new THREE.BoxGeometry(totalW, lipWidth, frontLipThick);
    g.translate(0, totalH - lipWidth / 2, slotThick + frontLipThick / 2);
    applyBoxWorldUV(g, 25.5, 11.5);
    return g;
  }, [hasTopEdge, totalW, lipWidth, frontLipThick, totalH, slotThick]);

  // 5. Üst Surlar / Mazgallar (Crenellations)
  const crenellationsData = useMemo(() => {
    if (!hasCrenellations || numCrenellations < 1 || crenellationHeight <= 0) return null;
    const n = Math.max(1, Math.round(numCrenellations));
    const unitWidth = totalW / (2 * n - 1);
    const toothWidth = unitWidth;

    const toothDepth = Math.max(backPlateThick, 3.0);

    let zOffset = -backPlateThick / 2; // varsayılan 'back'
    if (crenellationAlignment === 'front') {
      zOffset = toothDepth / 2; // öne hizalı
    } else if (crenellationAlignment === 'center') {
      const totalDepth = backPlateThick + effectiveFrameDepth;
      zOffset = -backPlateThick + totalDepth / 2;
    }

    const geom = new THREE.BoxGeometry(toothWidth, crenellationHeight, toothDepth);
    geom.translate(0, crenellationHeight / 2, zOffset);
    applyBoxWorldUV(geom, 25.5, 11.5);

    const positions = [];
    for (let i = 0; i < n; i++) {
      const x = -totalW / 2 + toothWidth / 2 + i * (2 * unitWidth);
      positions.push([x, totalH, 0]);
    }
    return { geom, positions };
  }, [
    hasCrenellations,
    numCrenellations,
    crenellationHeight,
    totalW,
    backPlateThick,
    effectiveFrameDepth,
    crenellationAlignment,
    totalH,
  ]);

  // 6. 3D Kabartmalı Tuğlalar (Arka Duvar Üzerine)
  // Kalemlikteki seçilen şekle (silindir veya kare) göre boyut ve boşlukları birebir eşleştirir
  const embossedBrickGeoms = useMemo(() => {
    if (onlyEdges || !embossedBricks || brickDepth <= 0) return null;
    const bDepth = THREE.MathUtils.clamp(brickDepth, 0.5, 3.0);

    let gap = 1.0;
    let hBrick = 8.0;
    let targetBrickW = 20.0;

    if (shape === 'square') {
      // Kalemlikteki makeSquareBrickGeoms ile birebir aynı formül ve ölçüler
      const Hwall = height - (corniceHeight > 0 ? corniceHeight : 0);
      const Ystart = baseHeight > 0 ? baseHeight : 0;
      const Hbricks = Hwall - Ystart;
      if (Hbricks > 10) {
        const Nrows = Math.max(4, Math.round(Hbricks / 13));
        gap = 1.5;
        const hRow = Hbricks / Nrows;
        hBrick = Math.max(2, hRow - gap);
        const s = outerSize / 2;
        const NbCastle = Math.max(2, Math.round((2 * s) / 26));
        targetBrickW = (2 * s - (NbCastle + 1) * gap) / NbCastle;
      }
    } else {
      // Silindirik mod: bw = 20, bh = 8, gap = 1
      gap = 1.0;
      hBrick = 8.0;
      targetBrickW = 20.0;
    }

    const rowH = hBrick + gap;
    const numRows = Math.max(1, Math.floor((totalH - gap) / rowH));

    const Nb = Math.max(1, Math.round((totalW - gap) / (targetBrickW + gap)));
    const lBrick = (totalW - (Nb + 1) * gap) / Nb;
    const halfL = Math.max(2, (lBrick - gap) / 2);

    const geoms = [];
    const zBack = -backPlateThick; // Arka duvarın arka yüzeyi

    for (let r = 0; r < numRows; r++) {
      const yCenter = gap + r * rowH + hBrick / 2;
      const isEven = r % 2 === 0;
      const spans = [];

      if (isEven) {
        // Çift satır: Tam tuğlalar
        for (let i = 0; i < Nb; i++) {
          const u0 = -totalW / 2 + gap + i * (lBrick + gap);
          const u1 = u0 + lBrick;
          spans.push({ w: u1 - u0, center: (u0 + u1) / 2 });
        }
      } else {
        // Tek satır: Şaşırtmalı (başta ve sonda yarım tuğla, ortada tam tuğlalar)
        const uStart = -totalW / 2 + gap;
        spans.push({ w: halfL, center: uStart + halfL / 2 });
        for (let i = 0; i < Nb - 1; i++) {
          const u0 = uStart + halfL + gap + i * (lBrick + gap);
          const u1 = u0 + lBrick;
          spans.push({ w: lBrick, center: (u0 + u1) / 2 });
        }
        const uEnd = totalW / 2 - gap;
        spans.push({ w: halfL, center: uEnd - halfL / 2 });
      }

      spans.forEach((sp) => {
        const g = new THREE.BoxGeometry(sp.w, hBrick, bDepth);
        g.translate(sp.center, yCenter, zBack - bDepth / 2);
        applyBoxWorldUV(g, 25.5, 11.5);
        geoms.push(g);
      });
    }

    return geoms;
  }, [
    embossedBricks,
    onlyEdges,
    brickDepth,
    shape,
    height,
    baseHeight,
    corniceHeight,
    outerSize,
    totalW,
    totalH,
    backPlateThick,
  ]);

  // 7. Bağlantı/Destek Kolu
  const bridgeGeom = useMemo(() => {
    const bridgeThick = Math.max(baseHeight, 4);
    if (position === 'front' || position === 'back') {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(totalW * 0.7, bridgeThick, bridgeLength);
      g.translate(0, bridgeThick / 2, -bridgeLength / 2);
      applyBoxWorldUV(g, 25.5, 11.5);
      return g;
    } else {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(bridgeLength, bridgeThick, backPlateThick + effectiveFrameDepth + 2);
      g.translate(-bridgeLength / 2, bridgeThick / 2, (effectiveFrameDepth - backPlateThick) / 2);
      applyBoxWorldUV(g, 25.5, 11.5);
      return g;
    }
  }, [position, distance, baseHeight, totalW, backPlateThick, effectiveFrameDepth]);

  // Konumlandırma Koordinatları ve Dönüş Açısı:
  let standPosition = [0, 0, 0];
  let standRotation = [0, 0, 0];

  if (position === 'front') {
    // ÖNDE:
    // X ekseni: Sağ / Sol kaydırma (offset)
    // Z ekseni: Kalemliğin ön duvarına olan mesafe (+Z)
    const posX = offset;
    const posY = 0;
    const posZ = outerR + distance + backPlateThick;
    standPosition = [posX, posY, posZ];
    standRotation = [0, 0, 0];
  } else if (position === 'back') {
    // ARKADA:
    // X ekseni: Sağ / Sol kaydırma (offset). Çerçeve 180° döndürüldüğünde local +X world -X'e denk gelir.
    // Arkadan bakıldığında sağa kaymanın tutarlı olması için world posX = -offset olur.
    // Z ekseni: Kalemliğin arka duvarına olan mesafe (-Z)
    const posX = -offset;
    const posY = 0;
    const posZ = -(outerR + distance + backPlateThick);
    standPosition = [posX, posY, posZ];
    standRotation = [0, Math.PI, 0];
  } else {
    // YANDA:
    // X ekseni: Kalemliğin yan duvarına olan mesafe (+X)
    // Z ekseni: Ön / Arka kaydırma (offset)
    const posX = outerR + distance + totalW / 2;
    const posY = 0;
    const posZ = offset;
    standPosition = [posX, posY, posZ];
    standRotation = [0, 0, 0];
  }

  const tiltRad = (tilt * Math.PI) / 180;

  return (
    <group ref={standRef} position={standPosition} rotation={standRotation}>
      {/* Eğim açısı (X ekseni etrafında geriye/öne dönüş) */}
      <group rotation={[tiltRad, 0, 0]}>
        {/* Arka Destek: Dolu Panel veya Sadece Kenarlıklar */}
        {!onlyEdges ? (
          backGeom && <mesh geometry={backGeom} material={mat} castShadow receiveShadow />
        ) : (
          <>
            {/* Arka Sol Çıta */}
            {rearSideRailGeom && (
              <mesh
                geometry={rearSideRailGeom}
                material={mat}
                position={[-totalW / 2 + frameThickness / 2, 0, 0]}
                castShadow
                receiveShadow
              />
            )}
            {/* Arka Sağ Çıta */}
            {rearSideRailGeom && (
              <mesh
                geometry={rearSideRailGeom}
                material={mat}
                position={[totalW / 2 - frameThickness / 2, 0, 0]}
                castShadow
                receiveShadow
              />
            )}
            {/* Arka Alt Çıta */}
            {rearBottomRailGeom && (
              <mesh geometry={rearBottomRailGeom} material={mat} castShadow receiveShadow />
            )}
            {/* Arka Üst Çıta (4 Kenar Modunda) */}
            {hasTopEdge && rearTopRailGeom && (
              <mesh geometry={rearTopRailGeom} material={mat} castShadow receiveShadow />
            )}
          </>
        )}

        {/* Alt Taban Duvarı (Fotoğrafın üzerine oturduğu taban) */}
        <mesh geometry={bottomWallGeom} material={mat} castShadow receiveShadow />

        {/* Sol Dış Yan Duvar */}
        <mesh
          geometry={sideWallGeom}
          material={mat}
          position={[-totalW / 2 + wallThick / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Sağ Dış Yan Duvar */}
        <mesh
          geometry={sideWallGeom}
          material={mat}
          position={[totalW / 2 - wallThick / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Sol Tutucu Çıta */}
        <mesh
          geometry={frontLipSideGeom}
          material={mat}
          position={[-totalW / 2 + lipWidth / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Sağ Tutucu Çıta */}
        <mesh
          geometry={frontLipSideGeom}
          material={mat}
          position={[totalW / 2 - lipWidth / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Alt Tutucu Çıta */}
        <mesh geometry={frontLipBottomGeom} material={mat} castShadow receiveShadow />

        {/* Ön Üst Tutucu Çıta (4 Kenar Modunda) */}
        {hasTopEdge && frontLipTopGeom && (
          <mesh geometry={frontLipTopGeom} material={mat} castShadow receiveShadow />
        )}

        {/* 3D Kabartmalı Tuğlalar (Arka Duvar) */}
        {embossedBrickGeoms &&
          embossedBrickGeoms.map((g, idx) => (
            <mesh
              key={`photo-brick-${idx}`}
              geometry={g}
              material={mat}
              castShadow
              receiveShadow
            />
          ))}

        {/* Üst Surlar / Mazgallar (Crenellations) */}
        {crenellationsData &&
          crenellationsData.positions.map((pos, idx) => (
            <mesh
              key={idx}
              geometry={crenellationsData.geom}
              material={mat}
              position={pos}
              castShadow
              receiveShadow
            />
          ))}
      </group>

      {/* Kalemliğe bağlantı / mesafe köprüsü */}
      {distance > 0 && (
        <mesh geometry={bridgeGeom} material={mat} castShadow receiveShadow />
      )}
    </group>
  );
};

export default PhotoStand;
