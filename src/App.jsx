import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import CastlePencilCase from './components/organisms/CastlePencilCase';
import NamePencilCase from './components/organisms/NamePencilCase';
import PhotoStand from './components/organisms/PhotoStand';
import { useTranslation } from 'react-i18next';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import JSZip from 'jszip';
import * as THREE from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

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

  const [mode, setMode] = useState('name'); // 'name' or 'castle'

  // Castle specific states
  const [shape, setShape] = useState('cylinder');
  const [outerDiameter, setOuterDiameter] = useState(100);
  const [outerSize, setOuterSize] = useState(100);
  const [height, setHeight] = useState(150);
  const [wallThickness, setWallThickness] = useState(4);
  const [bottomThickness, setBottomThickness] = useState(4);
  const [baseHeight, setBaseHeight] = useState(8);
  const [baseExtension, setBaseExtension] = useState(6);
  const [numCrenellations, setNumCrenellations] = useState(8);
  const [crenellationHeight, setCrenellationHeight] = useState(20);
  const [crenellationWidth, setCrenellationWidth] = useState(0.5);
  const [hasDoor, setHasDoor] = useState(true);
  const [doorWidth, setDoorWidth] = useState(24);
  const [doorHeight, setDoorHeight] = useState(50);
  const [doorRecess, setDoorRecess] = useState(2);
  const [hasWindows, setHasWindows] = useState(true);
  const [numWindows, setNumWindows] = useState(3);
  const [windowWidth, setWindowWidth] = useState(16);
  const [windowHeight, setWindowHeight] = useState(24);
  const [windowRecess, setWindowRecess] = useState(1);
  const [windowArched, setWindowArched] = useState(true);
  const [hasTowers, setHasTowers] = useState(true);
  const [towerRadius, setTowerRadius] = useState(8);
  const [towerHeight, setTowerHeight] = useState(30);
  const [cornerRadius, setCornerRadius] = useState(5);
  const [topExtension, setTopExtension] = useState(6);
  const [corniceHeight, setCorniceHeight] = useState(12);
  // Castle text states
  const [castleText, setCastleText] = useState('');
  const [castleFont, setCastleFont] = useState('Plus_Jakarta_Sans_Bold.json');
  const [castleTextHeight, setCastleTextHeight] = useState(20);
  const [castleTextDepth, setCastleTextDepth] = useState(2);
  const [castleTextMode, setCastleTextMode] = useState('emboss'); // 'emboss' | 'engrave'
  const [castleTextPosition, setCastleTextPosition] = useState('custom'); // 'custom' | 'cornice' | 'wall'
  const [castleTextElevation, setCastleTextElevation] = useState(70); // mm (yerden yükseklik)
  const [castleTextAngle, setCastleTextAngle] = useState(0); // 0: Ön, 90: Sağ, 180: Arka, 270: Sol
  const [castleTextSpacing, setCastleTextSpacing] = useState(1);
  const [castleTextWidthScale, setCastleTextWidthScale] = useState(100); // % (genişlik oranı, 100 = %100)
  const [castleTextRepeat, setCastleTextRepeat] = useState('single'); // 'single' | 'all_sides'
  const [showBrickTexture, setShowBrickTexture] = useState(true);
  const [embossedBricks, setEmbossedBricks] = useState(false);
  const [brickDepth, setBrickDepth] = useState(1.5);
  const [showCastleRelief, setShowCastleRelief] = useState(false);
  const [castleReliefDepth, setCastleReliefDepth] = useState(1);
  const [materialColor, setMaterialColor] = useState('#a8a29e');
  const [doorColor, setDoorColor] = useState('#1c1917');
  const [reliefMode, setReliefMode] = useState('emboss');
  const [reliefScale, setReliefScale] = useState(1.0);
  const [castleReliefElevation, setCastleReliefElevation] = useState(70);
  const [castleReliefAngle, setCastleReliefAngle] = useState(0); // 0: Ön, 90: Sağ, 180: Arka, 270: Sol
  const [castleReliefOffset, setCastleReliefOffset] = useState(0); // mm (-25 ile +20 mm arası duvara/desene gömülme)
  const [reliefFlipX, setReliefFlipX] = useState(false); // false: sola bakış, true: sağa bakış
  const [reliefSource, setReliefSource] = useState('preset_horse'); // 'preset_horse' | 'custom_svg'
  const [customSvgText, setCustomSvgText] = useState('');
  const [customSvgName, setCustomSvgName] = useState('');

  const handleSvgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomSvgName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCustomSvgText(text);
        setReliefSource('custom_svg');
        setShowCastleRelief(true);
      }
    };
    reader.readAsText(file);
  };

  // Name specific states
  const [text, setText] = useState('ENDER');
  const [fontName, setFontName] = useState('Plus_Jakarta_Sans_Bold.json');
  const [textArcAngle, setTextArcAngle] = useState(120);
  const [numVerticalBars, setNumVerticalBars] = useState(12);
  const [hasCentralColumn, setHasCentralColumn] = useState(true);
  const [centralColumnDiameter, setCentralColumnDiameter] = useState(30);
  const [dividerMode, setDividerMode] = useState('support');
  const [numDividers, setNumDividers] = useState(3);
  const [autoRepeat, setAutoRepeat] = useState(true);
  const [dotConnection, setDotConnection] = useState('ring');

  // Photo stand states (shared between both modes)
  const [hasPhotoStand, setHasPhotoStand] = useState(false);
  const [photoStandPosition, setPhotoStandPosition] = useState('side'); // 'side' | 'front' | 'back'
  const [photoWidth, setPhotoWidth] = useState(35);
  const [photoHeight, setPhotoHeight] = useState(45);
  const [standFrameThickness, setStandFrameThickness] = useState(2.5);
  const [standFrameDepth, setStandFrameDepth] = useState(5);
  const [photoSlotDepth, setPhotoSlotDepth] = useState(1.0); // mm - Fotoğraf kanalı kalınlığı (1mm varsayılan, ayarlanabilir)
  const [photoOnlyEdges, setPhotoOnlyEdges] = useState(false); // Sadece kenarlıklar (içi boş / arkalıksız çerçeve)
  const [photoHasTopEdge, setPhotoHasTopEdge] = useState(false); // 4 kenarlı çerçeve (üst kenarlık kapat)
  const [photoBackThickness, setPhotoBackThickness] = useState(4); // mm - çerçevenin arka duvar kalınlığı (varsayılan 4 mm sur görünümü için)
  const [photoDistance, setPhotoDistance] = useState(0); // mm - kalemliğe olan mesafe (0 = tam yaslanmış)
  const [photoTilt, setPhotoTilt] = useState(10); // derece - geriye doğru yatıklık açısı (0 = tam dik)
  const [photoHasCrenellations, setPhotoHasCrenellations] = useState(true); // Üst surlar/mazgallar
  const [photoNumCrenellations, setPhotoNumCrenellations] = useState(4); // Mazgal diş sayısı
  const [photoCrenellationHeight, setPhotoCrenellationHeight] = useState(6); // Mazgal yüksekliği (mm)
  const [photoCrenellationAlignment, setPhotoCrenellationAlignment] = useState('center'); // 'center' | 'front' | 'back'
  const [photoOffset, setPhotoOffset] = useState(0); // mm - yandayken ön/arka, öndeyken sağ/sol kaydırma

  // Custom templates states & handlers
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('kalemlik_custom_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [templateNameInput, setTemplateNameInput] = useState('');
  const fileInputRef = useRef(null);

  const getCurrentConfig = () => {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      mode,
      // Castle parameters
      shape,
      outerDiameter,
      outerSize,
      height,
      wallThickness,
      bottomThickness,
      baseHeight,
      baseExtension,
      numCrenellations,
      crenellationHeight,
      crenellationWidth,
      hasDoor,
      doorWidth,
      doorHeight,
      doorRecess,
      hasWindows,
      numWindows,
      windowWidth,
      windowHeight,
      windowRecess,
      windowArched,
      hasTowers,
      towerRadius,
      towerHeight,
      cornerRadius,
      topExtension,
      corniceHeight,
      castleText,
      castleFont,
      castleTextHeight,
      castleTextDepth,
      castleTextMode,
      castleTextPosition,
      castleTextElevation,
      castleTextAngle,
      castleTextSpacing,
      castleTextWidthScale,
      castleTextRepeat,
      showBrickTexture,
      embossedBricks,
      brickDepth,
      showCastleRelief,
      castleReliefDepth,
      materialColor,
      doorColor,
      reliefMode,
      reliefScale,
      castleReliefElevation,
      castleReliefAngle,
      castleReliefOffset,
      reliefFlipX,
      reliefSource,
      customSvgText,
      customSvgName,
      // Name mode parameters
      text,
      fontName,
      textArcAngle,
      numVerticalBars,
      hasCentralColumn,
      centralColumnDiameter,
      dividerMode,
      numDividers,
      autoRepeat,
      dotConnection,
      // Photo stand parameters
      hasPhotoStand,
      photoStandPosition,
      photoWidth,
      photoHeight,
      standFrameThickness,
      standFrameDepth,
      photoSlotDepth,
      photoOnlyEdges,
      photoHasTopEdge,
      photoBackThickness,
      photoDistance,
      photoTilt,
      photoHasCrenellations,
      photoNumCrenellations,
      photoCrenellationHeight,
      photoCrenellationAlignment,
      photoOffset,
    };
  };

  const applyConfig = (cfg) => {
    if (!cfg || typeof cfg !== 'object') return;
    if (cfg.mode !== undefined) setMode(cfg.mode);

    // Castle parameters
    if (cfg.shape !== undefined) setShape(cfg.shape);
    if (cfg.outerDiameter !== undefined) setOuterDiameter(cfg.outerDiameter);
    if (cfg.outerSize !== undefined) setOuterSize(cfg.outerSize);
    if (cfg.height !== undefined) setHeight(cfg.height);
    if (cfg.wallThickness !== undefined) setWallThickness(cfg.wallThickness);
    if (cfg.bottomThickness !== undefined) setBottomThickness(cfg.bottomThickness);
    if (cfg.baseHeight !== undefined) setBaseHeight(cfg.baseHeight);
    if (cfg.baseExtension !== undefined) setBaseExtension(cfg.baseExtension);
    if (cfg.numCrenellations !== undefined) setNumCrenellations(cfg.numCrenellations);
    if (cfg.crenellationHeight !== undefined) setCrenellationHeight(cfg.crenellationHeight);
    if (cfg.crenellationWidth !== undefined) setCrenellationWidth(cfg.crenellationWidth);
    if (cfg.hasDoor !== undefined) setHasDoor(cfg.hasDoor);
    if (cfg.doorWidth !== undefined) setDoorWidth(cfg.doorWidth);
    if (cfg.doorHeight !== undefined) setDoorHeight(cfg.doorHeight);
    if (cfg.doorRecess !== undefined) setDoorRecess(cfg.doorRecess);
    if (cfg.hasWindows !== undefined) setHasWindows(cfg.hasWindows);
    if (cfg.numWindows !== undefined) setNumWindows(cfg.numWindows);
    if (cfg.windowWidth !== undefined) setWindowWidth(cfg.windowWidth);
    if (cfg.windowHeight !== undefined) setWindowHeight(cfg.windowHeight);
    if (cfg.windowRecess !== undefined) setWindowRecess(cfg.windowRecess);
    if (cfg.windowArched !== undefined) setWindowArched(cfg.windowArched);
    if (cfg.hasTowers !== undefined) setHasTowers(cfg.hasTowers);
    if (cfg.towerRadius !== undefined) setTowerRadius(cfg.towerRadius);
    if (cfg.towerHeight !== undefined) setTowerHeight(cfg.towerHeight);
    if (cfg.cornerRadius !== undefined) setCornerRadius(cfg.cornerRadius);
    if (cfg.topExtension !== undefined) setTopExtension(cfg.topExtension);
    if (cfg.corniceHeight !== undefined) setCorniceHeight(cfg.corniceHeight);
    if (cfg.castleText !== undefined) setCastleText(cfg.castleText);
    if (cfg.castleFont !== undefined) setCastleFont(cfg.castleFont);
    if (cfg.castleTextHeight !== undefined) setCastleTextHeight(cfg.castleTextHeight);
    if (cfg.castleTextDepth !== undefined) setCastleTextDepth(cfg.castleTextDepth);
    if (cfg.castleTextMode !== undefined) setCastleTextMode(cfg.castleTextMode);
    if (cfg.castleTextPosition !== undefined) setCastleTextPosition(cfg.castleTextPosition);
    if (cfg.castleTextElevation !== undefined) setCastleTextElevation(cfg.castleTextElevation);
    if (cfg.castleTextAngle !== undefined) setCastleTextAngle(cfg.castleTextAngle);
    if (cfg.castleTextSpacing !== undefined) setCastleTextSpacing(cfg.castleTextSpacing);
    if (cfg.castleTextWidthScale !== undefined) setCastleTextWidthScale(cfg.castleTextWidthScale);
    if (cfg.castleTextRepeat !== undefined) setCastleTextRepeat(cfg.castleTextRepeat);
    if (cfg.showBrickTexture !== undefined) setShowBrickTexture(cfg.showBrickTexture);
    if (cfg.embossedBricks !== undefined) setEmbossedBricks(cfg.embossedBricks);
    if (cfg.brickDepth !== undefined) setBrickDepth(cfg.brickDepth);
    if (cfg.showCastleRelief !== undefined) setShowCastleRelief(cfg.showCastleRelief);
    if (cfg.castleReliefDepth !== undefined) setCastleReliefDepth(cfg.castleReliefDepth);
    if (cfg.materialColor !== undefined) setMaterialColor(cfg.materialColor);
    if (cfg.doorColor !== undefined) setDoorColor(cfg.doorColor);
    if (cfg.reliefMode !== undefined) setReliefMode(cfg.reliefMode);
    if (cfg.reliefScale !== undefined) setReliefScale(cfg.reliefScale);
    if (cfg.castleReliefElevation !== undefined) setCastleReliefElevation(cfg.castleReliefElevation);
    if (cfg.castleReliefAngle !== undefined) setCastleReliefAngle(cfg.castleReliefAngle);
    if (cfg.castleReliefOffset !== undefined) setCastleReliefOffset(cfg.castleReliefOffset);
    if (cfg.reliefFlipX !== undefined) setReliefFlipX(cfg.reliefFlipX);
    if (cfg.reliefSource !== undefined) setReliefSource(cfg.reliefSource);
    if (cfg.customSvgText !== undefined) setCustomSvgText(cfg.customSvgText);
    if (cfg.customSvgName !== undefined) setCustomSvgName(cfg.customSvgName);

    // Name parameters
    if (cfg.text !== undefined) setText(cfg.text);
    if (cfg.fontName !== undefined) setFontName(cfg.fontName);
    if (cfg.textArcAngle !== undefined) setTextArcAngle(cfg.textArcAngle);
    if (cfg.numVerticalBars !== undefined) setNumVerticalBars(cfg.numVerticalBars);
    if (cfg.hasCentralColumn !== undefined) setHasCentralColumn(cfg.hasCentralColumn);
    if (cfg.centralColumnDiameter !== undefined) setCentralColumnDiameter(cfg.centralColumnDiameter);
    if (cfg.dividerMode !== undefined) setDividerMode(cfg.dividerMode);
    if (cfg.numDividers !== undefined) setNumDividers(cfg.numDividers);
    if (cfg.autoRepeat !== undefined) setAutoRepeat(cfg.autoRepeat);
    if (cfg.dotConnection !== undefined) setDotConnection(cfg.dotConnection);

    // Photo stand parameters
    if (cfg.hasPhotoStand !== undefined) setHasPhotoStand(cfg.hasPhotoStand);
    if (cfg.photoStandPosition !== undefined) setPhotoStandPosition(cfg.photoStandPosition);
    if (cfg.photoWidth !== undefined) setPhotoWidth(cfg.photoWidth);
    if (cfg.photoHeight !== undefined) setPhotoHeight(cfg.photoHeight);
    if (cfg.standFrameThickness !== undefined) setStandFrameThickness(cfg.standFrameThickness);
    if (cfg.standFrameDepth !== undefined) setStandFrameDepth(cfg.standFrameDepth);
    if (cfg.photoSlotDepth !== undefined) setPhotoSlotDepth(cfg.photoSlotDepth);
    if (cfg.photoOnlyEdges !== undefined) setPhotoOnlyEdges(cfg.photoOnlyEdges);
    if (cfg.photoHasTopEdge !== undefined) setPhotoHasTopEdge(cfg.photoHasTopEdge);
    if (cfg.photoBackThickness !== undefined) setPhotoBackThickness(cfg.photoBackThickness);
    if (cfg.photoDistance !== undefined) setPhotoDistance(cfg.photoDistance);
    if (cfg.photoTilt !== undefined) setPhotoTilt(cfg.photoTilt);
    if (cfg.photoHasCrenellations !== undefined) setPhotoHasCrenellations(cfg.photoHasCrenellations);
    if (cfg.photoNumCrenellations !== undefined) setPhotoNumCrenellations(cfg.photoNumCrenellations);
    if (cfg.photoCrenellationHeight !== undefined) setPhotoCrenellationHeight(cfg.photoCrenellationHeight);
    if (cfg.photoCrenellationAlignment !== undefined) setPhotoCrenellationAlignment(cfg.photoCrenellationAlignment);
    if (cfg.photoOffset !== undefined) setPhotoOffset(cfg.photoOffset);
  };

  const handleSaveTemplate = () => {
    const name = templateNameInput.trim() || `Şablon ${customTemplates.length + 1}`;
    const newTemplate = {
      id: Date.now().toString(),
      name,
      config: getCurrentConfig()
    };
    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setTemplateNameInput('');
  };

  const handleDeleteTemplate = (id) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportTemplate = (template) => {
    const configToExport = template ? template.config : getCurrentConfig();
    const exportName = (template ? template.name : 'kalemlik-sablon').replace(/[^a-zA-Z0-9_\-ğüşıöçĞÜŞİÖÇ]/g, '_');
    const jsonStr = JSON.stringify(configToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${exportName}.json`);
  };

  const handleImportTemplate = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text === 'string') {
          const parsed = JSON.parse(text);
          applyConfig(parsed);
          const templateName = file.name.replace(/\.[^/.]+$/, '');
          const newTemplate = {
            id: Date.now().toString(),
            name: templateName,
            config: parsed
          };
          const updated = [newTemplate, ...customTemplates.filter(t => t.name !== templateName)];
          setCustomTemplates(updated);
          try {
            localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated));
          } catch (err) {
            console.error(err);
          }
          alert(t('template_imported_success'));
        }
      } catch (err) {
        alert(t('template_invalid_format'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyPresetChessRook = () => {
    setShape('cylinder');
    setOuterDiameter(100);
    setHeight(150);
    setWallThickness(5);
    setBottomThickness(5);
    setBaseHeight(8);
    setBaseExtension(6);
    setNumCrenellations(8);
    setCrenellationHeight(20);
    setCrenellationWidth(0.5);
    setTopExtension(0);
    setHasDoor(false);
    setHasWindows(false);
    setHasTowers(false);
    setShowBrickTexture(false);
    setEmbossedBricks(false);
    setShowCastleRelief(true);
    setReliefMode('engrave');
    setCastleReliefDepth(1.5);
    setReliefScale(1.2);
    setCastleReliefElevation(75);
    setCastleReliefAngle(0);
    setCastleReliefOffset(0);
    setReliefFlipX(false);
    setMaterialColor('#262626');
  };

  const applyPresetSquareTower = () => {
    setShape('square');
    setOuterSize(80);
    setHeight(115);
    setWallThickness(4.5);
    setBottomThickness(4);
    setBaseHeight(0);
    setBaseExtension(0);
    setTopExtension(7);
    setCorniceHeight(16);
    setNumCrenellations(8);
    setCrenellationHeight(16);
    setCrenellationWidth(0.52);
    setCornerRadius(1);
    setHasDoor(false);
    setHasWindows(false);
    setHasTowers(false);
    setShowBrickTexture(false);
    setEmbossedBricks(true);
    setBrickDepth(1.2);
    setShowCastleRelief(false);
    setMaterialColor('#8d6e63');
  };

  const applyPresetSize = (d, h) => {
    if (shape === 'cylinder') {
      setOuterDiameter(d);
    } else {
      setOuterSize(d);
    }
    setHeight(h);
    
    // Auto-adjust central column diameter to fit within the outer ring
    const maxCentralCol = Math.max(15, d - wallThickness * 2 - 10);
    if (centralColumnDiameter > maxCentralCol) {
      setCentralColumnDiameter(maxCentralCol);
    }
  };

  const mainGroupRef = useRef();
  const groupRef = useRef();
  const standRef = useRef();

  const handleExport = () => {
    if (!groupRef.current) return;
    const exporter = new STLExporter();

    const origScale = groupRef.current.scale.clone();
    const origRot = groupRef.current.rotation.clone();

    // Reset local scale to 1.0 and rotate 90 degrees around X so Y-up maps to Z-up for 3D printers
    groupRef.current.scale.set(1, 1, 1);
    groupRef.current.rotation.set(Math.PI / 2, 0, 0);

    const parent = groupRef.current.parent;
    let origParentScale = null;
    if (parent) {
      origParentScale = parent.scale.clone();
      parent.scale.set(1, 1, 1);
      parent.updateMatrixWorld(true); // Propagate the scale down to all meshes
    } else {
      groupRef.current.updateMatrixWorld(true);
    }

    const result = exporter.parse(groupRef.current, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    
    let filename = '';
    if (mode === 'name') {
      filename = `IsimKalemlik_${text.trim() || 'isim'}_${outerDiameter}x${height}_${Date.now()}.stl`;
    } else {
      const sizeLabel = shape === 'cylinder' ? outerDiameter : `${outerSize}x${outerSize}`;
      filename = `KaleKalemlik_${sizeLabel}x${height}_${Date.now()}.stl`;
    }
    
    downloadBlob(blob, filename);

    // Restore original local scale and rotation
    groupRef.current.scale.copy(origScale);
    groupRef.current.rotation.copy(origRot);

    if (parent && origParentScale) {
      parent.scale.copy(origParentScale);
      parent.updateMatrixWorld(true);
    } else {
      groupRef.current.updateMatrixWorld(true);
    }
  };

  const handleExportStand = () => {
    if (!standRef.current) return;
    const exporter = new STLExporter();

    const origScale = standRef.current.scale.clone();
    const origRot = standRef.current.rotation.clone();

    // Reset local scale to 1.0 and rotate 90 degrees around X so Y-up maps to Z-up for 3D printers
    standRef.current.scale.set(1, 1, 1);
    standRef.current.rotation.set(Math.PI / 2, 0, 0);

    const parent = standRef.current.parent;
    let origParentScale = null;
    if (parent) {
      origParentScale = parent.scale.clone();
      parent.scale.set(1, 1, 1);
      parent.updateMatrixWorld(true);
    } else {
      standRef.current.updateMatrixWorld(true);
    }

    const result = exporter.parse(standRef.current, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const filename = `FotoTutacagi_${photoWidth}x${photoHeight}_${Date.now()}.stl`;
    downloadBlob(blob, filename);

    // Restore
    standRef.current.scale.copy(origScale);
    standRef.current.rotation.copy(origRot);

    if (parent && origParentScale) {
      parent.scale.copy(origParentScale);
      parent.updateMatrixWorld(true);
    } else {
      standRef.current.updateMatrixWorld(true);
    }
  };

  // Kalemlik + Çerçeve Tek Parça Bir Arada STL Export
  const handleExportCombined = () => {
    const targetGroup = mainGroupRef.current || groupRef.current?.parent;
    if (!targetGroup) return;

    const exporter = new STLExporter();
    const origScale = targetGroup.scale.clone();
    const origRot = targetGroup.rotation.clone();

    targetGroup.scale.set(1, 1, 1);
    targetGroup.rotation.set(Math.PI / 2, 0, 0);
    targetGroup.updateMatrixWorld(true);

    const result = exporter.parse(targetGroup, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });

    const sizeLabel = shape === 'cylinder' ? outerDiameter : `${outerSize}x${outerSize}`;
    const filename = `Kalemlik_ve_FotoTutacagi_TekParca_${sizeLabel}x${height}_${Date.now()}.stl`;
    downloadBlob(blob, filename);

    targetGroup.scale.copy(origScale);
    targetGroup.rotation.copy(origRot);
    targetGroup.updateMatrixWorld(true);
  };

  // Otomatik Renklendirilmiş Tam Model Export (OBJ + MTL Zip)
  const handleExportColored = async () => {
    const targetGroup = (hasPhotoStand && mainGroupRef.current) ? mainGroupRef.current : (groupRef.current || mainGroupRef.current);
    if (!targetGroup) return;

    const origScale = targetGroup.scale.clone();
    const origRot = targetGroup.rotation.clone();

    // 3D baskı ve renkli render için Z-up dönüşümü
    targetGroup.scale.set(1, 1, 1);
    targetGroup.rotation.set(Math.PI / 2, 0, 0);
    targetGroup.updateMatrixWorld(true);

    // Renkleri toplayarak MTL dosyası ve obj referansı oluştur
    const materialsMap = new Map();
    let matIndex = 1;

    targetGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        const col = mat.color ? mat.color.getHexString() : 'cccccc';
        if (!materialsMap.has(col)) {
          const matName = `mat_${col}`;
          materialsMap.set(col, { name: matName, hex: col, color: mat.color || new THREE.Color(0xcccccc) });
        }
      }
    });

    const exporter = new OBJExporter();
    let rawObj = exporter.parse(targetGroup);

    // MTL Dosyası İçeriği
    let mtlContent = `# Kalemlik 3D Model Material Library\n# Created by Sakrad 3D Studio\n\n`;
    for (const [col, mInfo] of materialsMap.entries()) {
      const c = mInfo.color;
      mtlContent += `newmtl ${mInfo.name}\n`;
      mtlContent += `Ka ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}\n`;
      mtlContent += `Kd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}\n`;
      mtlContent += `Ks 0.2000 0.2000 0.2000\n`;
      mtlContent += `Ns 30.0\n`;
      mtlContent += `d 1.0\n`;
      mtlContent += `illum 2\n\n`;
    }

    // OBJ dosyasına mtllib ekle ve materyal atamalarını bağla
    let finalObj = `mtllib model.mtl\n` + rawObj;

    // Zip arşivine paketle
    const zip = new JSZip();
    zip.file('model.obj', finalObj);
    zip.file('model.mtl', mtlContent);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const sizeLabel = shape === 'cylinder' ? outerDiameter : `${outerSize}x${outerSize}`;
    const filename = `Renkli_Kalemlik_Model_${sizeLabel}x${height}_${Date.now()}.zip`;
    downloadBlob(zipBlob, filename);

    // Restore
    targetGroup.scale.copy(origScale);
    targetGroup.rotation.copy(origRot);
    targetGroup.updateMatrixWorld(true);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'TR' ? 'EN' : 'TR');
  };

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

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex flex-col font-sans text-white pb-24 md:pb-0">
      <header className="px-6 py-4 flex justify-between items-center w-full max-w-6xl mx-auto border-b border-slate-800">
        <h1 className="font-bold tracking-tight text-lg text-amber-400">
          {mode === 'name' ? '✏️ ' + t('mode_name').toLocaleUpperCase('tr-TR') : '🏰 ' + t('title')}
        </h1>
        <button
          onClick={toggleLang}
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full text-slate-300 transition-colors"
        >
          {i18n.language === 'TR' ? 'EN' : 'TR'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 px-4 sm:px-6 py-6">
        <div className="w-full md:w-72 shrink-0 space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          {/* DESIGN TYPE SELECTOR */}
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-3 uppercase">
              {t('mode_selection')}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('castle')}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  mode === 'castle'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {t('mode_castle')}
              </button>
              <button
                onClick={() => setMode('name')}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  mode === 'name'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {t('mode_name')}
              </button>
            </div>
          </div>

          {/* TEMPLATES & SHARING */}
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
              <span>{t('templates_title')}</span>
              <span className="text-[10px] text-amber-500 font-normal">JSON</span>
            </h2>

            {/* Save current config */}
            <div className="flex gap-2">
              <input
                type="text"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder={t('template_name_placeholder')}
                className="flex-1 min-w-0 bg-slate-800 text-xs text-white px-2.5 py-1.5 rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 shadow"
              >
                {t('save_btn')}
              </button>
            </div>

            {/* Quick Export / Import Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleExportTemplate(null)}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium rounded-lg text-[11px] transition-all border border-amber-500/20 flex items-center justify-center gap-1"
                title="Mevcut ayarları .json dosyası olarak indir"
              >
                📤 {t('export_template_btn')}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium rounded-lg text-[11px] transition-all border border-emerald-500/20 flex items-center justify-center gap-1"
                title="Bilgisayarınızdan bir .json şablon dosyası seçin"
              >
                📥 {t('import_template_btn')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportTemplate}
                className="hidden"
              />
            </div>

            {/* Saved Templates List */}
            {customTemplates.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80 max-h-48 overflow-y-auto pr-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  {t('my_saved_templates')} ({customTemplates.length})
                </span>
                {customTemplates.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg p-2 text-xs transition-colors"
                  >
                    <span className="truncate font-medium text-slate-200 pr-2 max-w-[100px]" title={item.name}>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => applyConfig(item.config)}
                        className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-semibold transition-colors"
                        title={t('load_template')}
                      >
                        {t('load_template')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportTemplate(item)}
                        className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded transition-colors"
                        title="JSON İndir / Paylaş"
                      >
                        💾
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(item.id)}
                        className="p-1 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title={t('delete_template')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ==================================== */}
          {/* CASTLE MODE SETTINGS */}
          {/* ==================================== */}
          {mode === 'castle' && (
            <>
              {/* PRESETS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-3 uppercase">
                  {t('presets')}
                </h2>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={applyPresetSquareTower}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-900/50 to-amber-700/40 hover:from-amber-800/60 hover:to-amber-600/50 text-amber-200 font-bold rounded-lg text-xs transition-all border border-amber-500/40 hover:border-amber-500/70 flex items-center justify-center gap-2 shadow-sm"
                  >
                    🏰 {t('preset_square_castle')}
                  </button>
                  <button
                    onClick={applyPresetChessRook}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-amber-400 font-bold rounded-lg text-xs transition-all border border-amber-500/20 hover:border-amber-500/50 flex items-center justify-center gap-2"
                  >
                    ♟️ {t('preset_chess_rook')}
                  </button>
                </div>
              </div>

              {/* SHAPE */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('shape')}
                </h2>
                <div className="flex gap-2 mb-4">
                  {['cylinder', 'square'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setShape(s)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        shape === s
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {t(`shape_${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* DIMENSIONS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('dimensions')}
                </h2>

                {/* Size Presets */}
                <div className="mb-4">
                  <div className="text-[10px] text-slate-400 mb-2">{t('size_presets')}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetSize(100, 150)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_standard')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(75, 150)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_medium')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(60, 180)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_tall_narrow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(50, 210)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_slim')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(120, 200)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_wide')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(80, 100)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_compact')}
                    </button>
                  </div>
                </div>

                <Slider
                  label={shape === 'cylinder' ? t('outer_diameter') : t('outer_size')}
                  value={shape === 'cylinder' ? outerDiameter : outerSize}
                  onChange={shape === 'cylinder' ? setOuterDiameter : setOuterSize}
                  min={40} max={180}
                />
                <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={220} />
                <Slider label={t('wall_thickness')} value={wallThickness} onChange={setWallThickness} min={2} max={8} step={0.5} />
                <Slider label={t('bottom_thickness')} value={bottomThickness} onChange={setBottomThickness} min={2} max={8} step={0.5} />
                <Slider label={t('base_height')} value={baseHeight} onChange={setBaseHeight} min={0} max={30} step={1} />
                <Slider label={t('base_extension')} value={baseExtension} onChange={setBaseExtension} min={0} max={30} step={1} />
                <Slider
                  label={t('top_extension')}
                  value={topExtension}
                  onChange={setTopExtension}
                  min={0}
                  max={30}
                  step={1}
                />
                <Slider
                  label={t('cornice_height')}
                  value={corniceHeight}
                  onChange={setCorniceHeight}
                  min={4}
                  max={40}
                  step={1}
                />
                {shape === 'square' && (
                  <Slider label={t('corner_radius')} value={cornerRadius} onChange={setCornerRadius} min={0} max={20} />
                )}
              </div>

              {/* CRENELLATIONS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('crenellations')}
                </h2>
                <Slider label={t('num_crenellations')} value={numCrenellations} onChange={setNumCrenellations} min={4} max={16} step={1} />
                <Slider label={t('crenellation_height')} value={crenellationHeight} onChange={setCrenellationHeight} min={10} max={40} />
                <Slider label={t('crenellation_width')} value={crenellationWidth} onChange={setCrenellationWidth} min={0.1} max={0.95} step={0.05} />
              </div>

              {/* DOOR */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('door')}
                </h2>
                <label className="flex items-center gap-3 mb-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasDoor}
                      onChange={(e) => setHasDoor(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('has_door')}</span>
                </label>
                {hasDoor && (
                  <>
                    <Slider label={t('door_width')} value={doorWidth} onChange={setDoorWidth} min={15} max={40} />
                    <Slider label={t('door_height')} value={doorHeight} onChange={setDoorHeight} min={30} max={80} />
                    <Slider label={t('door_recess')} value={doorRecess} onChange={setDoorRecess} min={-10} max={10} step={0.5} />
                  </>
                )}
              </div>

              {/* TOWERS (SQUARE ONLY) */}
              {shape === 'square' && (
                <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                    {t('towers')}
                  </h2>
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" checked={hasTowers} onChange={(e) => setHasTowers(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                    </div>
                    <span className="text-sm text-slate-300">{t('has_towers')}</span>
                  </label>
                  {hasTowers && (
                    <>
                      <Slider label={t('tower_radius')} value={towerRadius} onChange={setTowerRadius} min={4} max={20} />
                      <Slider label={t('tower_height')} value={towerHeight} onChange={setTowerHeight} min={10} max={60} />
                    </>
                  )}
                </div>
              )}

              {/* WINDOWS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('windows')}
                </h2>
                <label className="flex items-center gap-3 mb-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={hasWindows} onChange={(e) => setHasWindows(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('has_windows')}</span>
                </label>
                {hasWindows && (
                  <>
                    <Slider label={t('num_windows')} value={numWindows} onChange={setNumWindows} min={1} max={12} step={1} />
                    <Slider label={t('window_width')} value={windowWidth} onChange={setWindowWidth} min={8} max={30} />
                    <Slider label={t('window_height')} value={windowHeight} onChange={setWindowHeight} min={12} max={40} />
                    <Slider label={t('window_recess')} value={windowRecess} onChange={setWindowRecess} min={-10} max={10} step={0.5} />
                    <label className="flex items-center gap-3 mb-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" checked={windowArched} onChange={(e) => setWindowArched(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                      </div>
                      <span className="text-sm text-slate-300">{t('window_arched')}</span>
                    </label>
                  </>
                )}
              </div>

              {/* CASTLE COLORS & RELIEFS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('color')}
                </h2>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-slate-400">{t('material_color')}</span>
                  <input
                    type="color"
                    value={materialColor}
                    onChange={(e) => setMaterialColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-600"
                  />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-slate-400">{t('door_color')}</span>
                  <input
                    type="color"
                    value={doorColor}
                    onChange={(e) => setDoorColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-600"
                  />
                </div>
                <label className="flex items-center gap-3 mt-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={showBrickTexture} onChange={(e) => setShowBrickTexture(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('brick_texture')}</span>
                </label>
                <label className="flex items-center gap-3 mt-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={embossedBricks} onChange={(e) => setEmbossedBricks(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('embossed_bricks')}</span>
                </label>
                {embossedBricks && (
                  <Slider label={t('brick_depth')} value={brickDepth} onChange={setBrickDepth} min={0.5} max={3} step={0.25} />
                )}
                <label className="flex items-center gap-3 mt-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showCastleRelief}
                      onChange={(e) => setShowCastleRelief(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('has_relief')}</span>
                </label>
                {showCastleRelief && (
                  <div className="mt-3 space-y-3 bg-slate-800/40 p-3 rounded-xl border border-slate-750">
                    <div>
                      <div className="text-xs text-slate-400 mb-1.5">{t('relief_source')}</div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReliefSource('preset_horse')}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            reliefSource === 'preset_horse'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_source_preset')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReliefSource('custom_svg')}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            reliefSource === 'custom_svg'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_source_custom_svg')}
                        </button>
                      </div>
                    </div>

                    {reliefSource === 'custom_svg' && (
                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60">
                        <label className="block w-full cursor-pointer">
                          <input
                            type="file"
                            accept=".svg"
                            onChange={handleSvgUpload}
                            className="hidden"
                          />
                          <div className="w-full py-2 px-3 rounded-md bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold text-center border border-amber-500/40 transition-colors flex items-center justify-center gap-2">
                            <span>📁</span> {t('upload_svg_btn')}
                          </div>
                        </label>
                        <div className="text-[11px] text-slate-400 mt-1.5 text-center truncate">
                          {customSvgName ? `✓ ${customSvgName}` : t('no_svg_selected')}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-slate-400 mb-1.5">{t('relief_mode')}</div>
                      <div className="flex gap-1.5">
                        {['emboss', 'engrave'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setReliefMode(mode)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              reliefMode === mode
                                ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                                : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                            }`}
                          >
                            {t(`relief_mode_${mode}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Slider label={t('relief_depth')} value={castleReliefDepth} onChange={setCastleReliefDepth} min={0.3} max={15} step={0.1} />

                    {/* RÖLYEF DUVAR / DESEN MESAFESİ (GÖMÜLME) */}
                    <div>
                      <Slider
                        label={t('relief_offset')}
                        value={castleReliefOffset}
                        onChange={setCastleReliefOffset}
                        min={-25}
                        max={20}
                        step={0.5}
                      />
                      <div className="grid grid-cols-4 gap-1 mb-3">
                        <button
                          type="button"
                          onClick={() => setCastleReliefOffset(0)}
                          className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                            castleReliefOffset === 0
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_offset_flush')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCastleReliefOffset(-1.5)}
                          className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                            castleReliefOffset === -1.5
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_offset_embed_slight')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCastleReliefOffset(-3)}
                          className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                            castleReliefOffset === -3
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_offset_embed_deep')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCastleReliefOffset(1)}
                          className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                            castleReliefOffset === 1
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_offset_protrude')}
                        </button>
                      </div>
                    </div>
                    <Slider
                      label={`${t('relief_scale')} (${Math.round(Math.min(height * 0.35, 60) * reliefScale)} mm)`}
                      value={reliefScale}
                      onChange={setReliefScale}
                      min={0.5}
                      max={2.0}
                      step={0.05}
                    />

                    {/* RÖLYEF YÜKSEKLİĞİ / DİKEY KONUM */}
                    <Slider
                      label={`${t('relief_elevation')} (${castleReliefElevation} mm)`}
                      value={castleReliefElevation}
                      onChange={setCastleReliefElevation}
                      min={10}
                      max={Math.max(20, Math.round(height - (topExtension > 0 ? corniceHeight : 0) - 10))}
                      step={1}
                    />

                    {/* RÖLYEF CEPHESİ / YÖNÜ */}
                    <div>
                      <div className="text-xs text-slate-400 mb-1.5">{t('relief_facing')}</div>
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {[
                          { label: t('relief_facing_front'), angle: 0 },
                          { label: t('relief_facing_right'), angle: 90 },
                          { label: t('relief_facing_back'), angle: 180 },
                          { label: t('relief_facing_left'), angle: 270 },
                        ].map((item) => (
                          <button
                            key={item.angle}
                            type="button"
                            onClick={() => setCastleReliefAngle(item.angle)}
                            className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              castleReliefAngle === item.angle
                                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <Slider
                        label={`${t('relief_angle')} (${castleReliefAngle}°)`}
                        value={castleReliefAngle}
                        onChange={setCastleReliefAngle}
                        min={0}
                        max={360}
                        step={5}
                      />
                    </div>

                    {/* FİGÜR BAKIŞ YÖNÜ (SOLA / SAĞA) */}
                    <div>
                      <div className="text-xs text-slate-400 mb-1.5">{t('relief_look_direction')}</div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReliefFlipX(false)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            !reliefFlipX
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_look_left')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReliefFlipX(true)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            reliefFlipX
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                          }`}
                        >
                          {t('relief_look_right')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CASTLE TEXT */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    {t('castle_text')}
                  </h2>
                  {castleText && (
                    <button
                      type="button"
                      onClick={() => setCastleText('')}
                      className="text-[10px] text-amber-500/80 hover:text-amber-400 font-medium transition-colors"
                    >
                      {t('clear') || 'Temizle'}
                    </button>
                  )}
                </div>

                {/* YAZI MODU: KABARTMA / GÖMME */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t('castle_text_mode')}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCastleTextMode('emboss')}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        castleTextMode === 'emboss'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      🔤 {t('text_mode_emboss')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextMode('engrave')}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        castleTextMode === 'engrave'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      🔲 {t('text_mode_engrave')}
                    </button>
                  </div>
                </div>

                {/* METİN GİRİŞİ */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('text_label')}</label>
                  <input
                    type="text"
                    value={castleText}
                    onChange={(e) => setCastleText(e.target.value.toLocaleUpperCase('tr-TR'))}
                    className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                    placeholder="Örn: ENDER, KALE, 2026..."
                  />
                </div>

                {/* YAZI TİPİ (FONT) */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('font_label')}</label>
                  <select
                    value={castleFont}
                    onChange={(e) => setCastleFont(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* YERLEŞİM DÜZENİ: TEK CEPHE vs 4 CEPHE */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t('castle_text_repeat')}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCastleTextRepeat('single')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        castleTextRepeat === 'single'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('text_repeat_single')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextRepeat('all_sides')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        castleTextRepeat === 'all_sides'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('text_repeat_all')}
                    </button>
                  </div>
                </div>

                {/* KONUM TİPİ: SERBEST KONUM vs TAÇ */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">{t('castle_text_position')}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCastleTextPosition('custom')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        castleTextPosition === 'custom'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      🎯 {t('text_pos_custom')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextPosition('cornice')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        castleTextPosition === 'cornice'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      👑 {t('text_pos_cornice')}
                    </button>
                  </div>
                </div>

                {/* YERDEN YÜKSEKLİK SLIDER VE HIZLI BUTONLAR (custom ise) */}
                {castleTextPosition === 'custom' && (
                  <div>
                    <Slider
                      label={t('castle_text_elevation')}
                      value={castleTextElevation}
                      onChange={setCastleTextElevation}
                      min={baseHeight + 5}
                      max={height - (topExtension > 0 ? corniceHeight : 0) - 5}
                      step={1}
                    />
                    <div className="flex gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setCastleTextElevation(30)}
                        className="flex-1 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 text-[10px] font-medium"
                      >
                        {t('snap_elev_low')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCastleTextElevation(Math.round(height / 2))}
                        className="flex-1 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 text-[10px] font-medium"
                      >
                        {t('snap_elev_mid')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCastleTextElevation(Math.min(110, height - 20))}
                        className="flex-1 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 text-[10px] font-medium"
                      >
                        {t('snap_elev_high')}
                      </button>
                    </div>
                  </div>
                )}

                {/* AÇI / YÖN SLIDER VE HIZLI BUTONLAR */}
                <div>
                  <Slider
                    label={t('castle_text_angle')}
                    value={castleTextAngle}
                    onChange={setCastleTextAngle}
                    min={0}
                    max={360}
                    step={5}
                  />
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setCastleTextAngle(0)}
                      className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                        castleTextAngle === 0
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('snap_angle_front')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextAngle(90)}
                      className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                        castleTextAngle === 90
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('snap_angle_right')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextAngle(180)}
                      className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                        castleTextAngle === 180
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('snap_angle_back')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCastleTextAngle(270)}
                      className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                        castleTextAngle === 270
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t('snap_angle_left')}
                    </button>
                  </div>
                </div>

                {/* BOYUT VE DERİNLİK SLIDER'LARI */}
                <Slider
                  label={t('castle_text_height')}
                  value={castleTextHeight}
                  onChange={setCastleTextHeight}
                  min={8}
                  max={50}
                  step={1}
                />
                <Slider
                  label={t('castle_text_width_scale')}
                  value={castleTextWidthScale}
                  onChange={setCastleTextWidthScale}
                  min={50}
                  max={160}
                  step={5}
                />
                <Slider
                  label={t('castle_text_depth')}
                  value={castleTextDepth}
                  onChange={setCastleTextDepth}
                  min={0.5}
                  max={5}
                  step={0.25}
                />
                <Slider
                  label={t('castle_text_spacing')}
                  value={castleTextSpacing}
                  onChange={setCastleTextSpacing}
                  min={0}
                  max={8}
                  step={0.5}
                />
              </div>
            </>
          )}

              {/* ==================================== */}
          {/* NAME MODE SETTINGS */}
          {/* ==================================== */}
          {mode === 'name' && (
            <>
              {/* TEXT SETTINGS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('text_settings')}
                </h2>
                
                {/* Custom Name Input */}
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">{t('text_label')}</label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value.toLocaleUpperCase('tr-TR'))}
                    className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Font Selector */}
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">{t('font_label')}</label>
                  <select
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Repeat Toggle */}
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoRepeat}
                      onChange={(e) => setAutoRepeat(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('auto_repeat')}</span>
                </label>

                {/* Dot Connection Type Selector */}
                <div className="mb-2">
                  <div className="text-xs text-slate-400 mb-1.5">{t('dot_connection')}</div>
                  <div className="flex gap-1">
                    {['bridge', 'ring'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDotConnection(type)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                          dotConnection === type
                            ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                            : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                        }`}
                      >
                        {t(`dot_connection_${type}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {!autoRepeat && (
                  <>
                    <Slider label={t('text_arc_angle')} value={textArcAngle} onChange={setTextArcAngle} min={60} max={360} step={10} />
                    <Slider label={t('num_vertical_bars')} value={numVerticalBars} onChange={setNumVerticalBars} min={0} max={30} step={1} />
                  </>
                )}
              </div>

              {/* SHARED DIMENSIONS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('dimensions')}
                </h2>

                {/* Size Presets */}
                <div className="mb-4">
                  <div className="text-[10px] text-slate-400 mb-2">{t('size_presets')}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetSize(100, 150)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_standard')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(75, 150)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_medium')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(60, 180)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_tall_narrow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(50, 210)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_slim')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(120, 200)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_wide')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSize(80, 100)}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      {t('preset_size_compact')}
                    </button>
                  </div>
                </div>

                <Slider label={t('outer_diameter')} value={outerDiameter} onChange={setOuterDiameter} min={40} max={180} />
                <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={220} />
                <Slider label={t('wall_thickness')} value={wallThickness} onChange={setWallThickness} min={2} max={8} step={0.5} />
                <Slider label={t('base_height')} value={baseHeight} onChange={setBaseHeight} min={0} max={30} step={1} />
                <Slider label={t('base_extension')} value={baseExtension} onChange={setBaseExtension} min={0} max={30} step={1} />
              </div>

              {/* CENTRAL COLUMN */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('central_column')}
                </h2>
                <label className="flex items-center gap-3 mb-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasCentralColumn}
                      onChange={(e) => setHasCentralColumn(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('has_central_column')}</span>
                </label>
                {hasCentralColumn && (
                  <Slider
                    label={t('central_column_diameter')}
                    value={centralColumnDiameter}
                    onChange={setCentralColumnDiameter}
                    min={15}
                    max={Math.max(16, outerDiameter - wallThickness * 2 - 10)}
                  />
                )}
              </div>

              {/* DIVIDERS & CONNECTIONS */}
              {hasCentralColumn && (
                <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                  <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                    {t('dividers')}
                  </h2>
                  <div className="mb-4">
                    <div className="text-xs text-slate-400 mb-1.5">{t('divider_mode')}</div>
                    <div className="flex gap-1">
                      {['none', 'support', 'full'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDividerMode(m)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                            dividerMode === m
                              ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                              : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                          }`}
                        >
                          {t(`divider_mode_${m}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {dividerMode !== 'none' && (
                    <Slider label={t('num_dividers')} value={numDividers} onChange={setNumDividers} min={2} max={6} step={1} />
                  )}
                </div>
              )}

              {/* NAME COLORS */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
                <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
                  {t('color')}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{t('material_color')}</span>
                  <input
                    type="color"
                    value={materialColor}
                    onChange={(e) => setMaterialColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-600"
                  />
                </div>
              </div>
            </>
          )}

          {/* ==================================== */}
          {/* PHOTO STAND – HER İKİ MOD İÇİN ORTAK */}
          {/* ==================================== */}
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-3 uppercase">
              {t('photo_stand')}
            </h2>

            {/* Toggle */}
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={hasPhotoStand}
                  onChange={(e) => setHasPhotoStand(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-sm text-slate-300">{t('photo_stand_toggle')}</span>
            </label>

            {hasPhotoStand && (
              <>
                {/* Konum seçici */}
                <div className="mb-4">
                  <div className="text-xs text-slate-400 mb-1.5">{t('photo_stand_position')}</div>
                  <div className="flex gap-1">
                    {['front', 'side', 'back'].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPhotoStandPosition(pos)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                          photoStandPosition === pos
                            ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                            : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                        }`}
                      >
                        {t(`photo_stand_${pos}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Çerçeve Arka Yapısı: Dolu Arka Panel vs Sadece Kenarlıklar */}
                <div className="mb-4">
                  <div className="text-xs text-slate-400 mb-1.5">{t('photo_frame_style')}</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPhotoOnlyEdges(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        !photoOnlyEdges
                          ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                          : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                      }`}
                    >
                      {t('photo_frame_style_solid')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoOnlyEdges(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        photoOnlyEdges
                          ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                          : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                      }`}
                    >
                      {t('photo_frame_style_edges')}
                    </button>
                  </div>
                </div>

                {/* 4 Kenar / Üst Kenarlık Kapat Toggle */}
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={photoHasTopEdge}
                      onChange={(e) => setPhotoHasTopEdge(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-xs text-slate-300 font-medium">{t('photo_has_top_edge')}</span>
                </label>

                {/* Standart boyut presetleri */}
                <div className="mb-4">
                  <div className="text-[10px] text-slate-400 mb-2">{t('photo_size_presets')}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setPhotoWidth(35); setPhotoHeight(45); }}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      3.5 × 4.5 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPhotoWidth(50); setPhotoHeight(70); }}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      5 × 7 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPhotoWidth(75); setPhotoHeight(150); }}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      7.5 × 15 cm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPhotoWidth(100); setPhotoHeight(150); }}
                      className="py-1 px-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 text-[10px] font-medium transition-colors"
                    >
                      10 × 15 cm
                    </button>
                  </div>
                </div>

                {/* Boyut slider'ları */}
                <Slider label={t('photo_width')} value={photoWidth} onChange={setPhotoWidth} min={20} max={150} step={1} />
                <Slider label={t('photo_height')} value={photoHeight} onChange={setPhotoHeight} min={25} max={200} step={1} />
                <Slider label={t('stand_frame_thickness')} value={standFrameThickness} onChange={setStandFrameThickness} min={1} max={6} step={0.5} />
                <Slider label={t('stand_frame_depth')} value={standFrameDepth} onChange={setStandFrameDepth} min={2} max={12} step={0.5} />
                <Slider
                  label={t('photo_slot_depth')}
                  value={photoSlotDepth}
                  onChange={setPhotoSlotDepth}
                  min={0.5}
                  max={5}
                  step={0.1}
                />
                <div className="flex gap-1 mb-3">
                  {[0.8, 1.0, 1.5, 2.0, 3.0].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPhotoSlotDepth(val)}
                      className={`flex-1 py-1 rounded text-[10px] font-medium border transition-colors ${
                        photoSlotDepth === val
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {val} mm
                    </button>
                  ))}
                </div>
                <Slider
                  label={photoOnlyEdges ? t('photo_back_edge_thickness') : t('photo_back_thickness')}
                  value={photoBackThickness}
                  onChange={setPhotoBackThickness}
                  min={1.5}
                  max={15}
                  step={0.5}
                />
                <Slider label={t('photo_distance')} value={photoDistance} onChange={setPhotoDistance} min={-50} max={60} step={0.5} />
                <Slider
                  label={photoStandPosition === 'front' ? t('photo_offset_front') : t('photo_offset_side')}
                  value={photoOffset}
                  onChange={setPhotoOffset}
                  min={-100}
                  max={100}
                  step={1}
                />

                {/* Silme Hizalama Butonları */}
                <div className="flex gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setPhotoOffset(0)}
                    className={`flex-1 py-1 rounded text-[10px] font-medium border transition-colors ${
                      photoOffset === 0
                        ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {t('photo_snap_center')}
                  </button>

                  {photoStandPosition === 'side' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          // Öne silme yasla: çerçevenin ön kenarı kalemliğin ön sınırı ile aynı hizada
                          const caseDepth = shape === 'cylinder' ? outerDiameter : outerSize;
                          const effectiveFrameDepth = Math.max(standFrameDepth, 3.0);
                          const snapOffset = caseDepth / 2 - effectiveFrameDepth;
                          setPhotoOffset(Math.round(snapOffset));
                        }}
                        className="flex-1 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        {t('photo_snap_front')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Arkaya silme yasla: çerçevenin arka kenarı kalemliğin arka sınırı ile aynı hizada
                          const caseDepth = shape === 'cylinder' ? outerDiameter : outerSize;
                          const backPlateThick = Math.max(1.5, photoBackThickness);
                          const snapOffset = -(caseDepth / 2 - backPlateThick);
                          setPhotoOffset(Math.round(snapOffset));
                        }}
                        className="flex-1 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        {t('photo_snap_back')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          // Sola silme yasla: çerçevenin sol kenarı kalemliğin sol kenarı ile aynı hizada
                          const caseWidth = shape === 'cylinder' ? outerDiameter : outerSize;
                          const totalW = photoWidth + standFrameThickness * 2;
                          const snapOffset = -(caseWidth / 2 - totalW / 2);
                          setPhotoOffset(Math.round(snapOffset));
                        }}
                        className="flex-1 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        {t('photo_snap_left')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Sağa silme yasla: çerçevenin sağ kenarı kalemliğin sağ kenarı ile aynı hizada
                          const caseWidth = shape === 'cylinder' ? outerDiameter : outerSize;
                          const totalW = photoWidth + standFrameThickness * 2;
                          const snapOffset = (caseWidth / 2 - totalW / 2);
                          setPhotoOffset(Math.round(snapOffset));
                        }}
                        className="flex-1 py-1 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        {t('photo_snap_right')}
                      </button>
                    </>
                  )}
                </div>

                <Slider label={t('photo_tilt')} value={photoTilt} onChange={setPhotoTilt} min={-45} max={60} step={1} />

                {/* Surlar / Mazgallar Toggle ve Ayarları */}
                <label className="flex items-center gap-3 mt-4 mb-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={photoHasCrenellations}
                      onChange={(e) => setPhotoHasCrenellations(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-xs text-slate-300 font-medium">{t('photo_has_crenellations')}</span>
                </label>

                {photoHasCrenellations && (
                  <>
                    <Slider label={t('photo_num_crenellations')} value={photoNumCrenellations} onChange={setPhotoNumCrenellations} min={2} max={10} step={1} />
                    <Slider label={t('photo_crenellation_height')} value={photoCrenellationHeight} onChange={setPhotoCrenellationHeight} min={3} max={25} step={1} />

                    {/* Sur Hizalaması: Ön / Orta / Arka */}
                    <div className="mb-4">
                      <div className="text-xs text-slate-400 mb-1.5">{t('photo_crenellation_alignment')}</div>
                      <div className="flex gap-1">
                        {['front', 'center', 'back'].map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setPhotoCrenellationAlignment(align)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                              photoCrenellationAlignment === align
                                ? 'bg-amber-600/25 text-amber-400 border border-amber-500/50 shadow-md shadow-amber-900/10'
                                : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                            }`}
                          >
                            {t(`photo_crenellation_align_${align}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* DOWNLOAD BUTTONS */}
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/30 text-xs"
            >
              ⬇ {hasPhotoStand ? t('export_btn') : t('export_btn')}
            </button>

            {hasPhotoStand && (
              <>
                <button
                  onClick={handleExportCombined}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-md text-xs"
                >
                  {t('export_combined_btn')}
                </button>

                <button
                  onClick={handleExportStand}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl transition-colors border border-amber-500/30 hover:border-amber-500/60 text-xs"
                >
                  {t('export_stand_btn')}
                </button>
              </>
            )}

            {/* Renkli Model İndirme (OBJ + MTL Zip) */}
            <button
              onClick={handleExportColored}
              className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-xl transition-colors shadow-md text-xs flex items-center justify-center gap-1.5"
            >
              {t('export_colored_btn')}
            </button>
          </div>

          <div className="text-[10px] text-slate-600 text-center">
            {t('developer')}: <span className="text-amber-700">TA2NLE</span>
          </div>
        </div>

        {/* 3D CANVAS */}
        <div className="flex-1 w-full flex items-center justify-center min-h-[400px] md:min-h-[600px] bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden relative">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-700 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('export_ready')}
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
            <ambientLight intensity={0.85} />
            {/* Ön-Sağ Ana Işık (Gölgeli) */}
            <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            {/* Arka-Sol Ana Işık (Arkadan bakıldığında net görünüm) */}
            <directionalLight position={[-10, 12, -10]} intensity={1.1} />
            {/* Arka-Sağ Dolgu Işığı */}
            <directionalLight position={[10, 10, -10]} intensity={0.8} />
            {/* Ön-Sol Dolgu Işığı */}
            <directionalLight position={[-10, 10, 10]} intensity={0.7} />
            {/* Tepe Işığı (Kalemlik içini ve üst detayları aydınlatır) */}
            <pointLight position={[0, 16, 0]} intensity={0.6} />
            {/* Arka Merkez Dolgu Işığı */}
            <pointLight position={[0, 6, -10]} intensity={0.7} />

            <group ref={mainGroupRef} scale={[SCALE, SCALE, SCALE]}>
              {mode === 'castle' ? (
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
                  cornerRadius={cornerRadius}
                  showBrickTexture={showBrickTexture}
                  embossedBricks={embossedBricks}
                  brickDepth={brickDepth}
                  showCastleRelief={showCastleRelief}
                  reliefSource={reliefSource}
                  customSvgText={customSvgText}
                  castleReliefDepth={castleReliefDepth}
                  reliefMode={reliefMode}
                  reliefScale={reliefScale}
                  castleReliefElevation={castleReliefElevation}
                  castleReliefAngle={castleReliefAngle}
                  castleReliefOffset={castleReliefOffset}
                  reliefFlipX={reliefFlipX}
                  materialColor={materialColor}
                  doorColor={doorColor}
                  topExtension={topExtension}
                  corniceHeight={corniceHeight}
                  castleText={castleText}
                  castleFont={castleFont}
                  castleTextHeight={castleTextHeight}
                  castleTextDepth={castleTextDepth}
                  castleTextMode={castleTextMode}
                  castleTextPosition={castleTextPosition}
                  castleTextElevation={castleTextElevation}
                  castleTextAngle={castleTextAngle}
                  castleTextSpacing={castleTextSpacing}
                  castleTextWidthScale={castleTextWidthScale / 100}
                  castleTextRepeat={castleTextRepeat}
                  groupRef={groupRef}
                />
              ) : (
                <NamePencilCase
                  text={text}
                  fontName={fontName}
                  outerDiameter={outerDiameter}
                  height={height}
                  wallThickness={wallThickness}
                  baseHeight={baseHeight}
                  baseExtension={baseExtension}
                  topRingHeight={8}
                  textArcAngle={textArcAngle}
                  numVerticalBars={numVerticalBars}
                  hasCentralColumn={hasCentralColumn}
                  centralColumnDiameter={centralColumnDiameter}
                  dividerMode={hasCentralColumn ? dividerMode : 'none'}
                  numDividers={numDividers}
                  materialColor={materialColor}
                  groupRef={groupRef}
                  autoRepeat={autoRepeat}
                  dotConnection={dotConnection}
                />
              )}

              {/* ── Vesikalık Fotoğraf Tutacağı ── */}
              {hasPhotoStand && (
                <PhotoStand
                  photoWidth={photoWidth}
                  photoHeight={photoHeight}
                  frameThickness={standFrameThickness}
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

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 uppercase tracking-widest">
            {t('orbit_mode')}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
