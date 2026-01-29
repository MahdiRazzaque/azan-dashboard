import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * A dynamic input component that renders based on provider metadata.
 * Supports text, number, select, and password types.
 * 
 * @param {Object} props - Component props.
 * @param {Object} props.param - The parameter schema.
 * @param {any} props.value - The current value.
 * @param {Function} props.onChange - Callback for value changes.
 * @returns {JSX.Element} The rendered input component.
 */
export default function DynamicField({ param, value, onChange }) {
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);

    const commonClasses = "w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
    const errorClasses = "border-red-500 focus:border-red-500 focus:ring-red-500";

    const validate = (val) => {
        if (param.constraints?.required && !val) {
            setError(`${param.label} is required`);
            return;
        }
        if (param.constraints?.pattern && val) {
            const regex = new RegExp(param.constraints.pattern);
            if (!regex.test(val)) {
                setError(`Invalid ${param.label} format`);
                return;
            }
        }
        setError(null);
    };

    const handleValueChange = (val) => {
        onChange(val);
        validate(val);
    };

    const renderInput = () => {
        switch (param.type) {
            case 'select':
                return (
                    <select
                        className={cn(commonClasses, error && errorClasses)}
                        value={value ?? ''}
                        onChange={e => {
                            const val = e.target.value;
                            const option = param.constraints?.options?.find(o => String(o.id) === val);
                            handleValueChange(option ? option.id : val);
                        }}
                    >
                        {param.constraints?.options?.map(opt => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                );

            case 'password':
                return (
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            className={cn(commonClasses, error && errorClasses)}
                            value={value ?? ''}
                            onChange={e => handleValueChange(e.target.value)}
                            placeholder={param.placeholder}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-app-dim hover:text-app-text"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                );

            case 'number':
                return (
                    <input
                        type="number"
                        className={cn(commonClasses, error && errorClasses)}
                        value={value ?? ''}
                        onChange={e => handleValueChange(parseFloat(e.target.value))}
                        placeholder={param.placeholder}
                        min={param.constraints?.min}
                        max={param.constraints?.max}
                    />
                );

            case 'text':
            default:
                return (
                    <input
                        type="text"
                        className={cn(commonClasses, error && errorClasses)}
                        value={value ?? ''}
                        onChange={e => handleValueChange(e.target.value)}
                        placeholder={param.placeholder}
                    />
                );
        }
    };

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-app-dim">{param.label}</label>
                {error && <span className="text-xs text-red-500 animate-in fade-in duration-200">{error}</span>}
            </div>
            {renderInput()}
            {param.description && (
                <p className="text-xs text-app-dim mt-1">{param.description}</p>
            )}
        </div>
    );
}

/**
 * Simple class name concatenation utility.
 * @param {...string} inputs - Class names.
 * @returns {string} Concatenated class names.
 */
function cn(...inputs) {
    return inputs.filter(Boolean).join(' ');
}
