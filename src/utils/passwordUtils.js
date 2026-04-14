const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

/**
 * Hashes a plain text password using a random salt and the scrypt algorithm.
 *
 * @param {string} password - The plain text password to hash.
 * @returns {Promise<string>} A promise that resolves to a string containing the salt and hash, separated by a colon.
 */
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
};

/**
 * Verifies a plain text password against a stored salt-and-hash string.
 * Strictly expects 'salt:hash' format. Plain text passwords are no longer supported.
 *
 * @param {string} password - The plain text password to verify.
 * @param {string} storedHash - The stored hash string (salt:hash).
 * @returns {Promise<boolean>} A promise that resolves to true if the password is valid, otherwise false.
 */
const verifyPassword = async (password, storedHash) => {
  if (!storedHash || !storedHash.includes(":")) return false;

  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const verifyHash = await scrypt(password, salt, 64);
  return originalHash === verifyHash.toString("hex");
};

module.exports = { hashPassword, verifyPassword };
