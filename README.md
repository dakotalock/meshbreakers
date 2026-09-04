# Meshbreakers

A phone-first 3D tactical dice roguelike about a coalition of humans, cyborgs, and free machines fighting the hostile Lattice. Playable web alpha with a Capacitor iOS project.

## Play

Pick Rook Voss, Iri Chen, or Nyx-7. Read the enemy intentions, select a shared die, select a hero ability, then tap its target. Lock dice before rerolling. Each basic ability can be used once per turn; six uses charge a free ultimate. End your turn when ready.

The game saves automatically on this device after each action. Safari → Share → Add to Home Screen installs the web version. Web assets have an offline cache after the first successful load; device/browser storage availability and hosted sign-in can affect offline access. Saved runs do not sync across devices.

## Included

- An actual Three.js 3D arena with articulated characters, idle movement, dash attacks, energy projectiles, weapon trails, hit reactions, death animations, shields, particles, and synthesized sound.
- Nine heroes with 36 abilities and distinct passives. Start with one and recruit up to three; each recruit adds a shared die. Choose recruits carefully or explicitly replace a companion at a safehouse.
- Three sectors with branching seeded routes, four battle environments, 11 enemy types, and three bosses.
- Six choice-driven events, scrap shops, camps, 16 relics, and four permanent upgrade paths with three ranks each.
- Mark, Shock, Weak, Block, Armor, piercing damage, taunt, interrupted enemy actions, and ultimates. Enemy intentions are visible before committing to the turn.
- Standard and Hard modes, repeatable seeds, mid-combat saves, battery saver, reduced motion, and mute controls.
- Web app manifest, app icons, offline asset cache, and an iOS Xcode project using Swift Package Manager.

This is a playable alpha. The character models are original procedural low-poly models, not imported production art. Campaign balance, accessibility on real devices, performance, and animation polish still need human playtesting. App Store distribution is not completed.

## Development

Node 22+ is recommended for the Capacitor 8 toolchain.

```sh
npm ci
npm run dev
npm test
npm run build
```

Build output is in `dist/`; deploy that directory to a static host. No backend, API keys, analytics, advertising, or paid services are required to run the game.

The GitHub repository retains its earlier history. The previous incomplete `js/p*.js` bundle was replaced by maintainable TypeScript source.

### Source layout

- `src/content.ts`: heroes, abilities, enemies, relics, upgrades, events.
- `src/engine.ts`: deterministic game rules and run progression, independent of the UI.
- `src/arena.ts`: 3D models, arena, animation, and effects.
- `src/main.ts`: touch and keyboard controls, screens, persistence.
- `src/style.css`: responsive game UI.
- `src/audio.ts`: synthesized effects; no audio assets are downloaded.
- `tests/engine.test.ts`: combat timing, action economy, progression, save, and content checks.
- `tests/runs.test.ts`: 36 full seeded campaigns with a deterministic heuristic player. This catches broken routes and invalid states; it is not a substitute for human balance testing.

## iPhone app

The `ios/` project and `capacitor.config.json` are included. On a Mac with the current supported Xcode:

```sh
npm ci
npm run ios:sync
npm run ios:open
```

Select your Apple development team in Xcode, select a physical iPhone, and build. The app bundles `dist/` locally; it does not load a remote website. Bundle identifier: `com.dakotalock.meshbreakers` (change it if needed for signing).

Before TestFlight or the App Store, test on physical iPhones, verify orientation/safe-area handling, background/resume, sound, saves, offline startup and long-session performance; then configure signing, release identifiers, store metadata and screenshots. The Xcode project was generated and synchronized here, but no Xcode build, code signing, device test, TestFlight upload, or App Store submission has been performed.

Official platform workflow: [Capacitor iOS documentation](https://capacitorjs.com/docs/ios) and [App Store deployment](https://capacitorjs.com/docs/ios/deploying-to-app-store).

## Mechanics

- Damage bonuses from Mark apply per hit. Iri adds a further +3 against marked targets.
- Shock ticks before the enemy phase, ignores Block, and drops by one. Live Conduits add one damage per tick.
- Weak reduces attacks by two for its remaining turns. Armor reduces each hit; Pierce ignores Block but not Armor.
- Hero Block expires at the beginning of the next player turn. Enemy Block expires after it has protected the enemy through a player turn.
- Jam skips an action; that enemy is immune to another jam on the immediately following turn.
- Downed heroes cannot act or be healed during battle. Survivors continue; fallen heroes leave the squad. Backup Core can prevent one fatal hit per fight.
- Temporary Power and ultimate charge reset between fights. Upgrades last for the current run.
- Randomness, content choices, and dice state are saved together. The same seed and same actions reproduce a run.

## Assets and dependencies

Character geometry, interface icons, app icons and sound effects are authored in this repository. Three.js and Capacitor retain their upstream licenses. No scraped or copyrighted character art is included.
