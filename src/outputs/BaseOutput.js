const normalizeSource = require('@utils/normalizeSource');
const { isWithinRoot } = require('@utils/pathUtils');
const fs = require('fs').promises;
const path = require('path');

const PROJECT_PUBLIC_ROOT = path.join(__dirname, '../../public/audio');
const SRC_PUBLIC_ROOT = path.join(__dirname, '../public/audio');

/**
 * Abstract base class defining the contract for automation output strategies.
 * All output integrations must inherit from this class.
 *
 * Subclasses MUST implement:
 *   - static getMetadata() — returns { id, label, supportedSourceTypes, params, ... }
 *   - _executeFromFile(payload, metadata, signal) and/or _executeFromUrl(payload, metadata, signal)
 *
 * The execute() method is a Template Method: it normalizes the source, validates it
 * against supportedSourceTypes, checks sidecar compatibility for file sources,
 * then dispatches to the appropriate hook.
 */
class BaseOutput {
    /**
     * Template Method: normalizes source, validates against supportedSourceTypes,
     * checks sidecar compatibility for file sources, then dispatches to
     * _executeFromFile or _executeFromUrl.
     * Subclasses MUST NOT override this — implement the hooks instead.
     * @param {Object} payload - The event payload (prayer times, event type, source, etc).
     * @param {Object} metadata - Execution metadata (isTest, etc).
     * @param {AbortSignal} [signal] - Optional signal to abort the execution.
     * @returns {Promise<void>}
     */
    async execute(payload, metadata, signal) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('BaseOutput.execute() requires payload to be a non-null object');
        }
        if (payload.source == null) {
            throw new Error('BaseOutput.execute() requires payload.source');
        }
        const normalized = normalizeSource(payload.source);
        const meta = this.constructor.getMetadata();
        const supported = meta.supportedSourceTypes || [];

        if (!supported.includes(normalized.type)) {
            throw new Error(`Source type "${normalized.type}" is not supported by ${meta.label}`);
        }

        const dispatchPayload = { ...payload, source: normalized };

        if (normalized.type === 'file') {
            try {
                await fs.access(normalized.filePath);
            } catch {
                throw new Error(`Audio file not found: ${path.basename(normalized.filePath)}`);
            }
            const isCompatible = await this._checkSidecarCompatibility(normalized.filePath);
            if (isCompatible === false) return;
            return this._executeFromFile(dispatchPayload, metadata, signal);
        }
        return this._executeFromUrl(dispatchPayload, metadata, signal);
    }

    /**
     * Checks the sidecar JSON metadata for compatibility with this output strategy.
     * Uses the output's metadata id to look up the correct compatibility entry.
     * Validates that the sidecar path resolves within the expected root
     * to prevent path traversal.
     *
     * @param {string} filePath - Absolute path to the audio file.
     * @returns {Promise<boolean|undefined>} false if incompatible, undefined otherwise.
     * @private
     */
    async _checkSidecarCompatibility(filePath) {
        if (!filePath) return undefined;
        if (!isWithinRoot(PROJECT_PUBLIC_ROOT, filePath)) return undefined;

        const meta = this.constructor.getMetadata();
        const relativePath = path.relative(PROJECT_PUBLIC_ROOT, filePath);
        const metaPath = path.resolve(SRC_PUBLIC_ROOT, relativePath + '.json');

        // Path traversal protection: sidecar must resolve within src/public/audio
        if (!isWithinRoot(SRC_PUBLIC_ROOT, metaPath)) return undefined;

        try {
            await fs.access(metaPath);
            const metaContent = await fs.readFile(metaPath, 'utf8');
            const sidecar = JSON.parse(metaContent);

            const isCompatible = sidecar.compatibility?.[meta.id]?.valid;
            if (isCompatible === false) {
                console.warn(`[Output: ${meta.label}] Skipped: Audio incompatible with ${meta.label}`);
                return false;
            }
        } catch {
            // Silently ignore corrupted or missing metadata
        }

        return undefined;
    }

    /**
     * Hook: handle a file source. Override in subclasses that support file playback.
     * @param {Object} _payload - Payload with normalized source ({ type: 'file', filePath, url }).
     * @param {Object} _metadata - Execution metadata.
     * @param {AbortSignal} [_signal] - Abort signal.
     * @returns {Promise<void>}
     */
    async _executeFromFile(_payload, _metadata, _signal) {
        const meta = this.constructor.getMetadata();
        throw new Error(`${meta.label} does not support file sources`);
    }

    /**
     * Hook: handle a URL source. Override in subclasses that support URL playback.
     * @param {Object} _payload - Payload with normalized source ({ type: 'url', url }).
     * @param {Object} _metadata - Execution metadata.
     * @param {AbortSignal} [_signal] - Abort signal.
     * @returns {Promise<void>}
     */
    async _executeFromUrl(_payload, _metadata, _signal) {
        const meta = this.constructor.getMetadata();
        throw new Error(`${meta.label} does not support url sources`);
    }

    /**
     * Performs a health check on the output service.
     * @param {Object} _requestedParams - Configuration parameters to test with.
     * @returns {Promise<Object>} Health status object.
     */
    async healthCheck(_requestedParams) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Verifies the provided credentials are valid.
     * @param {Object} _credentials - The credentials to verify.
     * @returns {Promise<Object>} Verification result.
     */
    async verifyCredentials(_credentials) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Validates a trigger configuration for this output.
     * @param {Object} _trigger - The trigger configuration.
     * @param {Object} _context - Additional context (audioFiles, prayer, triggerType, niceName).
     * @returns {string[]} Array of warning messages.
     */
    validateTrigger(_trigger, _context) {
        return [];
    }

    /**
      * Validates an audio asset for compatibility with this output strategy.
      * @param {string} _filePath - Path to the audio file.
      * @param {Object} _metadata - Audio metadata (format, bitrate, duration, etc).
      * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} Validation result with compatibility status.
      */
    async validateAsset(_filePath, _metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }

    /**
     * Augments audio metadata with strategy-specific properties.
     * @param {Object} _metadata - Basic audio metadata (format, bitrate, etc).
     * @returns {Object} Augmented properties.
     */
    augmentAudioMetadata(_metadata) {
        return {};
    }

    /**
     * Returns keys of parameters marked as sensitive.
     * @returns {string[]} Array of sensitive parameter keys.
     */
    getSecretRequirementKeys() {
        const metadata = this.constructor.getMetadata();
        if (!metadata.params) return [];
        return metadata.params
            .filter(p => p.sensitive)
            .map(p => p.key);
    }

    /**
     * Returns metadata describing the strategy.
     * Must be implemented by subclasses.
     * @returns {Object} Strategy metadata { id, label, supportedSourceTypes, params, ... }
     */
    static getMetadata() { 
        throw new Error('Not implemented'); 
    }
}

module.exports = BaseOutput;
