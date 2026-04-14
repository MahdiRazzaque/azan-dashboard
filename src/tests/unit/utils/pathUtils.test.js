const path = require("path");

const { isWithinRoot } = require("@utils/pathUtils");

describe("pathUtils.isWithinRoot", () => {
  const root = path.resolve(__dirname, "../../../../public/audio");

  it("returns true for files inside the root", () => {
    expect(isWithinRoot(root, path.join(root, "custom/test.mp3"))).toBe(true);
  });

  it("returns false for traversal outside the root", () => {
    expect(isWithinRoot(root, path.resolve(root, "../outside.mp3"))).toBe(
      false,
    );
  });

  it("returns false for sibling prefix directories", () => {
    expect(
      isWithinRoot(root, path.resolve(root, "../audio-evil/test.mp3")),
    ).toBe(false);
  });
});
