import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Vote, 
  BarChart3, 
  User, 
  Settings, 
  Plus, 
  LogOut, 
  Moon, 
  Sun, 
  Globe, 
  ChevronRight, 
  CheckCircle2,
  X,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  FileQuestion,
  TrendingUp,
  Clock,
  Edit3,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { User as UserType, Survey, VoteResult, Language, translations } from './types';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function App() {
  const [user, setUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'uz');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');
  const [view, setView] = useState<'surveys' | 'create' | 'profile' | 'stats'>('surveys');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [currentVotes, setCurrentVotes] = useState<{ question_id: number, option_id: number }[]>([]);
  const [newSurveyQuestions, setNewSurveyQuestions] = useState<{ text: string, options: string[] }[]>([
    { text: '', options: ['', ''] }
  ]);

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [emailForCode, setEmailForCode] = useState('');
  const [isLangOpen, setIsLangOpen] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (user) fetchSurveys();
    if (user?.is_admin && view === 'profile') fetchUsers();
  }, [user, view]);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/surveys');
      const data = await res.json();
      setSurveys(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!user?.is_admin) return;
    try {
      const res = await fetch(`/api/users?admin_id=${user.id}`);
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBlockUser = async (targetId: number, isBlocked: boolean) => {
    if (!user?.is_admin) return;
    try {
      const res = await fetch(`/api/users/${targetId}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: user.id, is_blocked: isBlocked }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || t.error);
      }
    } catch (e) {
      alert(t.error);
    }
  };

  const handleDeleteUser = async (targetId: number) => {
    if (!user?.is_admin || !confirm(t.confirmDeleteUser)) return;
    try {
      const res = await fetch(`/api/users/${targetId}?admin_id=${user.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || t.error);
      }
    } catch (e) {
      alert(t.error);
    }
  };

  const handleDeleteMyAccount = async () => {
    if (!user || !confirm(t.confirmDeleteAccount)) return;
    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: { 'user-id': user.id.toString() }
      });
      if (res.ok) {
        localStorage.removeItem('user');
        setUser(null);
      } else {
        const data = await res.json();
        alert(data.error || t.error);
      }
    } catch (e) {
      alert(t.error);
    }
  };

  const sendVerificationCode = async (email: string) => {
    if (!email) return;
    setIsSendingCode(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (res.ok) {
        setIsCodeSent(true);
        setEmailForCode(email);
      } else {
        setAuthError(result.error || t.error);
      }
    } catch (e) {
      setAuthError(t.error);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    setAuthError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setUser(result.user);
        localStorage.setItem('user', JSON.stringify(result.user));
        setIsCodeSent(false);
        setEmailForCode('');
      } else {
        setAuthError(result.error || t.error);
      }
    } catch (e) {
      setAuthError(t.error);
    }
  };

  const handleVote = async (surveyId: number) => {
    if (!user || currentVotes.length === 0) return;
    try {
      const res = await fetch(`/api/surveys/${surveyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, votes: currentVotes }),
      });
      const result = await res.json();
      if (result.success) {
        fetchSurveys();
        showResults(surveyId);
        setCurrentVotes([]);
      } else {
        alert(result.error || t.error);
      }
    } catch (e) {
      alert(t.error);
    }
  };

  const showResults = async (surveyId: number) => {
    try {
      const res = await fetch(`/api/surveys/${surveyId}/results`);
      const data = await res.json();
      setResults(data);
      setSelectedSurvey(surveys.find(s => s.id === surveyId) || null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    
    const validQuestions = newSurveyQuestions.filter(q => q.text.trim() !== '');
    if (validQuestions.length === 0) {
      alert(t.atLeastOneQuestion);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      image_url: formData.get('image_url'),
      creator_id: user.id,
      admin_id: user.id, // For PUT compatibility
      questions: validQuestions.map((q, qIdx) => ({
        text: q.text,
        options: q.options.filter(o => o.trim() !== '')
      }))
    };

    const endpoint = editingSurvey ? `/api/surveys/${editingSurvey.id}` : '/api/surveys';
    const method = editingSurvey ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok) {
        setView('surveys');
        fetchSurveys();
        setNewSurveyQuestions([{ text: '', options: ['', ''] }]);
        setEditingSurvey(null);
      } else {
        alert(result.error || t.error);
      }
    } catch (e) {
      alert(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSurvey = async (id: number) => {
    console.log(`Attempting to delete survey ${id}, user:`, user);
    if (!user || !confirm(t.confirmDelete)) return;
    try {
      const res = await fetch(`/api/surveys/${id}?admin_id=${user.id}`, {
        method: 'DELETE',
      });
      console.log(`Delete response status: ${res.status}`);
      if (res.ok) {
        fetchSurveys();
      } else {
        const data = await res.json();
        console.error("Delete failed:", data);
        alert(data.error || t.error);
      }
    } catch (e) {
      console.error("Delete error:", e);
      alert(t.error);
    }
  };

  const startEditing = (survey: Survey) => {
    setEditingSurvey(survey);
    setNewSurveyQuestions(survey.questions.map(q => ({
      text: q.text,
      options: q.options.map(o => o.text)
    })));
    setView('create');
  };

  const addQuestion = () => {
    setNewSurveyQuestions([...newSurveyQuestions, { text: '', options: ['', ''] }]);
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...newSurveyQuestions];
    updated[index].text = text;
    setNewSurveyQuestions(updated);
  };

  const updateOptionText = (qIndex: number, oIndex: number, text: string) => {
    const updated = [...newSurveyQuestions];
    updated[qIndex].options[oIndex] = text;
    setNewSurveyQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...newSurveyQuestions];
    updated[qIndex].options.push('');
    setNewSurveyQuestions(updated);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F9FA] dark:bg-[#121212] relative overflow-hidden transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="minimal-card w-full max-w-[380px] p-7 relative z-10"
        >
          <div className="text-center mb-8">
            <h1 className="text-[26px] font-semibold tracking-tight text-[#212529] dark:text-white mb-1">
              {t.welcome}
            </h1>
            <p className="text-[#ADB5BD] dark:text-[#B0B0B0]/60 text-sm font-medium tracking-[1px] uppercase">
              GlassVote
            </p>
          </div>

          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium text-center"
              >
                {authError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {authMode === 'register' && (
                  <>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ADB5BD] dark:text-[#B0B0B0]/40 w-4 h-4" />
                      <input name="full_name" placeholder={t.fullName} required className="minimal-input w-full pl-11 !py-3 !text-sm !rounded-[16px]" />
                    </div>
                    <input name="phone" placeholder={t.phone} required className="minimal-input w-full !py-3 !text-sm !rounded-[16px]" />
                    <div className="flex gap-2">
                        <input 
                          name="email" 
                          type="email" 
                          placeholder={t.email} 
                          required 
                          className="minimal-input flex-1 !py-3 !text-sm !rounded-[16px]" 
                          onChange={(e) => setEmailForCode(e.target.value)}
                          readOnly={isCodeSent}
                        />
                      {!isCodeSent && (
                        <button 
                          type="button"
                          onClick={() => sendVerificationCode(emailForCode)}
                          disabled={isSendingCode || !emailForCode}
                          className="minimal-button !h-[44px] px-4 text-xs whitespace-nowrap"
                        >
                          {isSendingCode ? <Loader2 className="animate-spin" size={16} /> : t.sendCode}
                        </button>
                      )}
                    </div>
                    {isCodeSent && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-medium px-2">{t.codeSent}</p>
                        <input name="code" placeholder={t.verifyCode} required className="minimal-input w-full !py-3 !text-sm !rounded-[16px] border-green-200 dark:border-green-900/30" />
                        <button 
                          type="button"
                          onClick={() => sendVerificationCode(emailForCode)}
                          className="text-[10px] text-[#868E96] hover:text-[#2B4F6E] underline px-2"
                        >
                          {t.resendCode}
                        </button>
                      </div>
                    )}
                  </>
                )}
                
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ADB5BD] dark:text-[#B0B0B0]/40 w-4 h-4" />
                  <input name="username" placeholder={t.username} required className="minimal-input w-full pl-11 !py-3 !text-sm !rounded-[16px]" />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ADB5BD] dark:text-[#B0B0B0]/40 w-4 h-4" />
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder={t.password} 
                    required 
                    className="minimal-input w-full pl-11 pr-11 !py-3 !text-sm !rounded-[16px]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ADB5BD] dark:text-[#B0B0B0]/40 hover:text-[#212529] dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
            
            <button 
              type="submit" 
              className="minimal-button w-full mt-4 !h-[48px] text-sm"
              disabled={authMode === 'register' && !isCodeSent}
            >
              {authMode === 'login' ? t.login : t.register}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError(null);
                setIsCodeSent(false);
                setEmailForCode('');
              }}
              className="text-[#868E96] dark:text-[#B0B0B0] hover:text-[#212529] dark:hover:text-white font-normal text-base transition-all"
            >
              {authMode === 'login' ? t.register : t.login}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] text-[#212529] dark:text-white transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 minimal-nav rounded-[32px] px-8 py-4 z-50 flex items-center gap-10">
        <NavButton active={view === 'surveys'} onClick={() => setView('surveys')} icon={<Vote />} />
        <NavButton active={view === 'stats'} onClick={() => setView('stats')} icon={<BarChart3 />} />
        {user.is_admin === 1 && <NavButton active={view === 'create'} onClick={() => setView('create')} icon={<Plus />} />}
        <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<User />} />
      </nav>

      {/* Header */}
      <header className="p-6 flex justify-between items-center max-w-5xl mx-auto bg-white/40 dark:bg-[#1E1E1E]/40 backdrop-blur-2xl sticky top-0 z-40 border-b border-white/20 dark:border-white/5 transition-all duration-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2B4F6E] flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-[#2B4F6E]/20">V</div>
          <h2 className="text-xl font-light tracking-tight text-[#868E96] dark:text-[#B0B0B0]">GlassVote</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#E9ECEF] dark:border-[#3A3A3A] hover:bg-[#F1F3F5] dark:hover:bg-[#3A3A3A] transition-all group">
            {theme === 'light' ? <Moon size={20} className="text-[#868E96] group-hover:text-[#2B4F6E] transition-colors" /> : <Sun size={20} className="text-yellow-400" />}
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#E9ECEF] dark:border-[#3A3A3A] hover:bg-[#F1F3F5] dark:hover:bg-[#3A3A3A] transition-all flex items-center gap-2"
            >
              <Globe size={20} className="text-[#868E96] dark:text-[#B0B0B0]" />
              <span className="uppercase text-xs font-bold tracking-widest">{lang}</span>
            </button>
            <AnimatePresence>
              {isLangOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 bg-white dark:bg-[#1E1E1E] border border-[#F1F3F5] dark:border-[#2A2A2A] rounded-[24px] p-2 min-w-[160px] shadow-2xl z-[100]"
                >
                  {(['uz', 'ru', 'en'] as Language[]).map(l => (
                    <button 
                      key={l} 
                      onClick={() => {
                        setLang(l);
                        setIsLangOpen(false);
                      }} 
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#F8F9FA] dark:hover:bg-[#2A2A2A] uppercase text-xs font-bold tracking-widest transition-colors"
                    >
                      {l === 'uz' ? "O'zbek" : l === 'ru' ? "Русский" : "English"}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 pb-32">
        <AnimatePresence mode="wait">
          {view === 'surveys' && (
            <motion.div 
              key="surveys"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={surveys.length === 0 ? "flex flex-col items-center justify-center py-20" : "grid gap-8 md:grid-cols-2 lg:grid-cols-3"}
            >
              {loading ? (
                <div className="col-span-full flex justify-center py-32">
                  <Loader2 className="animate-spin text-[#2B4F6E] w-12 h-12" />
                </div>
              ) : surveys.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="minimal-card w-full max-w-[400px] flex flex-col items-center text-center py-12 px-8"
                >
                  <div className="w-20 h-20 rounded-full bg-[#F1F3F5] dark:bg-[#2A2A2A] flex items-center justify-center mb-6">
                    <FileQuestion size={40} className="text-[#868E96] dark:text-[#B0B0B0]" />
                  </div>
                  <h3 className="text-[22px] font-semibold text-[#212529] dark:text-white mb-2">{t.noSurveys}</h3>
                  <p className="text-base text-[#868E96] dark:text-[#B0B0B0] mb-8">{t.createFirst}</p>
                  {user.is_admin === 1 && (
                    <button 
                      onClick={() => setView('create')}
                      className="minimal-button px-10"
                    >
                      + {t.createSurvey}
                    </button>
                  )}
                </motion.div>
              ) : (
                surveys.map(s => (
                  <motion.div 
                    layout
                    key={s.id} 
                    className="minimal-card flex flex-col justify-between group hover:border-[#2B4F6E] transition-all duration-500 cursor-pointer p-6 relative" 
                  >
                    <div onClick={() => showResults(s.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0] bg-[#F8F9FA] dark:bg-[#2A2A2A] px-3 py-1 rounded-full border border-[#F1F3F5] dark:border-[#3A3A3A]">
                          {s.creator_name}
                        </span>
                        <span className="text-[9px] font-bold text-[#ADB5BD] dark:text-[#B0B0B0]/40 uppercase tracking-widest">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                      {s.image_url && (
                        <div className="w-full h-32 rounded-xl overflow-hidden mb-4">
                          <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <h3 className="text-lg font-bold mb-2 leading-tight group-hover:text-[#2B4F6E] transition-colors text-[#212529] dark:text-white">{s.title}</h3>
                      <p className="text-[#868E96] dark:text-[#B0B0B0] text-xs line-clamp-2 mb-5 font-medium leading-relaxed">{s.description}</p>
                    </div>

                    <div onClick={() => showResults(s.id)} className="flex items-center justify-between pt-4 border-t border-[#F1F3F5] dark:border-[#2A2A2A]">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-[#868E96] dark:text-[#B0B0B0] uppercase tracking-widest">
                        <CheckCircle2 size={14} className="text-[#2B4F6E]" />
                        {s.total_participants} {t.totalVotes}
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#E9ECEF] dark:border-[#3A3A3A] flex items-center justify-center group-hover:bg-[#2B4F6E] group-hover:text-white group-hover:border-[#2B4F6E] transition-all shadow-sm">
                        <ChevronRightIcon size={16} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="max-w-2xl mx-auto"
            >
              <div className="minimal-card p-8">
                <div className="flex flex-col mb-8">
                  <h2 className="text-xl font-semibold tracking-tight">{editingSurvey ? t.edit : t.createSurvey}</h2>
                  <div className="h-[2px] w-12 bg-[#2B4F6E] mt-2"></div>
                </div>
                
                <form onSubmit={handleCreateSurvey} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.title}</label>
                      <input name="title" defaultValue={editingSurvey?.title} required className="minimal-input w-full !py-2.5 !text-sm" placeholder={t.title + "..."} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.description}</label>
                      <input name="description" defaultValue={editingSurvey?.description} required className="minimal-input w-full !py-2.5 !text-sm" placeholder={t.description + "..."} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.imageUrl}</label>
                    <input name="image_url" defaultValue={editingSurvey?.image_url} className="minimal-input w-full !py-2.5 !text-sm" placeholder="https://..." />
                  </div>

                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.questions}</label>
                      <button type="button" onClick={addQuestion} className="text-[10px] font-bold uppercase tracking-widest text-[#2B4F6E] flex items-center gap-1.5 hover:underline transition-all">
                        <Plus size={14} /> {t.addQuestion}
                      </button>
                    </div>
                    
                    {newSurveyQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="p-6 rounded-2xl bg-[#F1F3F5] dark:bg-[#2A2A2A] border border-[#E9ECEF] dark:border-[#3A3A3A] space-y-6 relative group">
                        <button 
                          type="button" 
                          onClick={() => {
                            const newQs = newSurveyQuestions.filter((_, i) => i !== qIdx);
                            setNewSurveyQuestions(newQs);
                          }}
                          className="absolute top-4 right-4 text-[#868E96] dark:text-[#B0B0B0] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={18} />
                        </button>
                        
                        <div className="space-y-2">
                          <label className="text-[9px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.question} {qIdx + 1}</label>
                          <input 
                            value={q.text}
                            onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                            required 
                            className="minimal-input w-full !py-2 !text-sm" 
                            placeholder={t.question + "..."} 
                          />
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">{t.options}</label>
                            <button type="button" onClick={() => addOption(qIdx)} className="text-[9px] font-bold uppercase tracking-widest text-[#2B4F6E] hover:underline">
                              {t.addOption}
                            </button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="relative group/opt">
                                <input 
                                  value={opt}
                                  onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                                  className="minimal-input w-full text-xs" 
                                  placeholder={`${t.options} ${oIdx + 1}`} 
                                  required={oIdx <= 1} 
                                />
                                {q.options.length > 2 && (
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const newQs = [...newSurveyQuestions];
                                      newQs[qIdx].options = newQs[qIdx].options.filter((_, i) => i !== oIdx);
                                      setNewSurveyQuestions(newQs);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#868E96] dark:text-[#B0B0B0] hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-all"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6">
                    <button type="submit" disabled={isSubmitting} className="minimal-button w-full flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {editingSurvey ? t.editing : t.creating}
                        </>
                      ) : (
                        editingSurvey ? t.save : t.createSurvey
                      )}
                    </button>
                    {editingSurvey && (
                      <button 
                        type="button" 
                        onClick={() => { setEditingSurvey(null); setView('surveys'); }}
                        className="minimal-button-outline w-full mt-3"
                      >
                        {t.cancel}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[#2B4F6E] flex items-center justify-center text-2xl text-white font-semibold mb-3 overflow-hidden border-4 border-white dark:border-[#2A2A2A] shadow-xl">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    user.full_name[0]
                  )}
                </div>
                <h2 className="text-xl font-semibold mb-1 text-[#212529] dark:text-white">{user.full_name}</h2>
                <div className="px-4 py-1 rounded-full bg-[#F1F3F5] dark:bg-[#2A2A2A] text-[#868E96] dark:text-[#B0B0B0] text-sm font-medium">
                  @{user.username}
                </div>
              </div>

              <div className="minimal-card p-6 space-y-3">
                <div className="space-y-1.5 mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#ADB5BD] dark:text-[#B0B0B0]/40 ml-1">{t.avatarUrl}</p>
                  <div className="flex gap-2">
                    <input 
                      id="avatar-input"
                      className="minimal-input flex-1 !py-2 !text-xs" 
                      placeholder="https://..." 
                      defaultValue={user.avatar}
                    />
                    <button 
                      onClick={async () => {
                        const input = document.getElementById('avatar-input') as HTMLInputElement;
                        try {
                          const res = await fetch(`/api/users/${user.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...user, avatar: input.value })
                          });
                          const data = await res.json();
                          if (data.success) {
                            setUser(data.user);
                            localStorage.setItem('user', JSON.stringify(data.user));
                          }
                        } catch (e) {
                          alert(t.error);
                        }
                      }}
                      className="px-4 py-2 bg-[#2B4F6E] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                    >
                      {t.save}
                    </button>
                  </div>
                </div>
                <ProfileItem label={t.fullName} value={user.full_name} />
                <ProfileItem label={t.phone} value={user.phone} />
                <ProfileItem label={t.email} value={user.email} />
                <ProfileItem label={t.username} value={user.username} />
                
                <div className="pt-4 space-y-3">
                  <button 
                    onClick={() => {
                      localStorage.removeItem('user');
                      setUser(null);
                    }}
                    className="minimal-button-danger w-full !h-[48px] text-sm"
                  >
                    <LogOut size={16} className="mr-2" />
                    {t.logout}
                  </button>
                </div>
              </div>

              {user.is_admin === 1 && (
                <div className="mt-8 space-y-6">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold tracking-tight">{t.manageUsers}</h3>
                    <div className="h-[2px] w-12 bg-[#2B4F6E] mt-2"></div>
                  </div>

                  <div className="space-y-4">
                    {users.filter(u => u.id !== user.id).map(u => (
                      <div key={u.id} className="minimal-card p-5 flex flex-wrap items-center justify-between gap-4 group">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${u.is_blocked ? 'bg-gray-400' : 'bg-[#2B4F6E]'}`}>
                            {u.full_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm truncate ${u.is_blocked ? 'text-gray-400 line-through' : 'text-[#212529] dark:text-white'}`}>
                              {u.full_name}
                            </p>
                            <p className="text-xs text-[#868E96] dark:text-[#B0B0B0] truncate">@{u.username}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <button 
                            onClick={() => handleBlockUser(u.id, !u.is_blocked)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${u.is_blocked ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100'}`}
                          >
                            {u.is_blocked ? t.unblock : t.block}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="grid gap-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard label={t.totalVotes} value={surveys.reduce((acc, s) => acc + s.total_participants, 0)} icon={<TrendingUp size={16} />} />
                  <StatCard label={t.totalSurveys} value={surveys.length} icon={<Vote size={16} />} />
                  <StatCard label={t.activity} value={85} suffix="%" icon={<Clock size={16} />} />
                </div>

                <div className="minimal-card p-6">
                  <h3 className="text-[10px] font-bold tracking-widest text-[#868E96] dark:text-[#B0B0B0] uppercase mb-5">{t.popularSurveys}</h3>
                  
                  <div className="space-y-6">
                    {surveys.slice(0, 5).map(s => (
                      <div key={s.id} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-medium text-[#212529] dark:text-white">{s.title}</span>
                          <span className="text-sm text-[#868E96] dark:text-[#B0B0B0]">{s.total_participants} {t.votes}</span>
                        </div>
                        <div className="minimal-progress-bg h-2 w-full">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (s.total_participants / 100) * 100)}%` }}
                            className="minimal-progress-fill"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Voting Modal */}
      <AnimatePresence>
        {selectedSurvey && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedSurvey(null);
                setCurrentVotes([]);
              }}
              className="absolute inset-0 bg-[#212529]/60 dark:bg-black/80 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              className="minimal-card w-full max-w-xl relative z-10 max-h-[85vh] overflow-y-auto p-8"
            >
              <button 
                onClick={() => {
                  setSelectedSurvey(null);
                  setCurrentVotes([]);
                }} 
                className="absolute top-5 right-5 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <X size={24} className="text-[#868E96] dark:text-[#B0B0B0]" />
              </button>
              
              <div className="mb-10 pr-10">
                <h2 className="text-2xl font-semibold mb-2 tracking-tight leading-tight text-[#212529] dark:text-white">{selectedSurvey.title}</h2>
                <p className="text-[#868E96] dark:text-[#B0B0B0] text-sm font-light leading-relaxed">{selectedSurvey.description}</p>
              </div>

              <div className="space-y-10">
                {selectedSurvey.questions.map((q, qIndex) => {
                  const result = results.find(r => r.question_id === q.id);
                  const currentVote = currentVotes.find(v => v.question_id === q.id);
                  
                  return (
                    <div key={q.id} className="space-y-5">
                      <h4 className="text-base font-semibold tracking-tight flex items-center gap-3 text-[#212529] dark:text-white">
                        <span className="w-6 h-6 rounded-lg bg-[#2B4F6E]/20 text-[#2B4F6E] flex items-center justify-center text-xs font-bold">{qIndex + 1}</span>
                        {q.text}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {q.options.map((opt) => {
                          const optResult = result?.options.find(o => o.id === opt.id);
                          const totalQVotes = result?.options.reduce((acc, o) => acc + o.count, 0) || 0;
                          const percentage = totalQVotes > 0 ? Math.round((optResult?.count || 0) / totalQVotes * 100) : 0;
                          const isSelected = currentVote?.option_id === opt.id;

                          return (
                            <button 
                              key={opt.id}
                              onClick={() => {
                                const filtered = currentVotes.filter(v => v.question_id !== q.id);
                                setCurrentVotes([...filtered, { question_id: q.id, option_id: opt.id }]);
                              }}
                              className={`w-full text-left p-4 rounded-2xl bg-[#F1F3F5] dark:bg-[#2A2A2A] transition-all relative overflow-hidden border ${isSelected ? 'border-[#2B4F6E]' : 'border-transparent hover:border-[#E9ECEF] dark:hover:border-[#3A3A3A]'}`}
                            >
                              <div className="minimal-progress-bg absolute inset-0 opacity-10 w-0 transition-all duration-500" style={{ width: `${percentage}%` }} />
                              <div className="relative flex justify-between items-center">
                                <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-[#2B4F6E]' : 'text-[#212529] dark:text-white'}`}>
                                  {opt.text}
                                </span>
                                {isSelected ? (
                                  <CheckCircle2 size={18} className="text-[#2B4F6E]" />
                                ) : (
                                  totalQVotes > 0 && <span className="text-xs font-bold text-[#868E96] dark:text-[#B0B0B0]">{percentage}%</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-12 pt-6 border-t border-[#E9ECEF] dark:border-[#2A2A2A] flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#868E96] dark:text-[#B0B0B0]">
                  {currentVotes.length} / {selectedSurvey.questions.length} {t.question}
                </div>
                <button 
                  onClick={() => handleVote(selectedSurvey.id)}
                  disabled={currentVotes.length < selectedSurvey.questions.length}
                  className="minimal-button !w-auto px-10"
                >
                  {t.vote.toUpperCase()}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, icon, onClick }: { active: boolean, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="relative p-3.5 outline-none group"
    >
      <motion.div
        animate={active ? { 
          y: -4, 
          scale: 1.15,
          color: '#2B4F6E'
        } : { 
          y: 0, 
          scale: 1,
          color: '#868E96'
        }}
        whileTap={{ y: -8, scale: 1.25 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className="relative z-10"
      >
        {React.cloneElement(icon as React.ReactElement, { 
          size: 24,
          strokeWidth: active ? 2.5 : 2,
          fill: active ? 'rgba(43, 79, 110, 0.15)' : 'transparent'
        })}
      </motion.div>

      {active && (
        <motion.div
          layoutId="nav-pulse"
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-[#2B4F6E]/20 rounded-full pointer-events-none"
        />
      )}

      {active && (
        <motion.div 
          layoutId="nav-active"
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            mass: 1.2
          }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#2B4F6E] neon-glow z-20"
        />
      )}
    </button>
  );
}

function ProfileItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#ADB5BD] dark:text-[#B0B0B0]/40 ml-1">{label}</p>
      <div className="px-4 py-3 rounded-[16px] bg-[#F8F9FA] dark:bg-[#2A2A2A] border border-[#F1F3F5] dark:border-[#3A3A3A] text-[#212529] dark:text-white font-semibold text-sm">
        {value}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, suffix = "" }: { label: string, value: number, icon?: React.ReactNode, suffix?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-[#1E1E1E] rounded-[24px] p-5 flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.25)] border border-[#F1F3F5] dark:border-white/5"
    >
      {icon && <div className="mb-3 text-[#ADB5BD] dark:text-[#B0B0B0]/60">{icon}</div>}
      <p className="text-2xl font-bold text-[#212529] dark:text-white mb-0.5 tracking-tight">{value}{suffix}</p>
      <p className="text-[10px] font-bold text-[#868E96] dark:text-[#B0B0B0] uppercase tracking-widest">{label}</p>
    </motion.div>
  );
}
