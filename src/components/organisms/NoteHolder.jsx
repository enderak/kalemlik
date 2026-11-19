import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * NoteHolder – Standart Not Kağıtlığı / Küp Bloknot & Post-it Haznesi
 * 
 * Standart kare not kağıtları (76x76mm, 80x80mm küp bloknot / Post-it) için özel tasarlanmış,
 * ön tarafında parmak alma U-oyuğu bulunan ergonomik masaüstü düzenleyici haznesi.
 * 
 * Kalemliğin Sağına, Soluna, Önüne veya Arkasına yekpare (monoblok) veya mesafeli olarak bağlanabilir.
 */
const NoteHolder = ({
  noteWidth = 82,            // mm – iç hazne kağıt genişliği (76-80mm kağıtlar için)
  noteDepth = 82,            // mm – iç hazne kağıt derinliği
  noteHeight = 30,           // mm – hazne dış yüksekliği (kağıt kapasitesi)
  wallThickness = 3.2,       // mm – dış duvar et kalınlığı
  bottomThickness = 4.0,     // mm – taban kalınlığı
  cornerRadius = 6,          // mm – dış köşe yuvarlatma
  hasThumbCutout = true,     // boolean – ön duvarda parmak alma U-oyuğu
  thumbCutoutWidth = 34,     // mm – parmak oyuğu genişliği
  thumbCutoutDepth = 18,     // mm – parmak oyuğu derinliği
  position = 'side',         // 'side' | 'front' | 'back'
  side = 'right',            // 'right' | 'left' (side konumundayken)
  distance = 0,              // mm – kalemliğe olan mesafe (0 = tam birleşik)
  offset = 0,                // mm – kaydırma
  outerDiameter = 100,       // mm – kale kalemlik çapı
  outerSize = 100,           // mm – kare kale boyutu
  shape = 'cylinder',
  mode = 'jersey',
  torsoWidth = 81,
  torsoDepth = 46,
  baseWidth = 80,
  baseDepth = 48,
  materialColor = '#1E293B', // Taban / gövde rengiyle uyumlu
  showSamplePaper = true,    // 3D önizlemede içinde sarı not kağıdı bloğu göster
  holderRef,
}) => {
  const totalW = noteWidth + 2 * wallThickness;
  const totalD = noteDepth + 2 * wallThickness;
  const hw = totalW / 2;
  const hd = totalD / 2;
  const botThick = Math.max(2.0, Number(bottomThickness) || 4.0);
  const wallThick = Math.max(1.8, Number(wallThickness) || 3.2);
  const holderH = Math.max(15, Number(noteHeight) || 30);

  // 1. Taban Plakası (Dıştan Yuvarlatılmış Köşeli Zemin)
  const floorGeom = useMemo(() => {
    const shape = new THREE.Shape();
    const cr = Math.min(cornerRadius, hw / 2, hd / 2);
    shape.moveTo(-hw + cr, hd);
    shape.lineTo(hw - cr, hd);
    shape.quadraticCurveTo(hw, hd, hw, hd - cr);
    shape.lineTo(hw, -hd + cr);
    shape.quadraticCurveTo(hw, -hd, hw - cr, -hd);
    shape.lineTo(-hw + cr, -hd);
    shape.quadraticCurveTo(-hw, -hd, -hw, -hd + cr);
    shape.lineTo(-hw, hd - cr);
    shape.quadraticCurveTo(-hw, hd, -hw + cr, hd);

    const bevel = Math.min(0.8, botThick * 0.2);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: botThick - bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [hw, hd, cornerRadius, botThick]);

  // 2. Sol ve Sağ Yan Duvarlar
  const wallH = holderH - botThick;
  const sideWallGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(wallThick, wallH, totalD);
    g.translate(0, botThick + wallH / 2, 0);
    return g;
  }, [wallThick, wallH, totalD, botThick]);

  // 3. Arka Duvar
  const backWallGeom = useMemo(() => {
    const innerW = totalW - 2 * wallThick;
    const g = new THREE.BoxGeometry(innerW, wallH, wallThick);
    g.translate(0, botThick + wallH / 2, -hd + wallThick / 2);
    return g;
  }, [totalW, wallThick, wallH, botThick, hd]);

  // 4. Ön Duvar (Ergonomik Parmak Alma U-Oyuğu İle)
  const frontWallGeom = useMemo(() => {
    const innerW = totalW - 2 * wallThick;
    const hwIn = innerW / 2;

    if (!hasThumbCutout) {
      const g = new THREE.BoxGeometry(innerW, wallH, wallThick);
      g.translate(0, botThick + wallH / 2, hd - wallThick / 2);
      return g;
    }

    const notchW = Math.min(Number(thumbCutoutWidth) || 34, innerW - 10);
    const notchD = Math.min(Number(thumbCutoutDepth) || 18, wallH - 4);
    const lipH = Math.max(botThick + 4, holderH - notchD);

    const shape = new THREE.Shape();
    shape.moveTo(-hwIn, botThick);
    shape.lineTo(hwIn, botThick);
    shape.lineTo(hwIn, holderH);
    shape.lineTo(notchW / 2, holderH);
    shape.bezierCurveTo(
      notchW / 2,
      lipH,
      -notchW / 2,
      lipH,
      -notchW / 2,
      holderH
    );
    shape.lineTo(-hwIn, holderH);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: wallThick,
      bevelEnabled: false,
    });
    g.translate(0, 0, hd - wallThick);
    return g;
  }, [totalW, wallThick, wallH, botThick, hd, hasThumbCutout, thumbCutoutWidth, thumbCutoutDepth, holderH]);

  // 5. İç Kağıt Haznesi (Görsel Önizleme Amaçlı Sarı Post-it Not Bloğu)
  const samplePaperGeom = useMemo(() => {
    if (!showSamplePaper) return null;
    const padW = noteWidth - 2;
    const padD = noteDepth - 2;
    const padH = Math.min(18, holderH - botThick - 4);
    const g = new THREE.BoxGeometry(padW, padH, padD);
    g.translate(0, botThick + padH / 2 + 0.1, 0);
    return g;
  }, [showSamplePaper, noteWidth, noteDepth, holderH, botThick]);

  // 6. Kalemliğe Bağlantı Köprüsü / Monoblok Taban Birleşimi
  const contactDistance = Math.max(0, Number(distance) || 0);

  // Kalemlik gövdesinin temas sınırları:
  let contactX = 36;
  let contactZ = 22;
  if (mode === 'jersey') {
    contactX = Math.max(36, (Number(baseWidth) || 80) / 2);
    contactZ = Math.max(22, (Number(baseDepth) || 48) / 2);
  } else {
    const r = (shape === 'cylinder' ? outerDiameter : outerSize) / 2;
    contactX = r;
    contactZ = r;
  }

  // Bağlantı Köprüsü (Monoblok taban kaynaştırıcı)
  const bridgeGeom = useMemo(() => {
    const bridgeThick = botThick;
    const bridgeLength = contactDistance + 4; // 4mm içeri gömülerek boşluksuz kaynak sağlar
    if (position === 'side') {
      const g = new THREE.BoxGeometry(bridgeLength, bridgeThick, Math.min(totalD * 0.7, 44));
      const dir = side === 'left' ? 1 : -1;
      g.translate(dir * (hw + bridgeLength / 2 - 2), bridgeThick / 2, 0);
      return g;
    } else {
      const g = new THREE.BoxGeometry(Math.min(totalW * 0.7, 44), bridgeThick, bridgeLength);
      const dir = position === 'front' ? -1 : 1;
      g.translate(0, bridgeThick / 2, dir * (hd + bridgeLength / 2 - 2));
      return g;
    }
  }, [position, side, contactDistance, botThick, totalD, totalW, hw, hd]);

  // Konumlandırma Koordinatları:
  let holderPosX = 0;
  let holderPosY = 0;
  let holderPosZ = 0;
  let holderRotY = 0;

  if (position === 'side') {
    if (side === 'left') {
      holderPosX = -(contactX + contactDistance + hw);
    } else {
      holderPosX = contactX + contactDistance + hw;
    }
    holderPosZ = Number(offset) || 0;
    holderRotY = 0;
  } else if (position === 'front') {
    holderPosX = Number(offset) || 0;
    holderPosZ = contactZ + contactDistance + hd;
    holderRotY = 0;
  } else if (position === 'back') {
    holderPosX = -(Number(offset) || 0);
    holderPosZ = -(contactZ + contactDistance + hd);
    holderRotY = Math.PI; // Arkaya bakan kullanıcıya doğru çevir
  }

  return (
    <group
      ref={holderRef}
      name="Notluk_Kup_Not_Haznesi"
      position={[holderPosX, holderPosY, holderPosZ]}
      rotation={[0, holderRotY, 0]}
    >
      {/* ── Taban Plakası ── */}
      <mesh name="Notluk_Taban" geometry={floorGeom} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── Sol Duvar ── */}
      <mesh
        name="Notluk_Sol_Duvar"
        geometry={sideWallGeom}
        position={[-hw + wallThick / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── Sağ Duvar ── */}
      <mesh
        name="Notluk_Sag_Duvar"
        geometry={sideWallGeom}
        position={[hw - wallThick / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── Arka Duvar ── */}
      <mesh name="Notluk_Arka_Duvar" geometry={backWallGeom} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── Ön Duvar (Parmak Oyuklu) ── */}
      <mesh name="Notluk_On_Duvar" geometry={frontWallGeom} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── Kalemliğe Bağlantı Köprüsü ── */}
      <mesh name="Notluk_Baglanti_Koprusu" geometry={bridgeGeom} castShadow receiveShadow>
        <meshStandardMaterial color={materialColor} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* ── İç Not Kağıdı Bloğu (3D Önizleme) ── */}
      {samplePaperGeom && (
        <mesh name="Notluk_Kagit_Blogu_Onizleme" geometry={samplePaperGeom} receiveShadow>
          <meshStandardMaterial color="#FEF08A" roughness={0.8} metalness={0.0} />
        </mesh>
      )}
    </group>
  );
};

export default NoteHolder;