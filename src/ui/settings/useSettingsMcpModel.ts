import { useAtom } from "@effect/atom-react";
import { useEffect, useState } from "react";

import { SettingsMcpCommandAtom } from "~/ui/settings/SettingsMcpCommandAtom";

export const useSettingsMcpModel = () => {
	const [state, runCommand] = useAtom(SettingsMcpCommandAtom);
	const [draftPort, setDraftPort] = useState<string | undefined>(undefined);

	useEffect(() => {
		runCommand({
			action: "read",
		});
	}, [
		runCommand,
	]);

	const statePort = "port" in state ? state.port : undefined;
	const editorMcpPort = draftPort ?? statePort ?? "";
	const editorMcpPortStatus =
		draftPort !== undefined && draftPort !== statePort
			? ({
					kind: "idle",
				} as const)
			: state.kind === "uninitialized" || state.kind === "loading"
				? ({
						kind: "loading",
					} as const)
				: state.kind === "error"
					? ({
							kind: "error",
							message: state.message,
						} as const)
					: ({
							kind: state.kind,
						} as const);

	return {
		editorMcpPort,
		editorMcpPortStatus,
		checkEditorMcpPort: () => {
			runCommand({
				action: "check",
				rawPort: editorMcpPort,
			});
		},
		setEditorMcpPort: (value: string) => {
			setDraftPort(value);
		},
	};
};

export type SettingsMcpModel = ReturnType<typeof useSettingsMcpModel>;
