import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";

describe("Pixi tile actor destruction", () => {
	it("invalidates texture writes and destroys one physical actor exactly once", () => {
		const destroy = vi.fn();
		const container = {
			destroyed: false,
			destroy: (options: unknown) => {
				destroy(options);
				container.destroyed = true;
			},
		};
		const actor = {
			container,
			textureGeneration: 4,
		} as unknown as PixiTileActor;

		Effect.runSync(destroyPixiTileActorFx(actor));
		Effect.runSync(destroyPixiTileActorFx(actor));

		expect(actor.textureGeneration).toBe(5);
		expect(destroy).toHaveBeenCalledExactlyOnceWith({
			children: true,
		});
	});
});
