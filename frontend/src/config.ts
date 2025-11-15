// API Configuration
// For production, use environment variables (VITE_OPENAI_API_KEY or VITE_ELEVENLABS_API_KEY)

export const API_CONFIG = {
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || 'your-openai-api-key-here',
  ELEVENLABS_API_KEY: import.meta.env.VITE_ELEVENLABS_API_KEY || 'your-elevenlabs-api-key-here',
  USE_ELEVENLABS: import.meta.env.VITE_USE_ELEVENLABS === 'true' || false,
  HARVIA_EMAIL: import.meta.env.VITE_HARVIA_EMAIL || 'harviahackathon2025@gmail.com',
  HARVIA_PASSWORD: import.meta.env.VITE_HARVIA_PASSWORD || 'junction25!',
  HARVIA_API_BASE: 'https://api.harvia.io',
};

