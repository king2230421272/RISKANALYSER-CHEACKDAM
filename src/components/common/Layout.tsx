import React from 'react';
import Navigation from './Navigation';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="app-layout">
      <Navigation />
      <main className="app-content">
        {title && <h1 className="page-title">{title}</h1>}
        {children}
      </main>
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} 风险评估系统 | 版本 1.0.0</p>
      </footer>
    </div>
  );
};

export default Layout; 