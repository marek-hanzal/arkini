// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Cause, Deferred, Effect, Exit, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";
import { applyCheatAvailabilityFx } from "~/bridge/cheat/applyCheatAvailabilityFx";
import { readCheatAvailabilitySnapshotFx } from "~/bridge/cheat/readCheatAvailabilitySnapshotFx";
import { setCheatAvailabilityAtom } from "~/bridge/cheat/setCheatAvailabilityAtom";
import { waitForCheatAvailabilityReadyFx } from "~/bridge/cheat/waitForCheatAvailabilityReadyFx";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const registries: AtomRegistry.AtomRegistry[] = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(window, "arkini");
});

describe("Cheat availability Atom", () => {
	it("completes readiness on the first apply and publishes changed values only", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const published: boolean[] = [];
		expect(registry.get(CheatAvailabilityAtom)).toBe(false);
		const unsubscribe = registry.subscribe(CheatAvailabilityAtom, (available) => {
			published.push(available);
		});
		let ready = false;
		const readiness = Effect.runPromise(waitForCheatAvailabilityReadyFx()).then(() => {
			ready = true;
		});

		await Promise.resolve();
		expect(ready).toBe(false);
		Effect.runSync(
			applyCheatAvailabilityFx(false).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		await readiness;
		expect(ready).toBe(true);
		expect(published).toEqual([]);

		Effect.runSync(
			applyCheatAvailabilityFx(true).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		Effect.runSync(
			applyCheatAvailabilityFx(true).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		await vi.waitFor(() =>
			expect(published).toEqual([
				true,
			]),
		);
		expect(
			Effect.runSync(
				readCheatAvailabilitySnapshotFx().pipe(
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).toBe(true);

		unsubscribe();
	});

	it("shares one registry value between React hooks and non-React Effect reads", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		const Probe = () => {
			const availability = useCheatAvailability();
			return createElement(
				"button",
				{
					type: "button",
				},
				String(availability.available),
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe),
				),
			);
		});
		const button = container.querySelector("button");
		expect(button?.textContent).toBe("false");

		await act(async () => {
			Effect.runSync(
				applyCheatAvailabilityFx(true).pipe(
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			);
		});
		await vi.waitFor(() => expect(button?.textContent).toBe("true"));
		expect(
			Effect.runSync(
				readCheatAvailabilitySnapshotFx().pipe(
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			),
		).toBe(true);
	});

	it("publishes a changed value only after persistence succeeds", async () => {
		const gate = Effect.runSync(Deferred.make<void>());
		const writeAvailable = vi.fn(() => Effect.runPromise(Deferred.await(gate)));
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				cheats: {
					writeAvailable,
				},
			},
		});
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(setCheatAvailabilityAtom, true);

		expect(registry.get(setCheatAvailabilityAtom).waiting).toBe(true);
		expect(registry.get(CheatAvailabilityAtom)).toBe(false);
		await vi.waitFor(() => expect(writeAvailable).toHaveBeenCalledWith(true));

		Effect.runSync(Deferred.succeed(gate, undefined));
		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, setCheatAvailabilityAtom, {
				suspendOnWaiting: true,
			}),
		);
		expect(exit).toEqual(Exit.succeed(undefined));
		expect(AsyncResult.isSuccess(registry.get(setCheatAvailabilityAtom))).toBe(true);
		expect(registry.get(CheatAvailabilityAtom)).toBe(true);
	});

	it("keeps the published value unchanged when persistence fails", async () => {
		const failure = new Error("cheat preference write failed");
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				cheats: {
					writeAvailable: () => Promise.reject(failure),
				},
			},
		});
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(setCheatAvailabilityAtom, true);

		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, setCheatAvailabilityAtom, {
				suspendOnWaiting: true,
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected cheat preference failure.");
		expect(Cause.findErrorOption(exit.cause)).toEqual(Option.some(failure));
		expect(registry.get(CheatAvailabilityAtom)).toBe(false);
	});

	it("serializes writes so an older completion cannot overwrite newer availability", async () => {
		let persisted = false;
		const completions = new Map<boolean, () => void>();
		const writeAvailable = vi.fn(
			(available: boolean) =>
				new Promise<void>((resolve) => {
					completions.set(available, () => {
						persisted = available;
						resolve();
					});
				}),
		);
		Object.defineProperty(window, "arkini", {
			configurable: true,
			value: {
				cheats: {
					writeAvailable,
				},
			},
		});
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.mount(setCheatAvailabilityAtom);

		registry.set(setCheatAvailabilityAtom, true);
		registry.set(setCheatAvailabilityAtom, false);
		await vi.waitFor(() => expect(writeAvailable).toHaveBeenCalledOnce());
		expect(writeAvailable.mock.calls).toEqual([
			[
				true,
			],
		]);

		completions.get(true)?.();
		await vi.waitFor(() => expect(writeAvailable).toHaveBeenCalledTimes(2));
		expect(writeAvailable.mock.calls[1]).toEqual([
			false,
		]);
		expect(persisted).toBe(true);

		completions.get(false)?.();
		const exit = await Effect.runPromiseExit(
			AtomRegistry.getResult(registry, setCheatAvailabilityAtom, {
				suspendOnWaiting: true,
			}),
		);
		expect(exit).toEqual(Exit.succeed(undefined));
		expect(registry.get(CheatAvailabilityAtom)).toBe(false);
		expect(persisted).toBe(false);
	});
});
