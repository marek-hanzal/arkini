// @vitest-environment jsdom

import { Effect } from "effect";
import { Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { destroyActorVisualFx } from "~/tile-rendering/fx/destroyActorVisualFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

vi.mock("~/tile-rendering/fx/updateActorVisualFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updateActorVisualFx: ({
			item,
			size,
			visual,
		}: {
			readonly item: TileActorItem;
			readonly size: number;
			readonly visual: {
				item: TileActorItem;
				size: number;
			};
		}) =>
			EffectModule.sync(() => {
				visual.item = item;
				visual.size = size;
			}),
	};
});

const palette = {
	accent: 0xf05bb8,
	danger: 0,
	foreground: 0,
	gridA: 0,
	gridB: 0,
	line: 0,
	overlay: 0,
	overlayForeground: 0xffffff,
	success: 0x57d7b2,
	surface: 0,
} satisfies PixiScenePalette;

const createItem = ({
	compositeUrl,
	revision = "revision:old",
	sourceUrl = "resource:old",
}: {
	readonly compositeUrl?: string;
	readonly revision?: string;
	readonly sourceUrl?: string;
} = {}) =>
	({
		compositeUrl,
		id: "runtime:spawn",
		itemUid: "water",

		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
		primaryAction: {
			kind: "none",
		},
		revision,
		running: false,

		artworkScale: 0.8,
		sourceUrl,
	}) satisfies TileActorItem;

const createControlledTextures = () => {
	const rejects = new Map<string, (cause: unknown) => void>();
	const releases = new Map<string, ReturnType<typeof vi.fn>>();
	const resolves = new Map<string, (texture: Texture) => void>();
	const textures = {
		acquireFn: (url: string) => {
			const releaseFn = vi.fn();
			releases.set(url, releaseFn);
			return {
				releaseFn,
				textureFx: Effect.promise(
					() =>
						new Promise<Texture>((resolve, reject) => {
							resolves.set(url, resolve);
							rejects.set(url, reject);
						}),
				),
			};
		},
		closeFx: Effect.void,
	} satisfies TextureStore;
	return {
		rejects,
		releases,
		resolves,
		textures,
	};
};

const createFrames = () => {
	const invalidate = vi.fn();
	const reportCriticalFailureFn = vi.fn();
	return {
		frames: {
			addBeforeRenderListenerFx: () => Effect.succeed(() => {}),
			closeFx: Effect.void,
			invalidateFx: Effect.sync(invalidate),
			reportCriticalFailureFn,
			scheduleAfterRenderFx: () => Effect.succeed(() => {}),
			scheduleFx: () => Effect.succeed(() => {}),
		},
		invalidate,
		reportCriticalFailureFn,
	};
};

const createActor = ({
	item = createItem(),
	textures,
}: {
	readonly item?: TileActorItem;
	readonly textures: TextureStore;
}) => {
	const { frames, invalidate } = createFrames();
	const actor = Effect.runSync(
		createTileActorFx({
			frames,
			item,
			palette,
			textures,
		}),
	);
	return {
		actor,
		frames,
		invalidate,
	};
};

describe("texture readiness", () => {
	it("reports one required texture failure against the owning scene", async () => {
		const { rejects, textures } = createControlledTextures();
		const { actor, frames } = createActor({
			textures,
		});
		const failure = new Error("texture unavailable");

		await vi.waitFor(() => {
			expect(rejects.has("resource:old")).toBe(true);
		});
		rejects.get("resource:old")?.(failure);

		await vi.waitFor(() => {
			expect(frames.reportCriticalFailureFn).toHaveBeenCalledOnce();
		});
		expect(frames.reportCriticalFailureFn).toHaveBeenCalledWith(failure);
		expect(actor.currentVisual.textureState).toBe("failed");
	});

	it("keeps the current visual renderable while a delayed incoming revision loads", async () => {
		const { resolves, textures } = createControlledTextures();
		const { actor, frames } = createActor({
			textures,
		});
		const crossfades: Array<() => void> = [];
		const crossfadeArtworkFx = vi.fn(({ onCompleteFn }: { onCompleteFn: () => void }) =>
			Effect.sync(() => {
				crossfades.push(onCompleteFn);
			}),
		);
		const oldVisual = actor.currentVisual;
		const oldTexture = new Texture();
		const nextTexture = new Texture();

		await vi.waitFor(() => {
			expect(resolves.has("resource:old")).toBe(true);
		});
		resolves.get("resource:old")?.(oldTexture);
		await vi.waitFor(() => {
			expect(oldVisual.textureState).toBe("ready");
		});

		Effect.runSync(
			updateTileActorFx({
				crossfadeArtworkFx,
				actor,
				frames,
				item: createItem({
					revision: "revision:next",
					sourceUrl: "resource:next",
				}),
				palette,
				size: 80,
				textures,
			}),
		);

		await vi.waitFor(() => {
			expect(resolves.has("resource:next")).toBe(true);
		});
		expect(actor.currentVisual).toBe(oldVisual);
		expect(actor.pendingVisual).not.toBeNull();
		expect(oldVisual.container.destroyed).toBe(false);
		expect(oldVisual.container.alpha).toBe(1);
		expect(oldVisual.primary.texture).toBe(oldTexture);
		expect(actor.pendingVisual?.container.alpha).toBe(0);
		expect(actor.pendingVisual?.primary.texture).toBe(Texture.EMPTY);
		expect(crossfadeArtworkFx).not.toHaveBeenCalled();
		const pendingVisual = actor.pendingVisual;
		const transitionGeneration = actor.visualTransitionGeneration;
		const publishedBeforeCancel = vi.fn(() => {
			expect(actor.currentVisual).toBe(pendingVisual);
		});
		oldVisual.readyListeners.add({
			onCancelFn: publishedBeforeCancel,
			onReadyFn: () => {},
		});

		Effect.runSync(
			updateTileActorFx({
				crossfadeArtworkFx,
				actor,
				frames,
				item: createItem({
					revision: "revision:next",
					sourceUrl: "resource:next",
				}),
				palette,
				size: 80,
				textures,
			}),
		);
		expect(actor.pendingVisual).toBe(pendingVisual);
		expect(actor.visualTransitionGeneration).toBe(transitionGeneration);

		resolves.get("resource:next")?.(nextTexture);
		await vi.waitFor(() => {
			expect(actor.currentVisual.primary.texture).toBe(nextTexture);
		});
		expect(actor.currentVisual.primary.texture).toBe(nextTexture);
		expect(crossfadeArtworkFx).toHaveBeenCalledOnce();
		expect(actor.currentVisual.container.alpha).toBe(0);
		expect(oldVisual.container.destroyed).toBe(false);
		crossfades[0]?.();
		expect(actor.currentVisual.container.alpha).toBe(1);
		expect(actor.pendingVisual).toBeNull();
		expect(oldVisual.container.destroyed).toBe(true);
		expect(publishedBeforeCancel).toHaveBeenCalledOnce();

		actor.container.destroy({
			children: true,
		});
		oldTexture.destroy();
		nextTexture.destroy();
	});

	it("ignores a superseded texture load after the desired artwork reverses", async () => {
		const { resolves, textures } = createControlledTextures();
		const canonical = createItem();
		const next = {
			...canonical,
			sourceUrl: "resource:next",
		};
		const { actor, frames } = createActor({
			item: canonical,
			textures,
		});
		await vi.waitFor(() => expect(resolves.has("resource:old")).toBe(true));
		const firstOldResolveFn = resolves.get("resource:old");
		firstOldResolveFn?.(Texture.WHITE);
		await vi.waitFor(() => expect(actor.currentVisual.textureState).toBe("ready"));
		const original = actor.currentVisual;

		const updateFn = (item: TileActorItem) =>
			Effect.runSync(
				updateTileActorFx({
					crossfadeArtworkFx: ({ onCompleteFn }) => Effect.sync(onCompleteFn),
					actor,
					frames,
					item,
					palette,
					size: 80,
					textures,
				}),
			);
		updateFn(next);
		const superseded = actor.pendingVisual;
		await vi.waitFor(() => expect(resolves.has("resource:next")).toBe(true));
		updateFn(canonical);
		expect(superseded?.container.destroyed).toBe(true);
		expect(actor.currentVisual).toBe(original);
		expect(actor.pendingVisual).toBeNull();
		expect(resolves.get("resource:old")).toBe(firstOldResolveFn);
		resolves.get("resource:next")?.(Texture.WHITE);
		await Promise.resolve();
		await Promise.resolve();
		expect(actor.currentVisual).toBe(original);
		expect(original.container.destroyed).toBe(false);
		actor.container.destroy({
			children: true,
		});
	});

	it("publishes primary and composite textures atomically for one visual generation", async () => {
		const { resolves, textures } = createControlledTextures();
		const { actor, invalidate } = createActor({
			item: createItem({
				compositeUrl: "resource:composite",
				sourceUrl: "resource:primary",
			}),
			textures,
		});
		const visual = actor.currentVisual;
		const primary = new Texture();
		const composite = new Texture();

		await vi.waitFor(() => {
			expect(resolves.has("resource:primary")).toBe(true);
			expect(resolves.has("resource:composite")).toBe(true);
		});
		resolves.get("resource:primary")?.(primary);
		await Promise.resolve();
		await Promise.resolve();
		expect(visual.textureState).toBe("loading");
		expect(visual.primary.texture).toBe(Texture.EMPTY);
		expect(visual.composite.texture).toBe(Texture.EMPTY);

		resolves.get("resource:composite")?.(composite);
		await vi.waitFor(() => {
			expect(visual.textureState).toBe("ready");
		});
		expect(visual.primary.texture).toBe(primary);
		expect(visual.composite.texture).toBe(composite);
		expect(invalidate).toHaveBeenCalledOnce();

		actor.container.destroy({
			children: true,
		});
		primary.destroy();
		composite.destroy();
	});

	it("ignores a late texture completion after the visual has been destroyed", async () => {
		const { releases, resolves, textures } = createControlledTextures();
		const { actor } = createActor({
			textures,
		});
		const visual = actor.currentVisual;
		const texture = new Texture();

		await vi.waitFor(() => {
			expect(resolves.has("resource:old")).toBe(true);
		});
		Effect.runSync(destroyActorVisualFx(visual));
		expect(releases.get("resource:old")).toHaveBeenCalledOnce();
		resolves.get("resource:old")?.(texture);
		await Promise.resolve();
		await Promise.resolve();

		expect(visual.textureState).toBe("destroyed");
		expect(visual.primary.texture).not.toBe(texture);
		texture.destroy();
	});
});
