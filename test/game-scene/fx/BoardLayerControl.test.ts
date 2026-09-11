import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createBoardLayerControlFx } from "~/game-scene/fx/createBoardLayerControlFx";

describe("Board layer intent", () => {
	it("restores the latest persistent selection after a temporary hold", () => {
		const control = Effect.runSync(createBoardLayerControlFx());
		const listenerFn = vi.fn();
		Effect.runSync(control.subscribeFx(listenerFn));
		Effect.runSync(control.setGroundHeldFx(true));
		Effect.runSync(control.setGroundHeldFx(true));
		Effect.runSync(control.setLayerFx("ground"));
		Effect.runSync(control.setGroundHeldFx(false));
		expect(Effect.runSync(control.readLayerFx)).toBe("ground");
		expect(listenerFn.mock.calls).toEqual([
			[
				"ground",
			],
		]);

		Effect.runSync(control.setGroundHeldFx(true));
		Effect.runSync(control.setLayerFx("content"));
		expect(Effect.runSync(control.readLayerFx)).toBe("ground");
		Effect.runSync(control.setGroundHeldFx(false));
		expect(Effect.runSync(control.readLayerFx)).toBe("content");
		expect(listenerFn.mock.calls).toEqual([
			[
				"ground",
			],
			[
				"content",
			],
		]);
	});

	it("releases individual scene listeners and ignores commands after route teardown", () => {
		const control = Effect.runSync(createBoardLayerControlFx());
		const firstFn = vi.fn();
		const secondFn = vi.fn();
		const unsubscribeFn = Effect.runSync(control.subscribeFx(firstFn));
		Effect.runSync(control.subscribeFx(secondFn));
		unsubscribeFn();
		Effect.runSync(control.setLayerFx("ground"));
		expect(firstFn).not.toHaveBeenCalled();
		expect(secondFn).toHaveBeenCalledExactlyOnceWith("ground");
		Effect.runSync(control.closeFx);
		Effect.runSync(control.setLayerFx("content"));
		Effect.runSync(control.setGroundHeldFx(false));
		Effect.runSync(control.subscribeFx(firstFn));
		expect(Effect.runSync(control.readLayerFx)).toBe("ground");
		expect(secondFn).toHaveBeenCalledOnce();
		expect(firstFn).not.toHaveBeenCalled();
	});
});
