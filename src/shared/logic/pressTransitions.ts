export const pressTransitions = () =>
	[
		{
			guard: "isNearbyDouble",
			target: "idle",
			actions: [
				"clearLastPress",
				"callDouble",
			],
		},
		{
			guard: "shouldDelaySingle",
			target: "singlePending",
			actions: "setLastPress",
		},
		{
			guard: "shouldCallSingleAndRemember",
			target: "idle",
			actions: [
				"setLastPress",
				"callSingle",
			],
		},
		{
			guard: "shouldRememberOnly",
			target: "idle",
			actions: "setLastPress",
		},
		{
			guard: "hasSingle",
			target: "idle",
			actions: "callSingle",
		},
	] as const;
