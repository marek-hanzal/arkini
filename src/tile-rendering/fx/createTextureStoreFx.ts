import { Effect } from "effect";
import { Assets, type Texture } from "pixi.js";

export interface TextureLease {
	readonly textureFx: Effect.Effect<Texture, unknown, never>;
	readonly releaseFn: () => void;
}

export interface TextureStore {
	readonly acquireFn: (url: string) => TextureLease;
	readonly closeFx: Effect.Effect<void, unknown, never>;
}

interface SharedTextureEntry {
	readonly load: Promise<Texture>;
	readonly url: string;
	stores: number;
}

interface TextureEntry {
	readonly shared: SharedTextureEntry;
	estimatedBytes: number;
	idleOrder: number;
	leases: number;
	texture: Texture | undefined;
}

// Pixi Assets caches and destroys textures globally, so leases and unload barriers must
// outlive an individual route. Each route's active and idle entries hold one shared pin.
const sharedEntries = new Map<string, SharedTextureEntry>();
const sharedUnloadsByUrl = new Map<string, Promise<void>>();

const defaultIdleBudgetBytes = 64 * 1024 * 1024;

const estimateTextureBytesFn = (texture: Texture) =>
	Math.max(0, texture.source.pixelWidth) * Math.max(0, texture.source.pixelHeight) * 4;

/** Shares active Pixi textures and retains only a bounded decoded idle working set. */
export const createTextureStoreFx = Effect.fn("createTextureStoreFx")(
	(idleBudgetBytes = defaultIdleBudgetBytes) =>
		Effect.sync((): TextureStore => {
			const entries = new Map<string, TextureEntry>();
			const unloads = new Set<Promise<void>>();
			let closed = false;
			let idleClock = 0;
			let unloadFailure: unknown;

			const unloadFn = (entry: TextureEntry) => {
				const shared = entry.shared;
				if (entries.get(shared.url) !== entry) return;
				entries.delete(shared.url);
				shared.stores -= 1;
				if (shared.stores > 0) return;
				sharedEntries.delete(shared.url);
				const unload = shared.load.then(
					() => Assets.unload(shared.url).then(() => undefined),
					() => undefined,
				);
				unloads.add(unload);
				sharedUnloadsByUrl.set(shared.url, unload);
				void unload
					.catch((cause) => {
						unloadFailure ??= cause;
					})
					.finally(() => {
						unloads.delete(unload);
						if (sharedUnloadsByUrl.get(shared.url) === unload)
							sharedUnloadsByUrl.delete(shared.url);
					});
			};

			const evictIdleFn = () => {
				const idle = Array.from(entries.values())
					.filter((entry) => entry.leases === 0 && entry.texture !== undefined)
					.sort((left, right) => left.idleOrder - right.idleOrder);
				let idleBytes = idle.reduce((total, entry) => total + entry.estimatedBytes, 0);
				for (const entry of idle) {
					if (idleBytes <= idleBudgetBytes) break;
					idleBytes -= entry.estimatedBytes;
					unloadFn(entry);
				}
			};

			const createEntryFn = (url: string) => {
				let shared = sharedEntries.get(url);
				if (shared === undefined) {
					shared = {
						load: (sharedUnloadsByUrl.get(url) ?? Promise.resolve())
							.catch(() => undefined)
							.then(() =>
								Assets.load<Texture>({
									parser: "texture",
									src: url,
								}),
							),
						stores: 0,
						url,
					};
					sharedEntries.set(url, shared);
				}
				shared.stores += 1;
				const entry: TextureEntry = {
					estimatedBytes: 0,
					idleOrder: 0,
					leases: 0,
					shared,
					texture: undefined,
				};
				void entry.shared.load
					.then((texture) => {
						entry.texture = texture;
						entry.estimatedBytes = estimateTextureBytesFn(texture);
						evictIdleFn();
					})
					.catch(() => {
						unloadFn(entry);
					});
				entries.set(url, entry);
				return entry;
			};

			const acquireFn = (url: string): TextureLease => {
				if (closed) throw new Error("Pixi texture store is closed.");
				const entry = entries.get(url) ?? createEntryFn(url);
				entry.leases += 1;
				let released = false;
				return {
					textureFx: Effect.tryPromise({
						try: () => entry.shared.load,
						catch: (cause) => cause,
					}),
					releaseFn: () => {
						if (released) return;
						released = true;
						entry.leases -= 1;
						if (entry.leases > 0 || entries.get(url) !== entry) return;
						if (entry.texture === undefined) {
							unloadFn(entry);
							return;
						}
						entry.idleOrder = ++idleClock;
						evictIdleFn();
					},
				};
			};

			return {
				acquireFn,
				closeFx: Effect.tryPromise({
					try: async () => {
						if (!closed) {
							closed = true;
							for (const entry of Array.from(entries.values())) unloadFn(entry);
						}
						await Promise.allSettled(Array.from(unloads));
						if (unloadFailure !== undefined) throw unloadFailure;
					},
					catch: (cause) => cause,
				}),
			};
		}),
);
