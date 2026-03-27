import React, { useEffect, useRef } from 'react';
import { SolariBoard } from './solari.js';

export function Solari({
  cols = 20,
  rows = 8,
  quotes,
  theme = 'classic',
  sound = false,
  flipMs = 150,
  charDelay = 50,
  holdMs = 5000,
  autoStart = true,
  className = '',
  style = {},
  onReady,
}) {
  const containerRef = useRef(null);
  const boardRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const board = new SolariBoard(containerRef.current, {
      cols,
      rows,
      quotes,
      theme,
      sound,
      flipMs,
      charDelay,
      holdMs,
    });

    boardRef.current = board;

    if (autoStart) {
      board.start();
    }

    if (onReady) {
      onReady(board);
    }

    return () => {
      board.destroy();
      boardRef.current = null;
    };
  }, [cols, rows, flipMs, charDelay, holdMs]);

  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (boardRef.current && quotes) {
      boardRef.current.setQuotes(quotes);
    }
  }, [quotes]);

  return React.createElement('div', {
    ref: containerRef,
    className: className ? `solari-wrapper ${className}` : 'solari-wrapper',
    style,
  });
}

export { SolariBoard };
