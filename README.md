# SaunaSensAI
#### Developed by Smoothies of Glory

A calm, personalized, AI-powered sauna guide built for premium wellness experiences, from Finnish tradition to luxury LA spas.

Powered by ElevenLabs, Gemini, Firebase, Harvia IoT–ready architecture, and a sleek TypeScript + React frontend.

Live Demo:  https://saunasense.netlify.app/

(Hosted on Netlify, auto-deployed from GitHub)

## Features

### *Current features:*
- Provide tips and coaching for beginners to ease into the sauna experience
- Provides standardized settings for beginners
- Help more experienced sauna users to smooth out their sessions and take some load of their hands
- Read and process sauna data (target temp, live temp, humidity, presence)
- Keeps track and notifies of sauna state
- Review sauna sessions 
- Process review data and AI will generate recommendations for future sessions
- Save recommendations to use for personalized experience in the future
- Statistics from review and session with graphs

### *Future features:*
- Spotify integration
- Voice integration
- Conversational reviews and setups
- Health and wellbeing conversational tips based on sauna and health goals.
- Recommendations based on current health and physical/mental state
- Wearables integration for conversational control over the sauna settings during session
- Creates a song based on user movement, speaking, settings, data, heartbeat, breath and it creates a QR-code to download and share on all platforms the song.

## Usage 
![[Mermaid Chart - Create complex, visual diagrams with text.-2025-11-15-155445.png]]

### 📁 Project Structure
saunasense/
└── frontend/
    ├── public/
    │   └── vite.svg
    │
    ├── src/
    │   ├── assets/
    │   │   └── react.svg
    │   │
    │   ├── App.css
    │   ├── App.tsx
    │   ├── config.ts
    │   ├── index.css
    │   └── main.tsx
    │
    ├── .gitignore
    ├── eslint.config.js
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── tsconfig.json
    ├── vite.config.ts
    │
    ├── .firebaserc
    ├── firebase.json
    ├── netlify.toml
    └── README.md

### 📦 Key Directories & Files
**public**/

Contains static assets served directly by Vite.

**src**/

Main application source code.
- App.tsx — Root React component
- main.tsx — App entry point
- config.ts — App configuration
- App.css / index.css — Styles
- assets/ — SVGs and images

Build & Config Files
- vite.config.ts — Vite configuration
- tailwind.config.js — Tailwind setup
- tsconfig.json — TypeScript configuration
- eslint.config.js — Linting
- postcss.config.js — PostCSS

Deployment
- firebase.json & .firebaserc — Firebase hosting config
- netlify.toml — Netlify build/deploy configuration


## Tech Stack
**Frontend**
- React (TypeScript)
- Vite
- Tailwind CSS
- ElevenLabs ConvAI Widget

**Backend / Data**
- Firebase (state storage, routing)
- Gemini API (session logic, state evaluation)
- HARVIA GraphQL API (planned integration)
- Simulated sensor data during prototype
- Deployment
- Netlify (CI/CD, hosting)

## License

MIT License.