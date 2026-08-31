import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import { setAppearanceThemeAtom } from "~/application-settings/atom/setAppearanceThemeAtom";
import { setCheatAvailabilityAtom } from "~/application-settings/atom/setCheatAvailabilityAtom";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { setWindowModeAtom } from "~/window-mode/atom/setWindowModeAtom";

type SettingsCommandAction = "cheat-tools" | "window-mode" | "theme" | "exit";

type SettingsCommand =
	| {
			readonly action: "cheat-tools";
			readonly available: boolean;
	  }
	| {
			readonly action: "theme";
			readonly theme: AppearanceThemeSchema.Type;
	  }
	| {
			readonly action: "window-mode";
			readonly mode: WindowModeSchema.Type;
	  }
	| {
			readonly action: "exit";
			readonly runFx: Effect.Effect<void, unknown, never>;
	  };

export type SettingsCommandState =
	| {
			readonly kind: "idle";
	  }
	| {
			readonly kind: "pending";
			readonly action: SettingsCommandAction;
	  }
	| {
			readonly kind: "navigation-error";
			readonly error: unknown;
	  }
	| {
			readonly kind: "save-error";
			readonly label: "Cheat tools" | "Theme" | "Window";
			readonly error: unknown;
	  }
	| {
			readonly kind: "saved";
			readonly label: "Cheat tools" | "Theme" | "Window";
	  };

const SettingsCommandStateAtom = Atom.make<SettingsCommandState>({
	kind: "idle",
}).pipe(Atom.keepAlive);

/**
 * Runs the one command admitted synchronously by SettingsCommandAtom.
 * The runner remains registry-owned across React remounts and is interrupted by registry disposal.
 */
const SettingsCommandRunnerAtom = Atom.fn(
	(command: SettingsCommand, get) =>
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
						action: "window-mode",
					},
					({ mode }) => get.setResult(setWindowModeAtom, mode),
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
				const failure = readExactCauseFailureFn(result.cause);
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
								label:
									command.action === "cheat-tools"
										? "Cheat tools"
										: command.action === "window-mode"
											? "Window"
											: "Theme",
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
							label:
								command.action === "cheat-tools"
									? "Cheat tools"
									: command.action === "window-mode"
										? "Window"
										: "Theme",
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
	(context, command: SettingsCommand) => {
		const state = context.get(SettingsCommandStateAtom);
		if (state.kind === "pending") return;
		context.set(SettingsCommandStateAtom, {
			kind: "pending",
			action: command.action,
		});
		context.set(SettingsCommandRunnerAtom, command);
	},
).pipe(Atom.keepAlive);
