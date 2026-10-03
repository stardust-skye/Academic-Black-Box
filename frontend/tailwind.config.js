export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
      colors: { ink: '#05060a', good: '#34d399', warn: '#fbbf24', bad: '#f87171', accent: '#7dd3fc' },
    },
  },
  plugins: [],
}
