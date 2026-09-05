// @vitest-environment jsdom

import { Deferred, Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { refreshEditorProjectFx } from "~/authoring-session/fx/refreshEditorProjectFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { createFixture } from "./useEditorNavigationBlocker.test/fixture";

describe("useEditorNavigationBlocker", () => {
	it.each([
		"checkout",
		"refresh",
	] as const)(
		"keeps a clean project routed until %s finishes durable and renderer replacement",
		async (operation) => {
			const fixture = await createFixture();
			const pending =
				operation === "checkout"
					? fixture.checkout({
							projectId: fixture.project.projectId,
							versionId: "version-one",
						})
					: fixture.rendererRuntime.runPromise(
							refreshEditorProjectFx({
								projectId: fixture.project.projectId,
								isNavigationPendingFn: () =>
									fixture.router.state.status === "pending",
							}),
						);
			try {
				await Effect.runPromise(Deferred.await(fixture.releaseStarted));
				expect(fixture.unsaved.getSnapshotFn().hasDirtySession).toBe(false);
				await act(async () => {
					void fixture.router.navigate({
						href: "/editor/project-two/draft",
					});
					await Promise.resolve();
				});
				expect(fixture.router.state.location.pathname).toBe("/editor/project-one/draft");
				Effect.runSync(Deferred.succeed(fixture.releaseGate, undefined));
				await Effect.runPromise(Deferred.await(fixture.writeStarted));
				await act(async () => {
					void fixture.router.navigate({
						href: "/editor/project-two/draft",
					});
					await Promise.resolve();
				});
				expect(fixture.router.state.location.pathname).toBe("/editor/project-one/draft");
				await act(async () => {
					Effect.runSync(Deferred.succeed(fixture.writeGate, undefined));
					await pending;
				});
				expect(
					operation === "checkout" ? fixture.checkoutVersionFx : fixture.refreshProjectFn,
				).toHaveBeenCalledOnce();
				expect(fixture.syncFx).toHaveBeenCalledWith(fixture.project);
				if (operation === "checkout")
					expect(fixture.router.state.location.pathname).toBe(
						"/editor/project-one/versions/history",
					);
				await act(async () =>
					fixture.router.navigate({
						href: "/editor/project-two/draft",
					}),
				);
				expect(fixture.router.state.location.pathname).toBe("/editor/project-two/draft");
			} finally {
				Effect.runSync(Deferred.succeed(fixture.releaseGate, undefined));
				Effect.runSync(Deferred.succeed(fixture.writeGate, undefined));
				await act(async () => {
					await pending;
				});
			}
		},
	);

	it.each([
		"checkout",
		"refresh",
	] as const)(
		"rejects %s while an already admitted project navigation is loading",
		async (operation) => {
			const navigationGate = Effect.runSync(Deferred.make<void>());
			const fixture = await createFixture(() =>
				Effect.runPromise(Deferred.await(navigationGate)),
			);
			let navigation!: Promise<void>;
			try {
				await act(async () => {
					navigation = fixture.router.navigate({
						href: "/editor/project-two/draft",
					});
				});
				expect(fixture.router.state.status).toBe("pending");
				expect(
					fixture.router.state.matches.some(
						(match) =>
							"projectId" in match.params && match.params.projectId === "project-one",
					),
				).toBe(true);
				const pending =
					operation === "checkout"
						? fixture.checkout({
								projectId: fixture.project.projectId,
								versionId: "version-one",
							})
						: fixture.rendererRuntime.runPromise(
								refreshEditorProjectFx({
									projectId: fixture.project.projectId,
									isNavigationPendingFn: () =>
										fixture.router.state.status === "pending",
								}),
							);
				await expect(pending).rejects.toBeInstanceOf(ProjectRepositoryError);
				expect(fixture.checkoutVersionFx).not.toHaveBeenCalled();
				expect(fixture.refreshProjectFn).not.toHaveBeenCalled();
				expect(Effect.runSync(Deferred.isDone(fixture.releaseStarted))).toBe(false);
				await act(async () => {
					Effect.runSync(Deferred.succeed(navigationGate, undefined));
					await navigation;
				});
				expect(fixture.router.state.location.pathname).toBe("/editor/project-two/draft");
			} finally {
				Effect.runSync(Deferred.succeed(navigationGate, undefined));
				await navigation;
			}
		},
	);

	it("rechecks replacement admission when an earlier dirty leave decision settles", async () => {
		const fixture = await createFixture();
		let dirty = true;
		await act(async () => {
			fixture.unsaved.registerFn("draft", {
				discardFn: () => {
					dirty = false;
				},
				isDirtyFn: () => dirty,
				isValidFn: () => true,
				ownsPathnameFn: () => false,
				saveFn: async () => true,
			});
		});
		let navigation!: Promise<void>;
		await act(async () => {
			navigation = fixture.router.navigate({
				href: "/editor/project-two/draft",
			});
			await Promise.resolve();
		});
		await vi.waitFor(() => expect(fixture.unsaved.getSnapshotFn().promptOpen).toBe(true));
		const releaseFx = Effect.runSync(
			fixture.admission.acquireReplacementFx("checkout-version", () => false),
		);
		try {
			await act(async () => {
				await fixture.unsaved.decideFn("discard");
				await Promise.resolve();
			});
			expect(fixture.router.state.location.pathname).toBe("/editor/project-one/draft");
		} finally {
			Effect.runSync(releaseFx);
		}
		await act(async () =>
			fixture.router.navigate({
				href: "/editor/project-two/draft",
			}),
		);
		await navigation;
		expect(fixture.router.state.location.pathname).toBe("/editor/project-two/draft");
	});
});
