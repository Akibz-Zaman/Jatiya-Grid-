import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BANGLADESH_CENTER } from '../../engine/bangladeshData';
import { CorridorFlowState, DivisionId, DivisionState } from '../../engine/types';
import {
  buildCompositeSubstationGroup,
  createSharedSubstationMaterials,
  detectSoftwareWebGL,
  getStatusAccentHex,
} from '../../three/substationModels';

interface ThreeBangladeshGridMapProps {
  divisions: DivisionState[];
  corridors: CorridorFlowState[];
  selectedDivisionId: DivisionId | null;
  onSelectDivision: (id: DivisionId) => void;
}

// Project Bangladesh geographic lat/lng to 3D architectural relief world coordinates (X = East, Z = South)
function geoToWorld(lat: number, lng: number): { x: number; z: number } {
  const scaleX = 3.55;
  const scaleZ = 3.85;
  const x = (lng - BANGLADESH_CENTER.lng) * scaleX;
  const z = -(lat - BANGLADESH_CENTER.lat) * scaleZ;
  return { x, z };
}

// Accurate stylized Bangladesh border polygon (lat, lng) clockwise
const BANGLADESH_OUTLINE_GEO: Array<[number, number]> = [
  [26.62, 88.42], // Panchagarh NW tip
  [26.35, 89.02],
  [26.18, 89.78], // Kurigram NE
  [25.52, 89.84],
  [25.20, 90.35], // Sherpur/Mymensingh north
  [25.18, 91.15], // Sunamganj
  [25.15, 92.22], // Sylhet NE tip
  [24.65, 92.42],
  [24.15, 91.75], // Habiganj/Tripura indent
  [23.72, 91.28], // Cumilla
  [23.08, 91.55], // Feni
  [22.75, 92.28], // Rangamati
  [21.95, 92.62], // Bandarban SE
  [20.82, 92.34], // Teknaf tip
  [21.42, 91.95], // Cox's Bazar coast
  [22.15, 91.76], // Chattogram coast
  [22.65, 91.42], // Noakhali estuary
  [22.25, 90.82], // Bhola
  [21.82, 90.15], // Kuakata / Payra coast
  [21.74, 89.22], // Sundarbans south
  [22.25, 88.98], // Satkhira SW
  [23.28, 88.82], // Jashore west
  [24.12, 88.55], // Rajshahi west
  [24.75, 88.12], // Chapainawabganj west
  [25.65, 88.24], // Dinajpur west
];

// Reusable scratch vectors allocated once outside render loop (zero GC churn)
const _projVec = new THREE.Vector3();
const _packetPos = new THREE.Vector3();
const _packetQuat = new THREE.Quaternion();
const _packetScale = new THREE.Vector3(1, 1, 1);
const _packetMat4 = new THREE.Matrix4();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

export const ThreeBangladeshGridMap: React.FC<ThreeBangladeshGridMapProps> = ({
  divisions,
  corridors,
  selectedDivisionId,
  onSelectDivision,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const badgeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Refs to keep Three.js loop synced with React props without tearing down WebGL
  const divisionsRef = useRef(divisions);
  const corridorsRef = useRef(corridors);
  const selectedIdRef = useRef<DivisionId | null>(selectedDivisionId);
  const accentMatsRef = useRef<Record<string, THREE.MeshStandardMaterial>>({});
  const corridorMatsRef = useRef<Record<string, THREE.MeshStandardMaterial>>({});
  const flyTargetRef = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  divisionsRef.current = divisions;
  corridorsRef.current = corridors;
  selectedIdRef.current = selectedDivisionId;

  // Trigger smooth damped camera transition whenever selectedDivisionId changes
  useEffect(() => {
    if (selectedDivisionId) {
      const div = divisions.find((d) => d.id === selectedDivisionId);
      if (div) {
        const w = geoToWorld(div.position.lat, div.position.lng);
        flyTargetRef.current = {
          pos: new THREE.Vector3(w.x + 2.4, 3.6, w.z + 4.4),
          look: new THREE.Vector3(w.x, 0.45, w.z),
        };
      }
    } else {
      flyTargetRef.current = {
        pos: new THREE.Vector3(0.4, 17.6, 16.4),
        look: new THREE.Vector3(0.1, 0.2, 0.5),
      };
    }
  }, [selectedDivisionId, divisions]);

  // Update dynamic status colors on existing Three.js substation accent materials
  useEffect(() => {
    for (const div of divisions) {
      const mat = accentMatsRef.current[div.id];
      if (mat) {
        const hex = getStatusAccentHex(div.status);
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
      }
    }
    for (const cor of corridors) {
      const mat = corridorMatsRef.current[cor.id];
      if (mat) {
        const hex =
          cor.status === 'congested' ? 0xe11d48 : cor.status === 'loaded' ? 0xd97706 : 0x0284c7;
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
      }
    }
  }, [divisions, corridors]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(320, container.clientWidth || 1000);
    const height = Math.max(320, container.clientHeight || 680);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeaf0f6);
    scene.fog = new THREE.Fog(0xeaf0f6, 26, 62);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.2, 120);
    camera.position.set(0.4, 17.6, 16.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio environment map for crisp metallic gantry & ceramic bushing reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    // Warm directional sunlight + cool architectural hemisphere sky/ground fill
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xcbd5e1, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    keyLight.position.set(12, 22, 10);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -16;
      keyLight.shadow.camera.right = 16;
      keyLight.shadow.camera.top = 16;
      keyLight.shadow.camera.bottom = -16;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.025;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.65);
    rimLight.position.set(-14, 10, -12);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.2, 0.2);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.minPolarAngle = 0.28;
    controls.minDistance = 4.2;
    controls.maxDistance = 30;
    controls.addEventListener('start', () => {
      // Cancel scripted fly-to as soon as user interacts manually
      flyTargetRef.current = null;
    });

    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];

    // Continuous expansive Bay of Bengal & regional base shelf fading smoothly into horizon fog
    const oceanGeo = new THREE.PlaneGeometry(160, 160);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0xdce7f2,
      roughness: 0.88,
      metalness: 0.05,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.02;
    ocean.receiveShadow = true;
    scene.add(ocean);
    disposableGeos.push(oceanGeo);
    disposableMats.push(oceanMat);

    // Subtle architectural latitude/longitude survey grid
    const gridHelper = new THREE.GridHelper(64, 32, 0xcbd5e1, 0xd8e2ec);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // Extruded Bangladesh Landmass Terrain Slab
    const bdShape = new THREE.Shape();
    BANGLADESH_OUTLINE_GEO.forEach(([lat, lng], idx) => {
      const { x, z } = geoToWorld(lat, lng);
      // Shape is in XY plane; after rotateX(-Math.PI/2), shape Y maps to -Z
      if (idx === 0) bdShape.moveTo(x, -z);
      else bdShape.lineTo(x, -z);
    });
    bdShape.closePath();

    const bdGeo = new THREE.ExtrudeGeometry(bdShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    bdGeo.rotateX(-Math.PI / 2);
    const bdMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.85,
      metalness: 0.03,
    });
    const bdMesh = new THREE.Mesh(bdGeo, bdMat);
    bdMesh.position.y = 0.0;
    bdMesh.receiveShadow = true;
    bdMesh.castShadow = !isSoftwareGl;
    scene.add(bdMesh);
    disposableGeos.push(bdGeo);
    disposableMats.push(bdMat);

    // Crisp architectural national border rim
    const borderPoints = BANGLADESH_OUTLINE_GEO.map(([lat, lng]) => {
      const { x, z } = geoToWorld(lat, lng);
      return new THREE.Vector3(x, 0.28, z);
    });
    borderPoints.push(borderPoints[0].clone());
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    scene.add(borderLine);
    disposableGeos.push(borderGeo);
    disposableMats.push(borderMat);

    // Major Bangladesh River Arteries (Jamuna, Padma, Meghna) as subtle inlaid ribbon tubes
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.35,
      metalness: 0.12,
    });
    disposableMats.push(riverMat);

    const riverPaths: Array<Array<[number, number]>> = [
      // Jamuna -> Padma -> Lower Meghna
      [
        [25.95, 89.76],
        [24.95, 89.72],
        [23.82, 89.76],
        [23.45, 90.22],
        [22.75, 90.62],
        [22.15, 90.88],
      ],
      // Ganges / Padma from west
      [
        [24.48, 88.25],
        [24.08, 89.02],
        [23.82, 89.76],
      ],
      // Upper Meghna from Sylhet
      [
        [25.02, 91.62],
        [24.25, 91.02],
        [23.58, 90.68],
        [23.22, 90.58],
      ],
    ];

    for (const rPath of riverPaths) {
      const pts = rPath.map(([lat, lng]) => {
        const { x, z } = geoToWorld(lat, lng);
        return new THREE.Vector3(x, 0.275, z);
      });
      const curve = new THREE.CatmullRomCurve3(pts);
      const rGeo = new THREE.TubeGeometry(curve, 24, 0.085, 6, false);
      const rMesh = new THREE.Mesh(rGeo, riverMat);
      rMesh.scale.y = 0.2;
      scene.add(rMesh);
      disposableGeos.push(rGeo);
    }

    // Build all 8 Composite 3D Electrical Substation Complexes
    const sharedMats = createSharedSubstationMaterials(renderer.capabilities.getMaxAnisotropy());
    const stationAnchors: Record<string, THREE.Vector3> = {};

    for (const div of divisionsRef.current) {
      const { x, z } = geoToWorld(div.position.lat, div.position.lng);
      const { group, accentMat, geometries } = buildCompositeSubstationGroup(
        div.archetype,
        getStatusAccentHex(div.status),
        sharedMats,
        !isSoftwareGl,
      );
      group.position.set(x, 0.27, z);
      group.scale.setScalar(div.id === 'dhaka' || div.id === 'rajshahi' ? 1.05 : 0.92);
      scene.add(group);
      accentMatsRef.current[div.id] = accentMat;
      disposableMats.push(accentMat);
      disposableGeos.push(...geometries);
      stationAnchors[div.id] = new THREE.Vector3(x, 1.55, z);
    }

    // Build 10 High-Voltage Transmission Corridor Curves + InstancedMesh Energy Flow Packets
    interface AnimatedCorridorCurve {
      id: string;
      curve: THREE.QuadraticBezierCurve3;
      phaseOffset: number;
    }
    const corridorCurves: AnimatedCorridorCurve[] = [];

    corridorsRef.current.forEach((cor, idx) => {
      const fromW = geoToWorld(cor.fromPos.lat, cor.fromPos.lng);
      const toW = geoToWorld(cor.toPos.lat, cor.toPos.lng);
      const start = new THREE.Vector3(fromW.x, 0.85, fromW.z);
      const end = new THREE.Vector3(toW.x, 0.85, toW.z);
      const mid = start.clone().lerp(end, 0.5);
      const dist = start.distanceTo(end);
      mid.y = 1.05 + dist * 0.14;

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, cor.voltageKv === 400 ? 0.036 : 0.024, 6, false);
      const corColor =
        cor.status === 'congested' ? 0xe11d48 : cor.status === 'loaded' ? 0xd97706 : 0x0284c7;
      const tubeMat = new THREE.MeshStandardMaterial({
        color: corColor,
        emissive: corColor,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.45,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      corridorMatsRef.current[cor.id] = tubeMat;
      disposableGeos.push(tubeGeo);
      disposableMats.push(tubeMat);
      corridorCurves.push({ id: cor.id, curve, phaseOffset: idx * 0.19 });
    });

    // InstancedMesh for 30 animated energy pulses (3 per corridor)
    const pulsesPerCorridor = 3;
    const totalPulses = corridorCurves.length * pulsesPerCorridor;
    const pulseGeo = new THREE.SphereGeometry(0.085, 10, 10);
    const pulseMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.1,
    });
    const pulseInstanced = new THREE.InstancedMesh(pulseGeo, pulseMat, totalPulses);
    pulseInstanced.frustumCulled = false;
    scene.add(pulseInstanced);
    disposableGeos.push(pulseGeo);
    disposableMats.push(pulseMat);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 85);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateBadgeProjections() {
      const canvasW = renderer.domElement.clientWidth || width;
      const canvasH = renderer.domElement.clientHeight || height;

      for (const div of divisionsRef.current) {
        const el = badgeRefs.current[div.id];
        const anchor = stationAnchors[div.id];
        if (!el || !anchor) continue;

        _projVec.copy(anchor).project(camera);
        if (_projVec.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * canvasW;
        const sy = (-_projVec.y * 0.5 + 0.5) * canvasH;
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      // Damped camera fly-to transition
      if (flyTargetRef.current) {
        const alpha = isSoftwareGl ? 0.38 : 1 - Math.exp(-5.5 * dt);
        _targetCamPos.copy(flyTargetRef.current.pos);
        _targetLookAt.copy(flyTargetRef.current.look);
        camera.position.lerp(_targetCamPos, alpha);
        controls.target.lerp(_targetLookAt, alpha);
        if (
          camera.position.distanceToSquared(_targetCamPos) < 0.01 &&
          controls.target.distanceToSquared(_targetLookAt) < 0.01
        ) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetLookAt);
          flyTargetRef.current = null;
        }
      }

      controls.update();

      // Update energy pulse positions along 10 transmission corridors
      let instanceIdx = 0;
      for (let c = 0; c < corridorCurves.length; c++) {
        const item = corridorCurves[c];
        for (let p = 0; p < pulsesPerCorridor; p++) {
          const t = (elapsed * 0.24 + item.phaseOffset + p / pulsesPerCorridor) % 1;
          item.curve.getPoint(t, _packetPos);
          _packetMat4.compose(_packetPos, _packetQuat, _packetScale);
          pulseInstanced.setMatrixAt(instanceIdx++, _packetMat4);
        }
      }
      pulseInstanced.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
      updateBadgeProjections();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || disposed) return;
      const w = Math.max(300, Math.floor(entry.contentRect.width));
      const h = Math.max(300, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      sharedMats.dispose();
      envTarget.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EAF0F6]">
      {/* Isolated WebGL canvas container (never re-mounted on React HUD updates) */}
      <div
        ref={mountRef}
        data-testid="three-bangladesh-canvas"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Semantic Accessible Projected Floating Percentage Badges directly above each 3D Substation */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {divisions.map((div) => {
          const isSelected = selectedDivisionId === div.id;
          const deltaPrefix = div.deltaPct > 0 ? '+' : '';
          const statusColor =
            div.status === 'critical'
              ? 'text-rose-700 border-rose-300'
              : div.status === 'shedding'
                ? 'text-amber-700 border-amber-300'
                : div.status === 'elevated'
                  ? 'text-sky-700 border-sky-300'
                  : 'text-emerald-700 border-emerald-300';

          return (
            <button
              key={div.id}
              type="button"
              ref={(el) => {
                badgeRefs.current[div.id] = el;
              }}
              onClick={() => onSelectDivision(div.id)}
              aria-label={`Inspect ${div.name} division substation: ${div.allocatedMW} MW, ${div.supplyPct.toFixed(1)}%`}
              style={{ left: 0, top: 0, willChange: 'transform' }}
              className={`absolute pointer-events-auto text-left rounded-lg px-2.5 py-1.5 bg-white/95 border shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                isSelected ? 'border-slate-900 ring-2 ring-slate-900/15 z-20' : statusColor
              }`}
            >
              <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                <span className="text-xs font-bold text-slate-900 leading-tight">{div.name}</span>
                <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                  {div.allocatedMW.toLocaleString()} MW
                </span>
              </div>
              <div className={`font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap ${statusColor.split(' ')[0]}`}>
                {div.supplyPct.toFixed(1)}% ({deltaPrefix}
                {div.deltaPct.toFixed(1)}%)
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
