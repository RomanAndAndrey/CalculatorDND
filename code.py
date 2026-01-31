
import re
import random
from math import isclose, sqrt, floor, ceil

# ----- Настройки преимущества/помехи -----
ADV = 0  # 0 = обычный, >0 = преимущество, <0 = помеха

def set_advantage(factor: int):
    global ADV
    ADV = int(factor)

def die_with_adv(sides: int) -> int:
    sides = int(sides)
    if sides < 1:
        raise ValueError("Число граней должно быть >= 1")
    trials = 1 + abs(ADV)
    rolls = [random.randint(1, sides) for _ in range(trials)]
    return max(rolls) if ADV >= 0 else min(rolls)

# ----- Броски -----
def d(n: int) -> int:
    return die_with_adv(int(n))

def roll(n: int, m: int) -> int:
    n = int(n)
    m = int(m)
    if n < 0 or m < 1:
        raise ValueError("Некорректная запись NdM (n>=0, m>=1)")
    total = 0
    for _ in range(n):
        total += die_with_adv(m)
    return total

# ----- Нормализация и безопасность -----
def normalize(expr: str) -> str:
    e = expr.strip()
    # '^' -> '**' (степень)
    e = e.replace("^", "**")
    # Nd(М) -> roll(N,M), например 3d(6) -> roll(3,6)
    e = re.sub(r"\b(\d+)\s*[dD]\s*\(\s*(\d+)\s*\)", r"roll(\1,\2)", e)
    # NdM -> roll(N,M), например 3d6 -> roll(3,6)
    e = re.sub(r"\b(\d+)\s*[dD]\s*(\d+)\b", r"roll(\1,\2)", e)
    # dM -> d(M), например d20 -> d(20)
    e = re.sub(r"\b[dD]\s*(\d+)\b", r"d(\1)", e)
    return e

def ensure_safe(e: str):
    # Разрешаем только цифры, пробелы, . , ( ) + - * / и буквы (имена функций)
    if re.search(r"[^0-9+\-*/().,\sA-Za-z]", e):
        raise ValueError("Недопустимые символы в выражении")
    # Разрешаем только функции d и roll
    names = set(re.findall(r"[A-Za-z_]+", e))
    if not names.issubset({"d", "roll"}):
        bad = ", ".join(sorted(names - {"d", "roll"}))
        raise ValueError(f"Недопустимые идентификаторы: {bad}")

def eval_once(expr: str) -> float:
    e = normalize(expr)
    ensure_safe(e)
    return eval(e, {"__builtins__": {}}, {"d": d, "roll": roll})

# ----- Вспомогательная статистика -----
def percentile(vals, p):
    xs = sorted(vals)
    n = len(xs)
    if n == 0:
        return float("nan")
    if n == 1:
        return xs[0]
    k = (n - 1) * p
    i = floor(k)
    j = ceil(k)
    if i == j:
        return xs[i]
    return xs[i] * (j - k) + xs[j] * (k - i)

def sample_mean(vals):
    return sum(vals) / len(vals) if vals else float("nan")

def sample_variance(vals):
    n = len(vals)
    if n < 2:
        return 0.0
    mu = sample_mean(vals)
    return sum((x - mu) ** 2 for x in vals) / (n - 1)  # выборочная дисперсия

def reliability_index(vals, p_low=0.10, p_high=0.90):
    if not vals:
        return 0.0
    vmin, vmax = min(vals), max(vals)
    if isclose(vmax, vmin):
        return 1.0  # нулевой разброс => 100%
    var = sample_variance(vals)
    sigma = sqrt(var)
    w = percentile(vals, p_high) - percentile(vals, p_low)  # ширина центрального интервала
    # Нормируем через наблюдаемый диапазон
    S_sigma = max(0.0, 1.0 - sigma / ((vmax - vmin) / 2.0))
    S_w = max(0.0, 1.0 - w / (vmax - vmin))
    R = (S_sigma + S_w) / 2.0
    return min(1.0, R)

# ----- Многократная оценка -----
def eval_many(expr: str, times: int):
    values = []
    for _ in range(times):
        values.append(float(eval_once(expr)))
    total = sum(values)
    avg = total / times if times > 0 else 0.0
    return total, avg, values

def factor_desc(f: int) -> str:
    t = 1 + abs(f)
    if f == 0:
        return "обычный бросок (без преимущества)"
    if f > 0:
        return f"преимущество: выбирается лучший из {t}"
    return f"помеха: выбирается худший из {t}"

# ----- Проверка по КД и урон «по системе Бобра» -----
def success_rate(values, kd):
    if kd is None:
        return None, None
    cnt = sum(1 for v in values if v >= kd)
    pct = 100.0 * cnt / len(values) if values else 0.0
    return cnt, pct

def beaver_damage(values, kd):
    # Урон за бросок: floor(v / kd), если v < kd -> 0
    if kd is None or kd <= 0:
        return None, None
    total_damage = 0
    for v in values:
        dmg = int(v // kd) if v >= kd else 0
        total_damage += dmg
    avg_damage = total_damage / len(values) if values else 0.0
    return total_damage, avg_damage

# ----- Основной сценарий -----
if __name__ == "__main__":
    print("Поддерживается: d20, 3d6, d8*2 + 1, d12^2, (d6+1)*3 и т.п.")
    expr = input("Введите выражение: ").strip()
    try:
        factor = int(input("Фактор преимущества (может быть отрицательным, напр. -1): ").strip())
        set_advantage(factor)
        times = int(input("Сколько раз выполнить и суммировать?: ").strip())
        kd_text = input('КД (порог успешной проверки, можно оставить пустым): ').strip()
        kd = float(kd_text) if kd_text else None
        if kd is not None and kd <= 0:
            raise ValueError("КД должно быть > 0")

        if times <= 0:
            raise ValueError("Число повторов должно быть положительным")

        total, avg, values = eval_many(expr, times)

        # Базовая статистика
        var = sample_variance(values)
        std = sqrt(var)
        vmin, vmax = (min(values), max(values)) if values else (float("nan"), float("nan"))
        p10 = percentile(values, 0.10)
        p50 = percentile(values, 0.50)
        p90 = percentile(values, 0.90)
        R_pct = 100.0 * reliability_index(values)  # 0..100%

        # КД: доля успехов и урон по системе Бобра
        succ_cnt, succ_pct = success_rate(values, kd)
        if kd is not None:
            total_dmg, avg_dmg = beaver_damage(values, kd)

        # Округления для вывода
        var_print = int(round(var))                       # до целого
        std_print = f"{std:.2f}"                          # до сотых
        p_succ_print = f"{succ_pct:.1f}%" if succ_pct is not None else None  # до десятых
        avg_dmg_print = f"{avg_dmg:.2f}" if kd is not None else None         # до сотых

        # --- ВЫВОД ---
        # Абзац 1
        print("\n=== Сводка ===")
        print(f"Выражение: {expr}")
        print(f"Фактор: {factor} ({factor_desc(factor)})")
        print(f"Повторов: {times}")
        print(f"Общая сумма: {total}")
        print(f"Среднее значение: {avg}")

        # Абзац 2
        print("\n=== Статистика разброса ===")
        print(f"Дисперсия: {var_print}")
        print(f"Стандартное отклонение: {std_print}")
        print(f"Минимум/Максимум: {vmin} … {vmax}")
        print(f"P10 / P50 / P90: {p10} / {p50} / {p90}")
        print(f"Индекс надёжности: {R_pct:.2f}% (0% — рассеяно, 100% — стабильно)")

        # Абзац 3
        if kd is not None:
            print("\n=== Проверка по КД и урон (система Бобра) ===")
            print(f"КД: {kd}")
            print(f"Процент пройденных проверок: {p_succ_print}  ({succ_cnt}/{times})")
            print(f"Суммарный урон (система Бобра): {total_dmg}")
            print(f"Средний урон (система Бобра): {avg_dmg_print}  (суммарный урон / число бросков)")
        else:
            print("\n=== Проверка по КД и урон (система Бобра) ===")
            print("КД не задан — показатели успеха и урона не рассчитывались.")

    except Exception as e:
        print("Ошибка:", e)
