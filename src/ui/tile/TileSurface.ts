/** One presentation surface that may own draggable tiles and concrete drop slots. */
export type TileSurface =
	| {
			readonly id: string;
			readonly kind: "board";
			readonly space: number;
	  }
	| {
			readonly id: string;
			readonly kind: "inventory";
	  }
	| {
			readonly id: string;
			readonly kind: "toolbar";
	  };
