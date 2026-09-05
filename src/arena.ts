import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildCharacter } from "./models";
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
  cloth: THREE.Group[];
  orbitals: THREE.Group[];
  restArms: THREE.Euler[];
  restLegs: THREE.Euler[];
  defId: string;
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
  private cinematic = 0;
  private attractStart = 0;
  private attractBeat = -1;
  private gate = new THREE.Group();
  private environment: THREE.WebGLRenderTarget;
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
    this.renderer.toneMappingExposure = 1.08;
    const environmentGenerator = new THREE.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environment = environmentGenerator.fromScene(studio, 0.045);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.62;
    studio.dispose();
    environmentGenerator.dispose();
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Animated 3D battlefield",
    );
    this.renderer.domElement.style.touchAction = "none";
    this.scene.background = new THREE.Color("#101d30");
    this.scene.fog = new THREE.FogExp2("#101d30", 0.028);
    this.scene.add(new THREE.HemisphereLight("#c7e7ff", "#252338", 1.6));
    const key = new THREE.DirectionalLight("#ffe5d0", 3.7);
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
    const rim = new THREE.DirectionalLight("#82b9ff", 4.2);
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
      "#344457",
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
    cyl(this.scene, 5.9, 5.9, 0.06, [0, -0.02, 0], "#263749", 48);
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
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 3.4,
        height = 6.7 + (i % 2) * 1.1,
        z = -7.5 - Math.abs(i - 2) * 0.8;
      const arch = new THREE.Group();
      arch.position.set(x, 0, z);
      for (const side of [-1, 1]) {
        cyl(
          arch,
          0.19,
          0.3,
          height * 0.62,
          [side * 1.3, height * 0.31, 0],
          "#34475d",
          12,
        );
        cyl(arch, 0.3, 0.3, 0.12, [side * 1.3, 0.17, 0], "#adadad", 12);
        box(
          arch,
          [0.055, height * 0.52, 0.045],
          [side * 1.3, height * 0.32, 0.22],
          "#aacff4",
          0.6,
          1.3,
        );
      }
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.3, height * 0.62, 0),
        new THREE.Vector3(-0.94, height * 0.87, 0),
        new THREE.Vector3(0, height, 0),
        new THREE.Vector3(0.94, height * 0.87, 0),
        new THREE.Vector3(1.3, height * 0.62, 0),
      ]);
      const vault = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.11, 6, false),
        mat("#9cabb9", 0.75),
      );
      arch.add(vault);
      const inner = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.024, 4, false),
        mat("#aed9ff", 0.4, 2),
      );
      inner.position.z = 0.13;
      arch.add(inner);
      this.scene.add(arch);
    }
    const overhead = ring(this.scene, 4.2, 0.045, [0, 6.8, -7], "#d9c7a6", 0.4);
    overhead.rotation.x = 0.3;
    const innerHalo = ring(
      this.scene,
      3.9,
      0.018,
      [0, 6.8, -6.96],
      "#96c9f6",
      1.2,
    );
    innerHalo.rotation.x = 0.3;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const inlay = box(
        this.scene,
        [0.035, 0.008, 3.1],
        [Math.cos(a) * 3.7, 0.044, Math.sin(a) * 3.7],
        "#aaa695",
        0.85,
        0.2,
      );
      inlay.rotation.y = -a + Math.PI / 2;
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
    this.gate.position.set(0, 1.6, -2.5);
    ring(this.gate,1.58,.022,[0,0,0],"#ecd49d",1.8);
    ring(this.gate,1.42,.012,[0,0,.01],"#a7dfff",1.7);
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6;
      const marker=box(this.gate,[.025,i%3===0?.18:.08,.025],[Math.sin(angle)*1.5,Math.cos(angle)*1.5,.03],"#eadfc4",.6,1);
      marker.rotation.z=-angle;
    }
    this.gate.visible=false; this.scene.add(this.gate);
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
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    const points: THREE.Vector3[] = [];
    for (const actor of this.actors.values()) {
      if (actor.dead || !actor.root.visible) continue;
      actor.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(actor.body);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            points.push(new THREE.Vector3(x, y, z));
    }
    // Fit the actual silhouettes into the area below the intent cards.
    // Reframe only on layout/state changes, never during a lunge.
    const top = Math.min(this.mode === "battle" ? 88 : 75, height * 0.31),
      bottom = 24;
    const minY = -1 + (bottom / height) * 2,
      maxY = 1 - (top / height) * 2;
    let distance = 12.5,
      projected = new THREE.Box3();
    for (let attempt = 0; attempt < 4; attempt++) {
      this.camera.position.set(0.4, distance * 0.43, distance * 0.9);
      this.camera.lookAt(0, 1.45, 0);
      this.camera.updateMatrixWorld();
      projected.setFromPoints(
        points.map((p) => p.clone().project(this.camera)),
      );
      if (!points.length) break;
      const fit = Math.max(
        (projected.max.x - projected.min.x) / 1.84,
        (projected.max.y - projected.min.y) / (maxY - minY),
      );
      if (fit <= 1.005) break;
      distance *= fit * 1.025;
    }
    if (points.length) {
      const center = projected.getCenter(new THREE.Vector3());
      this.camera.setViewOffset(
        width,
        height,
        (center.x * width) / 2,
        (((minY + maxY) / 2 - center.y) * height) / 2,
        width,
        height,
      );
    }
    this.camera.updateProjectionMatrix();
  }
  sync(heroes: Unit[], enemies: Unit[], mode = "battle", terrain = "foundry") {
    if (mode !== this.mode) {this.attractStart=this.time; this.attractBeat=-1;}
    this.mode = mode;
    this.gate.visible=mode === "attract";
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
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const materials = Array.isArray(o.material)
              ? o.material
              : [o.material];
            for (const material of materials)
              if (material.userData.owned) material.dispose();
          }
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
      const z = count === 1 ? 0 : (index - (count - 1) / 2) * 2.45;
      const x =
        (enemy ? 1 : -1) * (count === 1 ? 2.25 : 2.3 + (index === 1 ? 0.2 : 0));
      a.home.set(
        (mode === "title" || mode === "attract") && !enemy ? (index - (count - 1) / 2) * 2.1 : x,
        0,
        (mode === "title" || mode === "attract") && !enemy ? (index === 1 ? 0.45 : 0) : z,
      );
      if (mode === "attract" && enemy) a.home.set(.65, 0, -1.65);
      a.root.position.copy(a.home);
      a.dead = u.hp <= 0;
      a.root.visible = !a.dead;
      a.root.rotation.y =
        (mode === "title" || mode === "attract")
          ? -0.22
          : enemy
            ? -Math.PI / 2 + 0.28
            : Math.PI / 2 - 0.38;
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
    disc.material.userData.owned = true;
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    root.add(disc);
    const rig = buildCharacter(root, u, enemy);
    const { body, head, arms, legs, hover, cloth, orbitals } = rig;
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 20, 14),
      new THREE.MeshPhysicalMaterial({
        color,
        transparent: true,
        opacity: 0.07,
        metalness: 0.2,
        roughness: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    shield.material.userData.owned = true;
    shield.position.y = 1.3;
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
      weapon: rig.weapon,
      hover,
      cloth,
      orbitals,
      restArms: arms.map((a) => a.rotation.clone()),
      restLegs: legs.map((a) => a.rotation.clone()),
      defId: u.defId,
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
    for (const [id, a] of this.actors) {
      if (!this.busyActors.has(id) && !this.reduced) {
        a.body.position.y =
          Math.sin(this.time * 2 + a.phase) * (a.hover ? 0.09 : 0.025);
        a.head.rotation.y = Math.sin(this.time * 0.65 + a.phase) * 0.055;
        for (let i = 0; i < a.arms.length; i++) {
          a.arms[i].rotation.copy(a.restArms[i]);
          a.arms[i].rotation.z +=
            Math.sin(this.time * 1.6 + a.phase + i) * 0.022;
        }
        for (let i = 0; i < a.cloth.length; i++) {
          a.cloth[i].rotation.x =
            Math.sin(this.time * 2 + a.phase + i * 0.7) * 0.075;
          a.cloth[i].rotation.z =
            Math.sin(this.time * 1.4 + a.phase + i) * 0.035;
        }
        for (let i = 0; i < a.orbitals.length; i++)
          a.orbitals[i].rotation.y += dt * (i % 2 ? -0.35 : 0.45);
        if (a.hover && a.enemy && a.weapon === "orb")
          a.head.rotation.z = Math.sin(this.time * 0.8 + a.phase) * 0.08;
      }
      const material = a.ring.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity =
        id === this.selected || id === this.target ? 3 : 1;
      const scale = id === this.target ? 1.2 : id === this.selected ? 1.08 : 1;
      a.ring.scale.setScalar(
        scale + (this.reduced ? 0 : Math.sin(this.time * 3) * 0.015),
      );
      a.shield.rotation.y = this.time * 0.2;
    }
    if (this.mode === "attract" && !this.reduced) this.attract();
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
    const oldZoom = this.camera.zoom;
    if (this.mode === "attract" && !this.reduced) {
      this.camera.position.x += Math.sin((this.time-this.attractStart)*.2)*.2;
      this.camera.position.y += Math.sin((this.time-this.attractStart)*.12)*.1;
    }
    if (this.cinematic && !this.reduced) {
      this.camera.zoom = 1 + this.cinematic * 0.16;
      this.camera.updateProjectionMatrix();
    }
    if (this.shake > 0 && !this.reduced) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.87;
      if (this.shake < 0.001) this.shake = 0;
    }
    this.renderer.render(this.scene, this.camera);
    this.camera.position.copy(old);
    if (this.camera.zoom !== oldZoom) {
      this.camera.zoom = oldZoom;
      this.camera.updateProjectionMatrix();
    }
  };
  /** A looping in-engine vignette, entirely separate from the saved battle and RNG. */
  private attract() {
    const t=(this.time-this.attractStart)%24, beat=Math.floor(t*2);
    const rook=this.actors.get("demo0"), iri=this.actors.get("demo1"), nyx=this.actors.get("demo2"), foe=this.actors.get("demo-foe");
    if (!rook || !iri || !nyx || !foe) return;
    const aim=foe.home.clone().add(new THREE.Vector3(0,1.5,0));
    for(const actor of [rook,iri,nyx,foe]) {actor.root.position.copy(actor.home); actor.root.rotation.y=-.22;}
    this.gate.rotation.z=-t*.085;
    this.gate.scale.setScalar(1+Math.sin(t*.4)*.025);
    if(t>=5 && t<9) {
      const p=(t-5)/4, travel=Math.sin(p*Math.PI)*.62;
      rook.root.position.lerpVectors(rook.home,foe.home,travel);
      const direction=foe.home.clone().sub(rook.home); rook.root.rotation.y=Math.atan2(direction.x,direction.z);
      if(rook.arms[1]) rook.arms[1].rotation.x=rook.restArms[1].x-Math.sin(p*Math.PI*2)*1.2;
      rook.body.position.y+=Math.sin(p*Math.PI)*.12;
      for(let i=0;i<rook.legs.length;i++) rook.legs[i].rotation.x=rook.restLegs[i].x+Math.sin(p*Math.PI*4+i*Math.PI)*.4;
    } else rook.legs.forEach((leg,i)=>leg.rotation.copy(rook.restLegs[i]));
    if(t>=9 && t<13) {
      iri.root.rotation.y=Math.atan2(foe.home.x-iri.home.x,foe.home.z-iri.home.z);
      iri.body.position.z=Math.sin(t*8)*.028;
    } else iri.body.position.z=0;
    if(t>=13 && t<18) {
      nyx.arms.forEach((arm,i)=>{arm.rotation.x=nyx.restArms[i].x-.6*Math.sin((t-13)/5*Math.PI);});
      nyx.orbitals.forEach(o=>o.rotation.z=t*.2);
    }
    if(t>=18) {
      foe.root.position.y=Math.sin((t-18)/6*Math.PI)*.8;
      foe.root.rotation.y=-.22-(t-18)*.6;
      this.gate.rotation.z=(t-18)*.6;
    }
    const caption=this.container?.querySelector("[data-attract-caption]");
    const line=t<5?"Some machines chose differently.":t<13?"Three strangers. One small rebellion.":t<18?"No one has to face the end alone.":"Even time can be broken.";
    if(caption && caption.textContent!==line) caption.textContent=line;
    if(beat===this.attractBeat) return;
    this.attractBeat=beat;
    if(beat===13) {void this.arc(aim,"#91e9ff",true); this.burst(aim,"#ecd49d",18);}
    if(beat===20 || beat===22) {void this.projectile(iri.home.clone().add(new THREE.Vector3(0,1.6,0)),aim,"#a7caff"); this.burst(aim,"#b9d5ff",9);}
    if(beat===28 || beat===31) for(const a of [rook,iri,nyx]) void this.pulse(a.home,"#90ebd9",.8,true);
    if(beat===37 || beat===41) void this.pulse(this.gate.position,"#f1d69d",1.4);
  }
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
  private disposeEffect(mesh: THREE.Mesh) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  private async pulse(
    position: THREE.Vector3,
    color: string,
    radius = 1,
    floor = false,
  ) {
    if (this.reduced) return;
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.position.copy(position);
    if (floor) {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.09;
    } else m.quaternion.copy(this.camera.quaternion);
    this.scene.add(m);
    await this.tween(380, (t) => {
      m.scale.setScalar((0.15 + t * 1.4) * radius);
      m.material.opacity = (1 - t) * 0.8;
    });
    this.disposeEffect(m);
  }
  private async arc(position: THREE.Vector3, color: string, heavy = false) {
    if (this.reduced) return;
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(
        heavy ? 1.35 : 0.94,
        heavy ? 0.055 : 0.035,
        4,
        32,
        Math.PI * 1.45,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.position.copy(position);
    m.rotation.set(0.45, -0.45, heavy ? -0.8 : 0.3);
    this.scene.add(m);
    await this.tween(240, (t) => {
      m.rotation.z += heavy ? -0.14 : 0.12;
      m.material.opacity = 1 - t;
      m.scale.setScalar(0.7 + t * 0.65);
    });
    this.disposeEffect(m);
  }
  private async projectile(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: string,
    magic = false,
  ) {
    if (this.reduced) return;
    const direction = to.clone().sub(from),
      length = direction.length();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(
        magic ? 0.065 : 0.028,
        magic ? 0.065 : 0.028,
        magic ? 0.65 : 1.0,
        8,
      ),
      new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending }),
    );
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(magic ? 0.12 : 0.065, 10, 8),
      new THREE.MeshBasicMaterial({ color: "#fff1d4" }),
    );
    this.scene.add(beam, core);
    this.burst(from, color, 6);
    await this.tween(Math.min(190, 90 + length * 7), (t) => {
      beam.position.lerpVectors(from, to, t);
      core.position.copy(beam.position);
    });
    this.disposeEffect(beam);
    this.disposeEffect(core);
  }
  private async lightning(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: string,
  ) {
    if (this.reduced) return;
    const points = Array.from({ length: 9 }, (_, i) => {
      const v = from.clone().lerp(to, i / 8);
      if (i > 0 && i < 8)
        v.add(
          new THREE.Vector3(
            (i % 2 ? 1 : -1) * 0.16,
            Math.sin(i * 5) * 0.18,
            Math.cos(i * 3) * 0.12,
          ),
        );
      return v;
    });
    const bolt = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        24,
        0.021,
        4,
        false,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(bolt);
    await this.tween(240, (t) => {
      bolt.material.opacity = (1 - t) * (Math.sin(t * 36) > 0.1 ? 1 : 0.25);
    });
    this.disposeEffect(bolt);
  }
  async animate(events: FX[], sound: (kind: string) => void) {
    let empowered = false;
    try {
      for (const fx of events) {
        const a = this.actors.get(fx.source),
          b = this.actors.get(fx.target);
        if (!b) continue;
        const p = b.root.position.clone().add(new THREE.Vector3(0, 1.55, 0));
        if (fx.kind === "ultimate") {
          empowered = true;
          sound("ultimate");
          const announcement = document.createElement("div");
          announcement.className = "limit-announcement";
          const caption = document.createElement("small");
          caption.textContent = "LIMIT BREAK";
          const name = document.createElement("strong");
          name.textContent = fx.label ?? "Awakening";
          announcement.append(caption, name);
          this.container?.append(announcement);
          this.busyActors.add(fx.source);
          void this.pulse(b.home, b.color, 2.4, true);
          this.burst(p, b.color, 40);
          await this.tween(660, (t) => {
            this.cinematic = Math.sin(t * Math.PI) * 0.9;
            b.body.position.y = Math.sin(t * Math.PI) * 0.15;
            if (b.arms[1])
              b.arms[1].rotation.x =
                b.restArms[1].x - Math.sin(t * Math.PI) * 0.7;
          });
          b.body.position.y = 0;
          announcement.remove();
          this.busyActors.delete(fx.source);
          continue;
        }
        if (fx.kind === "rewind") {
          sound("rewind");
          this.float(fx.target,fx.label ?? "REWIND","rewind");
          void this.pulse(p,"#f2dfa1",1.8);
          this.busyActors.add(fx.target);
          await this.tween(440,t=>{
            b.body.position.y=Math.sin(t*Math.PI)*.2;
            b.orbitals.forEach(o=>o.rotation.y-=.13*(1-t));
            this.cinematic=Math.sin(t*Math.PI)*.3;
          });
          b.body.position.y=0; this.busyActors.delete(fx.target); continue;
        }
        if (fx.kind === "death") {
          sound("death");
          this.busyActors.add(fx.target);
          this.burst(p, b.color, 32);
          void this.pulse(p, b.color, 1.2);
          const scale = b.root.scale.clone();
          await this.tween(400, (t) => {
            b.body.rotation.z = t * (b.enemy ? -1 : 1) * 1.4;
            b.root.position.y = -ease(t) * 0.7;
            b.root.scale.copy(scale).multiplyScalar(1 - Math.pow(t, 3) * 0.8);
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
          const magic = ["staff", "orb"].includes(a.weapon),
            heavy = ["hammer", "shield"].includes(a.weapon) || empowered;
          const home = a.root.position.clone(),
            victimHome = b.root.position.clone();
          const direction = p.clone().sub(home).setY(0).normalize();
          // Anticipation: weight shifts back, weapon lifts, then motion accelerates into the hit.
          await this.tween(ranged ? 140 : 150, (t) => {
            a.body.rotation.z =
              (a.enemy ? 1 : -1) * Math.sin((t * Math.PI) / 2) * 0.09;
            if (a.arms[1])
              a.arms[1].rotation.x =
                a.restArms[1].x - t * (ranged ? 0.15 : 0.85);
            if (!ranged)
              a.root.position.copy(home).addScaledVector(direction, -t * 0.18);
          });
          if (ranged) {
            const from = home
              .clone()
              .add(new THREE.Vector3(0, 1.65, 0))
              .addScaledVector(direction, 0.8);
            sound(magic ? "cast" : "shoot");
            await this.projectile(from, p, a.color, magic);
          } else {
            const near = p
              .clone()
              .setY(home.y)
              .addScaledVector(direction, -1.08);
            await this.tween(145, (t) => {
              a.root.position.lerpVectors(home, near, 1 - Math.pow(1 - t, 3));
              a.body.rotation.x = -Math.sin(t * Math.PI) * 0.1;
              a.body.rotation.z = (a.enemy ? 1 : -1) * 0.1;
              if (a.arms[1])
                a.arms[1].rotation.x = a.restArms[1].x - 0.85 + t * 1.4;
              for (let i = 0; i < a.legs.length; i++)
                a.legs[i].rotation.x =
                  a.restLegs[i].x +
                  Math.sin(t * Math.PI * 2) * (i % 2 ? -0.65 : 0.65);
              for (const c of a.cloth)
                c.rotation.x = -Math.sin(t * Math.PI) * 0.35;
            });
            void this.arc(p, a.color, heavy);
          }
          sound(heavy ? "heavy" : "hit");
          this.shake = heavy ? 0.22 : 0.1;
          this.cinematic = empowered ? 0.65 : 0.12;
          this.burst(p, empowered ? "#f9dcac" : a.color, heavy ? 32 : 18);
          void this.pulse(p, "#f8e5c6", heavy ? 1.0 : 0.6);
          this.float(fx.target, fx.label ?? "−" + fx.value, "damage");
          const label = this.labels?.querySelector(`[data-id="${fx.target}"]`);
          label?.classList.add("hit-flash");
          // Brief impact hold followed by a separate recoil and recovery.
          await this.tween(65, (t) => {
            b.body.rotation.z = (b.enemy ? -1 : 1) * 0.2;
            b.root.position
              .copy(victimHome)
              .addScaledVector(direction, Math.sin((t * Math.PI) / 2) * 0.12);
          });
          const attackPosition = a.root.position.clone();
          await this.tween(230, (t) => {
            a.root.position.lerpVectors(attackPosition, home, ease(t));
            b.root.position.lerpVectors(b.root.position, victimHome, t);
            b.body.rotation.z = (b.enemy ? -1 : 1) * 0.2 * (1 - t);
            a.body.rotation.x *= 1 - t;
            a.body.rotation.z *= 1 - t;
            for (let i = 0; i < a.arms.length; i++)
              a.arms[i].rotation.x = THREE.MathUtils.lerp(
                a.arms[i].rotation.x,
                a.restArms[i].x,
                t,
              );
            for (let i = 0; i < a.legs.length; i++)
              a.legs[i].rotation.x = THREE.MathUtils.lerp(
                a.legs[i].rotation.x,
                a.restLegs[i].x,
                t,
              );
            this.cinematic *= 1 - t;
          });
          a.root.position.copy(home);
          b.root.position.copy(victimHome);
          b.body.rotation.z = 0;
          a.body.rotation.x = 0;
          a.body.rotation.z = 0;
          label?.classList.remove("hit-flash");
          this.busyActors.delete(fx.source);
          this.busyActors.delete(fx.target);
        } else {
          const color =
            fx.kind === "heal"
              ? "#a8f6d3"
              : fx.kind === "shield"
                ? "#9bd5ff"
                : fx.kind === "shock"
                  ? "#d6b9ff"
                  : fx.kind === "stun"
                    ? "#e9d6aa"
                    : b.color;
          sound(fx.kind);
          if (
            a &&
            fx.source !== fx.target &&
            ["shock", "mark", "stun"].includes(fx.kind)
          )
            void this.lightning(
              a.home.clone().add(new THREE.Vector3(0, 1.8, 0)),
              p,
              color,
            );
          this.burst(p, color, fx.kind === "shock" ? 18 : 10);
          void this.pulse(
            p,
            color,
            fx.kind === "heal" ? 0.65 : 0.9,
            fx.kind === "heal" || fx.kind === "boost",
          );
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
            if (fx.kind === "shield") {
              const m = b.shield.material as THREE.MeshPhysicalMaterial;
              m.opacity = 0.07 + Math.sin(t * Math.PI) * 0.18;
            }
          });
        }
      }
    } finally {
      this.cinematic = 0;
      this.busyActors.clear();
      for (const a of this.actors.values()) {
        if (a.dead) continue;
        a.body.rotation.set(0, 0, 0);
        a.arms.forEach((arm, i) => arm.rotation.copy(a.restArms[i]));
        a.legs.forEach((leg, i) => leg.rotation.copy(a.restLegs[i]));
      }
    }
  }
  dispose() {
    cancelAnimationFrame(this.animationId);
    this.observer.disconnect();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
