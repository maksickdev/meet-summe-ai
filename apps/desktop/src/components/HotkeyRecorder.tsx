import { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { Keyboard } from "lucide-react";
import { setShortcutsDisabled } from "../ipc";

interface HotkeyRecorderProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function HotkeyRecorder({ value, onChange, className }: HotkeyRecorderProps) {
    const [isListening, setIsListening] = useState(false);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isListening) return;
            e.preventDefault();
            e.stopPropagation();

            const parts: string[] = [];

            // Modifiers
            if (e.metaKey) parts.push("Command");
            if (e.ctrlKey) parts.push("Control");
            if (e.altKey) parts.push("Alt");
            if (e.shiftKey) parts.push("Shift");

            // Identification of the main key using e.code
            const isModifierOnly = [
                "ControlLeft", "ControlRight",
                "ShiftLeft", "ShiftRight",
                "AltLeft", "AltRight",
                "MetaLeft", "MetaRight",
                "CapsLock"
            ].includes(e.code);

            if (!isModifierOnly) {
                let key = e.code;
                // Strip "Key" and "Digit" prefixes for cleaner format (e.g. "KeyR" -> "R")
                // which is standard for Tauri/global-hotkey strings
                if (key.startsWith("Key")) key = key.substring(3);
                if (key.startsWith("Digit")) key = key.substring(5);

                parts.push(key);
                const newHotkey = parts.join("+");
                onChange(newHotkey);
                setIsListening(false);
            }
        },
        [isListening, onChange]
    );

    useEffect(() => {
        if (isListening) {
            setShortcutsDisabled(true).catch(console.error);
            window.addEventListener("keydown", handleKeyDown, true);
            return () => {
                setShortcutsDisabled(false).catch(console.error);
                window.removeEventListener("keydown", handleKeyDown, true);
            };
        }
    }, [isListening, handleKeyDown]);

    return (
        <div
            onClick={() => setIsListening(true)}
            className={cn(
                "flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white transition-colors dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950",
                isListening
                    ? "ring-2 ring-zinc-950 ring-offset-2 dark:ring-zinc-300 border-transparent"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                className
            )}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <Keyboard className={cn("w-4 h-4 shrink-0", isListening ? "text-blue-500 animate-pulse" : "text-zinc-500")} />
                <span className={cn(
                    "truncate font-mono",
                    !value && !isListening && "text-zinc-400"
                )}>
                    {isListening ? "Listening for keys..." : (value || "Click to set shortcut")}
                </span>
            </div>
            {isListening && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsListening(false);
                    }}
                    className="text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                    Cancel
                </button>
            )}
        </div>
    );
}
