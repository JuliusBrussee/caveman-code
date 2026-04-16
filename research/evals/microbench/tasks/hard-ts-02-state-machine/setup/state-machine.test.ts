import { StateMachine } from "./state-machine";

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  test("starts in Idle state", () => {
    expect(sm.currentState).toBe("Idle");
  });

  test("transitions Idle -> Loading on Fetch", () => {
    sm.send("Fetch");
    expect(sm.currentState).toBe("Loading");
  });

  test("transitions Loading -> Success on Resolve", () => {
    sm.send("Fetch");
    sm.send("Resolve");
    expect(sm.currentState).toBe("Success");
  });

  test("transitions Loading -> Error on Reject", () => {
    sm.send("Fetch");
    sm.send("Reject");
    expect(sm.currentState).toBe("Error");
  });

  test("transitions Error -> Idle on Reset", () => {
    sm.send("Fetch");
    sm.send("Reject");
    sm.send("Reset");
    expect(sm.currentState).toBe("Idle");
  });

  test("transitions Success -> Idle on Reset", () => {
    sm.send("Fetch");
    sm.send("Resolve");
    sm.send("Reset");
    expect(sm.currentState).toBe("Idle");
  });

  test("throws on invalid transition Idle -> Resolve", () => {
    expect(() => sm.send("Resolve")).toThrow();
  });

  test("throws on invalid transition Loading -> Reset", () => {
    sm.send("Fetch");
    expect(() => sm.send("Reset")).toThrow();
  });

  test("throws on invalid transition Success -> Fetch", () => {
    sm.send("Fetch");
    sm.send("Resolve");
    expect(() => sm.send("Fetch")).toThrow();
  });

  test("full cycle: Idle -> Loading -> Error -> Idle -> Loading -> Success -> Idle", () => {
    sm.send("Fetch");
    sm.send("Reject");
    sm.send("Reset");
    expect(sm.currentState).toBe("Idle");
    sm.send("Fetch");
    sm.send("Resolve");
    sm.send("Reset");
    expect(sm.currentState).toBe("Idle");
  });
});
