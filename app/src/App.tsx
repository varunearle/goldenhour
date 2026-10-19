import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { StoreProvider, useStore, type Role } from './lib/store';
import SignIn from './pages/SignIn';
import Triage from './pages/Triage';
import Queue from './pages/Queue';
import MapView from './pages/MapView';
import Model from './pages/Model';
import Settings from './pages/Settings';
import { Privacy, Terms } from './pages/Legal';

const home = (r: Role) => (r === 'planner' ? '/map' : '/triage');

function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { role: current } = useStore();
  if (!current) return <Navigate to="/" replace />;
  if (role && current !== role) return <Navigate to={home(current)} replace />;
  return <>{children}</>;
}

function Home() {
  const { role } = useStore();
  return role ? <Navigate to={home(role)} replace /> : <SignIn />;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/triage" element={<Guard role="handler"><Triage /></Guard>} />
            <Route path="/queue" element={<Guard role="handler"><Queue /></Guard>} />
            <Route path="/map" element={<Guard role="planner"><MapView /></Guard>} />
            <Route path="/model" element={<Model />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
