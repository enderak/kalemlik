import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import CastlePencilCase from './components/organisms/CastlePencilCase';
import { useTranslation } from 'react-i18next';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

const SCALE = 0.05;

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

  const [outerDiameter, setOuterDiameter] = useState(100);
  const [height, setHeight] = useState(150);
  const [wallThickness, setWallThickness] = useState(4);
  const [bottomThickness, setBottomThickness] = useState(4);
  const [numCrenellations, setNumCrenellations] = useState(8);
  const [crenellationHeight, setCrenellationHeight] = useState(20);
  const [hasDoor, setHasDoor] = useState(true);
  const [doorWidth, setDoorWidth] = useState(24);
  const [doorHeight, setDoorHeight] = useState(50);
  const [materialColor, setMaterialColor] = useState('#a8a29e');
  const [doorColor, setDoorColor] = useState('#1c1917');

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
    downloadBlob(blob, `KaleKalemlik_${outerDiameter}x${height}_${Date.now()}.stl`);

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
          🏰 {t('title')}
        </h1>
        <button
          onClick={toggleLang}
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full text-slate-300 transition-colors"
        >
          {i18n.language === 'TR' ? 'EN' : 'TR'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 px-4 sm:px-6 py-6">
        <div className="w-full md:w-72 shrink-0 space-y-4">
          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
              {t('dimensions')}
            </h2>
            <Slider label={t('outer_diameter')} value={outerDiameter} onChange={setOuterDiameter} min={60} max={180} />
            <Slider label={t('height')} value={height} onChange={setHeight} min={80} max={220} />
            <Slider label={t('wall_thickness')} value={wallThickness} onChange={setWallThickness} min={2} max={8} step={0.5} />
            <Slider label={t('bottom_thickness')} value={bottomThickness} onChange={setBottomThickness} min={2} max={8} step={0.5} />
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 mb-4 uppercase">
              {t('crenellations')}
            </h2>
            <Slider label={t('num_crenellations')} value={numCrenellations} onChange={setNumCrenellations} min={4} max={16} step={1} />
            <Slider label={t('crenellation_height')} value={crenellationHeight} onChange={setCrenellationHeight} min={10} max={40} />
          </div>

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
              </>
            )}
          </div>

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
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{t('door_color')}</span>
              <input
                type="color"
                value={doorColor}
                onChange={(e) => setDoorColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-slate-600"
              />
            </div>
          </div>

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

        <div className="flex-1 w-full flex items-center justify-center min-h-[400px] md:min-h-[600px] bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden relative">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-700 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('export_ready')}
          </div>

          <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4, 14], fov: 40 }}>
            <PerspectiveCamera makeDefault position={[0, 4, 14]} fov={40} />
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
              <CastlePencilCase
                outerDiameter={outerDiameter}
                height={height}
                wallThickness={wallThickness}
                bottomThickness={bottomThickness}
                numCrenellations={numCrenellations}
                crenellationHeight={crenellationHeight}
                hasDoor={hasDoor}
                doorWidth={doorWidth}
                doorHeight={doorHeight}
                materialColor={materialColor}
                doorColor={doorColor}
                groupRef={groupRef}
              />
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
