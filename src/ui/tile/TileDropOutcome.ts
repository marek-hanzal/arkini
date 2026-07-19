/** Presentation settlement selected after a surface-specific drop adapter runs. */
export type TileDropOutcome =
	| {
			readonly kind: "accepted";
	  }
	| {
			readonly kind: "rejected";
	  }
	| {
			readonly kind: "ignored";
	  };
