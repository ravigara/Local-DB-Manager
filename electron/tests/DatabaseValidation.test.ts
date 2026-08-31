import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDatabaseStatus,
  toCsvCell,
  validateDatabaseName,
  validateEnvironmentName,
  validatePort,
  validateTableName
} from "../utils/DatabaseValidation";

test("validates and normalizes environment input", () => {
  assert.equal(validateEnvironmentName("  Payments API  "), "Payments API");
  assert.equal(validateDatabaseName("  payments_dev  "), "payments_dev");
  assert.equal(validatePort(3307), 3307);
  assert.equal(validateTableName("order_items"), "order_items");
});

test("rejects invalid environment input", () => {
  assert.throws(
    () => validateEnvironmentName("   "),
    /Database name is required/
  );
  assert.throws(
    () => validateDatabaseName("payments-dev"),
    /only letters, numbers, and underscores/
  );
  assert.throws(() => validatePort(80), /between 1024 and 65535/);
  assert.throws(() => validatePort(65536), /between 1024 and 65535/);
  assert.throws(() => validateTableName("orders`"), /Invalid table name/);
});

test("normalizes Docker statuses to application statuses", () => {
  assert.equal(normalizeDatabaseStatus("healthy"), "running");
  assert.equal(normalizeDatabaseStatus("running"), "running");
  assert.equal(normalizeDatabaseStatus("starting"), "starting");
  assert.equal(normalizeDatabaseStatus("stopping"), "stopping");
  assert.equal(normalizeDatabaseStatus("exited"), "stopped");
  assert.equal(normalizeDatabaseStatus("unhealthy"), "error");
  assert.equal(normalizeDatabaseStatus("not-found"), "not-found");
  assert.equal(normalizeDatabaseStatus("paused"), "unknown");
});

test("escapes CSV cells according to RFC 4180 rules", () => {
  assert.equal(toCsvCell("plain"), "plain");
  assert.equal(toCsvCell(null), "");
  assert.equal(toCsvCell("a,b"), '"a,b"');
  assert.equal(toCsvCell('say "hello"'), '"say ""hello"""');
  assert.equal(toCsvCell("line 1\nline 2"), '"line 1\nline 2"');
});
