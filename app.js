/**
 * DND Dice Roller — Главный модуль приложения
 */

import { 
  setAdvantage, 
  getAdvantage, 
  evalOnce, 
  evalMany, 
  validateExpression,
  factorDesc,
  isCriticalSuccess,
  isCriticalFail
} from './dice-engine.js';

import { fullStats } from './stats.js';

import { 
  getHistory, 
  saveRoll, 
  clearHistory 
} from './storage.js';

// ===== DOM Elements =====
const formulaInput = document.getElementById('formula-input');
const formulaError = document.getElementById('formula-error');
const advantageInput = document.getElementById('advantage-input');
const advantageDesc = document.getElementById('advantage-desc');
const timesInput = document.getElementById('times-input');
const kdInput = document.getElementById('kd-input');
const rollBtn = document.getElementById('roll-btn');

const resultSection = document.getElementById('result-section');
const resultValue = document.getElementById('result-value');
const resultLabel = document.getElementById('result-label');

const statsSection = document.getElementById('stats-section');
const kcSection = document.getElementById('kc-section');

const histogramContainer = document.getElementById('histogram-container');
const histogramChart = document.getElementById('histogram-chart');

const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const quickDiceButtons = document.querySelectorAll('.btn-dice');

// Тема
const themeToggle = document.getElementById('theme-toggle');
const chartTooltip = document.getElementById('chart-tooltip');

// История графиков (инициализируются в init)
let chartHistorySection, chartHistoryList, compareChartsBtn;
let clearChartHistoryBtn, compareModal, compareChartContainer;
let compareLegend, closeCompareBtn;

// ===== State =====
let lastRollValues = [];
let isAnimating = false;
let currentTheme = localStorage.getItem('theme') || 'dark';
let chartHistory = []; // Массив: { id, expr, times, dataPoints, svgPath, color }
let selectedCharts = new Set();

// ===== Инициализация =====
function init() {
  // Получаем DOM элементы истории графиков
  chartHistorySection = document.getElementById('chart-history-section');
  chartHistoryList = document.getElementById('chart-history-list');
  compareChartsBtn = document.getElementById('compare-charts-btn');
  clearChartHistoryBtn = document.getElementById('clear-chart-history-btn');
  compareModal = document.getElementById('compare-modal');
  compareChartContainer = document.getElementById('compare-chart-container');
  compareLegend = document.getElementById('compare-legend');
  closeCompareBtn = document.getElementById('close-compare-btn');
  
  // Применить сохранённую тему
  applyTheme(currentTheme);
  
  // Загрузить историю
  renderHistory();
  
  // Event listeners
  formulaInput.addEventListener('input', handleFormulaInput);
  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performRoll();
  });
  
  advantageInput.addEventListener('input', handleAdvantageChange);
  
  rollBtn.addEventListener('click', performRoll);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
  
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);
  
  // Chart history
  if (compareChartsBtn) compareChartsBtn.addEventListener('click', openCompareModal);
  if (clearChartHistoryBtn) clearChartHistoryBtn.addEventListener('click', clearChartHistory);
  if (closeCompareBtn) closeCompareBtn.addEventListener('click', closeCompareModal);
  if (compareModal) {
    compareModal.addEventListener('click', (e) => {
      if (e.target === compareModal) closeCompareModal();
    });
  }
  
  // Закрытие модалки по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (compareModal && !compareModal.classList.contains('hidden')) closeCompareModal();
      const historyModal = document.getElementById('history-modal');
      if (historyModal && !historyModal.classList.contains('hidden')) historyModal.classList.add('hidden');
    }
  });
  
  // Quick dice buttons
  quickDiceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const dice = btn.dataset.dice;
      formulaInput.value = dice;
      formulaInput.focus();
      validateFormula();
    });
  });
  
  // Инициализация слайдера
  handleAdvantageChange();
}

// ===== Управление темой =====

/**
 * Применить тему
 */
function applyTheme(theme) {
  currentTheme = theme;
  const appTitle = document.getElementById('app-title');
  
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<span class="emoji-fix">🌞</span>';
    if (appTitle) appTitle.innerHTML = '<span class="emoji-fix">🍎</span> Калькулятор Бобриный';
    document.title = '🍎 Калькулятор Бобриный';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.innerHTML = '<span class="emoji-fix">🌛</span>';
    if (appTitle) appTitle.innerHTML = '<span class="emoji-fix">💀</span> Калькулятор Бобинный';
    document.title = '💀 Калькулятор Бобинный';
  }
  
  localStorage.setItem('theme', theme);
}

/**
 * Переключить тему
 */
function toggleTheme() {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// ===== Обработчики =====

/**
 * Обработка ввода формулы
 */
function handleFormulaInput() {
  validateFormula();
}

/**
 * Валидация формулы
 */
function validateFormula() {
  const expr = formulaInput.value.trim();
  
  if (!expr) {
    formulaInput.classList.remove('input--error');
    formulaError.textContent = '';
    return true;
  }
  
  const result = validateExpression(expr);
  
  if (!result.valid) {
    formulaInput.classList.add('input--error');
    formulaError.textContent = result.error;
    return false;
  }
  
  formulaInput.classList.remove('input--error');
  formulaError.textContent = '';
  return true;
}

/**
 * Изменение фактора преимущества
 */
function handleAdvantageChange() {
  const factor = parseInt(advantageInput.value, 10) || 0;
  setAdvantage(factor);
  
  // Обновляем описание
  advantageDesc.textContent = factorDesc(factor);
  
  // Цвет поля ввода
  advantageInput.classList.remove(
    'advantage--positive',
    'advantage--negative',
    'advantage--neutral'
  );
  
  if (factor > 0) {
    advantageInput.classList.add('advantage--positive');
  } else if (factor < 0) {
    advantageInput.classList.add('advantage--negative');
  } else {
    advantageInput.classList.add('advantage--neutral');
  }
}

/**
 * Выполнение броска
 */
function performRoll() {
  if (isAnimating) return;
  
  const expr = formulaInput.value.trim();
  
  if (!expr) {
    formulaError.textContent = 'Введите выражение';
    formulaInput.classList.add('input--error');
    return;
  }
  
  if (!validateFormula()) return;
  
  const times = Math.min(100000, Math.max(1, parseInt(timesInput.value, 10) || 1));
  const kdValue = kdInput.value.trim();
  const kd = kdValue ? parseFloat(kdValue) : null;
  
  try {
    // Выполняем броски
    const { total, avg, values } = evalMany(expr, times);
    lastRollValues = values;
    
    // Показываем результат
    showResult(total, times, expr);
    
    // Обновляем статистику
    updateStats(values, kd, expr, times);
    
    // Сохраняем в историю
    saveRoll({
      expr,
      result: times === 1 ? values[0] : total,
      advantage: getAdvantage(),
      times,
      kd,
      values: lastRollValues
    });
    
    // Обновляем отображение истории
    renderHistory();
    
  } catch (err) {
    formulaError.textContent = err.message;
    formulaInput.classList.add('input--error');
  }
}

/**
 * Показать результат с анимацией
 */
function showResult(total, times, expr) {
  resultSection.classList.remove('hidden');
  
  const singleResult = times === 1 ? lastRollValues[0] : null;
  const displayValue = singleResult !== null ? singleResult : total;
  
  // Проверяем на крит
  const isCritSuccess = singleResult !== null && isCriticalSuccess(expr, singleResult);
  const isCritFail = singleResult !== null && isCriticalFail(expr, singleResult);
  
  // Анимация счётчика
  animateValue(resultValue, 0, displayValue, 400)
    .then(() => {
      // Добавляем эффекты крита
      resultValue.classList.remove('result-display__value--crit-success', 'result-display__value--crit-fail', 'glitch');
      
      if (isCritSuccess) {
        resultValue.classList.add('result-display__value--crit-success', 'glitch');
        resultLabel.innerHTML = '<span class="emoji-fix">🎯</span> КРИТИЧЕСКИЙ УСПЕХ!';
      } else if (isCritFail) {
        resultValue.classList.add('result-display__value--crit-fail', 'glitch');
        resultLabel.innerHTML = '<span class="emoji-fix">💀</span> КРИТИЧЕСКИЙ ПРОВАЛ!';
      } else {
        resultLabel.textContent = times === 1 ? 'Результат' : `Сумма (${times} бросков)`;
      }
    });
}

/**
 * Анимация изменения числа
 */
function animateValue(element, start, end, duration) {
  return new Promise((resolve) => {
    // Проверяем prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = formatNumber(end);
      resolve();
      return;
    }
    
    isAnimating = true;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      
      element.textContent = formatNumber(current);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = formatNumber(end);
        isAnimating = false;
        resolve();
      }
    }
    
    requestAnimationFrame(update);
  });
}

/**
 * Форматирование числа
 */
function formatNumber(num) {
  if (Number.isInteger(num)) {
    return num.toLocaleString('ru-RU');
  }
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

/**
 * Обновление статистики
 */
function updateStats(values, kd, expr, times) {
  const stats = fullStats(values, kd);
  
  // Показываем секцию статистики
  statsSection.classList.remove('hidden');
  
  // Обновляем значения
  document.getElementById('stat-total').textContent = formatNumber(stats.total);
  document.getElementById('stat-avg').textContent = formatNumber(parseFloat(stats.avg.toFixed(2)));
  document.getElementById('stat-variance').textContent = formatNumber(Math.round(stats.variance));
  document.getElementById('stat-stddev').textContent = stats.stdDev.toFixed(2);
  document.getElementById('stat-min').textContent = formatNumber(stats.min);
  document.getElementById('stat-max').textContent = formatNumber(stats.max);
  document.getElementById('stat-p10').textContent = formatNumber(parseFloat(stats.p10.toFixed(1)));
  document.getElementById('stat-p50').textContent = formatNumber(parseFloat(stats.p50.toFixed(1)));
  document.getElementById('stat-p90').textContent = formatNumber(parseFloat(stats.p90.toFixed(1)));
  document.getElementById('stat-reliability').textContent = (stats.reliability * 100).toFixed(1) + '%';
  
  // Прогресс-бар надёжности
  document.getElementById('reliability-bar').style.width = (stats.reliability * 100) + '%';
  
  // Секция КД
  if (kd !== null && kd > 0) {
    kcSection.classList.remove('hidden');
    
    const successPercent = stats.successRate.percent || 0;
    const successCount = stats.successRate.count || 0;
    
    document.getElementById('kc-success-value').textContent = 
      `${successPercent.toFixed(1)}% (${successCount}/${values.length})`;
    document.getElementById('kc-success-bar').style.width = successPercent + '%';
    
    // Меняем цвет в зависимости от успешности
    const successBar = document.getElementById('kc-success-bar');
    successBar.classList.remove('progress__bar--success', 'progress__bar--danger');
    successBar.classList.add(successPercent >= 50 ? 'progress__bar--success' : 'progress__bar--danger');
    
    // Урон по системе Бобра
    if (stats.beaverDamage.total !== null) {
      document.getElementById('kc-damage-value').textContent = 
        `${formatNumber(stats.beaverDamage.total)} (avg: ${stats.beaverDamage.avg.toFixed(2)})`;
    }
  } else {
    kcSection.classList.add('hidden');
  }
  
  // Рендерим гистограмму если достаточно данных
  if (values.length >= 10) {
    renderHistogram(values, expr, times);
  } else {
    histogramContainer.classList.add('hidden');
  }
}

/**
 * Построение линейного графика распределения (SVG)
 */
function renderHistogram(values, expr, times) {
  // Используем setTimeout чтобы не блокировать UI при больших объёмах
  setTimeout(() => {
    buildHistogramAsync(values, expr, times);
  }, 50);
}

/**
 * Асинхронное построение гистограммы
 */
function buildHistogramAsync(values, expr, times, targetElements = null, skipHistory = false) {
  // Контейнеры по умолчанию
  const elements = targetElements || {
    chart: histogramChart,
    container: histogramContainer,
    min: document.getElementById('histogram-min'),
    max: document.getElementById('histogram-max'),
    mode: document.getElementById('histogram-mode'),
    peak: document.getElementById('histogram-peak-count')
  };

  // Подсчёт частот
  const frequency = {};
  let maxCount = 0;
  let mode = values[0];
  
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    frequency[v] = (frequency[v] || 0) + 1;
    if (frequency[v] > maxCount) {
      maxCount = frequency[v];
      mode = v;
    }
  }
  
  // Получаем уникальные значения и сортируем
  const uniqueValues = Object.keys(frequency).map(Number).sort((a, b) => a - b);
  const minVal = uniqueValues[0];
  const maxVal = uniqueValues[uniqueValues.length - 1];
  
  // Группируем данные если нужно
  let dataPoints;
  
  if (uniqueValues.length > 60) {
    // Группируем в бакеты — используем уже посчитанный frequency вместо values
    const numBuckets = 50;
    const range = maxVal - minVal;
    const bucketSize = Math.ceil(range / numBuckets) || 1;
    
    const buckets = {};
    // Оптимизация: проходим по frequency, а не по values
    for (const [val, count] of Object.entries(frequency)) {
      const v = parseFloat(val);
      const bucketIndex = Math.floor((v - minVal) / bucketSize);
      const bucketCenter = minVal + bucketIndex * bucketSize + bucketSize / 2;
      buckets[bucketCenter] = (buckets[bucketCenter] || 0) + count;
    }
    
    dataPoints = Object.entries(buckets)
      .map(([x, y]) => ({ x: parseFloat(x), y }))
      .sort((a, b) => a.x - b.x);
    
    maxCount = Math.max(...dataPoints.map(p => p.y));
  } else {
    dataPoints = uniqueValues.map(x => ({ x, y: frequency[x] }));
  }
  
  // Размеры SVG
  const width = 800;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Масштабирование
  const xMin = dataPoints[0].x;
  const xMax = dataPoints[dataPoints.length - 1].x;
  const xRange = xMax - xMin || 1;
  
  const scaleX = (x) => padding.left + ((x - xMin) / xRange) * chartWidth;
  const scaleY = (y) => padding.top + chartHeight - (y / maxCount) * chartHeight;
  
  // Строим точки для линии
  const points = dataPoints.map(p => ({ 
    x: scaleX(p.x), 
    y: scaleY(p.y),
    value: p.x,
    count: p.y,
    percent: ((p.y / values.length) * 100).toFixed(1)
  }));
  
  // Создаём плавную кривую (Catmull-Rom to Bezier)
  function catmullRomToBezier(points) {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }
    
    let path = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    
    return path;
  }
  
  const linePath = catmullRomToBezier(points);
  
  // Area path (заливка под кривой)
  const areaPath = linePath + 
    ` L ${points[points.length - 1].x},${height - padding.bottom}` +
    ` L ${points[0].x},${height - padding.bottom} Z`;
  
  // Находим пиковую точку
  const peakIndex = dataPoints.findIndex(p => p.y === maxCount);
  
  // Горизонтальные линии сетки
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const y = scaleY(maxCount * ratio);
    const label = Math.round(maxCount * ratio);
    return `<line class="histogram__grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>
            <text class="histogram__axis-label" x="${padding.left - 8}" y="${y + 4}" text-anchor="end">${label}</text>`;
  }).join('');
  
  // X-axis labels
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const value = xMin + xRange * ratio;
    const x = scaleX(value);
    return `<text class="histogram__axis-label" x="${x}" y="${height - 8}" text-anchor="middle">${formatNumber(Math.round(value))}</text>`;
  }).join('');
  
  // Точки на графике
  const dotsHtml = points.map((p, i) => {
    const isPeak = i === peakIndex;
    return `<circle class="histogram__dot ${isPeak ? 'histogram__dot--peak' : ''}" 
                    cx="${p.x}" cy="${p.y}" r="${isPeak ? 6 : 4}"
                    data-value="${p.value}" data-count="${p.count}" data-percent="${p.percent}"/>`;
  }).join('');
  
  // Собираем SVG
  // Генерируем уникальный ID для градиентов чтобы они не конфликтовали если открыто два графика
  const gradId = 'grad-' + Math.random().toString(36).substr(2, 9);
  const svgHtml = `
    <svg class="histogram__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGradient-${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="50%" stop-color="#A78BFA"/>
          <stop offset="100%" stop-color="#F43F5E"/>
        </linearGradient>
        <linearGradient id="areaGradient-${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
        </linearGradient>
      </defs>
      
      <!-- Grid -->
      ${gridLines}
      
      <!-- X axis labels -->
      ${xLabels}
      
      <!-- Area fill -->
      <path class="histogram__area" d="${areaPath}" style="fill: url(#areaGradient-${gradId})"/>
      
      <!-- Line -->
      <path class="histogram__line" d="${linePath}" style="stroke: url(#lineGradient-${gradId})"/>
      
      <!-- Dots -->
      ${dotsHtml}
    </svg>
  `;
  
  // Обновляем DOM
  elements.chart.innerHTML = svgHtml;
  if (elements.container) elements.container.classList.remove('hidden');
  
  // Обновляем лейблы
  if (elements.min) elements.min.textContent = formatNumber(minVal);
  if (elements.max) elements.max.textContent = formatNumber(maxVal);
  if (elements.mode) elements.mode.textContent = formatNumber(mode);
  if (elements.peak) elements.peak.textContent = formatNumber(frequency[mode]);
  
  // Добавляем интерактивность для точек
  elements.chart.querySelectorAll('.histogram__dot').forEach(dot => {
    dot.addEventListener('mouseenter', (e) => {
      const value = e.target.dataset.value;
      const count = e.target.dataset.count;
      const percent = e.target.dataset.percent;
      
      // Показываем тултип
      chartTooltip.innerHTML = `
        <span class="chart-tooltip__value">Значение: ${formatNumber(Math.round(parseFloat(value)))}</span>
        Выпало: ${formatNumber(parseInt(count))} раз <span class="chart-tooltip__percent">(${percent}%)</span>
      `;
      chartTooltip.classList.add('visible');
    });
    
    dot.addEventListener('mousemove', (e) => {
      // Позиционируем тултип относительно курсора
      const tooltipRect = chartTooltip.getBoundingClientRect();
      let x = e.clientX + 15;
      let y = e.clientY - 10;
      
      // Не даём выйти за правый край
      if (x + tooltipRect.width > window.innerWidth) {
        x = e.clientX - tooltipRect.width - 15;
      }
      
      // Не даём выйти за верхний край
      if (y < 10) {
        y = e.clientY + 15;
      }
      
      chartTooltip.style.left = x + 'px';
      chartTooltip.style.top = y + 'px';
    });
    
    dot.addEventListener('mouseleave', () => {
      chartTooltip.classList.remove('visible');
    });
  });
  
  // Сохраняем в историю графиков (только для обычного броска)
  if (!skipHistory) {
    addToChartHistory(expr, times, dataPoints, linePath);
  }
}

/**
 * Рендер истории
 */
function renderHistory() {
  const history = getHistory();
  
  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        История пуста
      </div>
    `;
    return;
  }
  
  historyList.innerHTML = history.map(item => `
    <div class="history-item animate-fadeIn">
      <div>
        <div class="history-item__expr">${escapeHtml(item.expr)}</div>
        <div class="text-sm text-muted">
          ${item.times > 1 ? `×${item.times}` : ''} 
          ${item.advantage !== 0 ? `| ${item.advantage > 0 ? '+' : ''}${item.advantage}` : ''}
        </div>
      </div>
      <div class="flex items-center gap-075">
        <span class="history-item__result">${formatNumber(item.result)}</span>
        <div class="history-item__actions">
          <button class="history-item__btn history-item__btn--icon btn-view-chart" data-id="${item.id}" title="Посмотреть график">
            <span class="emoji-fix">📊</span>
          </button>
          <button class="history-item__btn btn-repeat" data-expr="${escapeHtml(item.expr)}" data-adv="${item.advantage}" data-times="${item.times}" data-kd="${item.kd || ''}">
            Повторить
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Event listeners для кнопок повтора
  historyList.querySelectorAll('.btn-repeat').forEach(btn => {
    btn.addEventListener('click', () => {
      formulaInput.value = btn.dataset.expr;
      advantageInput.value = btn.dataset.adv;
      timesInput.value = btn.dataset.times;
      kdInput.value = btn.dataset.kd;
      
      handleAdvantageChange();
      performRoll();
    });
  });

  // Event listeners для кнопок графика
  historyList.querySelectorAll('.btn-view-chart').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      showHistoryDetail(id);
    });
  });
}

/**
 * Показать детали из истории в модальном окне
 */
function showHistoryDetail(id) {
  const history = getHistory();
  const entry = history.find(item => item.id === id);
  
  if (!entry || !entry.values) return;
  
  const modal = document.getElementById('history-modal');
  const title = document.getElementById('history-modal-title');
  const statsContainer = document.getElementById('history-modal-stats');
  
  // Заголовок
  const date = new Date(entry.timestamp).toLocaleString('ru-RU');
  title.innerHTML = `Детали: ${escapeHtml(entry.expr)} <small style="display:block; font-size: 0.8rem; color: var(--text-muted); font-family: sans-serif;">${date}</small>`;
  
  // Статистика
  const stats = fullStats(entry.values, entry.kd);
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(stats.total)}</div>
      <div class="stat-card__label">Сумма</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(parseFloat(stats.avg.toFixed(2)))}</div>
      <div class="stat-card__label">Среднее</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(Math.round(stats.variance))}</div>
      <div class="stat-card__label">Дисперсия</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${stats.stdDev.toFixed(2)}</div>
      <div class="stat-card__label">Стд. откл.</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(stats.min)}</div>
      <div class="stat-card__label">Минимум</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(stats.max)}</div>
      <div class="stat-card__label">Максимум</div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">${formatNumber(stats.reliability * 100).split(',')[0]}%</div>
      <div class="stat-card__label">Надёжность</div>
    </div>
    ${entry.kd ? `
      <div class="stat-card">
        <div class="stat-card__value">${(stats.successRate.percent || 0).toFixed(1)}%</div>
        <div class="stat-card__label">Успех (КД ${entry.kd})</div>
      </div>
    ` : ''}
  `;
  
  // График
  const chartElements = {
    chart: document.getElementById('history-modal-chart'),
    container: document.getElementById('history-modal-chart-container'),
    min: null,
    max: null,
    mode: null,
    peak: null
  };
  
  modal.classList.remove('hidden');
  
  // Отрисовка графика (с небольшой задержкой для плавности)
  setTimeout(() => {
    buildHistogramAsync(entry.values, entry.expr, entry.times, chartElements, true);
  }, 50);
}

/**
 * Очистка истории
 */
function handleClearHistory() {
  clearHistory();
  renderHistory();
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== История графиков =====

// Цвета для графиков в истории
const chartColors = [
  '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#3B82F6',
  '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#84CC16'
];

/**
 * Добавить график в историю
 */
function addToChartHistory(expr, times, dataPoints, linePath) {
  const id = Date.now();
  const colorIndex = chartHistory.length % chartColors.length;
  
  chartHistory.push({
    id,
    expr,
    times,
    dataPoints,
    linePath,
    color: chartColors[colorIndex]
  });
  
  // Ограничим историю до 10 графиков
  if (chartHistory.length > 10) {
    chartHistory.shift();
  }
  
  renderChartHistory();
}

/**
 * Рендер истории графиков
 */
function renderChartHistory() {
  if (chartHistory.length === 0) {
    chartHistorySection.classList.add('hidden');
    return;
  }
  
  chartHistorySection.classList.remove('hidden');
  
  chartHistoryList.innerHTML = chartHistory.map(chart => `
    <div class="chart-history-item ${selectedCharts.has(chart.id) ? 'selected' : ''}" 
         data-id="${chart.id}">
      <div class="chart-history-item__checkbox"></div>
      <div class="chart-history-item__preview">
        <svg viewBox="0 0 600 250" preserveAspectRatio="xMidYMid meet">
          <path d="${chart.linePath}" fill="none" stroke="${chart.color}" stroke-width="2"/>
        </svg>
      </div>
      <div class="chart-history-item__label">${escapeHtml(chart.expr)}</div>
      <div class="chart-history-item__meta">${formatNumber(chart.times)} бросков</div>
    </div>
  `).join('');
  
  // Добавляем обработчики клика
  chartHistoryList.querySelectorAll('.chart-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      toggleChartSelection(id);
    });
  });
  
  updateCompareButton();
}

/**
 * Переключить выбор графика
 */
function toggleChartSelection(id) {
  if (selectedCharts.has(id)) {
    selectedCharts.delete(id);
  } else {
    selectedCharts.add(id);
  }
  renderChartHistory();
}

/**
 * Обновить состояние кнопки сравнения
 */
function updateCompareButton() {
  compareChartsBtn.disabled = selectedCharts.size < 2;
  compareChartsBtn.textContent = selectedCharts.size >= 2 
    ? `Сравнить (${selectedCharts.size})` 
    : 'Сравнить выбранные';
}

/**
 * Очистить историю графиков
 */
function clearChartHistory() {
  chartHistory = [];
  selectedCharts.clear();
  renderChartHistory();
}

/**
 * Открыть модальное окно сравнения
 */
function openCompareModal() {
  if (selectedCharts.size < 2) return;
  
  const chartsToCompare = chartHistory.filter(c => selectedCharts.has(c.id));
  
  // Находим общий диапазон для нормализации
  let allX = [];
  chartsToCompare.forEach(chart => {
    chart.dataPoints.forEach(p => allX.push(p.x));
  });
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  
  // SVG размеры
  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Генерируем линии для каждого графика
  let pathsHtml = '';
  chartsToCompare.forEach(chart => {
    // Нормализуем данные к общему диапазону X
    const maxY = Math.max(...chart.dataPoints.map(p => p.y));
    
    const points = chart.dataPoints.map(p => ({
      x: padding.left + ((p.x - minX) / (maxX - minX || 1)) * chartWidth,
      y: padding.top + chartHeight - (p.y / maxY) * chartHeight
    }));
    
    // Строим путь
    if (points.length > 0) {
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      pathsHtml += `<path d="${path}" fill="none" stroke="${chart.color}" stroke-width="3" opacity="0.8"/>`;
    }
  });
  
  // X axis labels (шкала значений)
  const rangeX = maxX - minX;
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const val = minX + rangeX * ratio;
    const x = padding.left + ratio * chartWidth;
    return `<text x="${x}" y="${height - 10}" class="histogram__axis-label" text-anchor="middle">${formatNumber(Math.round(val))}</text>`;
  }).join('');
  
  compareChartContainer.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:300px;">
      ${pathsHtml}
      ${xLabels}
    </svg>
  `;
  
  // Легенда
  compareLegend.innerHTML = chartsToCompare.map(chart => `
    <div class="compare-legend-item">
      <div class="compare-legend-color" style="background: ${chart.color}"></div>
      <span>${escapeHtml(chart.expr)} (${formatNumber(chart.times)})</span>
    </div>
  `).join('');
  
  compareModal.classList.remove('hidden');
}

/**
 * Закрыть модальное окно сравнения
 */
function closeCompareModal() {
  compareModal.classList.add('hidden');
}

// ===== Запуск =====
document.addEventListener('DOMContentLoaded', init);
