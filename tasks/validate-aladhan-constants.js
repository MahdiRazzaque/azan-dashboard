// tasks/validate-aladhan-constants.js

import { validateConstants } from '../src/prayer/validate-constants.js';

console.log('🧪 Running Aladhan constants validation...');
validateConstants().then(() => {
    console.log('✅ Validation script completed');
}); 