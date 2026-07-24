// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { createCheatAvailability } from "~/bridge/cheat/createCheatAvailability";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { CheatAvailabilityProvider } from "~/ui/cheat-availability/CheatAvailabilityProvider";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";
import { createLauncherStartupFx } from "~/ui/launcher/createLauncherStartupFx";
import { LauncherStartupHydrator } from "~/ui/launcher/LauncherStartupHydrator";
import { LauncherStartupProvider } from "~/ui/launcher/LauncherStartupProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const catalog: ArkpackCatalog = {
	getSnapshot: () => ({
		type: "loading",
	}),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
	subscribe: () => () => undefined,
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("LauncherStartupHydrator", () => {
	it("hands startup preferences to their owners once without replaying stale values", async () => {
		const startup = Effect.runSync(
			createLauncherStartupFx({
				catalog,
				heroUrl: "hero.png",
				bootstrapFx: Effect.succeed({
					appearance: {
						theme: "light",
						accent: "blue",
					},
					builtInPackageId: "built-in",
					cheatsAvailable: true,
				}),
			}),
		);
		const cheatAvailability = createCheatAvailability();
		await Effect.runPromise(startup.startFx);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		let applyLiveSettings = () => undefined;

		const Probe = () => {
			const appearance = useAppearance();
			const cheats = useCheatAvailability();
			applyLiveSettings = () => {
				appearance.applyTheme("dark");
				cheats.apply(false);
			};
			return createElement(
				"output",
				null,
				`${appearance.theme}:${appearance.accent}:${String(cheats.available)}`,
			);
		};
		const App = ({ showHydrator }: { readonly showHydrator: boolean }) =>
			createElement(
				LauncherStartupProvider,
				{
					startup,
				},
				createElement(
					AppearanceProvider,
					null,
					createElement(
						CheatAvailabilityProvider,
						{
							availability: cheatAvailability,
						},
						showHydrator ? createElement(LauncherStartupHydrator) : null,
						createElement(Probe),
					),
				),
			);

		await act(async () => {
			root.render(
				createElement(App, {
					showHydrator: true,
				}),
			);
		});
		expect(container.textContent).toBe("light:blue:true");
		expect(startup.getSnapshot().appearanceReady).toBe(true);

		await act(async () => {
			applyLiveSettings();
		});
		expect(container.textContent).toBe("dark:blue:false");

		await act(async () => {
			root.render(
				createElement(App, {
					showHydrator: false,
				}),
			);
		});
		await act(async () => {
			await Effect.runPromise(startup.retryFx);
		});
		await act(async () => {
			root.render(
				createElement(App, {
					showHydrator: true,
				}),
			);
		});
		expect(container.textContent).toBe("dark:blue:false");
	});
});
