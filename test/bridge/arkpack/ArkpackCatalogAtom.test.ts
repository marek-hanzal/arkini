// @vitest-environment jsdom

import { RegistryContext, scheduleTask, useAtomSet } from "@effect/atom-react";
import { Deferred, Effect, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkpackCatalogAtom } from "~/bridge/arkpack/ArkpackCatalogAtom";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { removeArkpackAtom } from "~/bridge/arkpack/removeArkpackAtom";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const registries: AtomRegistry.AtomRegistry[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	document.body.replaceChildren();
});

describe("ArkpackCatalogAtom", () => {
	it("projects authoritative catalog refreshes through the real registry", async () => {
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([]),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.mount(ArkpackCatalogAtom);
		await Effect.runPromise(catalog.refreshFx);

		expect(registry.get(ArkpackCatalogAtom)).toEqual({
			type: "ready",
			arkpacks: [],
		});
	});

	it("settles the official React promise mode for success and domain failure", async () => {
		const failure = new Error("remove failed");
		let fail = false;
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([]),
				removeFx: () => (fail ? Effect.fail(failure) : Effect.void),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		let remove = async (_packageId: string): Promise<void> => undefined;
		const Probe = () => {
			remove = useAtomSet(removeArkpackAtom, {
				mode: "promise",
			});
			return null;
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

		await expect(remove("package:one")).resolves.toBeUndefined();
		fail = true;
		await expect(remove("package:two")).rejects.toThrow("remove failed");
	});

	it("does not interrupt overlapping command work before the catalog Semaphore orders it", async () => {
		const firstStarted = Effect.runSync(Deferred.make<void>());
		const releaseFirst = Effect.runSync(Deferred.make<void>());
		const secondStarted = Effect.runSync(Deferred.make<void>());
		const releaseSecond = Effect.runSync(Deferred.make<void>());
		const attempts: string[] = [];
		let interruptions = 0;
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([]),
				removeFx: (packageId) =>
					Effect.gen(function* () {
						attempts.push(packageId);
						if (packageId === "package:first") {
							yield* Deferred.succeed(firstStarted, undefined);
							yield* Deferred.await(releaseFirst);
							return;
						}
						yield* Deferred.succeed(secondStarted, undefined);
						yield* Deferred.await(releaseSecond);
					}).pipe(
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								interruptions += 1;
							}),
						),
					),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		let remove = async (_packageId: string): Promise<void> => undefined;
		const Probe = () => {
			remove = useAtomSet(removeArkpackAtom, {
				mode: "promise",
			});
			return null;
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

		const first = remove("package:first");
		await Effect.runPromise(Deferred.await(firstStarted));
		const second = remove("package:second");
		await Promise.resolve();
		expect(attempts).toEqual([
			"package:first",
		]);
		Effect.runSync(Deferred.succeed(releaseFirst, undefined));
		await Effect.runPromise(Deferred.await(secondStarted));
		Effect.runSync(Deferred.succeed(releaseSecond, undefined));
		await expect(
			Promise.all([
				first,
				second,
			]),
		).resolves.toEqual([
			undefined,
			undefined,
		]);
		expect(interruptions).toBe(0);
		expect(attempts).toEqual([
			"package:first",
			"package:second",
		]);
	});

	it("lets an acquired durable catalog mutation converge after registry disposal", async () => {
		const removeStarted = Effect.runSync(Deferred.make<void>());
		const releaseRemove = Effect.runSync(Deferred.make<void>());
		let interruptions = 0;
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([]),
				removeFx: () =>
					Deferred.succeed(removeStarted, undefined).pipe(
						Effect.andThen(Deferred.await(releaseRemove)),
						Effect.onInterrupt(() =>
							Effect.sync(() => {
								interruptions += 1;
							}),
						),
					),
			}),
		);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.set(ArkpackCatalogOwnerAtom, catalog);
		registry.mount(removeArkpackAtom);
		registry.set(removeArkpackAtom, "package:durable");
		await Effect.runPromise(Deferred.await(removeStarted));

		registry.dispose();
		Effect.runSync(Deferred.succeed(releaseRemove, undefined));
		await vi.waitFor(() =>
			expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
				type: "ready",
				arkpacks: [],
			}),
		);
		expect(interruptions).toBe(0);
	});
});
