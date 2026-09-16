import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * PhotoStand – Vesikalık Fotoğraf Tutacağı
 *
 * 1) Öndeyse: Çerçevenin ARKA yüzeyi kalemliğin ön duvarına yaslanır. Fotoğraf öne (+Z) bakar.
 * 2) Yandaysa: Çerçevenin YAN tarafı (sol kenarı) kalemliğin yan duvarına yaslanır. Fotoğraf yine öne (+Z) bakar.
 * 3) Kalem kutusuna olan mesafe (distance) ayarlanabilir (0 = tam yaslanmış).
 * 4) Fotoğraf üstten kaydırılan U ceptir (sol, sağ, alt çıta ve ön tutucu tırnaklar).
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

const PhotoStand = ({
  photoWidth = 35,       // mm – fotoğraf genişliği
  photoHeight = 45,      // mm – fotoğraf yüksekliği
  frameThickness = 2.5,  // mm – kenar çerçeve genişliği
  frameDepth = 3.5,      // mm – öne doğru toplam çıkıntı/kalınlık
  backPlateThickness = 4.0, // mm – çerçevenin arka duvar kalınlığı (ayarlanabilir, sur gibi tok durur)
  distance = 0,          // mm – kalemliğe olan mesafe (0 = tam yaslanmış)
  offset = 0,            // mm – yandayken ön/arka (Z), öndeyken sağ/sol (X) kaydırma
  tilt = 10,             // derece – geriye doğru yatıklık açısı
  hasCrenellations = true, // üst surlar / mazgallar
  numCrenellations = 4,    // sur diş sayısı
  crenellationHeight = 6,  // sur yüksekliği (mm)
  crenellationAlignment = 'center', // 'front' | 'center' | 'back'
  position = 'front',    // 'side' | 'front'
  outerDiameter = 100,   // mm – silindirik kalemlik dış çapı
  outerSize = 100,       // mm – kare kalemlik dış boyutu
  shape = 'cylinder',    // 'cylinder' | 'square'
  height = 150,          // mm – kalemlik yüksekliği
  baseHeight = 8,        // mm – taban yüksekliği
  showBrickTexture = false,
  embossedBricks = false,
  brickDepth = 1.5,
  materialColor = '#a8a29e',
  standRef,
}) => {
  const outerR = shape === 'cylinder' ? outerDiameter / 2 : outerSize / 2;

  // Çerçevenin dış toplam boyutları
  const totalW = photoWidth + frameThickness * 2;
  const totalH = photoHeight + frameThickness; // Altta ray var, üst açık

  // Arka plaka kalınlığı (kullanıcının ayarladığı değer, min 1.5mm)
  const backPlateThick = Math.max(1.5, backPlateThickness);
  // Fotoğraf yuvası boşluğu (derinlik)
  const slotDepth = 1.0; // mm
  // Çerçevenin toplam ön derinliği (rayların çıkıntısı)
  const effectiveFrameDepth = Math.max(frameDepth, 3.0);
  const frontLipThick = Math.max(0.8, effectiveFrameDepth - slotDepth);
  const lipWidth = frameThickness;

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
  const backGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, totalH, backPlateThick);
    g.translate(0, totalH / 2, -backPlateThick / 2);
    return g;
  }, [totalW, totalH, backPlateThick]);

  // 2. Alt Destek Rayı (Z ekseninde 0'dan +effectiveFrameDepth yönüne doğru öne uzanır)
  const bottomRailGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, frameThickness, effectiveFrameDepth);
    g.translate(0, frameThickness / 2, effectiveFrameDepth / 2);
    return g;
  }, [totalW, frameThickness, effectiveFrameDepth]);

  // 3. Sol ve Sağ Yan Raylar
  const sideRailGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(frameThickness, totalH, effectiveFrameDepth);
    g.translate(0, totalH / 2, effectiveFrameDepth / 2);
    return g;
  }, [frameThickness, totalH, effectiveFrameDepth]);

  // 4. Ön Tutucu Tırnaklar (U profil)
  const frontLipSideGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(lipWidth, totalH, frontLipThick);
    g.translate(0, totalH / 2, effectiveFrameDepth - frontLipThick / 2);
    return g;
  }, [lipWidth, totalH, frontLipThick, effectiveFrameDepth]);

  const frontLipBottomGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, lipWidth, frontLipThick);
    g.translate(0, lipWidth / 2, effectiveFrameDepth - frontLipThick / 2);
    return g;
  }, [totalW, lipWidth, frontLipThick, effectiveFrameDepth]);

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
  const embossedBrickGeoms = useMemo(() => {
    if (!embossedBricks || brickDepth <= 0) return null;
    const bDepth = THREE.MathUtils.clamp(brickDepth, 0.5, 3.0);
    const gap = 1.0;
    const hBrick = 7.0; // Kalemlikle uyumlu sıra yüksekliği
    const rowH = hBrick + gap;
    const numRows = Math.max(1, Math.floor(totalH / rowH));

    const avgBrickW = 16.0;
    const numCols = Math.max(2, Math.round(totalW / avgBrickW));
    const colW = totalW / numCols;
    const wBrick = colW - gap;

    const geoms = [];
    const zBack = -backPlateThick; // Arka duvarın arka yüzeyi

    for (let r = 0; r < numRows; r++) {
      const yCenter = r * rowH + gap + hBrick / 2;
      const isEven = r % 2 === 0;

      if (isEven) {
        for (let c = 0; c < numCols; c++) {
          const xCenter = -totalW / 2 + gap / 2 + c * colW + wBrick / 2;
          const g = new THREE.BoxGeometry(wBrick, hBrick, bDepth);
          g.translate(xCenter, yCenter, zBack - bDepth / 2);
          geoms.push(g);
        }
      } else {
        // Şaşırtmalı (yarım tuğla kenarlarda)
        const halfW = (wBrick - gap) / 2;
        // Sol yarım tuğla
        const gLeft = new THREE.BoxGeometry(halfW, hBrick, bDepth);
        gLeft.translate(-totalW / 2 + gap / 2 + halfW / 2, yCenter, zBack - bDepth / 2);
        geoms.push(gLeft);

        // Orta tam tuğlalar
        for (let c = 0; c < numCols - 1; c++) {
          const xCenter = -totalW / 2 + gap / 2 + halfW + gap + c * colW + wBrick / 2;
          const g = new THREE.BoxGeometry(wBrick, hBrick, bDepth);
          g.translate(xCenter, yCenter, zBack - bDepth / 2);
          geoms.push(g);
        }

        // Sağ yarım tuğla
        const gRight = new THREE.BoxGeometry(halfW, hBrick, bDepth);
        gRight.translate(totalW / 2 - gap / 2 - halfW / 2, yCenter, zBack - bDepth / 2);
        geoms.push(gRight);
      }
    }
    return geoms;
  }, [embossedBricks, brickDepth, totalW, totalH, backPlateThick]);

  // 7. Bağlantı/Destek Kolu
  const bridgeGeom = useMemo(() => {
    const bridgeThick = Math.max(baseHeight, 4);
    if (position === 'front') {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(totalW * 0.7, bridgeThick, bridgeLength);
      g.translate(0, bridgeThick / 2, -bridgeLength / 2);
      return g;
    } else {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(bridgeLength, bridgeThick, backPlateThick + effectiveFrameDepth + 2);
      g.translate(-bridgeLength / 2, bridgeThick / 2, (effectiveFrameDepth - backPlateThick) / 2);
      return g;
    }
  }, [position, distance, baseHeight, totalW, backPlateThick, effectiveFrameDepth]);

  // Konumlandırma Koordinatları:
  let standPosition = [0, 0, 0];

  if (position === 'front') {
    // ÖNDE:
    // X ekseni: Sağ / Sol kaydırma (offset)
    // Z ekseni: Kalemliğin ön duvarına olan mesafe
    const posX = offset;
    const posY = 0;
    const posZ = outerR + distance + backPlateThick;
    standPosition = [posX, posY, posZ];
  } else {
    // YANDA:
    // X ekseni: Kalemliğin yan duvarına olan mesafe
    // Z ekseni: Ön / Arka kaydırma (offset)
    const posX = outerR + distance + totalW / 2;
    const posY = 0;
    const posZ = offset;
    standPosition = [posX, posY, posZ];
  }

  const tiltRad = (tilt * Math.PI) / 180;

  return (
    <group ref={standRef} position={standPosition}>
      {/* Eğim açısı (X ekseni etrafında geriye/öne dönüş) */}
      <group rotation={[tiltRad, 0, 0]}>
        {/* Arka Plaka */}
        <mesh geometry={backGeom} material={mat} castShadow receiveShadow />

        {/* Alt Destek Rayı */}
        <mesh geometry={bottomRailGeom} material={mat} castShadow receiveShadow />

        {/* Sol Yan Ray */}
        <mesh
          geometry={sideRailGeom}
          material={mat}
          position={[-totalW / 2 + frameThickness / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Sağ Yan Ray */}
        <mesh
          geometry={sideRailGeom}
          material={mat}
          position={[totalW / 2 - frameThickness / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Sol Tırnak */}
        <mesh
          geometry={frontLipSideGeom}
          material={mat}
          position={[-totalW / 2 + lipWidth / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Sağ Tırnak */}
        <mesh
          geometry={frontLipSideGeom}
          material={mat}
          position={[totalW / 2 - lipWidth / 2, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Ön Alt Tırnak */}
        <mesh geometry={frontLipBottomGeom} material={mat} castShadow receiveShadow />

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
