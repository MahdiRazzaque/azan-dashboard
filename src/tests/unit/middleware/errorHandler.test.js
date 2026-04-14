const errorHandler = require("@middleware/errorHandler");

describe("ErrorHandler Middleware", () => {
  let req;
  let res;
  let next;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    req = {
      method: "GET",
      path: "/test",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    console.error.mockRestore();
  });

  it("should use 500 status and default message if none provided", () => {
    const err = {};
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal Server Error",
    });
  });

  it("should use err.status if provided", () => {
    const err = { status: 400, message: "Bad Request" };
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Bad Request",
    });
  });

  it("should use err.response.status if provided", () => {
    const err = { response: { status: 404 }, message: "Not Found" };
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Not Found",
    });
  });

  it("should log error if NODE_ENV is not test", () => {
    process.env.NODE_ENV = "production";
    const err = { message: "Production error" };
    errorHandler(err, req, res, next);
    expect(console.error).toHaveBeenCalled();
  });

  it("should log stack trace if NODE_ENV is development", () => {
    process.env.NODE_ENV = "development";
    const err = { message: "Dev error", stack: "stack trace" };
    errorHandler(err, req, res, next);
    expect(console.error).toHaveBeenCalledWith("stack trace");
  });

  it("should not log if NODE_ENV is test", () => {
    process.env.NODE_ENV = "test";
    const err = { message: "Test error" };
    errorHandler(err, req, res, next);
    expect(console.error).not.toHaveBeenCalled();
  });
});
