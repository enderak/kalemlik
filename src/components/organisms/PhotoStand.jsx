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

const PhotoStand = ({
  photoWidth = 35,       // mm – fotoğraf genişliği
  photoHeight = 45,      // mm – fotoğraf yüksekliği
  frameThickness = 2.5,  // mm – kenar çerçeve genişliği
  frameDepth = 3.5,      // mm – öne doğru toplam çıkıntı/kalınlık
  distance = 0,          // mm – kalemliğe olan mesafe (0 = tam yaslanmış)
  tilt = 10,             // derece – geriye doğru yatıklık açısı
  hasCrenellations = true, // üst surlar / mazgallar
  numCrenellations = 4,    // sur diş sayısı
  crenellationHeight = 6,  // sur yüksekliği (mm)
  position = 'front',    // 'side' | 'front'
  outerDiameter = 100,   // mm – silindirik kalemlik dış çapı
  outerSize = 100,       // mm – kare kalemlik dış boyutu
  shape = 'cylinder',    // 'cylinder' | 'square'
  height = 150,          // mm – kalemlik yüksekliği
  baseHeight = 8,        // mm – taban yüksekliği
  materialColor = '#a8a29e',
  standRef,
}) => {
  const outerR = shape === 'cylinder' ? outerDiameter / 2 : outerSize / 2;

  // Çerçevenin dış toplam boyutları
  const totalW = photoWidth + frameThickness * 2;
  const totalH = photoHeight + frameThickness; // Altta ray var, üst açık

  const backPlateThick = 1.6; // mm
  const slotDepth = 1.0; // mm
  const frontLipThick = Math.max(0.8, frameDepth - backPlateThick - slotDepth);
  const lipWidth = frameThickness;

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.95,
        metalness: 0.1,
      }),
    [materialColor]
  );

  // 1. Arka Destek Levhası
  const backGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, totalH, backPlateThick);
    g.translate(0, totalH / 2, backPlateThick / 2);
    return g;
  }, [totalW, totalH, backPlateThick]);

  // 2. Alt Destek Rayı
  const bottomRailGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, frameThickness, frameDepth);
    g.translate(0, frameThickness / 2, frameDepth / 2);
    return g;
  }, [totalW, frameThickness, frameDepth]);

  // 3. Sol ve Sağ Yan Raylar
  const sideRailGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(frameThickness, totalH, frameDepth);
    g.translate(0, totalH / 2, frameDepth / 2);
    return g;
  }, [frameThickness, totalH, frameDepth]);

  // 4. Ön Tutucu Tırnaklar (U profil)
  const frontLipSideGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(lipWidth, totalH, frontLipThick);
    g.translate(0, totalH / 2, frameDepth - frontLipThick / 2);
    return g;
  }, [lipWidth, totalH, frontLipThick, frameDepth]);

  const frontLipBottomGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(totalW, lipWidth, frontLipThick);
    g.translate(0, lipWidth / 2, frameDepth - frontLipThick / 2);
    return g;
  }, [totalW, lipWidth, frontLipThick, frameDepth]);

  // 5. Üst Surlar / Mazgallar (Crenellations)
  // Arka plakanın üst ucundan (Y = totalH) yukarıya uzanan kale surları
  const crenellationsData = useMemo(() => {
    if (!hasCrenellations || numCrenellations < 1 || crenellationHeight <= 0) return null;
    const n = Math.max(1, Math.round(numCrenellations));
    // Dişler ve aralarındaki boşluklar: n diş + (n-1) boşluk = 2n - 1 birim
    const unitWidth = totalW / (2 * n - 1);
    const toothWidth = unitWidth;
    const geom = new THREE.BoxGeometry(toothWidth, crenellationHeight, backPlateThick);
    geom.translate(0, crenellationHeight / 2, backPlateThick / 2);

    const positions = [];
    for (let i = 0; i < n; i++) {
      const x = -totalW / 2 + toothWidth / 2 + i * (2 * unitWidth);
      positions.push([x, totalH, 0]);
    }
    return { geom, positions };
  }, [hasCrenellations, numCrenellations, crenellationHeight, totalW, backPlateThick, totalH]);

  // 6. Bağlantı/Destek Kolu
  const bridgeGeom = useMemo(() => {
    const bridgeThick = Math.max(baseHeight, 4);
    if (position === 'front') {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(totalW * 0.7, bridgeThick, bridgeLength);
      g.translate(0, bridgeThick / 2, -bridgeLength / 2);
      return g;
    } else {
      const bridgeLength = Math.max(distance + 2, 2);
      const g = new THREE.BoxGeometry(bridgeLength, bridgeThick, frameDepth + 2);
      g.translate(-bridgeLength / 2, bridgeThick / 2, (frameDepth + 2) / 2);
      return g;
    }
  }, [position, distance, baseHeight, totalW, frameDepth]);

  // Konumlandırma Koordinatları:
  let standPosition = [0, 0, 0];

  if (position === 'front') {
    // ÖNDE: Çerçevenin arkası kalemliğin ön duvarına yaslanır
    const posX = 0;
    const posY = 0;
    const posZ = outerR + distance;
    standPosition = [posX, posY, posZ];
  } else {
    // YANDA: Çerçevenin sol kenarı kalemliğin yan duvarına yaslanır
    const posX = outerR + distance + totalW / 2;
    const posY = 0;
    const posZ = 0;
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
