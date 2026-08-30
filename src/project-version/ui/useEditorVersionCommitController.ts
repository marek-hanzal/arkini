import { useRouter, useSearch } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { readEditorProjectVersionHistoryFx } from "~/project-version/fx/readEditorProjectVersionHistoryFx";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorProjectVersionStatus } from "~/project-version/type/EditorProjectVersion";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useEditorVersionCommitController {
	export interface Output {
		readonly body: string;
		readonly canCommit: boolean;
		readonly commit: () => void;
		readonly error?: string;
		readonly pending: boolean;
		readonly projectId: string;
		readonly setBody: (value: string) => void;
		readonly setSubject: (value: string) => void;
		readonly setTag: (value: string) => void;
		readonly status?: EditorProjectVersionStatus;
		readonly subject: string;
		readonly tag: string;
	}
}

export const useEditorVersionCommitController = (): useEditorVersionCommitController.Output => {
	const project = useEditorProject();
	const router = useRouter();
	const { returnTo } = useSearch({
		from: "/editor/$projectId/versions/commit",
	});
	const [body, setBody] = useState("");
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const [status, setStatus] = useState<EditorProjectVersionStatus>();
	const [subject, setSubject] = useState("");
	const [tag, setTag] = useState("");

	const loadStatus = useCallback(() => {
		let mounted = true;
		void RendererRuntime.runPromise(readEditorProjectVersionHistoryFx(project.projectId))
			.then((history) => {
				if (mounted) setStatus(history.status);
			})
			.catch((cause) => {
				if (mounted) setError(message(cause));
			});
		return () => {
			mounted = false;
		};
	}, [
		project.projectId,
	]);
	useEffect(() => {
		let disposeLoad = loadStatus();
		const unsubscribe = window.arkini.editor.onProjectChanged((projectId) => {
			if (projectId !== project.projectId) return;
			disposeLoad();
			disposeLoad = loadStatus();
		});
		return () => {
			disposeLoad();
			unsubscribe();
		};
	}, [
		loadStatus,
		project.projectId,
	]);

	const canCommit =
		status?.canCommit === true && subject.trim().length > 0 && subject.trim().length <= 120;
	const commit = useCallback(() => {
		if (!canCommit || status === undefined || pending) return;
		setPending(true);
		setError(undefined);
		void RendererRuntime.runPromise(
			Effect.flatMap(EditorProjectRepository, (repository) =>
				repository.createVersionFx({
					...(body.trim() === ""
						? {}
						: {
								body,
							}),
					expectedFingerprint: status.currentFingerprint,
					projectId: project.projectId,
					subject,
					...(tag.trim() === ""
						? {}
						: {
								tag,
							}),
				}),
			),
		)
			.then(async () => {
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
				setError(message(cause));
				setPending(false);
			});
	}, [
		body,
		canCommit,
		pending,
		project.projectId,
		returnTo,
		router,
		status,
		subject,
		tag,
	]);

	return useMemo(
		() => ({
			body,
			canCommit,
			commit,
			...(error === undefined
				? {}
				: {
						error,
					}),
			pending,
			projectId: project.projectId,
			setBody,
			setSubject,
			setTag,
			...(status === undefined
				? {}
				: {
						status,
					}),
			subject,
			tag,
		}),
		[
			body,
			canCommit,
			commit,
			error,
			pending,
			project.projectId,
			status,
			subject,
			tag,
		],
	);
};
