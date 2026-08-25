import { Cause, Effect, Exit, Option, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import type { EditorBoardGameResource } from "~/bridge/editor/board/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/bridge/editor/version/EditorProjectVersionCheckoutConfirmationRequired";
import { checkoutEditorProjectVersionFx } from "~/bridge/editor/version/checkoutEditorProjectVersionFx";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 1,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const version = {
	applicability: {
		type: "applicable" as const,
	},
	arkini: editorTestPayload.game,
	arkpackVersion: project.version,
	createdAtMs: 2,
	projectId: project.projectId,
	snapshotFormatVersion: 1,
	sourceRevision: project.revision,
	subject: "Snapshot",
	versionId: "version-one",
};

const runCheckout = async ({
	confirm = true,
	dirty = false,
	fail = false,
}: {
	readonly confirm?: boolean;
	readonly dirty?: boolean;
	readonly fail?: boolean;
} = {}) => {
	const events: string[] = [];
	const registry = AtomRegistry.make();
	const state = Effect.runSync(
		SubscriptionRef.make<EditorBoardGameResource.State>({
			type: "idle",
		}),
	);
	const owner = {
		state,
		syncFx: (nextProject) =>
			Effect.sync(() => events.push(`board-sync-${nextProject.revision}`)),
		publishFx: () => Effect.void,
		replaceFx: () => Effect.void,
		releaseCurrentFx: Effect.sync(() => events.push("board-release")),
		shutdownFx: Effect.void,
	} satisfies EditorBoardGameResource;
	Effect.runSync(
		Atom.set(EditorBoardGameResourceOwnerAtom, owner).pipe(
			Effect.provideService(AtomRegistry.AtomRegistry, registry),
		),
	);
	const checkoutVersionFx: EditorProjectRepositoryService["checkoutVersionFx"] = vi.fn(
		(request) =>
			Effect.sync(() => events.push(`checkout-${request.expectedFingerprint}`)).pipe(
				Effect.andThen(
					fail
						? Effect.fail(
								new EditorProjectRepositoryError({
									operation: "checkout-version",
									message: "Checkout rejected.",
								}),
							)
						: Effect.succeed({
								project: {
									...project,
									revision: 2,
									updatedAtMs: 2,
								},
								version,
							}),
				),
			),
	);
	const repository: EditorProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.sync(() => events.push("idle")),
		checkoutVersionFx,
		createProjectFx: () => Effect.die("Unexpected project create."),
		listProjectsFx: Effect.die("Unexpected project list."),
		readProjectFx: () =>
			Effect.sync(() => {
				events.push("project-read");
				return {
					...project,
					revision: 7,
				};
			}),
		readVersionStatusFx: () =>
			Effect.sync(() => {
				events.push("status");
				return {
					canCommit: true,
					currentFingerprint: "a".repeat(64),
					dirty,
					versionCount: 1,
				};
			}),
		replaceConfigFx: () => Effect.die("Unexpected config write."),
		replaceResourceFx: () => Effect.die("Unexpected resource write."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		upsertItemFx: () => Effect.die("Unexpected item write."),
		upsertResourcesFx: () => Effect.die("Unexpected resources write."),
	};
	const unsaved = {
		decide: async () => undefined,
		discardAll: () => events.push("discard"),
		getSnapshot: () => ({
			canSave: false,
			error: undefined,
			hasDirtySession: false,
			promptOpen: false,
			saving: false,
		}),
		refresh: () => undefined,
		register: () => () => undefined,
		requestLeave: async () => true,
		subscribe: () => () => undefined,
	};
	try {
		const exit = await Effect.runPromiseExit(
			checkoutEditorProjectVersionFx({
				confirmDiscardCurrentChanges: confirm,
				currentProject: project,
				hardReload: () => events.push("hard-reload"),
				versionId: version.versionId,
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
				Effect.provideService(EditorUnsavedChanges, unsaved),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		return {
			events,
			exit,
		};
	} finally {
		registry.dispose();
	}
};

describe("checkoutEditorProjectVersionFx", () => {
	it("discards drafts only after replacing SQLite state", async () => {
		const result = await runCheckout();
		expect(Exit.isSuccess(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"status",
			"board-release",
			`checkout-${"a".repeat(64)}`,
			"discard",
			"hard-reload",
		]);
	});

	it("requires fresh consent before discarding newly saved working-copy changes", async () => {
		const result = await runCheckout({
			confirm: false,
			dirty: true,
		});
		expect(Exit.isFailure(result.exit)).toBe(true);
		if (Exit.isFailure(result.exit)) {
			const failure = Cause.findErrorOption(result.exit.cause);
			expect(Option.isSome(failure)).toBe(true);
			if (Option.isSome(failure))
				expect(failure.value).toBeInstanceOf(
					EditorProjectVersionCheckoutConfirmationRequired,
				);
		}
		expect(result.events).toEqual([
			"idle",
			"status",
		]);
	});

	it("resynchronizes the untouched project after a failed replacement", async () => {
		const result = await runCheckout({
			fail: true,
		});
		expect(Exit.isFailure(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"status",
			"board-release",
			`checkout-${"a".repeat(64)}`,
			"project-read",
			"board-sync-7",
		]);
	});
});
