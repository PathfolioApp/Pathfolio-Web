import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Button } from '../components/Button';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-page)' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Compass size={32} />
          </div>
          <span className="editorial-eyebrow">404 • Not Found</span>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '12px' }}>Page not found</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            The destination you are looking for does not exist in this release of PathfolioApp.
          </p>
          <Button variant="primary" size="md" onClick={() => navigate('/')}>
            Return to Landing Page
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
