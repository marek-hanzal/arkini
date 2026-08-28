import { RefreshCw } from "lucide-react";
import { match } from "ts-pattern";

import type { EditorMcpOverview } from "~/bridge/editor-mcp/readEditorMcpOverviewFx";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import type { EditorMcpController } from "~/ui/editor-mcp/useEditorMcpController";
import {
	EditorMcpCopyButton,
	EditorMcpCopyableUrl,
	EditorMcpStatus as Status,
	type EditorMcpStatusTone,
	editorMcpInputClassName,
} from "./EditorMcpStatus";

const readLocalStatus = (
	status: EditorMcpOverview["local"] | undefined,
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
	status: EditorMcpOverview["remote"] | undefined,
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
	const localUrl =
		local?.type === "ready" ? `http://127.0.0.1:${local.port}/editor/mcp` : undefined;
	const remotePasswordCopyKey = `remote-password:${controller.remotePassword ?? ""}`;
	return (
		<div className="grid gap-4">
			{controller.remotePassword === undefined ? null : (
				<div
					className="grid gap-3 rounded-xl border border-accent bg-accent/10 p-5"
					data-ui="EditorMcpRemotePassword"
				>
					<h2 className="font-semibold">Remote password</h2>
					<p className="text-sm text-muted">
						Enter this password on the Arkini authorization page when a Remote MCP
						client connects. Generating a new password stops Remote MCP and disconnects
						existing clients.
					</p>
					<div className="flex min-w-0 items-stretch gap-2">
						<div className="relative min-w-0 flex-1">
							<input
								readOnly
								value={controller.remotePassword}
								className={`${editorMcpInputClassName} h-full min-w-0 pr-10`}
							/>
							<div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
								<EditorMcpCopyButton
									copied={controller.copied === remotePasswordCopyKey}
									onCopy={() =>
										void controller.copy(
											remotePasswordCopyKey,
											controller.remotePassword ?? "",
										)
									}
									title="Copy password"
								/>
							</div>
						</div>
						<DangerButton
							className="shrink-0 gap-2"
							disabled={controller.pending}
							onClick={controller.resetAuth}
						>
							<RefreshCw className="size-4" />
							Refresh
						</DangerButton>
					</div>
				</div>
			)}
			<div className="ak-list-row grid gap-5 rounded-xl border border-line p-5">
				<div className="grid gap-3">
					<div>
						<h2 className="font-semibold">Local MCP</h2>
						<p className="mt-1 text-sm text-muted">
							Open only on loopback for Codex and other local tools.
						</p>
					</div>
					{local?.type === "ready" ? (
						<Button
							disabled={controller.pending}
							onClick={controller.stopLocal}
						>
							Stop Local MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={controller.pending}
							onClick={controller.startLocal}
						>
							Start Local MCP
						</PrimaryButton>
					)}
					{localUrl === undefined ? (
						<Status
							message={localStatus.message}
							tone={localStatus.tone}
						/>
					) : (
						<EditorMcpCopyableUrl
							copied={controller.copied === "local-url"}
							label="Running at"
							onCopy={() => void controller.copy("local-url", localUrl)}
							url={localUrl}
						/>
					)}
				</div>
				<div className="grid gap-3 border-t border-line pt-5">
					<div>
						<h2 className="font-semibold">Remote MCP</h2>
						<p className="mt-1 text-sm text-muted">
							OAuth-protected public access through the configured ngrok tunnel.
						</p>
					</div>
					{remote?.type === "ready" ? (
						<Button
							disabled={controller.pending}
							onClick={controller.stopRemote}
						>
							Stop Remote MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={
								controller.pending || controller.overview?.ngrokDomain === undefined
							}
							onClick={controller.startRemote}
						>
							Start Remote MCP
						</PrimaryButton>
					)}
					{remote?.type === "ready" ? (
						<EditorMcpCopyableUrl
							copied={controller.copied === "remote-url"}
							label="Running at"
							onCopy={() => void controller.copy("remote-url", remote.url)}
							url={remote.url}
						/>
					) : (
						<Status
							message={remoteStatus.message}
							tone={remoteStatus.tone}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
