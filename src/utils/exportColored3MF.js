import * as THREE from 'three';
import JSZip from 'jszip';

/**
 * Benzer renk tonlarını (örn. #F8F8FA, #F4F4F6 -> #FFFFFF; #E5A93B -> #FFB800)
 * standart 3D baskı filament renklerine birleştirir ve Türkçe renk bilgisini döndürür.
 */
function getColorPaletteInfo(hexStr) {
  let clean = (hexStr || 'CCCCCC').replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6);
  let r = parseInt(clean.slice(0, 2), 16) || 0;
  let g = parseInt(clean.slice(2, 4), 16) || 0;
  let b = parseInt(clean.slice(4, 6), 16) || 0;

  let colorLabel = `Renk_${clean}`;
  let slotPriority = 50; // Düşük değer = İlk filament slotlarına (Slot 1..4) atanır

  // 1. Beyaz ailesi (Ön/Arka Yazılar, Puma, Arma Kalkanı, Beyaz Şort) -> Saf Beyaz (#FFFFFF)
  if (r > 215 && g > 215 && b > 215) {
    clean = 'FFFFFF';
    r = 255;
    g = 255;
    b = 255;
    colorLabel = 'Beyaz';
    slotPriority = 3;
  }
  // 2. Siyah / Antrasit ailesi (Alt Tabla, Ayraç, Aksesuar) -> Saf Siyah (#18181B)
  else if (r < 55 && g < 55 && b < 65) {
    clean = '18181B';
    r = 24;
    g = 24;
    b = 27;
    colorLabel = 'Siyah';
    slotPriority = 5;
  }
  // 3. Altın Sarısı ailesi (5 Yıldız) -> Parlak Altın Sarı (#FFB800)
  else if (r > 195 && g >= 155 && b < 100) {
    clean = 'FFB800';
    r = 255;
    g = 184;
    b = 0;
    colorLabel = 'Sari_Altin';
    slotPriority = 4;
  }
  // 4. Turuncu ailesi (Parçalı Turuncu Gövde/Kol/Yaka, Arma 'S') -> (#F37021)
  else if (r > 190 && g >= 85 && g < 155 && b < 90) {
    clean = 'F37021';
    r = 243;
    g = 112;
    b = 33;
    colorLabel = 'Turuncu';
    slotPriority = 2;
  }
  // 5. Bordo / Kırmızı ailesi (Parçalı Bordo Gövde/Kol/Yaka, Arma 'G') -> (#82001C)
  else if (r >= 95 && g < 60 && b < 65) {
    clean = '82001C';
    r = 130;
    g = 0;
    b = 28;
    colorLabel = 'Bordo_Kirmizi';
    slotPriority = 1;
  }
  // 6. Mavi / Lacivert ailesi
  else if (b > 110 && r < 90) {
    colorLabel = 'Mavi_Lacivert';
    slotPriority = 1;
  }

  return {
    hex: clean,
    cssHex: `#${clean}`,
    displayColor: `#${clean}FF`,
    rFloat: (r / 255).toFixed(4),
    gFloat: (g / 255).toFixed(4),
    bFloat: (b / 255).toFixed(4),
    r255: r,
    g255: g,
    b255: b,
    label: colorLabel,
    matName: `mat_${colorLabel}_${clean}`,
    slotPriority,
  };
}

/**
 * Dilimleyicilerde (Bambu Studio, OrcaSlicer, PrusaSlicer) üst üste binen parçalarda
 * kabartma detayların (Arma, Yıldızlar, Puma, Ön/Arka Yazılar) gövde tarafından yutulmaması için
 * Boolean öncelik sırasını belirler (Büyük değer = En üst katman / En yüksek öncelik).
 */
function getPartLayerPriority(groupKey) {
  if (
    groupKey.startsWith('Taban_') ||
    groupKey.startsWith('Ic_Bolme_') ||
    groupKey.startsWith('Kalemlik_') ||
    groupKey.startsWith('Fotograflik_') ||
    groupKey.startsWith('Notluk_')
  ) {
    return 10;
  }
  if (
    groupKey.startsWith('Sort_Govde') ||
    groupKey.startsWith('Sol_Govde') ||
    groupKey.startsWith('Sag_Govde') ||
    groupKey.startsWith('Sol_Kol') ||
    groupKey.startsWith('Sag_Kol')
  ) {
    return 20;
  }
  if (
    groupKey.startsWith('Sol_Manset') ||
    groupKey.startsWith('Sag_Manset') ||
    groupKey.startsWith('Sol_Yaka') ||
    groupKey.startsWith('Sag_Yaka')
  ) {
    return 30;
  }
  if (groupKey.startsWith('Arma_Beyaz_Oval')) {
    return 40;
  }
  // En üst katman kabartma detaylar: Arma G/S harfleri, 5 Yıldız, Puma Logosu, Ön Sponsor, Arka İsim, 45 Numara ve Şort Yan Şeritleri / Numarası
  return 50;
}

/**
 * Sahnedeki görünür tüm mesh'leri Z-up (3D yazıcı koordinatı, Z=0 tablasına oturmuş)
 * dünya koordinatlarında üçgen dizisi ve renk bilgisi olarak toplar.
 */
export function collectColoredMeshesForPrint(rootObject) {
  const cloneRoot = rootObject.clone(true);

  // Önizleme kağıdını baskı modelinden çıkar
  const samplePaper = cloneRoot.getObjectByName('Notluk_Kagit_Blogu_Onizleme');
  if (samplePaper && samplePaper.parent) {
    samplePaper.parent.remove(samplePaper);
  }

  // Y-up -> Z-up dönüşümü için sarmalayıcı grup
  const wrapper = new THREE.Group();
  const zUpGroup = new THREE.Group();
  cloneRoot.scale.set(1, 1, 1);
  cloneRoot.rotation.set(0, 0, 0);
  cloneRoot.position.set(0, 0, 0);

  zUpGroup.add(cloneRoot);
  zUpGroup.rotation.set(Math.PI / 2, 0, 0);
  wrapper.add(zUpGroup);
  wrapper.updateMatrixWorld(true);

  // Z=0 tablasına oturt ve X,Y merkezle
  const totalBox = new THREE.Box3().setFromObject(wrapper);
  if (!totalBox.isEmpty()) {
    const cx = (totalBox.min.x + totalBox.max.x) * 0.5;
    const cy = (totalBox.min.y + totalBox.max.y) * 0.5;
    const minZ = totalBox.min.z;
    zUpGroup.position.set(-cx, -cy, -minZ);
    wrapper.updateMatrixWorld(true);
  }

  const groupedEntries = new Map();
  const rawColorsMap = new Map();

  cloneRoot.traverse((node) => {
    if (!node.isMesh || !node.visible || !node.geometry) return;

    const parentName = node.parent && node.parent !== cloneRoot ? node.parent.name : '';
    const rawName = node.name || 'Parca';

    const isNegative =
      parentName === 'Sirt_Gomme_Yazisi' ||
      rawName.startsWith('Gomme_Harf_') ||
      rawName === 'Sirt_Gomme_Yazisi';

    const mat = Array.isArray(node.material) ? node.material[0] : node.material;
    const hex = mat && mat.color ? mat.color.getHexString().toUpperCase() : 'CCCCCC';
    const baseColorInfo = getColorPaletteInfo(hex);

    if (!isNegative && !rawColorsMap.has(baseColorInfo.hex)) {
      rawColorsMap.set(baseColorInfo.hex, baseColorInfo);
    }

    // Aynı ebeveyn altındaki aynı renkli harfleri/yıldızları anlamlı tek bir parça altında topla
    let groupKey = rawName;
    if (isNegative) {
      groupKey = 'Sirt_Gomme_Yazisi';
    } else if (
      parentName === 'On_Yazi_Sponsor' ||
      parentName === 'Arka_Isim' ||
      parentName === 'Arka_Numara'
    ) {
      groupKey = `${parentName}_${baseColorInfo.label}`;
    } else if (parentName === 'Arma_ve_Yildizlar') {
      if (rawName.startsWith('Arma_Yildiz_')) {
        groupKey = `Arma_5_Yildiz_${baseColorInfo.label}`;
      } else if (rawName.startsWith('Arma_G_')) {
        groupKey = `Arma_G_Harfi_${baseColorInfo.label}`;
      } else {
        groupKey = `${rawName}_${baseColorInfo.label}`;
      }
    } else if (parentName === 'Futbol_Sortu_Grubu') {
      if (rawName.startsWith('Sort_Numara_')) {
        groupKey = `Sort_Numara_${baseColorInfo.label}`;
      } else {
        groupKey = `${rawName}_${baseColorInfo.label}`;
      }
    } else {
      groupKey = `${rawName}_${baseColorInfo.label}`;
    }

    if (!groupedEntries.has(groupKey)) {
      groupedEntries.set(groupKey, {
        name: groupKey,
        colorHex: baseColorInfo.hex,
        layerPriority: isNegative ? 999 : getPartLayerPriority(groupKey),
        isNegative: Boolean(isNegative),
        vertices: [],
        triangles: [],
      });
    }

    const entry = groupedEntries.get(groupKey);
    const geom = node.geometry;
    const posAttr = geom.attributes.position;
    if (!posAttr) return;

    const worldMatrix = node.matrixWorld;
    const vOffset = entry.vertices.length / 3;
    const vTemp = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vTemp.fromBufferAttribute(posAttr, i).applyMatrix4(worldMatrix);
      entry.vertices.push(vTemp.x, vTemp.y, vTemp.z);
    }

    if (geom.index) {
      const idxArr = geom.index.array;
      for (let i = 0; i < idxArr.length; i += 3) {
        entry.triangles.push(
          vOffset + idxArr[i],
          vOffset + idxArr[i + 1],
          vOffset + idxArr[i + 2]
        );
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        entry.triangles.push(vOffset + i, vOffset + i + 1, vOffset + i + 2);
      }
    }
  });

  // Renk paletini öncelik sırasına göre diz (Slot 1: Bordo, Slot 2: Turuncu, Slot 3: Beyaz, Slot 4: Sarı Yıldız, Slot 5: Siyah Taban)
  const sortedColors = Array.from(rawColorsMap.values()).sort(
    (a, b) => a.slotPriority - b.slotPriority
  );
  const paletteMap = new Map();
  const palette = sortedColors.map((col, idx) => {
    const fullCol = {
      ...col,
      paletteIdx: idx, // 0-based index for 3MF basematerials
      extruderSlot: idx + 1, // 1-based filament slot for Bambu AMS / Prusa MMU
    };
    paletteMap.set(col.hex, fullCol);
    return fullCol;
  });

  // Parçaları Boolean katman önceliğine göre sırala (Önce gövde, en son yıldızlar/arma/yazılar)
  const parts = Array.from(groupedEntries.values())
    .filter((p) => p.triangles.length > 0)
    .map((p) => ({
      ...p,
      colorInfo: paletteMap.get(p.colorHex) || palette[0] || { paletteIdx: 0, extruderSlot: 1 },
    }))
    .sort((a, b) => a.layerPriority - b.layerPriority);

  return {
    parts,
    palette,
  };
}

/**
 * Bambu Studio / OrcaSlicer (`paint_color`) ve PrusaSlicer (`slic3rpe:mmu_segmentation`)
 * üçgen boyama (TriangleSelector nibble) kodunu üretir.
 * slot: 1-tabanlı filament/ekstruder numarası (1, 2, 3, 4, 5...)
 */
function getBambuPaintCode(slot) {
  const s = Math.max(1, Math.min(15, Number(slot) || 1));
  if (s === 1) return '4';
  if (s === 2) return '8';
  const hiNibble = (s - 3).toString(16).toUpperCase();
  return `${hiNibble}C`;
}

/**
 * Bambu Studio, OrcaSlicer, PrusaSlicer, Cura ve Windows 3D Viewer ile %100 uyumlu,
 * her rengin ve her kabartma detayın (Yıldızlar, Arma, Puma, Ön/Arka Yazılar) ayrı alt-parça
 * olarak tanımlandığı, hem standart 3MF (`basematerials`), hem `paint_color` / `mmu_segmentation`,
 * hem de `Metadata/model_settings.config` + `Metadata/project_settings.config` içeren tam renkli .3mf paketi üretir.
 */
export async function generateColored3MFBlob(rootObject, modelTitle = 'Forma_Kalemlik') {
  const { parts, palette } = collectColoredMeshesForPrint(rootObject);
  const zip = new JSZip();

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
  <Default Extension="config" ContentType="text/xml" />
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;
  zip.file('_rels/.rels', relsXml);

  // 3. 3D/3dmodel.model
  const xmlLines = [];
  xmlLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xmlLines.push(
    `<model unit="millimeter" xml:lang="tr-TR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">`
  );
  xmlLines.push(`  <metadata name="Title">${modelTitle}</metadata>`);
  xmlLines.push(`  <metadata name="Application">Sakrad3D_Studio</metadata>`);
  xmlLines.push(`  <resources>`);

  // Renk Paleti: Core 3MF <basematerials id="1">
  xmlLines.push(`    <basematerials id="1">`);
  for (const col of palette) {
    xmlLines.push(
      `      <base name="${col.label}_${col.hex}" displaycolor="${col.displayColor}" />`
    );
  }
  xmlLines.push(`    </basematerials>`);

  // Her parçayı bağımsız bir <object> olarak tanımla:
  // Böylece gövde ile kesişen Yıldızlar, Arma, Puma, Ön ve Arka Yazılar dilimleyicide asla gövde rengine yutulmaz!
  const partObjectIds = [];
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const objId = idx + 2; // id=1 basematerials için ayrıldı
    partObjectIds.push({ objId, part });

    const pIdx = part.colorInfo ? part.colorInfo.paletteIdx : 0;
    const paintCode = part.colorInfo ? getBambuPaintCode(part.colorInfo.extruderSlot) : '4';

    if (part.isNegative) {
      xmlLines.push(
        `    <object id="${objId}" name="${part.name}" type="model">`
      );
    } else {
      xmlLines.push(
        `    <object id="${objId}" name="${part.name}" type="model" pid="1" pindex="${pIdx}">`
      );
    }
    xmlLines.push(`      <mesh>`);
    xmlLines.push(`        <vertices>`);

    const verts = part.vertices;
    for (let v = 0; v < verts.length; v += 3) {
      xmlLines.push(
        `          <vertex x="${verts[v].toFixed(4)}" y="${verts[v + 1].toFixed(4)}" z="${verts[v + 2].toFixed(4)}" />`
      );
    }

    xmlLines.push(`        </vertices>`);
    xmlLines.push(`        <triangles>`);

    const tris = part.triangles;
    for (let t = 0; t < tris.length; t += 3) {
      if (part.isNegative) {
        xmlLines.push(
          `          <triangle v1="${tris[t]}" v2="${tris[t + 1]}" v3="${tris[t + 2]}" />`
        );
      } else {
        xmlLines.push(
          `          <triangle v1="${tris[t]}" v2="${tris[t + 1]}" v3="${tris[t + 2]}" pid="1" p1="${pIdx}" paint_color="${paintCode}" slic3rpe:mmu_segmentation="${paintCode}" />`
        );
      }
    }

    xmlLines.push(`        </triangles>`);
    xmlLines.push(`      </mesh>`);
    xmlLines.push(`    </object>`);
  }

  // Tüm alt parçaları tek bir birleşik Assembly <object> altında topla
  const assemblyObjId = parts.length + 2;
  xmlLines.push(
    `    <object id="${assemblyObjId}" name="${modelTitle}" type="model">`
  );
  xmlLines.push(`      <components>`);
  for (const item of partObjectIds) {
    xmlLines.push(`        <component objectid="${item.objId}" />`);
  }
  xmlLines.push(`      </components>`);
  xmlLines.push(`    </object>`);

  xmlLines.push(`  </resources>`);
  xmlLines.push(`  <build>`);
  xmlLines.push(`    <item objectid="${assemblyObjId}" />`);
  xmlLines.push(`  </build>`);
  xmlLines.push(`</model>`);

  zip.file('3D/3dmodel.model', xmlLines.join('\n'));

  // 4. Metadata/model_settings.config (Bambu Studio / OrcaSlicer / PrusaSlicer parça-extruder eşleşmesi)
  const settingsLines = [];
  settingsLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  settingsLines.push(`<config>`);
  settingsLines.push(`  <object id="${assemblyObjId}">`);
  settingsLines.push(`    <metadata key="name" value="${modelTitle}"/>`);
  settingsLines.push(`    <metadata key="extruder" value="1"/>`);
  for (const item of partObjectIds) {
    if (item.part.isNegative) {
      settingsLines.push(`    <part id="${item.objId}" subtype="negative_part">`);
      settingsLines.push(`      <metadata key="name" value="${item.part.name}"/>`);
      settingsLines.push(`    </part>`);
    } else {
      const extSlot = item.part.colorInfo ? item.part.colorInfo.extruderSlot : 1;
      settingsLines.push(`    <part id="${item.objId}" subtype="normal_part">`);
      settingsLines.push(`      <metadata key="name" value="${item.part.name}"/>`);
      settingsLines.push(`      <metadata key="extruder" value="${extSlot}"/>`);
      settingsLines.push(`    </part>`);
    }
  }
  settingsLines.push(`  </object>`);
  settingsLines.push(`</config>`);
  zip.file('Metadata/model_settings.config', settingsLines.join('\n'));

  // 5. Metadata/project_settings.config (Bambu Studio / OrcaSlicer otomatik filament renk paleti ve ince duvar algılama)
  const filamentColors = palette.map((c) => c.cssHex);
  const projectConfig = {
    filament_colour: filamentColors,
    filament_type: palette.map(() => 'PLA'),
    detect_thin_wall: '1',
    wall_generator: 'arachne',
  };
  zip.file('Metadata/project_settings.config', JSON.stringify(projectConfig, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Hem `usemtl` materyal bağlantılı (.obj + .mtl) hem de her köşe noktasında (vertex)
 * `v x y z r g b` renk kodları gömülü olan gerçek renkli OBJ + MTL metinlerini üretir.
 */
export function generateTrueColoredOBJAndMTL(rootObject, mtlFilename = 'model.mtl') {
  const { parts, palette } = collectColoredMeshesForPrint(rootObject);

  // 1. MTL İçeriği
  const mtlLines = [
    `# Sakrad 3D Studio - Gercek Renkli Materyal Kutuphanesi`,
    `# Renk sayisi: ${palette.length}`,
    ``,
  ];
  for (const col of palette) {
    mtlLines.push(`newmtl ${col.matName}`);
    mtlLines.push(`Ka ${col.rFloat} ${col.gFloat} ${col.bFloat}`);
    mtlLines.push(`Kd ${col.rFloat} ${col.gFloat} ${col.bFloat}`);
    mtlLines.push(`Ks 0.1500 0.1500 0.1500`);
    mtlLines.push(`Ns 32.0`);
    mtlLines.push(`d 1.0`);
    mtlLines.push(`illum 2`);
    mtlLines.push(``);
  }

  // 2. OBJ İçeriği (Hem usemtl hem de v x y z r g b vertex color destekli!)
  const objLines = [
    `# Sakrad 3D Studio - Gercek Renkli 3D Model (MTL + Vertex Color)`,
    `mtllib ${mtlFilename}`,
    ``,
  ];

  let globalVertexOffset = 1; // OBJ 1-tabanlı indeks kullanır
  for (const part of parts) {
    const col = part.colorInfo;
    objLines.push(`o ${part.name}`);
    objLines.push(`g ${part.name}`);
    objLines.push(`usemtl ${col.matName}`);

    const verts = part.vertices;
    for (let v = 0; v < verts.length; v += 3) {
      objLines.push(
        `v ${verts[v].toFixed(4)} ${verts[v + 1].toFixed(4)} ${verts[v + 2].toFixed(4)} ${col.rFloat} ${col.gFloat} ${col.bFloat}`
      );
    }

    const tris = part.triangles;
    for (let t = 0; t < tris.length; t += 3) {
      const i1 = globalVertexOffset + tris[t];
      const i2 = globalVertexOffset + tris[t + 1];
      const i3 = globalVertexOffset + tris[t + 2];
      objLines.push(`f ${i1} ${i2} ${i3}`);
    }
    objLines.push(``);
    globalVertexOffset += verts.length / 3;
  }

  return {
    objContent: objLines.join('\n'),
    mtlContent: mtlLines.join('\n'),
    palette,
    partsCount: parts.length,
  };
}

/**
 * Binary STL(Uint8Array) içine VisCAM / SolidView / Materialise standartlarında
 * 80-byte başlık COLOR=RGBA ve her üçgenin sonundaki 2-byte attribute alanına 15-bit RGB renk kodu yazar.
 */
export function injectColorIntoBinarySTL(stlBytes, hexColorStr) {
  if (!stlBytes || stlBytes.byteLength < 84) return stlBytes;
  const info = getColorPaletteInfo(hexColorStr);
  const out = new Uint8Array(stlBytes.byteLength);
  out.set(stlBytes);

  // 80-byte header: "COLOR=" + 4 byte RGBA
  const headerPrefix = `Sakrad3D_${info.label}_#${info.hex} `;
  for (let i = 0; i < 70; i++) {
    out[i] = i < headerPrefix.length ? headerPrefix.charCodeAt(i) : 0x20;
  }
  // Byte 70..79: "COLOR=" + R, G, B, A
  const colTag = 'COLOR=';
  for (let i = 0; i < 6; i++) {
    out[70 + i] = colTag.charCodeAt(i);
  }
  out[76] = info.r255;
  out[77] = info.g255;
  out[78] = info.b255;
  out[79] = 255;

  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const triCount = view.getUint32(80, true);

  // 15-bit RGB attribute: bit 15 = 1 (valid color), bits 10..14 = R, bits 5..9 = G, bits 0..4 = B
  const r5 = (info.r255 >> 3) & 0x1f;
  const g5 = (info.g255 >> 3) & 0x1f;
  const b5 = (info.b255 >> 3) & 0x1f;
  const attrColor = 0x8000 | (r5 << 10) | (g5 << 5) | b5;

  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    if (offset + 50 > out.byteLength) break;
    view.setUint16(offset + 48, attrColor, true);
    offset += 50;
  }

  return out;
}
