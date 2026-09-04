export type Faction = "human" | "cyborg" | "robot";
export type Target = "enemy" | "ally" | "self" | "enemies" | "party";
export type Effect =
  | "hit"
  | "pierce"
  | "sweep"
  | "shield"
  | "heal"
  | "mark"
  | "shock"
  | "stun"
  | "drain"
  | "taunt"
  | "boost"
  | "weaken";
export type Skill = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  target: Target;
  effect: Effect;
  base: number;
  mult: number;
  min?: number;
  parity?: "even" | "odd";
  extra?: Effect;
  extraValue?: number;
  ultimate?: boolean;
};
export type HeroDef = {
  id: string;
  name: string;
  role: string;
  faction: Faction;
  hp: number;
  color: string;
  quote: string;
  passive: string;
  weapon: string;
  skills: Skill[];
};
export type Unit = {
  uid: string;
  defId: string;
  hp: number;
  maxHp: number;
  shield: number;
  mark: number;
  shock: number;
  weak: number;
  stun: boolean;
  power: number;
  armor: number;
  charge: number;
  used: string[];
  level: number;
  mods: string[];
  revived?: boolean;
};
export type Enemy = Unit & {
  intent: Intent;
  elite: boolean;
  boss: boolean;
  staggered: boolean;
};
export type Intent = {
  effect:
    | "hit"
    | "sweep"
    | "shield"
    | "heal"
    | "shock"
    | "charge"
    | "summon"
    | "pierce";
  value: number;
  target: string;
  name: string;
};
export type EnemyDef = {
  id: string;
  name: string;
  hp: number;
  damage: number;
  model: string;
  color: string;
  blurb: string;
};
export type Die = { id: number; value: number; used: boolean; locked: boolean };
export type NodeType =
  | "fight"
  | "elite"
  | "event"
  | "recruit"
  | "shop"
  | "rest"
  | "boss";
export type MapNode = {
  id: string;
  act: number;
  row: number;
  col: number;
  type: NodeType;
  next: string[];
  terrain: string;
  encounter: string[];
};
export type Reward = {
  kind: "relic" | "upgrade" | "heal" | "gold" | "recruit";
  id?: string;
  title: string;
  desc: string;
  value?: number;
};
export type Relic = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  price: number;
};
export type Battle = {
  enemies: Enemy[];
  dice: Die[];
  round: number;
  rerolls: number;
  terrain: string;
  nodeType: NodeType;
  taunt: string | null;
  firstHit: boolean;
  overdrive: boolean;
  log: string[];
};
export type Run = {
  version: 2;
  seed: string;
  rng: number;
  difficulty: "normal" | "hard";
  screen:
    | "battle"
    | "map"
    | "reward"
    | "recruit"
    | "shop"
    | "rest"
    | "event"
    | "upgrade"
    | "won"
    | "lost";
  party: Unit[];
  maps: MapNode[];
  nodeId: string;
  visited: string[];
  act: number;
  gold: number;
  relics: string[];
  battle: Battle | null;
  rewards: Reward[];
  recruits: string[];
  shop: string[];
  eventId: string;
  upgradeReturn: "map" | "shop" | "rest";
  fallen: string[];
  stats: { kills: number; turns: number; damage: number; recruits: number };
  seq: number;
  bonus: number;
  result: string;
  history: string[];
};
export type FX = {
  kind:
    | "hit"
    | "shield"
    | "heal"
    | "shock"
    | "mark"
    | "stun"
    | "boost"
    | "death"
    | "miss"
    | "slash"
    | "shoot";
  source: string;
  target: string;
  value: number;
  label?: string;
  color?: string;
};
