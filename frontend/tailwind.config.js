/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Metropolis', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Metropolis', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        zomato: {
          50: '#fdf2f4',
          100: '#fbe7ea',
          200: '#f5d0d6',
          300: '#eea9b2',
          400: '#e47887',
          500: '#d64b5e',
          600: '#CB202D',
          700: '#a31a24',
          800: '#881a22',
          900: '#731b22',
          950: '#3f0a0f',
        },
        primary: {
          50: '#fdf2f4',
          100: '#fbe7ea',
          200: '#f5d0d6',
          300: '#eea9b2',
          400: '#e47887',
          500: '#d64b5e',
          600: '#CB202D',
          700: '#a31a24',
          800: '#881a22',
          900: '#731b22',
          950: '#3f0a0f',
        },
        brand: {
          red: '#CB202D',
          dark: '#2D2D2D',
          light: '#F4F4F2',
          accent: '#1BA672',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'tilt': 'tilt 10s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) rotate(1deg)' },
          '66%': { transform: 'translateY(5px) rotate(-1deg)' },
        },
        tilt: {
          '0%, 100%': { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'perspective(1000px) rotateX(2deg) rotateY(-2deg)' },
          '75%': { transform: 'perspective(1000px) rotateX(-2deg) rotateY(2deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(203, 32, 45, 0.2), 0 0 10px rgba(203, 32, 45, 0.1)' },
          '100%': { boxShadow: '0 0 10px rgba(203, 32, 45, 0.4), 0 0 20px rgba(203, 32, 45, 0.2)' },
        },
      },
      boxShadow: {
        'zomato': '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        'zomato-hover': '0 8px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)',
        'zomato-card': '0 2px 12px rgba(0,0,0,0.06)',
        '3d': '0 4px 6px rgba(0,0,0,0.07), 0 10px 20px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02)',
        '3d-hover': '0 10px 40px rgba(0,0,0,0.12), 0 20px 50px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
        'glow-red': '0 0 15px rgba(203, 32, 45, 0.3)',
      },
    },
  },
  plugins: [],
};
