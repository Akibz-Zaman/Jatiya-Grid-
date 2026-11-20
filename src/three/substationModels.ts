import * as THREE from 'three';
import { DivisionState, SubstationArchetype } from '../engine/types';

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArchitecturalConcreteBumpTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  // Subtle architectural formwork seam grid + fine concrete aggregate grain
  ctx.strokeStyle = '#686868';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  for (let i = 0; i < 650; i++) {
    const x = (i * 47) % size;
    const y = (i * 83) % size;
    const shade = 115 + ((i * 19) % 28);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function getStatusAccentHex(status: DivisionState['status']): number {
  switch (status) {
    case 'nominal':
      return 0x059669; // Emerald
    case 'elevated':
      return 0x0284c7; // Sky Blue
    case 'shedding':
      return 0xd97706; // Amber
    case 'critical':
      return 0xe11d48; // Rose
  }
}

export interface SharedSubstationMaterials {
  plinth: THREE.MeshStandardMaterial;
  concreteWall: THREE.MeshStandardMaterial;
  roofCap: THREE.MeshStandardMaterial;
  steelGantry: THREE.MeshStandardMaterial;
  transformerBody: THREE.MeshStandardMaterial;
  copperBus: THREE.MeshStandardMaterial;
  insulatorCeramic: THREE.MeshStandardMaterial;
  glassFacade: THREE.MeshStandardMaterial;
  shadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createSharedSubstationMaterials(maxAnisotropy: number): SharedSubstationMaterials {
  const bumpTex = createArchitecturalConcreteBumpTexture();
  bumpTex.anisotropy = Math.min(4, maxAnisotropy);
  const shadowTex = createRadialContactShadowTexture();

  const plinth = new THREE.MeshStandardMaterial({
    color: 0xd8e0ea,
    roughness: 0.84,
    metalness: 0.04,
    bumpMap: bumpTex,
    bumpScale: 0.015,
  });

  const concreteWall = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.72,
    metalness: 0.06,
    bumpMap: bumpTex,
    bumpScale: 0.012,
  });

  const roofCap = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.35,
  });

  const steelGantry = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.32,
    metalness: 0.82,
  });

  const transformerBody = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.38,
    metalness: 0.62,
  });

  const copperBus = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.22,
    metalness: 0.88,
  });

  const insulatorCeramic = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.12,
  });

  const glassFacade = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.14,
    metalness: 0.25,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  return {
    plinth,
    concreteWall,
    roofCap,
    steelGantry,
    transformerBody,
    copperBus,
    insulatorCeramic,
    glassFacade,
    shadowMat,
    dispose: () => {
      bumpTex.dispose();
      shadowTex.dispose();
      plinth.dispose();
      concreteWall.dispose();
      roofCap.dispose();
      steelGantry.dispose();
      transformerBody.dispose();
      copperBus.dispose();
      insulatorCeramic.dispose();
      glassFacade.dispose();
      shadowMat.dispose();
    },
  };
}

/**
 * Builds a composite 8–12 part architectural electrical substation THREE.Group
 * grounded flush at y = 0 with a soft radial contact shadow and dynamic status accent strip.
 */
export function buildCompositeSubstationGroup(
  archetype: SubstationArchetype,
  accentHex: number,
  mats: SharedSubstationMaterials,
  castShadow: boolean,
): { group: THREE.Group; accentMat: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.22,
    roughness: 0.3,
    metalness: 0.2,
  });

  // 1. Soft radial contact shadow plane directly at ground level (y = 0.015)
  const shadowGeo = track(new THREE.PlaneGeometry(2.35, 2.35));
  const shadowMesh = new THREE.Mesh(shadowGeo, mats.shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  group.add(shadowMesh);

  // 2. Beveled concrete foundation plinth (ExtrudeGeometry)
  const plinthShape = new THREE.Shape();
  const pw = 0.86;
  const pd = 0.72;
  const r = 0.08;
  plinthShape.moveTo(-pw + r, -pd);
  plinthShape.lineTo(pw - r, -pd);
  plinthShape.quadraticCurveTo(pw, -pd, pw, -pd + r);
  plinthShape.lineTo(pw, pd - r);
  plinthShape.quadraticCurveTo(pw, pd, pw - r, pd);
  plinthShape.lineTo(-pw + r, pd);
  plinthShape.quadraticCurveTo(-pw, pd, -pw, pd - r);
  plinthShape.lineTo(-pw, -pd + r);
  plinthShape.quadraticCurveTo(-pw, -pd, -pw + r, -pd);

  const plinthGeo = track(
    new THREE.ExtrudeGeometry(plinthShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    }),
  );
  plinthGeo.rotateX(-Math.PI / 2);
  const plinthMesh = new THREE.Mesh(plinthGeo, mats.plinth);
  plinthMesh.position.y = 0.02;
  plinthMesh.castShadow = castShadow;
  plinthMesh.receiveShadow = true;
  group.add(plinthMesh);

  // 3. Primary GIS Control Hall Building + Roof Parapet + Accent Band
  const hallW = archetype === 'gis_metro' ? 0.92 : 0.78;
  const hallH = archetype === 'gis_metro' ? 0.56 : 0.44;
  const hallD = 0.52;
  const hallGeo = track(new THREE.BoxGeometry(hallW, hallH, hallD));
  const hallMesh = new THREE.Mesh(hallGeo, mats.concreteWall);
  hallMesh.position.set(-0.26, 0.14 + hallH / 2, -0.1);
  hallMesh.castShadow = castShadow;
  hallMesh.receiveShadow = true;
  group.add(hallMesh);

  // Stepped metallic roof cap
  const roofGeo = track(new THREE.BoxGeometry(hallW + 0.06, 0.07, hallD + 0.06));
  const roofMesh = new THREE.Mesh(roofGeo, mats.roofCap);
  roofMesh.position.set(-0.26, 0.14 + hallH + 0.035, -0.1);
  roofMesh.castShadow = castShadow;
  group.add(roofMesh);

  // Architectural glass control-room strip
  const glassGeo = track(new THREE.BoxGeometry(hallW * 0.72, 0.12, 0.03));
  const glassMesh = new THREE.Mesh(glassGeo, mats.glassFacade);
  glassMesh.position.set(-0.26, 0.14 + hallH * 0.62, -0.1 + hallD / 2 + 0.01);
  group.add(glassMesh);

  // Dynamic status architectural trim band wrapping top fascia
  const trimGeo = track(new THREE.BoxGeometry(hallW + 0.08, 0.045, hallD + 0.08));
  const trimMesh = new THREE.Mesh(trimGeo, accentMat);
  trimMesh.position.set(-0.26, 0.14 + hallH - 0.02, -0.1);
  group.add(trimMesh);

  // 4. Twin Step-Up Power Transformers with Cooling Radiators
  const txGeo = track(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 16));
  const finGeo = track(new THREE.BoxGeometry(0.28, 0.24, 0.04));
  const insulatorGeo = track(new THREE.CylinderGeometry(0.022, 0.032, 0.22, 10));

  for (let i = 0; i < 2; i++) {
    const zOff = i === 0 ? -0.2 : 0.22;
    const tx = new THREE.Mesh(txGeo, mats.transformerBody);
    tx.position.set(0.42, 0.14 + 0.17, zOff);
    tx.castShadow = castShadow;
    group.add(tx);

    const fin = new THREE.Mesh(finGeo, mats.steelGantry);
    fin.position.set(0.42, 0.14 + 0.16, zOff);
    group.add(fin);

    // Dual ceramic high-voltage bushings per transformer
    const bush1 = new THREE.Mesh(insulatorGeo, mats.insulatorCeramic);
    bush1.position.set(0.38, 0.14 + 0.42, zOff - 0.04);
    group.add(bush1);
    const bush2 = new THREE.Mesh(insulatorGeo, mats.insulatorCeramic);
    bush2.position.set(0.46, 0.14 + 0.42, zOff + 0.04);
    group.add(bush2);
  }

  // 5. High-Voltage 400kV Steel Gantry Portal Frame + Copper Overhead Busbars
  const pillarGeo = track(new THREE.CylinderGeometry(0.03, 0.042, 0.92, 8));
  const beamGeo = track(new THREE.BoxGeometry(0.055, 0.055, 0.96));

  const pylonL = new THREE.Mesh(pillarGeo, mats.steelGantry);
  pylonL.position.set(0.66, 0.14 + 0.46, -0.44);
  pylonL.castShadow = castShadow;
  group.add(pylonL);

  const pylonR = new THREE.Mesh(pillarGeo, mats.steelGantry);
  pylonR.position.set(0.66, 0.14 + 0.46, 0.44);
  pylonR.castShadow = castShadow;
  group.add(pylonR);

  const crossBeam = new THREE.Mesh(beamGeo, mats.steelGantry);
  crossBeam.position.set(0.66, 0.14 + 0.84, 0);
  crossBeam.castShadow = castShadow;
  group.add(crossBeam);

  // Copper busbar tube connecting transformers to gantry
  const busCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.42, 0.62, -0.2),
    new THREE.Vector3(0.56, 0.78, -0.2),
    new THREE.Vector3(0.66, 0.96, -0.2),
  ]);
  const busGeo = track(new THREE.TubeGeometry(busCurve, 12, 0.016, 6, false));
  const bus1 = new THREE.Mesh(busGeo, mats.copperBus);
  group.add(bus1);
  const bus2 = new THREE.Mesh(busGeo, mats.copperBus);
  bus2.position.z = 0.42;
  group.add(bus2);

  // 6. Archetype-Specific Landmark Hero Structure
  if (archetype === 'nuclear') {
    // Rooppur VVER-1200 Iconic Hyperbolic Cooling Tower (LatheGeometry) + Containment Dome
    const lathePts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const y = t * 1.12;
      const radius = 0.25 - Math.sin(t * Math.PI * 0.85) * 0.095 + (t > 0.7 ? (t - 0.7) * 0.14 : 0);
      lathePts.push(new THREE.Vector2(radius, y));
    }
    const towerGeo = track(new THREE.LatheGeometry(lathePts, 20));
    const towerMesh = new THREE.Mesh(towerGeo, mats.concreteWall);
    towerMesh.position.set(-0.34, 0.14, 0.34);
    towerMesh.castShadow = castShadow;
    group.add(towerMesh);

    // Top ring collar on cooling tower
    const collarGeo = track(new THREE.TorusGeometry(0.195, 0.018, 8, 20));
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, accentMat);
    collar.position.set(-0.34, 1.24, 0.34);
    group.add(collar);

    // Containment reactor dome
    const domeBaseGeo = track(new THREE.CylinderGeometry(0.22, 0.23, 0.36, 18));
    const domeBase = new THREE.Mesh(domeBaseGeo, mats.plinth);
    domeBase.position.set(0.08, 0.14 + 0.18, 0.32);
    domeBase.castShadow = castShadow;
    group.add(domeBase);

    const domeCapGeo = track(new THREE.SphereGeometry(0.22, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    const domeCap = new THREE.Mesh(domeCapGeo, mats.concreteWall);
    domeCap.position.set(0.08, 0.14 + 0.36, 0.32);
    group.add(domeCap);
  } else if (archetype === 'hvdc_thermal') {
    // Twin Thermal / HVDC Converter Stacks (Khulna Bheramara/Rampal & Barishal Payra)
    const stackGeo = track(new THREE.CylinderGeometry(0.065, 0.095, 0.98, 14));
    const stack1 = new THREE.Mesh(stackGeo, mats.concreteWall);
    stack1.position.set(-0.42, 0.14 + 0.49, 0.34);
    stack1.castShadow = castShadow;
    group.add(stack1);

    const stack2 = new THREE.Mesh(stackGeo, mats.concreteWall);
    stack2.position.set(-0.14, 0.14 + 0.49, 0.34);
    stack2.castShadow = castShadow;
    group.add(stack2);

    const ringGeo = track(new THREE.CylinderGeometry(0.072, 0.072, 0.07, 14));
    const ring1 = new THREE.Mesh(ringGeo, accentMat);
    ring1.position.set(-0.42, 0.98, 0.34);
    group.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, accentMat);
    ring2.position.set(-0.14, 0.98, 0.34);
    group.add(ring2);
  } else if (archetype === 'gis_metro') {
    // Dhaka Aminbazar 400kV GIS Architectural Skylight Monitors & Secondary Wing
    const wingGeo = track(new THREE.BoxGeometry(0.56, 0.34, 0.34));
    const wing = new THREE.Mesh(wingGeo, mats.concreteWall);
    wing.position.set(-0.24, 0.14 + 0.17, 0.34);
    wing.castShadow = castShadow;
    group.add(wing);

    const monitorGeo = track(new THREE.BoxGeometry(0.66, 0.11, 0.16));
    const monitor = new THREE.Mesh(monitorGeo, mats.glassFacade);
    monitor.position.set(-0.26, 0.14 + hallH + 0.11, -0.1);
    group.add(monitor);
  } else if (archetype === 'gas_hub') {
    // Sylhet Bibiyana CCGT Turbine Exhaust & Gas Manifold
    const ductGeo = track(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 12));
    const duct = new THREE.Mesh(ductGeo, mats.steelGantry);
    duct.position.set(-0.34, 0.14 + 0.39, 0.34);
    duct.castShadow = castShadow;
    group.add(duct);

    const tankGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 14));
    tankGeo.rotateZ(Math.PI / 2);
    const tank = new THREE.Mesh(tankGeo, mats.concreteWall);
    tank.position.set(0.02, 0.14 + 0.16, 0.34);
    group.add(tank);
  } else if (archetype === 'coastal_port') {
    // Chattogram Matarbari / Port 400kV Switchyard Bay + Twin Cooling Units
    const bayGeo = track(new THREE.BoxGeometry(0.62, 0.3, 0.32));
    const bay = new THREE.Mesh(bayGeo, mats.plinth);
    bay.position.set(-0.22, 0.14 + 0.15, 0.34);
    bay.castShadow = castShadow;
    group.add(bay);

    const fanGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14));
    const fan1 = new THREE.Mesh(fanGeo, mats.roofCap);
    fan1.position.set(-0.36, 0.48, 0.34);
    group.add(fan1);
    const fan2 = new THREE.Mesh(fanGeo, mats.roofCap);
    fan2.position.set(-0.08, 0.48, 0.34);
    group.add(fan2);
  } else {
    // Regional 230kV Feeder Switchgear Yard
    const auxGeo = track(new THREE.BoxGeometry(0.5, 0.24, 0.28));
    const aux = new THREE.Mesh(auxGeo, mats.plinth);
    aux.position.set(-0.24, 0.14 + 0.12, 0.32);
    aux.castShadow = castShadow;
    group.add(aux);
  }

  // Base status ring flush on plinth perimeter
  const beaconGeo = track(new THREE.BoxGeometry(0.16, 0.05, 0.16));
  const beacon = new THREE.Mesh(beaconGeo, accentMat);
  beacon.position.set(0.66, 0.14 + 0.92, 0);
  group.add(beacon);

  return { group, accentMat, geometries };
}
