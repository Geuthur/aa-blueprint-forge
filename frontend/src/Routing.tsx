// React
import React from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";

// AA bpforge
import { ProjectName } from "@/constants";
import { ErrorPage } from "@/Pages/404";
import AdministrationPage from "@/Pages/AdministrationPage";
import AuthBase from "@/Pages/Base";
import MainPage from "@/Pages/MainPage";
import MyBlueprintsPage from "@/Pages/MyBlueprintsPage";
import OrdersPage from "@/Pages/OrdersPage";
import SettingsPage from "@/Pages/SettingsPage";

const queryClient = new QueryClient();

function Routing() {
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
                <Route path="administration/" element={<AdministrationPage />} />
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

export default Routing