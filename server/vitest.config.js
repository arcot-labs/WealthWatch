import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        coverage: {
            include: ['src/middleware/*.ts', 'src/utilities/*.ts'],
        },
        testTimeout: 20000,
    },
    plugins: [tsconfigPaths()],
})
