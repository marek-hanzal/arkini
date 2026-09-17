// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { GameAudioContext } from "~/game-audio/context/GameAudioContext";
import type { ItemDetailState } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailMusic } from "~/item-detail-frame/ui/useItemDetailMusic";
import type { GameEngine } from "~/playable-game/type/GameEngine";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("replaces detail requests directly and releases them for missing music, vanished targets, close and disposal", async () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	const transition = Atom.make({
		runtime: {
			items: [
				{
					id: "runtime:first",
					item: {
						id: "definition:first",
						music: "track:b",
					},
				},
			],
		},
	});
	const game = {
		committedTransitionAtom: transition,
		config: {
			items: {
				"definition:second": {
					music: "track:c",
				},
				"definition:same": {
					music: "track:c",
				},
				"definition:silent": {},
			},
		},
	} as unknown as GameEngine;
	const requestDetailMusicFn = vi.fn();
	const control = {
		requestDetailMusicFn,
		playSfxEventFn: vi.fn(),
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const Probe = ({ state }: { readonly state: ItemDetailState }) => {
		useItemDetailMusic(game, state);
		return null;
	};
	const renderFn = async (state: ItemDetailState) =>
		act(async () => {
			root.render(
				<RegistryContext.Provider value={registry}>
					<GameAudioContext.Provider value={control}>
						<Probe state={state} />
					</GameAudioContext.Provider>
				</RegistryContext.Provider>,
			);
		});
	const openFn = (kind: "runtime" | "definition", itemId: string): ItemDetailState => ({
		phase: "open",
		generation: 1,
		target: {
			kind,
			itemId,
			tab: "info",
			origin: null,
		},
	});
	try {
		await renderFn(openFn("runtime", "runtime:first"));
		await renderFn(openFn("definition", "definition:second"));
		await renderFn(openFn("definition", "definition:same"));
		expect(requestDetailMusicFn.mock.calls).toEqual([
			[
				"track:b",
			],
			[
				"track:c",
			],
		]);

		await renderFn(openFn("definition", "definition:silent"));
		expect(requestDetailMusicFn).toHaveBeenLastCalledWith(undefined);
		await renderFn(openFn("runtime", "runtime:first"));
		await act(async () => {
			registry.set(transition, {
				runtime: {
					items: [],
				},
			});
		});
		expect(requestDetailMusicFn).toHaveBeenLastCalledWith(undefined);

		await renderFn(openFn("definition", "definition:second"));
		await renderFn({
			phase: "exiting",
			generation: 1,
			restoreFocus: true,
			target: {
				kind: "definition",
				itemId: "definition:second",
				tab: "info",
				origin: null,
			},
		});
		expect(requestDetailMusicFn).toHaveBeenLastCalledWith(undefined);
		await renderFn(openFn("definition", "definition:second"));
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
		container.remove();
	}
	expect(requestDetailMusicFn).toHaveBeenLastCalledWith(undefined);
});
