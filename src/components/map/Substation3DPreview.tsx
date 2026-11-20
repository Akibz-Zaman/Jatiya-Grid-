import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DivisionState } from '../../engine/types';
import {
  buildCompositeSubstationGroup,
  createSharedSubstationMaterials,
  detectSoftwareWebGL,
  getStatusAccentHex,
} from '../../three/substationModels';

interface Substation3DPreviewProps {
  division: DivisionState;
}

/**
 * Interactive Three.js 3D Substation Digital Twin viewport rendered inside the
 * Division Zoom Inspector. Uses RoomEnvironment PBR reflections, warm/cool 3-point lighting,
 * software-WebGL pacing (afterDraw), and composite 8-12 part procedural models.
 */
export const Substation3DPreview: React.FC<Substation3DPreviewProps> = ({ division }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const accentMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const archetypeRef = useRef(division.archetype);

  // Update accent material color live without tearing down the WebGL context
  useEffect(() => {
    if (accentMatRef.current) {
      const hex = getStatusAccentHex(division.status);
      accentMatRef.current.color.setHex(hex);
      accentMatRef.current.emissive.setHex(hex);
    }
  }, [division.status]);

  useEffect(() => {
    archetypeRef.current = division.archetype;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(240, container.clientWidth || 320);
    const height = Math.max(150, container.clientHeight || 168);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 5.5, 13.5);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 30);
    camera.position.set(2.35, 1.9, 2.45);
    camera.lookAt(0, 0.35, 0);

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

    // Mandatory studio environment map for PBR metalness/roughness fidelity
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    // Warm key light + Cool Hemisphere fill + Rim backlight
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0xcbd5e1, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(4.5, 6.2, 3.8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(512, 512);
      keyLight.shadow.camera.left = -2.2;
      keyLight.shadow.camera.right = 2.2;
      keyLight.shadow.camera.top = 2.2;
      keyLight.shadow.camera.bottom = -2.2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.75);
    rimLight.position.set(-4, 3, -3.5);
    scene.add(rimLight);

    // Subtle architectural floor pad
    const floorGeo = new THREE.CircleGeometry(3.2, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef5,
      roughness: 0.92,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridRingGeo = new THREE.RingGeometry(1.18, 1.21, 48);
    const gridRingMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      side: THREE.DoubleSide,
    });
    const gridRing = new THREE.Mesh(gridRingGeo, gridRingMat);
    gridRing.rotation.x = -Math.PI / 2;
    gridRing.position.y = 0.008;
    scene.add(gridRing);

    // Composite 3D Substation Model
    const sharedMats = createSharedSubstationMaterials(renderer.capabilities.getMaxAnisotropy());
    const { group: stationGroup, accentMat, geometries } = buildCompositeSubstationGroup(
      division.archetype,
      getStatusAccentHex(division.status),
      sharedMats,
      !isSoftwareGl,
    );
    accentMatRef.current = accentMat;
    scene.add(stationGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    let angle = 0.45;
    let dragging = false;
    let lastPointerX = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastPointerX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      angle += dx * 0.012;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

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
          frameId = window.setTimeout(cb, 90);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      if (!dragging) {
        angle += dt * 0.32;
      }
      stationGroup.rotation.y = angle;
      renderer.render(scene, camera);
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
      const w = Math.max(200, Math.floor(entry.contentRect.width));
      const h = Math.max(140, Math.floor(entry.contentRect.height));
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      accentMatRef.current = null;
      geometries.forEach((g) => g.dispose());
      accentMat.dispose();
      sharedMats.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      gridRingGeo.dispose();
      gridRingMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [division.archetype]);

  return (
    <div className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <div
        ref={mountRef}
        data-testid="substation-3d-preview"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      <div className="pointer-events-none absolute bottom-2 left-2.5 px-2 py-0.5 rounded bg-white/90 border border-slate-200 text-[11px] font-medium text-slate-600">
        3D Substation Digital Twin · Drag to rotate
      </div>
    </div>
  );
};
