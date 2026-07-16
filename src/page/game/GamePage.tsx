export function GamePage() {
	return (
		<section
			className="flex min-h-dvh items-center justify-center p-6"
			data-page="GamePage"
		>
			<div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
				<p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">
					Arkini
				</p>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
					Game shell is running
				</h1>
				<p className="mt-3 text-sm leading-6 text-slate-300">
					The game route and isolated application shell are ready for the next UI slice.
				</p>
			</div>
		</section>
	);
}
