// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { mountIdentityRenameFn } from "./useProjectIdentityRenameController.test/fixture";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

describe("useProjectIdentityRenameController", () => {
	it("excludes MCP checkout and unrelated navigation until the committed identity reaches its new route", async () => {
		const fixture = await mountIdentityRenameFn();
		let rename: Promise<void> | undefined;
		try {
			await act(async () => {
				rename = fixture.readControllerFn().renameFn("project-two");
			});
			expect(fixture.replaceConfigFn).toHaveBeenCalledOnce();
			expect(fixture.admission.isNavigationBlockedFn()).toBe(true);
			await act(async () => {
				void fixture.router.navigate({
					href: "/editor/project-three/project/detail/general",
				});
			});
			expect(fixture.router.state.location.pathname).toBe(
				"/editor/project-one/project/detail/general",
			);
			await expect(
				fixture.checkoutFn({
					projectId: "project-one",
					versionId: "version-one",
				}),
			).rejects.toBeInstanceOf(ProjectRepositoryError);
			expect(fixture.awaitIdleFn).not.toHaveBeenCalled();
			expect(fixture.readVersionStatusFn).not.toHaveBeenCalled();

			await act(async () => {
				fixture.releaseCommitFn();
				await fixture.waitRouteFn();
			});
			expect(fixture.readPhysicalIdFn()).toBe("project-two");
			expect(fixture.admission.isNavigationBlockedFn()).toBe(true);
			await act(async () => {
				fixture.releaseRouteFn();
				await rename;
			});
			expect(fixture.router.state.location.pathname).toBe(
				"/editor/project-two/project/detail/general",
			);
			expect(fixture.admission.isNavigationBlockedFn()).toBe(false);
		} finally {
			await act(async () => {
				fixture.releaseCommitFn();
				fixture.releaseRouteFn();
				await rename;
			});
			await fixture.unmountFn();
		}
	});

	it("releases a failed identity write and exposes its error without leaving navigation locked", async () => {
		const fixture = await mountIdentityRenameFn("failure");
		let rename: Promise<void> | undefined;
		try {
			await act(async () => {
				rename = fixture.readControllerFn().renameFn("project-two");
			});
			await act(async () => {
				fixture.releaseCommitFn();
				await rename;
			});
			expect(fixture.readPhysicalIdFn()).toBe("project-one");
			expect(fixture.readControllerFn().error).toBeInstanceOf(ProjectRepositoryError);
			expect(fixture.readControllerFn().pending).toBe(false);
			expect(fixture.admission.isNavigationBlockedFn()).toBe(false);
			await act(async () => {
				await fixture.router.navigate({
					href: "/editor/project-three/project/detail/general",
				});
			});
			expect(fixture.router.state.location.pathname).toBe(
				"/editor/project-three/project/detail/general",
			);
		} finally {
			await act(async () => {
				fixture.releaseCommitFn();
				await rename;
			});
			await fixture.unmountFn();
		}
	});

	it("preserves the draft decision and reports a replacement that acquired admission while that decision was pending", async () => {
		const fixture = await mountIdentityRenameFn();
		let dirty = true;
		const discardFn = vi.fn(() => {
			dirty = false;
		});
		let unregisterFn: () => void = () => undefined;
		let releaseFx: Effect.Effect<void> | undefined;
		let rename: Promise<void> | undefined;
		try {
			await act(async () => {
				unregisterFn = fixture.owner.registerFn("project-draft", {
					discardFn,
					isDirtyFn: () => dirty,
					isValidFn: () => true,
					ownsPathnameFn: (pathname) => pathname.startsWith("/editor/project-one/"),
					saveFn: async () => true,
				});
				rename = fixture.readControllerFn().renameFn("project-two");
			});
			expect(fixture.owner.getSnapshotFn().promptOpen).toBe(true);
			expect(fixture.replaceConfigFn).not.toHaveBeenCalled();
			expect(fixture.admission.isNavigationBlockedFn()).toBe(false);
			await act(async () => {
				await fixture.owner.decideFn("cancel");
				await rename;
			});
			expect(discardFn).not.toHaveBeenCalled();
			expect(dirty).toBe(true);
			expect(fixture.replaceConfigFn).not.toHaveBeenCalled();

			await act(async () => {
				rename = fixture.readControllerFn().renameFn("project-two");
			});
			releaseFx = Effect.runSync(
				fixture.admission.acquireReplacementFx("checkout-version", () => false),
			);
			await act(async () => {
				await fixture.owner.decideFn("discard");
				await rename;
			});
			expect(discardFn).toHaveBeenCalledOnce();
			expect(fixture.replaceConfigFn).not.toHaveBeenCalled();
			expect(fixture.readControllerFn().error).toBeInstanceOf(ProjectRepositoryError);
			expect(fixture.readControllerFn().pending).toBe(false);
			expect(fixture.router.state.location.pathname).toBe(
				"/editor/project-one/project/detail/general",
			);
		} finally {
			if (releaseFx !== undefined) Effect.runSync(releaseFx);
			await act(async () => {
				unregisterFn();
				await rename;
			});
			await fixture.unmountFn();
		}
	});
});
