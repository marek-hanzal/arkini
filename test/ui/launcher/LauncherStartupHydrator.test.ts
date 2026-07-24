// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomValue } from "@effect/atom-react";
import { Effect, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { AppearanceAtom } from "~/bridge/appearance/AppearanceAtom";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";
import { AppearanceDataset } from "~/ui/appearance/AppearanceDataset";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";
import { LauncherStartupHydrator } from "~/ui/launcher/LauncherStartupHydrator";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];
const catalog: ArkpackCatalog = {
	state: Effect.runSync(
		SubscriptionRef.make<ArkpackCatalog.State>({
			type: "loading",
		}),
	),
	refreshFx: Effect.void,
	importFileFx: () => Effect.die("unused"),
	removeFx: () => Effect.die("unused"),
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
	delete document.documentElement.dataset.theme;
	delete document.documentElement.dataset.accent;
});

describe("LauncherStartupHydrator", () => {
	it("mounts one bootstrap under StrictMode and publishes the shared registry values", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		const bootstrap = vi.fn();
		registry.set(LauncherStartupConfigAtom, {
			heroUrl: "/hero.png",
			bootstrapFx: Effect.sync(() => {
				bootstrap();
				return {
					appearance: {
						theme: "light" as const,
						accent: "blue" as const,
					},
					builtInPackageId: "built-in",
					cheatsAvailable: true,
				};
			}),
		});
		const Probe = () => {
			const startup = useAtomValue(LauncherStartupAtom);
			const appearance = useAtomValue(AppearanceAtom);
			const cheatsAvailable = useAtomValue(CheatAvailabilityAtom);
			return createElement(
				"output",
				null,
				`${startup._tag}:${appearance.theme}:${appearance.accent}:${cheatsAvailable}`,
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(
						RegistryContext.Provider,
						{
							value: registry,
						},
						createElement(AppearanceDataset),
						createElement(LauncherStartupHydrator),
						createElement(Probe),
					),
				),
			);
		});

		await vi.waitFor(() => {
			expect(AsyncResult.isSuccess(registry.get(LauncherStartupAtom))).toBe(true);
			expect(container.textContent).toBe("Success:light:blue:true");
			expect(document.documentElement.dataset.theme).toBe("light");
			expect(document.documentElement.dataset.accent).toBe("blue");
		});
		expect(bootstrap).toHaveBeenCalledOnce();
	});
});
