# v0 Dexie save storage migration and SQLite cleanup

Status: DONE - Dexie save storage wired
Created: 2026-06-17
Priority: after standalone tick engine

## Decision context

Arkini is moving toward a JSON-driven `GameConfig` and a standalone tick/action engine. In that architecture, storage is only persistence for compiled config metadata and mutable save snapshots. It should not evaluate game rules, own timers, decide production readiness or know how loot/craft/merge works.

Because of that, the current OPFS SQLite/Kysely stack may be more machinery than the game needs. If the save becomes a coherent document/object graph and the engine evaluates it in memory, SQLite stops being the game database and becomes a fancy box for one save file. Fancy boxes are how simple games wake up wearing enterprise shoes.

Evaluate and likely migrate persistence to Dexie/IndexedDB to remove SQLite/OPFS/worker complexity.

## Target priority order

1. Build the new standalone tick/action engine first.
2. Use `GameConfigSchema` plus `startingState` to create an initial `GameSave` for tests and prototype runtime behavior.
3. Keep persistence out of the engine completely.
4. After the engine shape is proven, simplify storage by replacing SQLite/OPFS/Kysely persistence with Dexie if current query needs are simple save/config reads and writes.
5. Remove old SQLite/worker/OPFS code only after the new storage adapter is wired and covered by tests.

This order matters: storage should adapt to the engine/save model, not force the engine to look like a database schema. Do not invert it unless we enjoy debugging our own architecture like unpaid archaeologists.

## Boundary contract

The engine must stay standalone:

```ts
type TickInput = {
	config: GameConfig;
	save: GameSave;
	nowMs: number;
};

type TickResult = {
	save: GameSave;
	events: GameEvent[];
};
```

No engine code may import Dexie, SQLite, Kysely, OPFS, browser storage, React Query or app-specific persistence. The engine receives data and returns data. Storage loads before engine calls and persists after engine calls.

Expected runtime flow:

```txt
storage.loadActiveSave()
engine.applyAction/runTick(config, save, nowMs, rng)
storage.persistSave(nextSave)
UI receives domain events and renders/animates
```

## Candidate Dexie shape

Keep it intentionally small unless actual product needs force otherwise:

```ts
type SaveRecord = {
	id: "default" | string;
	gameId: string;
	configHash: string;
	version: number;
	updatedAtMs: number;
	save: GameSave;
};

type ConfigRecord = {
	id: string;
	hash: string;
	compiledAtMs: number;
	config: GameConfig;
};

type EventLogRecord = {
	id?: number;
	saveId: string;
	createdAtMs: number;
	event: GameEvent;
};
```

Likely stores:

```txt
saves
configs
eventLog?    optional debug/history, not required for gameplay
settings?    small app/UI settings if needed
```

Do not normalize every tile/job/input into separate IndexedDB tables unless we can prove a real query need. The engine wants a coherent save in memory, so document-style persistence is probably enough.

## Migration goals

- Replace browser SQLite persistence with a small `GameStorage` interface.
- Add `DexieGameStorage` as the likely default implementation.
- Keep save load/write/import/export explicit and testable.
- Support hard reset/recovery without OPFS-specific logic.
- Remove SQLocal/SQLite worker/OPFS migration code after parity.
- Keep compiled JSON config loading separate from save persistence.
- Avoid React Query as the gameplay source of truth once the tick engine takes over.

## Suggested implementation path

1. Audit the current database layer and list actual persisted data and query shapes.
2. Define a narrow `GameStorage` port around the future `GameSave` model:
   - `loadActiveSave`
   - `saveActiveSave`
   - `resetSave`
   - `loadCompiledConfig?`
   - `saveCompiledConfig?`
   - optional debug event log methods.
3. Implement Dexie storage in a separate module beside, not inside, the engine.
4. Add storage tests:
   - save roundtrip.
   - config hash/version mismatch handling.
   - reset/recovery.
   - corrupt/missing save fallback to `startingState`.
5. Wire Dexie behind the new engine adapter.
6. Remove old SQLite code once no runtime caller needs it.
7. Drop SQLite dependencies/scripts/migrations/worker code and update docs.

## Watch-outs

- IndexedDB transactions auto-commit if the transaction scope idles. Keep engine computation outside Dexie transactions; transactions should only do DB operations.
- Do not store partial mutations from one engine result. Persist the full next save atomically enough for our use case.
- Do not use `localStorage` for game save. It is synchronous/string-only and belongs to tiny preferences, not a client-only game state.
- Keep imports one-way: storage may import save/config types; engine must not import storage.
- If we discover real relational/query-heavy needs, pause and re-evaluate. Do not remove SQLite just because the current mood says “simplify” if the code proves otherwise.

## Acceptance criteria

- New tick/action engine remains storage-free.
- Dexie migration task starts only after `GameSave` and engine event model are drafted.
- Current SQLite/OPFS usage is audited before deletion.
- A Dexie-backed save can roundtrip the active game state.
- Reset and corrupt-save recovery work.
- SQLite/OPFS/worker code is removed only after tests pass and runtime behavior is switched.

## 2026-06-18 implementation checkpoint

Status: Dexie storage wrapper wired.

Implemented:

- Added `dexie` as the production IndexedDB dependency and `fake-indexeddb` for storage tests.
- Added `src/v0/game/storage` as the persistence boundary outside the standalone engine.
- Added a narrow `GameSaveStorage` port with active save load/save/delete/wipe methods.
- Added `DexieGameSaveStorage` with a single document-style `saves` table. The record stores `schemaVersion`, `saveVersion`, `gameId`, `configHash`, `updatedAtMs` and the full `GameSave` snapshot.
- Added config hashing via `hashRuntimeGameConfig` so saves are ignored when static config changes.
- Added corrupt/mismatched save fallback: load returns `null` when storage schema, save version, game id, config hash or `GameSaveSchema` validation fails.
- Added `createPersistentGameRuntimeStore`, which loads a saved `GameSave`, falls back to `RuntimeGameEngineAdapter` initial-save creation when missing/corrupt/mismatched, immediately persists the fallback save, then connects debounced persistence through `connectGameRuntimeSavePersistence`.
- Updated `GameRuntimeProvider` to use the persistent runtime factory instead of creating a volatile store directly.
- Updated hard reset to wipe Dexie save storage first, then best-effort OPFS/local/session storage. OPFS is feature-guarded so the recovery button does not die just because browser APIs are being browser APIs.
- Added tests for Dexie roundtrip, config mismatch, corrupt save fallback, delete/wipe and persistent runtime fallback/load behavior.

Boundary note: no engine file imports Dexie or browser storage. Storage imports engine model/schema types and the runtime factory wraps the adapter externally, which is the intended direction.
