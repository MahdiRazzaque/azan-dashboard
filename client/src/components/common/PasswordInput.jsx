import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X, ShieldAlert } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * A custom password input component with integrated visibility toggling and optional
 * password strength validation.
 *
 * @param {object} props - The component props.
 * @param {string} props.value - The current value of the input.
 * @param {Function} props.onChange - Callback function for when the input value changes.
 * @param {string} [props.placeholder="Enter password"] - Placeholder text for the input.
 * @param {boolean} [props.showStrength=false] - Whether to display the password strength indicator.
 * @returns {JSX.Element} The rendered password input component.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = "Enter password",
  showStrength = false,
}) {
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const checks = [
    { label: "8+ Characters", test: (p) => p.length >= 8 },
    { label: "Uppercase", test: (p) => /[A-Z]/.test(p) },
    { label: "Lowercase", test: (p) => /[a-z]/.test(p) },
    { label: "Number", test: (p) => /[0-9]/.test(p) },
    { label: "Symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const passedCount = checks.filter((c) => c.test(value)).length;
  const strength =
    passedCount <= 2 ? "Weak" : passedCount < 5 ? "Medium" : "Strong";
  const color =
    passedCount <= 2
      ? "text-red-400"
      : passedCount < 5
        ? "text-amber-400"
        : "text-emerald-400";
  const barColor =
    passedCount <= 2
      ? "bg-red-500"
      : passedCount < 5
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => {
            setTouched(true);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full bg-app-card border border-app-border rounded-lg p-3 pr-10 text-app-text focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-app-dim/50"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-3.5 text-app-dim hover:text-app-text"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {showStrength && (
        <div
          className={`transition-all duration-300 overflow-hidden ${touched || value.length > 0 ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          {/* Progress Bar */}
          <div className="h-1 bg-app-bg rounded-full mt-2 mb-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${barColor}`}
              style={{ width: `${(passedCount / 5) * 100}%` }}
            />
          </div>

          {/* Label */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-app-dim uppercase tracking-wider">
              Password Strength
            </span>
            <span className={cn("text-xs font-bold uppercase", color)}>
              {strength}
            </span>
          </div>

          {/* Requirements Grid */}
          <div className="grid grid-cols-2 gap-2">
            {checks.map((check, i) => {
              const passed = check.test(value);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs transition-colors duration-200"
                >
                  {passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-app-border" />
                  )}
                  <span className={passed ? "text-app-text" : "text-app-dim"}>
                    {check.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-3 text-[10px] text-app-dim items-start bg-app-card/50 p-2 rounded">
            <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
            <p>
              These requirements are recommended for security but not strictly
              enforced.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
