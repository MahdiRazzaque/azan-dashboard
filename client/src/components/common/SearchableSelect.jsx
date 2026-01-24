import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * A reusable searchable dropdown select component.
 * 
 * @param {object} props
 * @param {string} props.value - Currently selected value
 * @param {Array} props.options - Array of { value, label, sublabel }
 * @param {function} props.onChange - Selection change handler
 * @param {string} props.placeholder - Input placeholder
 * @param {string} props.className - Container class
 */
const SearchableSelect = ({ value, options = [], onChange, placeholder = "Select...", className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  
  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm border rounded-lg cursor-pointer transition-all bg-app-card/50 hover:bg-app-card-hover/50",
          isOpen ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-app-border"
        )}
      >
        <div className="flex flex-col truncate mr-2">
          {selectedOption ? (
            <>
              <span className="text-app-text font-medium truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && <span className="text-xs text-app-dim truncate">{selectedOption.sublabel}</span>}
            </>
          ) : (
            <span className="text-app-dim">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-app-dim transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 overflow-hidden border border-app-border rounded-lg shadow-xl bg-app-card backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center px-3 py-2 border-b border-app-border bg-app-card">
            <Search className="w-4 h-4 mr-2 text-app-dim" />
            <input 
              autoFocus
              type="text"
              className="w-full text-sm bg-transparent border-none outline-none text-app-text placeholder-app-dim"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <X 
                className="w-4 h-4 ml-2 text-app-dim cursor-pointer hover:text-app-text" 
                onClick={(e) => { e.stopPropagation(); setSearch(""); }}
              />
            )}
          </div>
          <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div 
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-emerald-500/10",
                    opt.value === value ? "bg-emerald-500/10 text-emerald-600" : "text-app-text"
                  )}
                >
                  <div className="flex flex-col truncate mr-2">
                    <span className="font-medium truncate">{opt.label}</span>
                    {opt.sublabel && <span className="text-xs text-app-dim truncate">{opt.sublabel}</span>}
                  </div>
                  {opt.value === value && <Check className="w-4 h-4 flex-shrink-0" />}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-app-dim">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
