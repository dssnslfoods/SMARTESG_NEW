import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// แยก helper ออกมาเพื่อให้เทสง่ายและไม่ปนกับ JSX
export function validatePassword(password, confirm) {
  const errors = [];
  if (!password || password.length < 8) errors.push('ต้องมีอย่างน้อย 8 ตัวอักษร');
  if (!/[a-z]/.test(password)) errors.push('ต้องมีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว');
  if (!/[A-Z]/.test(password)) errors.push('ต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว');
  if (!/[0-9]/.test(password)) errors.push('ต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว');
  if (password !== confirm) errors.push('รหัสผ่านยืนยันไม่ตรงกัน');
  return errors;
}

// แปลข้อความ error จาก Supabase ให้อ่านง่ายภาษาไทย
function humanizeSupabaseError(message) {
  if (!message) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  const m = message.toLowerCase();
  if (m.includes('same as the old')) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม';
  if (m.includes('weak password')) return 'รหัสผ่านอ่อนเกินไป กรุณาตั้งให้ซับซ้อนขึ้น';
  if (m.includes('expired') || m.includes('invalid token')) {
    return 'ลิงก์รีเซ็ตหมดอายุหรือถูกใช้งานไปแล้ว กรุณาขอลิงก์ใหม่';
  }
  if (m.includes('auth session missing')) {
    return 'ไม่พบเซสชันการรีเซ็ต กรุณากดลิงก์จากอีเมลใหม่อีกครั้ง';
  }
  return message;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // recoveryReady = ตรวจแล้วว่ามาจากลิงก์ reset จริง (มี session แบบ recovery)
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    // Supabase JS จะอ่าน token จาก URL (เพราะ detectSessionInUrl: true)
    // แล้วยิง event 'PASSWORD_RECOVERY' เมื่อ session ถูกตั้งเป็นโหมด recovery
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    // เผื่อกรณีที่ event ถูกยิงก่อน component mount — เช็ค session ปัจจุบันด้วย
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setRecoveryReady(true);
      setCheckingLink(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const errors = validatePassword(password, confirm);
    if (errors.length > 0) {
      setError(errors.join(' • '));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(humanizeSupabaseError(updateError.message));
        return;
      }
      setSuccess(true);
      // ปล่อย session ออกเพื่อให้ user login ใหม่ด้วยรหัสที่เพิ่งตั้ง
      await supabase.auth.signOut();
    } catch (err) {
      // ไม่ log password — log เฉพาะ message
      console.error('updateUser failed:', err?.message ?? 'unknown error');
      setError('ไม่สามารถบันทึกรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }

  // ----- UI -----
  if (checkingLink) {
    return (
      <Shell>
        <p className="text-center text-sm text-slate-500">กำลังตรวจสอบลิงก์...</p>
      </Shell>
    );
  }

  if (!recoveryReady) {
    return (
      <Shell title="ลิงก์ไม่ถูกต้อง">
        <p className="text-sm text-slate-600">
          ลิงก์รีเซ็ตรหัสผ่านหมดอายุ ถูกใช้งานไปแล้ว หรือไม่ถูกต้อง
          กรุณาขอให้ผู้ดูแลส่งอีเมลรีเซ็ตใหม่อีกครั้ง
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell title="ตั้งรหัสผ่านสำเร็จ">
        <p className="text-sm text-slate-600">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          ไปหน้าเข้าสู่ระบบ
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="ตั้งรหัสผ่านใหม่">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">
            รหัสผ่านใหม่
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500">
            อย่างน้อย 8 ตัว • มีพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลขอย่างละ 1 ตัว
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
            ยืนยันรหัสผ่าน
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {title && <h1 className="mb-4 text-lg font-semibold text-slate-900">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
