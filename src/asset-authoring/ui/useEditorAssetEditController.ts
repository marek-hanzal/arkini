import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { editEditorAssetFx } from "~/asset-authoring/fx/editEditorAssetFx";
import { validateEditorAssetFileFx } from "~/asset-authoring/fx/validateEditorAssetFileFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

interface EditEditorAssetCommandProps {
	readonly currentId: string;
	readonly file?: File;
	readonly resourceId: string;
}

const validateEditorAssetDraftFx = Effect.fn("validateEditorAssetDraftFx")(function* ({
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
				message: "Asset ID must not be empty.",
				cause,
			}),
	});
	if (resourceId !== currentId && resources.some(({ id }) => id === resourceId)) {
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-resource-id",
				message: `Asset ID ${resourceId} is already used by another asset.`,
			}),
		);
	}
	if (file !== undefined) yield* validateEditorAssetFileFx(file, resourceId);
});

const isAssetIdCollisionFn = (error: unknown, resourceId: string) =>
	error instanceof ProjectRepositoryError &&
	error.operation === "replace-resource" &&
	error.message === `Resource ID ${resourceId} already exists.`;

const editEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: EditEditorAssetCommandProps) =>
				editEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useEditorAssetEditController {
	export interface Props {
		readonly filter: "all" | "unused";
		readonly query: string;
		readonly resourceId: string;
	}

	export interface Output {
		readonly assetIdError?: string;
		readonly currentUrl?: string;
		readonly dirty: boolean;
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

export const useEditorAssetEditController = ({
	filter,
	query,
	resourceId,
}: useEditorAssetEditController.Props): useEditorAssetEditController.Output => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	const currentUrl = useResourceUrl(resourceId);
	const navigateFn = useNavigate();
	const commandAtom = editEditorAssetCommandAtom(project.projectId);
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
		readonly field: "assetId" | "file";
		readonly message: string;
	}>();
	const setNextIdFn = useCallback(
		(value: string) => {
			if (pendingSaveRef.current !== undefined || result.waiting) return;
			invalidateSaveFn();
			setNextIdStateFn(value);
			setValidationIssueFn((current) => (current?.field === "assetId" ? undefined : current));
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
		(issue: { readonly field: "assetId" | "file"; readonly message: string }) => {
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
				validateEditorAssetDraftFx({
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
					field: validation.issue.reason === "invalid-asset" ? "file" : "assetId",
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
				if (isAssetIdCollisionFn(error, id)) {
					showValidationIssueFn({
						field: "assetId",
						message: `Asset ID ${id} is already used by another asset.`,
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
		if (!(await persistFn()) || !mountedRef.current || draftEpochRef.current !== epoch)
			return false;
		const id = nextId.trim();
		await navigateFn({
			to: "/editor/$projectId/assets/$resourceId/detail/overview",
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
		filter,
		navigateFn,
		nextId,
		persistFn,
		project.projectId,
		query,
	]);
	useEditorUnsavedChangesRegistration({
		discardFn: () => {
			invalidateSaveFn();
			dirtyRef.current = false;
			setNextIdStateFn(resourceId);
			setFileStateFn(undefined);
			setValidationIssueFn(undefined);
		},
		id: `asset:${project.projectId}:${resourceId}`,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorAssetDraftFx({
						currentId: resourceId,
						file,
						resources: project.resources,
						resourceId: nextId,
					}),
				),
			),
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/assets/${resourceId}/edit`),
		saveFn: persistFn,
	});
	const settledError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const persistenceError =
		commandEpochRef.current === draftEpochRef.current ? settledError : undefined;
	const error =
		validationIssue === undefined
			? persistenceError
			: `${validationIssue.field === "assetId" ? "Asset ID" : "Image"}: ${validationIssue.message}`;
	const resourceFound = resource !== undefined;

	return {
		assetIdError: validationIssue?.field === "assetId" ? validationIssue.message : undefined,
		currentUrl,
		dirty,
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
