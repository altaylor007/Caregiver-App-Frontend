import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

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

export const useTheme = () => useContext(ThemeContext);
