/**
 * DND Dice Roller — LocalStorage для истории бросков
 */

const STORAGE_KEY = 'dnd-dice-roller-history';
const MAX_HISTORY = 20;

/**
 * Получить историю бросков
 * @returns {Array} - Массив записей истории
 */
export function getHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Сохранить бросок в историю
 * @param {object} entry - Запись броска
 * @param {string} entry.expr - Выражение
 * @param {number} entry.result - Результат
 * @param {number} entry.advantage - Фактор преимущества
 * @param {number} entry.times - Количество повторений
 * @param {number|null} entry.kd - КД (если указан)
 * @param {Array} entry.values - Массив результатов бросков
 * @param {Date} entry.timestamp - Время броска
 */
export function saveRoll(entry) {
  try {
    const history = getHistory();
    
    // Ограничиваем количество результатов для экономии места в LocalStorage
    if (entry.values && entry.values.length > 10000) {
      entry.values = entry.values.slice(0, 10000);
    }

    history.unshift({
      ...entry,
      id: Date.now(),
      timestamp: new Date().toISOString()
    });
    
    // Ограничиваем количество записей
    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Ошибка сохранения в историю:', err);
  }
}

/**
 * Удалить запись из истории
 * @param {number} id - ID записи
 */
export function removeFromHistory(id) {
  try {
    const history = getHistory();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Ошибка удаления из истории:', err);
  }
}

/**
 * Очистить всю историю
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Ошибка очистки истории:', err);
  }
}

/**
 * Экспорт истории в JSON
 * @returns {string} - JSON строка
 */
export function exportHistory() {
  return JSON.stringify(getHistory(), null, 2);
}

/**
 * Импорт истории из JSON
 * @param {string} jsonStr - JSON строка
 * @returns {boolean} - Успешность импорта
 */
export function importHistory(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data)) return false;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(0, MAX_HISTORY)));
    return true;
  } catch {
    return false;
  }
}
