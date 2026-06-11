import { Brain, Sun, Moon } from "lucide-react";

interface NavbarProps {
  isDark: boolean;
  toggleDark: () => void;
}

export default function Navbar({ isDark, toggleDark }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-stone-50/80 dark:border-zinc-800/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 shadow-md shadow-teal-500/10 dark:bg-teal-500">
            <Brain className="h-6 w-6 text-stone-50" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
            MindForge <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-emerald-400">AI</span>
          </span>
        </div>

        {/* Minimal Actions - Dark Mode Toggle */}
        <div className="flex items-center space-x-2">
          <button
            id="dark-mode-toggle"
            onClick={toggleDark}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-amber-500" />
            ) : (
              <Moon className="h-5 w-5 text-stone-600" />
            )}
          </button>
        </div>

      </div>
    </nav>
  );
}
