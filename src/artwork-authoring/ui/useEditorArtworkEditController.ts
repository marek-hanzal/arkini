import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { editEditorArtworkFx } from "~/artwork-authoring/fx/editEditorArtworkFx";
import { validateEditorArtworkFileFx } from "~/artwork-authoring/fx/validateEditorArtworkFileFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorArtworkById } from "~/artwork-authoring/ui/useEditorArtworkById";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

interface EditEditorArtworkCommandProps {
	readonly currentId: string;
	readonly file?: File;
	readonly resourceId: string;
}

const validateEditorArtworkDraftFx = Effect.fn("validateEditorArtworkDraftFx")(function* ({
	currentId,
	file,
	resources,
	resourceId: candidateId,
}: {
	readonly currentId: string;
	readonly file?: File;
	readonly resources: ReadonlyArray<{
		readonly id: string;
	}>;
	readonly resourceId: string;
}) {
	const resourceId = yield* Effect.try({
		try: () => IdSchema.parse(candidateId.trim()),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: "Artwork ID must not be empty.",
				cause,
			}),
	});
	if (resourceId !== currentId && resources.some(({ id }) => id === resourceId)) {
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: `Artwork ID ${resourceId} is already used by another artwork.`,
			}),
		);
	}
	if (file !== undefined) yield* validateEditorArtworkFileFx(file, resourceId);
});

const isArtworkIdCollisionFn = (error: unknown, resourceId: string) =>
	error instanceof ProjectRepositoryError &&
	error.operation === "replace-resource" &&
	error.message === `Resource ID ${resourceId} already exists.`;

const editEditorArtworkCommandAtom = RendererRuntime.runSync(
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.family((projectId: string) =>
				Atom.fn((props: EditEditorArtworkCommandProps) =>
					editEditorArtworkFx({
						...props,
						projectId,
					}).pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(ProjectWriteAdmission, admission),
					),
				).pipe(Atom.setIdleTTL(0)),
			),
	),
);

export namespace useEditorArtworkEditController {
	export interface Props {
		readonly filter: ArtworkCatalogFilterSchema.Type;
		readonly query: string;
		readonly resourceId: string;
	}

	export interface Output {
		readonly artworkIdError?: string;
		readonly currentUrl?: string;
		readonly dirty: boolean;
		readonly discardFn: () => Promise<void>;
		readonly error: unknown;
		readonly file?: File;
		readonly fileError?: string;
		readonly nextId: string;
		readonly projectId: string;
		readonly resourceFound: boolean;
		readonly saveFn: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setFileFn: (file: File | undefined) => void;
		readonly setNextIdFn: (resourceId: string) => void;
	}
}

export const useEditorArtworkEditController = ({
	filter,
	query,
	resourceId,
}: useEditorArtworkEditController.Props): useEditorArtworkEditController.Output => {
	const project = useEditorProject();
	const admission = RendererRuntime.runSync(ProjectWriteAdmission);
	const resource = useEditorArtworkById(resourceId);
	const currentUrl = useResourceUrl(resourceId);
	const navigateFn = useNavigate();
	const commandAtom = editEditorArtworkCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutateFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [nextId, setNextIdStateFn] = useState(resourceId);
	const [file, setFileStateFn] = useState<File>();
	const [saving, setSavingFn] = useState(false);
	const mountedRef = useRef(false);
	const draftEpochRef = useRef(0);
	const pendingSaveRef = useRef<number | undefined>(undefined);
	const commandEpochRef = useRef<number | undefined>(undefined);
	useLayoutEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			draftEpochRef.current += 1;
			pendingSaveRef.current = undefined;
		};
	}, [
		project.projectId,
		resourceId,
	]);
	const invalidateSaveFn = useCallback(() => {
		draftEpochRef.current += 1;
		pendingSaveRef.current = undefined;
		setSavingFn(false);
	}, []);
	const [validationIssue, setValidationIssueFn] = useState<{
		readonly field: "artworkId" | "file";
		readonly message: string;
	}>();
	const setNextIdFn = useCallback(
		(value: string) => {
			if (pendingSaveRef.current !== undefined || result.waiting) return;
			invalidateSaveFn();
			setNextIdStateFn(value);
			setValidationIssueFn((current) =>
				current?.field === "artworkId" ? undefined : current,
			);
		},
		[
			invalidateSaveFn,
			result.waiting,
		],
	);
	const setFileFn = useCallback(
		(value: File | undefined) => {
			if (pendingSaveRef.current !== undefined || result.waiting) return;
			invalidateSaveFn();
			setFileStateFn(value);
			setValidationIssueFn((current) => (current?.field === "file" ? undefined : current));
		},
		[
			invalidateSaveFn,
			result.waiting,
		],
	);
	const showValidationIssueFn = useCallback(
		(issue: { readonly field: "artworkId" | "file"; readonly message: string }) => {
			setValidationIssueFn(issue);
			const focusInvalidFieldFn = () =>
				document
					.querySelector<HTMLElement>(
						"input[data-ui-invalid='true'], button[data-ui-invalid='true']",
					)
					?.focus();
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(focusInvalidFieldFn);
			} else {
				setTimeout(focusInvalidFieldFn, 0);
			}
		},
		[],
	);
	const dirty = nextId.trim() !== resourceId || file !== undefined;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const persistFn = useCallback(async () => {
		if (
			!mountedRef.current ||
			!dirtyRef.current ||
			pendingSaveRef.current !== undefined ||
			result.waiting
		)
			return false;
		const epoch = draftEpochRef.current;
		const isCurrentFn = () => mountedRef.current && draftEpochRef.current === epoch;
		pendingSaveRef.current = epoch;
		setSavingFn(true);
		try {
			const validation = await RendererRuntime.runPromise(
				validateEditorArtworkDraftFx({
					currentId: resourceId,
					file,
					resources: project.resources,
					resourceId: nextId,
				}).pipe(
					Effect.match({
						onFailure: (issue) => ({
							issue,
						}),
						onSuccess: () => ({}),
					}),
				),
			);
			// Validation is outside the command Atom: a discarded draft must never submit later.
			if (!isCurrentFn()) return false;
			if ("issue" in validation) {
				showValidationIssueFn({
					field: validation.issue.reason === "invalid-artwork" ? "file" : "artworkId",
					message: validation.issue.message,
				});
				return false;
			}
			setValidationIssueFn(undefined);
			const id = nextId.trim();
			try {
				commandEpochRef.current = epoch;
				await mutateFn({
					currentId: resourceId,
					file,
					resourceId: id,
				});
			} catch (error) {
				if (!isCurrentFn()) return false;
				if (isArtworkIdCollisionFn(error, id)) {
					showValidationIssueFn({
						field: "artworkId",
						message: `Artwork ID ${id} is already used by another artwork.`,
					});
				}
				return false;
			}
			if (!isCurrentFn()) return false;
			dirtyRef.current = false;
			setNextIdStateFn(id);
			setFileStateFn(undefined);
			return true;
		} finally {
			if (pendingSaveRef.current === epoch) {
				pendingSaveRef.current = undefined;
				if (mountedRef.current) setSavingFn(false);
			}
		}
	}, [
		file,
		mutateFn,
		nextId,
		project.resources,
		resourceId,
		result.waiting,
		showValidationIssueFn,
	]);
	const saveFn = useCallback(async () => {
		const epoch = draftEpochRef.current;
		if (
			!(await persistFn()) ||
			!mountedRef.current ||
			draftEpochRef.current !== epoch ||
			admission.isNavigationBlockedFn()
		)
			return false;
		const id = nextId.trim();
		await navigateFn({
			to: "/editor/$projectId/artwork/$resourceId/detail/overview",
			params: {
				projectId: project.projectId,
				resourceId: id,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
		return true;
	}, [
		admission,
		filter,
		navigateFn,
		nextId,
		persistFn,
		project.projectId,
		query,
	]);
	const resetDraftFn = useCallback(() => {
		invalidateSaveFn();
		dirtyRef.current = false;
		setNextIdStateFn(resourceId);
		setFileStateFn(undefined);
		setValidationIssueFn(undefined);
	}, [
		invalidateSaveFn,
		resourceId,
	]);
	const discardFn = useCallback(async () => {
		if (pendingSaveRef.current !== undefined || result.waiting) return;
		resetDraftFn();
		await navigateFn({
			to: "/editor/$projectId/artwork/$resourceId/detail/overview",
			params: {
				projectId: project.projectId,
				resourceId,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
	}, [
		filter,
		navigateFn,
		project.projectId,
		query,
		resetDraftFn,
		resourceId,
		result.waiting,
	]);
	useEditorUnsavedChangesRegistration({
		discardFn: resetDraftFn,
		id: `artwork:${project.projectId}:${resourceId}`,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorArtworkDraftFx({
						currentId: resourceId,
						file,
						resources: project.resources,
						resourceId: nextId,
					}),
				),
			),
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/artwork/${resourceId}/edit`),
		saveFn: persistFn,
	});
	const settledError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const persistenceError =
		commandEpochRef.current === draftEpochRef.current ? settledError : undefined;
	const error =
		validationIssue === undefined
			? persistenceError
			: `${validationIssue.field === "artworkId" ? "Artwork ID" : "Image"}: ${validationIssue.message}`;
	const resourceFound = resource !== undefined;

	return {
		artworkIdError:
			validationIssue?.field === "artworkId" ? validationIssue.message : undefined,
		currentUrl,
		dirty,
		discardFn,
		error,
		file,
		fileError: validationIssue?.field === "file" ? validationIssue.message : undefined,
		nextId,
		projectId: project.projectId,
		resourceFound,
		saveFn,
		saving: saving || result.waiting,
		setFileFn,
		setNextIdFn,
	};
};
