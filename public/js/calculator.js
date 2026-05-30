/**
 * ChessKidoo Admin - Floating Premium Calculator Widget
 * Features: Sleek Glassmorphism UI, Draggable, Keyboard Support, Safe Math Evaluation, Memory, Parentheses, Percentages
 */
(function () {
  let currentValue = '0';
  let expressionStr = '';
  let shouldResetDisplay = false;
  let memoryValue = 0;

  // Draggable Window Logic
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  window.dragStart = function (e) {
    const calc = document.getElementById('floating-calc');
    if (!calc || calc.classList.contains('minimized')) return;
    
    if (e.button !== 0 || e.target.closest('.calc-controls')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = calc.getBoundingClientRect();
    
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
    
    const nextLeft = rect.left + dx;
    const nextTop = rect.top + dy;
    
    if (nextLeft > 10 && nextLeft < window.innerWidth - 50) {
      calc.style.left = nextLeft + 'px';
    }
    if (nextTop > 10 && nextTop < window.innerHeight - 50) {
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
    if (display) display.textContent = currentValue || '0';
    if (prevExpr) prevExpr.textContent = expressionStr;
  }

  window.calcInput = function (char) {
    if (shouldResetDisplay) {
      if (/[0-9(]/.test(char)) {
        currentValue = '';
      }
      shouldResetDisplay = false;
    }

    if (currentValue === '0' && char !== '.' && char !== '%' && char !== ')' && !/[+/*-]/.test(char)) {
      currentValue = char;
    } else {
      currentValue += char;
    }
    updateDisplay();
  };

  window.calcOperator = function (op) {
    if (shouldResetDisplay) {
      shouldResetDisplay = false;
    }
    
    // Replace visual operators if entered by keyboard
    if (op === '÷') op = '/';
    if (op === '×') op = '*';
    if (op === '−') op = '-';

    const lastChar = currentValue.slice(-1);
    // Don't allow multiple operators in a row unless it's a negative sign
    if (/[+/*-]/.test(lastChar) && op !== '-') {
      currentValue = currentValue.slice(0, -1) + op;
    } else {
      currentValue += op;
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

  window.calcMemory = function(action) {
    if (action === 'mc') {
      memoryValue = 0;
      if(window.toast) window.toast('Memory Cleared', 'info');
    } else if (action === 'mr') {
      calcInput(String(memoryValue));
    } else if (action === 'm+') {
      calcEvaluate();
      memoryValue += parseFloat(currentValue || 0);
      if(window.toast) window.toast('Added to Memory', 'info');
    } else if (action === 'm-') {
      calcEvaluate();
      memoryValue -= parseFloat(currentValue || 0);
      if(window.toast) window.toast('Subtracted from Memory', 'info');
    }
  };

  function safeEvaluateBase(expr) {
    expr = expr.replace(/([0-9.]+)\%/g, (match, num) => String(parseFloat(num) / 100));
    expr = expr.replace(/\-\-/g, '+').replace(/\+\-/g, '-').replace(/\-\+/g, '-');
    
    const tokens = expr.match(/([+-]?(?:[0-9]*\.[0-9]+|[0-9]+))|([*/])/g) || [];
    
    const nextTokens = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '*' || token === '/') {
        if (nextTokens.length === 0) return NaN;
        const left = parseFloat(nextTokens.pop());
        const right = parseFloat(tokens[++i]);
        if (isNaN(left) || isNaN(right)) return NaN;
        const res = token === '*' ? left * right : left / right;
        nextTokens.push(res >= 0 ? '+' + res : String(res));
      } else {
        nextTokens.push(token);
      }
      i++;
    }

    let result = 0;
    for (const token of nextTokens) {
      result += parseFloat(token);
    }
    return result;
  }

  function safeEvaluate(expr) {
    expr = expr.replace(/\s+/g, '');
    
    let maxIters = 100;
    while (expr.includes('(') && maxIters-- > 0) {
      expr = expr.replace(/\(([^()]+)\)/g, (match, innerExpr) => {
        return safeEvaluateBase(innerExpr);
      });
    }
    
    return safeEvaluateBase(expr);
  }

  window.calcEvaluate = function () {
    if (!currentValue) return;

    let evalExpr = currentValue;
    evalExpr = evalExpr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');

    try {
      const result = safeEvaluate(evalExpr);
      
      if (result === undefined || isNaN(result) || !isFinite(result)) {
        throw new Error();
      }
      
      const cleanResult = parseFloat(result.toFixed(8));
      
      expressionStr = currentValue + ' =';
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

    // Don't intercept if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;

    if (/[0-9()]/.test(key) || key === '%') {
      calcInput(key);
      e.preventDefault();
    } else if (['+', '-', '*', '/'].includes(key)) {
      calcOperator(key);
      e.preventDefault();
    } else if (key === '.' || key === ',') {
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
