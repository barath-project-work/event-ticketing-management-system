import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;
const listeners: Set<(t: Toast) => void> = new Set();

export function showToast(type: ToastType, message: string) {
  const toast: Toast = { id: ++toastId, type, message };
  listeners.forEach((fn) => fn(toast));
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const styles = {
  success: {
    border: 'border-l-emerald-500',
    bg: 'bg-white',
    icon: 'text-emerald-500',
    text: 'text-[#2D2D2D]',
  },
  error: {
    border: 'border-l-[#CB202D]',
    bg: 'bg-white',
    icon: 'text-[#CB202D]',
    text: 'text-[#2D2D2D]',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-white',
    icon: 'text-blue-500',
    text: 'text-[#2D2D2D]',
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Toast) => {
    setToasts((prev) => [...prev, t]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => { listeners.delete(addToast); };
  }, [addToast]);

  const remove = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        const s = styles[t.type];
        return (
          <div
            key={t.id}
            className={`${s.border} ${s.bg} ${s.text} rounded-[12px] shadow-zomato-hover border-4 border-l-4 p-4 flex items-start gap-3 text-sm animate-slide-in`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.icon}`} />
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="flex-shrink-0 text-[#b0b0ae] hover:text-[#6b6b68] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
