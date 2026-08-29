import { describe, expect, it } from "vitest";

import type { readGameAudioCuesFn } from "~/ui/audio/fn/readGameAudioCuesFn";
import { readGameAudioTonePlanFn } from "~/ui/audio/fn/readGameAudioTonePlanFn";

const cues = {
	"space-change": {
		kind: "space-change",
		strength: 1,
	},
	"job-start": {
		kind: "job-start",
		strength: 1,
	},
	"job-complete": {
		kind: "job-complete",
		strength: 2,
	},
	merge: {
		kind: "merge",
		strength: 2,
	},
	expire: {
		kind: "expire",
		strength: 1,
	},
	spawn: {
		kind: "spawn",
		strength: 1,
	},
	place: {
		kind: "place",
		strength: 1,
	},
	stack: {
		kind: "stack",
		strength: 1,
	},
	split: {
		kind: "split",
		strength: 1,
	},
	consume: {
		kind: "consume",
		strength: 1,
	},
	store: {
		kind: "store",
		strength: 1,
	},
	charge: {
		kind: "charge",
		strength: 1,
	},
	deplete: {
		kind: "deplete",
		strength: 2,
	},
	remove: {
		kind: "remove",
		strength: 1,
	},
} satisfies Record<readGameAudioCuesFn.Kind, readGameAudioCuesFn.Result>;

describe("readGameAudioTonePlanFn", () => {
	it("defines bounded deterministic voices for every semantic cue", () => {
		for (const cue of Object.values(cues)) {
			const tones = readGameAudioTonePlanFn(cue);
			expect(tones.length).toBeGreaterThan(0);
			for (const tone of tones) {
				expect(tone.startFrequencyHz).toBeGreaterThan(0);
				expect(tone.endFrequencyHz).toBeGreaterThan(0);
				expect(tone.durationSeconds).toBeGreaterThan(0);
				expect(tone.offsetSeconds).toBeGreaterThanOrEqual(0);
				expect(tone.gain).toBeGreaterThan(0);
				expect(tone.gain).toBeLessThan(0.2);
			}
		}
	});

	it("uses a two-voice completion signature without random variation", () => {
		expect(readGameAudioTonePlanFn(cues["job-complete"])).toEqual(
			readGameAudioTonePlanFn(cues["job-complete"]),
		);
		expect(readGameAudioTonePlanFn(cues["job-complete"])).toHaveLength(2);
	});
});
