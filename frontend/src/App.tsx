// React
import React from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import Backend from "i18next-http-backend";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { initReactI18next } from "react-i18next";

// AA bpforge
import { AppName, ProjectName } from "@/configuration";
import { ErrorPage } from "@/Pages/404";
import AuthBase from "@/Pages/Base";
import OrdersPage from "@/Pages/BlueprintPage";
import MainPage from "@/Pages/MainPage";
import MyBlueprintsPage from "@/Pages/MyBlueprintsPage";
import SettingsPage from "@/Pages/SettingsPage";
import SuperuserPage from "@/Pages/SuperuserPage";

const queryClient = new QueryClient();

// Read language directly from Django's LANGUAGE_CODE (set as lang="..." on root div)
const djangoLanguage = typeof document !== "undefined" ? document.getElementById(`${AppName}-root`)?.getAttribute("lang") ?? "en" : "en";

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    lng: djangoLanguage,
    fallbackLng: "en",
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
    react: {
      useSuspense: false, //   <---- this will do the magic
    },
    backend: {
      loadPath: `/static/${ProjectName}/i18n/{{lng}}/{{ns}}.json`,
    },
  });

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NuqsAdapter>
            <Routes>
              <Route path={`/${ProjectName}/`} element={<AuthBase />}>
                <Route index element={<MainPage />} />
                <Route path="overview/" element={<MainPage />} />
                <Route path="my-blueprints/" element={<MyBlueprintsPage />} />
                <Route path="orders/" element={<OrdersPage />} />
                <Route path="settings/" element={<SettingsPage />} />
                <Route path="superuser/" element={<SuperuserPage />} />
                <Route path="*" element={<ErrorPage />} />
              </Route>
              <Route path="*" element={<Navigate to={`/${ProjectName}/`} replace />} />
            </Routes>
          </NuqsAdapter>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  )
}

export default App