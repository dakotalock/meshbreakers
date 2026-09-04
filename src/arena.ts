import * as THREE from "three";
import { heroDef, enemyDef, TERRAINS } from "./content";
import type { Unit, FX } from "./types";
type Actor = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
  ring: THREE.Mesh;
  shield: THREE.Mesh;
  home: THREE.Vector3;
  color: string;
  phase: number;
  enemy: boolean;
  weapon: string;
  hover: boolean;
  dead: boolean;
  label?: HTMLElement;
};
type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  max: number;
};
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, metal = 0.3, glow = 0) {
  const key = color + metal + glow;
  if (!matCache.has(key))
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: 0.48,
        emissive: color,
        emissiveIntensity: glow,
      }),
    );
  return matCache.get(key)!;
}
function box(
  p: THREE.Object3D,
  size: number[],
  pos: number[],
  color: string,
  metal = 0.3,
  glow = 0,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(...(size as [number, number, number])),
    mat(color, metal, glow),
  );
  m.position.set(...(pos as [number, number, number]));
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}
function sphere(
  p: THREE.Object3D,
  r: number,
  pos: number[],
  color: string,
  glow = 0,
) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 8),
    mat(color, 0.4, glow),
  );
  m.position.set(...(pos as [number, number, number]));
  m.castShadow = true;
  p.add(m);
  return m;
}
function cyl(
  p: THREE.Object3D,
  r1: number,
  r2: number,
  h: number,
  pos: number[],
  color: string,
  vertices = 8,
  glow = 0,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r1, r2, h, vertices),
    mat(color, 0.6, glow),
  );
  m.position.set(...(pos as [number, number, number]));
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}
function ring(
  p: THREE.Object3D,
  r: number,
  t: number,
  pos: number[],
  color: string,
  glow = 1,
) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, t, 6, 48),
    mat(color, 0.5, glow),
  );
  m.position.set(...(pos as [number, number, number]));
  p.add(m);
  return m;
}
function joint(p: THREE.Object3D, pos: number[]) {
  const g = new THREE.Group();
  g.position.set(...(pos as [number, number, number]));
  p.add(g);
  return g;
}
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export class Arena {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  actors = new Map<string, Actor>();
  container: HTMLElement | null = null;
  labels: HTMLElement | null = null;
  particles: Particle[] = [];
  clock = new THREE.Clock();
  mode = "title";
  selected = "";
  target = "";
  shake = 0;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  low = false;
  failed = false;
  private observer: ResizeObserver;
  private time = 0;
  private busyActors = new Set<string>();
  private floorGlow: THREE.MeshStandardMaterial;
  private motes: THREE.Points;
  private last = 0;
  private animationId = 0;
  private raycaster = new THREE.Raycaster();
  private onTarget: (id: string) => void;
  private width = 1;
  private height = 1;
  constructor(onTarget: (id: string) => void) {
    this.onTarget = onTarget;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Animated 3D battlefield",
    );
    this.renderer.domElement.style.touchAction = "pan-y";
    this.scene.background = new THREE.Color("#09131f");
    this.scene.fog = new THREE.FogExp2("#09131f", 0.035);
    this.scene.add(new THREE.HemisphereLight("#c7e7ff", "#1b192d", 2.8));
    const key = new THREE.DirectionalLight("#ffe4c7", 4.5);
    key.position.set(-5, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -9,
      right: 9,
      top: 9,
      bottom: -9,
      near: 0.1,
      far: 30,
    });
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.04;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#62dfff", 3.5);
    rim.position.set(4, 6, -6);
    this.scene.add(rim);
    const warm = new THREE.PointLight("#ff8365", 22, 15, 2);
    warm.position.set(5, 3, 2);
    this.scene.add(warm);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      mat("#101b29", 0.55),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.68;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const platform = cyl(
      this.scene,
      6.3,
      6.6,
      0.6,
      [0, -0.35, 0],
      "#1e3043",
      12,
    );
    platform.receiveShadow = true;
    this.floorGlow = mat("#4edacc", 0.5, 2);
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(6.35, 0.025, 4, 96),
      this.floorGlow,
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = -0.07;
    this.scene.add(edge);
    cyl(this.scene, 5.9, 5.9, 0.06, [0, -0.02, 0], "#172a3b", 12);
    const center = ring(this.scene, 1.5, 0.02, [0, 0.035, 0], "#416576", 0.35);
    center.rotation.x = Math.PI / 2;
    const center2 = ring(this.scene, 1.35, 0.008, [0, 0.04, 0], "#436171", 0.2);
    center2.rotation.x = Math.PI / 2;
    for (let j = -5; j <= 5; j++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.006, 0.009),
        mat("#294150", 0.3, 0.15),
      );
      line.position.set(0, 0.022, j);
      this.scene.add(line);
      const l2 = line.clone();
      l2.rotation.y = Math.PI / 2;
      l2.position.set(j, 0.022, 0);
      this.scene.add(l2);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * 6.1, 0, Math.sin(a) * 6.1);
      g.rotation.y = -a;
      box(g, [0.4, 0.16, 0.8], [0, 0.07, 0], "#344657");
      box(
        g,
        [0.42, 0.04, 0.2],
        [0, 0.17, 0],
        i % 2 ? "#f7b477" : "#70fce0",
        0.5,
        2,
      );
      this.scene.add(g);
    }
    // Distant industrial silhouettes and light strips give the arena depth without texture downloads.
    for (let i = 0; i < 24; i++) {
      const a = i * 2.39996,
        r = 10 + (i % 4) * 2.2,
        h = 1.2 + ((i * 7) % 9) * 0.65;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * r, -0.65, Math.sin(a) * r);
      g.rotation.y = a;
      box(g, [1.1, h, 1.2], [0, h / 2, 0], i % 2 ? "#162637" : "#1c2d3c");
      box(
        g,
        [0.07, h * 0.6, 0.02],
        [0.32, h * 0.6, 0.611],
        i % 3 ? "#3b6981" : "#c36d59",
        0.4,
        0.8,
      );
      box(g, [1.2, 0.16, 1.3], [0, h + 0.08, 0], "#263d4c");
      this.scene.add(g);
    }
    const positions = new Float32Array(100 * 3);
    for (let i = 0; i < 100; i++) {
      positions[i * 3] = Math.sin(i * 13.7) * 15;
      positions[i * 3 + 1] = 0.5 + (i % 21) * 0.31;
      positions[i * 3 + 2] = Math.cos(i * 7.3) * 15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#96e4ec",
        size: 0.035,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.scene.add(this.motes);
    this.observer = new ResizeObserver(() => this.resize());
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (Math.abs(e.movementX) > 10 || Math.abs(e.movementY) > 10) return;
      const b = this.renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector2(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(v, this.camera);
      const hits = this.raycaster.intersectObjects(
        [...this.actors.values()].filter((a) => !a.dead).map((a) => a.root),
        true,
      );
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && !o.userData.uid) o = o.parent;
        if (o?.userData.uid) this.onTarget(o.userData.uid);
      }
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.failed = true;
      this.container?.classList.add("context-lost");
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.failed = false;
      this.container?.classList.remove("context-lost");
    });
    this.loop();
  }
  attach(container: HTMLElement, labels: HTMLElement) {
    if (this.container !== container) {
      if (this.container) this.observer.unobserve(this.container);
      this.container = container;
      container.prepend(this.renderer.domElement);
      this.observer.observe(container);
    }
    this.labels = labels;
    this.resize();
  }
  resize() {
    if (!this.container) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const distance =
      this.camera.aspect < 1.25 ? 22 / Math.max(this.camera.aspect, 0.8) : 18;
    this.camera.position.set(0, distance * 0.65, distance * 0.76);
    this.camera.lookAt(0, 0.4, 0);
    this.camera.updateProjectionMatrix();
  }
  sync(heroes: Unit[], enemies: Unit[], mode = "battle", terrain = "foundry") {
    this.mode = mode;
    const units = [
      ...heroes.map((u, i) => ({
        u,
        enemy: false,
        index: i,
        count: heroes.length,
      })),
      ...enemies.map((u, i) => ({
        u,
        enemy: true,
        index: i,
        count: enemies.length,
      })),
    ];
    const ids = new Set(units.map((x) => x.u.uid));
    for (const [id, a] of this.actors)
      if (!ids.has(id)) {
        this.scene.remove(a.root);
        a.root.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        this.actors.delete(id);
      }
    for (const { u, enemy, index, count } of units) {
      let a = this.actors.get(u.uid);
      if (!a) {
        a = this.createActor(u, enemy);
        this.actors.set(u.uid, a);
        this.scene.add(a.root);
      }
      const z = count === 1 ? 0 : (index - (count - 1) / 2) * 3.05;
      const x =
        (enemy ? 1 : -1) * (count === 1 ? 2.65 : 2.7 + (index === 1 ? 0.4 : 0));
      a.home.set(
        mode === "title" && !enemy ? (index - 1) * 2.8 : x,
        0,
        mode === "title" && !enemy ? 0 : z,
      );
      a.root.position.copy(a.home);
      a.dead = u.hp <= 0;
      a.root.visible = !a.dead;
      a.root.rotation.y =
        mode === "title" ? 0.2 : enemy ? -Math.PI / 2 : Math.PI / 2;
      a.shield.visible = u.shield > 0;
    }
    const c = TERRAINS[terrain]?.color ?? "#64efd2";
    this.floorGlow.color.set(c);
    this.floorGlow.emissive.set(c);
    this.resize();
  }
  private createActor(u: Unit, enemy: boolean): Actor {
    const def = enemy ? enemyDef(u.defId) : heroDef(u.defId),
      color = def.color,
      model = enemy ? enemyDef(u.defId).model : heroDef(u.defId).faction,
      weapon = enemy ? model : heroDef(u.defId).weapon,
      root = new THREE.Group();
    root.userData.uid = u.uid;
    const baseRing = ring(root, 0.65, 0.022, [0, 0.07, 0], color, 2);
    baseRing.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.67, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    root.add(disc);
    const body = joint(root, [0, 0, 0]),
      head = joint(body, [0, 1.75, 0]),
      arms: THREE.Group[] = [],
      legs: THREE.Group[] = [];
    const dark = enemy ? "#342d3a" : "#21313d",
      metal = enemy ? "#676575" : "#70828e",
      skin = enemy
        ? "#383443"
        : u.defId === "iri"
          ? "#d4ae92"
          : u.defId === "sable"
            ? "#a57e67"
            : "#dbb598";
    const hover =
      ["drone", "orb"].includes(model) ||
      (!enemy && ["nyx", "hexa", "wren"].includes(u.defId));
    if (model === "drone") {
      head.position.y = 1.5;
      sphere(head, 0.39, [0, 0, 0], dark);
      box(head, [0.6, 0.15, 0.08], [0, 0, 0.36], color, 0.6, 2.4);
      sphere(head, 0.085, [0, 0, 0.43], "#fff1de", 2);
      for (const side of [-1, 1]) {
        box(head, [0.65, 0.13, 0.32], [side * 0.53, 0, 0], metal);
        const rotor = ring(head, 0.33, 0.04, [side * 0.7, 0.1, 0], dark, 0);
        rotor.rotation.x = Math.PI / 2;
        ring(head, 0.24, 0.015, [side * 0.7, 0.13, 0], color, 2).rotation.x =
          Math.PI / 2;
        box(head, [0.16, 0.4, 0.18], [side * 0.36, -0.3, 0.15], dark);
      }
    } else if (model === "spider") {
      head.position.y = 0.9;
      box(head, [0.7, 0.4, 0.6], [0, 0, 0], metal);
      box(head, [0.48, 0.12, 0.1], [0, 0.02, 0.34], color, 0.5, 2);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2,
          g = joint(body, [Math.cos(a) * 0.25, 0.7, Math.sin(a) * 0.25]);
        g.rotation.y = -a;
        const limb = box(g, [0.75, 0.1, 0.12], [0.4, -0.1, 0], dark);
        limb.rotation.z = -0.5;
        const leg = box(g, [0.1, 0.65, 0.13], [0.7, -0.35, 0], metal);
        leg.rotation.z = -0.25;
        legs.push(g);
      }
    } else if (model === "orb") {
      head.position.y = 1.5;
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 1),
        mat(dark, 0.65),
      );
      head.add(core);
      sphere(head, 0.2, [0, 0, 0.54], color, 2.5);
      for (let i = 0; i < 3; i++) {
        const hoop = ring(head, 0.83, 0.035, [0, 0, 0], color, 1);
        hoop.rotation.set((i * Math.PI) / 3, Math.PI / 3, Math.PI / 4);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        box(
          head,
          [0.15, 0.32, 0.12],
          [Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0],
          metal,
        );
      }
    } else {
      const heavy =
        ["heavy", "boss", "ward"].includes(model) || u.defId === "coil";
      const human = !enemy && model === "human",
        robot = !human && model !== "cyborg";
      const w = heavy ? 0.92 : 0.69;
      // A segmented, articulated silhouette: torso, armor plates, joints, boots, and equipment.
      box(body, [w, 0.7, 0.43], [0, 1.2, 0], dark);
      box(
        body,
        [w * 0.87, 0.47, 0.08],
        [0, 1.3, 0.25],
        enemy ? metal : color,
        0.55,
      );
      box(body, [w * 0.9, 0.1, 0.47], [0, 0.84, 0], metal);
      cyl(body, 0.18, 0.19, 0.17, [0, 1.66, 0], metal, 10);
      sphere(head, human ? 0.21 : 0.24, [0, 0, 0], human ? skin : dark);
      box(
        head,
        [0.42, 0.26, 0.35],
        [0, 0.1, -0.025],
        enemy ? metal : dark,
        0.5,
      );
      box(head, [0.34, 0.085, 0.08], [0, 0.025, 0.22], color, 0.5, 2.3);
      if (human) {
        box(head, [0.31, 0.11, 0.12], [0, -0.12, 0.14], skin);
        box(head, [0.08, 0.25, 0.2], [-0.22, 0, 0.02], dark);
      } else {
        box(head, [0.23, 0.14, 0.12], [0, -0.16, 0.14], metal);
        box(head, [0.045, 0.12, 0.025], [0, -0.12, 0.211], color, 0.5, 1.5);
      }
      if (model === "cyborg") {
        sphere(head, 0.065, [-0.13, 0.04, 0.24], "#e4fbff", 2);
        box(head, [0.06, 0.25, 0.12], [0.23, 0.04, 0], metal);
      }
      box(body, [w * 0.65, 0.55, 0.22], [0, 1.26, -0.33], metal);
      cyl(body, 0.07, 0.07, 0.25, [-0.18, 1.25, -0.48], color, 8, 1.5);
      cyl(body, 0.07, 0.07, 0.25, [0.18, 1.25, -0.48], color, 8, 1.5);
      for (const side of [-1, 1]) {
        const arm = joint(body, [side * (w / 2 + 0.13), 1.46, 0]);
        sphere(arm, 0.14, [0, -0.04, 0], metal);
        box(
          arm,
          [heavy ? 0.34 : 0.26, 0.3, 0.38],
          [side * 0.04, -0.04, 0],
          enemy ? dark : color,
        );
        box(arm, [0.17, 0.35, 0.19], [0, -0.3, 0], robot ? metal : dark);
        sphere(arm, 0.105, [0, -0.48, 0], metal);
        box(arm, [0.22, 0.29, 0.24], [0, -0.62, 0.02], dark);
        box(arm, [0.07, 0.19, 0.04], [0, -0.61, 0.15], color, 0.5, 1);
        sphere(arm, 0.11, [0, -0.81, 0.03], metal);
        arms.push(arm);
        if (!hover) {
          const leg = joint(body, [side * 0.23, 0.8, 0]);
          sphere(leg, 0.13, [0, 0, 0], metal);
          box(leg, [heavy ? 0.29 : 0.23, 0.34, 0.28], [0, -0.2, 0], dark);
          sphere(leg, 0.105, [0, -0.37, 0], metal);
          box(leg, [0.25, 0.29, 0.28], [0, -0.5, 0], enemy ? metal : dark);
          box(leg, [0.3, 0.15, 0.44], [0, -0.68, 0.09], dark);
          box(leg, [0.18, 0.09, 0.05], [0, -0.48, 0.17], color, 0.5, 0.3);
          legs.push(leg);
        }
      }
      if (hover) {
        cyl(body, 0.28, 0.12, 0.48, [0, 0.62, 0], dark, 8);
        cyl(body, 0.12, 0.02, 0.25, [0, 0.27, 0], color, 8, 2);
        for (const side of [-1, 1]) {
          sphere(body, 0.1, [side * 0.62, 0.7, -0.2], color, 1.5);
        }
      }
      if (weapon === "blade" || weapon === "dagger" || weapon === "ripper") {
        const a = arms[1];
        box(a, [0.13, 0.22, 0.13], [0, -0.92, 0.03], dark);
        box(a, [0.4, 0.075, 0.14], [0, -1.02, 0.03], metal);
        box(
          a,
          [0.16, weapon === "dagger" ? 0.55 : 1, 0.1],
          [0, -1.5, 0.03],
          "#adcedc",
          0.8,
        );
        box(
          a,
          [0.035, weapon === "dagger" ? 0.5 : 0.98, 0.12],
          [0.09, -1.5, 0.03],
          color,
          0.5,
          2,
        );
        a.rotation.x = -0.85;
      } else if (weapon === "hammer") {
        const a = arms[1];
        box(a, [0.11, 1.15, 0.11], [0, -1.1, 0], metal);
        box(a, [0.75, 0.35, 0.38], [0, -1.68, 0], dark);
        box(a, [0.77, 0.08, 0.4], [0, -1.7, 0], color, 0.5, 1);
        a.rotation.x = -0.85;
      } else if (
        ["rifle", "cannon", "heavy", "boss", "ward"].includes(weapon)
      ) {
        const a = arms[1];
        a.rotation.x = -1.3;
        box(
          a,
          [weapon === "cannon" ? 0.4 : 0.28, 0.4, 0.5],
          [0, -0.73, 0.17],
          dark,
        );
        const barrel = cyl(a, 0.09, 0.12, 0.7, [0, -1.15, 0.15], metal, 8);
        box(a, [0.09, 0.55, 0.09], [0.17, -1.06, 0.18], color, 0.6, 1.6);
        barrel.rotation.z = 0;
        arms[0].rotation.x = -0.65;
      } else if (weapon === "shield") {
        const a = arms[0];
        box(a, [0.77, 1.06, 0.13], [0, -0.5, 0.24], dark);
        box(a, [0.64, 0.9, 0.05], [0, -0.5, 0.33], color, 0.65, 0.45);
        box(a, [0.05, 0.76, 0.06], [0, -0.5, 0.37], "#e3f6ff", 0.6, 1);
        arms[1].rotation.x = -0.7;
      } else {
        const a = arms[1];
        box(a, [0.08, 1.65, 0.08], [0, -0.7, 0], metal);
        sphere(a, 0.18, [0, 0.18, 0], color, 2);
        const hoop = ring(a, 0.31, 0.025, [0, 0.18, 0], color, 1.5);
        hoop.rotation.y = 0.3;
        a.rotation.z = -0.13;
      }
      if (u.defId === "rook" || u.defId === "pax") {
        box(body, [0.67, 0.55, 0.09], [0, 0.68, -0.26], color);
        box(body, [0.15, 0.5, 0.42], [-0.35, 0.66, 0], dark);
      }
      if (u.defId === "nyx") {
        const halo = ring(head, 0.38, 0.025, [0, 0.35, 0], color, 2);
        halo.rotation.x = Math.PI / 2;
        box(body, [0.08, 0.24, 0.06], [0, 1.3, 0.31], "#ebffff", 0.5, 2);
        box(body, [0.25, 0.08, 0.06], [0, 1.3, 0.31], "#ebffff", 0.5, 2);
      }
      if (heavy) {
        root.scale.setScalar(model === "boss" ? 1.38 : 1.16);
        for (const side of [-1, 1])
          box(body, [0.3, 0.2, 0.5], [side * 0.68, 1.7, 0], metal);
      }
    }
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 18, 12),
      new THREE.MeshPhysicalMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        metalness: 0.2,
        roughness: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    shield.position.y = 1.05;
    shield.scale.set(0.78, 1.08, 0.72);
    shield.visible = false;
    root.add(shield);
    return {
      root,
      body,
      head,
      arms,
      legs,
      ring: baseRing,
      shield,
      home: new THREE.Vector3(),
      color,
      phase: this.actors.size * 1.7,
      enemy,
      weapon,
      hover,
      dead: false,
    };
  }
  select(id: string, target = "") {
    this.selected = id;
    this.target = target;
  }
  quality(low: boolean) {
    this.low = low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = !low;
    this.resize();
  }
  private loop = () => {
    this.animationId = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (document.hidden || this.failed || (this.low && now - this.last < 30))
      return;
    const dt = Math.min((now - this.last) / 1000 || 0.016, 0.06);
    this.last = now;
    this.time += dt;
    const labelPositions: {
      el: HTMLElement;
      x: number;
      y: number;
      enemy: boolean;
    }[] = [];
    for (const [id, a] of this.actors) {
      if (!this.busyActors.has(id) && !this.reduced) {
        a.body.position.y =
          Math.sin(this.time * 2 + a.phase) * (a.hover ? 0.09 : 0.025);
        a.head.rotation.y = Math.sin(this.time * 0.65 + a.phase) * 0.055;
        for (let i = 0; i < a.arms.length; i++)
          a.arms[i].rotation.z =
            Math.sin(this.time * 1.6 + a.phase + i) * 0.025;
      }
      const material = a.ring.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity =
        id === this.selected || id === this.target ? 3 : 1;
      const scale = id === this.target ? 1.2 : id === this.selected ? 1.08 : 1;
      a.ring.scale.setScalar(
        scale + (this.reduced ? 0 : Math.sin(this.time * 3) * 0.015),
      );
      a.shield.rotation.y = this.time * 0.2;
      if (this.labels) {
        const label = this.labels.querySelector<HTMLElement>(
          `[data-label="${id}"]`,
        );
        if (label) {
          const v = a.root.position.clone();
          v.y += a.hover ? 2.5 : 2.48 * a.root.scale.y;
          v.project(this.camera);
          labelPositions.push({
            el: label,
            x: ((v.x + 1) / 2) * this.width,
            y: ((1 - v.y) / 2) * this.height,
            enemy: a.enemy,
          });
        }
      }
    }
    for (const enemy of [false, true]) {
      let bottom = 4;
      for (const p of labelPositions
        .filter((p) => p.enemy === enemy)
        .sort((a, b) => a.y - b.y)) {
        const h = p.el.offsetHeight,
          w = p.el.offsetWidth;
        const next = Math.max(p.y, bottom + h + 4);
        p.el.style.top = next + "px";
        p.el.style.left =
          Math.min(this.width - w / 2 - 5, Math.max(w / 2 + 5, p.x)) + "px";
        bottom = next;
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= dt * 3;
      p.mesh.scale.setScalar(Math.max(0.01, p.life / p.max));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    if (!this.reduced) this.motes.rotation.y = this.time * 0.016;
    const old = this.camera.position.clone();
    if (this.shake > 0 && !this.reduced) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.87;
      if (this.shake < 0.001) this.shake = 0;
    }
    this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(old);
  };
  private burst(pos: THREE.Vector3, color: string, n = 20) {
    if (this.reduced) return;
    for (let i = 0; i < (this.low ? n / 2 : n); i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.13),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.copy(pos);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.scene.add(mesh);
      const life = 0.3 + Math.random() * 0.5;
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          Math.random() * 4,
          (Math.random() - 0.5) * 5,
        ),
        life,
        max: life,
      });
    }
  }
  private float(id: string, text: string, kind: string) {
    if (!this.container) return;
    const a = this.actors.get(id);
    if (!a) return;
    const v = a.root.position.clone();
    v.y += 1.8;
    v.project(this.camera);
    const el = document.createElement("div");
    el.className = "float-text " + kind;
    el.textContent = text;
    el.style.left = ((v.x + 1) / 2) * this.width + "px";
    el.style.top = ((1 - v.y) / 2) * this.height + "px";
    this.container.append(el);
    setTimeout(() => el.remove(), 1250);
  }
  private tween(ms: number, fn: (p: number) => void): Promise<void> {
    if (this.reduced) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        fn(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }
  async animate(events: FX[], sound: (kind: string) => void) {
    for (const fx of events) {
      const a = this.actors.get(fx.source),
        b = this.actors.get(fx.target);
      if (!b) continue;
      const p = b.root.position.clone().add(new THREE.Vector3(0, 1.25, 0));
      if (fx.kind === "death") {
        sound("death");
        this.burst(p, b.color, 36);
        this.busyActors.add(fx.target);
        await this.tween(350, (t) => {
          b.root.rotation.z = t * (b.enemy ? -1 : 1) * 1.6;
          b.root.position.y = -t * 0.8;
          b.root.scale.multiplyScalar(t > 0.8 ? 0.96 : 1);
        });
        b.root.visible = false;
        b.dead = true;
        this.busyActors.delete(fx.target);
        continue;
      }
      if (fx.kind === "hit" && a && fx.source !== fx.target) {
        this.busyActors.add(fx.source);
        this.busyActors.add(fx.target);
        const ranged = [
          "rifle",
          "staff",
          "cannon",
          "orb",
          "drone",
          "heavy",
          "boss",
          "ward",
        ].includes(a.weapon);
        const home = a.root.position.clone();
        if (ranged) {
          const from = home.clone().add(new THREE.Vector3(0, 1.35, 0));
          const beam = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            new THREE.MeshBasicMaterial({ color: a.color }),
          );
          this.scene.add(beam);
          await this.tween(220, (t) => {
            beam.position.lerpVectors(from, p, t);
            a.body.rotation.x = -Math.sin(t * Math.PI) * 0.12;
          });
          this.scene.remove(beam);
          beam.geometry.dispose();
          (beam.material as THREE.Material).dispose();
        } else {
          const near = p
            .clone()
            .sub(home)
            .setY(0)
            .normalize()
            .multiplyScalar(Math.max(0, home.distanceTo(p) - 1.6))
            .add(home);
          await this.tween(170, (t) => {
            a.root.position.lerpVectors(home, near, ease(t));
            a.body.rotation.z = Math.sin(t * Math.PI) * -0.2;
            if (a.arms[1]) a.arms[1].rotation.x = -t * 1.7;
          });
          const slash = new THREE.Mesh(
            new THREE.TorusGeometry(0.9, 0.045, 5, 24, Math.PI * 1.5),
            new THREE.MeshBasicMaterial({
              color: a.color,
              transparent: true,
              opacity: 0.85,
            }),
          );
          slash.position.copy(p);
          slash.rotation.set(0.2, 0.6, 0.2);
          this.scene.add(slash);
          setTimeout(() => {
            this.scene.remove(slash);
            slash.geometry.dispose();
            (slash.material as THREE.Material).dispose();
          }, 190);
        }
        sound("hit");
        this.shake = 0.11;
        this.burst(p, a.color);
        this.float(fx.target, fx.label ?? "−" + fx.value, "damage");
        await this.tween(190, (t) => {
          b.body.rotation.z = Math.sin(t * Math.PI) * (b.enemy ? -0.18 : 0.18);
          a.root.position.lerpVectors(a.root.position, home, ease(t));
          a.body.rotation.x = 0;
          a.body.rotation.z = 0;
          if (a.arms[1] && !ranged) a.arms[1].rotation.x = -0.85;
        });
        a.root.position.copy(home);
        b.body.rotation.z = 0;
        this.busyActors.delete(fx.source);
        this.busyActors.delete(fx.target);
      } else {
        const color =
          fx.kind === "heal"
            ? "#6df5ba"
            : fx.kind === "shield"
              ? "#83caff"
              : fx.kind === "shock"
                ? "#dac1ff"
                : b.color;
        sound(fx.kind);
        this.burst(p, color, fx.kind === "shock" ? 20 : 12);
        this.float(
          fx.target,
          fx.label ??
            (fx.kind === "heal"
              ? "+"
              : fx.kind === "shield"
                ? "BLOCK +"
                : fx.kind === "boost"
                  ? "POWER +"
                  : fx.kind === "mark"
                    ? "MARK +"
                    : "") + fx.value,
          fx.kind,
        );
        if (fx.kind === "shield") b.shield.visible = true;
        await this.tween(230, (t) => {
          if (fx.kind === "heal" || fx.kind === "boost")
            b.ring.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.3);
        });
      }
    }
  }
  dispose() {
    cancelAnimationFrame(this.animationId);
    this.observer.disconnect();
    this.renderer.dispose();
  }
}
