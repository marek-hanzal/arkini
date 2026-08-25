import { match } from "ts-pattern";

import type { EditorMcpRemoteStatusSchema } from "../../../electron/contract/editor/EditorMcpRemoteStatusSchema";
import type { EditorMcpStatus } from "../../../electron/contract/editor/EditorMcpStatusSchema";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import {
	EditorMcpStatus as Status,
	type EditorMcpStatusTone,
	editorMcpInputClassName,
} from "./EditorMcpStatus";

const readLocalStatus = (
	status: EditorMcpStatus | undefined,
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ port }) => ({
				message: `Running on port ${port}.`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

const readRemoteStatus = (
	status: EditorMcpRemoteStatusSchema.Type | undefined,
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ url }) => ({
				message: `Running at ${url}`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "starting",
			},
			() => ({
				message: "Starting tunnel and checking OAuth…",
				tone: "muted" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

export const EditorMcpServerSettings = ({
	controller,
}: {
	readonly controller: EditorMcpController;
}) => {
	const local = controller.overview?.local;
	const remote = controller.overview?.remote;
	const localStatus = readLocalStatus(local);
	const remoteStatus = readRemoteStatus(remote);
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<div className="ak-list-row grid content-start gap-4 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">Local MCP</h2>
					<p className="mt-1 text-sm text-muted">
						Open only on loopback for Codex and other local tools.
					</p>
				</div>
				<Status
					message={localStatus.message}
					tone={localStatus.tone}
				/>
				{local?.type === "ready" ? (
					<Button
						disabled={controller.pending}
						onClick={controller.stopLocal}
					>
						Stop MCP
					</Button>
				) : (
					<PrimaryButton
						disabled={controller.pending}
						onClick={controller.startLocal}
					>
						Start MCP
					</PrimaryButton>
				)}
			</div>
			<div className="ak-list-row grid content-start gap-4 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">Remote MCP</h2>
					<p className="mt-1 text-sm text-muted">
						OAuth-protected public access through the configured ngrok tunnel.
					</p>
				</div>
				<Status
					message={remoteStatus.message}
					tone={remoteStatus.tone}
				/>
				{remote?.type === "ready" ? (
					<>
						<Button onClick={() => void controller.copy("url", remote.url)}>
							{controller.copied === "url" ? "Copied" : "Copy URL"}
						</Button>
						<Button
							disabled={controller.pending}
							onClick={controller.stopRemote}
						>
							Stop Remote MCP
						</Button>
					</>
				) : (
					<PrimaryButton
						disabled={controller.pending || !controller.overview?.ngrokConfigured}
						onClick={controller.startRemote}
					>
						Start Remote MCP
					</PrimaryButton>
				)}
				<DangerButton
					disabled={controller.pending}
					onClick={controller.resetAuth}
				>
					Reset auth
				</DangerButton>
			</div>
			{controller.secret === undefined ? null : (
				<div
					className="grid gap-3 rounded-xl border border-accent bg-accent/10 p-5 lg:col-span-2"
					data-ui="EditorMcpGeneratedSecret"
				>
					<h2 className="font-semibold">New Remote password</h2>
					<p className="text-sm text-muted">
						Copy it now and enter it on the Arkini authorization page when a Remote MCP
						client connects.
					</p>
					<input
						readOnly
						value={controller.secret}
						className={editorMcpInputClassName}
					/>
					<div className="flex gap-2">
						<PrimaryButton
							onClick={() => void controller.copy("secret", controller.secret ?? "")}
						>
							{controller.copied === "secret" ? "Copied" : "Copy password"}
						</PrimaryButton>
						<Button onClick={controller.dismissSecret}>Done</Button>
					</div>
				</div>
			)}
		</div>
	);
};
