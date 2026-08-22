"use client";

import { useState, useEffect, useCallback } from "react";

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForNewValue) {
        setDisplay(digit);
        setWaitingForNewValue(false);
      } else {
        setDisplay(display === "0" ? digit : display + digit);
      }
    },
    [display, waitingForNewValue]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForNewValue) {
      setDisplay("0.");
      setWaitingForNewValue(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }, [display, waitingForNewValue]);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((prev) => (parseFloat(prev) * -1).toString());
  }, []);

  const inputPercent = useCallback(() => {
    setDisplay((prev) => (parseFloat(prev) / 100).toString());
  }, []);

  const inputSquare = useCallback(() => {
    setDisplay((prev) => (parseFloat(prev) ** 2).toString());
  }, []);

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const performOperator = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);

      if (prevValue === null) {
        setPrevValue(inputValue);
      } else if (operator) {
        const result = calculate(prevValue, inputValue, operator);
        setDisplay(String(result));
        setPrevValue(result);
      }

      setWaitingForNewValue(true);
      setOperator(nextOperator);
    },
    [display, prevValue, operator]
  );

  const handleEquals = useCallback(() => {
    if (operator && prevValue !== null) {
      const inputValue = parseFloat(display);
      const result = calculate(prevValue, inputValue, operator);

      setHistory((prev) =>
        [`${prevValue} ${operator} ${inputValue} = ${result}`, ...prev].slice(
          0,
          20
        )
      );

      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setWaitingForNewValue(true);
    }
  }, [display, operator, prevValue]);

  const clearHistory = () => setHistory([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        inputDigit(e.key);
      } else if (e.key === ".") {
        inputDecimal();
      } else if (e.key === "+") {
        performOperator("+");
      } else if (e.key === "-") {
        performOperator("-");
      } else if (e.key === "*") {
        performOperator("×");
      } else if (e.key === "/") {
        e.preventDefault();
        performOperator("÷");
      } else if (e.key === "Enter" || e.key === "=") {
        handleEquals();
      } else if (e.key === "Backspace") {
        backspace();
      } else if (e.key === "Escape") {
        clearAll();
      } else if (e.key === "%") {
        inputPercent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    inputDigit,
    inputDecimal,
    performOperator,
    handleEquals,
    backspace,
    clearAll,
    inputPercent,
  ]);

  const buttonClass =
    "h-16 rounded-2xl text-xl font-medium flex items-center justify-center active:scale-95 transition shadow-md";

  return (
    <div className="flex min-h-screen items-center justify-center gap-6 bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 p-6">
      <div className="w-80 rounded-3xl bg-white/10 backdrop-blur-xl p-4 shadow-2xl border border-white/10">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-sm font-medium text-white/60">電卓</span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-medium text-purple-300 hover:text-purple-100"
          >
            履歴 {showHistory ? "▲" : "▼"}
          </button>
        </div>

        <div className="mb-4 flex h-24 items-end justify-end overflow-hidden px-2">
          <span className="truncate text-5xl font-light text-white">
            {display}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <button onClick={clearAll} className={`${buttonClass} bg-white/20 text-white`}>
            AC
          </button>
          <button onClick={toggleSign} className={`${buttonClass} bg-white/20 text-white`}>
            +/-
          </button>
          <button onClick={inputPercent} className={`${buttonClass} bg-white/20 text-white`}>
            %
          </button>
          <button onClick={() => performOperator("÷")} className={`${buttonClass} bg-purple-500 text-white`}>
            ÷
          </button>

          <button onClick={() => inputDigit("7")} className={`${buttonClass} bg-white/5 text-white`}>
            7
          </button>
          <button onClick={() => inputDigit("8")} className={`${buttonClass} bg-white/5 text-white`}>
            8
          </button>
          <button onClick={() => inputDigit("9")} className={`${buttonClass} bg-white/5 text-white`}>
            9
          </button>
          <button onClick={() => performOperator("×")} className={`${buttonClass} bg-purple-500 text-white`}>
            ×
          </button>

          <button onClick={() => inputDigit("4")} className={`${buttonClass} bg-white/5 text-white`}>
            4
          </button>
          <button onClick={() => inputDigit("5")} className={`${buttonClass} bg-white/5 text-white`}>
            5
          </button>
          <button onClick={() => inputDigit("6")} className={`${buttonClass} bg-white/5 text-white`}>
            6
          </button>
          <button onClick={() => performOperator("-")} className={`${buttonClass} bg-purple-500 text-white`}>
            -
          </button>

          <button onClick={() => inputDigit("1")} className={`${buttonClass} bg-white/5 text-white`}>
            1
          </button>
          <button onClick={() => inputDigit("2")} className={`${buttonClass} bg-white/5 text-white`}>
            2
          </button>
          <button onClick={() => inputDigit("3")} className={`${buttonClass} bg-white/5 text-white`}>
            3
          </button>
          <button onClick={() => performOperator("+")} className={`${buttonClass} bg-purple-500 text-white`}>
            +
          </button>

          <button onClick={inputSquare} className={`${buttonClass} bg-white/20 text-white`}>
            x²
          </button>
          <button onClick={() => inputDigit("0")} className={`${buttonClass} bg-white/5 text-white`}>
            0
          </button>
          <button onClick={inputDecimal} className={`${buttonClass} bg-white/5 text-white`}>
            .
          </button>
          <button onClick={handleEquals} className={`${buttonClass} bg-purple-500 text-white`}>
            =
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-white/40">
          キーボード操作にも対応しています
        </p>
      </div>

      {showHistory && (
        <div className="w-64 max-h-[520px] overflow-y-auto rounded-3xl bg-white/10 backdrop-blur-xl p-4 shadow-2xl border border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-white/80">計算履歴</span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-red-300 hover:text-red-200"
              >
                クリア
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-white/40">まだ履歴がありません</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item, index) => (
                <li
                  key={index}
                  className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}