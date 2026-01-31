/**
 * DND Dice Roller — Движок бросков кубиков
 * Порт логики из code.py → JavaScript
 */

// Глобальный фактор преимущества/помехи
let ADV = 0;

/**
 * Установить фактор преимущества
 * @param {number} factor - Фактор: 0 = обычный, >0 = преимущество, <0 = помеха
 */
export function setAdvantage(factor) {
  ADV = Math.floor(factor);
}

/**
 * Получить текущий фактор преимущества
 * @returns {number}
 */
export function getAdvantage() {
  return ADV;
}

/**
 * Бросок одного кубика с учётом преимущества/помехи
 * @param {number} sides - Количество граней
 * @returns {number} - Результат броска
 */
export function dieWithAdv(sides) {
  sides = Math.floor(sides);
  if (sides < 1) {
    throw new Error('Число граней должно быть >= 1');
  }
  
  const trials = 1 + Math.abs(ADV);
  const rolls = [];
  
  for (let i = 0; i < trials; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  
  return ADV >= 0 ? Math.max(...rolls) : Math.min(...rolls);
}

/**
 * Бросок одного кубика dN
 * @param {number} n - Количество граней
 * @returns {number}
 */
export function d(n) {
  return dieWithAdv(Math.floor(n));
}

/**
 * Бросок NdM (N кубиков с M гранями)
 * @param {number} n - Количество кубиков
 * @param {number} m - Количество граней
 * @returns {number} - Сумма бросков
 */
export function roll(n, m) {
  n = Math.floor(n);
  m = Math.floor(m);
  
  if (n < 0 || m < 1) {
    throw new Error('Некорректная запись NdM (n >= 0, m >= 1)');
  }
  
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += dieWithAdv(m);
  }
  return total;
}

/**
 * Нормализация выражения
 * @param {string} expr - Исходное выражение
 * @returns {string} - Нормализованное выражение
 */
export function normalize(expr) {
  let e = expr.trim();
  
  // '^' -> '**' (степень)
  e = e.replace(/\^/g, '**');
  
  // Nd(M) -> roll(N,M), например 3d(6) -> roll(3,6)
  e = e.replace(/\b(\d+)\s*[dD]\s*\(\s*(\d+)\s*\)/g, 'roll($1,$2)');
  
  // NdM -> roll(N,M), например 3d6 -> roll(3,6)
  e = e.replace(/\b(\d+)\s*[dD]\s*(\d+)\b/g, 'roll($1,$2)');
  
  // dM -> d(M), например d20 -> d(20)
  e = e.replace(/\b[dD]\s*(\d+)\b/g, 'd($1)');
  
  return e;
}

/**
 * Проверка безопасности выражения
 * @param {string} e - Нормализованное выражение
 * @throws {Error} - Если найдены небезопасные символы или функции
 */
export function ensureSafe(e) {
  // Разрешаем только цифры, пробелы, операторы и имена функций
  if (/[^0-9+\-*/().,\sA-Za-z]/.test(e)) {
    throw new Error('Недопустимые символы в выражении');
  }
  
  // Извлекаем все идентификаторы
  const names = new Set(e.match(/[A-Za-z_]+/g) || []);
  const allowed = new Set(['d', 'roll']);
  
  for (const name of names) {
    if (!allowed.has(name)) {
      throw new Error(`Недопустимый идентификатор: ${name}`);
    }
  }
}

/**
 * Безопасное вычисление выражения один раз
 * @param {string} expr - Исходное выражение
 * @returns {number} - Результат
 */
export function evalOnce(expr) {
  const e = normalize(expr);
  ensureSafe(e);
  
  // Безопасный eval через Function
  try {
    const fn = new Function('d', 'roll', `return (${e});`);
    return fn(d, roll);
  } catch (err) {
    throw new Error(`Ошибка вычисления: ${err.message}`);
  }
}

/**
 * Многократное вычисление выражения
 * @param {string} expr - Исходное выражение
 * @param {number} times - Количество повторений
 * @returns {{total: number, avg: number, values: number[]}}
 */
export function evalMany(expr, times) {
  const values = [];
  
  for (let i = 0; i < times; i++) {
    values.push(evalOnce(expr));
  }
  
  const total = values.reduce((a, b) => a + b, 0);
  const avg = times > 0 ? total / times : 0;
  
  return { total, avg, values };
}

/**
 * Описание фактора преимущества
 * @param {number} f - Фактор
 * @returns {string}
 */
export function factorDesc(f) {
  const t = 1 + Math.abs(f);
  
  if (f === 0) {
    return 'обычный бросок';
  }
  if (f > 0) {
    return `преимущество: лучший из ${t}`;
  }
  return `помеха: худший из ${t}`;
}

/**
 * Проверка на критический успех (нат. 20 на d20)
 * @param {string} expr - Выражение
 * @param {number} result - Результат
 * @returns {boolean}
 */
export function isCriticalSuccess(expr, result) {
  const normalized = expr.toLowerCase().trim();
  // Проверяем, если это просто d20 и результат 20
  if ((normalized === 'd20' || normalized === '1d20') && result === 20) {
    return true;
  }
  return false;
}

/**
 * Проверка на критический провал (нат. 1 на d20)
 * @param {string} expr - Выражение
 * @param {number} result - Результат
 * @returns {boolean}
 */
export function isCriticalFail(expr, result) {
  const normalized = expr.toLowerCase().trim();
  // Проверяем, если это просто d20 и результат 1
  if ((normalized === 'd20' || normalized === '1d20') && result === 1) {
    return true;
  }
  return false;
}

/**
 * Валидация выражения (без выполнения)
 * @param {string} expr - Выражение
 * @returns {{valid: boolean, error?: string}}
 */
export function validateExpression(expr) {
  try {
    if (!expr.trim()) {
      return { valid: false, error: 'Введите выражение' };
    }
    
    const e = normalize(expr);
    ensureSafe(e);
    
    // Пробуем распарсить (без выполнения)
    new Function('d', 'roll', `return (${e});`);
    
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
