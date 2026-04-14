describe("Request Queues (Decentralised)", () => {
  let AladhanProvider, MyMasjidProvider, VoiceMonkeyOutput;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.isolateModules(() => {
      AladhanProvider = require("../../../providers/AladhanProvider");
      MyMasjidProvider = require("../../../providers/MyMasjidProvider");
      VoiceMonkeyOutput = require("../../../outputs/VoiceMonkeyOutput");
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const flushPromises = () =>
    new Promise(jest.requireActual("timers").setImmediate);

  it("Aladhan Provider Queue should allow burst of 10 then 5 req/s", async () => {
    const queue = AladhanProvider.queue;
    const spy = jest.fn().mockResolvedValue("ok");

    // Schedule 15 requests
    for (let i = 0; i < 15; i++) {
      queue.schedule(spy);
    }

    // Initial burst of 10
    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(10);

    // After 1s, we get 5 more
    await jest.advanceTimersByTimeAsync(1000);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(15);
  });

  it("MyMasjid Provider Queue should allow burst of 15 then 10 req/6s", async () => {
    const queue = MyMasjidProvider.queue;
    const spy = jest.fn().mockResolvedValue("ok");

    // Schedule 20 requests
    for (let i = 0; i < 20; i++) {
      queue.schedule(spy);
    }

    // Burst of 15
    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(15);

    // Next 5 come after 6 seconds
    await jest.advanceTimersByTimeAsync(6000);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(20);
  });

  it("VoiceMonkey Output Queue should allow burst of 5 then 10 req/min", async () => {
    const queue = VoiceMonkeyOutput.queue;
    const spy = jest.fn().mockResolvedValue("ok");

    // Schedule 10 requests
    for (let i = 0; i < 10; i++) {
      queue.schedule(spy);
    }

    // Burst of 5
    await jest.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(5);

    // Next 5 come after 60 seconds
    await jest.advanceTimersByTimeAsync(60000);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(10);
  });

  it("should log warning when Aladhan job fails", async () => {
    const queue = AladhanProvider.queue;
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const testError = new Error("Aladhan Test Error");

    const failureEvent = new Promise((resolve) => {
      queue.once("failed", () => resolve());
    });

    queue
      .schedule(async () => {
        throw testError;
      })
      .catch(() => {});

    await jest.advanceTimersByTimeAsync(100);
    await failureEvent;

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Queue:Aladhan]"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Aladhan Test Error"),
    );

    consoleSpy.mockRestore();
  });

  it("should log warning when VoiceMonkey job fails", async () => {
    const queue = VoiceMonkeyOutput.queue;
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const testError = new Error("VM Test Error");

    const failureEvent = new Promise((resolve) => {
      queue.once("failed", () => resolve());
    });

    queue
      .schedule(async () => {
        throw testError;
      })
      .catch(() => {});

    await jest.advanceTimersByTimeAsync(100);
    await failureEvent;

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Queue:VoiceMonkey]"),
    );

    consoleSpy.mockRestore();
  });
});
