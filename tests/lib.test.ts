import { describe, expect, it } from 'vitest'
import { addDays, diffDays, humanDate, isValidKey, monthGrid, plural, relativeLabel, weekdayMon } from '../src/lib/dates'
import { contrast, inkOn, rampColors, sampleRamp } from '../src/lib/color'
import { defaultData, levelAtScore, makeLevels, recolor, removeLevel, scoreOf, type Data } from '../src/lib/model'
import { exportCsv, load, merge, sanitize, save, type Store } from '../src/lib/storage'
import {
  average, currentStreak, distribution, extremeMonths, isGood, longestRun, monthlyAverages,
  tagInsights, weekdayAverages, yearRange, entriesIn, elapsedDays
} from '../src/lib/stats'

const withEntries = (pairs: [string, number, string[]?][]): Data => {
  const d = defaultData(0)
  for (const [k, i, tags] of pairs) d.entries[k] = { level: d.levels[i].id, at: 1, ...(tags ? { tags } : {}) }
  return d
}

describe('даты', () => {
  it('проверяет ключи', () => {
    expect(isValidKey('2026-02-28')).toBe(true)
    expect(isValidKey('2026-02-29')).toBe(false)
    expect(isValidKey('2028-02-29')).toBe(true)
    expect(isValidKey('2026-13-01')).toBe(false)
    expect(isValidKey('abc')).toBe(false)
  })
  it('сдвигает дни через границы месяцев и года', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364)
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // переход на летнее время в Европе
  })
  it('понедельник — 0', () => {
    expect(weekdayMon('2026-11-02')).toBe(0)
    expect(weekdayMon('2026-11-08')).toBe(6)
  })
  it('сетка месяца с понедельника и воскресенья', () => {
    const g = monthGrid(2026, 10, 0) // ноябрь 2026 начинается в воскресенье
    expect(g[0].filter(Boolean)).toEqual(['2026-11-01'])
    expect(g[0][6]).toBe('2026-11-01')
    const s = monthGrid(2026, 10, 6)
    expect(s[0][0]).toBe('2026-11-01')
    expect(g.flat().filter(Boolean)).toHaveLength(30)
  })
  it('пишет по-русски', () => {
    expect(humanDate('2026-11-04', '2026-11-05')).toBe('4 ноября')
    expect(humanDate('2025-11-04', '2026-11-05')).toBe('4 ноября 2025')
    expect(relativeLabel('2026-11-04', '2026-11-05')).toBe('вчера')
    expect(plural(1, 'день', 'дня', 'дней')).toBe('день')
    expect(plural(3, 'день', 'дня', 'дней')).toBe('дня')
    expect(plural(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(plural(21, 'день', 'дня', 'дней')).toBe('день')
  })
})

describe('цвет', () => {
  it('крайние точки шкалы совпадают с опорными цветами', () => {
    expect(sampleRamp(['#FF0000', '#0000FF'], 0)).toBe('#FF0000')
    expect(sampleRamp(['#FF0000', '#0000FF'], 1)).toBe('#0000FF')
    expect(rampColors(['#000000', '#FFFFFF'], 5)).toHaveLength(5)
  })
  it('подбирает читаемый текст', () => {
    expect(inkOn('#FFC53D')).toBe('#17150F')
    expect(inkOn('#1C2541')).toBe('#FFFFFF')
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })
})

describe('модель', () => {
  it('стандартная шкала — 7 цветов от алого к солнечному, синий — «плохо», салатовый — «хорошо»', () => {
    const l = makeLevels(7)
    expect(l.map(x => x.name)).toEqual(['Ужасно', 'Очень плохо', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'])
    expect(l[0].color).toBe('#E3263A')
    expect(l[2].color).toBe('#3559D6')
    expect(l[5].color).toBe('#8FD14F')
  })
  it('шкала на 2 и 10 уровней', () => {
    expect(makeLevels(2)).toHaveLength(2)
    expect(makeLevels(10).map(l => l.name)).toContain('Лучший день')
  })
  it('перекраска сохраняет id', () => {
    const l = makeLevels(5)
    const r = recolor(l, 'sea')
    expect(r.map(x => x.id)).toEqual(l.map(x => x.id))
    expect(r[0].color).not.toBe(l[0].color)
  })
  it('удаление уровня переносит отметки к соседу', () => {
    const d = withEntries([['2026-01-01', 0], ['2026-01-02', 3]])
    const r = removeLevel(d, d.levels[3].id)
    expect(r.levels).toHaveLength(6)
    expect(r.entries['2026-01-02'].level).toBe(d.levels[2].id)
    const r0 = removeLevel(d, d.levels[0].id)
    expect(r0.entries['2026-01-01'].level).toBe(d.levels[1].id)
  })
  it('оценка 0..1 и обратно', () => {
    const d = defaultData()
    expect(scoreOf(d, d.levels[0].id)).toBe(0)
    expect(scoreOf(d, d.levels[6].id)).toBe(1)
    expect(levelAtScore(d, 0.5).name).toBe('Так себе')
  })
})

describe('хранение', () => {
  const mem = (): Store & { m: Map<string, string> } => {
    const m = new Map<string, string>()
    return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
  }
  it('сохраняет и загружает', () => {
    const s = mem()
    const d = withEntries([['2026-11-04', 5]])
    d.entries['2026-11-04'].note = 'Хороший день'
    save(d, s)
    const r = load(s)
    expect(r.data.entries['2026-11-04'].note).toBe('Хороший день')
    expect(r.recovered).toBe(false)
  })
  it('поднимает запасную копию, если основная испорчена', () => {
    const s = mem()
    save(withEntries([['2026-11-01', 1]]), s)
    save(withEntries([['2026-11-02', 2]]), s)
    s.m.set('ottenki:data:v1', '{broken')
    const r = load(s)
    expect(r.recovered).toBe(true)
    expect(r.data.entries['2026-11-01']).toBeTruthy()
  })
  it('без хранилища — данные по умолчанию', () => {
    expect(load(null).available).toBe(false)
  })
  it('отбрасывает мусор из файла', () => {
    const d = withEntries([['2026-11-04', 5, ['t1', 'zzz']]]) as any
    d.entries['2026-02-30'] = { level: d.levels[0].id, at: 1 }
    d.entries['2026-11-05'] = { level: 'unknown', at: 1 }
    d.levels.push({ id: 'bad', name: 'x', color: 'red' })
    const r = sanitize(JSON.parse(JSON.stringify(d)))
    expect(Object.keys(r.entries)).toEqual(['2026-11-04'])
    expect(r.entries['2026-11-04'].tags).toEqual(['t1'])
    expect(r.levels).toHaveLength(7)
    expect(() => sanitize({ hello: 1 })).toThrow()
    expect(() => sanitize(null)).toThrow()
  })
  it('слияние берёт более свежую запись', () => {
    const a = withEntries([['2026-11-01', 1], ['2026-11-02', 1]])
    const b = withEntries([['2026-11-02', 6], ['2026-11-03', 6]])
    b.entries['2026-11-02'].at = 5
    const m = merge(a, b)
    expect(Object.keys(m.entries).sort()).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(m.entries['2026-11-02'].level).toBe(b.levels[6].id)
  })
  it('CSV с кавычками', () => {
    const d = withEntries([['2026-11-04', 5]])
    d.entries['2026-11-04'].note = 'да, "очень"'
    const csv = exportCsv(d)
    expect(csv).toContain('"да, ""очень"""')
    expect(csv.split('\n')).toHaveLength(2)
  })
})

describe('статистика', () => {
  const d = withEntries([
    ['2026-01-01', 6, ['t1']], ['2026-01-02', 5, ['t1']], ['2026-01-03', 0],
    ['2026-01-04', 6], ['2026-01-05', 6], ['2026-01-06', 6],
    ['2026-02-01', 0], ['2026-02-02', 1], ['2026-02-03', 0], ['2026-02-04', 0], ['2026-02-05', 1]
  ])
  const all = entriesIn(d, yearRange(2026))
  it('среднее и распределение', () => {
    expect(average(d, [])).toBeNull()
    const dist = distribution(d, all)
    expect(dist.reduce((s, x) => s + x.count, 0)).toBe(11)
    expect(dist[0].count).toBe(4)
  })
  it('серии', () => {
    expect(longestRun(d, e => isGood(d, e)).length).toBe(3)
    expect(longestRun(d, () => true).length).toBe(6)
    expect(currentStreak(d, '2026-02-06')).toBe(5)
    expect(currentStreak(d, '2026-02-05')).toBe(5)
    expect(currentStreak(d, '2026-02-08')).toBe(0)
  })
  it('месяцы и дни недели', () => {
    const m = monthlyAverages(d, 2026)
    expect(m[0].count).toBe(6)
    expect(m[2].avg).toBeNull()
    const ex = extremeMonths(d, 2026)
    expect(ex).toEqual({ best: 0, worst: 1 })
    expect(weekdayAverages(d, all).reduce((s, x) => s + x.count, 0)).toBe(11)
  })
  it('метки', () => {
    const t = tagInsights(d, all)
    expect(t[0].id).toBe('t1')
    expect(t[0].delta!).toBeGreaterThan(0)
  })
  it('прошедшие дни', () => {
    expect(elapsedDays(yearRange(2026), '2026-01-10')).toBe(10)
    expect(elapsedDays(yearRange(2026), '2025-12-10')).toBe(0)
    expect(elapsedDays(yearRange(2025), '2026-01-10')).toBe(365)
  })
})
