const ProviderFactory = require("@providers/ProviderFactory");
const AladhanProvider = require("@providers/AladhanProvider");
const MyMasjidProvider = require("@providers/MyMasjidProvider");

describe("Provider Discovery Metadata", () => {
  it("AladhanProvider should return correct metadata", () => {
    const metadata = AladhanProvider.getMetadata();
    expect(metadata.id).toBe("aladhan");
    expect(metadata.requiresCoordinates).toBe(true);
    expect(Array.isArray(metadata.parameters)).toBe(true);
  });

  it("MyMasjidProvider should return correct metadata", () => {
    const metadata = MyMasjidProvider.getMetadata();
    expect(metadata.id).toBe("mymasjid");
    expect(metadata.requiresCoordinates).toBe(false);
    expect(metadata.parameters).toContainEqual(
      expect.objectContaining({ key: "masjidId" }),
    );
  });

  it("ProviderFactory should return all registered providers", () => {
    const providers = ProviderFactory.getRegisteredProviders();
    expect(providers.length).toBe(2);
    expect(providers.some((p) => p.id === "aladhan")).toBe(true);
    expect(providers.some((p) => p.id === "mymasjid")).toBe(true);
  });
});
