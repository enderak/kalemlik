import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import CastlePencilCase from './components/organisms/CastlePencilCase';
import NamePencilCase from './components/organisms/NamePencilCase';
import { useTranslation } from 'react-i18next';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
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
  const [showBrickTexture, setShowBrickTexture] = useState(true);
  const [embossedBricks, setEmbossedBricks] = useState(false);
  const [brickDepth, setBrickDepth] = useState(1.5);
  const [showCastleRelief, setShowCastleRelief] = useState(false);
  const [castleReliefDepth, setCastleReliefDepth] = useState(1);
  const [materialColor, setMaterialColor] = useState('#a8a29e');
  const [doorColor, setDoorColor] = useState('#1c1917');
  const [reliefMode, setReliefMode] = useState('emboss');
  const [reliefScale, setReliefScale] = useState(1.0);

  // Name specific states
  const [text, setText] = useState('SEMİH');
  const [fontName, setFontName] = useState('Plus_Jakarta_Sans_Bold.json');
  const [textArcAngle, setTextArcAngle] = useState(120);
  const [numVerticalBars, setNumVerticalBars] = useState(12);
  const [hasCentralColumn, setHasCentralColumn] = useState(true);
  const [centralColumnDiameter, setCentralColumnDiameter] = useState(30);
  const [dividerMode, setDividerMode] = useState('support');
  const [numDividers, setNumDividers] = useState(3);
  const [autoRepeat, setAutoRepeat] = useState(true);

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
    setHasDoor(false);
    setHasWindows(false);
    setHasTowers(false);
    setShowBrickTexture(false);
    setEmbossedBricks(false);
    setShowCastleRelief(true);
    setReliefMode('engrave');
    setCastleReliefDepth(1.5);
    setReliefScale(1.2);
    setMaterialColor('#262626');
  };

  const groupRef = useRef();

  const handleExport = () => {
    if (!groupRef.current) return;
    const exporter = new STLExporter();

    const origScale = groupRef.current.scale.clone();
    const origRot = groupRef.current.rotation.clone();

    groupRef.current.scale.set(1, 1, 1);
    groupRef.current.rotation.set(0, 0, 0);
    groupRef.current.updateMatrixWorld(true);

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

    groupRef.current.scale.copy(origScale);
    groupRef.current.rotation.copy(origRot);
    groupRef.current.updateMatrixWorld(true);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'TR' ? 'EN' : 'TR');
  };

  const Slider = ({ label, value, onChange, min, max, step = 1 }) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-amber-400 font-bold">{value}</span>
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

  return (
    <div className="min-h-screen w-full bg-[#0f172a] flex flex-col font-sans text-white pb-24 md:pb-0">
      <header className="px-6 py-4 flex justify-between items-center w-full max-w-6xl mx-auto border-b border-slate-800">
        <h1 className="font-bold tracking-tight text-lg text-amber-400">
          {mode === 'name' ? '✏️ ' + t('mode_name').toUpperCase() : '🏰 ' + t('title')}
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
                <button
                  onClick={applyPresetChessRook}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-amber-400 font-bold rounded-lg text-xs transition-all border border-amber-500/20 hover:border-amber-500/50 flex items-center justify-center gap-2"
                >
                  ♟️ {t('preset_chess_rook')}
                </button>
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
                <Slider
                  label={shape === 'cylinder' ? t('outer_diameter') : t('outer_size')}
                  value={shape === 'cylinder' ? outerDiameter : outerSize}
                  onChange={shape === 'cylinder' ? setOuterDiameter : setOuterSize}
                  min={60} max={180}
                />
                <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={220} />
                <Slider label={t('wall_thickness')} value={wallThickness} onChange={setWallThickness} min={2} max={8} step={0.5} />
                <Slider label={t('bottom_thickness')} value={bottomThickness} onChange={setBottomThickness} min={2} max={8} step={0.5} />
                <Slider label={t('base_height')} value={baseHeight} onChange={setBaseHeight} min={0} max={30} step={1} />
                <Slider label={t('base_extension')} value={baseExtension} onChange={setBaseExtension} min={0} max={30} step={1} />
                {shape === 'square' && (
                  <Slider label={t('corner_radius')} value={cornerRadius} onChange={setCornerRadius} min={1} max={20} />
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
                    <input type="checkbox" checked={showCastleRelief} onChange={(e) => setShowCastleRelief(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
                  </div>
                  <span className="text-sm text-slate-300">{t('horse_relief')}</span>
                </label>
                {showCastleRelief && (
                  <>
                    <div className="mt-3 mb-3">
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
                    <Slider label={t('relief_depth')} value={castleReliefDepth} onChange={setCastleReliefDepth} min={0.3} max={4} step={0.1} />
                    <Slider label={t('relief_scale')} value={reliefScale} onChange={setReliefScale} min={0.5} max={2.0} step={0.05} />
                  </>
                )}
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
                    onChange={(e) => setText(e.target.value.toUpperCase())}
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
                <Slider label={t('outer_diameter')} value={outerDiameter} onChange={setOuterDiameter} min={60} max={180} />
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

          {/* DOWNLOAD BUTTON */}
          <button
            onClick={handleExport}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-900/30"
          >
            ⬇ {t('export_btn')}
          </button>

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
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.5} />

            <group scale={[SCALE, SCALE, SCALE]}>
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
                  castleReliefDepth={castleReliefDepth}
                  reliefMode={reliefMode}
                  reliefScale={reliefScale}
                  materialColor={materialColor}
                  doorColor={doorColor}
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
                  dividerMode={dividerMode}
                  numDividers={numDividers}
                  materialColor={materialColor}
                  groupRef={groupRef}
                  autoRepeat={autoRepeat}
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
