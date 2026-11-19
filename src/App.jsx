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
  const [numCrenellations, setNumCrenellations] = useState(16);
  const [crenellationHeight, setCrenellationHeight] = useState(24);
  const [crenellationWidth, setCrenellationWidth] = useState(1);
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
  const [hasTowers, setHasTowers] = useState(false);
  const [towerRadius, setTowerRadius] = useState(15);
  const [towerHeight, setTowerHeight] = useState(35);
  const [towerCrenellations, setTowerCrenellations] = useState(6);
  const [cornerRadius, setCornerRadius] = useState(5);

  // Castle text states
  const [castleText, setCastleText] = useState('');
  const [castleFont, setCastleFont] = useState('Plus_Jakarta_Sans_Bold.json');
  const [castleTextHeight, setCastleTextHeight] = useState(20);
  const [castleTextDepth, setCastleTextDepth] = useState(2);
  const [castleTextMode, setCastleTextMode] = useState('emboss'); // 'emboss' | 'engrave'
  const [castleTextPosition, setCastleTextPosition] = useState('custom'); // 'custom' | 'cornice' | 'wall'
  const [castleTextElevation, setCastleTextElevation] = useState(70); // mm (yerden yukseklik)
  const [castleTextAngle, setCastleTextAngle] = useState(0); // 0: On, 90: Sag, 180: Arka, 270: Sol
  const [castleTextSpacing, setCastleTextSpacing] = useState(1);
  const [castleTextWidthScale, setCastleTextWidthScale] = useState(100); // % (genislik orani, 100 = %100)
  const [castleTextRepeat, setCastleTextRepeat] = useState('single'); // 'single' | 'all_sides'
  const [showBrickTexture, setShowBrickTexture] = useState(true);
  const [numBricksHeight, setNumBricksHeight] = useState(24);
  const [numBricksCircumference, setNumBricksCircumference] = useState(50);
  const [numBricksLength, setNumBricksLength] = useState(2);
  const [embossedBricks, setEmbossedBricks] = useState(true);
  const [brickDepth, setBrickDepth] = useState(1.5);
  const [showCastleRelief, setShowCastleRelief] = useState(false);
  const [castleReliefDepth, setCastleReliefDepth] = useState(1);
  const [materialColor, setMaterialColor] = useState('#a8a29e');
  const [doorColor, setDoorColor] = useState('#1c1917');
  const [reliefMode, setReliefMode] = useState('emboss');
  const [reliefScale, setReliefScale] = useState(1.0);
  const [castleReliefElevation, setCastleReliefElevation] = useState(65);
  const [castleReliefAngle, setCastleReliefAngle] = useState(0);
  const [castleReliefOffset, setCastleReliefOffset] = useState(0);
  const [reliefFlipX, setReliefFlipX] = useState(false);
  const [reliefSource, setReliefSource] = useState('preset');
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
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [dotConnection, setDotConnection] = useState('bridge');
  const [fontSize, setFontSize] = useState(18);
  const [textDepth, setTextDepth] = useState(2);
  const [reliefType, setReliefType] = useState('emboss');

  // Photo Stand states
  const [hasPhotoStand, setHasPhotoStand] = useState(false);
  const [photoWidth, setPhotoWidth] = useState(70);
  const [photoHeight, setPhotoHeight] = useState(100);
  const [standFrameThickness, setStandFrameThickness] = useState(3);
  const [standFrameWidth, setStandFrameWidth] = useState(4);
  const [standFrameDepth, setStandFrameDepth] = useState(5);
  const [photoSlotDepth, setPhotoSlotDepth] = useState(2);
  const [photoOnlyEdges, setPhotoOnlyEdges] = useState(false);
  const [photoHasTopEdge, setPhotoHasTopEdge] = useState(false);
  const [photoBackThickness, setPhotoBackThickness] = useState(1.5);
  const [photoDistance, setPhotoDistance] = useState(0);
  const [photoTilt, setPhotoTilt] = useState(0);
  const [photoHasCrenellations, setPhotoHasCrenellations] = useState(false);
  const [photoNumCrenellations, setPhotoNumCrenellations] = useState(3);
  const [photoCrenellationHeight, setPhotoCrenellationHeight] = useState(8);
  const [photoStandPosition, setPhotoStandPosition] = useState('back');
  const [photoSide, setPhotoSide] = useState('right');
  const [photoCrenellationAlignment, setPhotoCrenellationAlignment] = useState('center');
  const [photoOffset, setPhotoOffset] = useState(0);

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
      version: 2,
      createdAt: new Date().toISOString(),
      mode,
      shape, outerDiameter, outerSize, height, wallThickness, bottomThickness, baseHeight, baseExtension,
      numCrenellations, crenellationHeight, crenellationWidth, hasDoor, doorWidth, doorHeight, doorRecess,
      hasWindows, numWindows, windowWidth, windowHeight, windowRecess, windowArched, hasTowers, towerRadius, towerHeight, cornerRadius,
      topExtension, corniceHeight, corniceChamfer, castleText, castleFont, castleTextHeight, castleTextDepth, castleTextMode,
      castleTextPosition, castleTextElevation, castleTextAngle, castleTextSpacing, castleTextWidthScale, castleTextRepeat,
      showBrickTexture, embossedBricks, brickDepth, showCastleRelief, castleReliefDepth, materialColor, doorColor, reliefMode,
      reliefScale, castleReliefElevation, castleReliefAngle, castleReliefOffset, reliefFlipX, reliefSource, customSvgText, customSvgName,
      text, fontName, textArcAngle, numVerticalBars, hasCentralColumn, centralColumnDiameter, dividerMode, numDividers, autoRepeat, dotConnection,
      hasPhotoStand, photoStandPosition, photoWidth, photoHeight, standFrameThickness, standFrameDepth, photoSlotDepth, photoOnlyEdges, photoHasTopEdge, photoBackThickness, photoDistance, photoTilt, photoHasCrenellations, photoNumCrenellations, photoCrenellationHeight, photoCrenellationAlignment, photoOffset,
      hasNoteHolder, notePosition, noteSide, noteWidth, noteDepth, noteHeight, noteWallThickness, noteDistance, noteOffset, hasThumbCutout, thumbCutoutWidth, thumbCutoutDepth, noteColor, showSamplePaper,
      medicalRole, medicalCoatWidth, medicalCoatDepth, medicalCavityWidth, medicalCavityDepth, medicalHeight, medicalWallThickness, medicalBottomThickness, medicalBaseShape, medicalBaseWidth, medicalBaseDepth, medicalBaseThickness, medicalBaseCornerRadius, medicalBaseColor, medicalCoatColor, medicalCollarColor, medicalInnerShirtColor, medicalButtonColor, medicalTextColor, medicalStethoscopeColor, medicalBackText, medicalBackTextStyle, medicalPlateColor, medicalBackTextHeight, medicalBackTextDepth, medicalBackTextElevation, medicalFrontText, medicalFrontTextHeight, medicalFrontTextDepth, medicalFrontTextElevation, medicalCollarOpeningWidth, medicalFontName,
      jerseyTeam, jerseyPattern, jerseyPrimaryColor, jerseySecondaryColor, jerseyAccentColor, jerseyTextColor, jerseyTorsoWidth, jerseyTorsoDepth, jerseyHeight, jerseyWallThickness, jerseyBottomThickness, jerseyCornerRadius, hasSponsor, frontText, frontTextHeight, frontTextDepth, frontTextElevation, hasFrontNumber, frontNumber, frontNumberHeight, hasBadge, badgeText, stars, badgeElevation, hasBackName, backName, backNameHeight, backNameDepth, backNameElevation, hasBackNumber, backNumber, backNumberHeight, backNumberDepth, backNumberElevation, hasShorts, shortsColor, jerseyFontName, hasJerseyDivider, jerseyCollarType, hasJerseyTextSupport, jerseySleeveAngle, jerseyTextSupportAngle, jerseyBaseShape, jerseyBaseThickness, jerseyBaseWidth, jerseyBaseDepth, jerseyBaseCornerRadius, jerseyBaseColor
    };
  };

  const applyConfig = (cfg) => {
    if (!cfg || typeof cfg !== 'object') return;
    if (cfg.mode !== undefined) setMode(cfg.mode);
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
    if (cfg.corniceChamfer !== undefined) setCorniceChamfer(cfg.corniceChamfer);
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
    if (cfg.hasPhotoStand !== undefined) setHasPhotoStand(cfg.hasPhotoStand);
    if (cfg.photoStandPosition !== undefined) setPhotoStandPosition(cfg.photoStandPosition);
    if (cfg.photoWidth !== undefined) setPhotoWidth(cfg.photoWidth);
    if (cfg.photoHeight !== undefined) setPhotoHeight(cfg.photoHeight);
    if (cfg.standFrameThickness !== undefined) { setStandFrameThickness(cfg.standFrameThickness); setStandFrameWidth(cfg.standFrameThickness); }
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
    if (cfg.hasNoteHolder !== undefined) setHasNoteHolder(cfg.hasNoteHolder);
    if (cfg.notePosition !== undefined) setNotePosition(cfg.notePosition);
    if (cfg.noteSide !== undefined) setNoteSide(cfg.noteSide);
    if (cfg.noteWidth !== undefined) setNoteWidth(cfg.noteWidth);
    if (cfg.noteDepth !== undefined) setNoteDepth(cfg.noteDepth);
    if (cfg.noteHeight !== undefined) setNoteHeight(cfg.noteHeight);
    if (cfg.noteWallThickness !== undefined) setNoteWallThickness(cfg.noteWallThickness);
    if (cfg.noteDistance !== undefined) setNoteDistance(cfg.noteDistance);
    if (cfg.noteOffset !== undefined) setNoteOffset(cfg.noteOffset);
    if (cfg.hasThumbCutout !== undefined) setHasThumbCutout(cfg.hasThumbCutout);
    if (cfg.thumbCutoutWidth !== undefined) setThumbCutoutWidth(cfg.thumbCutoutWidth);
    if (cfg.thumbCutoutDepth !== undefined) setThumbCutoutDepth(cfg.thumbCutoutDepth);
    if (cfg.noteColor !== undefined) setNoteColor(cfg.noteColor);
    if (cfg.showSamplePaper !== undefined) setShowSamplePaper(cfg.showSamplePaper);
    if (cfg.medicalRole !== undefined) setMedicalRole(cfg.medicalRole);
    if (cfg.medicalCoatWidth !== undefined) setMedicalCoatWidth(cfg.medicalCoatWidth);
    if (cfg.medicalCoatDepth !== undefined) setMedicalCoatDepth(cfg.medicalCoatDepth);
    if (cfg.medicalCavityWidth !== undefined) setMedicalCavityWidth(cfg.medicalCavityWidth);
    if (cfg.medicalCavityDepth !== undefined) setMedicalCavityDepth(cfg.medicalCavityDepth);
    if (cfg.medicalHeight !== undefined) setMedicalHeight(cfg.medicalHeight);
    if (cfg.medicalWallThickness !== undefined) setMedicalWallThickness(cfg.medicalWallThickness);
    if (cfg.medicalBottomThickness !== undefined) setMedicalBottomThickness(cfg.medicalBottomThickness);
    if (cfg.medicalBaseShape !== undefined) setMedicalBaseShape(cfg.medicalBaseShape);
    if (cfg.medicalBaseWidth !== undefined) setMedicalBaseWidth(cfg.medicalBaseWidth);
    if (cfg.medicalBaseDepth !== undefined) setMedicalBaseDepth(cfg.medicalBaseDepth);
    if (cfg.medicalBaseThickness !== undefined) setMedicalBaseThickness(cfg.medicalBaseThickness);
    if (cfg.medicalBaseCornerRadius !== undefined) setMedicalBaseCornerRadius(cfg.medicalBaseCornerRadius);
    if (cfg.medicalBaseColor !== undefined) setMedicalBaseColor(cfg.medicalBaseColor);
    if (cfg.medicalCoatColor !== undefined) setMedicalCoatColor(cfg.medicalCoatColor);
    if (cfg.medicalCollarColor !== undefined) setMedicalCollarColor(cfg.medicalCollarColor);
    if (cfg.medicalInnerShirtColor !== undefined) setMedicalInnerShirtColor(cfg.medicalInnerShirtColor);
    if (cfg.medicalButtonColor !== undefined) setMedicalButtonColor(cfg.medicalButtonColor);
    if (cfg.medicalTextColor !== undefined) setMedicalTextColor(cfg.medicalTextColor);
    if (cfg.medicalStethoscopeColor !== undefined) setMedicalStethoscopeColor(cfg.medicalStethoscopeColor);
    if (cfg.medicalBackText !== undefined) setMedicalBackText(cfg.medicalBackText);
    if (cfg.medicalBackTextStyle !== undefined) setMedicalBackTextStyle(cfg.medicalBackTextStyle);
    if (cfg.medicalPlateColor !== undefined) setMedicalPlateColor(cfg.medicalPlateColor);
    if (cfg.medicalBackTextHeight !== undefined) setMedicalBackTextHeight(cfg.medicalBackTextHeight);
    if (cfg.medicalBackTextDepth !== undefined) setMedicalBackTextDepth(cfg.medicalBackTextDepth);
    if (cfg.medicalBackTextElevation !== undefined) setMedicalBackTextElevation(cfg.medicalBackTextElevation);
    if (cfg.medicalFrontText !== undefined) setMedicalFrontText(cfg.medicalFrontText);
    if (cfg.medicalFrontTextHeight !== undefined) setMedicalFrontTextHeight(cfg.medicalFrontTextHeight);
    if (cfg.medicalFrontTextDepth !== undefined) setMedicalFrontTextDepth(cfg.medicalFrontTextDepth);
    if (cfg.medicalFrontTextElevation !== undefined) setMedicalFrontTextElevation(cfg.medicalFrontTextElevation);
    if (cfg.medicalCollarOpeningWidth !== undefined) setMedicalCollarOpeningWidth(cfg.medicalCollarOpeningWidth);
    if (cfg.medicalFontName !== undefined) setMedicalFontName(cfg.medicalFontName);
    if (cfg.jerseyTeam !== undefined) setJerseyTeam(cfg.jerseyTeam);
    if (cfg.jerseyPattern !== undefined) setJerseyPattern(cfg.jerseyPattern);
    if (cfg.jerseyPrimaryColor !== undefined) setJerseyPrimaryColor(cfg.jerseyPrimaryColor);
    if (cfg.jerseySecondaryColor !== undefined) setJerseySecondaryColor(cfg.jerseySecondaryColor);
    if (cfg.jerseyAccentColor !== undefined) setJerseyAccentColor(cfg.jerseyAccentColor);
    if (cfg.jerseyTextColor !== undefined) setJerseyTextColor(cfg.jerseyTextColor);
    if (cfg.jerseyTorsoWidth !== undefined) setJerseyTorsoWidth(cfg.jerseyTorsoWidth);
    if (cfg.jerseyTorsoDepth !== undefined) setJerseyTorsoDepth(cfg.jerseyTorsoDepth);
    if (cfg.jerseyHeight !== undefined) setJerseyHeight(cfg.jerseyHeight);
    if (cfg.jerseyWallThickness !== undefined) setJerseyWallThickness(cfg.jerseyWallThickness);
    if (cfg.jerseyBottomThickness !== undefined) setJerseyBottomThickness(cfg.jerseyBottomThickness);
    if (cfg.jerseyCornerRadius !== undefined) setJerseyCornerRadius(cfg.jerseyCornerRadius);
    if (cfg.hasSponsor !== undefined) setHasSponsor(cfg.hasSponsor);
    if (cfg.frontText !== undefined) setFrontText(cfg.frontText);
    if (cfg.frontTextHeight !== undefined) setFrontTextHeight(cfg.frontTextHeight);
    if (cfg.frontTextDepth !== undefined) setFrontTextDepth(cfg.frontTextDepth);
    if (cfg.frontTextElevation !== undefined) setFrontTextElevation(cfg.frontTextElevation);
    if (cfg.hasFrontNumber !== undefined) setHasFrontNumber(cfg.hasFrontNumber);
    if (cfg.frontNumber !== undefined) setFrontNumber(cfg.frontNumber);
    if (cfg.frontNumberHeight !== undefined) setFrontNumberHeight(cfg.frontNumberHeight);
    if (cfg.hasBadge !== undefined) setHasBadge(cfg.hasBadge);
    if (cfg.badgeText !== undefined) setBadgeText(cfg.badgeText);
    if (cfg.stars !== undefined) setStars(cfg.stars);
    if (cfg.badgeElevation !== undefined) setBadgeElevation(cfg.badgeElevation);
    if (cfg.hasBackName !== undefined) setHasBackName(cfg.hasBackName);
    if (cfg.backName !== undefined) setBackName(cfg.backName);
    if (cfg.backNameHeight !== undefined) setBackNameHeight(cfg.backNameHeight);
    if (cfg.backNameDepth !== undefined) setBackNameDepth(cfg.backNameDepth);
    if (cfg.backNameElevation !== undefined) setBackNameElevation(cfg.backNameElevation);
    if (cfg.hasBackNumber !== undefined) setHasBackNumber(cfg.hasBackNumber);
    if (cfg.backNumber !== undefined) setBackNumber(cfg.backNumber);
    if (cfg.backNumberHeight !== undefined) setBackNumberHeight(cfg.backNumberHeight);
    if (cfg.backNumberDepth !== undefined) setBackNumberDepth(cfg.backNumberDepth);
    if (cfg.backNumberElevation !== undefined) setBackNumberElevation(cfg.backNumberElevation);
    if (cfg.hasShorts !== undefined) setHasShorts(cfg.hasShorts);
    if (cfg.shortsColor !== undefined) setShortsColor(cfg.shortsColor);
    if (cfg.jerseyFontName !== undefined) setJerseyFontName(cfg.jerseyFontName);
    if (cfg.hasJerseyDivider !== undefined) setHasJerseyDivider(cfg.hasJerseyDivider);
    if (cfg.jerseyCollarType !== undefined) setJerseyCollarType(cfg.jerseyCollarType);
    if (cfg.hasJerseyTextSupport !== undefined) setHasJerseyTextSupport(cfg.hasJerseyTextSupport);
    if (cfg.jerseySleeveAngle !== undefined) setJerseySleeveAngle(cfg.jerseySleeveAngle);
    if (cfg.jerseyTextSupportAngle !== undefined) setJerseyTextSupportAngle(cfg.jerseyTextSupportAngle);
    if (cfg.jerseyBaseShape !== undefined) setJerseyBaseShape(cfg.jerseyBaseShape);
    if (cfg.jerseyBaseThickness !== undefined) setJerseyBaseThickness(cfg.jerseyBaseThickness);
    if (cfg.jerseyBaseWidth !== undefined) setJerseyBaseWidth(cfg.jerseyBaseWidth);
    if (cfg.jerseyBaseDepth !== undefined) setJerseyBaseDepth(cfg.jerseyBaseDepth);
    if (cfg.jerseyBaseCornerRadius !== undefined) setJerseyBaseCornerRadius(cfg.jerseyBaseCornerRadius);
    if (cfg.jerseyBaseColor !== undefined) setJerseyBaseColor(cfg.jerseyBaseColor);
  };

  const handleSaveTemplate = () => {
    const name = templateNameInput.trim() || `Şablon ${customTemplates.length + 1}`;
    const newTemplate = { id: Date.now().toString(), name, config: getCurrentConfig() };
    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    try { localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated)); } catch (e) { console.error(e); }
    setTemplateNameInput('');
  };

  const handleDeleteTemplate = (id) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try { localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated)); } catch (e) { console.error(e); }
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
          const newTemplate = { id: Date.now().toString(), name: templateName, config: parsed };
          const updated = [newTemplate, ...customTemplates.filter(t => t.name !== templateName)];
          setCustomTemplates(updated);
          try { localStorage.setItem('kalemlik_custom_templates', JSON.stringify(updated)); } catch (err) { console.error(err); }
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
    const maxCentralCol = Math.max(15, d - wallThickness * 2 - 10);
    if (centralColumnDiameter > maxCentralCol) {
      setCentralColumnDiameter(maxCentralCol);
    }
  };
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
  const [medicalBackText, setMedicalBackText] = useState('TIBBİ\nSEKRETER');
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
                    Sırt Yazısı (Satır satır - Örn: TIBBİ / SEKRETER):
                  </label>
                  <textarea
                    rows={3}
                    value={medicalBackText}
                    onChange={(e) => setMedicalBackText(e.target.value)}
                    placeholder="TIBBİ&#10;SEKRETER"
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
