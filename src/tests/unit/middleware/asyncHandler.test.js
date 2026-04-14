const asyncHandler = require("@middleware/asyncHandler");

describe("asyncHandler Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  it("should call the wrapped function", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const wrapped = asyncHandler(fn);

    wrapped(req, res, next);

    expect(fn).toHaveBeenCalled();
  });

  it("should catch errors and call next", async () => {
    const error = new Error("Test Error");
    const fn = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(fn);

    // Use Promise.resolve because wrapped is sync but calls async fn
    wrapped(req, res, next);

    // Promise.resolve is async, so we need to wait a tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalledWith(error);
  });
});
