
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Language, UserProfile, ClassRoutine, SECTIONS } from './types';
import { translations } from './translations';

// Pre-defined list of exactly 20 authorized Teacher IDs with the correct prefix "NUHS"
const AUTHORIZED_TEACHER_IDS = Array.from({ length: 20 }, (_, i) => `NUHS${i + 1}`);

// --- Components ---

const AppLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  return (
    <div className="flex flex-col items-center justify-center bg-white p-2">
      <div className={`${isLarge ? 'text-6xl mb-2' : isSmall ? 'text-lg' : 'text-3xl mb-1'} text-[#008080]`}>
        <i className="fas fa-graduation-cap"></i>
      </div>
      <div className={`${isLarge ? 'text-2xl' : isSmall ? 'text-[8px]' : 'text-sm'} font-black text-[#008080] tracking-widest leading-none`}>
        T.S.R
      </div>
      <div className={`${isLarge ? 'text-4xl' : isSmall ? 'text-[10px]' : 'text-lg'} font-black text-black tracking-tight leading-tight`}>
        N.U.H.S
      </div>
      {!isSmall && (
        <div className={`${isLarge ? 'text-[8px] mt-2' : 'text-[6px] mt-1'} font-bold text-gray-300 uppercase tracking-[0.3em]`}>
          MR M.H.R 2026
        </div>
      )}
    </div>
  );
};

const Header: React.FC<{ 
  lang: Language, 
  onToggleLang: () => void,
  onGoBack: () => void,
  showBack: boolean,
  user?: UserProfile 
}> = ({ lang, onToggleLang, onGoBack, showBack, user }) => {
  const t = translations[lang];
  return (
    <div className="bg-white text-gray-800 p-3 shadow-sm border-b sticky top-0 z-50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onGoBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
        )}
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <div className="flex flex-col ml-1">
            <h1 className="text-xs font-black leading-tight truncate w-32 md:w-auto text-[#008080] uppercase tracking-tighter">{t.title}</h1>
            <span className="text-[9px] font-bold text-gray-400">T.S.R Official</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={onToggleLang}
          className="text-[10px] font-black border border-gray-200 px-2 py-1 rounded bg-gray-50 text-gray-600 shadow-sm"
        >
          {lang === 'en' ? 'BN' : 'EN'}
        </button>
        {user?.profilePic && (
          <img src={user.profilePic} alt="Profile" className="w-9 h-9 rounded-xl border-2 border-[#008080]/20 object-cover shadow-sm" />
        )}
      </div>
    </div>
  );
};

const AlarmOverlay: React.FC<{ routine: ClassRoutine, onDismiss: () => void, lang: Language }> = ({ routine, onDismiss, lang }) => {
  const t = translations[lang];
  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 text-gray-800 text-center animate-in fade-in duration-300">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-[#008080] rounded-full animate-ping opacity-10"></div>
        <div className="relative z-10 scale-125">
          <AppLogo size="lg" />
        </div>
      </div>
      <h2 className="text-4xl font-black mb-2 text-[#008080]">CLASS TIME</h2>
      <div className="text-2xl font-bold bg-gray-100 px-6 py-2 rounded-2xl mb-6 border border-gray-200">
        Class {routine.className} — {routine.section}
      </div>
      <p className="text-xl mb-8 font-medium text-gray-500">{routine.subject}</p>
      
      <div className="bg-gray-50 text-gray-800 p-6 rounded-3xl w-full max-w-sm mb-12 shadow-inner border border-gray-100 text-left border-l-8 border-[#008080]">
         <p className="text-xs font-black uppercase tracking-widest text-[#008080] mb-2">{t.homework}</p>
         <p className="text-lg italic font-semibold">"{routine.homework || 'Review previous lesson'}"</p>
      </div>

      <button 
        onClick={onDismiss}
        className="bg-black text-white font-black py-5 px-16 rounded-2xl text-xl shadow-xl active:scale-95 transition-transform"
      >
        Dismiss Alarm
      </button>
      
      <audio autoPlay loop src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />
    </div>
  );
};

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'lang' | 'login' | 'signup' | 'dashboard' | 'profile' | 'routine' | 'scanner' | 'qa' | 'about'>('lang');
  const [lang, setLang] = useState<Language>('en');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfilePic, setTempProfilePic] = useState<string>("");
  const [teacherNotes, setTeacherNotes] = useState<string>("");
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [routines, setRoutines] = useState<ClassRoutine[]>([]);
  const [loading, setLoading] = useState(false);
  const [qaResult, setQaResult] = useState<{question: string, answer: string} | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [triggeredAlarm, setTriggeredAlarm] = useState<ClassRoutine | null>(null);
  const [selectedClassInModal, setSelectedClassInModal] = useState<string>("6");
  
  const lastTriggeredRef = useRef<string>("");
  const t = translations[lang];

  // Robust initialization of Gemini API for production/Netlify environment
  const getAI = () => {
    // In Netlify, environment variables are injected at build time 
    // or through the process.env object in modern ESM loaders.
    const apiKey = process.env.API_KEY || (window as any).API_KEY;
    
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      const errorMsg = lang === 'bn' 
        ? "API কী পাওয়া যায়নি। দয়া করে Netlify ড্যাশবোর্ডে API_KEY সেট করুন।" 
        : "API Key missing. Please configure API_KEY in your Netlify Dashboard settings.";
      throw new Error(errorMsg);
    }
    return new GoogleGenAI({ apiKey });
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('nuhs_user');
    const savedRoutines = localStorage.getItem('nuhs_routines');
    const savedNotes = localStorage.getItem('nuhs_teacher_notes');
    const savedLang = localStorage.getItem('nuhs_lang') as Language;

    if (savedLang) setLang(savedLang);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setTempProfilePic(parsedUser.profilePic || "");
        setCurrentScreen('dashboard');
      } catch (e) {
        console.error("Failed to parse user data");
      }
    }
    if (savedRoutines) {
      try {
        setRoutines(JSON.parse(savedRoutines));
      } catch (e) {
        console.error("Failed to parse routines");
      }
    }
    if (savedNotes) setTeacherNotes(savedNotes);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('nuhs_user', JSON.stringify(user));
    }
    localStorage.setItem('nuhs_routines', JSON.stringify(routines));
    localStorage.setItem('nuhs_teacher_notes', teacherNotes);
    localStorage.setItem('nuhs_lang', lang);
  }, [user, routines, teacherNotes, lang]);

  useEffect(() => {
    const nowStr = currentTime.toTimeString().slice(0, 5);
    const activeRoutine = routines.find(r => r.alarmActive && r.time === nowStr);
    
    if (activeRoutine && lastTriggeredRef.current !== activeRoutine.id + nowStr) {
      setTriggeredAlarm(activeRoutine);
      lastTriggeredRef.current = activeRoutine.id + nowStr;
    }
  }, [currentTime, routines]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setTempProfilePic(base64String);
        if (user && currentScreen === 'profile') {
          setUser({ ...user, profilePic: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setScanResult(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const ai = getAI();
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: file.type } },
                { text: "Read all the text visible in this image and return only the text. If it is a URL, just return the URL." }
              ]
            }
          });
          setScanResult(response.text || "No text found.");
        } catch (innerErr: any) {
          setScanResult(innerErr.message);
        } finally {
          setLoading(false);
        }
      };
    } catch (err: any) {
      setScanResult(err.message || "Scanning failed.");
      setLoading(false);
    }
  };

  const handleSignup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = (data.get('id') as string).toUpperCase().trim();
    const pass = data.get('password') as string;
    
    if (!AUTHORIZED_TEACHER_IDS.includes(id)) {
      alert(lang === 'bn' ? "আপনি এই অ্যাপটি ব্যবহার করার জন্য অনুমোদিত নন" : "You are not authorized to use this app");
      return;
    }

    if (pass.length !== 6) {
      alert(lang === 'bn' ? "পাসওয়ার্ড অবশ্যই ৬ ডিজিটের হতে হবে!" : "Password must be exactly 6 digits!");
      return;
    }

    const newUser: UserProfile = {
      id,
      name: data.get('name') as string,
      subject: data.get('subject') as string,
      password: pass,
      profilePic: tempProfilePic || 'https://i.pravatar.cc/150?u=' + id,
      notes: ''
    };
    setUser(newUser);
    setCurrentScreen('dashboard');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = loginId.toUpperCase().trim();

    if (!AUTHORIZED_TEACHER_IDS.includes(id)) {
      alert(lang === 'bn' ? "আপনি এই অ্যাপটি ব্যবহার করার জন্য অনুমোদিত নন" : "You are not authorized to use this app");
      return;
    }

    if (user && id === user.id && password === user.password) {
      setCurrentScreen('dashboard');
    } else {
      alert(lang === 'bn' ? "আইডি অথবা পাসওয়ার্ড ভুল!" : "Invalid ID or Password!");
    }
  };

  const handleProfileUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!user) return;
    setUser({
      ...user,
      name: data.get('name') as string,
      subject: data.get('subject') as string,
      notes: data.get('notes') as string,
      profilePic: tempProfilePic
    });
    setIsEditingProfile(false);
  };

  const handleAskAI = async (query: string) => {
    if (!query) return;
    setLoading(true);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: query }] }],
        config: { systemInstruction: "Provide a quick, professional answer for a high school teacher in Bangladesh." }
      });
      setQaResult({ question: query, answer: response.text || "No data." });
    } catch (err: any) {
      setQaResult({ question: query, answer: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (currentScreen === 'lang') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-gray-800">
        <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center">
          <AppLogo size="lg" />
          <div className="mt-16 w-full max-w-xs space-y-4">
            <button onClick={() => { setLang('en'); setCurrentScreen('login'); }} className="w-full bg-[#008080] text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all text-lg">English Portal</button>
            <button onClick={() => { setLang('bn'); setCurrentScreen('login'); }} className="w-full bg-black text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all text-lg">বাংলা পোর্টাল</button>
          </div>
          <p className="mt-12 text-[10px] font-black uppercase tracking-[0.4em] text-gray-200">NUHS Smart System</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {triggeredAlarm && <AlarmOverlay routine={triggeredAlarm} lang={lang} onDismiss={() => setTriggeredAlarm(null)} />}
      
      <Header 
        lang={lang} 
        onToggleLang={() => setLang(l => l === 'en' ? 'bn' : 'en')} 
        onGoBack={() => currentScreen === 'dashboard' ? setCurrentScreen('lang') : setCurrentScreen('dashboard')} 
        showBack={true} 
        user={user || undefined} 
      />

      <main className="flex-1 p-5 max-w-4xl mx-auto w-full pb-36">
        
        {currentScreen === 'login' && (
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 max-w-md mx-auto text-center">
            <h2 className="text-4xl font-black text-gray-800 mb-2">{t.login}</h2>
            <p className="text-gray-400 font-bold mb-10">Restricted Access Portal</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input required type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Authorized ID (e.g. NUHS1)" className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white focus:border-[#008080] outline-none transition-all font-bold uppercase" />
              <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={t.password} className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white focus:border-[#008080] outline-none transition-all font-bold" />
              <button type="submit" className="w-full bg-[#008080] text-white font-black py-5 rounded-3xl shadow-xl mt-4 active:scale-95 transition-all">Enter Dashboard</button>
            </form>
            <p className="text-center mt-8 text-gray-500 font-bold">New Teacher? <button onClick={() => { setTempProfilePic(""); setCurrentScreen('signup'); }} className="text-[#008080] underline">Create Account</button></p>
          </div>
        )}

        {currentScreen === 'signup' && (
          <div className="mt-6 max-w-md mx-auto">
            <h2 className="text-4xl font-black text-gray-800 mb-2 text-center">{t.signup}</h2>
            <p className="text-gray-400 font-bold mb-8 text-center uppercase tracking-widest text-[10px]">Verify Authorized NUHS ID</p>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="w-32 h-32 bg-gray-100 rounded-[40px] flex items-center justify-center text-gray-300 overflow-hidden border-4 border-white shadow-xl">
                    {tempProfilePic ? <img src={tempProfilePic} className="w-full h-full object-cover" /> : <i className="fas fa-user text-4xl"></i>}
                  </div>
                  <label className="absolute -bottom-2 -right-2 bg-[#008080] text-white w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-white cursor-pointer shadow-lg active:scale-90 transition-all">
                    <i className="fas fa-camera text-sm"></i>
                    <input type="file" onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                  </label>
                </div>
              </div>
              <input name="name" required placeholder={t.name} className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white font-bold" />
              <input name="id" required placeholder="NUHS ID (NUHS1 to NUHS20)" className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white font-bold uppercase" />
              <input name="subject" required placeholder={t.subject} className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white font-bold" />
              <input name="password" type="password" maxLength={6} required placeholder={lang === 'bn' ? "৬ ডিজিটের পাসওয়ার্ড" : "6-Digit Password"} className="w-full p-5 rounded-3xl border-2 border-gray-100 bg-white font-bold" />
              <button type="submit" className="w-full bg-black text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all">Confirm Account</button>
            </form>
          </div>
        )}

        {currentScreen === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-[#008080] p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-20 -mt-20"></div>
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <h3 className="text-2xl font-black leading-tight">Welcome,<br/>{user?.name}!</h3>
                    <p className="opacity-80 font-bold text-xs mt-1 uppercase tracking-widest">{user?.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black tracking-tighter">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <span className="text-[10px] font-black uppercase bg-black/20 px-3 py-1 rounded-lg">Real-time</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { s: 'routine', l: t.routine, i: 'fa-calendar-alt', c: 'bg-white text-[#008080]' },
                  { s: 'scanner', l: t.scanner, i: 'fa-camera', c: 'bg-white text-black' },
                  { s: 'qa', l: t.qa, i: 'fa-lightbulb', c: 'bg-white text-[#008080]' },
                  { s: 'profile', l: t.profile, i: 'fa-user-cog', c: 'bg-white text-black' },
                  { s: 'about', l: t.about, i: 'fa-info-circle', c: 'bg-white text-gray-400', colSpan: 'col-span-2' }
                ].map(item => (
                  <button key={item.s} onClick={() => setCurrentScreen(item.s as any)} className={`${item.c} ${item.colSpan || ''} p-7 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center gap-3 transition active:scale-95 group`}>
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl group-active:bg-[#008080] transition-all shadow-inner"><i className={`fas ${item.i}`}></i></div>
                    <span className="font-black text-xs uppercase tracking-tight">{item.l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-[50px] shadow-lg border border-gray-100 h-full min-h-[400px] flex flex-col">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-[#008080] text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-book"></i></div>
                 <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">{t.notebook}</h3>
               </div>
               <textarea className="flex-1 w-full p-6 bg-gray-50 rounded-[40px] text-sm font-bold text-gray-600 outline-none resize-none border-2 border-transparent focus:border-[#008080]/20 transition-all shadow-inner" placeholder={t.writeNote} value={teacherNotes} onChange={(e) => setTeacherNotes(e.target.value)}></textarea>
               <div className="mt-4 flex justify-end"><span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Autosaved</span></div>
            </div>
          </div>
        )}

        {currentScreen === 'scanner' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-gray-800">{t.scanner}</h2>
            <div className="bg-white p-12 rounded-[60px] shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-[#008080]/5 text-[#008080] rounded-[30px] flex items-center justify-center text-3xl mb-8"><i className="fas fa-expand"></i></div>
              <p className="text-gray-400 font-bold mb-8 text-sm leading-relaxed">Select a document or QR code photo from your gallery to extract information.</p>
              <label className="bg-black text-white font-black py-6 px-12 rounded-3xl cursor-pointer shadow-xl active:scale-95 transition-all w-full md:w-auto">
                {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-images mr-2"></i>}
                {t.scanGallery}
                <input type="file" accept="image/*" className="hidden" onChange={handleScanGallery} disabled={loading} />
              </label>

              {scanResult && (
                <div className="mt-12 w-full text-left animate-in fade-in slide-in-from-top-4">
                  <h4 className="text-[10px] font-black text-[#008080] uppercase tracking-widest mb-4">Scanned Result</h4>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 font-bold text-gray-700 text-sm whitespace-pre-wrap break-words min-h-[100px] shadow-inner">
                    {scanResult}
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button onClick={() => { navigator.clipboard.writeText(scanResult); alert("Copied!"); }} className="flex-1 py-4 bg-gray-100 rounded-2xl text-xs font-black uppercase text-gray-500 hover:bg-gray-200 transition-colors">Copy Text</button>
                    {scanResult.startsWith('http') && (
                      <a href={scanResult} target="_blank" rel="noreferrer" className="flex-1 py-4 bg-[#008080] text-white rounded-2xl text-xs font-black uppercase text-center flex items-center justify-center">Open URL</a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'qa' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-gray-800">{t.qa}</h2>
            <div className="bg-white p-8 rounded-[50px] shadow-sm space-y-5">
              <textarea id="qa_input" className="w-full p-7 bg-gray-50 border-none rounded-[40px] min-h-[160px] text-gray-700 outline-none font-bold" placeholder={t.typeQuestion}></textarea>
              <button disabled={loading} onClick={() => handleAskAI((document.getElementById('qa_input') as HTMLTextAreaElement).value)} className="w-full bg-black text-white font-black py-6 rounded-3xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                {t.ask}
              </button>
            </div>
            {qaResult && (
              <div className="bg-white p-10 rounded-[50px] shadow-xl border-l-[12px] border-[#008080] animate-in fade-in zoom-in">
                <h4 className="text-[10px] font-black text-[#008080] uppercase tracking-[0.3em] mb-4">Response</h4>
                <div className="text-gray-600 leading-relaxed font-bold text-sm bg-gray-50 p-6 rounded-3xl">{qaResult.answer}</div>
                <button onClick={() => { navigator.clipboard.writeText(qaResult.answer); alert("Copied!"); }} className="mt-8 text-xs font-black text-[#008080] uppercase flex items-center gap-2"><i className="fas fa-copy"></i> Copy Content</button>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'profile' && (
          <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-3xl font-black text-gray-800">{t.profile}</h2>
            <div className="bg-white p-10 rounded-[50px] shadow-sm text-center border border-gray-100">
              <div className="relative w-40 h-40 mx-auto mb-8">
                 <img src={tempProfilePic || user?.profilePic} className="w-full h-full rounded-[50px] border-4 border-gray-50 object-cover shadow-2xl" />
                 <label className="absolute -bottom-2 -right-2 bg-black text-white w-12 h-12 rounded-2xl flex items-center justify-center border-4 border-white cursor-pointer shadow-xl active:scale-90 transition-all">
                    <i className="fas fa-pen text-sm"></i>
                    <input type="file" onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                 </label>
              </div>
              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-3xl font-black text-gray-800">{user?.name}</h3>
                    <p className="text-[#008080] font-black text-lg">{user?.subject}</p>
                    <span className="text-[10px] font-black bg-gray-100 px-4 py-1.5 rounded-full text-gray-500 tracking-[0.2em] mt-3 inline-block">ID: {user?.id}</span>
                  </div>
                  <div className="bg-gray-50 p-7 rounded-[40px] text-left border border-gray-100">
                    <p className="text-[10px] font-black text-[#008080] uppercase mb-3 flex items-center gap-2 tracking-widest">Notes & Prayers</p>
                    <p className="text-gray-600 font-medium text-sm leading-relaxed">{user?.notes || "Personal workspace..."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setIsEditingProfile(true)} className="bg-black text-white font-black py-5 rounded-3xl flex items-center justify-center gap-2 active:scale-95 transition-all"><i className="fas fa-sliders-h"></i> Settings</button>
                    <button onClick={() => { if(confirm("Log out?")) { localStorage.clear(); window.location.reload(); } }} className="bg-gray-100 text-red-500 font-black py-5 rounded-3xl active:scale-95 transition-all">Log Out</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProfileUpdate} className="text-left space-y-5">
                   <input name="name" defaultValue={user?.name} className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold" placeholder="Name" />
                   <input name="subject" defaultValue={user?.subject} className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold" placeholder="Subject" />
                   <textarea name="notes" defaultValue={user?.notes} className="w-full p-5 bg-gray-50 border-none rounded-3xl h-40 font-bold resize-none" placeholder="Daily Notes..."></textarea>
                   <div className="flex gap-4 pt-2">
                     <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 bg-gray-100 text-gray-500 font-black py-5 rounded-3xl">Cancel</button>
                     <button type="submit" className="flex-1 bg-[#008080] text-white font-black py-5 rounded-3xl shadow-xl">Update</button>
                   </div>
                </form>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'routine' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-3xl font-black text-gray-800">{t.routine}</h2>
              <button onClick={() => document.getElementById('r_modal')!.style.display = 'block'} className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg"><i className="fas fa-plus mr-2"></i> Add Class</button>
            </div>
            <div className="space-y-4">
              {routines.map(r => (
                <div key={r.id} className="bg-white p-7 rounded-[40px] shadow-sm border border-gray-100">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-5">
                        <div className="bg-[#008080]/5 text-[#008080] p-4 rounded-3xl font-black text-2xl border border-[#008080]/10">{r.time}</div>
                        <div>
                          <h4 className="font-black text-gray-800 text-lg">Class {r.className}</h4>
                          <span className="text-[10px] font-black bg-[#008080] text-white px-2 py-0.5 rounded-lg uppercase tracking-widest">{r.section}</span>
                        </div>
                      </div>
                      <button onClick={()=>setRoutines(routines.filter(x=>x.id!==r.id))} className="text-gray-200 hover:text-red-500 p-3"><i className="fas fa-trash-alt"></i></button>
                   </div>
                   <div className="bg-gray-50 p-5 rounded-3xl mb-5 border border-dashed border-gray-200">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Homework Alert</p>
                      <p className="text-sm text-gray-700 font-semibold italic">"{r.homework || 'Standard lesson plan'}"</p>
                   </div>
                   <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={r.alarmActive} onChange={() => setRoutines(routines.map(x => x.id === r.id ? {...x, alarmActive: !x.alarmActive} : x))} className="w-6 h-6 accent-[#008080] rounded-xl cursor-pointer" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">Alarm {r.alarmActive ? 'Enabled' : 'Off'}</span>
                      </div>
                   </div>
                </div>
              ))}
            </div>
            <div id="r_modal" className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] hidden flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-md rounded-[50px] p-10 shadow-2xl animate-in zoom-in">
                  <h3 className="text-2xl font-black mb-8 text-center text-gray-800">New Schedule</h3>
                  <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    const formData = new FormData(e.currentTarget);
                    const newRoutine: ClassRoutine = {
                      id: Date.now().toString(),
                      time: formData.get('time') as string,
                      className: formData.get('className') as string,
                      section: formData.get('section') as string,
                      subject: formData.get('subject') as string,
                      homework: formData.get('homework') as string,
                      alarmActive: true,
                    };
                    setRoutines([...routines, newRoutine]);
                    document.getElementById('r_modal')!.style.display='none'; 
                  }} className="space-y-4">
                    <input name="time" type="time" required className="w-full p-5 bg-gray-50 border-none rounded-3xl font-black" />
                    <select name="className" required className="w-full p-5 bg-gray-50 border-none rounded-3xl font-black" value={selectedClassInModal} onChange={(e) => setSelectedClassInModal(e.target.value)}>
                       {['6','7','8','9','10'].map(v => <option key={v} value={v}>Class {v}</option>)}
                    </select>
                    <select name="section" required className="w-full p-5 bg-gray-50 border-none rounded-3xl font-black">
                       {(SECTIONS[selectedClassInModal] || []).map(s => <option key={`${selectedClassInModal}-${s}`} value={s}>{s}</option>)}
                    </select>
                    <input name="subject" placeholder="Subject" required className="w-full p-5 bg-gray-50 border-none rounded-3xl font-bold" />
                    <textarea name="homework" placeholder="Homework" className="w-full p-5 bg-gray-50 border-none rounded-3xl h-32 font-bold"></textarea>
                    <div className="flex gap-4 pt-4">
                       <button type="button" onClick={()=>document.getElementById('r_modal')!.style.display='none'} className="flex-1 py-5 bg-gray-100 text-gray-400 font-black rounded-3xl">Close</button>
                       <button type="submit" className="flex-1 bg-[#008080] text-white font-black py-5 rounded-3xl shadow-xl">Add</button>
                    </div>
                  </form>
               </div>
            </div>
          </div>
        )}

        {currentScreen === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in duration-500">
            <div className="bg-white p-12 rounded-[50px] text-center shadow-sm border border-gray-100 flex flex-col items-center">
              <div className="mb-8 scale-110"><AppLogo size="lg" /></div>
              <h3 className="text-2xl font-black text-gray-800">{t.creator}</h3>
              <div className="w-12 h-1 bg-[#008080] rounded-full my-4"></div>
              <p className="text-sm font-bold text-gray-400 leading-relaxed px-4 mb-8">{t.description}</p>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-gray-50 p-4 rounded-3xl">
                  <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Project</p>
                  <p className="text-xs font-black text-[#008080]">SSC 2027</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-3xl">
                  <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Version</p>
                  <p className="text-xs font-black text-[#008080]">v1.1.0 Pro</p>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t w-full"><p className="text-[8px] font-black text-gray-200 uppercase tracking-[0.5em]">MR Mehedi Hasan &copy; 2026</p></div>
            </div>
            <div className="bg-white p-10 rounded-[50px] shadow-sm border border-gray-100 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#008080] text-white rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-edit"></i></div>
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">Personal Notes</h3>
              </div>
              <textarea className="flex-1 w-full p-6 bg-gray-50 rounded-[40px] text-sm font-bold text-gray-600 outline-none resize-none shadow-inner" placeholder={t.writeNote} value={teacherNotes} onChange={(e) => setTeacherNotes(e.target.value)}></textarea>
            </div>
          </div>
        )}

      </main>

      {!['lang', 'login', 'signup'].includes(currentScreen) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center p-5 pb-10 z-[90] shadow-2xl">
           <button onClick={() => setCurrentScreen('dashboard')} className={`flex flex-col items-center gap-1.5 transition-all ${currentScreen === 'dashboard' ? 'text-[#008080] scale-110' : 'text-gray-300'}`}>
              <i className="fas fa-th-large text-xl"></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">Portal</span>
           </button>
           <button onClick={() => setCurrentScreen('routine')} className={`flex flex-col items-center gap-1.5 transition-all ${currentScreen === 'routine' ? 'text-[#008080] scale-110' : 'text-gray-300'}`}>
              <i className="fas fa-calendar-alt text-xl"></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">Routine</span>
           </button>
           <div className="w-14 h-14 bg-black rounded-3xl flex items-center justify-center text-white shadow-2xl -mt-12 border-4 border-white active:scale-90 transition-all cursor-pointer" onClick={() => setCurrentScreen('qa')}>
              <i className="fas fa-brain text-xl"></i>
           </div>
           <button onClick={() => setCurrentScreen('scanner')} className={`flex flex-col items-center gap-1.5 transition-all ${currentScreen === 'scanner' ? 'text-[#008080] scale-110' : 'text-gray-300'}`}>
              <i className="fas fa-camera text-xl"></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">Scan</span>
           </button>
           <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center gap-1.5 transition-all ${currentScreen === 'profile' ? 'text-[#008080] scale-110' : 'text-gray-300'}`}>
              <i className="fas fa-user-circle text-xl"></i>
              <span className="text-[9px] font-black uppercase tracking-tighter">Profile</span>
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
