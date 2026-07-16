import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useArkpacks } from "~/bridge/arkpack/useArkpacks";

/** Selects a bundled or locally imported game package without uploading it anywhere. */
export const ArkpackSelector = () => {
	const { state, importFile, remove } = useArkpacks();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [actionError, setActionError] = useState<unknown>();

	const upload = async (file: File | undefined) => {
		if (file === undefined) return;
		setBusy(true);
		setActionError(undefined);
		try {
			const arkpack = await importFile(file);
			await navigate({
				to: "/game/$packageId",
				params: {
					packageId: arkpack.packageId,
				},
			});
		} catch (error) {
			setActionError(error);
		} finally {
			setBusy(false);
			if (inputRef.current !== null) inputRef.current.value = "";
		}
	};

	return (
		<main
			className="size-full min-h-0 min-w-0 overflow-hidden bg-slate-950 p-[clamp(1rem,3vmin,2.5rem)] text-slate-100"
			data-ui="ArkpackSelector"
		>
			<div className="mx-auto grid h-full min-h-0 w-full max-w-3xl grid-rows-[auto_auto_minmax(0,1fr)] gap-[clamp(0.75rem,2.5vmin,2rem)]">
				<header>
					<p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
						Arkini launcher
					</p>
					<h1 className="mt-2 text-[clamp(1.5rem,4vmin,1.875rem)] font-semibold">
						Choose a game package
					</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
						Imported arkpacks stay on this device. Every package is validated before it
						can run.
					</p>
				</header>

				<section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
					<input
						ref={inputRef}
						type="file"
						accept=".arkpack,application/octet-stream"
						className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-amber-200"
						disabled={busy}
						onChange={(event) => void upload(event.currentTarget.files?.[0])}
					/>
					{busy ? (
						<p className="mt-3 text-sm text-amber-200">Validating package…</p>
					) : null}
					{actionError === undefined ? null : (
						<p className="mt-3 text-sm text-red-300">{String(actionError)}</p>
					)}
				</section>

				<section className="scrollbar-hidden grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain">
					{state.type === "loading" ? (
						<p className="text-sm text-slate-400">Reading local packages…</p>
					) : state.type === "failed" ? (
						<p className="text-sm text-red-300">
							Package catalog failed: {String(state.error)}
						</p>
					) : (
						state.arkpacks.map((arkpack) => (
							<article
								key={arkpack.packageId}
								className="flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:flex-row sm:items-center"
							>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<h2 className="truncate text-lg font-semibold">
											{arkpack.title}
										</h2>
										<span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-300">
											{arkpack.source === "built-in" ? "Official" : "Local"}
										</span>
									</div>
									<p className="mt-1 truncate text-xs text-slate-500">
										{arkpack.filename ??
											`${arkpack.gameId} · config ${arkpack.configVersion}`}
									</p>
								</div>
								<div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
									{arkpack.source === "imported" ? (
										<button
											type="button"
											className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-red-300/50 hover:text-red-200"
											onClick={() =>
												void remove(arkpack.packageId).catch(setActionError)
											}
										>
											Remove
										</button>
									) : null}
									<Link
										to="/game/$packageId"
										params={{
											packageId: arkpack.packageId,
										}}
										className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
									>
										Play
									</Link>
								</div>
							</article>
						))
					)}
				</section>
			</div>
		</main>
	);
};
