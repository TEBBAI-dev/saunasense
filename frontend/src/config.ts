// API Configuration
// Set your API keys here or use environment variables
// For production, use environment variables (VITE_OPENAI_API_KEY or VITE_ELEVENLABS_API_KEY)

export const API_CONFIG = {
  // Set your OpenAI API key here
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || 'your-openai-api-key-here',
  
  // Set your 11 Labs API key here (if using 11 Labs)
  ELEVENLABS_API_KEY: import.meta.env.VITE_ELEVENLABS_API_KEY || 'your-elevenlabs-api-key-here',
  
  // Set to true to use 11 Labs instead of OpenAI
  USE_ELEVENLABS: import.meta.env.VITE_USE_ELEVENLABS === 'true' || false,
  
  // Harvia API Configuration
  HARVIA_EMAIL: import.meta.env.VITE_HARVIA_EMAIL || 'harviahackathon2025@gmail.com',
  HARVIA_PASSWORD: import.meta.env.VITE_HARVIA_PASSWORD || 'junction25!',
  HARVIA_API_BASE: 'https://api.harvia.io',
};

