import { Deferred, Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { useTileCommands } from "~/tile-interaction/ui/useTileCommands";
import { createTestGameSession } from "~test/support/createTestGameSession";

const base = (id: string) => ({
	id,
	uid: `uid:${id}`,
	title: id,
	description: id,
	scope: "any",
	maxStackSize: 1,
	asset: {
		default: [
			"hero",
		],
	},
});
export const config = GameConfigSchema.parse({
	resources: {
		hero: "tile",
	},
	meta: {
		id: "commands",
		title: "Commands",
		board: {
			width: 4,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		first: {
			...base("first"),
			type: "simple",
		},
		second: {
			...base("second"),
			type: "simple",
		},
		blocked: {
			...base("blocked"),
			type: "space",
			space: 2,
			rules: [
				{
					type: "enable",
					when: [
						{
							type: "exists",
							query: {
								scope: "universe",
								selector: {
									type: "item",
									itemId: "permit",
								},
							},
						},
					],
				},
			],
		},
		ready: {
			...base("ready"),
			type: "space",
			space: 7,
		},
		permit: {
			...base("permit"),
			type: "simple",
		},
	},
});

export const mountCommands = async (game: Pick<PlayableGame, "runFx">) => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	let commands!: ReturnType<typeof useTileCommands>;
	const Probe = ({ game }: { readonly game: Pick<PlayableGame, "runFx"> }) => {
		commands = useTileCommands(game as PlayableGame);
		return null;
	};
	const render = async (game: Pick<PlayableGame, "runFx">) => {
		await act(async () =>
			root.render(
				createElement(Probe, {
					game,
				}),
			),
		);
	};
	await render(game);
	return {
		getCommands: () => commands,
		render,
		close: async () => {
			await act(async () => root.unmount());
			host.remove();
		},
	};
};

export const createSessionFixture = async () => {
	const session = await createTestGameSession({
		config,
		tickIntervalMs: 60_000,
	});
	const mounted = await mountCommands(session);
	const gate = Effect.runSync(Deferred.make<void>());
	const entered = Effect.runSync(Deferred.make<void>());
	let holding: Promise<unknown> | undefined;
	return {
		session,
		commands: mounted.getCommands(),
		hold: async () => {
			holding = session.runFn(
				modifyRuntimeFx((runtime) =>
					Deferred.succeed(entered, undefined).pipe(
						Effect.andThen(Deferred.await(gate)),
						Effect.as([
							undefined,
							runtime,
						] as const),
					),
				),
			);
			await Effect.runPromise(Deferred.await(entered));
		},
		release: () => Effect.runSync(Deferred.succeed(gate, undefined)),
		close: async () => {
			Effect.runSync(Deferred.succeed(gate, undefined));
			await holding;
			await mounted.close();
			await Effect.runPromise(session.disposeWithoutSaveFx);
		},
	};
};
