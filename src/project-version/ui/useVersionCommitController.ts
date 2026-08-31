import { useRouter, useSearch } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readProjectVersionHistoryFx } from "~/project-version/fx/readProjectVersionHistoryFx";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ProjectVersionStatus } from "~/project-version/type/ProjectVersion";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useVersionCommitController {
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
		readonly status?: ProjectVersionStatus;
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
	const [body, setBody] = useState("");
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const [status, setStatus] = useState<ProjectVersionStatus>();
	const [subject, setSubject] = useState("");
	const [tag, setTag] = useState("");

	const loadStatus = useCallback(() => {
		let mounted = true;
		void RendererRuntime.runPromise(readProjectVersionHistoryFx(project.projectId))
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
	const commit = () => {
		if (!canCommit || status === undefined || pending) return;
		setPending(true);
		setError(undefined);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
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
	};

	return {
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
	};
};
