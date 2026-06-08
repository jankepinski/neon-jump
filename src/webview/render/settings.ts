export interface RenderSettings {
  bloomEnabled: boolean;
  bloomIterations: number;
  bloomThreshold: number;
  bloomStrength: number;
  exposure: number;
  vignette: number;
  scanline: number;
  aberration: number;
  curvature: number;
  maxDpr: number;
}

export const settings: RenderSettings = {
  bloomEnabled: true,
  bloomIterations: 5,
  bloomThreshold: 0.66,
  bloomStrength: 1.33,
  exposure: 1.48,
  vignette: 0.65,
  scanline: 0.5,
  aberration: 0.001,
  curvature: 0.03,
  maxDpr: 2
};
