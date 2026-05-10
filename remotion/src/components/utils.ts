export const isPortrait = (w: number, h: number) => h > w;
export const isSquare = (w: number, h: number) => w === h;
export const scale = (w: number, h: number) => Math.min(w, h) / 1080;