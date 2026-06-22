import { RefreshCw } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-[#f0f0ee]" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-[#CB202D] animate-spin" />
      </div>
      <p className="mt-4 text-sm font-medium text-[#6b6b68]">{text}</p>
    </div>
  );
}

export function InlineSpinner() {
  return <RefreshCw className="w-4 h-4 text-[#CB202D] animate-spin" />;
}
