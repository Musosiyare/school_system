import { Search, X } from "lucide-react";

export default function SearchInput({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-field w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm text-slate-800
          placeholder:text-slate-400 focus:border-black focus:ring-0 outline-none transition shadow-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
