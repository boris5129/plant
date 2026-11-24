import data from './original-data.js'
import { plants, types, originalGroup, seasonalCare, careFor, recommendationFor } from './catalog.js'
import { readPlantWorkbook } from './workbook.js'
import { readPhoto, savePhoto, deletePhoto } from './photos.js'
import { growthPhotoId, metric, showDashboardTrend, showGrowth } from './growth.js'
import { basicCare, carePlans, datesFor as routineDates, nextCareDate, setCompletion } from './care.js'

const $ = (selector) => document.querySelector(selector)
const key = 'plant-fit.plants.v1'
const workbookKey = 'plant-fit.workbook.v1'
const editor = $('#editor')
const form = $('#plant-form')
const picker = $('#plant-picker')
const dashboard = $('#owned-detail')
$('main').insertBefore(dashboard, $('#message'))
const careFields = ['wateringRule', 'seasonalRule', 'recommendedPlace']
let editingId = null
let returnToCare = false
let customDraft = []
let archivedDraft = []
let catalogPage = 1
let ownedPage = 1
const pageSize = 8
const seoulDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
let today = seoulDate.format(new Date())
let detailPlantId = null
let selectedDate = today
let calendarMonth = today.slice(0, 7)
let saved = []
let uploaded = []
try {
  const stored = JSON.parse(localStorage.getItem(key) ?? '[]')
  if (!Array.isArray(stored)) throw new Error('Invalid saved plants')
  saved = stored
} catch {
  $('#message').textContent = '저장된 식물 목록을 읽을 수 없습니다.'
}
try {
  uploaded = JSON.parse(localStorage.getItem(workbookKey) ?? '[]')
  if (!Array.isArray(uploaded)) uploaded = []
} catch {
  $('#import-status').textContent = '저장된 엑셀 목록을 읽을 수 없습니다.'
}

const originals = data.plants.map(([id, name, scientific, ...conditions]) => ({
  id, name, scientific, conditions, group: originalGroup(id)
}))
const category = $('#category')
category.add(new Option('모든 종류', ''))
for (const type of types) category.add(new Option(type, type))
const headings = data.headers.slice(3)
const conditionFields = headings.map((heading, index) => {
  const isSeason = index < 4
  const isPlace = index >= 9
  const special = isSeason || isPlace
  const label = document.createElement('label')
  const select = document.createElement('select')
  select.name = `condition-${index}`
  label.append(special ? heading : data.groups[index + 3], select)
  const choices = isSeason ? ['1: 해당함', '2: 해당하지 않음']
    : isPlace ? ['1: 적절함', '2: 적절하지 않음'] : heading.split('\n')
  select.add(new Option('미입력', ''))
  for (const choice of choices) select.add(new Option(choice, choice.split(':')[0]))
  $('#conditions').append(label)
  return select
})

const places = new Map(data.places.map(([code, name]) => [code, name]))
const locationInput = $('#actual-place')
locationInput.add(new Option('미지정', ''))
for (const [code, name] of places) locationInput.add(new Option(name, code))

function row(title, info, actionText, action) {
  const item = document.createElement('li')
  item.className = 'row'
  const text = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = title
  const details = document.createElement('span')
  details.className = 'meta'
  details.textContent = info
  text.append(name, details)
  const actions = document.createElement('div')
  actions.className = 'actions'
  actions.append(button(actionText, action, title))
  item.append(text, actions)
  return { item, text, actions }
}

function button(text, action, title) {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'secondary'
  element.textContent = text
  element.setAttribute('aria-label', `${title} ${text}`)
  element.addEventListener('click', action)
  return element
}

function searchable(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '')
}

function visiblePage(entries, page, pager, onChange) {
  const total = Math.max(1, Math.ceil(entries.length / pageSize))
  const current = Math.min(page, total)
  const status = document.createElement('span')
  status.textContent = `${current} / ${total}`
  status.setAttribute('role', 'status')
  const previous = button('이전', () => onChange(current - 1), '페이지')
  const next = button('다음', () => onChange(current + 1), '페이지')
  previous.disabled = current === 1
  next.disabled = current === total
  pager.replaceChildren(...(total > 1 ? [previous, status, next] : []))
  return entries.slice((current - 1) * pageSize, current * pageSize)
}

function openDetail(plant) {
  const guide = careFor(plant)
  $('#detail-title').textContent = plant.name
  $('#detail-meta').textContent = plant.group ?? ''
  $('#care-heading').textContent = guide.title
  const items = { ...guide.items }
  const season = $('#season').value
  if (season) items[`${season} 실내 관리 참고`] = seasonalCare[season]
  $('#care-guide').replaceChildren(...Object.entries(items).flatMap(([label, value]) => {
    const term = document.createElement('dt')
    const description = document.createElement('dd')
    term.textContent = label
    description.textContent = value
    return [term, description]
  }))
  $('#care-source').textContent = `자료 · ${guide.source}${season ? ' · RHS 실내식물 계절 관리' : ''}`
  const detail = $('#plant-detail')
  $('#add-detail').onclick = () => {
    detail.close()
    openEditor(plant)
  }
  detail.showModal()
}

function renderCatalog() {
  const search = searchable($('#search').value)
  const entries = $('#source').value === 'catalog' ? plants : originals
  const matches = entries.filter((plant) => (!category.value || plant.group === category.value) &&
    [plant.name, plant.scientific, plant.aliases].some((value) => searchable(value).includes(search)))
  const season = $('#season').value
  $('#season-note').hidden = !season
  $('#season-note').textContent = season ? `${season} 관리 · ${seasonalCare[season]}` : ''
  $('#count').textContent = matches.length ? `${matches.length}개` : '검색 결과가 없습니다.'
  const view = visiblePage(matches, catalogPage, $('#catalog-pages'), (page) => {
    catalogPage = page
    renderCatalog()
    $('#count').scrollIntoView({ block: 'nearest' })
  })
  $('#catalog-list').replaceChildren(...view.map((plant) => {
    const info = plant.group ?? ''
    const { item, text } = row(plant.name, info, '관리 방법', () => openDetail(plant))
    const title = button(plant.name, () => openDetail(plant), '')
    title.className = 'plant-link'
    title.setAttribute('aria-label', `${plant.name} 상세`)
    text.firstElementChild.replaceWith(title)
    return item
  }))
}

function dueRoutines(plant) {
  return carePlans(plant).map((plan) => ({ ...plan, date: nextCareDate(plant, plan) }))
    .filter(({ date }) => date)
}

function remaining(date) {
  if (!date) return '간격 미설정'
  const days = (Date.parse(date) - Date.parse(today)) / 86_400_000
  return days === 0 ? `오늘 예정 · ${date}` : days > 0 ? `${days}일 남음 · ${date}` : `${-days}일 지남 · ${date}`
}

const tabs = [...$('#plant-tabs').querySelectorAll('[role=tab]')]
function selectTab(tab, focus = false) {
  for (const button of tabs) {
    const selected = button.dataset.tab === tab
    button.setAttribute('aria-selected', String(selected))
    button.tabIndex = selected ? 0 : -1
    document.getElementById(button.getAttribute('aria-controls')).hidden = !selected
    if (selected && focus) button.focus()
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab))
  tab.addEventListener('keydown', (event) => {
    const target = { ArrowLeft: (index + 3) % 4, ArrowRight: (index + 1) % 4, Home: 0, End: 3 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    selectTab(tabs[target].dataset.tab, true)
  })
})

function findRecommendation(plant) {
  if (plant.scientific?.trim()) return recommendationFor(plant)
  const name = searchable(plant.name)
  const match = [...plants, ...originals].find((entry) => searchable(entry.name) === name)
  return match ? recommendationFor(match) : null
}

function wateringAge(date) {
  if (!date) return '기록 없음'
  const elapsed = (Date.parse(today) - Date.parse(date)) / 86_400_000
  return `${elapsed === 0 ? '오늘' : `${elapsed}일 전`} · ${date}`
}

function waterDates(plant) {
  return routineDates(plant, 'water')
}

function setWatering(plant, recorded) {
  return setCompletion(plant, 'water', today, recorded)
}

function confirmWatering(plant) {
  const dialog = $('#confirm-water')
  dialog.returnValue = ''
  $('#confirm-water-message').textContent = `‘${plant.nickname || plant.name}’에 오늘 물을 준 것으로 기록할까요?`
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true })
    dialog.showModal()
  })
}

const checklists = [
  ['일일', 'day', [
    ['soil', '흙 상태 확인'], ['water', '물주기 완료']
  ]],
  ['주간', 'week', [
    ['drainage', '받침의 고인 물과 배수구 확인'], ['ventilation', '빛과 통풍 상태 확인']
  ]]
]

function checklistPeriods() {
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  return { day: today, week: monday.toISOString().slice(0, 10), month: today.slice(0, 7) }
}

function renderChecklist(plant) {
  const periods = checklistPeriods()
  $('#care-checklist').replaceChildren(...checklists.map(([title, period, items]) => {
    const group = document.createElement('fieldset')
    const legend = document.createElement('legend')
    legend.textContent = `${title} · ${periods[period]}${period === 'week' ? ' 시작' : ''}`
    group.append(legend)
    for (const [id, labelText] of items) {
      if (id === 'water' && !carePlans(plant)[0].enabled) continue
      const label = document.createElement('label')
      label.className = 'care-checkbox'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.id = `task-${id}`
      const taskKey = `${periods[period]}:${id}`
      input.checked = id === 'water' ? waterDates(plant).includes(today) : Boolean(plant.checkedTasks?.[taskKey])
      input.addEventListener('change', async () => {
        if (id === 'water' && input.checked) {
          input.checked = false
          if (!await confirmWatering(plant)) return
          input.checked = true
        }
        const tasks = { ...plant.checkedTasks }
        if (input.checked) tasks[taskKey] = today
        else delete tasks[taskKey]
        const updated = id === 'water' ? setWatering(plant, input.checked) : { ...plant, checkedTasks: tasks }
        try {
          updateOwnedDetail(updated, input.checked ? '완료를 기록했습니다.' : '완료 기록을 취소했습니다.')
          document.getElementById(input.id)?.focus()
        } catch {
          input.checked = !input.checked
          $('#watering-status').textContent = '체크리스트를 저장할 수 없습니다.'
        }
      })
      label.append(input, labelText)
      group.append(label)
    }
    return group
  }))
}

let photoPlantId = null
let photoUrl = null
function clearPhotoPreview() {
  if (photoUrl) URL.revokeObjectURL(photoUrl)
  photoUrl = null
  $('#owned-photo').removeAttribute('src')
  $('#owned-photo').hidden = true
  $('#photo-empty').hidden = false
  $('#remove-photo').hidden = true
}

async function showPhoto(id) {
  const photo = await readPhoto(id)
  if (photoPlantId !== id) return
  clearPhotoPreview()
  if (!photo) return
  photoUrl = URL.createObjectURL(photo)
  $('#owned-photo').src = photoUrl
  $('#owned-photo').hidden = false
  $('#photo-empty').hidden = true
  $('#remove-photo').hidden = false
}

function updateOwnedDetail(plant, message) {
  persist(saved.map((entry) => entry.id === plant.id ? plant : entry), message)
  openOwnedDetail(plant)
  $('#watering-status').textContent = message
}

function renderRoutines(plant, plans) {
  const list = $('#routine-actions')
  const expanded = list.dataset.plant === plant.id ? new Set([...list.querySelectorAll('details[open]')].map((entry) => entry.dataset.task)) : new Set()
  list.dataset.plant = plant.id
  const active = plans.filter((plan) => plan.enabled)
  if (!active.length) {
    const empty = document.createElement('li')
    empty.textContent = '사용 중인 관리 항목이 없습니다. 항목·주기 설정에서 선택하세요.'
    list.replaceChildren(empty)
    return
  }
  list.replaceChildren(...active.map((plan) => {
    const dates = routineDates(plant, plan.id)
    const reviews = plant.careReviews?.[plan.id] ?? []
    const date = nextCareDate(plant, plan)
    const due = Boolean(date && date <= today)
    const recorded = dates.includes(today)
    const row = document.createElement('li')
    row.className = 'routine-entry'
    const title = document.createElement('strong')
    title.textContent = plan.title
    const sub = document.createElement('p')
    sub.className = 'meta'
    sub.textContent = `마지막 관리 ${dates.at(-1) ?? '기록 없음'} · ${plan.interval ? `${plan.interval}일마다` : '주기 미설정'}`
    const next = document.createElement('p')
    next.className = due ? 'due-text' : 'meta'
    next.textContent = date ? `${due ? '! ' : ''}${plan.check ? '다음 필요 여부 확인' : '다음 예정'} · ${remaining(date)}` : ''
    const details = document.createElement('details')
    details.dataset.task = plan.id
    details.open = expanded.has(plan.id)
    const summary = document.createElement('summary')
    summary.textContent = plan.check ? '필요 여부 확인·기록' : '관리 기록'
    const history = document.createElement('p')
    history.className = 'meta'
    history.textContent = dates.length ? `최근 완료 · ${dates.slice(-5).reverse().join(', ')}` : '완료 기록 없음'
    details.append(summary, history)
    const actions = document.createElement('div')
    actions.className = 'section-heading'
    const complete = button(recorded ? '오늘 완료 취소' : plan.check ? '실제로 작업함' : '오늘 완료', async () => {
      if (plan.id === 'photo') {
        selectTab('growth')
        $('#growth-form [name=photo]').focus()
        return
      }
      if (plan.id === 'water' && !recorded && !await confirmWatering(plant)) return
      try {
        updateOwnedDetail(setCompletion(plant, plan.id, today, !recorded),
          recorded ? `${plan.title} 완료를 취소했습니다.` : `${plan.title} 완료를 기록했습니다.`)
        $(`#${plan.id}-today`).focus()
      } catch {
        $('#watering-status').textContent = '완료 기록을 저장할 수 없습니다.'
      }
    }, plan.title)
    complete.id = `${plan.id}-today`
    if (plan.id === 'photo') {
      complete.textContent = '성장 사진 올리기'
      complete.setAttribute('aria-label', '성장 사진 올리기')
    }
    actions.append(complete)
    if (plan.check) {
      const tip = document.createElement('p')
      tip.textContent = plan.check
      const reviewed = reviews.includes(today)
      const review = button(reviewed ? '확인 기록 취소' : '확인함 · 이번에는 생략', () => {
        const dates = new Set(reviews)
        if (reviewed) dates.delete(today)
        else dates.add(today)
        try {
          updateOwnedDetail({ ...plant, careReviews: { ...plant.careReviews, [plan.id]: [...dates].sort() } },
            reviewed ? '확인 기록을 취소했습니다.' : '필요 여부 확인을 기록했습니다.')
          $(`#${plan.id}-review`).focus()
        } catch {
          $('#watering-status').textContent = '확인 기록을 저장할 수 없습니다.'
        }
      }, plan.title)
      review.id = `${plan.id}-review`
      actions.prepend(review)
      if (reviews.length) {
        const note = document.createElement('p')
        note.className = 'meta'
        note.textContent = `최근 확인 · ${reviews.at(-1)}`
        details.append(note)
      }
      details.append(tip, actions)
    } else {
      row.append(title, sub, next, actions, details)
      return row
    }
    row.append(title, sub, next, details)
    return row
  }))
}

function renderDashboard(plant, entries) {
  const plans = carePlans(plant)
  const allActivities = [
    ...[...plans, ...(plant.archivedCare ?? [])].flatMap(({ id, title }) => routineDates(plant, id).map((date) => [date, `${title} 완료`])),
    ...Object.entries(plant.checkedTasks ?? {}).flatMap(([key, date]) => {
      const id = key.split(':').at(-1)
      const match = checklists.flatMap(([, , tasks]) => tasks).find(([task]) => task === id)
      return match ? [[date, match[1]]] : []
    }),
    ...entries.map((entry) => [entry.date, '성장 기록 추가'])
  ].sort(([first], [second]) => second.localeCompare(first))
  const recent = allActivities.slice(0, 5)
  $('#dashboard-activity').replaceChildren(...(recent.length ? recent : [['', '아직 기록된 관리 활동이 없습니다.']]).map(([date, label]) => {
    const entry = document.createElement('li')
    entry.className = 'timeline-entry'
    const when = document.createElement('span')
    when.className = 'meta'
    when.textContent = date
    const action = document.createElement('strong')
    action.textContent = label
    entry.append(when, action)
    return entry
  }))
  const next = [
    ...dueRoutines(plant).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
      .map(({ title, date, check }) => [check ? `${title} 필요 여부 확인` : title, remaining(date), date <= today])
  ]
  if (!next.length) next.push(['관리 일정', '항목·주기 설정에서 간격을 지정할 수 있습니다.', false])
  $('#dashboard-next').replaceChildren(...next.map(([label, value, due]) => {
    const item = document.createElement('p')
    const caption = document.createElement('strong')
    caption.textContent = label
    const status = document.createElement('span')
    status.className = due ? 'due-text' : 'meta'
    status.textContent = due ? `! ${value}` : value
    item.append(caption, status)
    return item
  }))
  showDashboardTrend(entries, today.slice(0, 7))
}

function openOwnedDetail(plant) {
  const dialog = $('#owned-detail')
  const opening = !dialog.open
  detailPlantId = plant.id
  const recommend = findRecommendation(plant)
  const plans = carePlans(plant)
  $('#owned-detail-title').textContent = plant.nickname || plant.name
  $('#owned-detail-meta').textContent = [plant.nickname && plant.name, places.get(plant.actualPlace)].filter(Boolean).join(' · ')
  const items = {
    '최근 물주기': wateringAge(plant.lastWateredDate),
    '식물 등록일': plant.registeredDate || '미입력',
    '사용 중인 관리 항목': plans.filter(({ enabled }) => enabled).map(({ title }) => title).join(' · ') || '없음',
    '실제 재배 위치': places.get(plant.actualPlace) ?? '미지정',
    '물주기 기준': (plant.wateringRule ?? recommend?.wateringRule) || '미입력',
    '계절별 관리': (plant.seasonalRule ?? recommend?.seasonalRule) || '미입력',
    '추천 장소': (plant.recommendedPlace ?? recommend?.recommendedPlace) || '미입력'
  }
  const entries = [...(plant.growthEntries ?? [])].sort((first, second) => first.date.localeCompare(second.date))
  const latestHeight = entries.findLast((entry) => entry.height != null)
  const latestFruit = entries.findLast((entry) => entry.fruit != null)
  $('#plant-snapshot').replaceChildren(
    metric('최근 물주기', items['최근 물주기']),
    metric('다음 물주기', plans[0].enabled ? remaining(nextCareDate(plant, plans[0])) : '사용 안 함'),
    metric('최근 높이', latestHeight ? `${latestHeight.height}cm · ${latestHeight.date}` : '측정 없음'),
    metric('최근 열매 수', latestFruit ? `${latestFruit.fruit}개 · ${latestFruit.date}` : '기록 없음'),
    metric('오늘 상태 메모', plant.conditionNotes?.[today] || '기록 없음')
  )
  renderDashboard(plant, entries)
  conditionFields.forEach((field, index) => {
    const value = String(plant.conditions?.[index] ?? '')
    if (value) items[field.parentElement.firstChild.textContent] = [...field.options].find((option) => option.value === value)?.textContent ?? value
  })
  $('#owned-care-guide').replaceChildren(...Object.entries(items).flatMap(([label, value]) => {
    const term = document.createElement('dt')
    const content = document.createElement('dd')
    term.textContent = label
    content.textContent = value
    return [term, content]
  }))
  $('#owned-care-source').textContent = recommend ? `기본 추천 자료 · ${recommend.source}` : '확인된 종별 추천값이 없습니다. 관리 내용을 직접 입력할 수 있습니다.'
  $('#watering-status').textContent = ''
  renderRoutines(plant, plans)
  $('#edit-care-plans').onclick = () => {
    openEditor(plant, true, true)
  }
  renderChecklist(plant)
  $('#condition-note').value = plant.conditionNotes?.[today] ?? ''
  $('#save-condition-note').onclick = () => {
    const notes = { ...plant.conditionNotes }
    const note = $('#condition-note').value.trim()
    if (note) notes[today] = note
    else delete notes[today]
    try {
      updateOwnedDetail({ ...plant, conditionNotes: notes }, '상태 메모를 저장했습니다.')
    } catch {
      $('#watering-status').textContent = '상태 메모를 저장할 수 없습니다.'
    }
  }
  showGrowth(plant, today, (updated, message) => {
    const current = saved.find((entry) => entry.id === updated.id)
    if (!current) throw new Error('삭제된 화분에는 성장 기록을 저장할 수 없습니다.')
    const merged = { ...current, growthEntries: updated.growthEntries }
    if (dialog.open && detailPlantId === merged.id) updateOwnedDetail(merged, message)
    else persist(saved.map((entry) => entry.id === merged.id ? merged : entry), message)
  }, opening)
  $('#edit-owned-detail').onclick = () => {
    openEditor(plant, true)
  }
  if (opening) {
    selectTab('status')
    photoPlantId = plant.id
    clearPhotoPreview()
    $('#owned-photo').alt = `${plant.nickname || plant.name} 사진`
    $('#photo-status').textContent = ''
    $('#photo-file').value = ''
    dialog.show()
    $('#collection').hidden = true
    $('main > header').hidden = true
    $('#owned-detail-title').focus({ preventScroll: true })
    window.scrollTo(0, 0)
    showPhoto(plant.id).catch(() => {
      if (photoPlantId === plant.id) $('#photo-status').textContent = '사진을 불러올 수 없습니다.'
    })
  }
}

function renderCalendar() {
  const [year, month] = calendarMonth.split('-').map(Number)
  $('#calendar-month').textContent = `${year}년 ${month}월`
  $('#care-day').textContent = `${selectedDate} 관리 기록`
  const completed = new Map()
  const upcoming = new Map()
  for (const plant of saved) {
    const plans = [...carePlans(plant), ...(plant.archivedCare ?? [])]
    for (const date of new Set([...(plant.managedDates ?? []), ...plans.flatMap(({ id }) => routineDates(plant, id))])) {
      completed.set(date, (completed.get(date) ?? 0) + 1)
    }
    for (const { date } of dueRoutines(plant)) upcoming.set(date, (upcoming.get(date) ?? 0) + 1)
  }
  const due = saved.filter((plant) => dueRoutines(plant).some(({ date }) => date <= today)).length
  $('#care-summary').textContent = `선택한 날 관리 완료 ${completed.get(selectedDate) ?? 0}개 · 오늘 기준 관리 필요 ${due}개`
  const cells = []
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  for (let index = 0; index < firstDay; index++) cells.push(document.createElement('span'))
  for (let day = 1; day <= days; day++) {
    const date = `${calendarMonth}-${String(day).padStart(2, '0')}`
    const done = completed.get(date) ?? 0
    const planned = upcoming.get(date) ?? 0
    const due = date <= today && planned > 0
    const cell = button(String(day), () => {
      selectedDate = date
      renderCalendar()
      renderSaved()
      $('#calendar-days [aria-pressed="true"]').focus()
    }, '')
    cell.classList.add('calendar-day')
    cell.setAttribute('aria-label', `${date}${done ? `, 관리 완료 화분 ${done}개` : ''}${planned ? `, ${due ? '관리 필요' : '관리 예정'} ${planned}건` : ''}`)
    cell.setAttribute('aria-pressed', String(date === selectedDate))
    if (date === today) cell.setAttribute('aria-current', 'date')
    const marks = document.createElement('span')
    marks.className = 'calendar-marks'
    marks.setAttribute('aria-hidden', 'true')
    if (done) marks.append(`✓${done}`)
    if (planned) {
      const indicator = document.createElement('span')
      indicator.className = due ? 'due-text' : 'meta'
      indicator.textContent = due ? `!${planned}` : `·${planned}`
      marks.append(indicator)
    }
    cell.append(marks)
    cells.push(cell)
  }
  $('#calendar-days').replaceChildren(...cells)
}

function changeMonth(offset) {
  const [year, month] = calendarMonth.split('-').map(Number)
  calendarMonth = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7)
  selectedDate = today.startsWith(calendarMonth) ? today : `${calendarMonth}-01`
  renderCalendar()
  renderSaved()
}

function renderSaved() {
  $('#quick-plants').replaceChildren(...saved.slice(-5).reverse().map((plant) => {
    const name = plant.nickname || plant.name
    return button(name, () => goToPlant(plant.id), '빠른 열기')
  }))
  ownedPage = Math.min(ownedPage, Math.max(1, Math.ceil(saved.length / pageSize)))
  const view = visiblePage(saved, ownedPage, $('#owned-pages'), (page) => {
    ownedPage = page
    renderSaved()
  })
  if (!saved.length) {
    const empty = document.createElement('li')
    empty.textContent = '아직 등록한 식물이 없습니다.'
    $('#owned').replaceChildren(empty)
    return
  }
  $('#owned').replaceChildren(...view.map((plant) => {
    const title = plant.nickname || plant.name
    const description = [plant.nickname && plant.name, places.get(plant.actualPlace)]
      .filter(Boolean).join(' · ')
    const { item, text, actions } = row(title, description, '수정', () => openEditor(plant, true))
    const titleButton = button(title, () => goToPlant(plant.id), '')
    titleButton.className = 'plant-link'
    titleButton.setAttribute('aria-label', `${title} 관리 상세`)
    text.firstElementChild.replaceWith(titleButton)
    for (const { title, date, check } of dueRoutines(plant)) {
      const deadline = document.createElement('span')
      const due = date <= today
      deadline.className = `care-deadline ${due ? 'due-text' : 'meta'}`
      deadline.textContent = `${due ? '! ' : ''}${title}${check ? ' 필요 여부 확인' : ''} · ${remaining(date)}`
      text.append(deadline)
    }
    if (selectedDate <= today) {
      const label = document.createElement('label')
      label.className = 'care-checkbox'
      const check = document.createElement('input')
      check.type = 'checkbox'
      check.checked = (plant.managedDates ?? []).includes(selectedDate)
      check.setAttribute('aria-label', `${title} ${selectedDate} 관리 완료`)
      check.addEventListener('change', () => {
        const dates = new Set(plant.managedDates ?? [])
        if (check.checked) dates.add(selectedDate)
        else dates.delete(selectedDate)
        try {
          persist(saved.map((entry) => entry.id === plant.id ? { ...entry, managedDates: [...dates].sort() } : entry),
            check.checked ? '관리 완료를 기록했습니다.' : '관리 완료 기록을 취소했습니다.')
          document.getElementById(check.id)?.focus()
        } catch {
          check.checked = !check.checked
          $('#message').textContent = '관리 기록을 저장할 수 없습니다.'
        }
      })
      check.id = `care-${plant.id}`
      label.append(check, '이날 관리 완료')
      text.append(label)
    }
    actions.append(button('삭제', () => {
      if (!confirm(`‘${title}’을 내 식물에서 삭제할까요?`)) return
      try {
        persist(saved.filter(({ id }) => id !== plant.id), '식물을 삭제했습니다.')
        Promise.all([deletePhoto(plant.id), ...(plant.growthEntries ?? []).filter((entry) => entry.photo)
          .map((entry) => deletePhoto(growthPhotoId(plant.id, entry.id)))]).catch(() => {
          $('#message').textContent = '식물 목록에서 삭제했습니다. 사진 저장소의 정리를 완료하지 못했습니다.'
        })
      } catch {
        $('#message').textContent = '삭제 결과를 저장할 수 없습니다.'
      }
    }, title))
    return item
  }))
}

function persist(next, message) {
  localStorage.setItem(key, JSON.stringify(next))
  saved = next
  renderCalendar()
  renderSaved()
  $('#message').textContent = message
}

function updateImportStatus() {
  $('#import-status').textContent = uploaded.length ? `엑셀 식물 ${uploaded.length}개를 식물 추가에서 선택할 수 있습니다.` : '불러온 엑셀 목록이 없습니다.'
}

function populatePicker() {
  picker.replaceChildren(new Option('식물 선택', ''), new Option('직접 입력', 'manual'))
  const groups = [
    ['엑셀에서 가져온 식물', 'upload', uploaded],
    ['초기 도감', 'catalog', plants],
    ['첨부 관리표', 'original', originals]
  ]
  for (const [label, key, entries] of groups) {
    if (!entries.length) continue
    const group = document.createElement('optgroup')
    group.label = label
    const counts = new Map()
    for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1)
    entries.forEach((entry, index) => {
      const suffix = counts.get(entry.name) > 1 ? ` (목록 ${index + 1})` : ''
      group.append(new Option(entry.name + suffix, `${key}:${index}`))
    })
    picker.append(group)
  }
}

function setPlantDefaults(plant) {
  form.elements.namedItem('name').value = plant.name ?? ''
  form.elements.namedItem('scientific').value = plant.scientific ?? ''
  const recommend = findRecommendation(plant)
  for (const field of careFields) form.elements.namedItem(field).value = plant[field] ?? recommend?.[field] ?? ''
  $('#recommendation-status').textContent = recommend ? `기본 추천 자료 · ${recommend.source}` : ''
  conditionFields.forEach((field, index) => {
    field.value = String(plant.conditions?.[index] ?? '')
  })
}

function appendPlanField(plan) {
  const row = document.createElement('div')
  row.className = 'care-plan-row'
  const enabled = document.createElement('input')
  enabled.type = 'checkbox'
  enabled.name = `enabled-${plan.id}`
  enabled.checked = plan.enabled
  const enabledLabel = document.createElement('label')
  enabledLabel.className = 'care-checkbox'
  enabledLabel.append(enabled, plan.title)
  const interval = document.createElement('input')
  interval.type = 'number'
  interval.name = plan.field ?? `interval-${plan.id}`
  interval.min = '1'
  interval.max = '3650'
  interval.step = '1'
  interval.placeholder = '간격 (일)'
  interval.setAttribute('aria-label', `${plan.title} 간격 (일)`)
  interval.value = plan.interval ?? ''
  interval.addEventListener('input', () => {
    if (interval.value) enabled.checked = true
  })
  row.append(enabledLabel, interval)
  if (plan.id.startsWith('custom-')) {
    const remove = button('삭제', () => {
      if (!confirm(`‘${plan.title}’ 항목을 삭제할까요? 이전 완료 기록은 유지됩니다.`)) return
      const item = customDraft.find(({ id }) => id === plan.id)
      customDraft = customDraft.filter(({ id }) => id !== plan.id)
      if (item) archivedDraft.push(item)
      row.remove()
      $('#custom-care-status').textContent = `‘${plan.title}’ 삭제는 저장할 때 적용됩니다.`
      $('#custom-care-name').focus()
    }, plan.title)
    remove.classList.add('delete-care')
    row.append(remove)
  }
  $('#care-plan-fields').append(row)
}

function openEditor(plant = {}, edit = false, showPlans = false) {
  editingId = edit ? plant.id : null
  returnToCare = showPlans
  customDraft = [...(plant.customCare ?? [])]
  archivedDraft = [...(plant.archivedCare ?? [])]
  form.reset()
  $('#form-error').textContent = ''
  for (const details of form.querySelectorAll('details')) details.open = false
  $('#care-plan-editor').open = showPlans
  $('#custom-care-status').textContent = ''
  $('#care-plan-fields').replaceChildren()
  carePlans(plant).forEach((plan) => appendPlanField(plan))
  $('#editor-title').textContent = edit ? '식물 수정' : '식물 추가'
  populatePicker()
  const groups = [['upload', uploaded], ['catalog', plants], ['original', originals]]
  const group = groups.find(([, entries]) => entries.includes(plant))
  const uploadedMatch = plant.name && uploaded.find((entry) => searchable(entry.name) === searchable(plant.name)
    && (!entry.scientific || !plant.scientific || searchable(entry.scientific) === searchable(plant.scientific)))
  const selected = !edit && uploadedMatch ? uploadedMatch : plant
  picker.value = !edit && uploadedMatch ? `upload:${uploaded.indexOf(uploadedMatch)}`
    : group ? `${group[0]}:${group[1].indexOf(plant)}` : ''
  $('#choose-plant').hidden = edit
  picker.disabled = edit
  $('#manual-name').hidden = !edit
  for (const field of ['nickname', 'actualPlace', 'lastWateredDate']) {
    form.elements.namedItem(field).value = String(plant[field] ?? '').trim()
  }
  const registered = form.elements.namedItem('registeredDate')
  registered.max = today
  registered.value = plant.registeredDate || today
  form.elements.namedItem('lastWateredDate').max = today
  setPlantDefaults(selected)
  editor.showModal()
  if (showPlans) $('#care-plan-editor summary').focus()
}

$('#add-custom-care').addEventListener('click', () => {
  const input = $('#custom-care-name')
  const title = input.value.trim()
  const status = $('#custom-care-status')
  if (!title || [...basicCare, ...customDraft].some((item) => searchable(item.title) === searchable(title))) {
    status.textContent = title ? '같은 이름의 관리 항목이 이미 있습니다.' : '관리 항목 이름을 입력하세요.'
    input.focus()
    return
  }
  const archived = archivedDraft.find((item) => searchable(item.title) === searchable(title))
  const definition = archived ? { ...archived, title } : { id: `custom-${crypto.randomUUID()}`, title }
  archivedDraft = archivedDraft.filter(({ id }) => id !== definition.id)
  customDraft.push(definition)
  appendPlanField({ ...definition, enabled: true })
  input.value = ''
  status.textContent = `‘${title}’을 추가했습니다. 저장하면 이 화분에 적용됩니다.`
})

picker.addEventListener('change', () => {
  const [group, index] = picker.value.split(':')
  const entries = { upload: uploaded, catalog: plants, original: originals }
  setPlantDefaults(entries[group]?.[index] ?? {})
  $('#manual-name').hidden = group !== 'manual'
  if (group === 'manual') form.elements.namedItem('name').focus()
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const values = new FormData(form)
  const name = values.get('name').trim()
  if (!name) {
    $('#form-error').textContent = '식물 이름을 입력하세요.'
    form.elements.namedItem('name').focus()
    return
  }
  const previous = saved.find((entry) => entry.id === editingId)
  const registeredDate = values.get('registeredDate')
  if (!registeredDate || registeredDate > today) {
    $('#form-error').textContent = '등록일은 오늘까지의 날짜를 선택하세요.'
    return
  }
  const lastWateredDate = values.get('lastWateredDate')
  if (lastWateredDate > today) {
    $('#form-error').textContent = '물주기 기록은 오늘까지의 날짜를 선택하세요.'
    return
  }
  const dates = new Set(previous ? waterDates(previous) : [])
  if (lastWateredDate !== previous?.lastWateredDate) {
    dates.delete(previous?.lastWateredDate)
    if (lastWateredDate) dates.add(lastWateredDate)
  }
  const waterHistory = [...dates].sort()
  const previousPlans = new Map(previous ? carePlans(previous).map((plan) => [plan.id, plan]) : [])
  const plant = {
    ...previous,
    id: editingId ?? crypto.randomUUID(),
    name,
    scientific: values.get('scientific').trim(),
    nickname: values.get('nickname').trim(),
    actualPlace: values.get('actualPlace'),
    lastWateredDate: waterHistory.at(-1) ?? '',
    waterDates: waterHistory,
    routineHistory: { ...previous?.routineHistory, water: waterHistory },
    registeredDate,
    customCare: customDraft,
    archivedCare: archivedDraft,
    carePlans: Object.fromEntries([...basicCare, ...customDraft].map(({ id, field }) => [id, {
      enabled: values.has(`enabled-${id}`),
      interval: Number(values.get(field ?? `interval-${id}`)) || null,
      startDate: previousPlans.get(id)?.interval ? previousPlans.get(id).startDate ?? today : today
    }])),
    ...Object.fromEntries(careFields.map((field) => [field, values.get(field).trim()])),
    conditions: conditionFields.map((field) => field.value || null)
  }
  const next = editingId ? saved.map((entry) => entry.id === editingId ? plant : entry) : [...saved, plant]
  try {
    if (!editingId) ownedPage = Math.ceil(next.length / pageSize)
    persist(next, editingId ? '식물을 수정했습니다.' : '내 식물에 추가했습니다.')
    editor.close()
    if (dashboard.open && detailPlantId === plant.id) {
      openOwnedDetail(plant)
      if (returnToCare) selectTab('care', true)
    } else location.hash = '#collection'
  } catch {
    $('#form-error').textContent = '브라우저 저장소에 저장할 수 없습니다. 브라우저 설정을 확인하세요.'
  }
})

$('#close').addEventListener('click', () => editor.close())
$('#quick-care').addEventListener('click', () => selectTab('care', true))
$('#quick-settings').addEventListener('click', () => selectTab('settings', true))
$('#quick-growth').addEventListener('click', () => {
  selectTab('growth')
  $('#growth-form [name=date]').focus()
})
$('#quick-report').addEventListener('click', () => {
  selectTab('growth')
  $('#report-title').focus()
})
$('#owned-detail').addEventListener('close', () => {
  if ($('#owned-detail').open) return
  detailPlantId = null
  photoPlantId = null
  clearPhotoPreview()
  showPage()
})
$('#photo-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  const id = photoPlantId
  if (!file || !id) return
  event.target.disabled = true
  $('#remove-photo').disabled = true
  try {
    await savePhoto(id, file)
    if (!saved.some((plant) => plant.id === id)) await deletePhoto(id)
    else await showPhoto(id)
    if (photoPlantId === id) $('#photo-status').textContent = '사진을 저장했습니다.'
  } catch (error) {
    if (photoPlantId === id) $('#photo-status').textContent = error.message || '사진을 저장할 수 없습니다.'
  } finally {
    event.target.value = ''
    event.target.disabled = false
    $('#remove-photo').disabled = false
  }
})
$('#remove-photo').addEventListener('click', async () => {
  const id = photoPlantId
  if (!id) return
  $('#remove-photo').disabled = true
  $('#photo-file').disabled = true
  try {
    await deletePhoto(id)
    if (photoPlantId === id) {
      clearPhotoPreview()
      $('#photo-status').textContent = '사진을 삭제했습니다.'
    }
  } catch {
    if (photoPlantId === id) $('#photo-status').textContent = '사진을 삭제할 수 없습니다.'
  } finally {
    $('#remove-photo').disabled = false
    $('#photo-file').disabled = false
  }
})
$('#import-workbook').addEventListener('click', async (event) => {
  const fileInput = $('#workbook-file')
  const file = fileInput.files[0]
  if (!file) {
    $('#import-status').textContent = '불러올 엑셀 파일을 먼저 선택하세요.'
    fileInput.focus()
    return
  }
  event.target.disabled = true
  $('#import-status').textContent = '엑셀을 확인하고 있습니다.'
  try {
    const allowed = conditionFields.map((field) => [...field.options].map((option) => option.value))
    const entries = await readPlantWorkbook(file, data.headers.slice(1), allowed)
    localStorage.setItem(workbookKey, JSON.stringify(entries))
    uploaded = entries
    fileInput.value = ''
    updateImportStatus()
  } catch (error) {
    $('#import-status').textContent = `불러오지 못했습니다. ${error.message || '엑셀 파일을 확인하세요.'}`
  } finally {
    event.target.disabled = false
  }
})
$('#load-recommendations').addEventListener('click', () => {
  const values = new FormData(form)
  const recommendation = findRecommendation({ name: values.get('name'), scientific: values.get('scientific') })
  if (!recommendation) {
    $('#recommendation-status').textContent = '확인된 추천값이 없습니다. 식물 이름이나 학명을 확인하거나 직접 입력하세요.'
    return
  }
  for (const field of careFields) {
    const input = form.elements.namedItem(field)
    if (!input.value.trim() && recommendation[field]) input.value = recommendation[field]
  }
  $('#recommendation-status').textContent = `비어 있는 항목에 추천값을 불러왔습니다. 자료 · ${recommendation.source}`
})
$('#close-detail').addEventListener('click', () => $('#plant-detail').close())
$('#create').addEventListener('click', () => openEditor())
$('#calendar-prev').addEventListener('click', () => changeMonth(-1))
$('#calendar-next').addEventListener('click', () => changeMonth(1))
$('#calendar-today').addEventListener('click', () => {
  today = seoulDate.format(new Date())
  selectedDate = today
  calendarMonth = today.slice(0, 7)
  renderCalendar()
  renderSaved()
})
function refreshToday() {
  const current = seoulDate.format(new Date())
  if (today === current) return
  if (selectedDate === today) {
    selectedDate = current
    calendarMonth = current.slice(0, 7)
  }
  today = current
  renderCalendar()
  renderSaved()
  if ($('#owned-detail').open) {
    const plant = saved.find((entry) => entry.id === detailPlantId)
    if (plant) openOwnedDetail(plant)
  }
}
setInterval(refreshToday, 30_000)
document.addEventListener('visibilitychange', refreshToday)
for (const selector of ['#source', '#category', '#season', '#search']) {
  $(selector).addEventListener('input', () => {
    catalogPage = 1
    renderCatalog()
  })
}

const pages = { collection: '내 식물', library: '식물 도감', spreadsheet: '엑셀 양식' }
function goToPlant(id) {
  const route = `#plant/${encodeURIComponent(id)}`
  if (location.hash !== route) location.hash = route
}

function showPage() {
  const page = location.hash.slice(1)
  const plant = page.startsWith('plant/') ? saved.find(({ id }) => page === `plant/${encodeURIComponent(id)}`) : null
  const active = Object.hasOwn(pages, page) ? page : 'collection'
  if (dashboard.open && detailPlantId !== plant?.id) dashboard.close()
  $('main > header').hidden = Boolean(plant)
  $('#quick-plants').hidden = active !== 'collection'
  for (const id of Object.keys(pages)) {
    $(`#${id}`).hidden = id !== active || (id === 'collection' && Boolean(plant))
    const link = $(`nav a[href="#${id}"]`)
    if (id === active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  $('#page-title').textContent = pages[active]
  document.title = `PLANT FIT · ${plant ? plant.nickname || plant.name : pages[active]}`
  if (plant && !dashboard.open) openOwnedDetail(plant)
  window.scrollTo(0, 0)
}
window.addEventListener('hashchange', showPage)
renderCatalog()
renderCalendar()
renderSaved()
if (uploaded.length) updateImportStatus()
showPage()
