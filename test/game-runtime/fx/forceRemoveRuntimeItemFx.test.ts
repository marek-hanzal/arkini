import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { forceRemoveRuntimeItemFx } from "~/game-runtime/fx/forceRemoveRuntimeItemFx";
import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";
import { boardFn, fixtureFn } from "./forceRemoveRuntimeItemFx.test/fixture";

describe("forceRemoveRuntimeItemFx", () => {
	it("gives reservations the freed owner cell and audits discarded buffer descendants without orphaned work or defaults", () => {
		const { config, runtime, owner, reserve } = fixtureFn();
		const original = structuredClone(runtime);
		Effect.runSync(
			Effect.gen(function* () {
				expect(
					(yield* checkRuntimeFx({
						runtime,
					})).issues,
				).toEqual([]);
				const result = yield* forceRemoveRuntimeItemFx({
					item: owner,
					origin: boardFn(0),
					runtime,
				});
				expect(result.runtime.items.map((item) => item.id).sort()).toEqual([
					"blocker",
					"reserve",
				]);
				expect(result.runtime.items.find((item) => item.id === reserve.id)).toMatchObject({
					id: reserve.id,
					remainingUnits: 1,
					quantity: 1,
					location: boardFn(0),
				});
				expect(result.runtime.jobs).toEqual([]);
				expect(result.runtime.jobQueue).toEqual([]);
				expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
				expect(result.events).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							type: "job:aborted",
							jobId: "job",
							ownerItemId: owner.id,
							reason: "owner-removed",
						}),
						expect.objectContaining({
							type: "item:discarded",
							itemId: "consumed",
							quantity: 3,
							source: "consumed-input",
							reason: "job-aborted",
						}),
						expect.objectContaining({
							type: "item:discarded",
							itemId: "buffer",
							quantity: 1,
							source: "buffer",
							reason: "board:full",
						}),
						expect.objectContaining({
							type: "item:discarded",
							itemId: "child",
							quantity: 3,
							source: "buffer",
							reason: "board:full",
						}),
					]),
				);
				expect(
					(yield* checkRuntimeFx({
						runtime: result.runtime,
					})).issues,
				).toEqual([]);
				expect(runtime).toEqual(original);
			}).pipe(Effect.provideService(GameConfigFx, config)),
		);
	});
	it("preserves a returned stateful buffer identity, its nested materials and selected line when they fit", () => {
		const { config, runtime, owner, buffer, child } = fixtureFn(3);
		Effect.runSync(
			Effect.gen(function* () {
				const result = yield* forceRemoveRuntimeItemFx({
					item: owner,
					origin: boardFn(0),
					runtime,
				});
				expect(result.runtime.items.find((item) => item.id === buffer.id)).toMatchObject({
					id: buffer.id,
					location: boardFn(2),
				});
				expect(result.runtime.items.find((item) => item.id === child.id)).toEqual(child);
				expect(result.runtime.defaultLineByOwnerItemId).toEqual({
					[buffer.id]: "line:forge:run",
				});
				expect(
					(yield* checkRuntimeFx({
						runtime: result.runtime,
					})).issues,
				).toEqual([]);
			}).pipe(Effect.provideService(GameConfigFx, config)),
		);
	});
	it("fits part of a pure buffered stack into existing and freed cells and records only the excess", () => {
		const { config, runtime, owner, itemFn, inputFn } = fixtureFn();
		const draft = {
			...runtime,
			jobs: [],
			jobQueue: [],
			defaultLineByOwnerItemId: {},
			items: [
				owner,
				itemFn("existing", "water", boardFn(1), 2),
				itemFn("buffer-a", "water", inputFn(owner.id, 0), 3),
				itemFn("buffer-b", "water", inputFn(owner.id, 0), 2),
			],
		};
		Effect.runSync(
			Effect.gen(function* () {
				expect(
					(yield* checkRuntimeFx({
						runtime: draft,
					})).issues,
				).toEqual([]);
				const result = yield* forceRemoveRuntimeItemFx({
					item: owner,
					origin: boardFn(0),
					runtime: draft,
				});
				expect(result.runtime.items.map((item) => item.quantity).sort()).toEqual([
					3,
					3,
				]);
				expect(result.events.filter((event) => event.type === "item:discarded")).toEqual([
					expect.objectContaining({
						canonicalItemId: "water",
						quantity: 1,
						source: "buffer",
						reason: "board:full",
					}),
				]);
				expect(
					(yield* checkRuntimeFx({
						runtime: result.runtime,
					})).issues,
				).toEqual([]);
			}).pipe(Effect.provideService(GameConfigFx, config)),
		);
	});
	it("redirects incoming deliveries while preserving their return-cell lease before material unloading", () => {
		const { config, runtime, owner, itemFn } = fixtureFn();
		const delivery = itemFn("delivery", "water", {
			scope: "delivery",
			phase: "outbound",
			generation: 0,
			origin: boardFn(1),
			remainingDurationMs: 100,
			target: {
				kind: "line-input",
				ownerItemId: owner.id,
				lineId: "line:forge:run",
				input: [
					{
						inputIndex: 0,
						quantity: 1,
					},
				],
			},
		});
		const draft = {
			...runtime,
			items: [
				...runtime.items.filter((item) => item.id !== "blocker"),
				delivery,
			],
		};
		Effect.runSync(
			Effect.gen(function* () {
				expect(
					(yield* checkRuntimeFx({
						runtime: draft,
					})).issues,
				).toEqual([]);
				const result = yield* forceRemoveRuntimeItemFx({
					item: owner,
					origin: boardFn(0),
					runtime: draft,
				});
				expect(result.runtime.items.map((item) => item.id).sort()).toEqual([
					"delivery",
					"reserve",
				]);
				expect(result.runtime.items.find((item) => item.id === delivery.id)).toMatchObject({
					quantity: 1,
					location: {
						scope: "delivery",
						phase: "returning",
						generation: 1,
						origin: boardFn(1),
						returnFrom: boardFn(0),
					},
				});
				expect(
					(yield* checkRuntimeFx({
						runtime: result.runtime,
					})).issues,
				).toEqual([]);
			}).pipe(Effect.provideService(GameConfigFx, config)),
		);
	});
	it("does not mutate the input runtime when an unexpected defect interrupts material placement", () => {
		const { config, runtime, owner } = fixtureFn(3);
		const original = structuredClone(runtime);
		let identities = 0;
		const result = Effect.runSyncExit(
			forceRemoveRuntimeItemFx({
				item: owner,
				origin: boardFn(0),
				runtime,
			}).pipe(
				Effect.provideService(GameConfigFx, config),
				Effect.provideService(
					RuntimeIdentityFx,
					Effect.suspend(() =>
						++identities === 1
							? Effect.succeed("first-revision")
							: Effect.die("identity source failed"),
					),
				),
			),
		);
		expect(Exit.isFailure(result)).toBe(true);
		expect(identities).toBe(2);
		expect(runtime).toEqual(original);
	});
});
