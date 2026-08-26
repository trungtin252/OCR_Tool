import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import AppError from "../src/shared/errors/AppError.js";
import {
  getErrorMessage,
  getErrorStatusCode,
  toError,
} from "../src/shared/errors/errorUtils.js";
import { errorHandler } from "../src/shared/errors/error.middleware.js";

test("error helpers preserve legacy message and status fallback behavior", () => {
  assert.equal(
    getErrorMessage(new Error("known error"), "fallback"),
    "known error",
  );
  assert.equal(getErrorMessage("plain string", "fallback"), "fallback");
  assert.equal(getErrorStatusCode(new AppError(422, "invalid")), 422);
  assert.equal(getErrorStatusCode({ statusCode: 409 }), 409);
  assert.equal(getErrorStatusCode({ statusCode: 0 }), undefined);
  assert.equal(toError(new Error("known"), "fallback").message, "known");
  assert.equal(toError("plain string", "fallback").message, "fallback");
});

test("error middleware keeps response status precedence and body shape", () => {
  let sentStatus: number | undefined;
  let sentBody: unknown;
  const response = {
    headersSent: false,
    statusCode: 200,
    status(statusCode: number) {
      sentStatus = statusCode;
      return this;
    },
    json(body: unknown) {
      sentBody = body;
      return this;
    },
  } as unknown as Response;

  errorHandler(
    new AppError(422, "Unprocessable response"),
    {} as Request,
    response,
    (() => undefined) as NextFunction,
  );

  assert.equal(sentStatus, 422);
  assert.deepEqual(sentBody, {
    success: false,
    message: "Unprocessable response",
  });
});
