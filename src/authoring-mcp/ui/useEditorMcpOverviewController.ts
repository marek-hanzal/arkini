import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";
import type { EditorMcpConfigurationSchema } from "~electron/contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpOverviewSchema } from "~electron/contract/editor/EditorMcpOverviewSchema";

import { EditorMcpCommandAtom } from "~/authoring-mcp/atom/EditorMcpCommandAtom";

const parseEditorMcpOverviewFn = (candidate: unknown) =>
	EditorMcpOverviewSchema.safeParse(candidate);

export namespace useEditorMcpOverviewController {
	export interface Output {
		readonly commandError?: string;
		readonly configure: (configuration: EditorMcpConfigurationSchema.Type) => void;
		readonly overview?: EditorMcpOverviewSchema.Type;
		readonly pending: boolean;
		readonly resetAuth: () => void;
		readonly startLocal: () => void;
		readonly startRemote: () => void;
		readonly stopLocal: () => void;
		readonly stopRemote: () => void;
	}
}

/** Owns the single renderer subscription and command admission for the MCP overview. */
export const useEditorMcpOverviewController = (): useEditorMcpOverviewController.Output => {
	const [state, dispatch] = useAtom(EditorMcpCommandAtom);
	const overview = "overview" in state ? state.overview : undefined;

	useEffect(() => {
		dispatch({
			type: "read",
		});
		return window.arkini.editorMcp.onOverviewChanged((candidate) => {
			const parsed = parseEditorMcpOverviewFn(candidate);
			if (!parsed.success) return;
			dispatch({
				type: "synchronize",
				overview: parsed.data,
			});
		});
	}, [
		dispatch,
	]);

	const execute = (
		command: EditorMcpCommandAtom.Command & {
			readonly type: "execute";
		},
	) => {
		dispatch(command);
	};

	return {
		commandError: state.kind === "error" ? state.message : undefined,
		configure: (configuration) => {
			dispatch({
				type: "configure",
				configuration,
			});
		},
		overview,
		pending: state.kind === "loading" || state.kind === "pending",
		resetAuth: () =>
			execute({
				type: "execute",
				command: "reset-remote-auth",
			}),
		startLocal: () =>
			execute({
				type: "execute",
				command: "start-local",
			}),
		startRemote: () =>
			execute({
				type: "execute",
				command: "start-remote",
			}),
		stopLocal: () =>
			execute({
				type: "execute",
				command: "stop-local",
			}),
		stopRemote: () =>
			execute({
				type: "execute",
				command: "stop-remote",
			}),
	};
};
