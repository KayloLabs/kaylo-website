// UI defense in depth for static hosting. HTTP frame-ancestors remains required.
export function isTopLevelWindow(value: Pick<Window, 'self' | 'top'> | null): boolean {
 try { return value !== null && value.self === value.top; }
 catch { return false; }
}
export function assertTopLevelInteraction(): void {
 // Node is used only by isolated transport tests; browser writes fail closed.
 if (typeof window !== 'undefined' && !isTopLevelWindow(window)) {
  throw new Error('Open Kaylo directly in a browser tab to continue.');
 }
}
