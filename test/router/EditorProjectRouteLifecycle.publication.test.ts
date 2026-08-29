// @vitest-environment jsdom

import { Deferred, Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createEditorProjectRouteHarness,
	setUpEditorProjectRouteTest,
	tearDownEditorProjectRouteTest,
} from "~test/router/EditorProjectRouteLifecycle.test/createEditorProjectRouteHarness";
import { EditorProjectAtom } from "~/ui/editor/EditorProjectAtom";
import { publishEditorProjectFx } from "~/ui/editor/publishEditorProjectFx";

beforeEach(setUpEditorProjectRouteTest);
afterEach(tearDownEditorProjectRouteTest);

describe("editor project route publication", () => {
	it("keeps routed project B when a delayed project A write publishes", async () => {
		const harness = await createEditorProjectRouteHarness();
		await harness.router.load();
		await expect
			.poll(() => harness.events)
			.toEqual([
				"create-project-a-r1",
			]);
		const writeFinished = Effect.runSync(Deferred.make<void>());
		const committedProjectA = {
			...harness.projectA,
			updatedAtMs: 2,
			revision: 2,
		};
		const delayedPublication = harness.rendererRuntime.runPromise(
			Deferred.await(writeFinished).pipe(
				Effect.andThen(
					publishEditorProjectFx(harness.projectA.projectId, {
						project: committedProjectA,
					}),
				),
			),
		);

		const switching = harness.router.navigate({
			to: "/editor/$projectId/board",
			params: {
				projectId: "project-b",
			},
		});
		await expect.poll(() => harness.events).toContain("release-start-project-a-r1");
		Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
		await switching;
		await expect
			.poll(() =>
				harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state)),
			)
			.toMatchObject({
				type: "ready",
				resource: {
					game: {
						projectId: "project-b",
						projectRevision: 1,
					},
				},
			});

		Effect.runSync(Deferred.succeed(writeFinished, undefined));
		await delayedPublication;

		expect(
			await harness.rendererRuntime.runPromise(
				Atom.get(EditorProjectAtom(harness.projectA.projectId)),
			),
		).toEqual(committedProjectA);
		const state = await harness.rendererRuntime.runPromise(
			SubscriptionRef.get(harness.owner.state),
		);
		expect(state.type).toBe("ready");
		if (state.type !== "ready") throw new Error("Project B is not ready.");
		expect(state.resource.game.projectId).toBe("project-b");
		expect(state.resource.game.projectRevision).toBe(1);
		expect(harness.events).not.toContain("create-project-a-r2");

		await harness.router.navigate({
			to: "/editor/welcome",
		});
		await expect
			.poll(() =>
				harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state)),
			)
			.toEqual({
				type: "idle",
			});
	});
});
