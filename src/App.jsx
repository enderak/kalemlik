import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import CastlePencilCase from './components/organisms/CastlePencilCase';
import NamePencilCase from './components/organisms/NamePencilCase';
import JerseyPencilCase, { TEAM_PRESETS } from './components/organisms/JerseyPencilCase';
import MedicalPencilCase, { MEDICAL_ROLES } from './components/organisms/MedicalPencilCase';
import PhotoStand from './components/organisms/PhotoStand';
import NoteHolder from './components/organisms/NoteHolder';
import { useTranslation } from 'react-i18next';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import JSZip from 'jszip';
import * as THREE from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  generateColored3MFBlob,
  generateTrueColoredOBJAndMTL,
  injectColorIntoBinarySTL,
} from './utils/exportColored3MF';

const SCALE = 0.05;

const AVAILABLE_FONTS = [
  { name: 'DIN Mittelschrift Std', value: 'DINMittelschriftStd.json' },
  { name: 'JetBrains Mono Bold', value: 'JetBrainsMono-Bold.json' },
  { name: 'Pacifico', value: 'Pacifico-Regular.json' },
  { name: 'Allura', value: 'Allura-Regular.json' },
  { name: 'Great Vibes', value: 'GreatVibes-Regular.json' },
  { name: 'Plus Jakarta Sans Bold', value: 'Plus_Jakarta_Sans_Bold.json' },
  { name: 'Orbitron Bold', value: 'orbitron_bold.typeface.json' },
  { name: 'Helvetica Regular', value: 'helvetiker_regular.typeface.json' },
  { name: 'Optimer Bold', value: 'optimer_bold.typeface.json' },
];

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  }, 100);
}

const App = () => {
  const { t, i18n } = useTranslation();

  const [mode, setMode] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get('mode');
      if (m) return m;
      const saved = localStorage.getItem('kalemlik_mode');
      if (saved) return saved;
    } catch (e) {}
    return 'medical';
  });

  useEffect(() => {
    try {
      localStorage.setItem('kalemlik_mode', mode);
    } catch (e) {}
  }, [mode]);

  // Castle specific states
  const [shape, setShape] = useState('cylinder');
  const [outerDiameter, setOuterDiameter] = useState(100);
  const [outerSize, setOuterSize] = useState(100);
  const [height, setHeight] = useState(150);
  const [wallThickness, setWallThickness] = useState(4);
  const [bottomThickness, setBottomThickness] = useState(4);
  const [baseHeight, setBaseHeight] = useState(8);
  const [baseExtension, setBaseExtension] = useState(6);
  const [topExtension, setTopExtension] = useState(8);
  const [corniceHeight, setCorniceHeight] = useState(20);
  const [corniceChamfer, setCorniceChamfer] = useState(0.5);
  const [showBrickTexture, setShowBrickTexture] = useState(true);
  const [numBricksHeight, setNumBricksHeight] = useState(24);
  const [numBricksCircumference, setNumBricksCircumference] = useState(50);
  const [numBricksLength, setNumBricksLength] = useState(2);
  const [embossedBricks, setEmbossedBricks] = useState(true);
  const [brickDepth, setBrickDepth] = useState(3);
  const [numCrenellations, setNumCrenellations] = useState(16);
  const [crenellationHeight, setCrenellationHeight] = useState(24);
  const [crenellationWidth, setCrenellationWidth] = useState(1);
  const [hasDoor, setHasDoor] = useState(true);
  const [hasWindows, setHasWindows] = useState(true);
  const [doorWidth, setDoorWidth] = useState(8);
  const [doorHeight, setDoorHeight] = useState(30);
  const [doorRecess, setDoorRecess] = useState(5);
  const [windowWidth, setWindowWidth] = useState(6);
  const [windowHeight, setWindowHeight] = useState(12);
  const [windowRecess, setWindowRecess] = useState(3);
  const [numWindows, setNumWindows] = useState(6);
  const [windowArched, setWindowArched] = useState(true);
  const [hasTowers, setHasTowers] = useState(false);
  const [towerRadius, setTowerRadius] = useState(15);
  const [towerHeight, setTowerHeight] = useState(35);
  const [towerCrenellations, setTowerCrenellations] = useState(6);

  // Name Pencil Case states
  const [text, setText] = useState('ENDER');
  const [fontName, setFontName] = useState('DINMittelschriftStd.json');
  const [fontSize, setFontSize] = useState(18);
  const [textDepth, setTextDepth] = useState(2);
  const [reliefType, setReliefType] = useState('emboss');
  const [materialColor, setMaterialColor] = useState('#F8FAFC');

  // Photo Stand states
  const [hasPhotoStand, setHasPhotoStand] = useState(false);
  const [photoWidth, setPhotoWidth] = useState(70);
  const [photoHeight, setPhotoHeight] = useState(100);
  const [photoDistance, setPhotoDistance] = useState(0);
  const [photoOffset, setPhotoOffset] = useState(0);
  const [photoTilt, setPhotoTilt] = useState(5);
  const [photoStandPosition, setPhotoStandPosition] = useState('side'); // 'side' | 'front' | 'back'
  const [photoSide, setPhotoSide] = useState('right'); // 'right' | 'left'
  const [standFrameWidth, setStandFrameWidth] = useState(4);
  const [standFrameDepth, setStandFrameDepth] = useState(6);
  const [photoSlotDepth, setPhotoSlotDepth] = useState(2.5);
  const [photoBackThickness, setPhotoBackThickness] = useState(2.0);
  const [photoOnlyEdges, setPhotoOnlyEdges] = useState(false);
  const [photoHasTopEdge, setPhotoHasTopEdge] = useState(false);
  const [photoHasCrenellations, setPhotoHasCrenellations] = useState(false);
  const [photoNumCrenellations, setPhotoNumCrenellations] = useState(8);
  const [photoCrenellationHeight, setPhotoCrenellationHeight] = useState(6);
  const [photoCrenellationAlignment, setPhotoCrenellationAlignment] = useState('center');

  // NoteHolder states
  const [hasNoteHolder, setHasNoteHolder] = useState(false);
  const [notePosition, setNotePosition] = useState('side'); // 'side' | 'front' | 'back'
  const [noteSide, setNoteSide] = useState('right'); // 'right' | 'left'
  const [noteWidth, setNoteWidth] = useState(82);
  const [noteDepth, setNoteDepth] = useState(82);
  const [noteHeight, setNoteHeight] = useState(30);
  const [noteWallThickness, setNoteWallThickness] = useState(3.2);
  const [noteDistance, setNoteDistance] = useState(0);
  const [noteOffset, setNoteOffset] = useState(0);
  const [hasThumbCutout, setHasThumbCutout] = useState(true);
  const [thumbCutoutWidth, setThumbCutoutWidth] = useState(34);
  const [thumbCutoutDepth, setThumbCutoutDepth] = useState(18);
  const [noteColor, setNoteColor] = useState('#1E293B');
  const [showSamplePaper, setShowSamplePaper] = useState(true);
  const [modelElevation, setModelElevation] = useState(0);

  // Jersey specific states
  const [jerseyTeam, setJerseyTeam] = useState('sari_kirmizi');
  const [jerseyPattern, setJerseyPattern] = useState('parcali');
  const [jerseyPrimaryColor, setJerseyPrimaryColor] = useState('#82001C');
  const [jerseySecondaryColor, setJerseySecondaryColor] = useState('#F37021');
  const [jerseyAccentColor, setJerseyAccentColor] = useState('#1A1A1A');
  const [jerseyTextColor, setJerseyTextColor] = useState('#FFFFFF');
  const [jerseyTorsoWidth, setJerseyTorsoWidth] = useState(81);
  const [jerseyTorsoDepth, setJerseyTorsoDepth] = useState(46);
  const [jerseyHeight, setJerseyHeight] = useState(115);
  const [jerseyWallThickness, setJerseyWallThickness] = useState(3.5);
  const [jerseyBottomThickness, setJerseyBottomThickness] = useState(4.0);
  const [jerseyCornerRadius, setJerseyCornerRadius] = useState(12);
  const [hasSponsor, setHasSponsor] = useState(true);
  const [frontText, setFrontText] = useState('ŞAMPİYON');
  const [frontTextHeight, setFrontTextHeight] = useState(7.5);
  const [frontTextDepth, setFrontTextDepth] = useState(0.8);
  const [frontTextElevation, setFrontTextElevation] = useState(58);
  const [hasFrontNumber, setHasFrontNumber] = useState(false);
  const [frontNumber, setFrontNumber] = useState('10');
  const [frontNumberHeight, setFrontNumberHeight] = useState(13);
  const [hasBadge, setHasBadge] = useState(true);
  const [badgeText, setBadgeText] = useState('SK');
  const [stars, setStars] = useState(5);
  const [badgeElevation, setBadgeElevation] = useState(86);
  const [hasBackName, setHasBackName] = useState(true);
  const [backName, setBackName] = useState('TARAFTAR');
  const [backNameHeight, setBackNameHeight] = useState(8);
  const [backNameDepth, setBackNameDepth] = useState(0.8);
  const [backNameElevation, setBackNameElevation] = useState(95);
  const [hasBackNumber, setHasBackNumber] = useState(true);
  const [backNumber, setBackNumber] = useState('10');
  const [backNumberHeight, setBackNumberHeight] = useState(35);
  const [backNumberDepth, setBackNumberDepth] = useState(1.0);
  const [backNumberElevation, setBackNumberElevation] = useState(63);
  const [hasShorts, setHasShorts] = useState(true);
  const [shortsColor, setShortsColor] = useState('#F4F4F6');
  const [jerseyFontName, setJerseyFontName] = useState('DINMittelschriftStd.json');
  const [hasJerseyDivider, setHasJerseyDivider] = useState(false);
  const [jerseyCollarType, setJerseyCollarType] = useState('crew');
  const [hasJerseyTextSupport, setHasJerseyTextSupport] = useState(true);
  const [jerseySleeveAngle, setJerseySleeveAngle] = useState(24);
  const [jerseyTextSupportAngle, setJerseyTextSupportAngle] = useState(45);
  const [jerseyBaseShape, setJerseyBaseShape] = useState('rectangle');
  const [jerseyBaseThickness, setJerseyBaseThickness] = useState(3.0);
  const [jerseyBaseWidth, setJerseyBaseWidth] = useState(58);
  const [jerseyBaseDepth, setJerseyBaseDepth] = useState(37);
  const [jerseyBaseCornerRadius, setJerseyBaseCornerRadius] = useState(10);
  const [jerseyBaseColor, setJerseyBaseColor] = useState('#18181B');

  const handleJerseyTeamChange = (teamKey) => {
    const p = TEAM_PRESETS[teamKey] || TEAM_PRESETS.sari_kirmizi;
    if (!p) return;
    setJerseyTeam(p.id);
    setJerseyPattern(p.pattern);
    setJerseyPrimaryColor(p.primaryColor);
    setJerseySecondaryColor(p.secondaryColor);
    setJerseyAccentColor(p.accentColor);
    setJerseyTextColor(p.textColor);
    setFrontText(p.defaultFrontText);
    setFrontNumber(p.defaultFrontNumber || '10');
    setBackName(p.defaultBackName);
    setBackNumber(p.defaultBackNumber);
    setBadgeText(p.badgeText);
    setStars(p.stars);
  };

  // 🩺 Medical (Sağlıkçı) specific states (Tıbbi Sekreter / Doktor / Hemşire)
  const [medicalRole, setMedicalRole] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const r = sp.get('role');
      if (r && MEDICAL_ROLES[r]) return r;
    }
    return 'secretary';
  });
  const [medicalCoatColor, setMedicalCoatColor] = useState('#FFFFFF');
  const [medicalCollarColor, setMedicalCollarColor] = useState('#FFFFFF');
  const [medicalInnerShirtColor, setMedicalInnerShirtColor] = useState(() => {
    const r = MEDICAL_ROLES[medicalRole];
    return (r && r.innerShirtColor) || '#E2E8F0';
  });
  const [medicalButtonColor, setMedicalButtonColor] = useState('#334155');
  const [medicalTextColor, setMedicalTextColor] = useState('#0F172A');
  const [medicalStethoscopeColor, setMedicalStethoscopeColor] = useState('#0F172A');
  const [medicalCoatWidth, setMedicalCoatWidth] = useState(82);
  const [medicalCoatDepth, setMedicalCoatDepth] = useState(50);
  const [medicalCavityWidth, setMedicalCavityWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const cw = Number(sp.get('cavityWidth'));
      if (cw > 0) return cw;
    }
    return 54;
  });
  const [medicalCavityDepth, setMedicalCavityDepth] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const cd = Number(sp.get('cavityDepth'));
      if (cd > 0) return cd;
    }
    return 42;
  });
  const [medicalHeight, setMedicalHeight] = useState(118);
  const [medicalCollarOpeningWidth, setMedicalCollarOpeningWidth] = useState(28);
  const [medicalWallThickness, setMedicalWallThickness] = useState(2.2);
  const [medicalBottomThickness, setMedicalBottomThickness] = useState(4.0);
  const [medicalBaseShape, setMedicalBaseShape] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const bs = sp.get('baseShape');
      if (bs === 'rectangle' || bs === 'square' || bs === 'circle' || bs === 'ellipse') {
        return bs;
      }
    }
    return 'rectangle';
  });
  const [medicalBaseWidth, setMedicalBaseWidth] = useState(88);
  const [medicalBaseDepth, setMedicalBaseDepth] = useState(58);
  const [medicalBaseThickness, setMedicalBaseThickness] = useState(3.8);
  const [medicalBaseCornerRadius, setMedicalBaseCornerRadius] = useState(12);
  const [medicalBaseColor, setMedicalBaseColor] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const bc = sp.get('baseColor');
      if (bc) return '#' + bc.replace(/^#/, '');
    }
    return '#1E293B';
  });
  const [medicalBackText, setMedicalBackText] = useState('SYDH\nTIBBİ\nSEKRETER');
  const [medicalBackTextStyle, setMedicalBackTextStyle] = useState(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get('style');
      if (s === 'plate' || s === 'engrave' || s === 'emboss') return s;
    }
    return 'plate';
  });
  const [medicalPlateColor, setMedicalPlateColor] = useState('#FFFFFF');
  const [medicalBackTextHeight, setMedicalBackTextHeight] = useState(7.0);
  const [medicalBackTextDepth, setMedicalBackTextDepth] = useState(1.0);
  const [medicalBackTextElevation, setMedicalBackTextElevation] = useState(64);
  const [medicalFrontText, setMedicalFrontText] = useState('TIBBİ SEKRETER');
  const [medicalFrontTextHeight, setMedicalFrontTextHeight] = useState(4.8);
  const [medicalFrontTextDepth, setMedicalFrontTextDepth] = useState(0.8);
  const [medicalFrontTextElevation, setMedicalFrontTextElevation] = useState(70);
  const [medicalFontName, setMedicalFontName] = useState('DINMittelschriftStd.json');

  const handleMedicalRoleChange = (roleKey) => {
    const r = MEDICAL_ROLES[roleKey];
    if (!r) return;
    setMedicalRole(roleKey);
    setMedicalCoatColor(r.coatColor);
    setMedicalCollarColor(r.collarColor);
    setMedicalInnerShirtColor(r.innerShirtColor || '#E2E8F0');
    setMedicalButtonColor(r.buttonColor);
    setMedicalTextColor(r.textColor);
    setMedicalFrontText(r.defaultFrontText);
    setMedicalBackText(r.defaultBackText);
  };

  // Status and export notification
  const [statusMsg, setStatusMsg] = useState('');

  // Refs
  const groupRef = useRef(null);
  const mainGroupRef = useRef(null);
  const standRef = useRef(null);
  const noteHolderRef = useRef(null);
  const jerseyGroupRef = useRef(null);
  const medicalGroupRef = useRef(null);

  // Detached clone in exact 1:1 millimeter space (bypassing 0.05 viewport parent scale), Z-up & seated at Z=0
  const buildPrintReadyBinarySTL = (targetGroup) => {
    if (!targetGroup) return null;
    const exporter = new STLExporter();
    const cloneRoot = targetGroup.clone(true);

    const samplePaper = cloneRoot.getObjectByName('Notluk_Kagit_Blogu_Onizleme');
    if (samplePaper && samplePaper.parent) {
      samplePaper.parent.remove(samplePaper);
    }

    const wrapper = new THREE.Group();
    const zUpGroup = new THREE.Group();
    cloneRoot.scale.set(1, 1, 1);
    cloneRoot.rotation.set(0, 0, 0);
    cloneRoot.position.set(0, 0, 0);

    zUpGroup.add(cloneRoot);
    zUpGroup.rotation.set(Math.PI / 2, 0, 0);
    wrapper.add(zUpGroup);
    wrapper.updateMatrixWorld(true);

    const totalBox = new THREE.Box3().setFromObject(wrapper);
    if (!totalBox.isEmpty()) {
      const centerX = (totalBox.min.x + totalBox.max.x) * 0.5;
      const centerY = (totalBox.min.y + totalBox.max.y) * 0.5;
      const minZ = totalBox.min.z;
      zUpGroup.position.set(-centerX, -centerY, -minZ);
      wrapper.updateMatrixWorld(true);
    }

    return exporter.parse(wrapper, { binary: true });
  };

  // Helper for single STL export of any mesh/group in true millimeter dimensions
  const exportGroupToSTL = (targetGroup, defaultFilename) => {
    const result = buildPrintReadyBinarySTL(targetGroup);
    if (!result) return;
    const blob = new Blob([result], { type: 'application/octet-stream' });
    downloadBlob(blob, defaultFilename);
  };

  // 1. Genel Tek Parça STL İndirme
  const handleExport = () => {
    const activeGroup =
      mode === 'medical'
        ? medicalGroupRef.current
        : mode === 'jersey'
        ? jerseyGroupRef.current
        : groupRef.current;

    if (!activeGroup) return;

    let filename = '';
    if (mode === 'medical') {
      filename = `Saglikci_${medicalRole.toUpperCase()}_Kalemlik_${Date.now()}.stl`;
    } else if (mode === 'jersey') {
      filename = `${jerseyTeam.toUpperCase()}_FormaKalemlik_${backName.trim() || 'forma'}_${backNumber.trim() || 'numara'}_${Date.now()}.stl`;
    } else if (mode === 'name') {
      filename = `IsimKalemlik_${text.trim() || 'isim'}_${outerDiameter}x${height}_${Date.now()}.stl`;
    } else {
      const sizeLabel = shape === 'cylinder' ? outerDiameter : `${outerSize}x${outerSize}`;
      filename = `KaleKalemlik_${sizeLabel}x${height}_${Date.now()}.stl`;
    }

    exportGroupToSTL(activeGroup, filename);
  };

  // 2. Fotoğraflık Standı STL
  const handleExportStand = () => {
    if (!standRef.current) return;
    exportGroupToSTL(standRef.current, `FotoTutacagi_${photoWidth}x${photoHeight}_${Date.now()}.stl`);
  };

  // 3. Notluk Standı STL
  const handleExportNoteHolder = () => {
    if (!noteHolderRef.current) return;
    exportGroupToSTL(noteHolderRef.current, `Standart_Notluk_${noteWidth}x${noteDepth}_${Date.now()}.stl`);
  };

  // 4. Kalemlik + Çerçeve Tek Parça Bir Arada STL Export
  const handleExportCombined = () => {
    const targetGroup = mainGroupRef.current;
    if (!targetGroup) return;
    exportGroupToSTL(targetGroup, `Kalemlik_Kombine_Model_${Date.now()}.stl`);
  };

  // 5. Bambu AMS Çok Renkli .3MF Dışa Aktarma (Medical & Jersey)
  const handleExport3MF = async () => {
    const targetGroup =
      mode === 'medical'
        ? medicalGroupRef.current
        : mode === 'jersey'
        ? jerseyGroupRef.current
        : mainGroupRef.current || groupRef.current;

    if (!targetGroup) return;

    try {
      setStatusMsg('Bambu Studio AMS 3MF dosyası hazırlanıyor...');
      const modelTitle =
        mode === 'medical'
          ? `Saglikci_${medicalRole.toUpperCase()}_Kalemlik`
          : mode === 'jersey'
          ? `${jerseyTeam.toUpperCase()}_Forma_Kalemlik`
          : 'Kalemlik_Modeli';

      const blob = await generateColored3MFBlob(targetGroup, modelTitle);
      downloadBlob(blob, `${modelTitle}_BambuAMS_${Date.now()}.3mf`);
      setStatusMsg('');
    } catch (err) {
      console.error('3MF Export hatası:', err);
      setStatusMsg('3MF dışa aktarılırken hata oluştu.');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  // 6. No-AMS Parçalı Çok Renkli ZIP Paketi (Tek renkli yazıcılar için)
  const handleExportNoAMSZip = async () => {
    const targetGroup =
      mode === 'medical'
        ? medicalGroupRef.current
        : mode === 'jersey'
        ? jerseyGroupRef.current
        : groupRef.current;

    if (!targetGroup) return;

    try {
      setStatusMsg('No-AMS parçalı ZIP paketi hazırlanıyor...');
      const exporter = new STLExporter();
      const zip = new JSZip();

      const modelPrefix =
        mode === 'medical'
          ? `Saglikci_${medicalRole.toUpperCase()}`
          : mode === 'jersey'
          ? `${jerseyTeam.toUpperCase()}_Forma`
          : 'Kalemlik';

      // Tam renkli 3MF ve OBJ dosyasını da pakete ekle
      const full3mfBlob = await generateColored3MFBlob(targetGroup, `${modelPrefix}_TamModel`);
      zip.file(`00_RENKLI_TAM_MODEL_ONIZLEME_VE_BASKI.3mf`, full3mfBlob);

      const { objContent, mtlContent } = generateTrueColoredOBJAndMTL(targetGroup, '00_RENKLI_TAM_MODEL.mtl');
      zip.file(`00_RENKLI_TAM_MODEL.obj`, objContent);
      zip.file(`00_RENKLI_TAM_MODEL.mtl`, mtlContent);

      // Tek parça ham STL (1:1 gerçek milimetre)
      const fullSTL = buildPrintReadyBinarySTL(targetGroup);
      zip.file(`0_TAM_MODEL_TEK_PARCA.stl`, fullSTL);

      // Parçaları ayrı ayrı STL olarak çıkart
      const meshes = [];
      targetGroup.traverse((child) => {
        if (child.isMesh && child.visible && child.geometry) {
          meshes.push(child);
        }
      });

      meshes.forEach((mesh, idx) => {
        const tempGroup = new THREE.Group();
        const clone = mesh.clone(true);
        tempGroup.add(clone);
        tempGroup.scale.set(1, 1, 1);
        tempGroup.rotation.set(Math.PI / 2, 0, 0);
        tempGroup.updateMatrixWorld(true);

        const partSTL = exporter.parse(tempGroup, { binary: true });
        const safeName = (mesh.name || `Parca_${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        zip.file(`${idx + 1}_${safeName}.stl`, partSTL);
      });

      // Varsa ek modülleri de ekle
      if (hasNoteHolder && noteHolderRef.current) {
        const noteSTL = buildPrintReadyBinarySTL(noteHolderRef.current);
        zip.file(`90_NOTLUK_KUP_NOT_HAZNESI.stl`, noteSTL);
      }
      if (hasPhotoStand && standRef.current) {
        const standSTL = buildPrintReadyBinarySTL(standRef.current);
        zip.file(`91_FOTOGRAFLIK_CERCEVE.stl`, standSTL);
      }

      // Rehber kılavuzu
      const guideText = `========================================================================
${modelPrefix.toUpperCase()} KALEMLİK - NO-AMS (TEK RENKLI YAZICILAR) BASKI REHBERİ
========================================================================

NEDEN STL DOSYALARI DİLİMLEYİCİDE TEK RENK AÇILIR?
- Standart .STL formatı renk verisi içermez, dilimleyiciler varsayılan filament rengiyle açar.
- Modelin renklerini görmek veya çok renkli basmak için paketteki:
  -> "00_RENKLI_TAM_MODEL_ONIZLEME_VE_BASKI.3mf" veya
  -> "00_RENKLI_TAM_MODEL.obj"
  dosyasını açabilirsiniz.

SIRTTTAKİ HASTANE / KURUM YAZISI DESTEK DURUMU:
- Model üzerindeki tüm sırt yazıları dikey yüzeye 1.0mm kabartma olarak projeksiyonla yerleştirilmiştir.
- FDM dilimleyicilerde (Bambu Studio, Cura, PrusaSlicer) dikey duvar kabartmaları 
  100% DESTEKSİZ (SUPPORTLESS) basılabilir. Ekstra destek açmanıza gerek yoktur.
`;
      zip.file(`README_BASKI_REHBERI.txt`, guideText);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${modelPrefix}_Kalemlik_Parcali_Baski_Paketi_${Date.now()}.zip`);
      setStatusMsg('');
    } catch (err) {
      console.error('ZIP Export hatası:', err);
      setStatusMsg('ZIP paketi hazırlanırken hata oluştu.');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'TR' ? 'EN' : 'TR');
  };

  const modelRotationY = (() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const cam = sp.get('cam');
      if (cam === 'back') return Math.PI;
      if (cam === 'iso') return Math.PI / 4;
      if (cam === 'back_iso') return (5 * Math.PI) / 4;
    }
    return 0;
  })();

  const Slider = ({ label, value, onChange, min, max, step = 1 }) => {
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => {
      setLocalVal(value);
    }, [value]);

    return (
      <div className="mb-3">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1 gap-2">
          <span className="truncate pr-1">{label}</span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={localVal}
            onChange={(e) => {
              setLocalVal(e.target.value);
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) onChange(val);
            }}
            onBlur={() => {
              const val = parseFloat(localVal);
              if (isNaN(val)) {
                setLocalVal(value);
              } else {
                setLocalVal(val);
              }
            }}
            className="w-16 px-1.5 py-0.5 text-right font-bold text-amber-400 bg-slate-800/90 border border-slate-700/80 rounded focus:border-amber-500 focus:outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
        />
      </div>
    );
  };

  const baseShapeOptions = [
    { id: 'rectangle', label: '▭ Dikdörtgen' },
    { id: 'square', label: '⬜ Kare' },
    { id: 'circle', label: '⚪ Yuvarlak' },
    { id: 'ellipse', label: '⬭ Elips' },
  ];

  const renderBasePlateCard = ({
    baseShape,
    setBaseShape,
    baseWidth,
    setBaseWidth,
    baseDepth,
    setBaseDepth,
    baseCornerRadius,
    setBaseCornerRadius,
    baseThickness,
    setBaseThickness,
    minW,
    minD,
    minThick = 2.5,
    showElevation = false,
    baseColorVal,
    setBaseColorVal,
  }) => {
    const isEqualSides = baseShape === 'square' || baseShape === 'circle';
    const isRectOrSquare = baseShape === 'rectangle' || baseShape === 'square';
    const unifiedSize = Math.max(Number(baseWidth) || minW, Number(baseDepth) || minD);

    return (
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Alt Tabla (Taban Plakası)
        </h2>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">
            Taban Şekli:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {baseShapeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setBaseShape(opt.id);
                  if (opt.id === 'square' || opt.id === 'circle') {
                    setBaseWidth(unifiedSize);
                    setBaseDepth(unifiedSize);
                  }
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                  baseShape === opt.id
                    ? 'bg-amber-600/30 text-amber-400 border-amber-500/60 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isEqualSides ? (
          <Slider
            label={baseShape === 'circle' ? 'Taban Çapı (mm)' : 'Taban Kenar Uzunluğu (mm)'}
            value={unifiedSize}
            onChange={(val) => {
              setBaseWidth(val);
              setBaseDepth(val);
            }}
            min={minW}
            max={130}
            step={2}
          />
        ) : (
          <>
            <Slider
              label="Taban Genişliği (mm)"
              value={baseWidth}
              onChange={setBaseWidth}
              min={minW}
              max={130}
              step={2}
            />
            <Slider
              label="Taban Derinliği (mm)"
              value={baseDepth}
              onChange={setBaseDepth}
              min={minD}
              max={110}
              step={2}
            />
          </>
        )}

        {isRectOrSquare && (
          <Slider
            label="Köşe Yuvarlatma (mm)"
            value={baseCornerRadius}
            onChange={setBaseCornerRadius}
            min={0}
            max={28}
            step={1}
          />
        )}

        <Slider
          label="Taban Kalınlığı (mm)"
          value={baseThickness}
          onChange={setBaseThickness}
          min={minThick}
          max={8.0}
          step={0.5}
        />

        {showElevation && (
          <Slider
            label="Model Yükseltisi (mm)"
            value={modelElevation}
            onChange={setModelElevation}
            min={0}
            max={30}
            step={1}
          />
        )}

        {setBaseColorVal && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
            <span className="text-slate-400">Alt Tabla Rengi</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={baseColorVal}
                onChange={(e) => setBaseColorVal(e.target.value)}
                className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-300">{baseColorVal}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex flex-col font-sans text-white pb-24 md:pb-0">
      <header className="px-6 py-4 flex justify-between items-center w-full max-w-6xl mx-auto border-b border-slate-800">
        <h1 className="font-bold tracking-tight text-lg text-amber-400">
          {mode === 'medical'
            ? '🩺 ' + (t('mode_medical') || 'SAĞLIKÇI KALEMLİK').toLocaleUpperCase('tr-TR')
            : mode === 'jersey'
            ? '⚽ ' + (t('mode_jersey') || 'FORMA KALEMLİK').toLocaleUpperCase('tr-TR')
            : mode === 'name'
            ? '✏️ ' + t('mode_name').toLocaleUpperCase('tr-TR')
            : '🏰 ' + t('title')}
        </h1>
        <button
          onClick={toggleLang}
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full text-slate-300 transition-colors"
        >
          {i18n.language === 'TR' ? 'EN' : 'TR'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 px-4 sm:px-6 py-6">
        <div className="w-full md:w-80 shrink-0 space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          {/* DESIGN TYPE SELECTOR (4 MOD) */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-3 uppercase">
              {t('mode_selection')}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('medical')}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                  mode === 'medical'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                🩺 {t('mode_medical') || 'Sağlıkçı'}
              </button>
              <button
                type="button"
                onClick={() => setMode('jersey')}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                  mode === 'jersey'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                ⚽ {t('mode_jersey') || 'Forma'}
              </button>
              <button
                type="button"
                onClick={() => setMode('name')}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                  mode === 'name'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                ✏️ {t('mode_name') || 'İsimli'}
              </button>
              <button
                type="button"
                onClick={() => setMode('castle')}
                className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                  mode === 'castle'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                🏰 {t('mode_castle') || 'Kale'}
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 🩺 SAĞLIKÇI KALEMLİK AYARLARI (TIBBİ SEKRETER / DOKTOR / HEMŞİRE) */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === 'medical' && (
            <div className="space-y-4">
              {/* SAĞLIK MESLEK ROLÜ */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
                  <span>Sağlıkçı Rolü</span>
                  <span className="text-[10px] text-amber-500 font-normal">3 MODEL</span>
                </h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(MEDICAL_ROLES).map(([key, role]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleMedicalRoleChange(key)}
                      className={`py-2 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${
                        medicalRole === key
                          ? 'bg-amber-600/30 text-amber-400 border border-amber-500/60 shadow-md'
                          : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="text-sm">{role.icon}</span>
                      <span className="truncate w-full text-center">{role.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SIRT HASTANE / KURUM YAZISI */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
                  <span>Sırt Hastane Yazısı</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">DESTEKSİZ BASKI</span>
                </h2>

                {/* Yazı Üretim & Baskı Yöntemi */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                    Yazı Üretim & Baskı Yöntemi:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMedicalBackTextStyle('plate')}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        medicalBackTextStyle === 'plate'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center gap-1">
                        <span>🏷️</span> Ayrı Plaka
                      </div>
                      <div className="text-[9px] text-emerald-400 mt-0.5 font-semibold">
                        Sıfır AMS Atığı
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMedicalBackTextStyle('engrave')}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        medicalBackTextStyle === 'engrave'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center gap-1">
                        <span>🔲</span> Gömme / Oyma
                      </div>
                      <div className="text-[9px] text-cyan-400 mt-0.5 font-semibold">
                        Tek Renk Baskı
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMedicalBackTextStyle('emboss')}
                      className={`p-2 rounded-lg text-left transition-all border ${
                        medicalBackTextStyle === 'emboss'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="font-bold text-[11px] flex items-center gap-1">
                        <span>🎨</span> Kabartma
                      </div>
                      <div className="text-[9px] text-purple-400 mt-0.5 font-semibold">
                        AMS Çok Renk
                      </div>
                    </button>
                  </div>
                </div>

                {/* Mod Açıklaması */}
                {medicalBackTextStyle === 'plate' ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-[11px] text-emerald-300/90 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <span>💡 Ayrı İsimlik Plakası (Sıfır AMS Atığı & Hızlı Baskı)</span>
                    </div>
                    <div>
                      Yazı sırt üzerine takılan/yapıştırılan ayrı bir plaka olarak üretilir. Tabla üzerinde yatay basıldığı için yalnızca 1 defa katman değişiminde (Pause / M600) renk değiştirilir. AMS atık kulesi oluşmaz, saatlerce süren renk geçişi 10 dakikaya iner.
                    </div>
                  </div>
                ) : medicalBackTextStyle === 'engrave' ? (
                  <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-xl p-3 text-[11px] text-cyan-300/90 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-400">
                      <span>💡 Gömme / Negatif Yazı (100% Tek Filament)</span>
                    </div>
                    <div>
                      Yazı sırt yüzeyine -1.0mm oyulur. Hiçbir filament değişimi gerektirmeden doğal gölge ve ışık kontrastıyla çok net okunur. Sıfır atık, en hızlı ve ekonomik baskı seçeneğidir.
                    </div>
                  </div>
                ) : (
                  <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3 text-[11px] text-purple-300/90 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-purple-400">
                      <span>💡 Doğrudan Sırt Kabartması (Bambu AMS / Multi-Material)</span>
                    </div>
                    <div>
                      Yazı dikey sırt yüzeyinden 1.0mm kabarır. Desteksiz basılır ancak dikey katmanlarda her harf katmanında filament değişimi yapıldığından AMS atık miktarı ve baskı süresi artar.
                    </div>
                  </div>
                )}

                {medicalBackTextStyle === 'plate' && (
                  <div className="flex items-center justify-between p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                    <div>
                      <span className="block text-xs font-semibold text-slate-300">İsimlik Plaka Rengi</span>
                      <span className="text-[10px] text-slate-400">Yazı altındaki tabanın rengi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalPlateColor}
                        onChange={(e) => setMedicalPlateColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalPlateColor}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Sırt Yazısı (Satır satır - Örn: SYDH / TIBBİ / SEKRETER):
                  </label>
                  <textarea
                    rows={3}
                    value={medicalBackText}
                    onChange={(e) => setMedicalBackText(e.target.value)}
                    placeholder="SYDH&#10;TIBBİ&#10;SEKRETER"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500 leading-tight"
                  />
                </div>

                <Slider
                  label="Yazı Boyutu (mm)"
                  value={medicalBackTextHeight}
                  onChange={setMedicalBackTextHeight}
                  min={4.5}
                  max={10.0}
                  step={0.5}
                />

                <Slider
                  label="Kabartma Derinliği (mm)"
                  value={medicalBackTextDepth}
                  onChange={setMedicalBackTextDepth}
                  min={0.6}
                  max={1.8}
                  step={0.1}
                />

                <Slider
                  label="Dikey Konum / Yükseklik (mm)"
                  value={medicalBackTextElevation}
                  onChange={setMedicalBackTextElevation}
                  min={30}
                  max={95}
                  step={1}
                />
              </div>

              {/* ÖN GÖĞÜS CEBİ İSİMLİK / UNVAN */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Ön Göğüs Cebi İsimlik / Unvan
                </h2>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unvan / İsim:</label>
                  <input
                    type="text"
                    value={medicalFrontText}
                    onChange={(e) => setMedicalFrontText(e.target.value)}
                    placeholder="TIBBİ SEKRETER"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <Slider
                  label="İsim Boyutu (mm)"
                  value={medicalFrontTextHeight}
                  onChange={setMedicalFrontTextHeight}
                  min={3.5}
                  max={7.0}
                  step={0.5}
                />

                <Slider
                  label="Kabartma Derinliği (mm)"
                  value={medicalFrontTextDepth}
                  onChange={setMedicalFrontTextDepth}
                  min={0.5}
                  max={1.4}
                  step={0.1}
                />

                <Slider
                  label="Dikey Konum (mm)"
                  value={medicalFrontTextElevation}
                  onChange={setMedicalFrontTextElevation}
                  min={50}
                  max={90}
                  step={1}
                />
              </div>

              {/* RENK AYARLARI */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Renk Ayarları
                </h2>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-400 mb-1">Önlük Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalCoatColor}
                        onChange={(e) => setMedicalCoatColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalCoatColor}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-slate-400 mb-1">Yaka Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalCollarColor}
                        onChange={(e) => setMedicalCollarColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalCollarColor}</span>
                    </div>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-800">
                    <span className="block text-slate-400 mb-1">İç Gömlek (Yaka İçi) Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalInnerShirtColor}
                        onChange={(e) => setMedicalInnerShirtColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalInnerShirtColor}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-slate-400 mb-1">Düğme Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalButtonColor}
                        onChange={(e) => setMedicalButtonColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalButtonColor}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-slate-400 mb-1">Yazı Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalTextColor}
                        onChange={(e) => setMedicalTextColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalTextColor}</span>
                    </div>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-800">
                    <span className="block text-slate-400 mb-1">Alt Tabla (Kaide) Rengi</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={medicalBaseColor}
                        onChange={(e) => setMedicalBaseColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-300">{medicalBaseColor}</span>
                    </div>
                  </div>

                  {medicalRole === 'doctor' && (
                    <div className="col-span-2 pt-1 border-t border-slate-800">
                      <span className="block text-slate-400 mb-1">Steteskop Rengi</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={medicalStethoscopeColor}
                          onChange={(e) => setMedicalStethoscopeColor(e.target.value)}
                          className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                        />
                        <span className="text-[11px] font-mono text-slate-300">{medicalStethoscopeColor}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ÖNLÜK & HAZNE BOYUTLARI */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Önlük & Hazne Boyutları
                </h2>

                <Slider
                  label="Yükseklik (mm)"
                  value={medicalHeight}
                  onChange={setMedicalHeight}
                  min={90}
                  max={150}
                  step={2}
                />

                <Slider
                  label="Gövde Genişliği (mm)"
                  value={medicalCoatWidth}
                  onChange={setMedicalCoatWidth}
                  min={65}
                  max={105}
                  step={2}
                />

                <Slider
                  label="Gövde Derinliği (mm)"
                  value={medicalCoatDepth}
                  onChange={setMedicalCoatDepth}
                  min={40}
                  max={65}
                  step={2}
                />

                <Slider
                  label="Yaka & Kalem Giriş Açıklığı (mm)"
                  value={medicalCollarOpeningWidth}
                  onChange={setMedicalCollarOpeningWidth}
                  min={16}
                  max={46}
                  step={1}
                />

                <Slider
                  label="Kalem Haznesi Genişliği (mm)"
                  value={medicalCavityWidth}
                  onChange={setMedicalCavityWidth}
                  min={28}
                  max={Math.round(Math.max(40, medicalCoatWidth * 0.73 - medicalWallThickness * 2))}
                  step={1}
                />

                <Slider
                  label="Kalem Haznesi Derinliği (mm)"
                  value={medicalCavityDepth}
                  onChange={setMedicalCavityDepth}
                  min={18}
                  max={Math.round(Math.max(24, medicalCoatDepth * 0.93 - medicalWallThickness * 2))}
                  step={1}
                />

                <Slider
                  label="Et Kalınlığı (mm)"
                  value={medicalWallThickness}
                  onChange={(val) => {
                    setMedicalWallThickness(val);
                    const maxCavW = Math.round(Math.max(24, medicalCoatWidth * 0.72 - val * 2));
                    const maxCavD = Math.round(Math.max(18, medicalCoatDepth * 0.92 - val * 2));
                    setMedicalCavityWidth(maxCavW);
                    setMedicalCavityDepth(maxCavD);
                  }}
                  min={0.8}
                  max={5.0}
                  step={0.1}
                />
              </div>

              {/* ALT TABLA (TABAN PLAKASI) */}
              {renderBasePlateCard({
                baseShape: medicalBaseShape,
                setBaseShape: setMedicalBaseShape,
                baseWidth: medicalBaseWidth,
                setBaseWidth: setMedicalBaseWidth,
                baseDepth: medicalBaseDepth,
                setBaseDepth: setMedicalBaseDepth,
                baseCornerRadius: medicalBaseCornerRadius,
                setBaseCornerRadius: setMedicalBaseCornerRadius,
                baseThickness: medicalBaseThickness,
                setBaseThickness: setMedicalBaseThickness,
                minW: 68,
                minD: 48,
                minThick: 2.5,
                showElevation: true,
              })}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* ⚽ FORMA KALEMLİK AYARLARI */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === 'jersey' && (
            <div className="space-y-4">
              {/* TAKIM SEÇİMİ */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t('team_preset') || 'Takım Seçimi'}
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TEAM_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleJerseyTeamChange(key)}
                      className={`py-2 px-1 rounded-lg text-[10px] font-bold truncate transition-all ${
                        jerseyTeam === key
                          ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* FORMA SIRT BÖLÜMÜ */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t('jersey_back') || 'Sırt İsim & Numara'}
                </h2>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('back_name') || 'Sırt İsmi'}</label>
                  <input
                    type="text"
                    value={backName}
                    onChange={(e) => setBackName(e.target.value)}
                    placeholder="ENDER"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t('back_number') || 'Numara'}</label>
                    <input
                      type="text"
                      value={backNumber}
                      onChange={(e) => setBackNumber(e.target.value)}
                      placeholder="45"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Numara Boyutu</label>
                    <input
                      type="number"
                      value={backNumberHeight}
                      onChange={(e) => setBackNumberHeight(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <Slider
                  label="Yazı Yüksekliği (Elevation)"
                  value={backNameElevation}
                  onChange={setBackNameElevation}
                  min={75}
                  max={110}
                  step={1}
                />
              </div>

              {/* GÖĞÜS YAZISI / SPONSOR */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Göğüs Yazısı / Sponsor
                </h2>
                <input
                  type="text"
                  value={frontText}
                  onChange={(e) => setFrontText(e.target.value)}
                  placeholder="FANATİK ENDER"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <Slider
                  label="Yazı Boyutu"
                  value={frontTextHeight}
                  onChange={setFrontTextHeight}
                  min={5}
                  max={12}
                  step={0.5}
                />
                <Slider
                  label="Dikey Konum"
                  value={frontTextElevation}
                  onChange={setFrontTextElevation}
                  min={40}
                  max={80}
                  step={1}
                />
              </div>

              {/* ŞORT AYARI */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
                  <span>Futbol Şortu</span>
                  <input
                    type="checkbox"
                    checked={hasShorts}
                    onChange={(e) => setHasShorts(e.target.checked)}
                    className="accent-amber-500"
                  />
                </h2>
                {hasShorts && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400">Şort Rengi</span>
                    <input
                      type="color"
                      value={shortsColor}
                      onChange={(e) => setShortsColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* FORMA KALEMLİK BOYUTLARI */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Forma Boyutları
                </h2>
                <Slider label="Yükseklik" value={jerseyHeight} onChange={setJerseyHeight} min={90} max={160} step={2} />
                <Slider label="Genişlik" value={jerseyTorsoWidth} onChange={setJerseyTorsoWidth} min={65} max={105} step={2} />
                <Slider label="Derinlik" value={jerseyTorsoDepth} onChange={setJerseyTorsoDepth} min={40} max={70} step={2} />
                <Slider label="Et Kalınlığı (mm)" value={jerseyWallThickness} onChange={setJerseyWallThickness} min={0.8} max={5.0} step={0.1} />
              </div>

              {/* ALT TABLA (TABAN PLAKASI) */}
              {renderBasePlateCard({
                baseShape: jerseyBaseShape,
                setBaseShape: setJerseyBaseShape,
                baseWidth: jerseyBaseWidth,
                setBaseWidth: setJerseyBaseWidth,
                baseDepth: jerseyBaseDepth,
                setBaseDepth: setJerseyBaseDepth,
                baseCornerRadius: jerseyBaseCornerRadius,
                setBaseCornerRadius: setJerseyBaseCornerRadius,
                baseThickness: jerseyBaseThickness,
                setBaseThickness: setJerseyBaseThickness,
                minW: 52,
                minD: 34,
                minThick: 2.0,
                showElevation: false,
                baseColorVal: jerseyBaseColor,
                setBaseColorVal: setJerseyBaseColor,
              })}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 🏰 KALE KALEMLİK AYARLARI */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === 'castle' && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t('base_shape')}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShape('cylinder')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                      shape === 'cylinder' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t('cylinder')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShape('cube')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                      shape === 'cube' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t('cube')}
                  </button>
                </div>
                {shape === 'cylinder' ? (
                  <Slider label={t('outer_diameter')} value={outerDiameter} onChange={setOuterDiameter} min={60} max={150} />
                ) : (
                  <Slider label={t('outer_size')} value={outerSize} onChange={setOuterSize} min={60} max={150} />
                )}
                <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={200} />
                <Slider label={t('wall_thickness')} value={wallThickness} onChange={setWallThickness} min={0.8} max={10} step={0.2} />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* ✏️ İSİMLİ KALEMLİK AYARLARI */}
          {/* ════════════════════════════════════════════════════════════ */}
          {mode === 'name' && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t('name_settings')}</h2>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="ENDER"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <Slider label={t('font_size')} value={fontSize} onChange={setFontSize} min={10} max={30} />
                <Slider label={t('text_depth')} value={textDepth} onChange={setTextDepth} min={1} max={5} />
                <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={200} />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 📝 STANDART NOTLUK / KÜP BLOKNOT MODÜLÜ */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
              <span>Standart Notluk (Post-it)</span>
              <input
                type="checkbox"
                checked={hasNoteHolder}
                onChange={(e) => setHasNoteHolder(e.target.checked)}
                className="accent-amber-500"
              />
            </h2>
            {hasNoteHolder && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  {['side', 'front', 'back'].map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setNotePosition(pos)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${
                        notePosition === pos ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pos === 'side' ? 'Yanda' : pos === 'front' ? 'Önde' : 'Arkada'}
                    </button>
                  ))}
                </div>
                {notePosition === 'side' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNoteSide('left')}
                      className={`flex-1 py-1 rounded text-[10px] ${noteSide === 'left' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Sol Yan
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteSide('right')}
                      className={`flex-1 py-1 rounded text-[10px] ${noteSide === 'right' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50' : 'bg-slate-800 text-slate-400'}`}
                    >
                      Sağ Yan
                    </button>
                  </div>
                )}
                <Slider label="Notluk Genişliği (mm)" value={noteWidth} onChange={setNoteWidth} min={60} max={100} />
                <Slider label="Notluk Yüksekliği (mm)" value={noteHeight} onChange={setNoteHeight} min={20} max={60} />
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 📸 FOTOĞRAFLIK MODÜLÜ */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
              <span>{t('photo_stand_enable')}</span>
              <input
                type="checkbox"
                checked={hasPhotoStand}
                onChange={(e) => setHasPhotoStand(e.target.checked)}
                className="accent-amber-500"
              />
            </h2>
            {hasPhotoStand && (
              <div className="space-y-3 pt-2">
                <Slider label="Fotoğraf Genişliği" value={photoWidth} onChange={setPhotoWidth} min={50} max={120} />
                <Slider label="Fotoğraf Yüksekliği" value={photoHeight} onChange={setPhotoHeight} min={60} max={160} />
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* ⬇️ İNDİRME / DIŞA AKTARMA BUTONLARI */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div className="space-y-2 pt-2">
            {statusMsg && (
              <div className="p-2.5 bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs rounded-xl text-center font-bold animate-pulse">
                {statusMsg}
              </div>
            )}

            {/* 1. Tek Parça 3D Yazıcı STL */}
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/30 text-xs flex items-center justify-center gap-1.5"
            >
              <span>⬇️</span>
              <span>Tek Parça STL İndir (3D Baskı)</span>
            </button>

            {/* 2. Bambu Lab AMS Çok Renkli 3MF */}
            <button
              type="button"
              onClick={handleExport3MF}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-1.5"
            >
              <span>🎨</span>
              <span>Bambu AMS Çok Renkli .3MF İndir</span>
            </button>

            {/* 3. No-AMS Tek Renkli Yazıcılar İçin Parçalı ZIP */}
            <button
              type="button"
              onClick={handleExportNoAMSZip}
              className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-1.5"
            >
              <span>📦</span>
              <span>No-AMS Renkli Parçalı ZIP İndir</span>
            </button>

            {hasPhotoStand && (
              <button
                type="button"
                onClick={handleExportCombined}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl transition-colors border border-amber-500/30 text-xs"
              >
                {t('export_combined_btn')}
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* 🌐 3D CANVAS GÖRÜNÜMÜ */}
        {/* ════════════════════════════════════════════════════════════ */}
        <div className="flex-1 w-full flex items-center justify-center min-h-[460px] md:min-h-[640px] bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden relative shadow-2xl">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-700 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>3D Model Hazır • Desteksiz Baskı Uyumlu</span>
          </div>

          <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4, 22], fov: 35 }}>
            <PerspectiveCamera makeDefault position={[0, 4, 22]} fov={35} />
            <OrbitControls
              makeDefault
              minPolarAngle={0.1}
              maxPolarAngle={Math.PI / 1.8}
              target={[0, 2, 0]}
            />
            {/* 360° Dengeli Stüdyo Aydınlatması */}
            <ambientLight intensity={0.9} />
            <directionalLight position={[10, 15, 10]} intensity={1.25} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <directionalLight position={[-10, 12, -10]} intensity={1.15} />
            <directionalLight position={[10, 10, -10]} intensity={0.85} />
            <directionalLight position={[-10, 10, 10]} intensity={0.75} />
            <pointLight position={[0, 16, 0]} intensity={0.65} />
            <pointLight position={[0, 6, -10]} intensity={0.8} />

            <group ref={mainGroupRef} scale={[SCALE, SCALE, SCALE]} rotation={[0, modelRotationY, 0]}>
              {mode === 'medical' ? (
                <MedicalPencilCase
                  coatWidth={medicalCoatWidth}
                  coatDepth={medicalCoatDepth}
                  cavityWidth={medicalCavityWidth}
                  cavityDepth={medicalCavityDepth}
                  height={medicalHeight}
                  wallThickness={medicalWallThickness}
                  bottomThickness={medicalBottomThickness}
                  baseShape={medicalBaseShape}
                  baseWidth={medicalBaseWidth}
                  baseDepth={medicalBaseDepth}
                  baseThickness={medicalBaseThickness}
                  baseCornerRadius={medicalBaseCornerRadius}
                  baseColor={medicalBaseColor}
                  modelElevation={modelElevation}
                  medicalRole={medicalRole}
                  coatColor={medicalCoatColor}
                  collarColor={medicalCollarColor}
                  innerShirtColor={medicalInnerShirtColor}
                  buttonColor={medicalButtonColor}
                  textColor={medicalTextColor}
                  stethoscopeColor={medicalStethoscopeColor}
                  backText={medicalBackText}
                  backTextStyle={medicalBackTextStyle}
                  plateColor={medicalPlateColor}
                  backTextHeight={medicalBackTextHeight}
                  backTextDepth={medicalBackTextDepth}
                  backTextElevation={medicalBackTextElevation}
                  frontText={medicalFrontText}
                  frontTextHeight={medicalFrontTextHeight}
                  frontTextDepth={medicalFrontTextDepth}
                  frontTextElevation={medicalFrontTextElevation}
                  collarOpeningWidth={medicalCollarOpeningWidth}
                  fontName={medicalFontName}
                  groupRef={medicalGroupRef}
                />
              ) : mode === 'jersey' ? (
                <JerseyPencilCase
                  torsoWidth={jerseyTorsoWidth}
                  torsoDepth={jerseyTorsoDepth}
                  height={jerseyHeight}
                  wallThickness={jerseyWallThickness}
                  bottomThickness={jerseyBottomThickness}
                  cornerRadius={jerseyCornerRadius}
                  team={jerseyTeam}
                  pattern={jerseyPattern}
                  primaryColor={jerseyPrimaryColor}
                  secondaryColor={jerseySecondaryColor}
                  accentColor={jerseyAccentColor}
                  textColor={jerseyTextColor}
                  hasSponsor={hasSponsor}
                  frontText={frontText}
                  frontTextHeight={frontTextHeight}
                  frontTextDepth={frontTextDepth}
                  frontTextElevation={frontTextElevation}
                  hasFrontNumber={hasFrontNumber}
                  frontNumber={frontNumber}
                  frontNumberHeight={frontNumberHeight}
                  hasBadge={hasBadge}
                  badgeText={badgeText}
                  stars={stars}
                  badgeElevation={badgeElevation}
                  hasBackName={hasBackName}
                  backName={backName}
                  backNameHeight={backNameHeight}
                  backNameDepth={backNameDepth}
                  backNameElevation={backNameElevation}
                  hasBackNumber={hasBackNumber}
                  backNumber={backNumber}
                  backNumberHeight={backNumberHeight}
                  backNumberDepth={backNumberDepth}
                  backNumberElevation={backNumberElevation}
                  hasShorts={hasShorts}
                  shortsColor={shortsColor}
                  fontName={jerseyFontName}
                  hasDivider={hasJerseyDivider}
                  collarType={jerseyCollarType}
                  hasTextSupport={hasJerseyTextSupport}
                  textSupportAngle={jerseyTextSupportAngle}
                  groupRef={jerseyGroupRef}
                  baseShape={jerseyBaseShape}
                  baseThickness={jerseyBaseThickness}
                  baseWidth={jerseyBaseWidth}
                  baseDepth={jerseyBaseDepth}
                  baseCornerRadius={jerseyBaseCornerRadius}
                  baseColor={jerseyBaseColor}
                  modelElevation={modelElevation}
                />
              ) : mode === 'name' ? (
                <NamePencilCase
                  text={text}
                  fontName={fontName}
                  fontSize={fontSize}
                  textDepth={textDepth}
                  reliefType={reliefType}
                  materialColor={materialColor}
                  outerDiameter={outerDiameter}
                  height={height}
                  wallThickness={wallThickness}
                  bottomThickness={bottomThickness}
                  baseHeight={baseHeight}
                  baseExtension={baseExtension}
                  groupRef={groupRef}
                />
              ) : (
                <CastlePencilCase
                  shape={shape}
                  outerDiameter={outerDiameter}
                  outerSize={outerSize}
                  height={height}
                  wallThickness={wallThickness}
                  bottomThickness={bottomThickness}
                  baseHeight={baseHeight}
                  baseExtension={baseExtension}
                  numCrenellations={numCrenellations}
                  crenellationHeight={crenellationHeight}
                  crenellationWidth={crenellationWidth}
                  hasDoor={hasDoor}
                  doorWidth={doorWidth}
                  doorHeight={doorHeight}
                  doorRecess={doorRecess}
                  hasWindows={hasWindows}
                  numWindows={numWindows}
                  windowWidth={windowWidth}
                  windowHeight={windowHeight}
                  windowRecess={windowRecess}
                  windowArched={windowArched}
                  hasTowers={hasTowers}
                  towerRadius={towerRadius}
                  towerHeight={towerHeight}
                  towerCrenellations={towerCrenellations}
                  topExtension={topExtension}
                  corniceHeight={corniceHeight}
                  corniceChamfer={corniceChamfer}
                  showBrickTexture={showBrickTexture}
                  numBricksHeight={numBricksHeight}
                  numBricksCircumference={numBricksCircumference}
                  numBricksLength={numBricksLength}
                  embossedBricks={embossedBricks}
                  brickDepth={brickDepth}
                  groupRef={groupRef}
                />
              )}

              {/* Notluk Tutacağı Modülü */}
              {hasNoteHolder && (
                <NoteHolder
                  ref={noteHolderRef}
                  position={notePosition}
                  side={noteSide}
                  width={noteWidth}
                  depth={noteDepth}
                  height={noteHeight}
                  wallThickness={noteWallThickness}
                  distance={noteDistance}
                  offset={noteOffset}
                  hasThumbCutout={hasThumbCutout}
                  thumbCutoutWidth={thumbCutoutWidth}
                  thumbCutoutDepth={thumbCutoutDepth}
                  color={noteColor}
                  showSamplePaper={showSamplePaper}
                  parentWidth={mode === 'medical' ? medicalBaseWidth : mode === 'jersey' ? jerseyBaseWidth : outerDiameter}
                  parentDepth={
                    mode === 'medical'
                      ? medicalBaseShape === 'circle' || medicalBaseShape === 'square'
                        ? medicalBaseWidth
                        : medicalBaseDepth
                      : mode === 'jersey'
                      ? jerseyBaseShape === 'circle' || jerseyBaseShape === 'square'
                        ? jerseyBaseWidth
                        : jerseyBaseDepth
                      : outerDiameter
                  }
                  elevation={modelElevation}
                />
              )}

              {/* Fotoğraflık Standı Modülü */}
              {hasPhotoStand && (
                <PhotoStand
                  photoWidth={photoWidth}
                  photoHeight={photoHeight}
                  frameWidth={standFrameWidth}
                  frameDepth={standFrameDepth}
                  slotDepth={photoSlotDepth}
                  backPlateThickness={photoBackThickness}
                  onlyEdges={photoOnlyEdges}
                  hasTopEdge={photoHasTopEdge}
                  distance={photoDistance}
                  offset={photoOffset}
                  tilt={photoTilt}
                  hasCrenellations={photoHasCrenellations}
                  numCrenellations={photoNumCrenellations}
                  crenellationHeight={photoCrenellationHeight}
                  crenellationAlignment={photoCrenellationAlignment}
                  position={photoStandPosition}
                  outerDiameter={outerDiameter}
                  outerSize={outerSize}
                  shape={mode === 'castle' ? shape : 'cylinder'}
                  height={height}
                  baseHeight={baseHeight}
                  topExtension={topExtension}
                  corniceHeight={corniceHeight}
                  showBrickTexture={mode === 'castle' ? showBrickTexture : false}
                  embossedBricks={mode === 'castle' ? embossedBricks : false}
                  brickDepth={brickDepth}
                  materialColor={materialColor}
                  standRef={standRef}
                />
              )}
            </group>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
              <planeGeometry args={[200, 200]} />
              <shadowMaterial opacity={0.2} />
            </mesh>
          </Canvas>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 uppercase tracking-widest pointer-events-none">
            {t('orbit_mode')}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
