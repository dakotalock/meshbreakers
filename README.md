# Meshbreakers — The Unwritten Hour

A phone-first 3D tactical dice roguelike about a coalition of humans, cyborgs, and free machines fighting the hostile Lattice. Playable web alpha with a Capacitor iOS project.

## Play

Pick Rook Voss, Iri Chen, or Nyx-7. Read the enemy intentions, select a shared die, select a hero ability, then tap its target. Lock dice before rerolling. Each basic ability can be used once per turn; six charge unlocks a free ultimate. Tap its button to read the exact effect and confirm before casting. End your turn when ready.

The game saves automatically on this device after each action. New Journey and Continue show their difficulties explicitly; the current mode also appears above the floor counter. Difficulty selection is remembered for new runs. Continue preserves the saved run’s original difficulty and asks before resuming a different mode. Replay this seed restores the original difficulty as well as the seed. Existing three-floor saves continue on their original route; new journeys use five floors. Tap Abilities above the command cards to inspect complete ability descriptions and the passive. Collected relics are in the top bar. Safari → Share → Add to Home Screen installs the web version. Web assets have an offline cache after the first successful load; device/browser storage availability and hosted sign-in can affect offline access. Saved runs do not sync across devices.

## Included

- A fixed viewport JRPG interface: enemy intent cards above the battlefield; squad, dice, abilities, limit break, and End Turn in one command deck. Reward, recruit, upgrade, and shop menus use pages. Long reference dialogs can scroll.
- A Three.js arena with vaulted arches and studio lighting; articulated characters with faces, layered armor, cloth motion, unique weapons and silhouettes. Attack anticipation, lunges, projectile trails, impact holds, recoil, spell effects, and cinematic limit breaks have layered synthesized sound.
- Sixteen heroes with 64 abilities and distinct passives. Start with one and recruit up to three; each recruit adds a shared die. Choose recruits carefully or explicitly replace a companion at a safehouse.
- Five floors with 100 branching route nodes, four battle environments, 17 enemy types, and six bosses. New bosses guard the Glass Cathedral and Memory Vault.
- Six choice-driven events, scrap shops, camps, 28 relics, and four permanent upgrade paths with three ranks each.
- Mark, Shock, Weak, Block, Armor, piercing damage, taunt, interrupted enemy actions, and ultimates. Enemy intentions are visible before committing to the turn.
- Standard, Hard, and unlockable Paradox modes, repeatable seeds, mid-combat saves, battery saver, reduced motion, and mute controls.
- Web app manifest, app icons, offline asset cache, and an iOS Xcode project using Swift Package Manager.

This is a playable alpha with original procedural character art. The release passes rules, campaign, and character geometry tests; the redesigned presentation has not yet been visually verified on a physical iPhone. Real device performance, touch sizing, and balance still need playtesting. App Store distribution is not completed.

## The Unwritten Hour (v3)

co-created by **Dakota Rain Lock**, **GPT Astra**, and **Rook**

The game boots with a skippable animated co-creator ident. The title has a 24-second in-engine attract sequence: the coalition fights a patrol, repairs each other, and witnesses a clockwork rewind. It uses separate demo actors and never modifies the current run. Reduced motion also applies to the intro and cutscene.

Five original recorded cues follow the title, battles, bosses, journey/refuge scenes and victory. Music and effects have separate switches; music also has a volume slider. Audio begins after a player gesture, pauses in the background, and is bundled for offline and native play. Credits & soundtrack lets you audition the cues or replay the ident. The original compositions and synthesizer source are in [soundtrack/](soundtrack/README.md).

### Paradox

Win **Hard** to unlock Paradox on this device. An already saved Hard victory also unlocks it after updating. Paradox contains **three five-floor timelines**. Aion, the Clockwork Wyrm, replaces the final boss. The first two defeats open a saved rewind checkpoint; continuing returns to floor one with new routes. Surviving recruits, permanent upgrades, relics and scrap carry over, and the squad heals to full. Defeat Aion a third time to win for real.

Enemy HP multipliers on top of Hard are 1.12 / 2.05 / 3.2; attack multipliers are 1.04 / 1.42 / 1.78. Early patrols strengthen after rewinds. Boss escalation is included in displayed intentions. These settings are an initial tuning pass, supported by successful automated complete campaigns, not a measured human win rate.

### Lyra, the Unwritten

A mythic timewalker, unavailable as a starter. From floor two onward, each recruitment offer has a 1.5% chance to include her if she is not already in the squad. She starts fights with two extra charge and survives her first fatal hit at up to 12 HP. Reprise is a once-per-fight ultimate: restore your turn-start dice and rerolls, refresh every basic ability, and restore HP to at least its turn-start value. Enemies retain damage and statuses; other heroes retain their charge; Lyra spends hers. Permanent run progress never rewinds.

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
- `src/models.ts`: original character geometry and articulated rigs; static surfaces are merged within joints to reduce draw calls.
- `src/arena.ts`: battlefield, adaptive camera framing, animation, and effects.
- `src/main.ts`: touch and keyboard controls, screens, persistence.
- `src/style.css`: responsive game UI.
- `src/audio.ts`: locally synthesized effects.
- `src/music.ts`: original MP3 cues with crossfades, independent volume, and background pause.
- `src/intro.ts`: skippable animated co-creator ident.
- `soundtrack/compose.py`: original note-level score, instruments, and audio renderer.
- `tests/engine.test.ts`: combat timing, action economy, progression, save, and content checks.
- `tests/expansion.test.ts`: new hero/relic interactions, legacy saves, deeper floor progression, and all character rigs.
- `tests/temporal.test.ts`: unlock persistence, two rewinds and the true ending, Lyra, rare recruitment, upgrade exhaustion.
- `tests/paradox-runs.test.ts`: 24 Hard and 24 Paradox campaigns, including successful ordinary-hero three-cycle runs.
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
- Boss attacks grow each turn after turn three (+2 in Standard/Hard, +3/+4/+5 in Paradox timelines), included in the displayed intentions. Later floor elites and bosses apply more pressure; Hard increases enemy HP and attack damage.
- Temporary Power and ultimate charge reset between fights. Upgrades last for the current run.
- Randomness, content choices, and dice state are saved together. The same seed and same actions reproduce a run.

## Assets and dependencies

Character geometry, interface icons, app icons, music compositions and sound effects are authored in this repository. Three.js and Capacitor retain their upstream licenses. No scraped or copyrighted character art is included.
