import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

// ตัวอย่างการตั้ง route — /auth คือ path ที่ตั้งไว้ใน Supabase redirectTo
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
