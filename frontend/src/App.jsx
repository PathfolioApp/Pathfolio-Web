import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/providers/AuthProvider';
import { ConsentBanner } from './components/ui/ConsentBanner';
import { AppRoutes } from './app/router/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConsentBanner />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
