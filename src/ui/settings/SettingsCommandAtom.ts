import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { setAppearanceThemeAtom } from "~/bridge/appearance/setAppearanceThemeAtom";
import { setCheatAvailabilityAtom } from "~/bridge/cheat/setCheatAvailabilityAtom";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

export namespace SettingsCommandAtom {
	export type Action = "cheat-tools" | "theme" | "exit";

	export type Command =
		| {
				readonly action: "cheat-tools";
				readonly available: boolean;
		  }
		| {
				readonly action: "theme";
				readonly theme: AppearanceTheme;
		  }
		| {
				readonly action: "exit";
				readonly runFx: Effect.Effect<void, unknown>;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly action: Action;
		  }
		| {
				readonly kind: "navigation-error";
				readonly error: unknown;
		  }
		| {
				readonly kind: "save-error";
				readonly label: "Cheat tools" | "Theme";
				readonly error: unknown;
		  }
		| {
				readonly kind: "saved";
				readonly label: "Cheat tools" | "Theme";
		  };
}

const SettingsCommandStateAtom = Atom.make<SettingsCommandAtom.State>({
	kind: "idle",
}).pipe(Atom.keepAlive);

const settingsCommandLabel = (
	command: Exclude<
		SettingsCommandAtom.Command,
		{
			readonly action: "exit";
		}
	>,
) => (command.action === "cheat-tools" ? "Cheat tools" : "Theme");

/**
 * Runs the one command admitted synchronously by SettingsCommandAtom.
 * The runner remains registry-owned across React remounts and is interrupted by registry disposal.
 */
const SettingsCommandRunnerAtom = Atom.fn(
	(command: SettingsCommandAtom.Command, get) =>
		Effect.gen(function* () {
			const runFx = match(command)
				.with(
					{
						action: "cheat-tools",
					},
					({ available }) => get.setResult(setCheatAvailabilityAtom, available),
				)
				.with(
					{
						action: "theme",
					},
					({ theme }) => get.setResult(setAppearanceThemeAtom, theme),
				)
				.with(
					{
						action: "exit",
					},
					({ runFx }) => runFx.pipe(Effect.andThen(Effect.yieldNow)),
				)
				.exhaustive();
			const result = yield* Effect.exit(runFx);
			if (Exit.isFailure(result)) {
				if (Cause.hasInterruptsOnly(result.cause)) {
					return yield* Effect.failCause(result.cause);
				}
				const failure = readExactCauseFailure(result.cause);
				const error = Option.isSome(failure) ? failure.value : result.cause;
				yield* Atom.set(
					SettingsCommandStateAtom,
					command.action === "exit"
						? {
								kind: "navigation-error",
								error,
							}
						: {
								kind: "save-error",
								label: settingsCommandLabel(command),
								error,
							},
				);
				return;
			}
			yield* Atom.set(
				SettingsCommandStateAtom,
				command.action === "exit"
					? {
							kind: "idle",
						}
					: {
							kind: "saved",
							label: settingsCommandLabel(command),
						},
			);
		}),
	{
		concurrent: true,
	},
).pipe(Atom.keepAlive);

/**
 * The sole Settings command authority.
 *
 * Its writable boundary claims a command synchronously, so same-tick and remounted
 * callers cannot start a sibling write or exit until the registry-owned runner settles.
 *
 * TODO(#397): Revalidate stable writable-authority admission, keepAlive ownership, and
 * the exit settlement yield without reintroducing component-local command truth.
 */
export const SettingsCommandAtom = Atom.writable(
	(get) => get(SettingsCommandStateAtom),
	(context, command: SettingsCommandAtom.Command) => {
		const state = context.get(SettingsCommandStateAtom);
		if (state.kind === "pending") return;
		context.set(SettingsCommandStateAtom, {
			kind: "pending",
			action: command.action,
		});
		context.set(SettingsCommandRunnerAtom, command);
	},
).pipe(Atom.keepAlive);
