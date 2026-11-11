// Логика изменений данных в state.ts: отметки и их отмена, заметки, метки, шкала, копии.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultData, makeLevels, type Data } from '../src/lib/model'
import {
  addLevel, addTag, applyPalette, clearDay, data, deleteLevel, deleteTag, mark, mergeIn, moveLevel,
  renameLevel, renameTag, replaceAll, resetScale, setLevelColor, setNote, toggleTag
} from '../src/state'

const D = '2026-11-04'
const lv = (i: number) => data.value.levels[i].id
const entry = (day = D) => data.value.entries[day]

beforeEach(() => {
  data.value = defaultData()
})

describe('отметка дня и её отмена', () => {
  it('ставит цвет и время правки', () => {
    mark(D, lv(5))
    expect(entry().level).toBe(lv(5))
    expect(entry().at).toBeGreaterThan(0)
  })

  it('отмена новой отметки удаляет запись', () => {
    const undo = mark(D, lv(5))
    undo()
    expect(entry()).toBeUndefined()
  })

  it('отмена смены цвета возвращает прежний цвет', () => {
    mark(D, lv(2))
    const undo = mark(D, lv(6))
    undo()
    expect(entry().level).toBe(lv(2))
  })

  it('отмена возвращает только цвет — заметка и метки, добавленные после, остаются', () => {
    mark(D, lv(2))
    const undo = mark(D, lv(6))
    setNote(D, 'дописал после')
    toggleTag(D, 't1')
    undo()
    expect(entry().level).toBe(lv(2))
    expect(entry().note).toBe('дописал после')
    expect(entry().tags).toEqual(['t1'])
  })

  it('отмена новой отметки не стирает день, если к нему уже добавили заметку', () => {
    const undo = mark(D, lv(4))
    setNote(D, 'важное')
    undo()
    expect(entry().note).toBe('важное')
    expect(entry().level).toBe(lv(4))
  })

  it('отмена ничего не делает, если цвет уже сменили на другой', () => {
    const undo = mark(D, lv(1))
    mark(D, lv(3))
    undo()
    expect(entry().level).toBe(lv(3))
  })

  it('отметка сохраняет заметку и метки дня', () => {
    mark(D, lv(1))
    setNote(D, 'текст')
    toggleTag(D, 't2')
    mark(D, lv(5))
    expect(entry()).toMatchObject({ level: lv(5), note: 'текст', tags: ['t2'] })
  })
})

describe('стирание дня', () => {
  it('стирает и возвращает весь день', () => {
    mark(D, lv(3))
    setNote(D, 'заметка')
    toggleTag(D, 't1')
    const before = entry()
    const undo = clearDay(D)
    expect(entry()).toBeUndefined()
    undo()
    expect(entry()).toEqual(before)
  })

  it('для пустого дня — ничего не делает', () => {
    const undo = clearDay(D)
    undo()
    expect(entry()).toBeUndefined()
  })
})

describe('заметка', () => {
  it('без отметки заметку не создать', () => {
    setNote(D, 'текст')
    expect(entry()).toBeUndefined()
  })

  it('пустая заметка удаляет поле', () => {
    mark(D, lv(3))
    setNote(D, 'текст')
    setNote(D, '   ')
    expect(entry()).not.toHaveProperty('note')
  })

  it('тот же текст не меняет время правки', () => {
    mark(D, lv(3))
    setNote(D, 'текст')
    const at = entry().at
    const spy = vi.spyOn(Date, 'now').mockReturnValue(at + 60_000)
    setNote(D, 'текст')
    expect(entry().at).toBe(at)
    setNote(D, 'другой текст')
    expect(entry().at).toBe(at + 60_000)
    spy.mockRestore()
  })

  it('обрезается до 2000 знаков', () => {
    mark(D, lv(3))
    setNote(D, 'а'.repeat(2500))
    expect(entry().note).toHaveLength(2000)
  })
})

describe('метки дня', () => {
  it('включается и выключается; последняя снятая убирает поле', () => {
    mark(D, lv(3))
    toggleTag(D, 't1')
    toggleTag(D, 't2')
    expect(entry().tags).toEqual(['t1', 't2'])
    toggleTag(D, 't1')
    toggleTag(D, 't2')
    expect(entry()).not.toHaveProperty('tags')
  })
})

describe('шкала', () => {
  it('новый уровень встаёт сверху, цвета перераспределяются по палитре', () => {
    mark(D, lv(6))
    const top = lv(6)
    addLevel()
    const levels = data.value.levels
    expect(levels).toHaveLength(8)
    expect(levels[6].id).toBe(top) // старые уровни и отметки на месте
    expect(entry().level).toBe(top)
    expect(levels[0].color).toBe('#E3263A') // края палитры сохраняются
    expect(levels[7].color).toBe('#FFC53D')
  })

  it('новый уровень не дублирует занятое название', () => {
    addLevel()
    const names = data.value.levels.map(l => l.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names[names.length - 1]).toBe('Лучший день')
  })

  it('с 9 до 10 уровней — «Лучший день» сверху', () => {
    data.value = { ...defaultData(), levels: makeLevels(9) }
    addLevel()
    expect(data.value.levels.at(-1)!.name).toBe('Новый уровень')
    expect(data.value.levels).toHaveLength(10)
  })

  it('больше 10 уровней не добавить', () => {
    data.value = { ...defaultData(), levels: makeLevels(10) }
    addLevel()
    expect(data.value.levels).toHaveLength(10)
  })

  it('при своей палитре цвета остальных уровней не меняются', () => {
    setLevelColor(lv(0), '#123456')
    const before = data.value.levels.map(l => l.color)
    addLevel()
    expect(data.value.levels.slice(0, 7).map(l => l.color)).toEqual(before)
  })

  it('удаление уровня переносит отметки к соседу', () => {
    mark(D, lv(3))
    const target = lv(2)
    deleteLevel(lv(3))
    expect(entry().level).toBe(target)
    expect(data.value.levels).toHaveLength(6)
  })

  it('меньше двух уровней не оставить', () => {
    data.value = { ...defaultData(), levels: makeLevels(2) }
    deleteLevel(lv(0))
    expect(data.value.levels).toHaveLength(2)
  })

  it('перестановка не трогает отметки', () => {
    mark(D, lv(3))
    const id = lv(3)
    moveLevel(id, 1)
    expect(data.value.levels[4].id).toBe(id)
    expect(entry().level).toBe(id)
    moveLevel(lv(6), 1) // за край — ничего
    expect(data.value.levels).toHaveLength(7)
  })

  it('переименование обрезает до 40 знаков', () => {
    renameLevel(lv(0), 'х'.repeat(60))
    expect(data.value.levels[0].name).toHaveLength(40)
  })

  it('свой цвет делает палитру «своей», выбор палитры — перекрашивает, не трогая id', () => {
    setLevelColor(lv(1), '#abcdef')
    expect(data.value.palette).toBe('custom')
    expect(data.value.levels[1].color).toBe('#ABCDEF')
    const ids = data.value.levels.map(l => l.id)
    applyPalette('sea')
    expect(data.value.palette).toBe('sea')
    expect(data.value.levels.map(l => l.id)).toEqual(ids)
  })
})

describe('смена числа цветов', () => {
  it('переносит отметки и отменяется целиком', () => {
    mark('2026-11-01', lv(0))
    mark('2026-11-02', lv(6))
    mark('2026-11-03', lv(3))
    const before = data.value
    const undo = resetScale(5, 'spectrum')
    const d = data.value
    expect(d.levels).toHaveLength(5)
    expect(d.entries['2026-11-01'].level).toBe(d.levels[0].id)
    expect(d.entries['2026-11-02'].level).toBe(d.levels[4].id)
    expect(d.entries['2026-11-03'].level).toBe(d.levels[2].id)
    undo()
    expect(data.value).toBe(before)
  })

  it('своё название остаётся, если на его место приходит один уровень', () => {
    renameLevel(lv(6), 'Космос')
    resetScale(10, 'spectrum')
    expect(data.value.levels[9].name).toBe('Космос')
  })

  it('число уровней ограничено от 2 до 10', () => {
    resetScale(1, 'spectrum')
    expect(data.value.levels).toHaveLength(2)
    resetScale(50, 'spectrum')
    expect(data.value.levels).toHaveLength(10)
  })
})

describe('метки', () => {
  it('пустые и повторяющиеся (без учёта регистра) не добавляются', () => {
    const n = data.value.tags.length
    expect(addTag('  ')).toBe(false)
    expect(addTag('спорт')).toBe(false)
    expect(addTag('Музыка')).toBe(true)
    expect(data.value.tags).toHaveLength(n + 1)
  })

  it('переименование пустым именем игнорируется', () => {
    renameTag('t1', '   ')
    expect(data.value.tags[0].name).toBe('Спорт')
    renameTag('t1', 'Бег')
    expect(data.value.tags[0].name).toBe('Бег')
  })

  it('удаление снимает метку со всех дней, отмена возвращает её на место', () => {
    mark('2026-11-01', lv(3)); toggleTag('2026-11-01', 't1')
    mark('2026-11-02', lv(3)); toggleTag('2026-11-02', 't1'); toggleTag('2026-11-02', 't2')
    const undo = deleteTag('t1')
    expect(data.value.tags.find(t => t.id === 't1')).toBeUndefined()
    expect(data.value.entries['2026-11-01']).not.toHaveProperty('tags')
    expect(data.value.entries['2026-11-02'].tags).toEqual(['t2'])
    undo()
    expect(data.value.tags[0].id).toBe('t1')
    expect(data.value.entries['2026-11-01'].tags).toEqual(['t1'])
    expect(data.value.entries['2026-11-02'].tags).toContain('t1')
  })

  it('отмена удаления не затирает изменения, сделанные после', () => {
    mark('2026-11-01', lv(3)); toggleTag('2026-11-01', 't1')
    const undo = deleteTag('t1')
    setNote('2026-11-01', 'после удаления')
    mark('2026-11-05', lv(6))
    undo()
    expect(data.value.entries['2026-11-01'].note).toBe('после удаления')
    expect(data.value.entries['2026-11-05'].level).toBe(lv(6))
    expect(data.value.entries['2026-11-01'].tags).toEqual(['t1'])
  })

  it('повторная отмена удаления не дублирует метку', () => {
    const undo = deleteTag('t1')
    undo()
    undo()
    expect(data.value.tags.filter(t => t.id === 't1')).toHaveLength(1)
  })
})

describe('загрузка копии', () => {
  const backup = (): Data => {
    const d = defaultData()
    d.entries['2026-10-01'] = { level: d.levels[6].id, at: 5, note: 'из копии' }
    return d
  }

  it('«заменить всё» берёт копию и не показывает знакомство', () => {
    mark(D, lv(1))
    replaceAll({ ...backup(), onboarded: false })
    expect(entry()).toBeUndefined()
    expect(data.value.entries['2026-10-01'].note).toBe('из копии')
    expect(data.value.onboarded).toBe(true)
  })

  it('«объединить» оставляет и свои дни, и дни из копии', () => {
    mark(D, lv(1))
    mergeIn(backup())
    expect(entry().level).toBe(lv(1))
    expect(data.value.entries['2026-10-01'].note).toBe('из копии')
  })
})
