import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { RelateApp } from './components/RelateApp';
import { TmkpApp } from './components/TmkpApp';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/relate-triples" element={<RelateApp />} />
      <Route path="/relate-triples/admin" element={<RelateApp />} />
      <Route path="/tmkp-triples" element={<TmkpApp />} />
      <Route path="/tmkp-triples/admin" element={<TmkpApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
