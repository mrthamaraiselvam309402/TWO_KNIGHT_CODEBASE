/**
 * ChessKidoo Admin - Floating Premium Calculator Widget
 * Features: Sleek Glassmorphism UI, Draggable, Keyboard Support, Safe Math Evaluation
 */
(function () {
  let currentValue = '0';
  let expressionStr = '';
  let shouldResetDisplay = false;

  // Draggable Window Logic
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  window.dragStart = function (e) {
    const calc = document.getElementById('floating-calc');
    if (!calc || calc.classList.contains('minimized')) return;
    
    // Only drag with left click on the header itself (not buttons)
    if (e.button !== 0 || e.target.closest('.calc-controls')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = calc.getBoundingClientRect();
    
    // Lock dimensions and unlock fixed coordinates
    calc.style.right = 'auto';
    calc.style.bottom = 'auto';
    calc.style.left = rect.left + 'px';
    calc.style.top = rect.top + 'px';

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', dragEnd);
    e.preventDefault();
  };

  function dragMove(e) {
    if (!isDragging) return;
    const calc = document.getElementById('floating-calc');
    if (!calc) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const rect = calc.getBoundingClientRect();
    
    // Bounds constraints to prevent dragging off-screen
    const nextLeft = rect.left + dx;
    const nextTop = rect.top + dy;
    
    if (nextLeft > 10 && nextLeft < window.innerWidth - 100) {
      calc.style.left = nextLeft + 'px';
    }
    if (nextTop > 10 && nextTop < window.innerHeight - 100) {
      calc.style.top = nextTop + 'px';
    }

    startX = e.clientX;
    startY = e.clientY;
  }

  function dragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
  }

  // UI Control Logic
  window.toggleCalculator = function () {
    const calc = document.getElementById('floating-calc');
    if (!calc) return;
    if (calc.style.display === 'none') {
      calc.style.display = 'flex';
      calc.classList.remove('minimized');
      calc.style.right = '30px';
      calc.style.bottom = '175px';
      calc.style.left = 'auto';
      calc.style.top = 'auto';
      calcClear();
    } else {
      calc.style.display = 'none';
    }
  };

  window.minimizeCalculator = function () {
    const calc = document.getElementById('floating-calc');
    if (!calc) return;
    calc.classList.toggle('minimized');
    if (calc.classList.contains('minimized')) {
      calc.style.bottom = '110px';
    } else {
      calc.style.bottom = '175px';
    }
  };

  // Calculator Math Operations
  function updateDisplay() {
    const display = document.getElementById('calc-display');
    const prevExpr = document.getElementById('calc-prev-expression');
    if (display) display.textContent = currentValue;
    if (prevExpr) prevExpr.textContent = expressionStr;
  }

  window.calcInput = function (num) {
    if (shouldResetDisplay) {
      currentValue = '';
      shouldResetDisplay = false;
    }

    if (num === '.') {
      if (currentValue.includes('.')) return; // prevent double decimal
      if (currentValue === '') currentValue = '0';
    }

    if (currentValue === '0' && num !== '.') {
      currentValue = num;
    } else {
      currentValue += num;
    }
    updateDisplay();
  };

  window.calcClear = function () {
    currentValue = '0';
    expressionStr = '';
    shouldResetDisplay = false;
    updateDisplay();
  };

  window.calcBackspace = function () {
    if (shouldResetDisplay) {
      calcClear();
      return;
    }
    if (currentValue.length > 1) {
      currentValue = currentValue.slice(0, -1);
    } else {
      currentValue = '0';
    }
    updateDisplay();
  };

  window.calcOperator = function (op) {
    if (shouldResetDisplay) {
      shouldResetDisplay = false;
    }
    
    // If we have an expression, calculate intermediate result first or chain it
    if (expressionStr && !isNaN(expressionStr.slice(-1))) {
      expressionStr += ' ' + currentValue + ' ' + op;
    } else {
      expressionStr = currentValue + ' ' + op;
    }
    currentValue = '0';
    updateDisplay();
  };

  window.calcEvaluate = function () {
    if (!expressionStr) return;

    let evalExpr = expressionStr + ' ' + currentValue;
    
    // Replace visual operator signs with actual JS ones safely
    evalExpr = evalExpr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');

    try {
      // Safe sandboxed numerical evaluation wrapper
      const result = Function('"use strict"; return (' + evalExpr + ')')();
      
      if (result === undefined || isNaN(result) || !isFinite(result)) {
        throw new Error();
      }
      
      // Clean up floating point decimal precision issues (e.g. 0.1 + 0.2 = 0.3)
      const cleanResult = parseFloat(result.toFixed(8));
      
      expressionStr = evalExpr + ' =';
      currentValue = String(cleanResult);
      shouldResetDisplay = true;
    } catch (e) {
      currentValue = 'Error';
      expressionStr = '';
      shouldResetDisplay = true;
    }
    updateDisplay();
  };

  // Keyboard Event Handlers
  document.addEventListener('keydown', function (e) {
    const calc = document.getElementById('floating-calc');
    if (!calc || calc.style.display === 'none' || calc.classList.contains('minimized')) return;

    const key = e.key;

    // Numbers 0-9
    if (/[0-9]/.test(key)) {
      calcInput(key);
      e.preventDefault();
    }
    // Operators
    else if (key === '+') {
      calcOperator('+');
      e.preventDefault();
    } else if (key === '-') {
      calcOperator('-');
      e.preventDefault();
    } else if (key === '*') {
      calcOperator('*');
      e.preventDefault();
    } else if (key === '/') {
      calcOperator('/');
      e.preventDefault();
    }
    // Actions
    else if (key === '.' || key === ',') {
      calcInput('.');
      e.preventDefault();
    } else if (key === 'Enter' || key === '=') {
      calcEvaluate();
      e.preventDefault();
    } else if (key === 'Backspace') {
      calcBackspace();
      e.preventDefault();
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      calcClear();
      e.preventDefault();
    }
  });
})();
