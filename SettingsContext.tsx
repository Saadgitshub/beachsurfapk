import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NotificationSettings {
  notifications: boolean;
  locationAlerts: boolean;
  dailyTips: boolean;
  sounds: boolean;
  vibrations: boolean;
}

interface SettingsContextType {
  settings: NotificationSettings;
  language: 'en' | 'fr';
  isDarkMode: boolean;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  setLanguage: (lang: 'en' | 'fr') => void;
  toggleTheme: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>({
    notifications: true,
    locationAlerts: true,
    dailyTips: false,
    sounds: true,
    vibrations: true,
  });
  const [language, setLanguage] = useState<'en' | 'fr'>('fr');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, language, setLanguage, isDarkMode, toggleTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}