export type User = {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  avatar?: string;
  is_admin: number;
  is_blocked?: number;
};

export type Option = {
  id: number;
  question_id: number;
  text: string;
};

export type Question = {
  id: number;
  survey_id: number;
  text: string;
  options: Option[];
};

export type Survey = {
  id: number;
  title: string;
  description: string;
  image_url?: string;
  creator_id: number;
  creator_name: string;
  created_at: string;
  total_participants: number;
  questions: Question[];
};

export type VoteResult = {
  question_id: number;
  question_text: string;
  options: {
    id: number;
    text: string;
    count: number;
  }[];
};

export type Language = 'uz' | 'ru' | 'en';

export const translations = {
  uz: {
    welcome: "Xush kelibsiz",
    login: "Kirish",
    register: "Ro'yxatdan o'tish",
    username: "Foydalanuvchi nomi",
    password: "Parol",
    fullName: "To'liq ism",
    phone: "Telefon",
    email: "Email",
    surveys: "So'rovnomalar",
    createSurvey: "Yangi so'rovnoma",
    title: "Sarlavha",
    description: "Tavsif",
    options: "Variantlar",
    addOption: "Variant qo'shish",
    vote: "Ovoz berish",
    results: "Natijalar",
    profile: "Profil",
    statistics: "Statistika",
    settings: "Sozlamalar",
    language: "Til",
    theme: "Mavzu",
    light: "Yorug'",
    dark: "Qorong'i",
    logout: "Chiqish",
    save: "Saqlash",
    totalVotes: "Umumiy ovozlar",
    noSurveys: "Hozircha so'rovnomalar yo'q",
    createFirst: "Birinchi so'rovnomangizni yarating",
    alreadyVoted: "Siz allaqachon ovoz bergansiz",
    edit: "Tahrirlash",
    delete: "O'chirish",
    questions: "Savollar",
    addQuestion: "Savol qo'shish",
    creating: "Yaratilmoqda...",
    editing: "Tahrirlanmoqda...",
    totalSurveys: "So'rovnomalar",
    activity: "Faollik",
    popularSurveys: "Mashhur so'rovnomalar",
    question: "Savol",
    votes: "ovoz",
    of: "dan",
    confirmDelete: "O'chirishni tasdiqlaysizmi?",
    cancel: "Bekor qilish",
    error: "Xatolik yuz berdi",
    sendCode: "Kod yuborish",
    verifyCode: "Tasdiqlash kodi",
    codeSent: "Tasdiqlash kodi emailingizga yuborildi",
    resendCode: "Kodni qayta yuborish",
    deleteAccount: "Hisobni o'chirish",
    confirmDeleteAccount: "Hisobingizni o'chirishni tasdiqlaysizmi? Barcha ma'lumotlaringiz o'chib ketadi.",
    manageUsers: "Foydalanuvchilarni boshqarish",
    block: "Bloklash",
    unblock: "Blokdan chiqarish",
    userDeleted: "Foydalanuvchi o'chirildi",
    userBlocked: "Foydalanuvchi bloklandi",
    userUnblocked: "Foydalanuvchi blokdan chiqarildi",
    confirmDeleteUser: "Foydalanuvchini o'chirishni tasdiqlaysizmi? Uning barcha ovozlari ham o'chiriladi.",
    atLeastOneQuestion: "Kamida bitta savol bo'lishi shart",
    imageUrl: "Rasm URL",
    avatarUrl: "Profil rasmi URL"
  },
  ru: {
    welcome: "Добро пожаловать",
    login: "Вход",
    register: "Регистрация",
    username: "Имя пользователя",
    password: "Пароль",
    fullName: "Полное имя",
    phone: "Телефон",
    email: "Email",
    surveys: "Опросы",
    createSurvey: "Новый опрос",
    title: "Заголовок",
    description: "Описание",
    options: "Варианты",
    addOption: "Добавить вариант",
    vote: "Голосовать",
    results: "Результаты",
    profile: "Профиль",
    statistics: "Статистика",
    settings: "Настройки",
    language: "Язык",
    theme: "Тема",
    light: "Светлая",
    dark: "Темная",
    logout: "Выйти",
    save: "Сохранить",
    totalVotes: "Всего голосов",
    noSurveys: "Опросов пока нет",
    createFirst: "Создайте свой первый опрос",
    alreadyVoted: "Вы уже проголосовали",
    edit: "Редактировать",
    delete: "Удалить",
    questions: "Вопросы",
    addQuestion: "Добавить вопрос",
    creating: "Создание...",
    editing: "Редактирование...",
    totalSurveys: "Опросы",
    activity: "Активность",
    popularSurveys: "Популярные опросы",
    question: "Вопрос",
    votes: "голосов",
    of: "из",
    confirmDelete: "Подтвердите удаление?",
    cancel: "Отмена",
    error: "Произошла ошибка",
    sendCode: "Отправить код",
    verifyCode: "Код подтверждения",
    codeSent: "Код подтверждения отправлен на вашу почту",
    resendCode: "Переотправить код",
    deleteAccount: "Удалить аккаунт",
    confirmDeleteAccount: "Вы уверены, что хотите удалить свой аккаунт? Все ваши данные будут удалены.",
    manageUsers: "Управление пользователями",
    block: "Блокировать",
    unblock: "Разблокировать",
    userDeleted: "Пользователь удален",
    userBlocked: "Пользователь заблокирован",
    userUnblocked: "Пользователь разблокирован",
    confirmDeleteUser: "Вы уверены, что хотите удалить пользователя? Все его голоса также будут удалены.",
    atLeastOneQuestion: "Необходим хотя бы один вопрос",
    imageUrl: "URL изображения",
    avatarUrl: "URL аватара"
  },
  en: {
    welcome: "Welcome",
    login: "Login",
    register: "Register",
    username: "Username",
    password: "Password",
    fullName: "Full Name",
    phone: "Phone",
    email: "Email",
    surveys: "Surveys",
    createSurvey: "New Survey",
    title: "Title",
    description: "Description",
    options: "Options",
    addOption: "Add Option",
    vote: "Vote",
    results: "Results",
    profile: "Profile",
    statistics: "Statistics",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    logout: "Logout",
    save: "Save",
    totalVotes: "Total Votes",
    noSurveys: "No surveys yet",
    createFirst: "Create your first survey",
    alreadyVoted: "You have already voted",
    edit: "Edit",
    delete: "Delete",
    questions: "Questions",
    addQuestion: "Add Question",
    creating: "Creating...",
    editing: "Editing...",
    totalSurveys: "Surveys",
    activity: "Activity",
    popularSurveys: "Popular Surveys",
    question: "Question",
    votes: "votes",
    of: "of",
    confirmDelete: "Confirm delete?",
    cancel: "Cancel",
    error: "An error occurred",
    sendCode: "Send Code",
    verifyCode: "Verification Code",
    codeSent: "Verification code sent to your email",
    resendCode: "Resend Code",
    deleteAccount: "Delete Account",
    confirmDeleteAccount: "Are you sure you want to delete your account? All your data will be removed.",
    manageUsers: "Manage Users",
    block: "Block",
    unblock: "Unblock",
    userDeleted: "User deleted",
    userBlocked: "User blocked",
    userUnblocked: "User unblocked",
    confirmDeleteUser: "Are you sure you want to delete the user? All their votes will also be deleted.",
    atLeastOneQuestion: "At least one question is required",
    imageUrl: "Image URL",
    avatarUrl: "Avatar URL"
  }
};
