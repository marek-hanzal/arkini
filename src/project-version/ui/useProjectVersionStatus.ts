import { useEffect, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readProjectVersionHistoryFx } from "~/project-version/fx/readProjectVersionHistoryFx";
import type { ProjectVersionStatus } from "~/project-version/type/ProjectVersion";

export type ProjectVersionStatusState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly status: "ready";
			readonly versionStatus: ProjectVersionStatus;
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

const messageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Reads the current repository-owned version status for a compact project projection. */
export const useProjectVersionStatus = (projectId: string): ProjectVersionStatusState => {
	const [state, setStateFn] = useState<ProjectVersionStatusState>({
		status: "loading",
	});
	useEffect(() => {
		let active = true;
		let requestId = 0;
		const loadFn = () => {
			const currentRequestId = ++requestId;
			setStateFn({
				status: "loading",
			});
			void RendererRuntime.runPromise(readProjectVersionHistoryFx(projectId))
				.then(({ status }) => {
					if (!active || requestId !== currentRequestId) return;
					setStateFn({
						status: "ready",
						versionStatus: status,
					});
				})
				.catch((cause) => {
					if (!active || requestId !== currentRequestId) return;
					setStateFn({
						message: messageFn(cause),
						status: "error",
					});
				});
		};
		loadFn();
		const unsubscribeFn = window.arkini.editor.onProjectChangedFn((changedProjectId) => {
			if (changedProjectId === projectId) loadFn();
		});
		return () => {
			active = false;
			unsubscribeFn();
		};
	}, [
		projectId,
	]);
	return state;
};
