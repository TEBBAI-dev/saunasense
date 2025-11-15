import { useState, useRef, useEffect } from 'react';
import { API_CONFIG } from './config';

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof webkitSpeechRecognition;
  }
}

// --- ICONS (Inlined SVGs for a single-file build) ---

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12H.75m.386-6.364l1.591 1.591" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21c1.93 0 3.73-.524 5.287-1.447z" />
  </svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
  </svg>
);

// --- Data Types (Shared with Backend) ---

type SaunaPhase = {
  type: 'heat' | 'cooldown' | 'rest';
  durationMinutes: number;
  targetTemp: number;
  coachScript: string;
};

type SessionProfile = {
  title: string;
  totalDurationMinutes: number;
  phases: SaunaPhase[];
};

type SensorData = {
  temperature: number;
  humidity: number;
  presence: boolean;
  timestamp: number;
};

// --- Updated AppState ---
type AppState = 'startPoint' | 'welcome' | 'steamTransition' | 'followUpQuestion' | 'onboarding' | 'newbieRecommendations' | 'experiencedFollowUp' | 'experiencedSettings' | 'saunaReady' | 'generating' | 'session' | 'postSaunaFeedback' | 'feedbackQuestions' | 'askStatistics' | 'showStatistics' | 'askRecommendations' | 'recommendations' | 'summary';

// --- Brand Colors ---
const colors = {
  bg: 'bg-black',
  text: 'text-gray-100',
  textMuted: 'text-gray-400',
  primary: 'text-[#eb0f35]',
  primaryBg: 'bg-[#eb0f35]',
  card: 'bg-zinc-900',
  border: 'border-zinc-800',
  accentGold: '#eb0f35',
};

// --- Animated Text Component ---
const AnimatedWelcomeText = ({ onAnimationComplete, playVoice }: { onAnimationComplete: () => void; playVoice: (text: string) => void }) => {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Hello, I am your SensAI assistant. Welcome to the session. What kind of assistance would you like today?";
  const animationIntervalRef = useRef<number | null>(null);
  const voicePlayedRef = useRef(false);

  useEffect(() => {
    let index = 0;
    animationIntervalRef.current = window.setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(prev => prev + fullText.charAt(index));
        index++;
        // Play voice when we're about 20% through the text
        if (index === Math.floor(fullText.length * 0.2) && !voicePlayedRef.current) {
          voicePlayedRef.current = true;
          playVoice(fullText);
        }
      } else {
        clearInterval(animationIntervalRef.current!);
        // Wait a bit after animation finishes before transitioning
        setTimeout(onAnimationComplete, 1500); 
      }
    }, 50); // Speed of typing

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [onAnimationComplete, fullText, playVoice]);

  return (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`text-2xl ${colors.text} min-h-[10rem]`}>
        {displayText}
        <span className="inline-block w-1 h-6 bg-gray-100 ml-1 animate-pulse"></span>
      </p>
    </div>
  );
};

// --- Steam Transition Component ---
const SteamTransition = ({ onComplete }: { onComplete: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [particles] = useState(() => 
    Array.from({ length: 40 }).map(() => ({
      left: Math.random() * 100,
      width: 30 + Math.random() * 80,
      height: 40 + Math.random() * 100,
      duration: 4 + Math.random() * 3,
      delay: Math.random() * 2,
      drift: (Math.random() - 0.5) * 40,
      blur: 8 + Math.random() * 12,
      opacity: 0.15 + Math.random() * 0.25,
    }))
  );

  useEffect(() => {
    // Show steam for 3 seconds, then fade out
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 800); // Wait for fade out animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`absolute inset-0 z-50 transition-opacity duration-800 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="relative w-full h-full bg-black overflow-hidden">
        {/* Ambient glow layer */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center bottom, rgba(255,255,255,0.1) 0%, transparent 70%)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}
        />
        
        {/* Steam particles */}
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${particle.left}%`,
              bottom: '-5%',
              width: `${particle.width}px`,
              height: `${particle.height}px`,
              background: `radial-gradient(ellipse at center, 
                rgba(255,255,255,${particle.opacity * 1.2}) 0%, 
                rgba(255,255,255,${particle.opacity * 0.8}) 20%,
                rgba(240,240,250,${particle.opacity * 0.5}) 40%, 
                rgba(220,220,240,${particle.opacity * 0.3}) 60%,
                rgba(200,200,230,${particle.opacity * 0.15}) 80%,
                transparent 100%)`,
              filter: `blur(${particle.blur}px)`,
              boxShadow: `0 0 ${particle.blur * 2}px rgba(255,255,255,${particle.opacity * 0.5})`,
              animation: `steam-rise-${i} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
        
        {/* Additional wispy layers for depth */}
        {Array.from({ length: 15 }).map((_, i) => {
          const wisp = {
            left: Math.random() * 100,
            width: 60 + Math.random() * 120,
            height: 80 + Math.random() * 150,
            duration: 5 + Math.random() * 4,
            delay: Math.random() * 2.5,
            drift: (Math.random() - 0.5) * 50,
            blur: 15 + Math.random() * 20,
            opacity: 0.08 + Math.random() * 0.12,
          };
          return (
            <div
              key={`wisp-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${wisp.left}%`,
                bottom: '-8%',
                width: `${wisp.width}px`,
                height: `${wisp.height}px`,
                background: `radial-gradient(ellipse at center, 
                  rgba(255,255,255,${wisp.opacity}) 0%, 
                  rgba(250,250,255,${wisp.opacity * 0.6}) 30%,
                  transparent 70%)`,
                filter: `blur(${wisp.blur}px)`,
                animation: `steam-rise-wisp-${i} ${wisp.duration}s cubic-bezier(0.3, 0, 0.1, 1) forwards`,
                animationDelay: `${wisp.delay}s`,
              }}
            />
          );
        })}
        
        <style>{`
          @keyframes pulse-glow {
            0%, 100% {
              opacity: 0.2;
            }
            50% {
              opacity: 0.35;
            }
          }
          
          ${particles.map((particle, i) => `
            @keyframes steam-rise-${i} {
              0% {
                transform: translateY(0) translateX(0) scale(0.8) rotate(0deg);
                opacity: 0;
              }
              10% {
                opacity: ${particle.opacity};
              }
              50% {
                transform: translateY(-45vh) translateX(${particle.drift * 0.4}px) scale(1.3) rotate(${Math.random() * 10 - 5}deg);
                opacity: ${particle.opacity * 0.8};
              }
              100% {
                transform: translateY(-100vh) translateX(${particle.drift}px) scale(2.2) rotate(${Math.random() * 20 - 10}deg);
                opacity: 0;
              }
            }
          `).join('')}
          
          ${Array.from({ length: 15 }).map((_, i) => {
            const wisp = {
              drift: (Math.random() - 0.5) * 50,
            };
            return `
              @keyframes steam-rise-wisp-${i} {
                0% {
                  transform: translateY(0) translateX(0) scale(0.6);
                  opacity: 0;
                }
                15% {
                  opacity: 0.1;
                }
                60% {
                  transform: translateY(-50vh) translateX(${wisp.drift * 0.5}px) scale(1.4);
                  opacity: 0.08;
                }
                100% {
                  transform: translateY(-110vh) translateX(${wisp.drift}px) scale(2.8);
                  opacity: 0;
                }
              }
            `;
          }).join('')}
        `}</style>
      </div>
    </div>
  );
};

// --- Animated Follow-up Question Component ---
const AnimatedFollowUpQuestion = ({ onAnimationComplete, playVoice }: { onAnimationComplete: () => void; playVoice: (text: string) => void }) => {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Welcome. To perfectly tailor this session, are you new to the sauna, or a familiar guest?";
  const animationIntervalRef = useRef<number | null>(null);
  const voicePlayedRef = useRef(false);

  useEffect(() => {
    let index = 0;
    animationIntervalRef.current = window.setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(prev => prev + fullText.charAt(index));
        index++;
        // Play voice when we're about 20% through the text
        if (index === Math.floor(fullText.length * 0.2) && !voicePlayedRef.current) {
          voicePlayedRef.current = true;
          playVoice(fullText);
        }
      } else {
        clearInterval(animationIntervalRef.current!);
        // Wait a bit after animation finishes before showing options
        setTimeout(onAnimationComplete, 1500); 
      }
    }, 50); // Speed of typing

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [onAnimationComplete, fullText, playVoice]);

  return (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`text-2xl ${colors.text} min-h-[10rem]`}>
        {displayText}
        <span className="inline-block w-1 h-6 bg-gray-100 ml-1 animate-pulse"></span>
      </p>
    </div>
  );
};


// --- Main App Component ---

function App() {
  // --- State ---
  const [appState, setAppState] = useState<AppState>('startPoint'); // Default to startPoint
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [aiCoachMessage, setAiCoachMessage] = useState<string>(''); // Default to empty
  const [sessionTime, setSessionTime] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [userExperience, setUserExperience] = useState<'newbie' | 'experienced' | null>(null); // Used for future features
  const [userGoal, setUserGoal] = useState<string>(''); // Used for session personalization
  const [recommendations, setRecommendations] = useState<string>('');
  const [harviaToken, setHarviaToken] = useState<string | null>(null);
  const [selectedTemp, setSelectedTemp] = useState<number>(75);
  const [selectedTimer, setSelectedTimer] = useState<number>(20);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [saunaReadyTime, setSaunaReadyTime] = useState<number>(0);
  const [feedback, setFeedback] = useState({
    rating: 0,
    heat: '',
    musicEnjoyment: '',
    thoughts: '',
  });
  const [showStats, setShowStats] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL = 'https://new-gifts-tie.loca.lt';

  // Harvia API Functions
  const authenticateHarvia = async () => {
    try {
      const response = await fetch(`${API_CONFIG.HARVIA_API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: API_CONFIG.HARVIA_EMAIL,
          password: API_CONFIG.HARVIA_PASSWORD,
        }),
      });
      if (!response.ok) throw new Error('Harvia authentication failed');
      const data = await response.json();
      setHarviaToken(data.token);
      return data.token;
    } catch (error) {
      console.error('Harvia auth error:', error);
      return null;
    }
  };

  const getHarviaSensorData = async () => {
    try {
      const token = harviaToken || await authenticateHarvia();
      if (!token) throw new Error('No Harvia token');

      const response = await fetch(`${API_CONFIG.HARVIA_API_BASE}/devices/sensors`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch sensor data');
      const data = await response.json();
      
      // Convert Harvia sensor data to our format
      if (data.length > 0) {
        const sensor = data[0];
        return {
          temperature: sensor.temperature || 0,
          humidity: sensor.humidity || 0,
          presence: sensor.presence || false,
          timestamp: Date.now(),
        } as SensorData;
      }
      return null;
    } catch (error) {
      console.error('Harvia sensor error:', error);
      return null;
    }
  };

  // Control Harvia device - will be used when device IDs are available from API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const controlHarviaDevice = async (deviceId: string, temperature?: number, humidity?: number) => {
    try {
      const token = harviaToken || await authenticateHarvia();
      if (!token) throw new Error('No Harvia token');

      const body: any = {};
      if (temperature !== undefined) body.targetTemperature = temperature;
      if (humidity !== undefined) body.targetHumidity = humidity;

      const response = await fetch(`${API_CONFIG.HARVIA_API_BASE}/devices/${deviceId}/control`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return response.ok;
    } catch (error) {
      console.error('Harvia control error:', error);
      return false;
    }
  };

  // AI Recommendation Functions
  const getNewbieRecommendations = async (sensorData: SensorData | null) => {
    try {
      const sensorInfo = sensorData 
        ? `Current sauna conditions: Temperature ${sensorData.temperature}°C, Humidity ${sensorData.humidity}%. `
        : '';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are SaunaSensAI, a warm and encouraging sauna wellness coach. Provide beginner-friendly sauna advice with specific recommended settings (temperature, humidity, duration) and helpful tips for first-time sauna users. Keep it concise, warm, and practical.',
            },
            {
              role: 'user',
              content: `${sensorInfo}I'm new to sauna. Please recommend default settings and give me advice on sauna habits and best practices.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) throw new Error('AI recommendation failed');
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI recommendation error:', error);
      return 'Welcome to sauna! I recommend starting with 60-70°C temperature and 10-20% humidity for 10-15 minutes. Remember to stay hydrated, listen to your body, and take breaks when needed.';
    }
  };

  const getGoalFollowUp = async (sensorData: SensorData | null) => {
    try {
      const sensorInfo = sensorData 
        ? `Current sauna conditions: Temperature ${sensorData.temperature}°C, Humidity ${sensorData.humidity}%. `
        : '';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are SaunaSensAI, a knowledgeable sauna wellness coach. Ask the user about their specific goals for this sauna session (e.g., relaxation, recovery, performance, stress relief). Be warm and conversational.',
            },
            {
              role: 'user',
              content: `${sensorInfo}I'm experienced with sauna. What would you like to know about my goals for this session?`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (!response.ok) throw new Error('AI follow-up failed');
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI follow-up error:', error);
      return 'What would you like to achieve with this sauna session? For example, relaxation, muscle recovery, stress relief, or performance enhancement?';
    }
  };

  // Handle user response function (defined before useEffect)
  const handleUserResponse = async (response: string) => {
    if (!response.trim()) return;
    
    // Process the user's response to determine their experience level
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('new') || lowerResponse.includes('first time') || lowerResponse.includes('never')) {
      setUserExperience('newbie');
      setAppState('newbieRecommendations');
      
      // Get sensor data and generate recommendations
      const sensorData = await getHarviaSensorData();
      const recommendations = await getNewbieRecommendations(sensorData);
      setRecommendations(recommendations);
      setSensorData(sensorData);
      playVoice(recommendations);
      
    } else if (lowerResponse.includes('familiar') || lowerResponse.includes('experienced') || lowerResponse.includes('regular') || lowerResponse.includes('been here')) {
      setUserExperience('experienced');
      setAppState('experiencedFollowUp');
      
      // Get sensor data and ask follow-up question
      const sensorData = await getHarviaSensorData();
      setSensorData(sensorData);
      const followUp = await getGoalFollowUp(sensorData);
      setAiCoachMessage(followUp);
      playVoice(followUp);
      
    } else {
      // Default to experienced if unclear
      setUserExperience('experienced');
      setAppState('experiencedFollowUp');
      
      const sensorData = await getHarviaSensorData();
      setSensorData(sensorData);
      const followUp = await getGoalFollowUp(sensorData);
      setAiCoachMessage(followUp);
      playVoice(followUp);
    }
  };

  const handleGoalResponse = async (goal: string) => {
    if (!goal.trim()) return;
    setUserGoal(goal);
    // For experienced users, go to settings screen
    setAppState('experiencedSettings');
  };

  const confirmExperiencedSettings = async () => {
    // Calculate ready time based on current temp and target temp
    const currentTemp = sensorData?.temperature || 20;
    const tempDiff = Math.abs(selectedTemp - currentTemp);
    const estimatedMinutes = Math.ceil(tempDiff / 5); // Rough estimate: 5°C per minute
    setSaunaReadyTime(estimatedMinutes);
    setAppState('saunaReady');
    playVoice(`Your sauna will be ready in approximately ${estimatedMinutes} minutes. I've set the temperature to ${selectedTemp}°C and timer to ${selectedTimer} minutes.${musicEnabled ? ' Music is enabled.' : ''}`);
  };

  const startSaunaTime = async () => {
    // Use selected settings for experienced users, or default for newbies
    const goal = userExperience === 'experienced' 
      ? `${userGoal || 'Custom Session'} - ${selectedTemp}°C, ${selectedTimer}min`
      : userGoal || 'Beginner Session';
    await startSession(goal);
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
        if (appState === 'experiencedFollowUp') {
          handleGoalResponse(transcript);
        } else {
          handleUserResponse(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Core API Functions ---

  const startSession = async (goal: string) => {
    setAppState('generating');
    setAiCoachMessage('Connecting to your Harvia sensor and crafting your personalized session...');

    try {
      // Get current sensor data from Harvia
      const currentSensorData = await getHarviaSensorData() || sensorData;
      
      // Auto-tune settings based on goal and sensor data
      let targetTemp = 75; // Default
      let targetHumidity = 15; // Default
      
      // Check if user selected custom temperature (experienced users)
      if (userExperience === 'experienced' && selectedTemp) {
        targetTemp = selectedTemp;
      } else if (currentSensorData) {
        // Adjust based on current conditions and goal for newbies
        if (goal.toLowerCase().includes('relax') || goal.toLowerCase().includes('stress')) {
          targetTemp = Math.min(70, currentSensorData.temperature || 70);
          targetHumidity = Math.min(20, (currentSensorData.humidity || 15) + 5);
        } else if (goal.toLowerCase().includes('recovery') || goal.toLowerCase().includes('muscle')) {
          targetTemp = Math.max(80, Math.min(90, (currentSensorData.temperature || 75) + 5));
          targetHumidity = Math.min(25, (currentSensorData.humidity || 15) + 10);
        } else if (goal.toLowerCase().includes('performance')) {
          targetTemp = Math.max(85, Math.min(95, (currentSensorData.temperature || 75) + 10));
          targetHumidity = Math.min(30, (currentSensorData.humidity || 15) + 15);
        } else {
          // Balanced session
          targetTemp = Math.max(70, Math.min(85, (currentSensorData.temperature || 75) + 5));
          targetHumidity = Math.min(25, (currentSensorData.humidity || 15) + 10);
        }
      }

      // Control Harvia device if we have a device ID (you may need to get this from the API)
      // await controlHarviaDevice('device-id', targetTemp, targetHumidity);

      const sessionResponse = await fetch(`${API_BASE_URL}/generate_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          goal, 
          durationMinutes: 20,
          targetTemperature: targetTemp,
          targetHumidity: targetHumidity,
        }),
      });
      if (!sessionResponse.ok) {
        throw new Error(`Failed to generate session: ${sessionResponse.statusText}`);
      }
      const sessionData: SessionProfile = await sessionResponse.json();
      setSessionProfile(sessionData);

      if (currentSensorData) {
        setSensorData(currentSensorData);
      }

      const welcomeMessage = `Your session, '${sessionData.title}', is ready. I've set the temperature to ${targetTemp}°C and humidity to ${targetHumidity}%. ${sessionData.phases[0].coachScript}`;
      playVoice(welcomeMessage);

      setAiCoachMessage(welcomeMessage);
      setAppState('session');
      setSessionTime(0);
      setCurrentPhaseIndex(0);
      intervalRef.current = window.setInterval(() => {
        setSessionTime(prev => prev + 5);
        pollSensorData();
      }, 5000);

    } catch (error) {
      console.error("Failed to start session:", error);
      setAppState('onboarding');
      setAiCoachMessage('Could not connect to the sauna. Please try again.');
    }
  };

  const pollSensorData = async () => {
    if (appState !== 'session' || !sessionProfile) return;

    try {
      const sensorResponse = await fetch(`${API_BASE_URL}/sensor_data`);
      if (!sensorResponse.ok) {
        console.error("Sensor poll failed:", sensorResponse.statusText);
        return;
      }
      const newSensorData: SensorData = await sensorResponse.json();
      setSensorData(newSensorData);

      const interventionResponse = await fetch(`${API_BASE_URL}/get_intervention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionProfile,
          currentSensorData: newSensorData,
          sessionTimeSeconds: sessionTime,
          currentPhaseIndex,
        }),
      });
      if (!interventionResponse.ok) {
        console.error("Intervention check failed:", interventionResponse.statusText);
        return;
      }
      const { coachMessage } = await interventionResponse.json();
      if (coachMessage) {
        playVoice(coachMessage);
        setAiCoachMessage(coachMessage);
      }

    } catch (error) {
      console.error("Poll error:", error);
    }
  };

  const playVoice = async (text: string) => {
    try {
      // Use ElevenLabs API if configured, otherwise fall back to backend
      if (API_CONFIG.USE_ELEVENLABS && API_CONFIG.ELEVENLABS_API_KEY && !API_CONFIG.ELEVENLABS_API_KEY.includes('your-')) {
        await playElevenLabsVoice(text);
      } else {
        const response = await fetch(`${API_BASE_URL}/generate_voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) {
          throw new Error(`Failed to generate voice: ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      }
    } catch (error) {
      console.error("Failed to play voice:", error);
    }
  };

  const playElevenLabsVoice = async (text: string) => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': API_CONFIG.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (error) {
      console.error("Failed to play ElevenLabs voice:", error);
      // Fallback to backend if ElevenLabs fails
      throw error;
    }
  };

  const stopSession = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setAppState('postSaunaFeedback');
    setAiCoachMessage('Welcome back! How was your sauna?');
    playVoice('Welcome back! How was your sauna?');
  };

  const handleFeedbackSubmit = () => {
    // After submitting feedback, ask about statistics
    setAppState('askStatistics');
  };

  const handleStatisticsQuestion = (show: boolean) => {
    setShowStats(show);
    if (show) {
      setAppState('showStatistics');
    } else {
      // Skip statistics, ask about recommendations
      setAppState('askRecommendations');
    }
  };

  const handleRecommendationQuestion = async (wantRecommendations: boolean) => {
    if (wantRecommendations) {
      setAppState('recommendations');
      // Generate recommendations based on feedback
      const feedbackText = `Rating: ${feedback.rating}/10. Heat: ${feedback.heat}. Music: ${feedback.musicEnjoyment}. Thoughts: ${feedback.thoughts}`;
      const recs = await generateFeedbackRecommendations(feedbackText);
      setRecommendations(recs);
      playVoice(recs);
    } else {
      setAppState('summary');
      setAiCoachMessage('Thank you for using SaunaSensAI! Until next time.');
      playVoice('Thank you for using SaunaSensAI! Until next time.');
    }
  };

  const generateFeedbackRecommendations = async (feedbackText: string) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are SaunaSensAI, a warm and helpful sauna wellness coach. Provide personalized recommendations based on user feedback to improve their next sauna experience.',
            },
            {
              role: 'user',
              content: `Based on this feedback: ${feedbackText}. What recommendations do you have for their next sauna session?`,
            },
          ],
          temperature: 0.7,
          max_tokens: 250,
        }),
      });

      if (!response.ok) throw new Error('AI recommendation failed');
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Feedback recommendation error:', error);
      return 'Thank you for your feedback! For your next session, I recommend adjusting the temperature based on your comfort level and staying well hydrated.';
    }
  };

  // --- UI Renderers ---

  const renderStartPoint = () => (
    <div className="flex flex-col h-full justify-center items-center p-8 text-center">
      <h1 className="text-4xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`${colors.textMuted} mb-16`}>Your personalized sauna wellness coach.</p>
      <button
        onClick={() => setAppState('welcome')}
        className={`w-full max-w-xs p-5 rounded-lg text-black text-xl font-medium transition-all hover:shadow-[0_0_25px_rgba(235,15,53,0.8),0_0_45px_rgba(235,15,53,0.5)]`}
        style={{backgroundColor: colors.accentGold}}
      >
        Start Session
      </button>
    </div>
  );

  const renderWelcome = () => {
    const handleWelcomeComplete = () => {
      setAppState('steamTransition');
    };
    return <AnimatedWelcomeText onAnimationComplete={handleWelcomeComplete} playVoice={playVoice} />;
  };

  const renderSteamTransition = () => {
    const handleTransitionComplete = () => {
      setAppState('followUpQuestion');
    };
    return (
      <>
        <div className="flex flex-col h-full justify-center p-8 text-center">
          <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
        </div>
        <SteamTransition onComplete={handleTransitionComplete} />
      </>
    );
  };

  const renderFollowUpQuestion = () => {
    const handleQuestionComplete = () => {
      setAiCoachMessage('Welcome. To perfectly tailor this session, are you new to the sauna, or a familiar guest?');
      setAppState('onboarding');
    };
    return <AnimatedFollowUpQuestion onAnimationComplete={handleQuestionComplete} playVoice={playVoice} />;
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleTextSubmit = () => {
    if (userInput.trim()) {
      if (appState === 'experiencedFollowUp') {
        handleGoalResponse(userInput);
      } else {
        handleUserResponse(userInput);
      }
      setUserInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const renderNewbieRecommendations = () => {
    // Calculate ready time
    const currentTemp = sensorData?.temperature || 20;
    const recommendedTemp = 70; // Default for newbies
    const tempDiff = Math.abs(recommendedTemp - currentTemp);
    const estimatedMinutes = Math.ceil(tempDiff / 5);
    
    return (
      <div className="flex flex-col h-full justify-between p-6">
        <div className="flex flex-col justify-center flex-1 p-8 text-center overflow-y-auto">
          <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
          
          {/* Recommended Temperature */}
          <div className={`${colors.card} rounded-lg p-6 mb-6`}>
            <p className={`text-lg ${colors.text} mb-2`}>Recommended Temperature</p>
            <p className={`text-4xl font-light ${colors.primary}`} style={{color: colors.accentGold}}>
              {recommendedTemp}°C
            </p>
          </div>

          {/* Tips */}
          <div className={`text-lg ${colors.text} mb-6 leading-relaxed text-left`}>
            <p className="font-medium mb-3">Tips for your first sauna:</p>
            {recommendations.split('\n').slice(0, 5).map((line, i) => (
              <p key={i} className="mb-2 text-base">• {line}</p>
            ))}
          </div>

          {sensorData && (
            <div className={`${colors.card} rounded-lg p-4 mb-4`}>
              <p className={`text-sm ${colors.textMuted}`}>
                Current: {Math.round(sensorData.temperature)}°C, {Math.round(sensorData.humidity)}% humidity
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t" style={{ borderColor: `${colors.accentGold}30` }}>
          <button
            onClick={() => {
              setSaunaReadyTime(estimatedMinutes);
              setAppState('saunaReady');
              playVoice(`Your sauna will be ready in approximately ${estimatedMinutes} minutes. I've set the recommended temperature to ${recommendedTemp}°C.`);
            }}
            className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
            style={{backgroundColor: colors.accentGold}}
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  const renderExperiencedFollowUp = () => (
    <div className="flex flex-col h-full justify-between p-6">
      <div className="flex flex-col justify-center flex-1 p-8 text-center">
        <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
        <p className={`${colors.textMuted} mb-8 min-h-[2rem] text-xl`}>
          {aiCoachMessage || 'What would you like to achieve with this sauna session?'}
        </p>
        {sensorData && (
          <div className={`${colors.card} rounded-lg p-4 mb-4`}>
            <p className={`text-sm ${colors.textMuted}`}>
              Current: {Math.round(sensorData.temperature)}°C, {Math.round(sensorData.humidity)}% humidity
            </p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t" style={{ borderColor: `${colors.accentGold}30` }}>
        <div className="flex gap-2 items-center mb-2">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your goal..."
            className={`flex-1 p-3 rounded-lg ${colors.card} border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
            style={{ color: colors.text }}
          />
          
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-lg transition-all ${
              isListening
                ? 'bg-red-600'
                : `${colors.card} border ${colors.border} hover:border-[#eb0f35]`
            }`}
            style={{
              boxShadow: isListening ? `0 0 20px ${colors.accentGold}60` : 'none',
            }}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
              style={{ color: colors.text }}
            >
              {isListening ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8"
                  />
                </>
              )}
            </svg>
          </button>

          <button
            onClick={handleTextSubmit}
            disabled={!userInput.trim()}
            className={`p-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colors.primaryBg} text-black`}
            style={{
              boxShadow: `0 0 20px ${colors.accentGold}40`,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
        {isListening && (
          <p className="text-sm text-center" style={{ color: colors.accentGold }}>
            Listening... Speak now
          </p>
        )}
      </div>
    </div>
  );

  const ExperienceButton = ({ icon, text, onClick }: { icon: React.ReactNode, text: string, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`w-full ${colors.card} border ${colors.border} rounded-lg p-6 flex items-center space-x-4 transition-all hover:border-[#eb0f35] hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
    >
      <div className={`p-3 rounded-full ${colors.bg} ${colors.primary}`}>
        {icon}
      </div>
      <span className="text-lg font-medium text-white">{text}</span>
    </button>
  );

  const renderOnboarding = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-4">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`${colors.textMuted} mb-12 min-h-[2rem]`}>
        {aiCoachMessage || 'Welcome. To perfectly tailor this session, are you new to the sauna, or a familiar guest?'}
      </p>
      <div className="grid grid-cols-1 gap-4">
        <ExperienceButton 
          icon={<SunIcon />} 
          text="New to Sauna" 
          onClick={async () => {
            setUserExperience('newbie');
            setAppState('newbieRecommendations');
            const sensorData = await getHarviaSensorData();
            const recommendations = await getNewbieRecommendations(sensorData);
            setRecommendations(recommendations);
            setSensorData(sensorData);
            playVoice(recommendations);
          }} 
        />
        <ExperienceButton 
          icon={<MoonIcon />} 
          text="Familiar Guest" 
          onClick={async () => {
            setUserExperience('experienced');
            setAppState('experiencedFollowUp');
            const sensorData = await getHarviaSensorData();
            setSensorData(sensorData);
            const followUp = await getGoalFollowUp(sensorData);
            setAiCoachMessage(followUp);
            playVoice(followUp);
          }} 
        />
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="flex flex-col h-full justify-center items-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-4">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <div className="w-16 h-16 border-4 border-t-[#eb0f35] border-zinc-800 rounded-full animate-spin mb-8"></div>
      <p className={`${colors.textMuted} max-w-xs`}>{aiCoachMessage}</p>
    </div>
  );

  const renderSession = () => {
    if (!sessionProfile || !sensorData) return renderGenerating();

    const phaseIndex = Math.min(currentPhaseIndex, sessionProfile.phases.length - 1);
    const currentPhase = sessionProfile.phases[phaseIndex];
    if (!currentPhase) {
      console.error("Current phase is undefined.");
      return renderGenerating();
    }

    const totalDuration = sessionProfile.totalDurationMinutes * 60;
    const progress = totalDuration > 0 ? (sessionTime / totalDuration) * 100 : 0;

    return (
      <div className="flex flex-col h-full justify-between p-6">
        <div>
          <h2 className="text-lg font-medium text-white">{sessionProfile.title}</h2>
          <p className={`${colors.textMuted} capitalize`}>{currentPhase.type} Phase</p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4 my-8">
          <div
            className="w-48 h-48 rounded-full border-8 border-zinc-800 flex items-center justify-center text-white"
            style={{
              background: `conic-gradient(${colors.accentGold} ${progress}%, ${colors.card} ${progress}%)`
            }}
          >
            <div className={`w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-full ${colors.bg} flex flex-col items-center justify-center`}>
              <span className="text-6xl font-light" style={{color: colors.accentGold}}>{Math.round(sensorData.temperature)}°</span>
              <span className={`text-lg ${colors.textMuted}`}>C</span>
            </div>
          </div>

          <div className="flex space-x-8">
            <div className="text-center">
              <span className={`text-2xl font-medium ${colors.text}`}>
                {Math.round(sensorData.humidity)}<span className="text-sm">%</span>
              </span>
              <p className={`${colors.textMuted} text-xs`}>Humidity</p>
            </div>
            <div className="text-center">
              <span className={`text-2xl font-medium ${colors.text}`}>
                {Math.floor(sessionTime / 60)}:{(sessionTime % 60).toString().padStart(2, '0')}
              </span>
              <p className={`${colors.textMuted} text-xs`}>Time</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`p-4 ${colors.card} rounded-lg text-center min-h-[4rem] flex items-center justify-center`}>
            <p className={colors.text}>{aiCoachMessage}</p>
          </div>
          <button
            onClick={stopSession}
            className={`w-full p-4 rounded-lg bg-red-600 text-white text-lg font-medium flex items-center justify-center space-x-2 transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
            
          >
            <StopIcon />
            <span>End Session</span>
          </button>
        </div>
      </div>
    );
  };

  const renderExperiencedSettings = () => (
    <div className="flex flex-col h-full justify-between p-6">
      <div className="flex flex-col justify-center flex-1 p-8 text-center overflow-y-auto">
        <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
        
        {/* Set Temperature */}
        <div className={`${colors.card} rounded-lg p-6 mb-6`}>
          <p className={`text-lg ${colors.text} mb-6`}>Set Temperature</p>
          <div className="mb-4">
            <span className={`text-5xl font-light ${colors.primary}`} style={{color: colors.accentGold}}>
              {selectedTemp}°C
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="100"
            step="5"
            value={selectedTemp}
            onChange={(e) => setSelectedTemp(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${colors.accentGold} 0%, ${colors.accentGold} ${((selectedTemp - 60) / 40) * 100}%, #27272a ${((selectedTemp - 60) / 40) * 100}%, #27272a 100%)`,
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{color: colors.textMuted}}>
            <span>60°C</span>
            <span>100°C</span>
          </div>
        </div>

        {/* Set Timer */}
        <div className={`${colors.card} rounded-lg p-6 mb-6`}>
          <p className={`text-lg ${colors.text} mb-6`}>Set Timer</p>
          <div className="mb-4">
            <span className={`text-5xl font-light ${colors.primary}`} style={{color: colors.accentGold}}>
              {selectedTimer} min
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            step="5"
            value={selectedTimer}
            onChange={(e) => setSelectedTimer(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${colors.accentGold} 0%, ${colors.accentGold} ${((selectedTimer - 5) / 55) * 100}%, #27272a ${((selectedTimer - 5) / 55) * 100}%, #27272a 100%)`,
            }}
          />
          <div className="flex justify-between text-xs mt-2" style={{color: colors.textMuted}}>
            <span>5 min</span>
            <span>60 min</span>
          </div>
        </div>

        {/* Music Toggle */}
        <div className={`${colors.card} rounded-lg p-6 mb-4`}>
          <p className={`text-lg ${colors.text} mb-4`}>Music Involved?</p>
          <button
            onClick={() => setMusicEnabled(!musicEnabled)}
            className={`w-full p-4 rounded-lg transition-all border-2 ${
              musicEnabled 
                ? `${colors.primaryBg} border-[#eb0f35]` 
                : `${colors.border} border hover:border-[#eb0f35]`
            }`}
            style={{
              color: musicEnabled ? 'black' : colors.text,
              backgroundColor: musicEnabled ? colors.accentGold : 'transparent',
              boxShadow: musicEnabled ? `0 0 20px ${colors.accentGold}40` : 'none',
            }}
          >
            {musicEnabled ? '✓ Music Enabled' : 'Enable Music'}
          </button>
        </div>
      </div>

      <div className="p-4 border-t" style={{ borderColor: `${colors.accentGold}30` }}>
        <p className={`text-sm ${colors.textMuted} mb-4 text-center`}>
          These are your chosen settings. Confirm?
        </p>
        <button
          onClick={confirmExperiencedSettings}
          className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
          style={{backgroundColor: colors.accentGold}}
        >
          Confirm
        </button>
      </div>
    </div>
  );

  const renderSaunaReady = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <div className={`${colors.card} rounded-lg p-8 mb-8`}>
        <p className={`text-2xl ${colors.text} mb-4`}>Sauna will be ready in</p>
        <p className={`text-6xl font-light ${colors.primary}`} style={{color: colors.accentGold}}>
          {saunaReadyTime}
        </p>
        <p className={`text-xl ${colors.textMuted} mt-2`}>minutes</p>
      </div>
      <button
        onClick={startSaunaTime}
        className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
        style={{backgroundColor: colors.accentGold}}
      >
        Sauna Time! 🕒
      </button>
    </div>
  );

  const renderPostSaunaFeedback = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`text-2xl ${colors.text} mb-12`}>
        {aiCoachMessage || 'Welcome back! How was your sauna?'}
      </p>
      <button
        onClick={handleFeedbackSubmit}
        className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
        style={{backgroundColor: colors.accentGold}}
      >
        Share Feedback
      </button>
    </div>
  );

  const renderFeedbackQuestions = () => (
    <div className="flex flex-col h-full justify-between p-6 overflow-y-auto">
      <div className="flex flex-col flex-1 p-6">
        <h1 className="text-2xl font-light text-white mb-6 text-center">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
        
        {/* Question 1: Rating */}
        <div className={`${colors.card} rounded-lg p-4 mb-4`}>
          <p className={`text-lg ${colors.text} mb-3`}>1. Rate overall sauna experience (1-10)</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setFeedback({...feedback, rating: num})}
                className={`w-10 h-10 rounded-lg transition-all ${
                  feedback.rating === num ? colors.primaryBg : `${colors.border} border`
                }`}
                style={{
                  color: feedback.rating === num ? 'black' : colors.text,
                  backgroundColor: feedback.rating === num ? colors.accentGold : 'transparent',
                }}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Heat */}
        <div className={`${colors.card} rounded-lg p-4 mb-4`}>
          <p className={`text-lg ${colors.text} mb-3`}>2. How was the heat?</p>
          <div className="flex flex-col gap-2">
            {['Not enough', 'Just right', 'Too hot'].map((option) => (
              <button
                key={option}
                onClick={() => setFeedback({...feedback, heat: option})}
                className={`p-3 rounded-lg transition-all text-left ${
                  feedback.heat === option ? colors.primaryBg : `${colors.border} border`
                }`}
                style={{
                  color: feedback.heat === option ? 'black' : colors.text,
                  backgroundColor: feedback.heat === option ? colors.accentGold : 'transparent',
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Question 3: Music (if enabled) */}
        {musicEnabled && (
          <div className={`${colors.card} rounded-lg p-4 mb-4`}>
            <p className={`text-lg ${colors.text} mb-3`}>3. Did you enjoy the music? *</p>
            <div className="flex gap-2">
              {['Yes', 'No'].map((option) => (
                <button
                  key={option}
                  onClick={() => setFeedback({...feedback, musicEnjoyment: option})}
                  className={`flex-1 p-3 rounded-lg transition-all ${
                    feedback.musicEnjoyment === option ? colors.primaryBg : `${colors.border} border`
                  }`}
                  style={{
                    color: feedback.musicEnjoyment === option ? 'black' : colors.text,
                    backgroundColor: feedback.musicEnjoyment === option ? colors.accentGold : 'transparent',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Question 4: Thoughts */}
        <div className={`${colors.card} rounded-lg p-4 mb-4`}>
          <p className={`text-lg ${colors.text} mb-3`}>4. What are your thoughts on this sauna experience?</p>
          <textarea
            value={feedback.thoughts}
            onChange={(e) => setFeedback({...feedback, thoughts: e.target.value})}
            placeholder="Share your thoughts..."
            className={`w-full p-3 rounded-lg ${colors.bg} border ${colors.border} focus:border-[#eb0f35] focus:outline-none focus:ring-2 focus:ring-[#eb0f35]/50`}
            style={{ color: colors.text, minHeight: '100px' }}
          />
        </div>
      </div>

      <div className="p-4 border-t" style={{ borderColor: `${colors.accentGold}30` }}>
        <button
          onClick={handleFeedbackSubmit}
          disabled={!feedback.rating || !feedback.heat}
          className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
          style={{backgroundColor: colors.accentGold}}
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );

  const renderAskStatistics = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`text-2xl ${colors.text} mb-12`}>
        Would you like to see some statistics from your visit?
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => handleStatisticsQuestion(true)}
          className={`flex-1 p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
          style={{backgroundColor: colors.accentGold}}
        >
          Yes
        </button>
        <button
          onClick={() => handleStatisticsQuestion(false)}
          className={`flex-1 p-4 rounded-lg border ${colors.border} text-lg font-medium transition-all hover:border-[#eb0f35]`}
          style={{color: colors.text}}
        >
          No
        </button>
      </div>
    </div>
  );

  const renderAskRecommendations = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <p className={`text-2xl ${colors.text} mb-12`}>
        Would you like to get recommendations based on your review?
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => handleRecommendationQuestion(true)}
          className={`flex-1 p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
          style={{backgroundColor: colors.accentGold}}
        >
          Yes
        </button>
        <button
          onClick={() => handleRecommendationQuestion(false)}
          className={`flex-1 p-4 rounded-lg border ${colors.border} text-lg font-medium transition-all hover:border-[#eb0f35]`}
          style={{color: colors.text}}
        >
          No
        </button>
      </div>
    </div>
  );

  const renderShowStatistics = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center overflow-y-auto">
      <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
      <div className={`${colors.card} rounded-lg p-6 mb-8`}>
        <h3 className="text-xl text-white mb-6">Session Statistics</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className={colors.textMuted}>Duration</span>
            <span className={`text-2xl font-medium ${colors.text}`}>{Math.round(sessionTime / 60)} min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={colors.textMuted}>Peak Temperature</span>
            <span className={`text-2xl font-medium ${colors.text}`}>{sensorData?.temperature ? Math.round(sensorData.temperature) : '...'}°C</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={colors.textMuted}>Average Humidity</span>
            <span className={`text-2xl font-medium ${colors.text}`}>{sensorData?.humidity ? Math.round(sensorData.humidity) : '...'}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={colors.textMuted}>Experience Rating</span>
            <span className={`text-2xl font-medium ${colors.text}`}>{feedback.rating}/10</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => setAppState('askRecommendations')}
        className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
        style={{backgroundColor: colors.accentGold}}
      >
        Continue
      </button>
    </div>
  );

  const renderRecommendations = () => (
    <div className="flex flex-col h-full justify-between p-6">
      <div className="flex flex-col justify-center flex-1 p-8 text-center overflow-y-auto">
        <h1 className="text-3xl font-light text-white mb-8">Sauna Sens<span style={{color: colors.accentGold}}>AI</span></h1>
        <div className={`text-lg ${colors.text} mb-8 leading-relaxed text-left`}>
          {recommendations.split('\n').map((line, i) => (
            <p key={i} className="mb-4">{line}</p>
          ))}
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: `${colors.accentGold}30` }}>
        <button
          onClick={() => {
            setAppState('summary');
            setAiCoachMessage('Thank you for using SaunaSensAI! Until next time.');
            playVoice('Thank you for using SaunaSensAI! Until next time.');
          }}
          className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
          style={{backgroundColor: colors.accentGold}}
        >
          Done
        </button>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="flex flex-col h-full justify-center p-8 text-center">
      <h1 className="text-3xl font-light text-white mb-2">Thank You!</h1>
      <p className="text-xl font-medium mb-8" style={{color: colors.accentGold}}>
        {aiCoachMessage || 'Thank you for using SaunaSensAI! Until next time.'}
      </p>
      <button
        onClick={() => {
          setAppState('startPoint');
          setAiCoachMessage('');
          setFeedback({ rating: 0, heat: '', musicEnjoyment: '', thoughts: '' });
          setUserInput('');
        }}
        className={`w-full p-4 rounded-lg text-black text-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(235,15,53,0.8),0_0_40px_rgba(235,15,53,0.4)]`}
        style={{backgroundColor: colors.accentGold}}
      >
        Start New Session
      </button>
    </div>
  );

  const renderContent = () => {
    switch (appState) {
      case 'startPoint': return renderStartPoint();
      case 'welcome': return renderWelcome();
      case 'steamTransition': return renderSteamTransition();
      case 'followUpQuestion': return renderFollowUpQuestion();
      case 'onboarding': return renderOnboarding();
      case 'newbieRecommendations': return renderNewbieRecommendations();
      case 'experiencedFollowUp': return renderExperiencedFollowUp();
      case 'experiencedSettings': return renderExperiencedSettings();
      case 'saunaReady': return renderSaunaReady();
      case 'generating': return renderGenerating();
      case 'session': return renderSession();
      case 'postSaunaFeedback': return renderPostSaunaFeedback();
      case 'feedbackQuestions': return renderFeedbackQuestions();
      case 'askStatistics': return renderAskStatistics();
      case 'showStatistics': return renderShowStatistics();
      case 'askRecommendations': return renderAskRecommendations();
      case 'recommendations': return renderRecommendations();
      case 'summary': return renderSummary();
      default: return renderStartPoint();
    }
  };

  return (
    <div className="h-screen w-screen flex justify-center items-center bg-zinc-950 p-4">
      <main className={`relative w-full max-w-sm h-[800px] max-h-[90vh] ${colors.bg} ${colors.text} rounded-3xl shadow-2xl overflow-hidden border-4 ${colors.border}`}>
        {renderContent()}
        <audio ref={audioRef} hidden />
      </main>
    </div>
  );
}

export default App;