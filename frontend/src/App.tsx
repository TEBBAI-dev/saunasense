import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';

// FIX: Separated value and type imports for firebase/auth
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

// FIX: Separated value and type imports for firebase/firestore
import { 
  getFirestore, doc, onSnapshot, setDoc, getDoc, updateDoc, 
  arrayUnion, setLogLevel
} from 'firebase/firestore';
import type { Firestore, DocumentReference, DocumentData } from 'firebase/firestore';

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { 
  Loader, Volume2, VolumeX, Star, Thermometer, Wind, BookOpen, 
  Droplet, Wand2, Power, ChevronsRight, ArrowLeft 
} from 'lucide-react';

// --- Brand Colors (From Original App.tsx) ---
const colors = {
  bg: 'bg-black',
  text: 'text-gray-100',
  textMuted: 'text-gray-400',
  primary: 'text-[#eb0f35]',
  primaryBg: 'bg-[#eb0f35]',
  card: 'bg-zinc-900',
  border: 'border-zinc-800',
  accentGold: '#eb0f35', // The red color from your original file
};

// --- Firebase (Simulated Config) ---
// In a real build, this would be populated.
const firebaseConfig = {

  apiKey: "AIzaSyB4XguaZxBNj3ilPbXl0-JHnN7RHORuKLE",

  authDomain: "sauna-senseai.firebaseapp.com",

  projectId: "sauna-senseai",

  storageBucket: "sauna-senseai.firebasestorage.app",

  messagingSenderId: "579820513574",

  appId: "1:579820513574:web:65c40899958afc80c5b9e7",

  measurementId: "G-Q072S7BR3S"

};


const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-sens-ai-app';

// Initialize Firebase
const app: FirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
setLogLevel('debug');
// --- End of Firebase Config ---

// --- Audio Context Management ---
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const playPcmData = (pcmData: Float32Array): Promise<void> => {
  try {
    const ctx = getAudioContext();
    ctx.resume(); // Ensure context is active
    
    if (audioSource) {
      audioSource.stop(); // Stop any currently playing audio
    }
    
    const buffer = ctx.createBuffer(1, pcmData.length, 24000); // 24kHz sample rate
    buffer.getChannelData(0).set(pcmData);

    audioSource = ctx.createBufferSource();
    audioSource.buffer = buffer;
    audioSource.connect(ctx.destination);
    audioSource.start(0);
    
    return new Promise((resolve) => {
      if(audioSource) {
        audioSource.onended = () => resolve();
      }
    });
  } catch (error) {
    console.error("Audio play failed:", error);
    return Promise.reject(error);
  }
};

// --- Base64 to PCM ---
function base64ToArrayBuffer(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // The API returns signed 16-bit PCM. We need 32-bit float for Web Audio API.
  const pcm16 = new Int16Array(bytes.buffer);
  const pcm32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    pcm32[i] = pcm16[i] / 32768.0; // Convert to [-1.0, 1.0] range
  }
  return pcm32;
}

// --- Types ---
interface ViewState {
  name: string;
  payload?: any;
}

interface SaunaSettings {
  timer: number;
  temperature: number;
  music: boolean;
}

interface SensorRecord {
  time: string;
  temp: number;
  humidity: number;
}

interface SessionData {
  rating: number;
  heat: 'Too cold' | 'Just right' | 'Too hot';
  oil: string;
  thoughts: string;
  recommendations: boolean;
  showStats: boolean;
  timer: number;
  temperature: number;
  music: boolean;
  sensorHistory: SensorRecord[];
  timestamp: number;
}

interface Stats {
  totalSessions: number;
  avgRating: number;
  lastSession: SessionData | null;
  lastRecommendation: string | null;
}

interface AppContextType {
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  isNarrationEnabled: boolean;
  setIsNarrationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

// --- App Context ---
const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState<ViewState>({ name: 'welcome', payload: null });
  const [animationStep, setAnimationStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [saunaSettings, setSaunaSettings] = useState<SaunaSettings>({ timer: 15, temperature: 75, music: false });
  const [sensorHistory, setSensorHistory] = useState<SensorRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    avgRating: 0,
    lastSession: null,
    lastRecommendation: null
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const viewRef = useRef(view.name);

  // --- Animation and View Change ---
  const changeView = useCallback((newView: string, payload: any = null) => {
    if (audioSource) {
      audioSource.stop(); // Stop any speech when view changes
    }
    setAnimationStep(1); // Reset animation step
    setView({ name: newView, payload }); // Store view name and payload
    viewRef.current = newView;

    setTimeout(() => {
      if (viewRef.current === newView) { // Only animate if view hasn't changed again
        setAnimationStep(2);
      }
    }, 50); // 50ms delay to ensure step 1 renders, then trigger animation
  }, []); // Empty dependency array means this function reference is stable

  // --- Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error: ", error);
        if (auth.currentUser === null) {
          await signInAnonymously(auth);
        }
      }
    };
    
    initAuth();

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        setUserId(null);
        setIsAuthReady(false);
        initAuth(); // Try to re-authenticate
      }
    });
    return () => unsub();
  }, []);

  // --- Data Loading ---
  useEffect(() => {
    if (!isAuthReady || !userId || !db) {
      if (isAuthReady) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const userDocRef: DocumentReference<DocumentData> = doc(db, 'artifacts', appId, 'users', userId);
    
    const unsub = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const sessions: SessionData[] = data.sessions || [];
        const totalSessions = sessions.length;
        
        if (totalSessions > 0) {
          const totalRating = sessions.reduce((acc, s) => acc + (s.rating || 0), 0);
          const avgRating = parseFloat((totalRating / totalSessions).toFixed(1));
          const lastSession = sessions[sessions.length - 1];
          setStats(prevStats => ({
            ...prevStats,
            totalSessions,
            avgRating,
            lastSession,
          }));
        } else {
          setStats({ totalSessions: 0, avgRating: 0, lastSession: null, lastRecommendation: null });
        }
      } else {
        setStats({ totalSessions: 0, avgRating: 0, lastSession: null, lastRecommendation: null });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading data: ", error);
      setIsLoading(false);
    });

    return () => unsub();

  }, [isAuthReady, userId]);

  // --- Trigger initial animation on load ---
  useEffect(() => {
    if (!isLoading && view.name === 'welcome' && animationStep === 1) {
      setTimeout(() => {
        setAnimationStep(2);
      }, 50);
    }
  }, [isLoading, view.name, animationStep]);

  // --- Narration ---
  const speak = useCallback(async (text: string) => {
    if (!isNarrationEnabled || !hasInteracted || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{
          parts: [{ text: `Say in a relaxed, easy-going, medium-pitched voice: ${text}` }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Callirrhoe" }
            }
          }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`TTS API request failed with status ${response.status}`);
      }
      
      const result = await response.json();
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (audioData && mimeType && mimeType.startsWith("audio/")) {
        const pcmData = base64ToArrayBuffer(audioData);
        await playPcmData(pcmData);
      } else {
        throw new Error("Invalid TTS response format");
      }
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsSpeaking(false);
    }
  }, [isNarrationEnabled, hasInteracted, isSpeaking]);

  // --- Sensor Simulation ---
  const startSensorSimulation = useCallback((durationMinutes: number, targetTemp: number, onUpdateCallback: (record: SensorRecord) => void) => {
    let currentTemp = 25;
    let currentHumidity = 15;
    const steps = durationMinutes * 60 / 3; // Update every 3 seconds
    const tempIncrease = (targetTemp - currentTemp) / (steps / 2); // Reach target temp halfway
    const humidityIncrease = 30 / (steps / 2); // Reach 45% humidity halfway

    setSensorHistory([]); // Clear old history

    const simulationInterval = setInterval(() => {
      if (currentTemp < targetTemp) {
        currentTemp = Math.min(targetTemp, currentTemp + tempIncrease);
        currentHumidity = Math.min(45, currentHumidity + humidityIncrease);
      } else {
        currentTemp += (Math.random() - 0.5) * 2; // +/- 1 degree
        currentHumidity += (Math.random() - 0.5); // +/- 0.5%
      }
      
      const newRecord: SensorRecord = {
        time: (Date.now() / 1000).toFixed(0),
        temp: Math.round(currentTemp),
        humidity: Math.round(currentHumidity)
      };
      
      onUpdateCallback(newRecord);

    }, 3000); // Update every 3 seconds

    return () => clearInterval(simulationInterval);
  }, []);
  
  // --- Get Recommendation ---
  const getRecommendation = (session: SessionData): string => {
    const { rating, heat, temperature, timer, music, oil } = session;
    let recText = "For your next session, ";
    
    const invalidOils = ['shoe', 'frog', 'machine', 'motor'];
    const oilInput = oil ? oil.toLowerCase().trim() : '';
    const isOilInvalid = invalidOils.some(invalid => oilInput.includes(invalid));
    const validOilUsed = oilInput && !isOilInvalid && oilInput !== 'none' && oilInput !== '';

    if (heat === 'Too hot' && temperature > 65) {
      recText += `try lowering the temperature to ${temperature - 2}°C. `;
    } else if (heat === 'Too cold' && temperature < 95) {
      recText += `try increasing the temperature to ${temperature + 2}°C. `;
    } else if (rating < 7) {
      recText += `let's adjust the temperature to ${temperature + 1}°C. `;
    } else {
      recText += `the temperature of ${temperature}°C seems good for you. `;
    }

    if (rating > 7) {
      recText += `Your duration of ${timer} minutes ${music ? 'with music' : 'without music'} was a great combination. `;
    } else if (timer < 20) {
      recText += `You might enjoy a slightly longer session of ${timer + 5} minutes. `;
    }

    if (validOilUsed) {
      recText += `Since you enjoyed ${oil}, you might also like Birch or Pine.`;
    } else if (rating < 8) {
      recText += `Consider adding a few drops of Eucalyptus or Peppermint oil to the water for a more refreshing experience.`;
    }

    return recText;
  };

  // --- Data Saving ---
  const saveSession = async (feedback: Omit<SessionData, 'timer' | 'temperature' | 'music' | 'sensorHistory' | 'timestamp'>, sessionSensorHistory: SensorRecord[]) => {
    setIsLoading(true);
    const newSession: SessionData = {
      ...saunaSettings,
      ...feedback,
      sensorHistory: sessionSensorHistory,
      timestamp: Date.now()
    };
    
    const recommendation = feedback.recommendations ? getRecommendation(newSession) : "";

    setStats(prevStats => {
      const newTotalSessions = prevStats.totalSessions + 1;
      const totalRating = (prevStats.avgRating * prevStats.totalSessions) + feedback.rating;
      const newAvgRating = parseFloat((totalRating / newTotalSessions).toFixed(1));
      
      return {
        totalSessions: newTotalSessions,
        avgRating: newAvgRating,
        lastSession: newSession,
        lastRecommendation: recommendation
      };
    });

    if (isAuthReady && userId && db) {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
      try {
        await updateDoc(userDocRef, {
          sessions: arrayUnion(newSession)
        });
        console.log("Session saved to Firebase!");
      } catch (error: any) {
        if (error.code === 'not-found') {
          try {
            await setDoc(userDocRef, { sessions: [newSession] });
            console.log("New user doc created and session saved to Firebase!");
          } catch (e) {
            console.error("Error creating doc: ", e);
          }
        } else {
          console.error("Error saving session: ", error);
        }
      }
    } else {
      console.warn("User not authenticated, session only saved locally for this view.");
    }
    
    setIsLoading(false);
    
    if (feedback.showStats) {
      changeView('stats');
    } else {
      changeView('goodbye');
    }
  };
  
  // --- Reset Data Function ---
  const handleResetData = async () => {
    if (!isAuthReady || !userId || !db) {
      console.log("Resetting local state (demo).");
      setStats({ totalSessions: 0, avgRating: 0, lastSession: null, lastRecommendation: null });
      setSensorHistory([]);
      changeView('welcome');
      return;
    }

    setIsLoading(true);
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
      await setDoc(userDocRef, { sessions: [] }, { merge: true }); 
      console.log("Session data reset!");
      setSensorHistory([]);
      setIsLoading(false);
      changeView('welcome');
    } catch (error) {
      console.error("Error resetting data: ", error);
      setIsLoading(false);
    }
  };

  
  // --- App Context Value ---
  const appContextValue = React.useMemo(() => ({
    speak,
    isSpeaking,
    isNarrationEnabled,
    setIsNarrationEnabled
  }), [speak, isSpeaking, isNarrationEnabled, setIsNarrationEnabled]);

  // --- Render View ---
  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col h-full justify-center items-center p-8 text-center">
          <h1 className="text-3xl font-light text-white mb-4">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
          <div className="w-16 h-16 border-4 border-t-[#eb0f35] border-zinc-800 rounded-full animate-spin mb-8"></div>
          <p className={`${colors.textMuted} max-w-xs`}>Loading...</p>
        </div>
      );
    }
    switch (view.name) {
      case 'welcome':
        return <WelcomeView setView={changeView} stats={stats} animationStep={animationStep} />;
      case 'newToSauna':
        return <NewToSaunaView setView={changeView} setSaunaSettings={setSaunaSettings} animationStep={animationStep} />;
      case 'experiment':
        return <ExperimentView setView={changeView} setSaunaSettings={setSaunaSettings} animationStep={animationStep} />;
      case 'recommended':
        return <RecommendedView setView={changeView} setSaunaSettings={setSaunaSettings} stats={stats} animationStep={animationStep} />;
      case 'timer':
        return <TimerView setView={changeView} settings={saunaSettings} onSensorUpdate={startSensorSimulation} animationStep={animationStep} />;
      case 'feedback':
        return <FeedbackView setView={changeView} onSave={saveSession} viewPayload={view.payload} animationStep={animationStep} />;
      case 'stats':
        return <StatsView setView={changeView} stats={stats} animationStep={animationStep} />;
      case 'goodbye':
        return <GoodbyeView setView={changeView} animationStep={animationStep} />;
      default:
        return <WelcomeView setView={changeView} stats={stats} animationStep={animationStep} />;
    }
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <div 
        className="h-screen w-screen flex justify-center items-center bg-zinc-950 p-4"
        onClick={() => !hasInteracted && setHasInteracted(true)}
      >
        <main className={`relative w-full max-w-sm h-[800px] max-h-[90vh] ${colors.bg} ${colors.text} rounded-3xl shadow-2xl overflow-hidden border-4 ${colors.border}`}>
          
          <header className="flex items-center justify-between p-6 pb-0">
            <h1 className="text-3xl font-light text-white">
              Sens<span style={{color: colors.accentGold}}>AI</span>
            </h1>
            <div className="flex items-center gap-2">
              {isSpeaking && <Loader className="w-5 h-5 animate-spin" style={{color: colors.accentGold}} />}
              <button 
                onClick={() => setIsNarrationEnabled(!isNarrationEnabled)} 
                className={`p-2 rounded-full transition-colors hover:${colors.card}`}
              >
                {isNarrationEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
          </header>

          <main className="h-[calc(100%_-_68px)]"> {/* Main content area */}
            {renderView()}
          </main>
          
          <button
            onClick={handleResetData}
            className={`absolute bottom-4 right-4 p-2 ${colors.primaryBg} text-black rounded-full transition-all hover:shadow-[0_0_15px_rgba(235,15,53,0.8)] z-50`}
            title="Reset All Session Data (Demo)"
          >
            <Power className="w-4 h-4" />
          </button>
          
          <style>{`
            .phrase-container {
              display: flex;
              flex-direction: column;
              height: 100%;
              padding: 1.5rem; /* 24px */
              padding-top: 1rem;
            }
            
            .phrase-animated {
              transition: all 0.4s ease-out;
              transform-origin: center;
              will-change: transform, font-size, opacity;
            }
            
            .options-hidden {
              opacity: 0;
              transform: translateY(10px);
              transition: all 0.3s ease-out 0s;
              visibility: hidden;
            }
            
            .options-visible {
              opacity: 1;
              transform: translateY(0);
              transition: all 0.3s ease-out 0s;
              visibility: visible;
            }
          `}</style>
        </main>
      </div>
    </AppContext.Provider>
  );
}

// --- Custom Hook for Narration ---
function useSpeak(text: string, animationStep: number, speakOnStep: number) {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSpeak must be used within an AppProvider');
  
  const { speak } = context;
  const hasSpoken = useRef(false);

  useEffect(() => {
    if (animationStep === speakOnStep && !hasSpoken.current) {
      speak(text);
      hasSpoken.current = true;
    }
    if (animationStep === 1) { // Reset on animation reset
      hasSpoken.current = false;
    }
  }, [animationStep, speakOnStep, text, speak]);
}

// --- Views ---

interface ViewProps {
  setView: (view: string, payload?: any) => void;
  animationStep: number;
}

interface WelcomeViewProps extends ViewProps {
  stats: Stats;
}

function WelcomeView({ setView, stats, animationStep }: WelcomeViewProps) {
  const phrase = "Greetings! I am your personal sauna assistant, SensAI. How would you like to proceed?";
  
  useSpeak(phrase, animationStep, 1);

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-8`
  }`; 

  const showRecommended = stats && stats.totalSessions >= 2;

  return (
    <div className="phrase-container justify-center">
      <p id="welcome-text" className={phraseClass}>
        {phrase} 
      </p>
      
      <div className={`flex flex-col gap-4 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        <Button onClick={() => setView('newToSauna')} icon={<SunIcon />}>New to sauna</Button>
        <Button onClick={() => setView('experiment')} icon={<MoonIcon />}>Experiment mode</Button>
        {showRecommended && (
          <Button onClick={() => setView('recommended')} icon={<Star className="w-5 h-5 mr-2" />}>
            Recommended Settings
          </Button>
        )}
      </div>
    </div>
  );
}

interface NewToSaunaViewProps extends ViewProps {
  setSaunaSettings: React.Dispatch<React.SetStateAction<SaunaSettings>>;
}

function NewToSaunaView({ setView, setSaunaSettings, animationStep }: NewToSaunaViewProps) {
  const [timer, setTimer] = useState(15);
  const recommendedTemp = 75;
  
  const phrase = "Please select your duration.";
  useSpeak(phrase, animationStep, 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaunaSettings({ 
      timer, 
      temperature: recommendedTemp, 
      music: false 
    });
    setView('timer');
  };

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;

  return (
    <form onSubmit={handleSubmit} className="phrase-container">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`space-y-6 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        <p className={colors.textMuted}>For new users, we recommend the following settings to start.</p>
        
        <div className={`${colors.card} rounded-lg p-4 space-y-3`}>
          <h3 className="text-lg font-medium flex items-center" style={{color: colors.accentGold}}>
            <BookOpen className="w-5 h-5 mr-2" />
            Beginner Tips
          </h3>
          <ul className="list-inside list-none space-y-2 ${colors.textMuted} text-sm">
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span>Hydrate well before, during, and after.</span>
            </li>
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span>Start with 10-15 minutes.</span>
            </li>
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span>Listen to your body. Leave if you feel dizzy.</span>
            </li>
            <li className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <span>Cool down with a lukewarm shower.</span>
            </li>
          </ul>
        </div>
        
        <div className={`${colors.card} rounded-lg p-4`}>
          <label className={`block text-lg font-medium ${colors.textMuted}`}>Recommended Temperature:</label>
          <p className="text-3xl font-bold" style={{color: colors.accentGold}}>{recommendedTemp}°C</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="timer-select" className="block text-lg font-medium">Session Duration:</label>
          <select
            id="timer-select"
            value={timer}
            onChange={(e) => setTimer(Number(e.target.value))}
            className={`w-full p-3 ${colors.card} ${colors.text} rounded-lg border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
          >
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
          </select>
        </div>
        
        <p className={`text-sm ${colors.textMuted}`}>Sauna will be ready in 2 minutes... (This is a simulation).</p>
        
        <div className="flex gap-4">
          <Button type="button" onClick={() => setView('welcome')} variant="secondary">Back</Button>
          <Button type="submit">Start</Button>
        </div>
      </div>
    </form>
  );
}

interface ExperimentViewProps extends ViewProps {
  setSaunaSettings: React.Dispatch<React.SetStateAction<SaunaSettings>>;
}

function ExperimentView({ setView, setSaunaSettings, animationStep }: ExperimentViewProps) {
  const [timer, setTimer] = useState(20);
  const [temperature, setTemperature] = useState(80);
  const [music, setMusic] = useState(false);
  
  const phrase = "Please choose your settings.";
  useSpeak(phrase, animationStep, 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaunaSettings({ timer, temperature, music });
    setView('timer');
  };

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;

  return (
    <form onSubmit={handleSubmit} className="phrase-container">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`space-y-6 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>

        {/* Temperature Selection */}
        <div className={`${colors.card} rounded-lg p-6`}>
          <label htmlFor="temp-slider" className="block text-lg font-medium mb-4">Temperature: <span className="text-2xl font-bold" style={{color: colors.accentGold}}>{temperature}°C</span></label>
          <input
            id="temp-slider"
            type="range"
            min="60"
            max="100"
            step="1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${colors.accentGold} 0%, ${colors.accentGold} ${((temperature - 60) / 40) * 100}%, #27272a ${((temperature - 60) / 40) * 100}%, #27272a 100%)`,
            }}
          />
          <div className={`flex justify-between text-xs mt-2 ${colors.textMuted}`}>
            <span>60°C</span>
            <span>100°C</span>
          </div>
        </div>

        {/* Timer Selection */}
        <div className={`${colors.card} rounded-lg p-6`}>
          <label htmlFor="timer-exp" className="block text-lg font-medium mb-4">Session Duration: <span className="text-2xl font-bold" style={{color: colors.accentGold}}>{timer} min</span></label>
          <input
            id="timer-exp"
            type="range"
            min="5"
            max="60"
            step="5"
            value={timer}
            onChange={(e) => setTimer(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${colors.accentGold} 0%, ${colors.accentGold} ${((timer - 5) / 55) * 100}%, #27272a ${((timer - 5) / 55) * 100}%, #27272a 100%)`,
            }}
          />
          <div className={`flex justify-between text-xs mt-2 ${colors.textMuted}`}>
            <span>5 min</span>
            <span>60 min</span>
          </div>
        </div>
        
        {/* Music Selection */}
        <div className={`${colors.card} rounded-lg p-4 flex justify-between items-center`}>
          <label className="text-lg font-medium">Music involved?</label>
          <SwitchToggle enabled={music} setEnabled={setMusic} />
        </div>

        <p className={`text-sm ${colors.textMuted} text-center`}>Are these your chosen settings? Confirm?</p>

        <div className="flex gap-4">
          <Button type="button" onClick={() => setView('welcome')} variant="secondary">Back</Button>
          <Button type="submit">Confirm</Button>
        </div>
      </div>
    </form>
  );
}

interface RecommendedViewProps extends ViewProps {
  setSaunaSettings: React.Dispatch<React.SetStateAction<SaunaSettings>>;
  stats: Stats;
}

function RecommendedView({ setView, setSaunaSettings, stats, animationStep }: RecommendedViewProps) {
  const calculateRecommendation = () => {
    if (!stats.lastSession) return 75;
    const { temperature, heat } = stats.lastSession;
    if (heat === 'Too hot') return Math.max(60, temperature - 2);
    if (heat === 'Too cold') return Math.min(100, temperature + 2);
    return temperature;
  };
  
  const recommendedTemp = calculateRecommendation();
  const [timer, setTimer] = useState(stats.lastSession?.timer || 15);
  const [music, setMusic] = useState(stats.lastSession?.music || false);
  
  const phrase = `Your average rating is ${stats.avgRating}/10! Based on your last session, here are our recommendations.`;
  
  useSpeak(phrase, animationStep, 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaunaSettings({ 
      timer, 
      temperature: recommendedTemp, 
      music 
    });
    setView('timer');
  };

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;

  return (
    <form onSubmit={handleSubmit} className="phrase-container">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`space-y-6 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        
        <div className={`${colors.card} rounded-lg p-4`}>
          <label className={`block text-lg font-medium ${colors.textMuted}`}>Recommended Temperature:</label>
          <p className="text-3xl font-bold" style={{color: colors.accentGold}}>{recommendedTemp}°C</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="timer-select" className="block text-lg font-medium">Session Duration:</label>
          <select
            id="timer-select"
            value={timer}
            onChange={(e) => setTimer(Number(e.target.value))}
            className={`w-full p-3 ${colors.card} ${colors.text} rounded-lg border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
          >
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={25}>25 minutes</option>
          </select>
        </div>
        
        <div className={`${colors.card} rounded-lg p-4 flex justify-between items-center`}>
          <label className="text-lg font-medium">Music involved?</label>
          <SwitchToggle enabled={music} setEnabled={setMusic} />
        </div>
        
        <p className={`text-sm ${colors.textMuted}`}>Sauna will be ready in 2 minutes... (This is a simulation).</p>
        
        <div className="flex gap-4">
          <Button type="button" onClick={() => setView('welcome')} variant="secondary">Back</Button>
          <Button type="submit">Start</Button>
        </div>
      </div>
    </form>
  );
}


interface TimerViewProps extends ViewProps {
  settings: SaunaSettings;
  onSensorUpdate: (durationMinutes: number, targetTemp: number, onUpdateCallback: (record: SensorRecord) => void) => () => void;
}

const TimerView = React.memo(({ setView, settings, onSensorUpdate, animationStep }: TimerViewProps) => {
  const { timer, temperature } = settings;
  const [timeLeft, setTimeLeft] = useState(timer * 60);
  const [liveData, setLiveData] = useState({ temp: 25, humidity: 15 });
  const [localSensorHistory, setLocalSensorHistory] = useState<SensorRecord[]>([]);
  
  const phrase = "Sauna time!";
  
  const handleSensorUpdate = useCallback((newRecord: SensorRecord) => {
    setLiveData({ temp: newRecord.temp, humidity: newRecord.humidity });
    setLocalSensorHistory(prevHistory => [...prevHistory, newRecord]);
  }, []);

  useEffect(() => {
    const stopSimulation = onSensorUpdate(timer, temperature, handleSensorUpdate);
    return stopSimulation;
  }, [timer, temperature, onSensorUpdate, handleSensorUpdate]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setView('feedback', { sensorHistory: localSensorHistory });
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, setView, localSensorHistory]);

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const progress = timer * 60 > 0 ? ((timer * 60 - timeLeft) / (timer * 60)) * 100 : 0;

  return (
    <div className="phrase-container justify-center">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`flex flex-col items-center justify-center space-y-8 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        
        {/* Timer Dial (from original App.tsx) */}
        <div
          className="w-48 h-48 rounded-full border-8 border-zinc-800 flex items-center justify-center text-white"
          style={{
            background: `conic-gradient(${colors.accentGold} ${progress}%, ${colors.card} ${progress}%)`
          }}
        >
          <div className={`w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-full ${colors.bg} flex flex-col items-center justify-center`}>
            <span className="text-6xl font-light" style={{fontFamily: 'Nunito, sans-serif'}}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Live Data Display */}
        <div className="flex justify-around w-full px-4">
          <div className="text-center">
            <span className={`text-sm ${colors.textMuted}`}>TARGET TEMP</span>
            <div className="flex items-baseline justify-center gap-1">
              <Thermometer className="w-5 h-5" style={{color: colors.accentGold}} />
              <span className="text-2xl font-bold" style={{color: colors.accentGold}}>{temperature}°C</span>
            </div>
          </div>
          <div className="text-center">
            <span className={`text-sm ${colors.textMuted}`}>LIVE TEMP</span>
            <div className="flex items-baseline justify-center gap-1">
              <Thermometer className="w-5 h-5" style={{color: colors.accentGold}} />
              <span className="text-2xl font-bold" style={{color: colors.accentGold}}>{liveData.temp}°C</span>
            </div>
          </div>
          <div className="text-center">
            <span className={`text-sm ${colors.textMuted}`}>HUMIDITY</span>
            <div className="flex items-baseline justify-center gap-1">
              <Droplet className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold text-blue-400">{liveData.humidity}%</span>
            </div>
          </div>
        </div>

        <div className="w-full px-4 pt-4">
          <Button 
            type="button" 
            onClick={() => setView('feedback', { sensorHistory: localSensorHistory })} 
            variant="secondary"
          >
            End Session Early
          </Button>
        </div>
      </div>
    </div>
  );
});

interface FeedbackViewProps extends ViewProps {
  onSave: (feedback: Omit<SessionData, 'timer' | 'temperature' | 'music' | 'sensorHistory' | 'timestamp'>, sessionSensorHistory: SensorRecord[]) => void;
  viewPayload: any;
}

function FeedbackView({ setView, onSave, viewPayload, animationStep }: FeedbackViewProps) {
  const [fields, setFields] = useState({
    rating: 5,
    heat: 'Just right' as 'Too cold' | 'Just right' | 'Too hot',
    oil: '',
    thoughts: '',
    recommendations: false,
    showStats: true,
  });
  
  const phrase = "Welcome back. How was your sauna?";
  useSpeak(phrase, animationStep, 1);

  const setField = (field: keyof typeof fields, value: any) => {
    setFields(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sensorHistory = viewPayload?.sensorHistory || [];
    onSave(fields, sensorHistory);
  };

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;

  return (
    <form onSubmit={handleSubmit} className="phrase-container">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`space-y-4 w-full overflow-y-auto max-h-[calc(100%-80px)] p-1 ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        
        {/* 1. Overall Rating */}
        <fieldset className={`${colors.card} rounded-lg p-4`}>
          <legend className="text-lg font-medium flex items-center mb-3"><Star className="w-5 h-5 mr-2 text-yellow-500" />Rate overall sauna experience (1-10)</legend>
          <input
            type="range"
            min="1"
            max="10"
            value={fields.rating}
            onChange={(e) => setField('rating', Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${colors.accentGold} 0%, ${colors.accentGold} ${((fields.rating - 1) / 9) * 100}%, #27272a ${((fields.rating - 1) / 9) * 100}%, #27272a 100%)`,
            }}
          />
          <div className="text-center text-xl font-bold mt-2" style={{color: colors.accentGold}}>{fields.rating}</div>
        </fieldset>
        
        {/* 2. Heat Level */}
        <fieldset className={`${colors.card} rounded-lg p-4`}>
          <legend className="text-lg font-medium flex items-center mb-3"><Thermometer className="w-5 h-5 mr-2" style={{color: colors.accentGold}} />How was the heat?</legend>
          <div className="flex flex-col sm:flex-row gap-2">
            <RadioPill name="heat" value="Too cold" checked={fields.heat === 'Too cold'} onChange={(e) => setField('heat', e.target.value)} label="Not enough" />
            <RadioPill name="heat" value="Just right" checked={fields.heat === 'Just right'} onChange={(e) => setField('heat', e.target.value)} label="Just right" />
            <RadioPill name="heat" value="Too hot" checked={fields.heat === 'Too hot'} onChange={(e) => setField('heat', e.target.value)} label="Too hot" />
          </div>
        </fieldset>
        
        {/* 3. Oil Used */}
        <fieldset className={`${colors.card} rounded-lg p-4`}>
          <legend className="text-lg font-medium flex items-center mb-3"><Wind className="w-5 h-5 mr-2 text-blue-400" />Did you use any oils?</legend>
          <input
            type="text"
            value={fields.oil}
            onChange={(e) => setField('oil', e.target.value)}
            placeholder="e.g., Eucalyptus, Birch..."
            className={`w-full p-3 ${colors.card} ${colors.text} rounded-lg border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
          />
        </fieldset>
        
        {/* 4. Thoughts */}
        <fieldset className={`${colors.card} rounded-lg p-4`}>
          <legend className="text-lg font-medium mb-3">What are your thoughts on this sauna experience?</legend>
          <textarea
            value={fields.thoughts}
            onChange={(e) => setField('thoughts', e.target.value)}
            rows={3}
            placeholder="Share your thoughts..."
            className={`w-full p-3 ${colors.card} ${colors.text} rounded-lg border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
          />
        </fieldset>
        
        {/* 5. Recommendations */}
        <fieldset className={`${colors.card} rounded-lg p-4 flex justify-between items-center`}>
          <legend className="text-lg font-medium">Get recommendations?</legend>
          <SwitchToggle enabled={fields.recommendations} setEnabled={(val) => setField('recommendations', val)} />
        </fieldset>
        
        {/* 6. Show Stats */}
        <fieldset className={`${colors.card} rounded-lg p-4 flex justify-between items-center`}>
          <legend className="text-lg font-medium">Show statistics?</legend>
          <SwitchToggle enabled={fields.showStats} setEnabled={(val) => setField('showStats', val)} />
        </fieldset>

        <div className="flex gap-4 pt-4">
          <Button type="button" onClick={() => setView('welcome')} variant="secondary">Cancel</Button>
          <Button type="submit">Submit</Button>
        </div>
      </div>
    </form>
  );
}

interface StatsViewProps extends ViewProps {
  stats: Stats;
}

function StatsView({ setView, stats, animationStep }: StatsViewProps) {
  const { lastSession, lastRecommendation, totalSessions, avgRating } = stats;
  
  const phrase = "Session Statistics";
  useSpeak(
    lastRecommendation || "Here are your session statistics.", 
    animationStep, 
    1
  );

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-6`
  }`;
  
  const data = lastSession?.sensorHistory || [];

  return (
    <div className="phrase-container">
      <h2 className={phraseClass}>
        {phrase}
      </h2>
      
      <div className={`space-y-6 w-full overflow-y-auto max-h-[calc(100%-80px)] p-1 ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        
        {!lastSession ? (
          <p>No session data found.</p>
        ) : (
          <div className={`${colors.card} rounded-lg p-4 space-y-4`}>
            {lastRecommendation && (
              <div className="pb-4 border-b ${colors.border}">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{color: colors.accentGold}}>
                  <Wand2 className="w-5 h-5" />
                  SensAI's Recommendation
                </h3>
                <p className={`${colors.textMuted} italic mt-2`}>{lastRecommendation}</p>
              </div>
            )}
            
            <h3 className="text-lg font-semibold pt-2">Last Session</h3>
            <StatItem label="Rating" value={`${lastSession.rating}/10`} icon={<Star className="w-5 h-5 text-yellow-500" />} />
            <StatItem label="Temp" value={`${lastSession.temperature}°C`} icon={<Thermometer className="w-5 h-5" style={{color: colors.accentGold}} />} />
            <StatItem label="Duration" value={`${lastSession.timer} min`} />
            <StatItem label="Music" value={lastSession.music ? "Yes" : "No"} />
            
            {data.length > 0 && (
              <div className={`pt-4 border-t ${colors.border}`}>
                <h3 className="text-lg font-semibold mb-2" style={{color: colors.accentGold}}>Session Data Graph</h3>
                <SensorGraph data={data} />
              </div>
            )}
            
            <h3 className={`text-lg font-semibold pt-4 border-t ${colors.border}`}>All-Time Stats</h3>
            <StatItem label="Total Sessions" value={totalSessions} />
            <StatItem label="Average Rating" value={avgRating} />
            
          </div>
        )}
        
        <Button onClick={() => setView('goodbye')}>
          Done <ChevronsRight className="w-5 h-5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function GoodbyeView({ setView, animationStep }: ViewProps) {
  const phrase = "Thank you for using SensAI. Until next time.";
  useSpeak(phrase, animationStep, 1);

  const phraseClass = `text-center phrase-animated ${
    animationStep === 1
      ? 'text-4xl scale-110 flex-1 flex items-center justify-center'
      : `text-2xl font-light ${colors.textMuted} mb-8`
  }`;

  return (
    <div className="phrase-container justify-center">
      <p className={phraseClass}>
        {phrase}
      </p>
      <div className={`flex flex-col gap-4 w-full ${animationStep === 2 ? 'options-visible' : 'options-hidden'}`}>
        <Button onClick={() => setView('welcome')}>
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Start
        </Button>
      </div>
    </div>
  );
}


// --- UI Components (Re-styled to match Original App.tsx) ---

// Inlined SVG Icons from original App.tsx for the buttons
const SunIcon = () => (
  <svg xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12H.75m.386-6.364l1.591 1.591" />
  </svg>
);
const MoonIcon = () => (
  <svg xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21c1.93 0 3.73-.524 5.287-1.447z" />
  </svg>
);


interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
}

function Button({ children, onClick, type = 'button', variant = 'primary', icon }: ButtonProps) {
  const primaryStyle = `text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`;
  const secondaryStyle = `${colors.card} border ${colors.border} text-lg font-medium text-white transition-all hover:border-[#eb0f35] hover:shadow-[0_0_20px_rgba(235,15,53,0.4)]`;
  
  return (
    <button
      type={type}
      onClick={onClick}
      className={`w-full p-4 rounded-lg flex items-center justify-center ${variant === 'primary' ? primaryStyle : secondaryStyle}`}
      style={{
        backgroundColor: variant === 'primary' ? colors.accentGold : 'transparent',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

interface RadioPillProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}

function RadioPill({ name, value, checked, onChange, label }: RadioPillProps) {
  return (
    <label className={`flex-1 p-3 text-center rounded-lg cursor-pointer transition-all duration-200 ${
      checked ? `text-black` : `${colors.border} border ${colors.text} hover:border-[#eb0f35]`
    }`}
    style={{
      backgroundColor: checked ? colors.accentGold : 'transparent',
    }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

interface SwitchToggleProps {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

function SwitchToggle({ enabled, setEnabled }: SwitchToggleProps) {
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
        enabled ? colors.primaryBg : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface SensorGraphProps {
  data: SensorRecord[];
}

function SensorGraph({ data }: SensorGraphProps) {
  const graphData = data.map((d, i) => ({
    name: i * 3, // Simulate time in seconds
    temp: d.temp,
    humidity: d.humidity,
  }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={graphData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
          <XAxis dataKey="name" stroke="#9CA3AF" unit="s" fontSize={12} />
          <YAxis yAxisId="left" stroke={colors.accentGold} unit="°C" fontSize={12} />
          <YAxis yAxisId="right" orientation="right" stroke="#60A5FA" unit="%" fontSize={12} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px' }}
            labelStyle={{ color: colors.text }}
            itemStyle={{ color: colors.text }}
          />
          <Line yAxisId="left" type="monotone" dataKey="temp" stroke={colors.accentGold} strokeWidth={2} dot={false} name="Temp" />
          <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#60A5FA" strokeWidth={2} dot={false} name="Humidity" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

function StatItem({ label, value, icon = null }: StatItemProps) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between items-center">
      <span className={`${colors.textMuted} flex items-center gap-2`}>
        {icon}
        {label}
      </span>
      <span className={`text-lg font-medium ${colors.text}`}>{value}</span>
    </div>
  );
}