import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";
import type { EditorMcpConfigurationSchema } from "~/authoring-mcp/schema/EditorMcpConfigurationSchema";
import { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { EditorMcpCommandAtom } from "~/authoring-mcp/atom/EditorMcpCommandAtom";

const parseEditorMcpOverviewFn = (candidate: unknown) =>
	EditorMcpOverviewSchema.safeParse(candidate);

export namespace useEditorMcpOverviewController {
	export interface Output {
		readonly commandError?: string;
		readonly configureFn: (configuration: EditorMcpConfigurationSchema.Type) => void;
		readonly overview?: EditorMcpOverviewSchema.Type;
		readonly pending: boolean;
		readonly resetAuthFn: () => void;
		readonly startLocalFn: () => void;
		readonly startRemoteFn: () => void;
		readonly stopLocalFn: () => void;
		readonly stopRemoteFn: () => void;
	}
}

/** Owns the single renderer subscription and command admission for the MCP overview. */
export const useEditorMcpOverviewController = (): useEditorMcpOverviewController.Output => {
	const [state, dispatchFn] = useAtom(EditorMcpCommandAtom);
	const overview = "overview" in state ? state.overview : undefined;

	useEffect(() => {
		dispatchFn({
			type: "read",
		});
		return window.arkini.editorMcp.onOverviewChangedFn((candidate) => {
			const parsed = parseEditorMcpOverviewFn(candidate);
			if (!parsed.success) return;
			dispatchFn({
				type: "synchronize",
				overview: parsed.data,
			});
		});
	}, [
		dispatchFn,
	]);

	const executeFn = (
		command: EditorMcpCommandAtom.Command & {
			readonly type: "execute";
		},
	) => {
		dispatchFn(command);
	};

	return {
		commandError: state.kind === "error" ? state.message : undefined,
		configureFn: (configuration) => {
			dispatchFn({
				type: "configure",
				configuration,
			});
		},
		overview,
		pending: state.kind === "loading" || state.kind === "pending",
		resetAuthFn: () =>
			executeFn({
				type: "execute",
				command: "reset-remote-auth",
			}),
		startLocalFn: () =>
			executeFn({
				type: "execute",
				command: "start-local",
			}),
		startRemoteFn: () =>
			executeFn({
				type: "execute",
				command: "start-remote",
			}),
		stopLocalFn: () =>
			executeFn({
				type: "execute",
				command: "stop-local",
			}),
		stopRemoteFn: () =>
			executeFn({
				type: "execute",
				command: "stop-remote",
			}),
	};
};
