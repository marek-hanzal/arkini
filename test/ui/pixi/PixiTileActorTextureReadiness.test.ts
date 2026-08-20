// @vitest-environment jsdom

import { Effect } from "effect";
import { Texture } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimation, PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import {
	pixiTileActorLifecycleDurationMs,
	pixiTileActorLifecycleReducedScale,
	startPixiTileActorEnterFx,
} from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

vi.mock("~/ui/pixi/text/fitPixiSingleLineTextFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		fitPixiSingleLineTextFx: ({ text }: { readonly text: string }) =>
			EffectModule.succeed(text),
	};
});

vi.mock("~/ui/pixi/actor/updatePixiTileActorVisualFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorVisualFx: ({
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
	toolbarA: 0,
	toolbarB: 0,
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
		itemId: "water",
		itemType: "simple",
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
		quantity: 1,
		revision,
		running: false,
		activityEffect: false,
		sourceUrl,
		title: "Water",
	}) satisfies TileActorItem;

const createControlledTextures = () => {
	const rejects = new Map<string, (cause: unknown) => void>();
	const resolves = new Map<string, (texture: Texture) => void>();
	const textures = {
		closeFx: Effect.void,
		loadFx: (url: string) =>
			Effect.promise(
				() =>
					new Promise<Texture>((resolve, reject) => {
						resolves.set(url, resolve);
						rejects.set(url, reject);
					}),
			),
	} satisfies PixiTextureStore;
	return {
		rejects,
		resolves,
		textures,
	};
};

const createFrames = () => {
	const invalidate = vi.fn();
	const reportCriticalFailure = vi.fn();
	return {
		frames: {
			closeFx: Effect.void,
			invalidateFx: Effect.sync(invalidate),
			reportCriticalFailure,
			scheduleFx: () => Effect.succeed(() => {}),
		},
		invalidate,
		reportCriticalFailure,
	};
};

const createAnimator = () => {
	const animations: PixiActorAnimation[] = [];
	return {
		animations,
		animator: {
			animateFx: (animation) =>
				Effect.sync(() => {
					animations.push(animation);
				}),
			cancelActorFx: () => Effect.void,
			cancelChannelFx: () => Effect.void,
			cancelFx: () => Effect.void,
			closeFx: Effect.void,
			isChannelActiveFx: () => Effect.succeed(false),
			setFx: (write) =>
				Effect.sync(() => {
					if (write.channel === "lifecycle-opacity") {
						write.actor.container.alpha = write.alpha;
					} else if (write.channel === "lifecycle-scale") {
						write.actor.lifecycleLayer.scale.set(write.scale);
					}
				}),
		} satisfies PixiActorAnimator,
	};
};

const createActor = ({
	item = createItem(),
	textures,
}: {
	readonly item?: TileActorItem;
	readonly textures: PixiTextureStore;
}) => {
	const { frames, invalidate } = createFrames();
	const actor = Effect.runSync(
		createPixiTileActorFx({
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

describe("Pixi tile actor visual readiness", () => {
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
			expect(frames.reportCriticalFailure).toHaveBeenCalledOnce();
		});
		expect(frames.reportCriticalFailure).toHaveBeenCalledWith(failure);
		expect(actor.currentVisual.textureState).toBe("failed");
	});

	it("keeps the current visual renderable while a delayed incoming revision loads", async () => {
		const { resolves, textures } = createControlledTextures();
		const { actor, frames } = createActor({
			textures,
		});
		const { animations, animator } = createAnimator();
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
			updatePixiTileActorFx({
				actor,
				animator,
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
		const pendingVisual = actor.pendingVisual;
		const transitionGeneration = actor.visualTransitionGeneration;

		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
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
			expect(animations.some(({ channel }) => channel === "visual-mix")).toBe(true);
		});
		const visualMix = animations.find(({ channel }) => channel === "visual-mix");
		expect(visualMix).toMatchObject({
			actor,
			channel: "visual-mix",
			durationMs: 950,
		});
		expect(actor.currentVisual).toBe(oldVisual);
		expect(oldVisual.container.destroyed).toBe(false);
		expect(actor.pendingVisual?.primary.texture).toBe(nextTexture);

		visualMix?.onComplete?.();
		expect(actor.currentVisual.primary.texture).toBe(nextTexture);
		expect(actor.currentVisual.container.alpha).toBe(1);
		expect(actor.pendingVisual).toBeNull();
		expect(oldVisual.container.destroyed).toBe(true);

		actor.container.destroy({
			children: true,
		});
		oldTexture.destroy();
		nextTexture.destroy();
	});

	it("keeps a spawn fade intent durable when its original visual is superseded", async () => {
		const { resolves, textures } = createControlledTextures();
		const { actor, frames } = createActor({
			textures,
		});
		const originalVisual = actor.currentVisual;
		const { animations, animator } = createAnimator();
		const nextTexture = new Texture();
		actor.container.alpha = 0;

		Effect.runSync(
			startPixiTileActorEnterFx({
				actor,
				animator,
			}),
		);
		expect(actor.container.alpha).toBe(0);
		expect(actor.lifecycleLayer.scale.x).toBe(pixiTileActorLifecycleReducedScale);
		expect(animations).toEqual([]);

		Effect.runSync(
			updatePixiTileActorFx({
				actor,
				animator,
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
		resolves.get("resource:next")?.(nextTexture);

		await vi.waitFor(() => {
			expect(animations.some(({ channel }) => channel === "lifecycle-opacity")).toBe(true);
			expect(animations.some(({ channel }) => channel === "visual-mix")).toBe(true);
		});
		const lifecycleFade = animations.find(({ channel }) => channel === "lifecycle-opacity");
		const lifecycleScale = animations.find(({ channel }) => channel === "lifecycle-scale");
		const visualMix = animations.find(({ channel }) => channel === "visual-mix");
		expect(actor.currentVisual).toBe(originalVisual);
		visualMix?.onComplete?.();
		expect(originalVisual.container.destroyed).toBe(true);
		expect(actor.lifecycleTargetAlpha).toBe(1);
		expect(actor.lifecycleTransitionStarted).toBe(true);
		expect(lifecycleFade).toMatchObject({
			actor,
			channel: "lifecycle-opacity",
			durationMs: pixiTileActorLifecycleDurationMs,
			toAlpha: 1,
		});
		expect(lifecycleScale).toMatchObject({
			actor,
			channel: "lifecycle-scale",
			durationMs: pixiTileActorLifecycleDurationMs,
			toScale: 1,
		});

		actor.container.destroy({
			children: true,
		});
		nextTexture.destroy();
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
		const { resolves, textures } = createControlledTextures();
		const { actor } = createActor({
			textures,
		});
		const visual = actor.currentVisual;
		const texture = new Texture();

		await vi.waitFor(() => {
			expect(resolves.has("resource:old")).toBe(true);
		});
		visual.textureState = "destroyed";
		visual.textureGeneration += 1;
		visual.container.destroy({
			children: true,
		});
		resolves.get("resource:old")?.(texture);
		await Promise.resolve();
		await Promise.resolve();

		expect(visual.textureState).toBe("destroyed");
		expect(visual.primary.texture).not.toBe(texture);
		texture.destroy();
	});
});
