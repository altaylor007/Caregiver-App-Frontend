import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/**
 * ThemeProvider manages the theme state (light/dark mode) of the application,
 * persists the setting in localStorage, and applies the theme to the root HTML element.
 * Requires children as a prop to wrap the components that need access to the theme context.
 *
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - The children components to render.
 */
export const ThemeProvider = ({ children }) => {
    // Check local storage for preference, otherwise default to 'light'
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('app-theme');
        return savedTheme || 'light';
    });

    useEffect(() => {
        // Save to local storage
        localStorage.setItem('app-theme', theme);

        // Apply theme to the root <html> element
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * Custom hook to consume the ThemeContext.
 * Must be used inside a ThemeProvider.
 *
 * @returns {{ theme: string, toggleTheme: function }} An object containing the current theme string and the toggleTheme function.
 */
export const useTheme = () => useContext(ThemeContext);
