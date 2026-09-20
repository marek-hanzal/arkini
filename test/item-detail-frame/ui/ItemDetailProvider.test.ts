// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";
import {
	close,
	completeExit,
	openItemDetail,
	renderProvider,
} from "../support/ItemDetailProviderFixture";

describe("Item Detail frame provider", () => {
	it("plays presentation SFX only for admitted open and close lifecycle transitions", async () => {
		const { playSfxEventFn, readControl } = await renderProvider();

		expect(
			openItemDetail(readControl(), {
				itemId: "runtime:missing",
			}),
		).toBe(false);
		expect(playSfxEventFn).not.toHaveBeenCalled();

		openItemDetail(readControl(), {
			itemId: "runtime:first",
		});
		expect(playSfxEventFn).toHaveBeenCalledWith(
			PresentationSfxEventEnumSchema.enum.ItemDetailOpened,
		);

		openItemDetail(readControl(), {
			itemId: "runtime:first",
		});
		expect(playSfxEventFn).toHaveBeenCalledTimes(1);

		const firstClose = close(readControl());
		await Promise.resolve();
		const duplicateClose = close(readControl());
		await Promise.resolve();
		expect(playSfxEventFn).toHaveBeenNthCalledWith(
			2,
			PresentationSfxEventEnumSchema.enum.ItemDetailClosed,
		);
		expect(playSfxEventFn).toHaveBeenCalledTimes(2);

		const exiting = readControl().state;
		if (exiting.phase !== "exiting") throw new Error("Expected exiting state.");
		completeExit(readControl(), exiting.generation);
		await Promise.all([
			firstClose,
			duplicateClose,
		]);
	});

	it("rejects stale targets without changing the closed owner", async () => {
		const { readControl } = await renderProvider();

		expect(
			openItemDetail(readControl(), {
				itemId: "runtime:missing",
			}),
		).toBe(false);
		expect(readControl().state).toEqual({
			phase: "closed",
		});
	});
});
