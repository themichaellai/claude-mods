// The transcript text highlighted now, or null with nothing highlighted.
export type Selection = string | null;

declare module "claude-code" {
  interface PluginState {
    // `handled` is the text last quoted or dismissed, so the band hides until
    // a new highlight.
    "quote-selection": { selection: Selection; handled: Selection };
  }
}
