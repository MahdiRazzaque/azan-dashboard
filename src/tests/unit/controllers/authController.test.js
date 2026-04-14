const authController = require("@controllers/authController");
const envManager = require("@utils/envManager");
const authUtils = require("@utils/passwordUtils");
const jwt = require("jsonwebtoken");
const configService = require("@config");

jest.mock("@utils/envManager");
jest.mock("@utils/passwordUtils");
jest.mock("jsonwebtoken");
jest.mock("@config", () => ({
  get: jest.fn(() => ({
    security: { tokenVersion: 1 },
  })),
  update: jest.fn().mockResolvedValue(),
}));

describe("authController Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, cookies: {} };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("setup", () => {
    it("should return 403 if already configured", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      process.env.ADMIN_PASSWORD = "set";
      await authController.setup(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      process.env.ADMIN_PASSWORD = originalPass;
    });

    it("should return 400 if password is missing", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;
      req.body.password = undefined; // Branch: !password
      await authController.setup(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Password too short" }),
      );
      process.env.ADMIN_PASSWORD = originalPass;
    });

    it("should handle setup error and return 500", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;
      req.body.password = "validpass";
      authUtils.hashPassword.mockRejectedValue(new Error("DB Error"));

      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      await authController.setup(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      spy.mockRestore();
      process.env.ADMIN_PASSWORD = originalPass;
    });

    it("should generate JWT_SECRET if missing", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.ADMIN_PASSWORD;
      delete process.env.JWT_SECRET;
      req.body.password = "validpass";

      authUtils.hashPassword.mockResolvedValue("hash");
      envManager.generateSecret.mockReturnValue("newsecret");
      jwt.sign.mockReturnValue("token");

      await authController.setup(req, res);

      expect(envManager.generateSecret).toHaveBeenCalled();
      expect(envManager.setEnvValue).toHaveBeenCalledWith(
        "JWT_SECRET",
        "newsecret",
      );

      process.env.ADMIN_PASSWORD = originalPass;
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe("changePassword", () => {
    it("should return 400 if password missing", async () => {
      await authController.changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should successfully change password and increment token version", async () => {
      req.body.password = "newpass";
      authUtils.hashPassword.mockResolvedValue("hashed");
      await authController.changePassword(req, res);
      expect(envManager.setEnvValue).toHaveBeenCalledWith(
        "ADMIN_PASSWORD",
        "hashed",
      );
      expect(configService.update).toHaveBeenCalledWith({
        security: { tokenVersion: 2 },
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("should handle errors and return 500", async () => {
      req.body.password = "pass";
      authUtils.hashPassword.mockRejectedValue(new Error("Fail"));
      await authController.changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("login", () => {
    it("should return 500 if server not configured", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "SETUP_REQUIRED" }),
      );
      process.env.ADMIN_PASSWORD = originalPass;
    });

    it("should return 401 on invalid password", async () => {
      process.env.ADMIN_PASSWORD = "hash";
      req.body.password = "wrong";
      authUtils.verifyPassword.mockResolvedValue(false);
      await authController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should fail with 500 if JWT_SECRET missing", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      const originalSecret = process.env.JWT_SECRET;
      process.env.ADMIN_PASSWORD = "adminpass";
      delete process.env.JWT_SECRET;
      req.body.password = "adminpass";
      authUtils.verifyPassword.mockResolvedValue(true);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("JWT Secret"),
        }),
      );

      process.env.ADMIN_PASSWORD = originalPass;
      process.env.JWT_SECRET = originalSecret;
    });

    it("should login successfully with valid password and secret", async () => {
      const originalPass = process.env.ADMIN_PASSWORD;
      const originalSecret = process.env.JWT_SECRET;
      process.env.ADMIN_PASSWORD = "hash";
      process.env.JWT_SECRET = "secret";
      req.body.password = "correct";
      authUtils.verifyPassword.mockResolvedValue(true);
      jwt.sign.mockReturnValue("token");

      await authController.login(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(res.cookie).toHaveBeenCalled();

      process.env.ADMIN_PASSWORD = originalPass;
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe("logout", () => {
    it("should clear cookie and return 200", () => {
      res.clearCookie = jest.fn().mockReturnThis();
      authController.logout(req, res);
      expect(res.clearCookie).toHaveBeenCalledWith("auth_token");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe("checkStatus", () => {
    it("should return status of ADMIN_PASSWORD", () => {
      envManager.isConfigured.mockReturnValue(true);
      authController.checkStatus(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ configured: true }),
      );
    });
  });

  describe("checkAuth", () => {
    it("should return 200", () => {
      authController.checkAuth(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ authenticated: true }),
      );
    });
  });
});
