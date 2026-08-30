import assert from "node:assert/strict";
import test from "node:test";
import { nextStreamingText } from "./streaming.ts";

test("streaming text advances in bounded increments and recovers from replacement", () => {
  assert.equal(nextStreamingText("", "一二三四五六"), "一二");
  assert.equal(nextStreamingText("一二", "一二三四五六"), "一二三四");
  assert.equal(nextStreamingText("旧内容", "新内容"), "新内容");
});
