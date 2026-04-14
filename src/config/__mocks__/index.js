module.exports = {
  configService: {
    get: jest.fn(() => ({})),
    update: jest.fn().mockResolvedValue(),
    reload: jest.fn().mockResolvedValue(),
    init: jest.fn().mockResolvedValue(),
  },
  get: jest.fn(() => ({})),
  update: jest.fn().mockResolvedValue(),
  reload: jest.fn().mockResolvedValue(),
  init: jest.fn().mockResolvedValue(),
};
