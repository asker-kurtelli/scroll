/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module '*?script' {
    const scriptPath: string;
    export default scriptPath;
}
