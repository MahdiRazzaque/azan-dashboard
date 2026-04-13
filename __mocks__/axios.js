const createInstance = () => ({
    get: jest.fn(),
    post: jest.fn()
});

const axios = {
    default: {
        get: jest.fn(),
        post: jest.fn(),
        create: jest.fn(() => createInstance())
    },
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => createInstance())
};

module.exports = axios;
