const { validateConfigSource } = require("@services/core/validationService");
const { ProviderFactory } = require("@providers");
const { DateTime } = require("luxon");

jest.mock("@providers");

describe("ValidationService Comprehensive", () => {
  const mockConfig = {
    location: { coordinates: { lat: 51.5, long: -0.1 } },
    sources: {
      primary: { type: "aladhan" },
      backup: { enabled: true, type: "mymasjid" },
    },
  };

  const mockAladhanClass = {
    getMetadata: jest.fn().mockReturnValue({
      id: "aladhan",
      label: "Aladhan",
      requiresCoordinates: true,
    }),
    getConfigSchema: jest.fn().mockReturnValue({ parse: jest.fn() }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ProviderFactory.getProviderClass.mockReturnValue(mockAladhanClass);
  });

  it("should return early if no primary source", async () => {
    await validateConfigSource({ sources: {} });
    expect(ProviderFactory.getProviderClass).not.toHaveBeenCalled();
  });

  it("should return early if no sources object", async () => {
    await validateConfigSource({});
    expect(ProviderFactory.getProviderClass).not.toHaveBeenCalled();
  });

  it("should skip disabled backup", async () => {
    const config = {
      location: { coordinates: { lat: 51.5, long: -0.1 } },
      sources: {
        primary: { type: "aladhan" },
        backup: { enabled: false, type: "mymasjid" },
      },
    };
    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});
    const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
    ProviderFactory.create.mockReturnValue(mockProvider);

    await validateConfigSource(config);
    expect(ProviderFactory.create).toHaveBeenCalledTimes(1);
  });

  it("should format ZodError with path", async () => {
    const zodError = new Error("Zod validation failed");
    zodError.name = "ZodError";
    zodError.issues = [{ path: ["field", "subfield"], message: "invalid" }];
    mockAladhanClass.getConfigSchema().parse.mockImplementation(() => {
      throw zodError;
    });

    await expect(validateConfigSource(mockConfig)).rejects.toThrow(
      "field.subfield: invalid",
    );
  });

  it("should handle non-ZodError in structural validation", async () => {
    mockAladhanClass.getConfigSchema().parse.mockImplementation(() => {
      throw new Error("Generic error");
    });

    await expect(validateConfigSource(mockConfig)).rejects.toThrow(
      "Validation Failed: Generic error",
    );
  });

  it("should throw if coordinates are missing for source that requires them", async () => {
    const configNoCoords = {
      sources: { primary: { type: "aladhan" } },
    };
    mockAladhanClass.getMetadata.mockReturnValue({
      id: "aladhan",
      label: "Aladhan",
      requiresCoordinates: true,
    });
    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});

    await expect(validateConfigSource(configNoCoords)).rejects.toThrow(
      "Coordinates (Latitude/Longitude) are required",
    );
  });

  it("should throw if coordinates are incomplete", async () => {
    const configIncompleteCoords = {
      location: { coordinates: { lat: 51.5 } },
      sources: { primary: { type: "aladhan" } },
    };
    mockAladhanClass.getMetadata.mockReturnValue({
      id: "aladhan",
      label: "Aladhan",
      requiresCoordinates: true,
    });
    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});

    await expect(validateConfigSource(configIncompleteCoords)).rejects.toThrow(
      "Coordinates (Latitude/Longitude) are required",
    );
  });

  it("should handle ProviderValidationError during connectivity test", async () => {
    const { ProviderValidationError } = require("@providers/errors");
    const pve = new ProviderValidationError(
      "API Error",
      { detail: "some detail" },
      true,
    );

    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});
    const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(pve) };
    ProviderFactory.create.mockReturnValue(mockProvider);

    try {
      await validateConfigSource(mockConfig);
    } catch (e) {
      expect(e.name).toBe("ProviderValidationError");
      expect(e.message).toBe("API Error");
      expect(e.validationDetails).toEqual({ detail: "some detail" });
      expect(e.userFriendly).toBe(true);
    }
  });

  it("should handle generic error during connectivity test", async () => {
    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});
    const mockProvider = {
      getAnnualTimes: jest.fn().mockRejectedValue(new Error("Network fail")),
    };
    ProviderFactory.create.mockReturnValue(mockProvider);

    await expect(validateConfigSource(mockConfig)).rejects.toThrow(
      "PRIMARY Source (Aladhan) Connection Failed: Network fail",
    );
  });

  it("should handle e.errors in ZodError", async () => {
    const zodError = new Error("Zod validation failed");
    zodError.name = "ZodError";
    zodError.errors = [{ path: [], message: "invalid" }];
    mockAladhanClass.getConfigSchema().parse.mockImplementation(() => {
      throw zodError;
    });

    await expect(validateConfigSource(mockConfig)).rejects.toThrow(
      "Validation Failed: invalid",
    );
  });

  it("should handle issues array being empty in ZodError", async () => {
    const zodError = new Error("Zod validation failed");
    zodError.name = "ZodError";
    // both issues and errors missing
    mockAladhanClass.getConfigSchema().parse.mockImplementation(() => {
      throw zodError;
    });

    await expect(validateConfigSource(mockConfig)).rejects.toThrow(
      "Validation Failed: ",
    );
  });

  it("should skip coordinates check if not required", async () => {
    mockAladhanClass.getMetadata.mockReturnValue({
      id: "aladhan",
      label: "Aladhan",
      requiresCoordinates: false,
    });
    mockAladhanClass.getConfigSchema().parse.mockReturnValue({});
    const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
    ProviderFactory.create.mockReturnValue(mockProvider);

    await validateConfigSource({
      sources: { primary: { type: "aladhan" } },
    });
    expect(ProviderFactory.create).toHaveBeenCalled();
  });
});
