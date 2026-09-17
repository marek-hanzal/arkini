// @vitest-environment jsdom

import { Deferred, Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createEditorProjectRouteHarness,
	setUpEditorProjectRouteTest,
	tearDownEditorProjectRouteTest,
} from "~test/router/EditorProjectRouteLifecycle.test/createEditorProjectRouteHarness";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

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

it("keeps the refreshed Board when cached route data has a higher revision", async () => {
	const harness = await createEditorProjectRouteHarness();
	await harness.router.load();
	await expect.poll(() => harness.events).toContain("create-project-a-r1");
	Effect.runSync(Deferred.succeed(harness.releaseProjectA, undefined));
	const fresh = {
		...harness.projectA,
		revision: 0,
		title: "Refreshed project",
		config: {
			...harness.projectA.config,
			meta: {
				...harness.projectA.config.meta,
				title: "Refreshed project",
			},
		},
	};
	harness.setProject(fresh);
	Object.assign(window.arkini.editor, {
		refreshProjectFn: async () => ({
			type: "success",
			value: fresh,
		}),
	});
	await harness.rendererRuntime.runPromise(
		refreshEditorProjectFx({
			projectId: fresh.projectId,
			isNavigationPendingFn: () => false,
		}),
	);
	const refreshed = await harness.rendererRuntime.runPromise(
		SubscriptionRef.get(harness.owner.state),
	);
	expect(refreshed).toMatchObject({
		type: "ready",
		resource: {
			game: {
				projectRevision: 0,
				config: fresh.config,
			},
		},
	});
	await harness.router.navigate({
		to: "/editor/$projectId/project/detail/$sectionId",
		params: {
			projectId: fresh.projectId,
			sectionId: "general",
		},
	});
	await expect.poll(() => harness.syncRequests.at(-1)).toBe("project-a-r0");
	expect(await harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state))).toBe(
		refreshed,
	);
	await harness.router.navigate({
		to: "/editor/welcome",
	});
	await expect
		.poll(() => harness.rendererRuntime.runPromise(SubscriptionRef.get(harness.owner.state)))
		.toEqual({
			type: "idle",
		});
});
