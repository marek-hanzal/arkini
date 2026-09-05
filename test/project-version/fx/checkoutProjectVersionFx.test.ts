import { Cause, Effect, Exit, Option, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import type { EditorBoardGameResource } from "~/board-scenario/service/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import { ProjectVersionCheckoutConfirmationRequired } from "~/project-version/error/ProjectVersionCheckoutConfirmationRequired";
import { checkoutProjectVersionFx } from "~/project-version/fx/checkoutProjectVersionFx";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import {
	ProjectWriteAdmission,
	type ProjectWriteAdmissionService,
} from "~/project-authoring/service/ProjectWriteAdmission";
import { createProjectWriteAdmissionFx } from "~/project-authoring/fx/createProjectWriteAdmissionFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
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

const runCheckout = async ({
	confirm = true,
	dirty = false,
	fail = false,
	writeAdmission = Effect.runSync(createProjectWriteAdmissionFx),
}: {
	readonly confirm?: boolean;
	readonly dirty?: boolean;
	readonly fail?: boolean;
	readonly writeAdmission?: ProjectWriteAdmissionService;
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
	const checkoutVersionFx: ProjectRepositoryService["checkoutVersionFx"] = vi.fn((request) =>
		Effect.sync(() => events.push(`checkout-${request.expectedFingerprint}`)).pipe(
			Effect.andThen(
				fail
					? Effect.fail(
							new ProjectRepositoryError({
								operation: "checkout-version",
								message: "Checkout rejected.",
							}),
						)
					: Effect.void,
			),
		),
	);
	const repository: ProjectRepositoryService = {
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
		decideFn: async () => undefined,
		discardAllFn: () => events.push("discard"),
		getSnapshotFn: () => ({
			canSave: false,
			error: undefined,
			hasDirtySession: false,
			promptOpen: false,
			saving: false,
		}),
		refreshFn: () => undefined,
		registerFn: () => () => undefined,
		requestLeaveFn: async () => true,
		subscribeFn: () => () => undefined,
	};
	try {
		const exit = await Effect.runPromiseExit(
			checkoutProjectVersionFx({
				confirmDiscardCurrentChanges: confirm,
				isNavigationPendingFn: () => false,
				projectId: project.projectId,
				versionId: "version-one",
			}).pipe(
				Effect.provideService(ProjectRepository, repository),
				Effect.provideService(ProjectWriteAdmission, writeAdmission),
				Effect.provideService(EditorUnsavedChanges, unsaved),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		return {
			events,
			exit,
			published: registry.get(EditorProjectAtom(project.projectId)),
			replacementEpoch: registry.get(EditorProjectReplacementEpochAtom(project.projectId)),
		};
	} finally {
		registry.dispose();
	}
};

describe("checkoutProjectVersionFx", () => {
	it("discards drafts only after replacing persisted state", async () => {
		const result = await runCheckout();
		expect(Exit.isSuccess(result.exit)).toBe(true);
		expect(result.events).toEqual([
			"idle",
			"status",
			"board-release",
			`checkout-${"a".repeat(64)}`,
			"discard",
			"project-read",
			"board-sync-7",
		]);
		expect(result.published?.revision).toBe(7);
		expect(result.replacementEpoch).toBe(1);
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
				expect(failure.value).toBeInstanceOf(ProjectVersionCheckoutConfirmationRequired);
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
		expect(result.replacementEpoch).toBe(0);
	});

	it("reports a concurrent project replacement as a typed failure", async () => {
		const writeAdmission = Effect.runSync(createProjectWriteAdmissionFx);
		const releaseFx = Effect.runSync(
			writeAdmission.acquireReplacementFx("refresh-project", () => false),
		);
		try {
			const result = await runCheckout({
				writeAdmission,
			});
			expect(Exit.isFailure(result.exit)).toBe(true);
			if (Exit.isFailure(result.exit)) {
				expect(Cause.hasDies(result.exit.cause)).toBe(false);
				const failure = Cause.findErrorOption(result.exit.cause);
				expect(Option.isSome(failure)).toBe(true);
				if (Option.isSome(failure))
					expect(failure.value).toBeInstanceOf(ProjectRepositoryError);
			}
			expect(result.events).toEqual([]);
		} finally {
			Effect.runSync(releaseFx);
		}
	});
});
