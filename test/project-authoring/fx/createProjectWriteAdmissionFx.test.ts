import { Deferred, Effect, Fiber } from "effect";
import { expect, it } from "vitest";

import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";

it("drains accepted commands and their nested writes before replacement, rejecting late writes", async () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	const gate = Effect.runSync(Deferred.make<void>());
	const events: string[] = [];
	const first = Effect.runPromise(
		admission.admitWriteFx(
			"replace-resource",
			Effect.gen(function* () {
				events.push("prepare");
				yield* Deferred.await(gate);
				yield* admission.admitWriteFx(
					"replace-resource",
					Effect.sync(() => events.push("commit")),
				);
				events.push("publish");
			}),
		),
	);
	const second = Effect.runPromise(
		admission.admitWriteFx(
			"replace-config",
			Effect.sync(() => events.push("second")),
		),
	);
	const refresh = Effect.runPromise(
		Effect.acquireUseRelease(
			admission.acquireReplacementFx("refresh-project", () => false),
			() => Effect.sync(() => events.push("refresh")),
			(releaseFx) => releaseFx,
		),
	);
	expect(admission.isNavigationBlockedFn()).toBe(true);
	const rejected = await Effect.runPromise(
		Effect.result(
			admission.admitWriteFx(
				"replace-config",
				Effect.sync(() => events.push("late")),
			),
		),
	);
	expect(rejected).toMatchObject({
		_tag: "Failure",
		failure: {
			operation: "replace-config",
		},
	});
	expect(events).toEqual([
		"prepare",
	]);
	Effect.runSync(Deferred.succeed(gate, undefined));
	await Promise.all([
		first,
		second,
		refresh,
	]);
	expect(events).toEqual([
		"prepare",
		"commit",
		"publish",
		"second",
		"refresh",
	]);
	expect(admission.isNavigationBlockedFn()).toBe(false);
});

it("releases an interrupted preparation so replacement and subsequent saves can finish", async () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	const gate = Effect.runSync(Deferred.make<void>());
	const write = Effect.runFork(admission.admitWriteFx("replace-resource", Deferred.await(gate)));
	const replacement = Effect.runPromise(
		admission.acquireReplacementFx("refresh-project", () => false),
	);
	await Effect.runPromise(Fiber.interrupt(write));
	const releaseFx = await replacement;
	Effect.runSync(releaseFx);
	expect(
		await Effect.runPromise(admission.admitWriteFx("replace-config", Effect.succeed("saved"))),
	).toBe("saved");
});

it("does not lend a parent's write permit to a child fiber", async () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	const events: string[] = [];
	let child: Fiber.Fiber<void, unknown> | undefined;
	await Effect.runPromise(
		admission.admitWriteFx(
			"replace-config",
			Effect.gen(function* () {
				child = yield* Effect.forkDetach(
					admission.admitWriteFx(
						"replace-config",
						Effect.sync(() => {
							events.push("child");
						}),
					),
					{
						startImmediately: true,
					},
				);
				events.push("parent");
			}),
		),
	);
	await Effect.runPromise(Fiber.join(child!));
	expect(events).toEqual([
		"parent",
		"child",
	]);
});

it("reopens admission when a waiting replacement is interrupted", async () => {
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	const gate = Effect.runSync(Deferred.make<void>());
	const write = Effect.runPromise(
		admission.admitWriteFx("replace-resource", Deferred.await(gate)),
	);
	const replacement = Effect.runFork(
		admission.acquireReplacementFx("refresh-project", () => false),
	);
	expect(admission.isNavigationBlockedFn()).toBe(true);
	await Effect.runPromise(Fiber.interrupt(replacement));
	expect(admission.isNavigationBlockedFn()).toBe(false);
	Effect.runSync(Deferred.succeed(gate, undefined));
	await write;
	expect(
		await Effect.runPromise(admission.admitWriteFx("replace-config", Effect.succeed("saved"))),
	).toBe("saved");
});
