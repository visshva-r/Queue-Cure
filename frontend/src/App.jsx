import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Receptionist from './pages/Receptionist';
import PatientView from './pages/PatientView';

export default function App() {
  const location = useLocation();
  const isPatient = location.pathname.startsWith('/waiting');

  return (
    <div className="app">
      {!isPatient && (
        <header className="top-bar">
          <div className="brand">
            <span className="brand-icon">+</span>
            <div>
              <strong>Queue Cure</strong>
              <span>Live clinic queue</span>
            </div>
          </div>
          <nav>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Reception
            </Link>
            <Link to="/waiting" className={location.pathname === '/waiting' ? 'active' : ''}>
              Waiting Room
            </Link>
          </nav>
        </header>
      )}
      <Routes>
        <Route path="/" element={<Receptionist />} />
        <Route path="/waiting" element={<PatientView />} />
      </Routes>
    </div>
  );
}
