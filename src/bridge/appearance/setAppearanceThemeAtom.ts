import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { writeAppearanceThemeFx } from "~/bridge/appearance/writeAppearanceThemeFx";

const rollbackAppearanceThemeFx = Effect.fn("rollbackAppearanceThemeFx")(
	({
		optimisticTheme,
		previousTheme,
	}: {
		readonly optimisticTheme: AppearanceTheme;
		readonly previousTheme: AppearanceTheme;
	}) =>
		Effect.gen(function* () {
			const current = yield* Atom.get(AppearanceAtom);
			if (current.theme !== optimisticTheme) return;
			yield* Atom.set(AppearanceAtom, {
				...current,
				theme: previousTheme,
			});
		}),
);

/**
 * Applies one theme immediately, persists it, and rolls back only its own still-current value.
 * The write Effect semaphore owns FIFO persistence; concurrent Atom mode prevents a newer
 * command from interrupting an already-acquired IPC write.
 */
export const setAppearanceThemeAtom = Atom.fn(
	(nextTheme: AppearanceTheme) =>
		Effect.gen(function* () {
			const previous = yield* Atom.get(AppearanceAtom);
			if (previous.theme === nextTheme) {
				// TODO(#397): Remove only after stable Atom guarantees observable pending
				// settlement for a synchronous concurrent command.
				yield* Effect.yieldNow;
				return;
			}

			yield* Atom.set(AppearanceAtom, {
				...previous,
				theme: nextTheme,
			});
			yield* writeAppearanceThemeFx(nextTheme).pipe(
				Effect.onError(() =>
					rollbackAppearanceThemeFx({
						optimisticTheme: nextTheme,
						previousTheme: previous.theme,
					}),
				),
			);
		}),
	{
		concurrent: true,
	},
).pipe(Atom.setIdleTTL(0));
