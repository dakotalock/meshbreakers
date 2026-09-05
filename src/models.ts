import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { heroDef, enemyDef } from "./content";
import type { Unit } from "./types";

type V3 = [number, number, number];
export type CharacterRig = {
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
  cloth: THREE.Group[];
  orbitals: THREE.Group[];
  weapon: string;
  hover: boolean;
};
const materials = new Map<string, THREE.MeshStandardMaterial>();
function surface(color: string, metal = 0.55, glow = 0) {
  const key = `${color}:${metal}:${glow}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: metal > 0.5 ? 0.32 : 0.72,
        emissive: color,
        emissiveIntensity: glow,
      }),
    );
  return materials.get(key)!;
}
function mesh(
  p: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  position: V3,
  color: string,
  metal = 0.55,
  glow = 0,
) {
  const m = new THREE.Mesh(geometry, surface(color, metal, glow));
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}
function plate(
  p: THREE.Object3D,
  size: V3,
  pos: V3,
  color: string,
  metal = 0.55,
  glow = 0,
) {
  return mesh(
    p,
    new RoundedBoxGeometry(...size, 2, Math.min(...size) * 0.22),
    pos,
    color,
    metal,
    glow,
  );
}
function ball(
  p: THREE.Object3D,
  radius: number,
  pos: V3,
  color: string,
  scale: V3 = [1, 1, 1],
  metal = 0.4,
  glow = 0,
) {
  const m = mesh(
    p,
    new THREE.SphereGeometry(radius, 16, 12),
    pos,
    color,
    metal,
    glow,
  );
  m.scale.set(...scale);
  return m;
}
function tube(
  p: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  pos: V3,
  color: string,
  metal = 0.6,
  glow = 0,
) {
  return mesh(
    p,
    new THREE.CylinderGeometry(top, bottom, height, 12),
    pos,
    color,
    metal,
    glow,
  );
}
function hoop(
  p: THREE.Object3D,
  r: number,
  t: number,
  pos: V3,
  color: string,
  glow = 1,
) {
  return mesh(p, new THREE.TorusGeometry(r, t, 6, 48), pos, color, 0.7, glow);
}
function group(p: THREE.Object3D, pos: V3): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...pos);
  p.add(g);
  return g;
}
function crystal(p: THREE.Object3D, pos: V3, color: string, scale: V3) {
  const m = mesh(p, new THREE.OctahedronGeometry(1), pos, color, 0.65, 0.6);
  m.scale.set(...scale);
  return m;
}
function capsule(
  p: THREE.Object3D,
  r: number,
  length: number,
  pos: V3,
  color: string,
  scale: V3 = [1, 1, 1],
  metal = 0.4,
) {
  const m = mesh(
    p,
    new THREE.CapsuleGeometry(r, length, 4, 10),
    pos,
    color,
    metal,
  );
  m.scale.set(...scale);
  return m;
}
function blade(p: THREE.Object3D, length: number, color: string, wide = false) {
  const shape = new THREE.Shape();
  const w = wide ? 0.19 : 0.095;
  shape.moveTo(-w, 0);
  shape.lineTo(-w * 0.78, -length * 0.83);
  shape.lineTo(0, -length);
  shape.lineTo(w * 0.78, -length * 0.83);
  shape.lineTo(w, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
  });
  const b = mesh(p, g, [0, -0.96, 0.04], "#dce9ef", 0.9);
  plate(
    p,
    [0.025, length * 0.8, 0.075],
    [w * 0.55, -0.96 - length * 0.42, 0.057],
    color,
    0.65,
    2,
  );
  plate(p, [0.36, 0.075, 0.16], [0, -0.95, 0.06], "#ceba91", 0.85);
  tube(p, 0.065, 0.065, 0.19, [0, -0.81, 0.06], "#172330");
  crystal(p, [0, -0.69, 0.06], color, [0.05, 0.07, 0.05]);
  return b;
}
function cloak(
  p: THREE.Object3D,
  color: string,
  length: number,
  width: number,
  cloth: THREE.Group[],
  offset: V3 = [0, 1.83, -0.23],
) {
  const g = group(p, offset);
  cloth.push(g);
  const geo = new THREE.PlaneGeometry(width, length, 8, 8),
    v = geo.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const x = v.getX(i),
      y = v.getY(i),
      down = (length / 2 - y) / length;
    v.setXYZ(
      i,
      x * (0.55 + down * 0.5),
      y - length / 2,
      -0.06 -
        Math.sin(down * Math.PI * 0.6) * 0.28 +
        Math.cos((x / width) * Math.PI * 8) * (0.012 + down * 0.035),
    );
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.08,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  m.material.userData.owned = true;
  m.castShadow = true;
  g.add(m);
  for (const side of [-1, 1]) {
    const trim = plate(
      g,
      [0.025, length * 0.88, 0.022],
      [side * width * 0.4, -length * 0.5, -0.14],
      "#b7a183",
      0.35,
    );
    trim.rotation.z = side * 0.11;
  }
  return g;
}

// Merge static surfaces within each joint while preserving the animated rig.
// This keeps the detailed characters affordable on phone GPUs.
function optimizeRig(rig: CharacterRig) {
  const groups: THREE.Group[] = [];
  rig.body.traverse((o) => {
    if (o instanceof THREE.Group) groups.push(o);
  });
  for (const parent of groups.reverse()) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
        continue;
      const batch = batches.get(child.material) ?? [];
      batch.push(child);
      batches.set(child.material, batch);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((m) => {
        m.updateMatrix();
        return (
          m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
        ).applyMatrix4(m.matrix);
      });
      const combined = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!combined) continue;
      for (const m of meshes) {
        parent.remove(m);
        m.geometry.dispose();
      }
      const m = new THREE.Mesh(combined, material);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    }
  }
  return rig;
}

/** Original, articulated miniature characters. All geometry is local and texture-free. */
export function buildCharacter(
  root: THREE.Group,
  u: Unit,
  enemy: boolean,
): CharacterRig {
  const def = enemy ? enemyDef(u.defId) : heroDef(u.defId),
    color = def.color;
  const model = enemy ? enemyDef(u.defId).model : heroDef(u.defId).faction;
  const weapon = enemy
    ? ({
        ripper: "blade",
        reaper: "spear",
        sentinel: "spear",
        seraph: "orb",
        archivist: "orb",
      }[model] ?? model)
    : heroDef(u.defId).weapon;
  const body = group(root, [0, 0, 0]),
    head = group(body, [0, 2.27, 0]);
  const arms: THREE.Group[] = [],
    legs: THREE.Group[] = [],
    cloth: THREE.Group[] = [],
    orbitals: THREE.Group[] = [];
  const rig = { body, head, arms, legs, cloth, orbitals, weapon, hover: false };
  const dark = enemy ? "#222536" : "#182737",
    steel = enemy ? "#5d687c" : "#8eabb9",
    ivory = enemy ? "#b6c5d6" : "#dce1dc",
    gold = "#c9b38b";
  if (model === "drone") {
    rig.hover = true;
    head.position.y = 1.55;
    ball(head, 0.4, [0, 0, 0], ivory, [1, 0.68, 1.15], 0.8);
    plate(head, [0.57, 0.22, 0.18], [0, -0.04, 0.36], dark);
    ball(head, 0.135, [0, -0.03, 0.47], color, [1, 1, 0.5], 0.7, 2.8);
    hoop(head, 0.18, 0.026, [0, -0.03, 0.45], gold, 0.2);
    for (const side of [-1, 1]) {
      const wing = group(head, [side * 0.43, 0.02, -0.04]);
      orbitals.push(wing);
      plate(wing, [0.46, 0.09, 0.26], [side * 0.22, 0, 0], steel);
      const rotor = hoop(wing, 0.28, 0.043, [side * 0.36, 0.035, 0], dark, 0);
      rotor.rotation.x = Math.PI / 2;
      hoop(wing, 0.235, 0.012, [side * 0.36, 0.06, 0], color, 2).rotation.x =
        Math.PI / 2;
      for (let j = 0; j < 3; j++) {
        const fan = plate(
          wing,
          [0.45, 0.018, 0.045],
          [side * 0.36, 0.05, 0],
          steel,
        );
        fan.rotation.y = (j * Math.PI) / 3;
      }
      tube(
        head,
        0.065,
        0.045,
        0.33,
        [side * 0.23, -0.31, 0.11],
        dark,
      ).rotation.x = -0.35;
      crystal(head, [side * 0.23, -0.5, 0.17], color, [0.06, 0.12, 0.06]);
    }
    plate(head, [0.2, 0.04, 0.55], [0, 0.25, -0.18], dark);
    return optimizeRig(rig);
  }
  if (model === "spider") {
    head.position.y = 0.88;
    ball(head, 0.48, [0, 0, 0], steel, [1, 0.5, 1.1]);
    plate(head, [0.6, 0.14, 0.38], [0, 0.17, 0], dark);
    for (const x of [-0.18, 0, 0.18])
      ball(head, 0.068, [x, -0.02, 0.44], color, [1, 0.8, 0.7], 0.6, 2.3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2,
        g = group(body, [Math.cos(a) * 0.22, 0.65, Math.sin(a) * 0.22]);
      g.rotation.y = -a;
      legs.push(g);
      ball(g, 0.12, [0, 0, 0], gold);
      const upper = capsule(g, 0.075, 0.46, [0.27, -0.04, 0], dark);
      upper.rotation.z = -1.24;
      ball(g, 0.1, [0.57, -0.14, 0], color, [1, 1, 1], 0.7, 0.4);
      const lower = plate(g, [0.1, 0.53, 0.13], [0.67, -0.35, 0], steel);
      lower.rotation.z = -0.42;
      crystal(g, [0.8, -0.62, 0], dark, [0.07, 0.16, 0.07]);
    }
    return optimizeRig(rig);
  }
  if (model === "orb") {
    rig.hover = true;
    head.position.y = 1.65;
    ball(head, 0.46, [0, 0, 0], dark, [1, 1, 1], 0.85);
    crystal(head, [0, 0, 0.38], color, [0.25, 0.37, 0.18]);
    for (let j = 0; j < 3; j++) {
      const orbital = group(head, [0, 0, 0]);
      orbital.rotation.set(j * 0.8, 0.5, j * 0.6);
      orbitals.push(orbital);
      hoop(
        orbital,
        0.69 + j * 0.055,
        0.026,
        [0, 0, 0],
        j === 1 ? gold : steel,
        0.3,
      );
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        crystal(
          orbital,
          [Math.cos(a) * 0.74, Math.sin(a) * 0.74, 0],
          color,
          [0.09, 0.17, 0.075],
        );
      }
    }
    for (const side of [-1, 1]) {
      const talon = plate(
        head,
        [0.13, 0.7, 0.17],
        [side * 0.36, -0.55, 0],
        ivory,
      );
      talon.rotation.z = side * -0.3;
    }
    root.scale.setScalar(
      u.defId === "census" ? 1.55 : u.defId === "hive" ? 1.15 : 1,
    );
    return optimizeRig(rig);
  }
  const human = !enemy && model === "human",
    cyborg = !enemy && model === "cyborg",
    organic = human || cyborg;
  const heavy =
    ["heavy", "boss", "ward"].includes(model) ||
    ["coil", "atlas", "pax"].includes(u.defId);
  const slender = ["iri", "sable", "vale", "vesper", "moth", "mara"].includes(
    u.defId,
  );
  const celestial = ["seraph", "archivist"].includes(model),
    width = heavy ? 0.92 : slender ? 0.6 : 0.7;
  const skins: Record<string, string> = {
    rook: "#b88e72",
    iri: "#ddbaa3",
    pax: "#a47a5e",
    sable: "#976a54",
    juno: "#c2a183",
    vale: "#d8b7a0",
    mara: "#aa7962",
    sol: "#cd967c",
    vesper: "#d7c3af",
  };
  const skin = skins[u.defId] ?? "#c3a38a";
  rig.hover =
    celestial ||
    (!organic && ["nyx", "hexa", "wren", "moth"].includes(u.defId));
  // Tapered torso over a visible articulated under-suit, with inset armor panels.
  capsule(body, 0.22, 0.34, [0, 1.48, 0], dark, [width / 0.43, 1, 0.88]);
  const torso = mesh(
    body,
    new THREE.CylinderGeometry(width * 0.57, width * 0.4, 0.66, 6),
    [0, 1.64, 0],
    enemy ? steel : dark,
    0.7,
  );
  torso.scale.z = 0.63;
  torso.rotation.y = Math.PI / 6;
  for (const side of [-1, 1]) {
    const breast = plate(
      body,
      [width * 0.44, 0.38, 0.14],
      [side * width * 0.23, 1.77, 0.225],
      enemy ? ivory : color,
      0.7,
    );
    breast.rotation.z = side * 0.14;
    plate(
      body,
      [0.04, 0.22, 0.035],
      [side * width * 0.28, 1.79, 0.31],
      gold,
      0.8,
    );
    plate(
      body,
      [width * 0.38, 0.18, 0.12],
      [side * width * 0.2, 1.47, 0.2],
      steel,
      0.7,
    ).rotation.z = -side * 0.09;
  }
  crystal(body, [0, 1.75, 0.326], color, [0.085, 0.12, 0.055]);
  tube(body, 0.16, 0.18, 0.18, [0, 2.08, 0], dark);
  hoop(body, 0.19, 0.03, [0, 2.01, 0], gold, 0.1).rotation.x = Math.PI / 2;
  plate(body, [width * 0.8, 0.12, 0.43], [0, 1.23, 0], dark);
  plate(body, [0.15, 0.12, 0.035], [0, 1.23, 0.235], gold, 0.8);
  for (const side of [-1, 1]) {
    plate(body, [0.17, 0.25, 0.16], [side * width * 0.39, 1.23, 0.03], steel);
    tube(body, 0.045, 0.045, 0.2, [side * 0.17, 1.22, -0.23], color, 0.7, 0.5);
  }
  if (organic) {
    // Sculpted head, brow, nose, ears, separate eye whites and pupils.
    ball(head, 0.235, [0, 0, 0], skin, [0.8, 1.16, 0.88], 0.08);
    ball(head, 0.15, [0, -0.135, 0.055], skin, [0.92, 0.7, 0.83], 0.04);
    ball(head, 0.049, [0, -0.025, 0.203], skin, [0.55, 1, 0.8], 0.04);
    for (const side of [-1, 1]) {
      ball(head, 0.048, [side * 0.19, -0.015, 0], skin, [0.6, 1, 0.7], 0.04);
      plate(
        head,
        [0.085, 0.027, 0.03],
        [side * 0.082, 0.025, 0.19],
        "#e9edf1",
        0.02,
      );
      ball(
        head,
        0.018,
        [side * 0.075, 0.025, 0.211],
        cyborg && side === -1 ? color : "#243442",
        [0.72, 1, 0.6],
        0.1,
        cyborg && side === -1 ? 1.9 : 0,
      );
      plate(
        head,
        [0.09, 0.018, 0.02],
        [side * 0.085, 0.065, 0.194],
        "#39353b",
        0.05,
      ).rotation.z = side * -0.1;
    }
    plate(head, [0.08, 0.011, 0.018], [0, -0.13, 0.188], "#8d645c", 0.03);
    const hairColors: Record<string, string> = {
      rook: "#343539",
      iri: "#d5d6e1",
      pax: "#302b29",
      sable: "#243749",
      juno: "#714439",
      vale: "#dad6ca",
      mara: "#463d40",
      sol: "#ddd8c6",
      vesper: "#2b2847",
    };
    const hair = hairColors[u.defId] ?? dark;
    ball(head, 0.239, [0, 0.11, -0.055], hair, [0.87, 0.76, 0.83], 0.05);
    for (let i = 0; i < 6; i++) {
      const tuft = mesh(
        head,
        new THREE.ConeGeometry(0.062, 0.26 + (i % 3) * 0.045, 4),
        [(i - 2.5) * 0.058, 0.23 + (i % 2) * 0.03, 0.035],
        hair,
        0.08,
      );
      tuft.rotation.set(-0.18, (i - 2) * 0.2, -0.3 - (i - 2.5) * 0.22);
    }
    if (["iri", "mara", "vesper"].includes(u.defId)) {
      const pony = group(head, [0, 0.05, -0.18]);
      cloth.push(pony);
      capsule(pony, 0.085, 0.26, [0, -0.12, -0.1], hair, [1, 1, 1], 0.1);
      crystal(pony, [0, -0.39, -0.14], hair, [0.09, 0.17, 0.07]);
    }
    if (u.defId === "rook") {
      plate(head, [0.31, 0.055, 0.045], [0, 0.14, 0.19], dark);
      ball(head, 0.155, [0, -0.145, 0.015], hair, [1, 0.4, 0.92], 0.07);
    }
    if (u.defId === "sable") {
      plate(head, [0.28, 0.12, 0.065], [0, -0.1, 0.16], dark);
      plate(head, [0.16, 0.023, 0.025], [0, -0.09, 0.208], color, 0.6, 0.6);
    }
    if (cyborg) {
      plate(head, [0.075, 0.21, 0.105], [-0.175, -0.01, 0.04], steel);
      tube(head, 0.04, 0.04, 0.16, [-0.218, 0.01, 0.03], gold).rotation.x =
        Math.PI / 2;
      plate(head, [0.025, 0.13, 0.022], [-0.12, -0.035, 0.201], color, 0.6, 1);
    }
  } else {
    ball(head, 0.24, [0, 0, 0], dark, [0.94, 1.18, 0.87], 0.8);
    plate(
      head,
      [0.36, 0.29, 0.32],
      [0, 0.06, -0.045],
      enemy ? steel : ivory,
      0.8,
    );
    plate(head, [0.31, 0.11, 0.07], [0, -0.015, 0.207], dark);
    for (const side of [-1, 1]) {
      plate(
        head,
        [0.105, 0.045, 0.045],
        [side * 0.079, 0.005, 0.247],
        color,
        0.6,
        2.1,
      ).rotation.z = enemy ? side * 0.16 : 0;
      plate(head, [0.07, 0.2, 0.16], [side * 0.22, -0.04, 0.025], gold, 0.8);
    }
    plate(head, [0.2, 0.1, 0.11], [0, -0.16, 0.11], steel);
    plate(head, [0.07, 0.025, 0.025], [0, -0.155, 0.172], color, 0.6, 0.6);
    if (heavy) {
      plate(head, [0.045, 0.24, 0.38], [0, 0.23, -0.025], gold);
    } else {
      const antenna = tube(
        head,
        0.012,
        0.018,
        0.28,
        [0.18, 0.27, -0.075],
        gold,
      );
      antenna.rotation.z = -0.22;
      ball(head, 0.025, [0.21, 0.41, -0.075], color, [1, 1, 1], 0.5, 2);
    }
  }
  // Upper arm + gauntlet, then separate articulated legs with knee/shin plates.
  for (const side of [-1, 1]) {
    const arm = group(body, [side * (width / 2 + 0.14), 1.94, 0]);
    arms.push(arm);
    ball(arm, 0.14, [0, -0.04, 0], dark);
    const shoulder = ball(
      arm,
      heavy ? 0.25 : 0.2,
      [side * 0.04, 0.015, 0],
      enemy ? ivory : color,
      [1, 0.72, 1.07],
      0.72,
    );
    shoulder.rotation.z = side * 0.2;
    hoop(
      arm,
      heavy ? 0.2 : 0.16,
      0.022,
      [side * 0.03, -0.075, 0],
      gold,
      0,
    ).rotation.x = Math.PI / 2;
    capsule(arm, 0.09, 0.23, [0, -0.27, 0], organic ? dark : steel);
    ball(arm, 0.09, [0, -0.46, 0], gold);
    capsule(arm, 0.115, 0.18, [0, -0.6, 0.025], dark);
    plate(arm, [0.15, 0.24, 0.07], [0, -0.6, 0.13], enemy ? steel : ivory, 0.7);
    plate(arm, [0.022, 0.17, 0.025], [0, -0.59, 0.177], color, 0.6, 1.1);
    ball(
      arm,
      0.095,
      [0, -0.79, 0.06],
      organic ? "#27313d" : steel,
      [0.92, 1.05, 0.82],
    );
    for (let f = 0; f < 3; f++)
      capsule(
        arm,
        0.018,
        0.055,
        [(f - 1) * 0.041, -0.82, 0.116],
        steel,
        [1, 1, 1],
        0.5,
      );
    arm.rotation.z = side * -0.08;
    if (!rig.hover) {
      const leg = group(body, [side * (heavy ? 0.25 : 0.19), 1.17, 0]);
      legs.push(leg);
      ball(leg, 0.13, [0, 0, 0], dark);
      capsule(leg, 0.125, 0.26, [0, -0.24, 0], dark, [1, 1, 1], 0.3);
      plate(
        leg,
        [0.19, 0.27, 0.085],
        [0, -0.23, 0.117],
        enemy ? steel : ivory,
        0.65,
      );
      ball(leg, 0.113, [0, -0.48, 0.02], dark);
      plate(leg, [0.2, 0.13, 0.095], [0, -0.46, 0.12], gold, 0.8);
      capsule(leg, 0.12, 0.25, [0, -0.73, 0.005], dark);
      plate(
        leg,
        [0.17, 0.29, 0.085],
        [0, -0.7, 0.13],
        enemy ? steel : color,
        0.7,
      );
      plate(leg, [0.028, 0.18, 0.022], [0, -0.7, 0.181], gold, 0.8);
      plate(leg, [0.28, 0.16, 0.4], [0, -1.025, 0.095], dark, 0.5);
      plate(leg, [0.23, 0.08, 0.18], [0, -1.03, 0.23], steel, 0.8);
      leg.rotation.x = side * 0.065;
      leg.rotation.z = side * -0.035;
    }
  }
  // Coats, scarves, wing arrays, and armor give each recruit a recognizable silhouette.
  if (organic || ["atlas", "moth"].includes(u.defId)) {
    const isCoat = ["iri", "mara", "vesper", "moth"].includes(u.defId);
    cloak(
      body,
      isCoat ? "#394764" : color,
      isCoat ? 1.46 : 1.02,
      isCoat ? 0.9 : 0.72,
      cloth,
    );
    if (isCoat)
      for (const side of [-1, 1]) {
        const flap = plate(
          body,
          [0.19, 0.7, 0.06],
          [side * 0.31, 0.96, -0.02],
          dark,
          0.1,
        );
        flap.rotation.z = side * 0.15;
      }
  }
  if (["rook", "sol", "vale"].includes(u.defId)) {
    const scarf = hoop(body, 0.23, 0.07, [0, 2.03, 0], color, 0);
    scarf.rotation.x = Math.PI / 2;
    const tail = group(body, [-0.2, 1.97, -0.12]);
    cloth.push(tail);
    plate(
      tail,
      [0.18, 0.67, 0.045],
      [0, -0.33, -0.15],
      color,
      0.05,
    ).rotation.x = 0.25;
  }
  if (rig.hover) {
    tube(body, 0.27, 0.14, 0.42, [0, 1, 0], dark);
    tube(body, 0.17, 0.07, 0.25, [0, 0.69, 0], steel);
    crystal(body, [0, 0.47, 0], color, [0.1, 0.22, 0.1]);
    for (const side of [-1, 1]) {
      const fin = plate(
        body,
        [0.14, 0.6, 0.3],
        [side * 0.31, 0.95, -0.025],
        enemy ? steel : ivory,
      );
      fin.rotation.z = side * -0.3;
    }
  }
  if (["nyx", "mara"].includes(u.defId)) {
    plate(body, [0.06, 0.23, 0.03], [0, 1.76, 0.365], "#eefefa", 0.2, 1);
    plate(body, [0.2, 0.06, 0.03], [0, 1.76, 0.365], "#eefefa", 0.2, 1);
  }
  if (["nyx", "hexa", "vesper", "moth"].includes(u.defId)) {
    const halo = group(head, [0, 0.38, -0.04]);
    orbitals.push(halo);
    hoop(halo, 0.34, 0.016, [0, 0, 0], color, 1.7).rotation.x = Math.PI / 2;
    for (const side of [-1, 1])
      crystal(halo, [side * 0.34, 0, 0], gold, [0.035, 0.08, 0.035]);
  }
  if (u.defId === "moth" || celestial) {
    for (const side of [-1, 1]) {
      const wing = group(body, [side * 0.25, 1.93, -0.22]);
      cloth.push(wing);
      for (let j = 0; j < 5; j++) {
        const shard = crystal(
          wing,
          [side * (0.26 + j * 0.17), 0.26 + j * 0.12, -j * 0.06],
          j % 2 ? color : ivory,
          [0.11, 0.52 - j * 0.035, 0.055],
        );
        shard.rotation.z = side * (-0.5 - j * 0.14);
      }
    }
  }
  if (celestial) {
    const halo = group(body, [0, 2.42, -0.25]);
    orbitals.push(halo);
    hoop(halo, 0.6, 0.035, [0, 0, 0], gold, 0.4);
    hoop(halo, 0.53, 0.012, [0, 0, 0.01], color, 2);
    if (model === "archivist") {
      cloak(body, "#41365d", 1.8, 1.1, cloth);
      for (let i = 0; i < 5; i++) {
        const g = group(body, [0, 1.5, 0]);
        orbitals.push(g);
        g.rotation.y = (i * Math.PI * 2) / 5;
        plate(g, [0.28, 0.4, 0.07], [0, 0.05, 1.1], ivory);
        plate(g, [0.21, 0.015, 0.02], [0, 0.14, 1.146], color, 0.5, 1.5);
      }
    }
    root.scale.setScalar(
      u.defId === "seraph" || u.defId === "archivist" ? 1.22 : 1,
    );
  }
  if (["lattice", "doorman", "bailiff"].includes(u.defId)) {
    root.scale.setScalar(
      u.defId === "lattice" ? 1.3 : u.defId === "doorman" ? 1.2 : 1.08,
    );
    for (const side of [-1, 1]) {
      plate(body, [0.31, 0.3, 0.63], [side * 0.63, 2.04, -0.045], ivory, 0.8);
      plate(
        body,
        [0.035, 0.2, 0.4],
        [side * 0.65, 2.12, 0.05],
        color,
        0.6,
        1.1,
      );
    }
    if (u.defId === "lattice") {
      const crown = group(head, [0, 0.3, 0]);
      orbitals.push(crown);
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        crystal(
          crown,
          [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36],
          color,
          [0.045, 0.24, 0.045],
        );
      }
      cloak(body, "#573252", 1.55, 1.15, cloth);
      for (const side of [-1, 1])
        crystal(body, [side * 0.77, 2.35, -0.17], color, [0.16, 0.52, 0.16]);
    }
  }
  if (u.defId === "juno") {
    for (const side of [-1, 1]) {
      plate(body, [0.17, 0.48, 0.25], [side * 0.26, 1.74, -0.34], steel);
      tube(body, 0.04, 0.04, 0.3, [side * 0.26, 2, -0.34], color, 0.5, 1.3);
    }
  }
  if (u.defId === "wren") {
    for (const side of [-1, 1]) {
      const fin = plate(
        body,
        [0.25, 0.6, 0.1],
        [side * 0.62, 1.91, -0.1],
        gold,
      );
      fin.rotation.z = side * -0.35;
    }
  }
  // Weapons attach to the hands and stay above the floor in a combat-ready pose.
  const right = arms[1],
    left = arms[0];
  if (["blade", "dagger"].includes(weapon)) {
    blade(right, weapon === "dagger" ? 0.62 : 1.07, color, u.defId === "rook");
    right.rotation.x = -1.18;
    right.rotation.z = -0.2;
    if (weapon === "dagger") {
      blade(left, 0.49, color);
      left.rotation.x = -0.65;
    }
  } else if (weapon === "spear") {
    tube(right, 0.032, 0.032, 1.85, [0, -0.62, 0.06], steel);
    crystal(right, [0, 0.55, 0.06], color, [0.13, 0.33, 0.06]);
    hoop(right, 0.13, 0.02, [0, 0.33, 0.06], gold, 0.1).rotation.x =
      Math.PI / 2;
    right.rotation.z = -0.2;
    right.rotation.x = -0.35;
  } else if (weapon === "hammer") {
    tube(right, 0.048, 0.048, 1.1, [0, -1.03, 0.04], gold);
    plate(right, [0.72, 0.34, 0.35], [0, -1.54, 0.04], dark);
    plate(right, [0.77, 0.2, 0.28], [0, -1.54, 0.04], steel);
    plate(right, [0.78, 0.05, 0.29], [0, -1.54, 0.04], color, 0.7, 1.4);
    right.rotation.x = -1.18;
  } else if (["rifle", "cannon", "boss", "heavy", "ward"].includes(weapon)) {
    right.rotation.x = -1.45;
    left.rotation.x = -1;
    left.rotation.z = -0.28;
    plate(
      right,
      [weapon === "cannon" ? 0.38 : 0.2, 0.68, 0.24],
      [0, -0.88, 0.13],
      dark,
    );
    plate(right, [0.17, 0.35, 0.04], [0, -0.85, 0.27], ivory);
    tube(right, 0.055, 0.085, 0.65, [0, -1.34, 0.12], steel);
    tube(right, 0.075, 0.075, 0.07, [0, -1.66, 0.12], gold);
    plate(right, [0.02, 0.48, 0.035], [0.118, -1.16, 0.14], color, 0.7, 1.5);
    plate(right, [0.09, 0.22, 0.07], [0, -0.76, 0.33], dark);
    ball(right, 0.04, [0, -0.88, 0.33], color, [1, 0.6, 1], 0.6, 1.5);
  } else if (weapon === "shield") {
    const shield = plate(left, [0.67, 1.0, 0.17], [0, -0.48, 0.26], dark);
    shield.rotation.z = 0.08;
    plate(left, [0.52, 0.85, 0.06], [0, -0.48, 0.373], ivory);
    plate(left, [0.042, 0.7, 0.04], [0, -0.48, 0.422], gold);
    plate(left, [0.37, 0.042, 0.04], [0, -0.34, 0.422], gold);
    crystal(left, [0, -0.35, 0.45], color, [0.11, 0.17, 0.05]);
    right.rotation.x = -0.55;
    left.rotation.x = -0.1;
  } else if (weapon === "orb") {
    right.rotation.x = -1.15;
    const focus = group(right, [0, -1.12, 0.04]);
    orbitals.push(focus);
    crystal(focus, [0, 0, 0], color, [0.14, 0.21, 0.14]);
    hoop(focus, 0.26, 0.018, [0, 0, 0], gold, 0.5);
    hoop(focus, 0.23, 0.01, [0, 0, 0], color, 1.5).rotation.x = Math.PI / 2;
  } else {
    tube(right, 0.026, 0.032, 1.7, [0, -0.7, 0.045], gold);
    crystal(right, [0, 0.31, 0.045], color, [0.12, 0.2, 0.1]);
    hoop(right, 0.25, 0.025, [0, 0.31, 0.045], ivory, 0.3);
    right.rotation.z = -0.15;
  }
  return optimizeRig(rig);
}
