export type State = "Idle" | "Loading" | "Success" | "Error";

export type Event = "Fetch" | "Resolve" | "Reject" | "Reset";

export interface Transition {
  from: State;
  event: Event;
  to: State;
}

export const VALID_TRANSITIONS: Transition[] = [
  { from: "Idle", event: "Fetch", to: "Loading" },
  { from: "Loading", event: "Resolve", to: "Success" },
  { from: "Loading", event: "Reject", to: "Error" },
  { from: "Error", event: "Reset", to: "Idle" },
  { from: "Success", event: "Reset", to: "Idle" },
];
