// The transcript text highlighted now, or null with nothing highlighted.
export type Selection = string | null;

// The id of the transcript row that holds the highlight, or null when the
// highlight spans several rows or lies outside the drawn transcript.
export type SelectionRow = string | null;

declare module "claude-code" {
  interface PluginState {
    // `handled` is the text last quoted or dismissed, so the buttons hide
    // until a new highlight.
    "quote-selection": {
      selection: Selection;
      selectionRow: SelectionRow;
      handled: Selection;
    };
  }
}
