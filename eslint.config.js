import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: {
        clearTimeout: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        window: 'readonly',
        document: 'readonly',
        File: 'readonly',
        Event: 'readonly',
        HTMLInputElement: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        sessionStorage: 'readonly',
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
)
