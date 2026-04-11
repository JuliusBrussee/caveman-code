# Kit: Interaction Model
**Domain:** interaction-model
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: Keyboard-first control model
Primary workflows must be optimized for keyboard use and must feel native to terminal operation. Interaction model must reward fluency and reduce interruption.

**Acceptance Criteria:**
- AC-1: Core actions in primary workflows are invocable without leaving keyboard.
- AC-2: Frequently used actions expose discoverable shortcuts or command triggers visible in product.
- AC-3: Keyboard interaction patterns are consistent across screens for confirm, cancel, navigate, and focus-change actions.

### R-002: Composed command and conversation flow
Product must unify command execution and conversational interaction into one coherent experience instead of presenting them as disconnected modes. Users must understand when they are issuing instruction, inspecting state, or acting on system output.

**Acceptance Criteria:**
- AC-1: Input surface communicates whether user is entering freeform prompt, command-like action, or contextual follow-up.
- AC-2: System responses that create actionable next steps present those actions adjacent to relevant output.
- AC-3: User can continue interaction from recent output without re-navigating to another dedicated mode or screen.

### R-003: Interruptibility and control confidence
Users must feel in control of long-running or high-impact actions. System must make it clear when work can be paused, canceled, retried, or resumed.

**Acceptance Criteria:**
- AC-1: Long-running actions expose visible in-session control affordances for stop, cancel, or equivalent interruption.
- AC-2: When an action is interrupted or fails, interface reports resulting state in a way that makes next action clear.
- AC-3: Retrying or resuming from recent failure does not require reconstructing missing context from outside current session view.

## Out of Scope
- Underlying agent planning logic
- Non-keyboard accessibility features beyond terminal-readable behavior
- External editor integrations or shell plugin features
