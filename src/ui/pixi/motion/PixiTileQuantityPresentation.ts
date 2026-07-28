export type PixiTileQuantityPresentation =
	| {
			readonly kind: "exact";
			readonly quantity: number;
	  }
	| {
			readonly kind: "subtract";
			readonly quantity: number;
	  };
