const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['node_modules/**', 'frontend/vendor/**']
    },
    js.configs.recommended,
    prettierConfig,
    {
        rules: {
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    },
    {
        files: ['backend/**/*.js', 'database/**/*.js', 'api/**/*.js', '*.js', 'test/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': 'warn'
        }
    },
    {
        files: ['frontend/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                marked: 'readonly',
                DOMPurify: 'readonly',
                renderMathInElement: 'readonly',
                google: 'readonly',
                Desmos: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'warn'
        }
    }
];
