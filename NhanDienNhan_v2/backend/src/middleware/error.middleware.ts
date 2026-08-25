import type { Request, Response, NextFunction } from "express";
import { getErrorMessage, getErrorStatusCode } from "@backend/utils/errorUtils";

// Middleware xử lý lỗi tập trung
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : getErrorStatusCode(err) || 500;
  const message = getErrorMessage(err, "Internal Server Error");

  console.error(`Error: ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export { errorHandler };
