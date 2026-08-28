// @vitest-environment jsdom

import { Deferred, Effect, SubscriptionRef } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createEditorProjectRouteHarness,
	setUpEditorProjectRouteTest,
	tearDownEditorProjectRouteTest,
} from "~test/router/EditorProjectRouteLifecycle.test/createEditorProjectRouteHarness";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";

beforeEach(setUpEditorProjectRouteTest);
afterEach(tearDownEditorProjectRouteTest);

describe("editor project route lifecycle", () => {
	it("discards project A before publishing project B and releases B on leave", async () => {
		const harness = await createEditorProjectRouteHarness();
		await harness.router.load();
		await expect
			.poll(() => harness.events)
			.toEqual([
				"create-project-a-r1",
			]);

		await harness.router.navigate({
			to: "/editor/$projectId/board",
			params: {
				projectId: "project-b",
			},
		});
		await expect.poll(() => harness.events).toContain("release-start-project-a-r1");
		expect(harness.events).not.toContain("create-project-b-r1");

		Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
		await expect
			.poll(() => harness.events)
			.toEqual([
				"create-project-a-r1",
				"release-start-project-a-r1",
				"release-end-project-a-r1",
				"create-project-b-r1",
			]);
		const switched = await harness.rendererRuntime.runPromise(
			SubscriptionRef.get(harness.owner.state),
		);
		expect(switched.type).toBe("ready");
		if (switched.type !== "ready") throw new Error("Project B was not published.");
		expect(switched.resource.game.projectId).toBe("project-b");

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
		expect(harness.events).toEqual([
			"create-project-a-r1",
			"release-start-project-a-r1",
			"release-end-project-a-r1",
			"create-project-b-r1",
			"release-start-project-b-r1",
			"release-end-project-b-r1",
		]);
	});

	it("discards project A when the replacement project cannot be loaded", async () => {
		const harness = await createEditorProjectRouteHarness();
		Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
		await harness.router.load();
		await expect
			.poll(() => harness.events)
			.toEqual([
				"create-project-a-r1",
			]);

		await harness.router.navigate({
			to: "/editor/$projectId/board",
			params: {
				projectId: "missing",
			},
		});
		await expect
			.poll(() =>
				harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state)),
			)
			.toEqual({
				type: "idle",
			});
		expect(harness.events).toEqual([
			"create-project-a-r1",
			"release-start-project-a-r1",
			"release-end-project-a-r1",
		]);

		await harness.router.navigate({
			to: "/editor/welcome",
		});
		expect(
			await harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state)),
		).toEqual({
			type: "idle",
		});
		expect(harness.events).toHaveLength(3);
	});

	it("ignores stale loader data after the canonical project advances", async () => {
		const harness = await createEditorProjectRouteHarness();
		Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
		await harness.router.load();
		await expect
			.poll(() => harness.syncRequests)
			.toEqual([
				"project-a-r1",
			]);

		await harness.rendererRuntime.runPromise(
			syncEditorBoardGameFx({
				...harness.projectA,
				updatedAtMs: 2,
				revision: 2,
			}),
		);
		const revisionTwoEvents = [
			"create-project-a-r1",
			"release-start-project-a-r1",
			"release-end-project-a-r1",
			"create-project-a-r2",
		];
		expect(harness.events).toEqual(revisionTwoEvents);

		await harness.router.navigate({
			to: "/editor/$projectId/editor/items/list",
			params: {
				projectId: "project-a",
			},
		});
		await expect
			.poll(() => harness.syncRequests)
			.toEqual([
				"project-a-r1",
				"project-a-r2",
				"project-a-r1",
			]);
		expect(harness.events).toEqual(revisionTwoEvents);
		const state = await harness.rendererRuntime.runPromise(
			SubscriptionRef.get(harness.owner.state),
		);
		expect(state.type).toBe("ready");
		if (state.type !== "ready") throw new Error("Revision 2 is not ready.");
		expect(state.resource.game.projectRevision).toBe(2);

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

	it("reloads the project route after a terminal repository replacement", async () => {
		const harness = await createEditorProjectRouteHarness();
		Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
		await harness.router.load();
		await expect
			.poll(() => harness.syncRequests)
			.toEqual([
				"project-a-r1",
			]);
		harness.setProject({
			...harness.projectA,
			revision: 2,
			updatedAtMs: 2,
		});

		await harness.router.invalidate();

		await expect
			.poll(() => harness.syncRequests)
			.toEqual([
				"project-a-r1",
				"project-a-r2",
			]);
		expect(harness.events).toEqual([
			"create-project-a-r1",
			"release-start-project-a-r1",
			"release-end-project-a-r1",
			"create-project-a-r2",
		]);
	});
});
