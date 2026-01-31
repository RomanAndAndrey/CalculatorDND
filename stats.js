/**
 * DND Dice Roller — Статистические функции
 * Порт из code.py → JavaScript
 */

/**
 * Вычисление перцентиля
 * @param {number[]} vals - Массив значений
 * @param {number} p - Перцентиль (0-1)
 * @returns {number}
 */
export function percentile(vals, p) {
  if (!vals || vals.length === 0) return NaN;
  if (vals.length === 1) return vals[0];
  
  const xs = [...vals].sort((a, b) => a - b);
  const n = xs.length;
  const k = (n - 1) * p;
  const i = Math.floor(k);
  const j = Math.ceil(k);
  
  if (i === j) return xs[i];
  return xs[i] * (j - k) + xs[j] * (k - i);
}

/**
 * Среднее значение
 * @param {number[]} vals - Массив значений
 * @returns {number}
 */
export function sampleMean(vals) {
  if (!vals || vals.length === 0) return NaN;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Выборочная дисперсия
 * @param {number[]} vals - Массив значений
 * @returns {number}
 */
export function sampleVariance(vals) {
  if (!vals || vals.length < 2) return 0;
  
  const mu = sampleMean(vals);
  const sumSq = vals.reduce((acc, x) => acc + Math.pow(x - mu, 2), 0);
  return sumSq / (vals.length - 1); // Выборочная дисперсия
}

/**
 * Стандартное отклонение
 * @param {number[]} vals - Массив значений
 * @returns {number}
 */
export function standardDeviation(vals) {
  return Math.sqrt(sampleVariance(vals));
}

/**
 * Индекс надёжности (0-1)
 * Показывает насколько стабильны результаты
 * @param {number[]} vals - Массив значений
 * @param {number} pLow - Нижний перцентиль (по умолчанию 0.10)
 * @param {number} pHigh - Верхний перцентиль (по умолчанию 0.90)
 * @returns {number}
 */
export function reliabilityIndex(vals, pLow = 0.10, pHigh = 0.90) {
  if (!vals || vals.length === 0) return 0;
  
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  
  // Если все значения одинаковые — 100% надёжность
  if (Math.abs(vmax - vmin) < 0.0001) return 1;
  
  const variance = sampleVariance(vals);
  const sigma = Math.sqrt(variance);
  const w = percentile(vals, pHigh) - percentile(vals, pLow);
  
  // Нормируем через наблюдаемый диапазон
  const sSigma = Math.max(0, 1 - sigma / ((vmax - vmin) / 2));
  const sW = Math.max(0, 1 - w / (vmax - vmin));
  const R = (sSigma + sW) / 2;
  
  return Math.min(1, R);
}

/**
 * Подсчёт успешных бросков по КД
 * @param {number[]} values - Массив результатов
 * @param {number|null} kd - Класс доспеха / сложность
 * @returns {{count: number|null, percent: number|null}}
 */
export function successRate(values, kd) {
  if (kd === null || kd === undefined) {
    return { count: null, percent: null };
  }
  
  if (!values || values.length === 0) {
    return { count: 0, percent: 0 };
  }
  
  const count = values.filter(v => v >= kd).length;
  const percent = (count / values.length) * 100;
  
  return { count, percent };
}

/**
 * Расчёт урона по "системе Бобра"
 * Урон = floor(результат / КД), если результат >= КД, иначе 0
 * @param {number[]} values - Массив результатов
 * @param {number|null} kd - Класс доспеха / сложность
 * @returns {{total: number|null, avg: number|null}}
 */
export function beaverDamage(values, kd) {
  if (kd === null || kd === undefined || kd <= 0) {
    return { total: null, avg: null };
  }
  
  if (!values || values.length === 0) {
    return { total: 0, avg: 0 };
  }
  
  let totalDamage = 0;
  for (const v of values) {
    if (v >= kd) {
      totalDamage += Math.floor(v / kd);
    }
  }
  
  const avgDamage = totalDamage / values.length;
  
  return { total: totalDamage, avg: avgDamage };
}

/**
 * Полный статистический анализ
 * @param {number[]} values - Массив результатов
 * @param {number|null} kd - Класс доспеха (опционально)
 * @returns {object}
 */
export function fullStats(values, kd = null) {
  if (!values || values.length === 0) {
    return {
      total: 0,
      avg: 0,
      variance: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      p10: 0,
      p50: 0,
      p90: 0,
      reliability: 0,
      successRate: { count: null, percent: null },
      beaverDamage: { total: null, avg: null }
    };
  }
  
  return {
    total: values.reduce((a, b) => a + b, 0),
    avg: sampleMean(values),
    variance: sampleVariance(values),
    stdDev: standardDeviation(values),
    min: Math.min(...values),
    max: Math.max(...values),
    p10: percentile(values, 0.10),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
    reliability: reliabilityIndex(values),
    successRate: successRate(values, kd),
    beaverDamage: beaverDamage(values, kd)
  };
}
