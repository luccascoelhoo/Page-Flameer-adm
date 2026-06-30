import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "pt" | "en";

const dict = {
  pt: {
    welcomeTitle: "Controle do seu shape de forma simples",
    welcomeSubtitle: "Treino, dieta e mente em um só lugar.",
    start: "Comece",
    haveAccount: "Já possui uma conta?",
    enter: "Entrar",
    welcomeBack: "Bem-vindo de volta",
    enterToContinue: "Entre com sua conta para continuar",
    email: "E-mail",
    emailPh: "Digite seu e-mail",
    password: "Senha",
    passwordPh: "Digite sua senha",
    forgot: "Esqueceu sua senha?",
    google: "Continuar com Google",
    noAccount: "Não tem uma conta?",
    signup: "Cadastre-se",
    demoLabel: "Demonstração",
  },
  en: {
    welcomeTitle: "Control your shape the easy way",
    welcomeSubtitle: "Workout, diet and mindset in one place.",
    start: "Start",
    haveAccount: "Already have an account?",
    enter: "Sign in",
    welcomeBack: "Welcome back",
    enterToContinue: "Sign in to your account to continue",
    email: "Email",
    emailPh: "Enter your email",
    password: "Password",
    passwordPh: "Enter your password",
    forgot: "Forgot your password?",
    google: "Continue with Google",
    noAccount: "Don't have an account?",
    signup: "Sign up",
    demoLabel: "Demo",
  },
} as const;

type Key = keyof typeof dict["pt"];

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "pt",
  setLang: () => {},
  t: (k) => k,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("pt");
  const t = (k: Key) => dict[lang][k];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
};

export const useLang = () => useContext(Ctx);