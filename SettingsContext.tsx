import { createContext, useContext, useState } from 'react';

type Settings = {
  notifications: boolean;
  locationAlerts: boolean;
  sounds: boolean;
  vibrations: boolean;
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}>({
  settings: {
    notifications: true,
    locationAlerts: true,
    sounds: true,
    vibrations: true,
  },
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    locationAlerts: true,
    sounds: true,
    vibrations: true,
  });

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);