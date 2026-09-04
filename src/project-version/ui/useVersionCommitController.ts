import { useRouter, useSearch } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ProjectVersionCommitPreview } from "~/project-version/type/ProjectVersion";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

const messageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useVersionCommitController {
	export interface Output {
		readonly body: string;
		readonly canCommit: boolean;
		readonly commitFn: () => void;
		readonly error?: string;
		readonly pending: boolean;
		readonly preview?: ProjectVersionCommitPreview;
		readonly projectId: string;
		readonly setBodyFn: (value: string) => void;
		readonly setSubjectFn: (value: string) => void;
		readonly setTagFn: (value: string) => void;
		readonly subject: string;
		readonly tag: string;
	}
}

export const useVersionCommitController = (): useVersionCommitController.Output => {
	const project = useEditorProject();
	const router = useRouter();
	const { returnTo } = useSearch({
		from: "/editor/$projectId/versions/commit",
	});
	const [body, setBodyFn] = useState("");
	const [error, setErrorFn] = useState<string>();
	const [pending, setPendingFn] = useState(false);
	const [preview, setPreviewFn] = useState<ProjectVersionCommitPreview>();
	const [subject, setSubjectFn] = useState("");
	const [tag, setTagFn] = useState("");

	const loadPreviewFn = useCallback(() => {
		let mounted = true;
		void RendererRuntime.runPromise(
			Effect.gen(function* () {
				const repository = yield* ProjectRepository;
				yield* repository.awaitIdleFx;
				return yield* repository.previewVersionCommitFx(project.projectId);
			}),
		)
			.then((nextPreview) => {
				if (!mounted) return;
				setPreviewFn(nextPreview);
				setErrorFn(undefined);
			})
			.catch((cause) => {
				if (mounted) setErrorFn(messageFn(cause));
			});
		return () => {
			mounted = false;
		};
	}, [
		project.projectId,
	]);
	useEffect(() => {
		let disposeLoadFn = loadPreviewFn();
		const unsubscribeFn = window.arkini.editor.onProjectChangedFn((projectId) => {
			if (projectId !== project.projectId) return;
			disposeLoadFn();
			disposeLoadFn = loadPreviewFn();
		});
		return () => {
			disposeLoadFn();
			unsubscribeFn();
		};
	}, [
		loadPreviewFn,
		project.projectId,
	]);

	const canCommit =
		preview?.canCommit === true && subject.trim().length > 0 && subject.trim().length <= 120;
	const commitFn = () => {
		if (!canCommit || preview === undefined || pending) return;
		setPendingFn(true);
		setErrorFn(undefined);
		void RendererRuntime.runPromise(
			Effect.gen(function* () {
				const repository = yield* ProjectRepository;
				yield* repository.createVersionFx({
					...(body.trim() === ""
						? {}
						: {
								body,
							}),
					expectedFingerprint: preview.currentFingerprint,
					projectId: project.projectId,
					subject,
					...(tag.trim() === ""
						? {}
						: {
								tag,
							}),
				});
				const fresh = yield* repository.readProjectFx(project.projectId);
				if (fresh === null) return yield* Effect.die("Committed project disappeared.");
				yield* publishEditorProjectFx(project.projectId, {
					project: fresh,
				});
			}),
		)
			.then(async () => {
				setPendingFn(false);
				if (
					returnTo !== undefined &&
					returnTo.startsWith(`/editor/${encodeURIComponent(project.projectId)}/`)
				) {
					router.history.push(returnTo);
					return;
				}
				await router.navigate({
					to: "/editor/$projectId/versions/history",
					params: {
						projectId: project.projectId,
					},
				});
			})
			.catch((cause) => {
				setErrorFn(messageFn(cause));
				setPendingFn(false);
			});
	};

	return {
		body,
		canCommit,
		commitFn,
		...(error === undefined
			? {}
			: {
					error,
				}),
		pending,
		...(preview === undefined
			? {}
			: {
					preview,
				}),
		projectId: project.projectId,
		setBodyFn,
		setSubjectFn,
		setTagFn,
		subject,
		tag,
	};
};
