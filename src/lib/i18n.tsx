import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'ru' | 'emj';

const translations = {
  en: {
    appTitle: "EventFlow",
    appDesc: "Real-time event management & scheduling",
    createEvent: "Create Event",
    eventName: "Event Name",
    date: "Date",
    location: "Location",
    createBtn: "Create Event",
    existingEvents: "Your Events",
    noEvents: "No events found. Create or join one.",
    manage: "Manage",
    join: "Join",
    delete: "Delete",
    joinByCode: "Join by Code",
    enterCode: "Enter Event Code (ID)",
    cancel: "Cancel",
    joinBtn: "Join Event",
    backToEvents: "Back to Events",
    orgDashboard: "Organizer Dashboard",
    schedule: "Schedule",
    template: "Template",
    importExcel: "Import Excel",
    addStage: "Add Stage",
    stageName: "Stage Name",
    startTime: "Start Time",
    endTime: "End Time",
    responsible: "Responsible Person",
    saveStage: "Save Stage",
    currentStatus: "Current Status",
    nowHappening: "NOW HAPPENING",
    startedAt: "Started at",
    noActiveStage: "No active stage",
    upNext: "Up Next",
    start: "Start",
    complete: "Complete",
    delay: "delay",
    viewAsParticipant: "View as Participant",
    completedStages: "Completed Stages",
    currentUpcoming: "Current & Upcoming",
    runningLate: "Running late",
    noCompleted: "No stages completed yet.",
    noUpcoming: "No upcoming stages.",
    accessDenied: "Access Denied",
    accessDeniedDesc: "You are not the creator of this event or you are using a different browser. Only the creator can manage the event.",
    goToParticipant: "Go to Participant View",
    loading: "Loading...",
    searchNearby: "Searching nearby...",
    noPlaces: "No places found",
    copyCode: "Copy Code",
    codeCopied: "Copied!",
    eventCode: "Event Code",
    retentionPolicy: "Keep event data for",
    retention1Day: "1 day after event",
    retention7Days: "7 days after event",
    retention14Days: "14 days after event",
    retention30Days: "30 days after event"
  },
  ru: {
    appTitle: "ТаймМастер",
    appDesc: "Управление мероприятиями в реальном времени",
    createEvent: "Создать мероприятие",
    eventName: "Название",
    date: "Дата",
    location: "Место проведения",
    createBtn: "Создать",
    existingEvents: "Ваши мероприятия",
    noEvents: "Нет мероприятий. Создайте или присоединитесь.",
    manage: "Управлять",
    join: "Войти",
    delete: "Удалить",
    joinByCode: "Присоединиться по коду",
    enterCode: "Введите код мероприятия (ID)",
    cancel: "Отмена",
    joinBtn: "Присоединиться",
    backToEvents: "К списку мероприятий",
    orgDashboard: "Панель организатора",
    schedule: "Расписание",
    template: "Шаблон",
    importExcel: "Загрузить Excel",
    addStage: "Добавить этап",
    stageName: "Название этапа",
    startTime: "Время начала",
    endTime: "Время окончания",
    responsible: "Ответственный",
    saveStage: "Сохранить этап",
    currentStatus: "Текущий статус",
    nowHappening: "СЕЙЧАС ИДЕТ",
    startedAt: "Начато в",
    noActiveStage: "Нет активного этапа",
    upNext: "Далее",
    start: "Начать",
    complete: "Завершить",
    delay: "задержка",
    viewAsParticipant: "Вид участника",
    completedStages: "Завершенные этапы",
    currentUpcoming: "Текущие и будущие",
    runningLate: "Отставание",
    noCompleted: "Пока нет завершенных этапов.",
    noUpcoming: "Нет предстоящих этапов.",
    accessDenied: "Доступ запрещен",
    accessDeniedDesc: "Вы не являетесь создателем этого мероприятия или используете другой браузер. Только создатель может управлять мероприятием.",
    goToParticipant: "Перейти к просмотру",
    loading: "Загрузка...",
    searchNearby: "Поиск рядом...",
    noPlaces: "Места не найдены",
    copyCode: "Скопировать код",
    codeCopied: "Скопировано!",
    eventCode: "Код мероприятия",
    retentionPolicy: "Хранить данные",
    retention1Day: "1 день после проведения",
    retention7Days: "7 дней после проведения",
    retention14Days: "14 дней после проведения",
    retention30Days: "30 дней после проведения"
  },
  emj: {
    appTitle: "⏱️👑",
    appDesc: "📅🏃‍♂️🔄",
    createEvent: "➕📅",
    eventName: "📝",
    date: "📆",
    location: "📍",
    createBtn: "🚀",
    existingEvents: "👀📅",
    noEvents: "📭",
    manage: "⚙️",
    join: "🚶‍♂️",
    delete: "🗑️",
    joinByCode: "🔑🚶‍♂️",
    enterCode: "🔢",
    cancel: "❌",
    joinBtn: "✅",
    backToEvents: "🔙",
    orgDashboard: "👑⚙️",
    schedule: "📋",
    template: "📄⬇️",
    importExcel: "📊⬆️",
    addStage: "➕⏱️",
    stageName: "🏷️",
    startTime: "🟢⏰",
    endTime: "🔴⏰",
    responsible: "👤",
    saveStage: "💾",
    currentStatus: "📡",
    nowHappening: "🔥",
    startedAt: "🏁",
    noActiveStage: "💤",
    upNext: "⏭️",
    start: "▶️",
    complete: "✅",
    delay: "🐢",
    viewAsParticipant: "👁️",
    completedStages: "✅📋",
    currentUpcoming: "🔥⏭️",
    runningLate: "🐌",
    noCompleted: "📭",
    noUpcoming: "📭",
    accessDenied: "🚫",
    accessDeniedDesc: "🔒👀",
    goToParticipant: "➡️👁️",
    loading: "⏳",
    searchNearby: "🔍📍",
    noPlaces: "❌📍",
    copyCode: "📋",
    codeCopied: "✔️",
    eventCode: "🔑",
    retentionPolicy: "💾⏳",
    retention1Day: "1️⃣ 🌅",
    retention7Days: "7️⃣ 🌅",
    retention14Days: "1️⃣4️⃣ 🌅",
    retention30Days: "3️⃣0️⃣ 🌅"
  }
};

type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'ru';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key];
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
