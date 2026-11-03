import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHistory } from "../src/client/history.ts";

describe("wiki back/forward history", () => {
  it("goes back and forward through visited pages", () => {
    const history = createHistory();
    assert.equal(history.peekBack(), null);
    history.push("a");
    history.push("b");
    history.push("c");
    assert.equal(history.peekBack(), "b");
    history.moveBack();
    assert.equal(history.current(), "b");
    assert.equal(history.peekForward(), "c");
    history.moveForward();
    assert.equal(history.current(), "c");
    assert.equal(history.peekForward(), null);
  });

  it("drops forward entries when a new page is opened after going back", () => {
    const history = createHistory();
    history.push("a");
    history.push("b");
    history.moveBack();
    history.push("x");
    assert.equal(history.peekForward(), null);
    assert.equal(history.peekBack(), "a");
  });

  it("ignores opening the same page twice in a row", () => {
    const history = createHistory();
    history.push("a");
    history.push("a");
    assert.equal(history.peekBack(), null);
  });
});
