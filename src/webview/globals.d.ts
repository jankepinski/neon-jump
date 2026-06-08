declare module '*.glsl' {
  const value: string;
  export default value;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T = unknown>(state: T): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

interface Window {
  __INITIAL_STATE__?: { highScore: number };
}
