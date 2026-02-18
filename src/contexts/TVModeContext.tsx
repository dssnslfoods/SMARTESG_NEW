import { createContext, useCallback, useContext, useState } from "react";

const TV_MODE_KEY = "esg_tv_mode";

interface TVModeContextType {
  isTVMode: boolean;
  toggle: () => void;
  exit: () => void;
}

const TVModeContext = createContext<TVModeContextType>({
  isTVMode: false,
  toggle: () => {},
  exit: () => {},
});

export function TVModeProvider({ children }: { children: React.ReactNode }) {
  const [isTVMode, setIsTVMode] = useState(() => sessionStorage.getItem(TV_MODE_KEY) === "1");

  const toggle = useCallback(() => {
    setIsTVMode(prev => {
      const next = !prev;
      if (next) sessionStorage.setItem(TV_MODE_KEY, "1");
      else sessionStorage.removeItem(TV_MODE_KEY);
      return next;
    });
  }, []);

  const exit = useCallback(() => {
    setIsTVMode(false);
    sessionStorage.removeItem(TV_MODE_KEY);
  }, []);

  return (
    <TVModeContext.Provider value={{ isTVMode, toggle, exit }}>
      {children}
    </TVModeContext.Provider>
  );
}

export function useTVMode() {
  return useContext(TVModeContext);
}
