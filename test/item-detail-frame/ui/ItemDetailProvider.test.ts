// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act } from "react";

import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";
import type { GameTransition } from "~/game-session/type/GameSession";
import { lineRunRuntime } from "~test/production-line/support/lineRunTestRuntime";
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

	it("delays detail exit after committed Space navigation or current Board replacement", async () => {
		const initial = lineRunRuntime({});
		const listeners = new Set<(transition: GameTransition) => void | PromiseLike<void>>();
		const game = {
			getSnapshotFn: () => initial,
			subscribeTransitionsFn: (
				listenerFn: (transition: GameTransition) => void | PromiseLike<void>,
			) => {
				listeners.add(listenerFn);
				listenerFn({
					sequence: 0,
					previousRuntime: null,
					runtime: initial,
					events: [],
				});
				return () => listeners.delete(listenerFn);
			},
		};
		const { readControl } = await renderProvider(game);
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:portal",
			});
		});
		const notifyFn = async (transition: GameTransition) => {
			await act(async () => {
				for (const listenerFn of listeners) await listenerFn(transition);
			});
		};
		await notifyFn({
			sequence: 1,
			previousRuntime: initial,
			runtime: {
				...initial,
				jobQueue: [],
			},
			events: [],
		});
		expect(readControl().state.phase).not.toBe("exiting");

		await notifyFn({
			sequence: 2,
			previousRuntime: initial,
			runtime: {
				...initial,
				currentSpace: 1,
			},
			events: [],
		});
		expect(readControl().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
			exitDelayMs: 360,
		});
		const exiting = readControl().state;
		if (exiting.phase !== "exiting") throw new Error("Expected exiting state.");
		await act(async () => completeExit(readControl(), exiting.generation));
		await act(async () => {
			openItemDetail(readControl(), {
				itemId: "runtime:portal",
			});
		});
		await notifyFn({
			sequence: 3,
			previousRuntime: initial,
			runtime: {
				...initial,
				currentSpace: 1,
			},
			events: [
				{
					type: "board:template-applied",
					space: 2,
					templateUid: "template:other",
				},
			],
		});
		expect(readControl().state.phase).not.toBe("exiting");
		await notifyFn({
			sequence: 4,
			previousRuntime: initial,
			runtime: {
				...initial,
				currentSpace: 1,
			},
			events: [
				{
					type: "board:template-applied",
					space: 1,
					templateUid: "template:current",
				},
			],
		});
		expect(readControl().state).toMatchObject({
			phase: "exiting",
			restoreFocus: false,
			exitDelayMs: 360,
		});
	});
});
