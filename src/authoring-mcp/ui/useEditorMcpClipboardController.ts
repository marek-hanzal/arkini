import { useState } from "react";

export namespace useEditorMcpClipboardController {
	export interface Output {
		readonly copied?: string;
		readonly copy: (key: string, value: string) => Promise<void>;
		readonly error?: string;
	}
}

/** Owns transient clipboard settlement for MCP credentials and endpoints. */
export const useEditorMcpClipboardController = (): useEditorMcpClipboardController.Output => {
	const [copied, setCopied] = useState<string>();
	const [error, setError] = useState<string>();

	return {
		copied,
		copy: async (key, value) => {
			setCopied(undefined);
			setError(undefined);
			try {
				await window.arkini.clipboard.writeText(value);
				setCopied(key);
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : String(cause));
			}
		},
		error,
	};
};
